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

/** Generation is deliberately constrained to the implemented HTML variant. */
export const generatedArtifactSchema = htmlArtifactSchema;

export type GenerationRunStatus = z.infer<typeof generationRunStatusSchema>;
export type GenerationPurpose = z.infer<typeof generationPurposeSchema>;
export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>;
