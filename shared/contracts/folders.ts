import { z } from "zod";

export const folderSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  order: z.number().int(),
  isDefault: z.boolean(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const listFoldersResponseSchema = z.object({
  folders: z.array(folderSchema),
});

export const createFolderRequestSchema = z.object({
  name: z.string(),
  emoji: z.string(),
});

export const createFolderResponseSchema = z.object({
  folder: folderSchema,
});

export const updateFolderRequestSchema = z.object({
  name: z.string().optional(),
  emoji: z.string().optional(),
  order: z.number().int().optional(),
});

export const updateFolderResponseSchema = z.object({
  folder: folderSchema,
});

export type Folder = z.infer<typeof folderSchema>;
export type CreateFolderRequest = z.infer<typeof createFolderRequestSchema>;
export type CreateFolderResponse = z.infer<typeof createFolderResponseSchema>;
export type UpdateFolderRequest = z.infer<typeof updateFolderRequestSchema>;
export type UpdateFolderResponse = z.infer<typeof updateFolderResponseSchema>;
