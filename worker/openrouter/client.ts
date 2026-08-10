import { z } from "zod";
import type { Model } from "../../shared/contracts/models";
import { AppError } from "../lib/errors";
import { normalizeOpenRouterModels, type OpenRouterModelCatalogResponse } from "./models";

const OPENROUTER_API_ORIGIN = "https://openrouter.ai/api/v1";

const catalogResponseSchema: z.ZodType<OpenRouterModelCatalogResponse> = z.object({
  data: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    architecture: z.object({ input_modalities: z.array(z.string()).nullable().optional() }).nullable().optional(),
    supported_parameters: z.array(z.string()).nullable().optional(),
    context_length: z.number().finite().nullable().optional(),
    pricing: z.object({
      prompt: z.string().optional(),
      completion: z.string().optional(),
      image: z.string().optional(),
      request: z.string().optional(),
    }).nullable().optional(),
  }).passthrough()),
}).passthrough();

const chatCompletionResponseSchema = z.object({
  id: z.string().optional(),
  choices: z.array(z.object({
    message: z.object({
      role: z.string().optional(),
      content: z.unknown().nullable().optional(),
    }).passthrough(),
  }).passthrough()).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
  }).passthrough().optional(),
}).passthrough();

const providerErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    code: z.union([z.string(), z.number()]).optional(),
  }).passthrough().optional(),
}).passthrough();

export interface OpenRouterClientOptions {
  apiKey?: string;
  appOrigin: string;
  fetch?: typeof globalThis.fetch;
}

export interface OpenRouterChatCompletionRequest {
  model: string;
  messages: unknown[];
  responseFormat?: unknown;
  provider?: unknown;
  signal?: AbortSignal;
}

export type OpenRouterChatCompletion = z.infer<typeof chatCompletionResponseSchema>;

export class OpenRouterClient {
  private readonly fetchImplementation: typeof globalThis.fetch;

  constructor(private readonly options: OpenRouterClientOptions) {
    // Workerd's native fetch checks its receiver. Keep the global method bound
    // when no test/custom implementation is supplied.
    this.fetchImplementation = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async listModels(options: { signal?: AbortSignal } = {}): Promise<Model[]> {
    const response = await this.fetchJson("/models", { method: "GET", signal: options.signal });
    const parsed = catalogResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new AppError(502, "openrouter_error", "Invalid OpenRouter response");
    }
    return normalizeOpenRouterModels(parsed.data);
  }

  async chatCompletion(request: OpenRouterChatCompletionRequest): Promise<OpenRouterChatCompletion> {
    const response = await this.fetchJson("/chat/completions", {
      method: "POST",
      signal: request.signal,
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        ...(request.responseFormat === undefined ? {} : { response_format: request.responseFormat }),
        ...(request.provider === undefined ? {} : { provider: request.provider }),
      }),
    });
    const parsed = chatCompletionResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new AppError(502, "openrouter_error", "Invalid OpenRouter response");
    }
    return parsed.data;
  }

  private async fetchJson(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImplementation(`${OPENROUTER_API_ORIGIN}${path}`, {
        ...init,
        headers: {
          ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
          "HTTP-Referer": this.options.appOrigin,
          "X-OpenRouter-Title": "Webdraw",
          "content-type": "application/json",
        },
      });
    } catch (error) {
      // Keep the response sanitized, while retaining enough operational context
      // to distinguish local runtime/network failures from provider responses.
      console.error("OpenRouter request transport failure", {
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : undefined,
        cause: error instanceof Error && error.cause instanceof Error
          ? { name: error.cause.name, message: error.cause.message }
          : undefined,
      });
      throw new AppError(502, "openrouter_error", "OpenRouter request failed");
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const providerError = providerErrorSchema.safeParse(body);
      // Provider error text can echo credentials or private prompts, so never
      // log or return it. Status and provider code are safe operational data.
      console.error("OpenRouter response failure", {
        status: response.status,
        code: providerError.success ? providerError.data.error?.code : undefined,
      });
      if (response.status === 429) {
        throw new AppError(429, "rate_limited", "OpenRouter request failed");
      }
      throw new AppError(502, "openrouter_error", "OpenRouter request failed");
    }
    return body;
  }
}
