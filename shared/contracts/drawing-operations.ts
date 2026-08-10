import { z } from "zod";

export const MAX_DRAWING_OPERATIONS = 40;
export const MAX_DRAWING_DIMENSION = 10_000;
export const MAX_DRAWING_TEXT_LENGTH = 4_000;

const finiteNumber = z.number().finite();
const positiveDimension = finiteNumber.positive().max(MAX_DRAWING_DIMENSION);
const color = z.string().trim().min(1).max(64);
const arrowhead = z.enum([
  "arrow",
  "bar",
  "dot",
  "triangle",
  "triangle_outline",
  "crowfoot_one",
  "crowfoot_many",
  "crowfoot_one_or_many",
]);

const geometrySchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: positiveDimension,
  height: positiveDimension,
});

const styleSchema = z.object({
  strokeColor: color.optional(),
  backgroundColor: color.optional(),
  fillStyle: z.enum(["solid", "hachure", "cross-hatch"]).optional(),
  strokeWidth: z.number().int().min(1).max(4).optional(),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  roughness: z.number().int().min(0).max(3).optional(),
  opacity: z.number().int().min(0).max(100).optional(),
});

const lineStyleSchema = z.object({
  startArrowhead: arrowhead.optional(),
  endArrowhead: arrowhead.optional(),
});

const textStyleSchema = z.object({
  fontSize: positiveDimension.max(200).optional(),
  fontFamily: z.number().int().min(1).max(3).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),
});

const baseSkeletonSchema = geometrySchema.merge(styleSchema);
const rectangleSkeletonSchema = baseSkeletonSchema.extend({ type: z.literal("rectangle") }).strict();
const diamondSkeletonSchema = baseSkeletonSchema.extend({ type: z.literal("diamond") }).strict();
const ellipseSkeletonSchema = baseSkeletonSchema.extend({ type: z.literal("ellipse") }).strict();
const lineSkeletonSchema = baseSkeletonSchema.merge(lineStyleSchema).extend({ type: z.literal("line") }).strict();
const arrowSkeletonSchema = baseSkeletonSchema.merge(lineStyleSchema).extend({ type: z.literal("arrow") }).strict();
const textSkeletonSchema = baseSkeletonSchema.merge(textStyleSchema).extend({
  type: z.literal("text"),
  text: z.string().trim().min(1).max(MAX_DRAWING_TEXT_LENGTH),
}).strict();

export const drawingElementSkeletonSchema = z.union([
  rectangleSkeletonSchema,
  diamondSkeletonSchema,
  ellipseSkeletonSchema,
  lineSkeletonSchema,
  arrowSkeletonSchema,
  textSkeletonSchema,
]);

const patchSchema = geometrySchema.partial()
  .merge(styleSchema)
  .merge(lineStyleSchema)
  .merge(textStyleSchema)
  .extend({ text: z.string().trim().min(1).max(MAX_DRAWING_TEXT_LENGTH).optional() })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Update patches must not be empty");

export const addOperationSchema = z.object({
  op: z.literal("add"),
  element: drawingElementSkeletonSchema,
}).strict();

export const updateOperationSchema = z.object({
  op: z.literal("update"),
  id: z.string().trim().min(1).max(256),
  patch: patchSchema,
}).strict();

export const deleteOperationSchema = z.object({
  op: z.literal("delete"),
  id: z.string().trim().min(1).max(256),
}).strict();

export const drawingOperationSchema = z.union([
  addOperationSchema,
  updateOperationSchema,
  deleteOperationSchema,
]);

export type DrawingElementSkeleton = z.infer<typeof drawingElementSkeletonSchema>;
export type AddOperation = z.infer<typeof addOperationSchema>;
export type UpdateOperation = z.infer<typeof updateOperationSchema>;
export type DeleteOperation = z.infer<typeof deleteOperationSchema>;
export type DrawingOperation = z.infer<typeof drawingOperationSchema>;

