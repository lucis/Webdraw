import { z } from "zod";
import type { HtmlArtifact } from "../../shared/contracts/artifacts";
import type { InterfaceGenerationRequest } from "../../shared/contracts/generation";
import { AppError } from "../lib/errors";
import type { OpenRouterChatCompletion } from "./client";

export const MAX_INTERFACE_IMAGE_BYTES = 1_000_000;
export const MAX_INTERFACE_SOURCE_BYTES = 200_000;

const generatedHtmlArtifactSchema = z.object({
  kind: z.literal("html"),
  title: z.string().trim().min(1).max(240),
  sourceHtml: z.string().min(1),
}).strict();

export const htmlArtifactResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "html_artifact",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "title", "sourceHtml"],
      properties: {
        kind: { type: "string", const: "html" },
        title: { type: "string", minLength: 1, maxLength: 240 },
        sourceHtml: { type: "string", minLength: 1, maxLength: MAX_INTERFACE_SOURCE_BYTES },
      },
    },
  },
} as const;

const SYSTEM_INSTRUCTION = `You generate one accessible, complete HTML interface document from a drawing.
Return only the requested JSON object, never markdown or prose.
sourceHtml must begin with <!doctype html> and contain html and body elements.
Use Tailwind utility classes for layout and presentation. The sandboxed preview wrapper provides the pinned Tailwind browser runtime; do not add Tailwind CDN scripts, links, or any other remote dependency to sourceHtml.
Optional CSS and JavaScript must be embedded in sourceHtml. Do not use external URLs, external script or style resources, or a top navigation bar.
Use semantic, accessible HTML: labels for controls, useful button text, and appropriate headings and landmarks.`;

export function validatePngDataUrl(value: string): void {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match || match[1].length === 0 || match[1].length % 4 !== 0) {
    throw new AppError(400, "validation_failed", "Selection image must be a PNG data URL");
  }

  const base64 = match[1];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = (base64.length / 4) * 3 - padding;
  if (bytes > MAX_INTERFACE_IMAGE_BYTES) {
    throw new AppError(413, "validation_failed", "Selection image exceeds the 1000000 byte limit", {
      maxBytes: MAX_INTERFACE_IMAGE_BYTES,
    });
  }
}

export function buildInterfaceGenerationRequest(input: InterfaceGenerationRequest) {
  const revisionContext = input.mode === "revise"
    ? `\nRevise the current interface source below while applying the user instruction.\nCURRENT SOURCE:\n${input.currentSourceHtml}`
    : "";
  const userText = [
    "Create an interface that faithfully follows this drawing selection.",
    input.instruction ? `User instruction: ${input.instruction}` : "",
    `Selection semantics (JSON): ${JSON.stringify(input.selection.semantic)}`,
    revisionContext,
  ].filter(Boolean).join("\n\n");

  return {
    model: input.model,
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: input.selection.pngDataUrl } },
        ],
      },
    ],
    responseFormat: htmlArtifactResponseFormat,
    provider: { require_parameters: true },
  };
}

export function parseGeneratedHtmlArtifact(completion: OpenRouterChatCompletion): HtmlArtifact {
  const content = completion.choices[0]?.message.content;
  if (typeof content !== "string") {
    throw invalidModelOutput();
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    throw invalidModelOutput();
  }

  const parsed = generatedHtmlArtifactSchema.safeParse(decoded);
  if (!parsed.success) throw invalidModelOutput();
  validateSourceHtml(parsed.data.sourceHtml);
  return parsed.data;
}

/** Shared by AI generation and the later manual source editor route. */
export function validateSourceHtml(sourceHtml: string): void {
  if (new TextEncoder().encode(sourceHtml).byteLength > MAX_INTERFACE_SOURCE_BYTES) {
    throw new AppError(422, "validation_failed", "Generated HTML exceeds the 200000 byte limit", {
      maxBytes: MAX_INTERFACE_SOURCE_BYTES,
    });
  }
  if (
    !/^\s*<!doctype\s+html\s*>/i.test(sourceHtml) ||
    !/<html\b[^>]*>/i.test(sourceHtml) ||
    !/<body\b[^>]*>/i.test(sourceHtml) ||
    !/<\/body\s*>/i.test(sourceHtml) ||
    !/<\/html\s*>/i.test(sourceHtml)
  ) {
    throw invalidModelOutput("Generated HTML must be a complete document");
  }
  if (/```/.test(sourceHtml)) throw invalidModelOutput("Generated HTML must not contain markdown fences");
  if (/<script\b[^>]*\bsrc\s*=/i.test(sourceHtml) || /<link\b[^>]*\bhref\s*=/i.test(sourceHtml) || /@import\b/i.test(sourceHtml)) {
    throw invalidModelOutput("Generated HTML must not use external script or style resources");
  }
  if (/(?:https?:)?\/\//i.test(sourceHtml)) {
    throw invalidModelOutput("Generated HTML must not use external URLs");
  }
  if (/<nav\b/i.test(sourceHtml)) {
    throw invalidModelOutput("Generated HTML must not include top navigation");
  }
}

function invalidModelOutput(message = "OpenRouter returned invalid HTML artifact output"): AppError {
  return new AppError(422, "validation_failed", message);
}
