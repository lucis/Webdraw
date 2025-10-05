/**
 * Tools para gerenciamento de desenhos (drawings).
 * 
 * Desenhos são os arquivos do Excalidraw salvos no DECONFIG.
 * Cada desenho pertence a um folder e contém:
 * - elements: elementos do canvas (shapes, text, etc)
 * - appState: estado da aplicação (zoom, grid, etc)
 * - files: arquivos binários (imagens embarcadas)
 */

import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../deco.gen.ts";

/**
 * Constantes de configuração
 */
const STORAGE_CONSTANTS = {
  PATH_PREFIX: "webdraw/",
  DRAWINGS_DIR: "drawings/",
  FOLDERS_DIR: "folders/",
  DATA_SUFFIX: ".json",
  META_SUFFIX: ".meta.json",
} as const;

/**
 * Tipos internos para as tools
 */
interface Drawing {
  id: string;
  name: string;
  description?: string;
  branch: string;
  folderId: string | null;
  elements: any[];
  appState: Record<string, any>;
  files: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  version: number;
  archived?: boolean;
}

interface DrawingMetadata {
  id: string;
  name: string;
  description?: string;
  branch: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
  version: number;
  archived?: boolean;
  elementCount: number;
}

interface Folder {
  id: string;
  name: string;
  emoji: string;
  branch: string;
  drawingIds: string[];
  createdAt: number;
  updatedAt: number;
  order: number;
  isDefault: boolean;
}

/**
 * Helper: constrói path para arquivo no DECONFIG
 */
const getPath = (...segments: string[]): string => {
  return [STORAGE_CONSTANTS.PATH_PREFIX, ...segments].join("");
};

/**
 * Helper: path do arquivo de dados de um desenho
 */
const getDrawingDataPath = (drawingId: string): string => {
  return getPath(STORAGE_CONSTANTS.DRAWINGS_DIR, `${drawingId}${STORAGE_CONSTANTS.DATA_SUFFIX}`);
};

/**
 * Helper: path do arquivo de metadados de um desenho
 */
const getDrawingMetaPath = (drawingId: string): string => {
  return getPath(STORAGE_CONSTANTS.DRAWINGS_DIR, `${drawingId}${STORAGE_CONSTANTS.META_SUFFIX}`);
};

/**
 * Helper: path de um folder
 */
const getFolderPath = (folderId: string): string => {
  return getPath(STORAGE_CONSTANTS.FOLDERS_DIR, `${folderId}.json`);
};

/**
 * Helper: carrega um folder
 */
const loadFolder = async (env: Env, branch: string, folderId: string): Promise<Folder | null> => {
  try {
    const result = await env.DECONFIG.READ_FILE({
      branch,
      path: getFolderPath(folderId),
      format: "plainString",
    });
    return JSON.parse(result.content as string);
  } catch {
    return null;
  }
};

/**
 * Helper: salva um folder
 */
const saveFolder = async (env: Env, folder: Folder): Promise<void> => {
  await env.DECONFIG.PUT_FILE({
    branch: folder.branch,
    path: getFolderPath(folder.id),
    content: JSON.stringify(folder, null, 2),
    metadata: {
      app: "webdraw",
      type: "folder",
      version: "1.0",
      folderId: folder.id,
    },
  });
};

/**
 * Helper: adiciona desenho ao folder
 */
const addDrawingToFolder = async (
  env: Env,
  branch: string,
  folderId: string,
  drawingId: string
): Promise<void> => {
  const folder = await loadFolder(env, branch, folderId);
  if (!folder) {
    throw new Error(`Folder não encontrado: ${folderId}`);
  }

  if (!folder.drawingIds.includes(drawingId)) {
    folder.drawingIds.push(drawingId);
    folder.updatedAt = Date.now();
    await saveFolder(env, folder);
  }
};

/**
 * Helper: remove desenho do folder
 */
const removeDrawingFromFolder = async (
  env: Env,
  branch: string,
  folderId: string,
  drawingId: string
): Promise<void> => {
  const folder = await loadFolder(env, branch, folderId);
  if (!folder) return;

  folder.drawingIds = folder.drawingIds.filter((id) => id !== drawingId);
  folder.updatedAt = Date.now();
  await saveFolder(env, folder);
};

/**
 * Tool: CREATE_DRAWING
 * 
 * Cria um novo desenho
 */
