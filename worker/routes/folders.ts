import { Hono } from "hono";
import { z } from "zod";
import {
  createFolderRequestSchema,
  createFolderResponseSchema,
  listFoldersResponseSchema,
  updateFolderRequestSchema,
  updateFolderResponseSchema,
} from "../../shared/contracts/folders";
import { createFolder, deleteFolder, listFolders, updateFolder } from "../db/folders";
import type { FolderRow } from "../db/types";
import { AppError } from "../lib/errors";
import type { AppBindings } from "../app";

const folderIdSchema = z.object({ id: z.string().min(1) });

export function createFolderRoutes() {
  const app = new Hono<AppBindings>();

  app.get("/", async (context) => {
    const folders = await listFolders(context.env.DB, context.get("user").id);
    return context.json(listFoldersResponseSchema.parse({ folders: folders.map(toFolder) }));
  });

  app.post("/", async (context) => {
    const input = await parseBody(context.req, createFolderRequestSchema);
    const folder = await createFolder(context.env.DB, context.get("user").id, input);
    return context.json(createFolderResponseSchema.parse({ folder: toFolder(folder) }), 201);
  });

  app.put("/:id", async (context) => {
    const folderId = parseId(context.req.param());
    const input = await parseBody(context.req, updateFolderRequestSchema);
    const folder = await updateFolder(context.env.DB, context.get("user").id, folderId, input);
    return context.json(updateFolderResponseSchema.parse({ folder: toFolder(folder) }));
  });

  app.delete("/:id", async (context) => {
    const folderId = parseId(context.req.param());
    await deleteFolder(context.env.DB, context.get("user").id, folderId);
    return context.body(null, 204);
  });

  return app;
}

function toFolder(folder: FolderRow) {
  return {
    id: folder.id,
    name: folder.name,
    emoji: folder.emoji,
    order: folder.order,
    isDefault: folder.isDefault,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

function parseId(params: unknown): string {
  const parsed = folderIdSchema.safeParse(params);
  if (!parsed.success) throw validationError(parsed.error.flatten());
  return parsed.data.id;
}

async function parseBody<TSchema extends z.ZodTypeAny>(
  request: { json<T = unknown>(): Promise<T> },
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw validationError();
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error.flatten());
  return parsed.data;
}

function validationError(details?: unknown): AppError {
  return new AppError(400, "validation_failed", "Invalid request", details);
}
