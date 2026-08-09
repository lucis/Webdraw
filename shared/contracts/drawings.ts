import { z } from "zod";

/**
 * D1 limits a row value to 2,000,000 bytes. Scenes are capped well below
 * that threshold so serialized Excalidraw files cannot cause a late D1 error.
 */
export const MAX_DRAWING_SCENE_BYTES = 1_000_000;
export const MAX_DRAWING_REQUEST_BYTES = 1_100_000;

export const drawingSceneSchema = z.object({
  elements: z.array(z.unknown()),
  appState: z.record(z.unknown()),
  files: z.record(z.unknown()),
});

export const drawingSchema = z.object({
  id: z.string(),
  folderId: z.string(),
  name: z.string(),
  scene: drawingSceneSchema,
  version: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const drawingSummarySchema = drawingSchema.omit({ scene: true });

export const listDrawingsQuerySchema = z.object({
  folderId: z.string(),
});

export const listDrawingsResponseSchema = z.object({
  drawings: z.array(drawingSummarySchema),
});

export const getDrawingResponseSchema = z.object({
  drawing: drawingSchema,
});

export const createDrawingRequestSchema = z.object({
  folderId: z.string(),
  name: z.string(),
  scene: drawingSceneSchema.optional(),
});

export const createDrawingResponseSchema = z.object({
  drawing: drawingSchema,
});

export const updateDrawingRequestSchema = z.object({
  expectedVersion: z.number().int(),
  name: z.string().optional(),
  folderId: z.string().optional(),
  scene: drawingSceneSchema.optional(),
});

export const updateDrawingResponseSchema = z.object({
  drawing: drawingSchema,
});

export type DrawingScene = z.infer<typeof drawingSceneSchema>;
export type Drawing = z.infer<typeof drawingSchema>;
export type DrawingSummary = z.infer<typeof drawingSummarySchema>;
export type CreateDrawingRequest = z.infer<typeof createDrawingRequestSchema>;
export type CreateDrawingResponse = z.infer<typeof createDrawingResponseSchema>;
export type UpdateDrawingRequest = z.infer<typeof updateDrawingRequestSchema>;
export type UpdateDrawingResponse = z.infer<typeof updateDrawingResponseSchema>;