export interface DrawingOperationContext {
  selectedIds: ReadonlySet<string>;
  /** A caller may lower the limit for a specific request but can never raise it above 40. */
  maxOperations?: number;
}

/**
 * Validates model output as a complete, all-or-nothing proposal. Client-side
 * materialization owns the IDs for additions; model output can only target IDs
 * already supplied in the current selection for updates or deletions.
 */
export function validateDrawingOperations(
  operations: unknown,
  context: DrawingOperationContext,
): DrawingOperation[] {
  if (!Array.isArray(operations)) {
    throw new DrawingOperationValidationError("Drawing operations must be an array");
  }

  const maxOperations = effectiveOperationLimit(context.maxOperations);
  if (operations.length > maxOperations) {
    throw new DrawingOperationValidationError(`A drawing proposal may contain at most ${maxOperations} operations`);
  }

  const targetIds = new Set<string>();
  return operations.map((operation, index) => {
    const parsed = parseOperation(operation, index);
    if (parsed.op !== "add") {
      if (!context.selectedIds.has(parsed.id)) {
        throw new DrawingOperationValidationError(`Operation ${index + 1} targets an ID outside the selected context`);
      }
      if (targetIds.has(parsed.id)) {
        throw new DrawingOperationValidationError(`Operation ${index + 1} duplicates target ID \"${parsed.id}\"`);
      }
      targetIds.add(parsed.id);
    }
    return parsed;
  });
}

export class DrawingOperationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawingOperationValidationError";
  }
}

function effectiveOperationLimit(requestedLimit: number | undefined): number {
  if (requestedLimit === undefined) return MAX_DRAWING_OPERATIONS;
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw new DrawingOperationValidationError("Operation limit must be a positive integer");
  }
  return Math.min(requestedLimit, MAX_DRAWING_OPERATIONS);
}

function parseOperation(operation: unknown, index: number): DrawingOperation {
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
    throw new DrawingOperationValidationError(`Operation ${index + 1} must be an object`);
  }

  const candidate = operation as Record<string, unknown>;
  if (candidate.op === "add") {
    const element = candidate.element;
    if (!element || typeof element !== "object" || Array.isArray(element)) {
      throw new DrawingOperationValidationError(`Operation ${index + 1} must contain an element object`);
    }
    const type = (element as Record<string, unknown>).type;
    if (typeof type !== "string" || !isSupportedElementType(type)) {
      throw new DrawingOperationValidationError(`Operation ${index + 1} uses an unsupported element type`);
    }
  }

  if (candidate.op === "update") {
    const patch = candidate.patch;
    if (patch && typeof patch === "object" && !Array.isArray(patch)) {
      const unknownFields = Object.keys(patch).filter((field) => !PATCH_FIELDS.has(field));
      if (unknownFields.length > 0) {
        throw new DrawingOperationValidationError(`Operation ${index + 1} contains unknown patch field \"${unknownFields[0]}\"`);
      }
    }
  }

  const parsed = drawingOperationSchema.safeParse(operation);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DrawingOperationValidationError(`Operation ${index + 1} is invalid: ${issue?.message ?? "invalid schema"}`);
  }
  return parsed.data;
}

function isSupportedElementType(value: string): value is DrawingElementSkeleton["type"] {
  return SUPPORTED_ELEMENT_TYPES.has(value as DrawingElementSkeleton["type"]);
}

const SUPPORTED_ELEMENT_TYPES = new Set<DrawingElementSkeleton["type"]>([
  "rectangle",
  "diamond",
  "ellipse",
  "line",
  "arrow",
  "text",
]);

const PATCH_FIELDS = new Set([
  "x",
  "y",
  "width",
  "height",
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
  "startArrowhead",
  "endArrowhead",
  "fontSize",
  "fontFamily",
  "textAlign",
  "verticalAlign",
  "text",
]);
