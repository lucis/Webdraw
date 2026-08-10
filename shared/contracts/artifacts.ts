import { z } from "zod";

export const htmlArtifactSchema = z.object({
  kind: z.literal("html"),
  title: z.string(),
  sourceHtml: z.string(),
});

/**
 * Reserved for a future implementation. React artifacts are neither generated
 * nor previewed by the HTML artifact workflow.
 */
export const reactArtifactSchema = z.object({
  kind: z.literal("react"),
  files: z.record(z.string()),
  entrypoint: z.string(),
});

export const artifactSchema = z.discriminatedUnion("kind", [
  htmlArtifactSchema,
  reactArtifactSchema,
]);

export const artifactKindSchema = z.enum(["html", "react"]);

export const artifactVersionMetadataSchema = z.object({
  prompt: z.string().nullable(),
  model: z.string().nullable(),
  sourceSnapshot: z.unknown().nullable(),
});

export const artifactRecordSchema = z.object({
  id: z.string(),
  drawingId: z.string(),
  kind: artifactKindSchema,
  activeVersion: z.number().int().positive(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const artifactVersionSchema = z.object({
  artifactId: z.string(),
  version: z.number().int().positive(),
  artifact: artifactSchema,
  metadata: artifactVersionMetadataSchema,
  createdAt: z.number().int(),
});

export type HtmlArtifact = z.infer<typeof htmlArtifactSchema>;
export type ReactArtifact = z.infer<typeof reactArtifactSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type ArtifactKind = z.infer<typeof artifactKindSchema>;
export type ArtifactVersionMetadata = z.infer<typeof artifactVersionMetadataSchema>;
export type ArtifactRecord = z.infer<typeof artifactRecordSchema>;
export type ArtifactVersion = z.infer<typeof artifactVersionSchema>;
