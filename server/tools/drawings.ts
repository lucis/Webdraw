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
import type { Env } from "../main.ts";

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
        elements: elements || [], // Garantir que elements seja sempre um array
        appState: appState || {}, // Garantir que appState seja sempre um objeto
        files: files || {}, // Garantir que files seja sempre um objeto
        createdAt: now,
        updatedAt: now,
        version: 1,
        archived: false,
      };

      // Salvar dados do desenho
      const drawingDataResponse = await env.DECONFIG.PUT_FILE({
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

      console.log("🎨 CREATE_DRAWING - Drawing data file response:", JSON.stringify(drawingDataResponse, null, 2));

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
        elementCount: (drawing.elements || []).length,
      };

      const metadataResponse = await env.DECONFIG.PUT_FILE({
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

      console.log("📋 CREATE_DRAWING - Metadata file response:", JSON.stringify(metadataResponse, null, 2));

      // Adicionar ao folder se especificado
      if (folderId) {
        await addDrawingToFolder(env, branch, folderId, drawingId);
        console.log("📁 CREATE_DRAWING - Added drawing to folder:", folderId);
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
      });

      console.log("📂 LIST_DRAWINGS - Raw files response:", { files });
      const drawings: DrawingMetadata[] = [];

      // files.files é um objeto onde as chaves são os paths
      const filePaths = Object.keys(files.files || {});
      console.log("📂 LIST_DRAWINGS - Total file paths found:", filePaths.length);
      console.log("📂 LIST_DRAWINGS - All file paths:", filePaths);

      const drawingsDir = "/" + getPath(STORAGE_CONSTANTS.DRAWINGS_DIR); // Adicionar barra inicial
      const metaSuffix = STORAGE_CONSTANTS.META_SUFFIX;
      console.log("📂 LIST_DRAWINGS - Looking for files starting with:", drawingsDir);
      console.log("📂 LIST_DRAWINGS - Looking for files ending with:", metaSuffix);

      for (const filePath of filePaths) {
        console.log("📂 LIST_DRAWINGS - Checking file:", filePath);
        
        const startsWithDir = filePath.startsWith(drawingsDir);
        const endsWithMeta = filePath.endsWith(metaSuffix);
        console.log(`📂 LIST_DRAWINGS - ${filePath} -> starts: ${startsWithDir}, ends: ${endsWithMeta}`);
        
        if (startsWithDir && endsWithMeta) {
          console.log("✅ LIST_DRAWINGS - File matches criteria, reading:", filePath);
          try {
            const result = await env.DECONFIG.READ_FILE({
              branch,
              path: filePath,
              format: "plainString",
            });
            console.log("📄 LIST_DRAWINGS - File read successful:", filePath);
            const metadata: DrawingMetadata = JSON.parse(result.content as string);
            console.log("📄 LIST_DRAWINGS - Metadata parsed:", { id: metadata.id, folderId: metadata.folderId, archived: metadata.archived });

            // Filtrar por folder se especificado
            if (folderId !== undefined && metadata.folderId !== folderId) {
              console.log(`🚫 LIST_DRAWINGS - Skipping ${metadata.id}: folderId mismatch (expected: ${folderId}, got: ${metadata.folderId})`);
              continue;
            }

            // Filtrar arquivados se necessário
            if (!includeArchived && metadata.archived) {
              console.log(`🚫 LIST_DRAWINGS - Skipping ${metadata.id}: archived and includeArchived is false`);
              continue;
            }

            console.log("✅ LIST_DRAWINGS - Adding drawing:", metadata.id);
            drawings.push(metadata);
          } catch (error) {
            console.error(`❌ LIST_DRAWINGS - Erro ao carregar ${filePath}:`, error);
          }
        } else {
          console.log("🚫 LIST_DRAWINGS - File does not match criteria:", filePath);
        }
      }

      console.log("📂 LIST_DRAWINGS - Final drawings count:", drawings.length);
      console.log("📂 LIST_DRAWINGS - Final drawings:", drawings.map(d => ({ id: d.id, name: d.name })));

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
      let existingDrawing: Drawing;
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

        existingDrawing = {
          ...metadata,
          elements: data.elements || [],
          appState: data.appState || {},
          files: data.files || {},
        };
      } catch {
        throw new Error(`Desenho não encontrado: ${drawingId}`);
      }

      // Atualizar campos
      const updated: Drawing = {
        ...existingDrawing,
        name: name ?? existingDrawing.name,
        description: description !== undefined ? description : existingDrawing.description,
        elements: elements ?? existingDrawing.elements,
        appState: appState ?? existingDrawing.appState,
        files: files ?? existingDrawing.files,
        archived: archived !== undefined ? archived : existingDrawing.archived,
        updatedAt: Date.now(),
        version: existingDrawing.version + 1,
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
        elementCount: (updated.elements || []).length,
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
      let existingDrawing: Drawing;
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

        existingDrawing = {
          ...metadata,
          elements: data.elements || [],
          appState: data.appState || {},
          files: data.files || {},
        };
      } catch {
        throw new Error(`Desenho não encontrado: ${drawingId}`);
      }

      // Remover do folder se estiver em um
      if (existingDrawing.folderId) {
        await removeDrawingFromFolder(env, branch, existingDrawing.folderId, drawingId);
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
      let existingDrawing: Drawing;
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

        existingDrawing = {
          ...metadata,
          elements: data.elements || [],
          appState: data.appState || {},
          files: data.files || {},
        };
      } catch {
        throw new Error(`Desenho não encontrado: ${drawingId}`);
      }

      const oldFolderId = existingDrawing.folderId;

      // Remover do folder antigo
      if (oldFolderId) {
        await removeDrawingFromFolder(env, branch, oldFolderId, drawingId);
      }

      // Adicionar ao novo folder
      if (targetFolderId) {
        await addDrawingToFolder(env, branch, targetFolderId, drawingId);
      }

      // Atualizar folderId nos metadados
      const updatedMetadata: DrawingMetadata = {
        id: drawingId,
        name: existingDrawing.name,
        description: existingDrawing.description,
        branch: existingDrawing.branch,
        folderId: targetFolderId,
        createdAt: existingDrawing.createdAt,
        updatedAt: Date.now(),
        version: existingDrawing.version,
        archived: existingDrawing.archived,
        elementCount: (existingDrawing.elements || []).length,
      };

      await env.DECONFIG.PUT_FILE({
        branch,
        path: getDrawingMetaPath(drawingId),
        content: JSON.stringify(updatedMetadata, null, 2),
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
          ...existingDrawing,
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
      let originalDrawing: Drawing;
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

        originalDrawing = {
          ...metadata,
          elements: data.elements || [],
          appState: data.appState || {},
          files: data.files || {},
        };
      } catch {
        throw new Error(`Desenho não encontrado: ${drawingId}`);
      }

      // Criar cópia com novo nome
      const copyName = newName || `${originalDrawing.name} (cópia)`;

      // Gerar ID único para a cópia
      const duplicateDrawingId = `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Criar drawing duplicado
      const now = Date.now();
      const duplicateDrawing: Drawing = {
        id: duplicateDrawingId,
        name: copyName,
        description: originalDrawing.description,
        branch,
        folderId: originalDrawing.folderId,
        elements: originalDrawing.elements || [], 
        appState: originalDrawing.appState || {}, 
        files: originalDrawing.files || {}, 
        createdAt: now,
        updatedAt: now,
        version: 1,
        archived: false,
      };

      // Salvar dados do desenho duplicado
      await env.DECONFIG.PUT_FILE({
        branch,
        path: getDrawingDataPath(duplicateDrawingId),
        content: JSON.stringify({
          elements: duplicateDrawing.elements,
          appState: duplicateDrawing.appState,
          files: duplicateDrawing.files,
        }, null, 2),
        metadata: {
          app: "webdraw",
          type: "drawing-data",
          version: "1.0",
          drawingId: duplicateDrawingId,
        },
      });

      // Salvar metadados
      const duplicateMetadata: DrawingMetadata = {
        id: duplicateDrawing.id,
        name: duplicateDrawing.name,
        description: duplicateDrawing.description,
        branch: duplicateDrawing.branch,
        folderId: duplicateDrawing.folderId,
        createdAt: duplicateDrawing.createdAt,
        updatedAt: duplicateDrawing.updatedAt,
        version: duplicateDrawing.version,
        archived: duplicateDrawing.archived,
        elementCount: (duplicateDrawing.elements || []).length,
      };

      await env.DECONFIG.PUT_FILE({
        branch,
        path: getDrawingMetaPath(duplicateDrawingId),
        content: JSON.stringify(duplicateMetadata, null, 2),
        metadata: {
          app: "webdraw",
          type: "drawing-metadata",
          version: "1.0",
          drawingId: duplicateDrawingId,
          folderId: duplicateDrawing.folderId || null,
        },
      });

      // Adicionar ao folder se especificado
      if (duplicateDrawing.folderId) {
        await addDrawingToFolder(env, branch, duplicateDrawing.folderId, duplicateDrawingId);
      }

      return { drawing: duplicateDrawing };
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
