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

/**
 * Keep provenance useful without retaining caller-controlled opaque payloads.
 * In particular, bindings can carry arbitrary Excalidraw file data and must
 * never cross the persistence boundary.
 */
export function createPersistableSemanticSnapshot(
  semantic: InterfaceGenerationRequest["selection"]["semantic"],
) {
  const snapshot = {
    elements: semantic.elements.map((element) => ({
      id: element.id,
      type: element.type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      ...(element.text === undefined ? {} : { text: element.text }),
      ...(element.strokeColor === undefined ? {} : { strokeColor: element.strokeColor }),
      ...(element.backgroundColor === undefined ? {} : { backgroundColor: element.backgroundColor }),
      ...(element.frameId === undefined ? {} : { frameId: element.frameId }),
      ...(element.groupIds === undefined ? {} : { groupIds: element.groupIds }),
    })),
    bounds: { ...semantic.bounds },
  };
  return sanitizePersistedSnapshot(snapshot) as typeof snapshot;
}

export async function parseGeneratedHtmlArtifact(completion: OpenRouterChatCompletion): Promise<HtmlArtifact> {
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
  await validateSourceHtml(parsed.data.sourceHtml);
  return parsed.data;
}

/** Shared by AI generation and the later manual source editor route. */
export async function validateSourceHtml(sourceHtml: string): Promise<void> {
  if (new TextEncoder().encode(sourceHtml).byteLength > MAX_INTERFACE_SOURCE_BYTES) {
    throw new AppError(422, "validation_failed", "Generated HTML exceeds the 200000 byte limit", {
      maxBytes: MAX_INTERFACE_SOURCE_BYTES,
    });
  }
  if (!await hasCompleteHtmlDocument(sourceHtml)) {
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

function redactOpaqueData(value: string): string {
  const decoded = safelyDecodePercentEscapes(value);
  const inspection = decoded.replace(/[\t\n\f\r ]/g, "");
  if (/data:[^,\s"'<>]*,/i.test(inspection) || /iVBORw0KGgo/.test(inspection)) {
    return "[redacted binary data]";
  }
  return value;
}

/** Applies the data-URL rule at every persisted string boundary without mutating request input. */
function sanitizePersistedSnapshot(value: unknown): unknown {
  if (typeof value === "string") return redactOpaqueData(value);
  if (Array.isArray(value)) return value.map(sanitizePersistedSnapshot);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizePersistedSnapshot(nestedValue)]),
    );
  }
  return value;
}

/**
 * Decodes valid percent-escape runs without throwing. Invalid escapes remain
 * exactly as supplied, so ordinary text such as "%ZZ" is not mutated.
 */
function safelyDecodePercentEscapes(value: string): string {
  let decoded = "";

  for (let index = 0; index < value.length;) {
    const percentRun = /^(?:%[0-9A-Fa-f]{2})+/.exec(value.slice(index))?.[0];
    if (percentRun) {
      try {
        decoded += decodeURIComponent(percentRun);
        index += percentRun.length;
        continue;
      } catch {
        // Preserve invalid UTF-8 percent sequences exactly as user text.
      }
    }

    decoded += value[index];
    index += 1;
  }

  return decoded;
}

/**
 * HTMLRewriter is the Worker-native HTML parser. Unlike a regex, its callbacks
 * distinguish actual source end tags from text in scripts and comments.
 */
async function hasCompleteHtmlDocument(source: string): Promise<boolean> {
  if (!source.trimStart().toLowerCase().startsWith("<!doctype html")) return false;

  let hasHtmlOpen = false;
  let hasBodyOpen = false;
  let hasHtmlClose = false;
  let hasBodyClose = false;
  let hasHtmlDoctype = false;
  const registerEndTag = (tagName: "html" | "body") => (tag: EndTag) => {
    if (tag.name.toLowerCase() === tagName) {
      if (tagName === "html") hasHtmlClose = true;
      else hasBodyClose = true;
    }
  };

  try {
    const response = new HTMLRewriter()
      .onDocument({
        doctype(doctype) {
          hasHtmlDoctype = doctype.name?.toLowerCase() === "html";
        },
      })
      .on("html", {
        element(element) {
          hasHtmlOpen = true;
          element.onEndTag(registerEndTag("html"));
        },
      })
      .on("body", {
        element(element) {
          hasBodyOpen = true;
          element.onEndTag(registerEndTag("body"));
        },
      })
      .transform(new Response(source, { headers: { "content-type": "text/html; charset=utf-8" } }));
    await response.arrayBuffer();
  } catch {
    return false;
  }

  return hasHtmlDoctype && hasHtmlOpen && hasBodyOpen && hasBodyClose && hasHtmlClose;
}
