export {
  DrawingOperationValidationError,
  validateDrawingOperations,
  type AddOperation,
  type DeleteOperation,
  type DrawingElementSkeleton,
  type DrawingOperation,
  type DrawingOperationContext,
  type UpdateOperation,
} from "../../shared/contracts/drawing-operations";

import { z } from "zod";
import type { DrawingGenerationRequest } from "../../shared/contracts/generation";
import { AppError } from "../lib/errors";
import type { OpenRouterChatCompletion } from "./client";
import { DrawingOperationValidationError, validateDrawingOperations } from "../../shared/contracts/drawing-operations";

const generatedDrawingOperationResultSchema = z.object({
  operations: z.array(z.unknown()).max(40),
  note: z.string().trim().min(1).max(1_000).optional(),
}).strict();

const coordinateSchema = { type: "number" };
const dimensionSchema = { type: "number", exclusiveMinimum: 0, maximum: 10_000 };
const colorSchema = { type: "string", minLength: 1, maxLength: 64 };
const arrowheadSchema = {
  type: "string",
  enum: ["arrow", "bar", "dot", "triangle", "triangle_outline", "crowfoot_one", "crowfoot_many", "crowfoot_one_or_many"],
};
const baseElementProperties = {
  x: coordinateSchema,
  y: coordinateSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  strokeColor: colorSchema,
  backgroundColor: colorSchema,
  fillStyle: { type: "string", enum: ["solid", "hachure", "cross-hatch"] },
  strokeWidth: { type: "integer", minimum: 1, maximum: 4 },
  strokeStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
  roughness: { type: "integer", minimum: 0, maximum: 3 },
  opacity: { type: "integer", minimum: 0, maximum: 100 },
};
const lineStyleProperties = { startArrowhead: arrowheadSchema, endArrowhead: arrowheadSchema };
const textStyleProperties = {
  fontSize: { type: "number", exclusiveMinimum: 0, maximum: 200 },
  fontFamily: { type: "integer", minimum: 1, maximum: 3 },
  textAlign: { type: "string", enum: ["left", "center", "right"] },
  verticalAlign: { type: "string", enum: ["top", "middle", "bottom"] },
};

function elementVariant(type: string, properties: Record<string, unknown>, required: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["type", "x", "y", "width", "height", ...required],
    properties: { type: { type: "string", const: type }, ...baseElementProperties, ...properties },
  };
}

const drawingElementJsonSchema = {
  oneOf: [
    elementVariant("rectangle", {}, []),
    elementVariant("diamond", {}, []),
    elementVariant("ellipse", {}, []),
    elementVariant("line", lineStyleProperties, []),
    elementVariant("arrow", lineStyleProperties, []),
    elementVariant("text", {
      ...textStyleProperties,
      text: { type: "string", minLength: 1, maxLength: 4_000 },
    }, ["text"]),
  ],
};

const patchJsonSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ...baseElementProperties,
    ...lineStyleProperties,
    ...textStyleProperties,
    text: { type: "string", minLength: 1, maxLength: 4_000 },
  },
};

/** Matches the runtime validator so provider-invalid operations are rejected before completion. */
export const drawingOperationResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "drawing_operations",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["operations"],
      properties: {
        operations: {
          type: "array",
          maxItems: 40,
          items: {
            oneOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["op", "element"],
                properties: { op: { type: "string", const: "add" }, element: drawingElementJsonSchema },
              },
              {
                type: "object",
                additionalProperties: false,
                required: ["op", "id", "patch"],
                properties: {
                  op: { type: "string", const: "update" },
                  id: { type: "string", minLength: 1, maxLength: 256 },
                  patch: patchJsonSchema,
                },
              },
              {
                type: "object",
                additionalProperties: false,
                required: ["op", "id"],
                properties: {
                  op: { type: "string", const: "delete" },
                  id: { type: "string", minLength: 1, maxLength: 256 },
                },
              },
            ],
          },
        },
        note: { type: "string", minLength: 1, maxLength: 1_000 },
      },
    },
  },
} as const;

const SYSTEM_INSTRUCTION = `You propose bounded Excalidraw drawing operations from a reduced semantic scene context.
Return only the requested JSON object, never markdown or prose.
Coordinates use Excalidraw scene units. x and y locate the top-left of the element; width and height must be positive.
Supported add element types are rectangle, diamond, ellipse, line, arrow, and text. Add operations omit IDs because the client creates them.
Only update or delete IDs listed in selectedIds. You may always add elements near the given viewport center or selected context.
Use simple unbound elements. Express connections as line or arrow geometry; do not emit bindings, files, version fields, deletion flags, arbitrary data, or full scenes.
Return at most 40 operations.`;

/**
 * Projects input into the provider payload. Keeping this explicit prevents a
 * future request-field addition from leaking opaque scene data to OpenRouter.
 */
export function createDrawingSemanticContext(input: DrawingGenerationRequest) {
  return {
    selectedIds: [...input.selectedIds],
    elements: input.semantic.elements.map((element) => ({
      id: element.id,
      type: element.type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      ...(element.text === undefined ? {} : { text: element.text }),
      ...(element.strokeColor === undefined ? {} : { strokeColor: element.strokeColor }),
      ...(element.backgroundColor === undefined ? {} : { backgroundColor: element.backgroundColor }),
    })),
    viewportCenter: { ...input.semantic.viewportCenter },
  };
}

export function buildDrawingGenerationRequest(input: DrawingGenerationRequest) {
  const context = createDrawingSemanticContext(input);
  return {
    model: input.model,
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      {
        role: "user",
        content: [
          "User instruction:",
          input.prompt,
          "Reduced semantic context (JSON):",
          JSON.stringify(context),
        ].join("\n\n"),
      },
    ],
    responseFormat: drawingOperationResponseFormat,
    provider: { require_parameters: true },
  };
}

export function parseGeneratedDrawingOperations(completion: OpenRouterChatCompletion, selectedIds: ReadonlySet<string>) {
  const content = completion.choices[0]?.message.content;
  if (typeof content !== "string") throw invalidDrawingOutput();

  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    throw invalidDrawingOutput();
  }

  const parsed = generatedDrawingOperationResultSchema.safeParse(decoded);
  if (!parsed.success) throw invalidDrawingOutput();

  try {
    return {
      operations: validateDrawingOperations(parsed.data.operations, { selectedIds }),
      ...(parsed.data.note === undefined ? {} : { note: parsed.data.note }),
    };
  } catch (error) {
    if (error instanceof DrawingOperationValidationError) throw invalidDrawingOutput();
    throw error;
  }
}

function invalidDrawingOutput(): AppError {
  // Never use model-controlled error text here: it may echo a prompt or private element labels.
  return new AppError(422, "validation_failed", "OpenRouter returned invalid drawing operations");
}
