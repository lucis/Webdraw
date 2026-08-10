import { z } from "zod";
import { htmlArtifactSchema } from "./artifacts";

export const generationRunStatusSchema = z.enum([
  "pending",
  "succeeded",
  "failed",
  "cancelled",
]);

export const generationPurposeSchema = z.enum([
  "interface",
  "artifact_revision",
  "manual_edit",
  "drawing",
]);

export const MAX_DRAWING_GENERATION_PROMPT_LENGTH = 4_000;
export const MAX_DRAWING_GENERATION_CONTEXT_ELEMENTS = 40;
export const MAX_DRAWING_GENERATION_SELECTED_IDS = 40;
export const MAX_DRAWING_GENERATION_TEXT_LENGTH = 4_000;
export const MAX_DRAWING_GENERATION_COORDINATE = 1_000_000;
export const MAX_DRAWING_GENERATION_DIMENSION = 10_000;

export const selectionBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

/** The stable, reduced selection shape sent alongside the private PNG. */
export const semanticSelectionElementSchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  text: z.string().optional(),
  strokeColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  frameId: z.string().nullable().optional(),
  groupIds: z.array(z.string()).optional(),
  boundElements: z.array(z.unknown()).optional(),
  bindings: z.record(z.unknown()).optional(),
});

export const selectionContextSchema = z.object({
  pngDataUrl: z.string().min(1),
  semantic: z.object({
    elements: z.array(semanticSelectionElementSchema),
    bounds: selectionBoundsSchema,
  }),
});

/**
 * Transport input for POST /api/generations/interface. The `kind` field is
 * intentionally a literal rather than the broad Artifact union: React is a
 * reserved persistence boundary, not an implemented generation target.
 */
export const interfaceGenerationRequestSchema = z.object({
  mode: z.enum(["create", "revise"]).default("create"),
  kind: z.literal("html"),
  drawingId: z.string(),
  drawingVersion: z.number().int().positive(),
  model: z.string().min(1),
  instruction: z.string().optional(),
  selection: selectionContextSchema,
  artifactId: z.string().min(1).optional(),
  expectedActiveVersion: z.number().int().positive().optional(),
  currentSourceHtml: z.string().min(1).optional(),
  artifactDimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
}).superRefine((value, context) => {
  if (value.mode !== "revise") return;

  for (const key of ["artifactId", "expectedActiveVersion", "currentSourceHtml", "artifactDimensions"] as const) {
    if (value[key] === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required for revisions`,
      });
    }
  }
});

const drawingGenerationCoordinateSchema = z.number().finite().min(-MAX_DRAWING_GENERATION_COORDINATE).max(MAX_DRAWING_GENERATION_COORDINATE);
const drawingGenerationDimensionSchema = z.number().finite().positive().max(MAX_DRAWING_GENERATION_DIMENSION);
const drawingGenerationIdSchema = z.string().trim().min(1).max(256);

/**
 * Intentionally reduced, text-only Excalidraw context for AI drawing. This is
 * a transport boundary: screenshots, bindings, file references, versions,
 * and other opaque element data are rejected rather than silently forwarded.
 */
export const drawingSemanticElementSchema = z.object({
  id: drawingGenerationIdSchema,
  type: z.string().trim().min(1).max(64),
  x: drawingGenerationCoordinateSchema,
  y: drawingGenerationCoordinateSchema,
  width: drawingGenerationDimensionSchema,
  height: drawingGenerationDimensionSchema,
  text: z.string().max(MAX_DRAWING_GENERATION_TEXT_LENGTH).optional(),
  strokeColor: z.string().trim().min(1).max(64).optional(),
  backgroundColor: z.string().trim().min(1).max(64).optional(),
}).strict();

export const drawingGenerationRequestSchema = z.object({
  drawingId: drawingGenerationIdSchema,
  drawingVersion: z.number().int().positive(),
  model: z.string().trim().min(1).max(256),
  prompt: z.string().trim().min(1).max(MAX_DRAWING_GENERATION_PROMPT_LENGTH),
  selectedIds: z.array(drawingGenerationIdSchema).max(MAX_DRAWING_GENERATION_SELECTED_IDS)
    .refine((ids) => new Set(ids).size === ids.length, "selectedIds must not contain duplicates"),
  semantic: z.object({
    elements: z.array(drawingSemanticElementSchema).max(MAX_DRAWING_GENERATION_CONTEXT_ELEMENTS)
      .refine((elements) => new Set(elements.map((element) => element.id)).size === elements.length, "semantic elements must not contain duplicate IDs"),
    viewportCenter: z.object({
      x: drawingGenerationCoordinateSchema,
      y: drawingGenerationCoordinateSchema,
    }).strict(),
  }).strict(),
}).strict();

/** Generation is deliberately constrained to the implemented HTML variant. */
export const generatedArtifactSchema = htmlArtifactSchema;

export type GenerationRunStatus = z.infer<typeof generationRunStatusSchema>;
export type GenerationPurpose = z.infer<typeof generationPurposeSchema>;
export type SelectionBounds = z.infer<typeof selectionBoundsSchema>;
export type SemanticSelectionElement = z.infer<typeof semanticSelectionElementSchema>;
export type SelectionContext = z.infer<typeof selectionContextSchema>;
export type InterfaceGenerationRequest = z.infer<typeof interfaceGenerationRequestSchema>;
export type DrawingSemanticElement = z.infer<typeof drawingSemanticElementSchema>;
export type DrawingGenerationRequest = z.infer<typeof drawingGenerationRequestSchema>;
export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>;
