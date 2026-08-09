import { Hono } from "hono";
import { z } from "zod";
import {
  createDrawingRequestSchema,
  createDrawingResponseSchema,
  getDrawingResponseSchema,
  listDrawingsQuerySchema,
  listDrawingsResponseSchema,
  MAX_DRAWING_REQUEST_BYTES,
  MAX_DRAWING_SCENE_BYTES,
  updateDrawingRequestSchema,
  updateDrawingResponseSchema,
} from "../../shared/contracts/drawings";
import { createDrawing, deleteDrawing, getDrawing, listDrawings, updateDrawing } from "../db/drawings";
import type { DrawingRow, DrawingScene } from "../db/types";
import { AppError } from "../lib/errors";
import type { AppBindings } from "../app";

const drawingIdSchema = z.object({ id: z.string().min(1) });
const emptyScene: DrawingScene = { elements: [], appState: {}, files: {} };

export function createDrawingRoutes() {
  const app = new Hono<AppBindings>();

  app.get("/", async (context) => {
    const query = listDrawingsQuerySchema.safeParse(context.req.query());
    if (!query.success) throw validationError(query.error.flatten());

    const drawings = await listDrawings(context.env.DB, context.get("user").id, query.data.folderId);
    return context.json(listDrawingsResponseSchema.parse({ drawings: drawings.map(toDrawingSummary) }));
  });

  app.post("/", async (context) => {
    const input = await parseBody(context.req, createDrawingRequestSchema);
    const drawing = await createDrawing(context.env.DB, context.get("user").id, {
      ...input,
      scene: input.scene ?? emptyScene,
    });
    return context.json(createDrawingResponseSchema.parse({ drawing: toDrawing(drawing) }), 201);
  });

  app.get("/:id", async (context) => {
    const drawingId = parseId(context.req.param());
    const drawing = await getDrawing(context.env.DB, context.get("user").id, drawingId);
    if (!drawing) throw new AppError(404, "not_found", "Drawing not found");
    return context.json(getDrawingResponseSchema.parse({ drawing: toDrawing(drawing) }));
  });

  app.put("/:id", async (context) => {
    const drawingId = parseId(context.req.param());
    const input = await parseBody(context.req, updateDrawingRequestSchema);
    const current = await getDrawing(context.env.DB, context.get("user").id, drawingId);
    if (!current) throw new AppError(404, "not_found", "Drawing not found");

    const drawing = await updateDrawing(
      context.env.DB,
      context.get("user").id,
      drawingId,
      {
        expectedVersion: input.expectedVersion,
        name: input.name,
        folderId: input.folderId,
        scene: input.scene ?? current.scene,
      },
    );
    return context.json(updateDrawingResponseSchema.parse({ drawing: toDrawing(drawing) }));
  });

  app.delete("/:id", async (context) => {
    const drawingId = parseId(context.req.param());
    await deleteDrawing(context.env.DB, context.get("user").id, drawingId);
    return context.body(null, 204);
  });

  return app;
}

function toDrawing(drawing: DrawingRow) {
  return {
    id: drawing.id,
    folderId: drawing.folderId,
    name: drawing.name,
    scene: drawing.scene,
    version: drawing.version,
    createdAt: drawing.createdAt,
    updatedAt: drawing.updatedAt,
  };
}

function toDrawingSummary(drawing: ReturnType<typeof toDrawing>) {
  return {
    id: drawing.id,
    folderId: drawing.folderId,
    name: drawing.name,
    version: drawing.version,
    createdAt: drawing.createdAt,
    updatedAt: drawing.updatedAt,
  };
}

function parseId(params: unknown): string {
  const parsed = drawingIdSchema.safeParse(params);
  if (!parsed.success) throw validationError(parsed.error.flatten());
  return parsed.data.id;
}

async function parseBody<TSchema extends z.ZodTypeAny>(
  request: { raw: Request; header(name: string): string | undefined },
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let body: unknown;
  try {
    body = JSON.parse(await readBody(request));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw validationError();
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error.flatten());
  if ("scene" in parsed.data && parsed.data.scene && sceneByteLength(parsed.data.scene) > MAX_DRAWING_SCENE_BYTES) {
    throw payloadTooLarge("Drawing scene", MAX_DRAWING_SCENE_BYTES);
  }
  return parsed.data;
}

async function readBody(request: { raw: Request; header(name: string): string | undefined }): Promise<string> {
  const contentLength = Number(request.header("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_DRAWING_REQUEST_BYTES) {
    throw payloadTooLarge("Drawing request", MAX_DRAWING_REQUEST_BYTES);
  }

  const body = request.raw.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_DRAWING_REQUEST_BYTES) {
      await reader.cancel();
      throw payloadTooLarge("Drawing request", MAX_DRAWING_REQUEST_BYTES);
    }
    chunks.push(value);
  }

  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(data);
}

function sceneByteLength(scene: unknown): number {
  return new TextEncoder().encode(JSON.stringify(scene)).byteLength;
}

function validationError(details?: unknown): AppError {
  return new AppError(400, "validation_failed", "Invalid request", details);
}

function payloadTooLarge(subject: string, maxBytes: number): AppError {
  return new AppError(413, "validation_failed", `${subject} exceeds the ${maxBytes} byte limit`, { maxBytes });
}
