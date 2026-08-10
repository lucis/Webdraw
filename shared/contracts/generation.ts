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
]);

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
}).superRefine((value, context) => {
  if (value.mode !== "revise") return;

  for (const key of ["artifactId", "expectedActiveVersion", "currentSourceHtml"] as const) {
    if (value[key] === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required for revisions`,
      });
    }
  }
});

/** Generation is deliberately constrained to the implemented HTML variant. */
export const generatedArtifactSchema = htmlArtifactSchema;

export type GenerationRunStatus = z.infer<typeof generationRunStatusSchema>;
export type GenerationPurpose = z.infer<typeof generationPurposeSchema>;
export type SelectionBounds = z.infer<typeof selectionBoundsSchema>;
export type SemanticSelectionElement = z.infer<typeof semanticSelectionElementSchema>;
export type SelectionContext = z.infer<typeof selectionContextSchema>;
export type InterfaceGenerationRequest = z.infer<typeof interfaceGenerationRequestSchema>;
export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>;