export const createCreateDrawingTool = (env: Env) =>
  createTool({
    id: "CREATE_DRAWING",
    description: "Cria um novo desenho no Excalidraw",
    inputSchema: z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      folderId: z.string().nullable().default("default"),
      branch: z.string().default("main"),
      elements: z.array(z.any()).default([]),
      appState: z.record(z.any()).default({}),
      files: z.record(z.any()).default({}),
    }),
    outputSchema: z.object({
      drawing: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        branch: z.string(),
        folderId: z.string().nullable(),
        elements: z.array(z.any()),
        appState: z.record(z.any()),
        files: z.record(z.any()),
        createdAt: z.number(),
        updatedAt: z.number(),
        version: z.number(),
        archived: z.boolean().optional(),
      }),
    }),
    execute: async ({ context }) => {
      const { name, description, folderId, branch, elements, appState, files } = context;

      // Gerar ID único
      const drawingId = `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Criar drawing
      const now = Date.now();
      const drawing: Drawing = {
        id: drawingId,
        name,
        description,
        branch,
        folderId,
        elements,
        appState,
        files,
        createdAt: now,
        updatedAt: now,
        version: 1,
        archived: false,
      };

      // Salvar dados do desenho
      await env.DECONFIG.PUT_FILE({
        branch,
        path: getDrawingDataPath(drawingId),
        content: JSON.stringify({
          elements: drawing.elements,
          appState: drawing.appState,
          files: drawing.files,
        }, null, 2),
        metadata: {
          app: "webdraw",
          type: "drawing-data",
          version: "1.0",
          drawingId,
        },
      });

      // Salvar metadados
      const metadata: DrawingMetadata = {
        id: drawing.id,
        name: drawing.name,
        description: drawing.description,
        branch: drawing.branch,
        folderId: drawing.folderId,
        createdAt: drawing.createdAt,
        updatedAt: drawing.updatedAt,
        version: drawing.version,
        archived: drawing.archived,
        elementCount: drawing.elements.length,
      };

      await env.DECONFIG.PUT_FILE({
        branch,
        path: getDrawingMetaPath(drawingId),
        content: JSON.stringify(metadata, null, 2),
        metadata: {
          app: "webdraw",
          type: "drawing-metadata",
          version: "1.0",
          drawingId,
          folderId: drawing.folderId || null,
        },
      });

      // Adicionar ao folder se especificado
      if (folderId) {
        await addDrawingToFolder(env, branch, folderId, drawingId);
      }

      return { drawing };
    },
  });

/**
 * Tool: GET_DRAWING
 * 
 * Obtém um desenho por ID
 */
export const createGetDrawingTool = (env: Env) =>
  createTool({
    id: "GET_DRAWING",
    description: "Obtém um desenho específico por ID",
    inputSchema: z.object({
      drawingId: z.string(),
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      drawing: z
        .object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
          branch: z.string(),
          folderId: z.string().nullable(),
          elements: z.array(z.any()),
          appState: z.record(z.any()),
          files: z.record(z.any()),
          createdAt: z.number(),
          updatedAt: z.number(),
          version: z.number(),
          archived: z.boolean().optional(),
        })
        .nullable(),
    }),
    execute: async ({ context }) => {
      const { drawingId, branch } = context;

      try {
        // Carregar metadados
        const metaResult = await env.DECONFIG.READ_FILE({
          branch,
          path: getDrawingMetaPath(drawingId),
          format: "plainString",
        });
        const metadata: DrawingMetadata = JSON.parse(metaResult.content as string);

        // Carregar dados
        const dataResult = await env.DECONFIG.READ_FILE({
          branch,
          path: getDrawingDataPath(drawingId),
          format: "plainString",
        });
        const data = JSON.parse(dataResult.content as string);

        const drawing: Drawing = {
          ...metadata,
          elements: data.elements || [],
          appState: data.appState || {},
          files: data.files || {},
        };

        return { drawing };
      } catch {
        return { drawing: null };
      }
    },
  });

/**
 * Tool: LIST_DRAWINGS
 * 
 * Lista desenhos de um folder ou todos
 */
export const createListDrawingsTool = (env: Env) =>
  createTool({
    id: "LIST_DRAWINGS",
    description: "Lista desenhos de um folder específico ou todos os desenhos",
    inputSchema: z.object({
      folderId: z.string().nullable().optional(),
      branch: z.string().default("main"),
      includeArchived: z.boolean().default(false),
    }),
    outputSchema: z.object({
      drawings: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
          branch: z.string(),
          folderId: z.string().nullable(),
          createdAt: z.number(),
          updatedAt: z.number(),
          version: z.number(),
          archived: z.boolean().optional(),
          elementCount: z.number(),
        })
      ),
    }),
    execute: async ({ context }) => {
      const { folderId, branch, includeArchived } = context;

      // Listar todos os arquivos .meta.json
      const files = await env.DECONFIG.LIST_FILES({
        branch,
        path: getPath(STORAGE_CONSTANTS.DRAWINGS_DIR),
      });

      const drawings: DrawingMetadata[] = [];

      for (const file of files.files) {
        if (file.path.endsWith(STORAGE_CONSTANTS.META_SUFFIX)) {
          try {
            const result = await env.DECONFIG.READ_FILE({
              branch,
              path: file.path,
              format: "plainString",
            });
            const metadata: DrawingMetadata = JSON.parse(result.content as string);

            // Filtrar por folder se especificado
            if (folderId !== undefined && metadata.folderId !== folderId) {
              continue;
            }

            // Filtrar arquivados se necessário
            if (!includeArchived && metadata.archived) {
              continue;
            }

            drawings.push(metadata);
          } catch (error) {
            console.error(`Erro ao carregar ${file.path}:`, error);
          }
        }
      }

      // Ordenar por data de atualização (mais recente primeiro)
      drawings.sort((a, b) => b.updatedAt - a.updatedAt);

      return { drawings };
    },
  });

/**
 * Tool: UPDATE_DRAWING
 * 
 * Atualiza um desenho existente
 */
export const createUpdateDrawingTool = (env: Env) =>
  createTool({
    id: "UPDATE_DRAWING",
    description: "Atualiza um desenho existente",
    inputSchema: z.object({
      drawingId: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      elements: z.array(z.any()).optional(),
      appState: z.record(z.any()).optional(),
      files: z.record(z.any()).optional(),
      archived: z.boolean().optional(),
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      drawing: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        branch: z.string(),
        folderId: z.string().nullable(),
        elements: z.array(z.any()),
        appState: z.record(z.any()),
        files: z.record(z.any()),
        createdAt: z.number(),
        updatedAt: z.number(),
        version: z.number(),
        archived: z.boolean().optional(),
      }),
    }),
    execute: async ({ context }) => {
      const { drawingId, name, description, elements, appState, files, archived, branch } =
        context;

      // Carregar desenho existente
      const existing = await env.SELF.GET_DRAWING({ drawingId, branch });

      if (!existing.drawing) {
        throw new Error(`Desenho não encontrado: ${drawingId}`);
      }

      // Atualizar campos
      const updated: Drawing = {
        ...existing.drawing,
        name: name ?? existing.drawing.name,
        description: description !== undefined ? description : existing.drawing.description,
        elements: elements ?? existing.drawing.elements,
        appState: appState ?? existing.drawing.appState,
        files: files ?? existing.drawing.files,
        archived: archived !== undefined ? archived : existing.drawing.archived,
        updatedAt: Date.now(),
        version: existing.drawing.version + 1,
      };

      // Salvar dados atualizados
      await env.DECONFIG.PUT_FILE({
        branch,
        path: getDrawingDataPath(drawingId),
        content: JSON.stringify({
          elements: updated.elements,
          appState: updated.appState,
          files: updated.files,
        }, null, 2),
        metadata: {
          app: "webdraw",
          type: "drawing-data",
          version: "1.0",
          drawingId,
        },
      });

      // Atualizar metadados
      const metadata: DrawingMetadata = {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        branch: updated.branch,
        folderId: updated.folderId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        version: updated.version,
        archived: updated.archived,
        elementCount: updated.elements.length,
      };

      await env.DECONFIG.PUT_FILE({
        branch,
        path: getDrawingMetaPath(drawingId),
        content: JSON.stringify(metadata, null, 2),
        metadata: {
          app: "webdraw",
          type: "drawing-metadata",
          version: "1.0",
          drawingId,
          folderId: updated.folderId || null,
        },
      });

      return { drawing: updated };
    },
  });

/**
 * Tool: DELETE_DRAWING
 * 
 * Deleta um desenho
 */
export const createDeleteDrawingTool = (env: Env) =>
  createTool({
    id: "DELETE_DRAWING",
    description: "Deleta um desenho permanentemente",
    inputSchema: z.object({
      drawingId: z.string(),
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      deletedId: z.string(),
    }),
    execute: async ({ context }) => {
      const { drawingId, branch } = context;

      // Carregar desenho para obter folderId
      const existing = await env.SELF.GET_DRAWING({ drawingId, branch });

      if (!existing.drawing) {
        throw new Error(`Desenho não encontrado: ${drawingId}`);
      }

      // Remover do folder se estiver em um
      if (existing.drawing.folderId) {
        await removeDrawingFromFolder(env, branch, existing.drawing.folderId, drawingId);
      }

      // Deletar arquivos
      await env.DECONFIG.DELETE_FILE({
        branch,
        path: getDrawingDataPath(drawingId),
      });

      await env.DECONFIG.DELETE_FILE({
        branch,
        path: getDrawingMetaPath(drawingId),
      });

      return {
        success: true,
        deletedId: drawingId,
      };
    },
  });

/**
 * Tool: MOVE_DRAWING_TO_FOLDER
 * 
 * Move um desenho para outro folder
 */
export const createMoveDrawingToFolderTool = (env: Env) =>
  createTool({
    id: "MOVE_DRAWING_TO_FOLDER",
    description: "Move um desenho para outro folder",
    inputSchema: z.object({
      drawingId: z.string(),
      targetFolderId: z.string().nullable(),
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      drawing: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        branch: z.string(),
        folderId: z.string().nullable(),
        elements: z.array(z.any()),
        appState: z.record(z.any()),
        files: z.record(z.any()),
        createdAt: z.number(),
        updatedAt: z.number(),
        version: z.number(),
        archived: z.boolean().optional(),
      }),
    }),
    execute: async ({ context }) => {
      const { drawingId, targetFolderId, branch } = context;

      // Carregar desenho
      const existing = await env.SELF.GET_DRAWING({ drawingId, branch });

      if (!existing.drawing) {
        throw new Error(`Desenho não encontrado: ${drawingId}`);
      }

      const oldFolderId = existing.drawing.folderId;

      // Remover do folder antigo
      if (oldFolderId) {
        await removeDrawingFromFolder(env, branch, oldFolderId, drawingId);
      }

      // Adicionar ao novo folder
      if (targetFolderId) {
        await addDrawingToFolder(env, branch, targetFolderId, drawingId);
      }

      // Atualizar metadados do desenho
      const updated = await env.SELF.UPDATE_DRAWING({
        drawingId,
        branch,
      });

      // Atualizar folderId nos metadados
      const metadata: DrawingMetadata = {
        id: drawingId,
        name: updated.drawing.name,
        description: updated.drawing.description,
        branch: updated.drawing.branch,
        folderId: targetFolderId,
        createdAt: updated.drawing.createdAt,
        updatedAt: Date.now(),
        version: updated.drawing.version,
        archived: updated.drawing.archived,
        elementCount: updated.drawing.elements.length,
      };

      await env.DECONFIG.PUT_FILE({
        branch,
        path: getDrawingMetaPath(drawingId),
        content: JSON.stringify(metadata, null, 2),
        metadata: {
          app: "webdraw",
          type: "drawing-metadata",
          version: "1.0",
          drawingId,
          folderId: targetFolderId || null,
        },
      });

      return {
        success: true,
        drawing: {
          ...updated.drawing,
          folderId: targetFolderId,
        },
      };
    },
  });

/**
 * Tool: DUPLICATE_DRAWING
 * 
 * Duplica um desenho existente
 */
export const createDuplicateDrawingTool = (env: Env) =>
  createTool({
    id: "DUPLICATE_DRAWING",
    description: "Duplica um desenho existente",
    inputSchema: z.object({
      drawingId: z.string(),
      newName: z.string().optional(),
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      drawing: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        branch: z.string(),
        folderId: z.string().nullable(),
        elements: z.array(z.any()),
        appState: z.record(z.any()),
        files: z.record(z.any()),
        createdAt: z.number(),
        updatedAt: z.number(),
        version: z.number(),
        archived: z.boolean().optional(),
      }),
    }),
    execute: async ({ context }) => {
      const { drawingId, newName, branch } = context;

      // Carregar desenho original
      const original = await env.SELF.GET_DRAWING({ drawingId, branch });

      if (!original.drawing) {
        throw new Error(`Desenho não encontrado: ${drawingId}`);
      }

      // Criar cópia com novo nome
      const copyName = newName || `${original.drawing.name} (cópia)`;

      const duplicate = await env.SELF.CREATE_DRAWING({
        name: copyName,
        description: original.drawing.description,
        folderId: original.drawing.folderId,
        branch,
        elements: original.drawing.elements,
        appState: original.drawing.appState,
        files: original.drawing.files,
      });

      return { drawing: duplicate.drawing };
    },
  });

/**
 * Exportar todas as tools de drawings
 */
export const drawingTools = [
  createCreateDrawingTool,
  createGetDrawingTool,
  createListDrawingsTool,
  createUpdateDrawingTool,
  createDeleteDrawingTool,
  createMoveDrawingToFolderTool,
  createDuplicateDrawingTool,
];
