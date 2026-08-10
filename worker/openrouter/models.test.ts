import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { OpenRouterClient } from "./client";
import {
  normalizeOpenRouterModels,
  requireCompatibleModel,
  supportsInterfaceGeneration,
  supportsStructuredOutput,
} from "./models";
import { modelCatalogCacheKey } from "../routes/models";

const catalogResponse = {
  data: [
    {
      id: "openrouter/vision-json",
      name: "Vision JSON",
      architecture: { input_modalities: ["text", "image"] },
      supported_parameters: ["response_format", "temperature"],
      context_length: 128_000,
      pricing: { prompt: "0.000001", completion: "0.000002", image: "0.001" },
    },
    {
      id: "openrouter/text-json",
      name: "Text JSON",
      architecture: { input_modalities: ["text"] },
      supported_parameters: ["response_format"],
      context_length: 32_000,
      pricing: { prompt: "0.000001", completion: "0.000002" },
    },
  ],
};

describe("OpenRouter model capabilities", () => {
  it("normalizes the documented model catalog and filters image-capable structured models", () => {
    const models = normalizeOpenRouterModels(catalogResponse);

    expect(models).toEqual([
      {
        id: "openrouter/vision-json",
        name: "Vision JSON",
        inputModalities: ["text", "image"],
        supportedParameters: ["response_format", "temperature"],
        contextLength: 128_000,
        pricing: { prompt: "0.000001", completion: "0.000002", image: "0.001" },
      },
      {
        id: "openrouter/text-json",
        name: "Text JSON",
        inputModalities: ["text"],
        supportedParameters: ["response_format"],
        contextLength: 32_000,
        pricing: { prompt: "0.000001", completion: "0.000002" },
      },
    ]);
    expect(models.filter(supportsInterfaceGeneration).map((model) => model.id)).toEqual([
      "openrouter/vision-json",
    ]);
  });

  it("requires image input and structured output for interface generation", () => {
    expect(supportsInterfaceGeneration({
      inputModalities: ["text", "image"],
      supportedParameters: ["response_format"],
    })).toBe(true);
    expect(supportsInterfaceGeneration({
      inputModalities: ["text"],
      supportedParameters: ["response_format"],
    })).toBe(false);
    expect(supportsStructuredOutput({
      inputModalities: ["text"],
      supportedParameters: ["response_format"],
    })).toBe(true);
  });

  it("uses the server credential and request abort signal for a catalog request", async () => {
    const controller = new AbortController();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify(catalogResponse), {
      headers: { "content-type": "application/json" },
    }));
    const client = new OpenRouterClient({ apiKey: "sk-or-server-only", appOrigin: "https://webdraw.test", fetch });

    await expect(client.listModels({ signal: controller.signal })).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "openrouter/vision-json" }),
    ]));
    expect(fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models", expect.objectContaining({
      signal: controller.signal,
      headers: {
        Authorization: "Bearer sk-or-server-only",
        "HTTP-Referer": "https://webdraw.test",
        "X-OpenRouter-Title": "Webdraw",
        "content-type": "application/json",
      },
    }));
  });

  it("normalizes provider failures without returning credentials or prompt content", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "sk-or-server-only rejected private prompt: confidential canvas" },
    }), { status: 401, headers: { "content-type": "application/json" } }));
    const client = new OpenRouterClient({ apiKey: "sk-or-server-only", appOrigin: "https://webdraw.test", fetch });

    await expect(client.chatCompletion({
      model: "openrouter/vision-json",
      messages: [{ role: "user", content: "confidential canvas" }],
    })).rejects.toMatchObject({
      status: 502,
      code: "openrouter_error",
      message: "OpenRouter request failed",
    });
  });

  it("requires an authenticated session before exposing models", async () => {
    const response = await createApp().request("http://example.test/api/models?purpose=interface");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unauthorized", message: "Authentication required" },
    });
  });

  it("rechecks the live catalog before each generation capability decision", async () => {
    let calls = 0;
    const listModels = async () => {
      calls += 1;
      return normalizeOpenRouterModels(calls === 1 ? catalogResponse : {
        data: [{
          ...catalogResponse.data[0],
          architecture: { input_modalities: ["text"] },
        }],
      });
    };

    await expect(requireCompatibleModel(listModels, "openrouter/vision-json", "interface"))
      .resolves.toMatchObject({ id: "openrouter/vision-json" });
    await expect(requireCompatibleModel(listModels, "openrouter/vision-json", "interface"))
      .rejects.toMatchObject({ code: "validation_failed" });
    expect(calls).toBe(2);
  });

  it("uses one credential-free public cache key for a purpose", () => {
    expect(modelCatalogCacheKey("https://webdraw.test/", "interface").url).toBe(
      "https://webdraw.test/__webdraw/model-catalog?purpose=interface",
    );
  });
});
