/**
 * Tools para gerenciamento de folders (pastas) de desenhos.
 * 
 * Folders permitem organizar desenhos em categorias customizáveis,
 * cada uma com um nome e emoji personalizável.
 * 
 * Sempre existe um folder "default" que não pode ser deletado.
 */

import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../deco.gen.ts";

/**
 * Constantes de configuração
 */
const STORAGE_CONSTANTS = {
  PATH_PREFIX: "webdraw/",
  FOLDERS_DIR: "folders/",
  INDEX_FILE: "index.json",
  DEFAULT_FOLDER_ID: "default",
} as const;

/**
 * Tipos internos para as tools
 */
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

interface FolderIndex {
  branch: string;
  folderIds: string[];
  lastUpdated: number;
  version: number;
}

/**
 * Helper: constrói path para arquivo no DECONFIG
 */
const getPath = (...segments: string[]): string => {
  return [STORAGE_CONSTANTS.PATH_PREFIX, ...segments].join("");
};

/**
 * Helper: path do índice de folders
 */
const getFoldersIndexPath = (): string => {
  return getPath(STORAGE_CONSTANTS.FOLDERS_DIR, STORAGE_CONSTANTS.INDEX_FILE);
};

/**
 * Helper: path de um folder específico
 */
const getFolderPath = (folderId: string): string => {
  return getPath(STORAGE_CONSTANTS.FOLDERS_DIR, `${folderId}.json`);
};

/**
 * Helper: carrega o índice de folders
 */
const loadFoldersIndex = async (env: Env, branch: string): Promise<FolderIndex> => {
  try {
    const result = await env.DECONFIG.READ_FILE({
      branch,
      path: getFoldersIndexPath(),
      format: "plainString",
    });
    return JSON.parse(result.content as string);
  } catch {
    // Índice não existe, retornar vazio
    return {
      branch,
      folderIds: [],
      lastUpdated: Date.now(),
      version: 1,
    };
  }
};

/**
 * Helper: salva o índice de folders
 */
const saveFoldersIndex = async (env: Env, index: FolderIndex): Promise<void> => {
  await env.DECONFIG.PUT_FILE({
    branch: index.branch,
    path: getFoldersIndexPath(),
    content: JSON.stringify(index, null, 2),
    metadata: {
      app: "webdraw",
      type: "folder-index",
      version: "1.0",
      lastUpdated: Date.now(),
    },
  });
};

/**
 * Helper: carrega um folder do DECONFIG
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
 * Helper: salva um folder no DECONFIG
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
      isDefault: folder.isDefault,
    },
  });
};

/**
 * Tool: ENSURE_DEFAULT_FOLDER
 * 
 * Garante que o folder padrão existe. Se não existir, cria.
 * Este folder nunca pode ser deletado.
 */
export const createEnsureDefaultFolderTool = (env: Env) =>
  createTool({
    id: "ENSURE_DEFAULT_FOLDER",
    description: "Garante que o folder padrão existe na branch especificada",
    inputSchema: z.object({
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      folder: z.object({
        id: z.string(),
        name: z.string(),
        emoji: z.string(),
        branch: z.string(),
        drawingIds: z.array(z.string()),
        createdAt: z.number(),
        updatedAt: z.number(),
        order: z.number(),
        isDefault: z.boolean(),
      }),
      created: z.boolean(),
    }),
    execute: async ({ context }) => {
      const { branch } = context;
      
      // Verificar se folder default já existe
      const existing = await loadFolder(env, branch, STORAGE_CONSTANTS.DEFAULT_FOLDER_ID);
      
      if (existing) {
        return {
          folder: existing,
          created: false,
        };
      }
      
      // Criar folder default
      const now = Date.now();
      const defaultFolder: Folder = {
        id: STORAGE_CONSTANTS.DEFAULT_FOLDER_ID,
        name: "Meus Desenhos",
        emoji: "📁",
        branch,
        drawingIds: [],
        createdAt: now,
        updatedAt: now,
        order: 0,
        isDefault: true,
      };
      
      // Salvar folder
      await saveFolder(env, defaultFolder);
      
      // Atualizar índice
      const index = await loadFoldersIndex(env, branch);
      if (!index.folderIds.includes(defaultFolder.id)) {
        index.folderIds.push(defaultFolder.id);
        index.lastUpdated = now;
        await saveFoldersIndex(env, index);
      }
      
      return {
        folder: defaultFolder,
        created: true,
      };
    },
  });

/**
 * Tool: CREATE_FOLDER
 * 
 * Cria um novo folder customizado
 */
export const createCreateFolderTool = (env: Env) =>
  createTool({
    id: "CREATE_FOLDER",
    description: "Cria um novo folder para organizar desenhos",
    inputSchema: z.object({
      name: z.string().min(1).max(100),
      emoji: z.string().default("📁"),
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      folder: z.object({
        id: z.string(),
        name: z.string(),
        emoji: z.string(),
        branch: z.string(),
        drawingIds: z.array(z.string()),
        createdAt: z.number(),
        updatedAt: z.number(),
        order: z.number(),
        isDefault: z.boolean(),
      }),
    }),
    execute: async ({ context }) => {
      const { name, emoji, branch } = context;
      
      // Gerar ID único
      const folderId = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Carregar índice para determinar ordem
      const index = await loadFoldersIndex(env, branch);
      const order = index.folderIds.length;
      
      // Criar folder
      const now = Date.now();
      const folder: Folder = {
        id: folderId,
        name,
        emoji,
        branch,
        drawingIds: [],
        createdAt: now,
        updatedAt: now,
        order,
        isDefault: false,
      };
      
      // Salvar folder
      await saveFolder(env, folder);
      
      // Atualizar índice
      index.folderIds.push(folderId);
      index.lastUpdated = now;
      await saveFoldersIndex(env, index);
      
      return { folder };
    },
  });

/**
 * Tool: LIST_FOLDERS
 * 
 * Lista todos os folders de uma branch
 */
export const createListFoldersTool = (env: Env) =>
  createTool({
    id: "LIST_FOLDERS",
    description: "Lista todos os folders de uma branch",
    inputSchema: z.object({
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      folders: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          emoji: z.string(),
          branch: z.string(),
          drawingIds: z.array(z.string()),
          createdAt: z.number(),
          updatedAt: z.number(),
          order: z.number(),
          isDefault: z.boolean(),
        })
      ),
    }),
    execute: async ({ context }) => {
      const { branch } = context;
      
      // Garantir que folder default existe
      await env.SELF.ENSURE_DEFAULT_FOLDER({ branch });
      
      // Carregar índice
      const index = await loadFoldersIndex(env, branch);
      
      // Carregar todos os folders
      const folders: Folder[] = [];
      for (const folderId of index.folderIds) {
        const folder = await loadFolder(env, branch, folderId);
        if (folder) {
          folders.push(folder);
        }
      }
      
      // Ordenar por ordem
      folders.sort((a, b) => a.order - b.order);
      
      return { folders };
    },
  });

/**
 * Tool: GET_FOLDER
 * 
 * Obtém um folder específico por ID
 */
export const createGetFolderTool = (env: Env) =>
  createTool({
    id: "GET_FOLDER",
    description: "Obtém um folder específico por ID",
    inputSchema: z.object({
      folderId: z.string(),
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      folder: z
        .object({
          id: z.string(),
          name: z.string(),
          emoji: z.string(),
          branch: z.string(),
          drawingIds: z.array(z.string()),
          createdAt: z.number(),
          updatedAt: z.number(),
          order: z.number(),
          isDefault: z.boolean(),
        })
        .nullable(),
    }),
    execute: async ({ context }) => {
      const { folderId, branch } = context;
      
      const folder = await loadFolder(env, branch, folderId);
      
      return { folder };
    },
  });

/**
 * Tool: UPDATE_FOLDER
 * 
 * Atualiza nome e/ou emoji de um folder
 */
export const createUpdateFolderTool = (env: Env) =>
  createTool({
    id: "UPDATE_FOLDER",
    description: "Atualiza nome e/ou emoji de um folder",
    inputSchema: z.object({
      folderId: z.string(),
      name: z.string().min(1).max(100).optional(),
      emoji: z.string().optional(),
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      folder: z.object({
        id: z.string(),
        name: z.string(),
        emoji: z.string(),
        branch: z.string(),
        drawingIds: z.array(z.string()),
        createdAt: z.number(),
        updatedAt: z.number(),
        order: z.number(),
        isDefault: z.boolean(),
      }),
    }),
    execute: async ({ context }) => {
      const { folderId, name, emoji, branch } = context;
      
      // Carregar folder existente com ctime para conflict detection
      const currentFile = await env.DECONFIG.READ_FILE({
        branch,
        path: getFolderPath(folderId),
        format: "plainString",
      });
      
      const existing: Folder = JSON.parse(currentFile.content as string);
      
      // Atualizar campos
      const updated: Folder = {
        ...existing,
        name: name ?? existing.name,
        emoji: emoji ?? existing.emoji,
        updatedAt: Date.now(),
      };
      
      // Salvar com conflict detection
      const result = await env.DECONFIG.PUT_FILE({
        branch,
        path: getFolderPath(folderId),
        content: JSON.stringify(updated, null, 2),
        expectedCtime: currentFile.ctime,
        metadata: {
          app: "webdraw",
          type: "folder",
          version: "1.0",
          folderId: updated.id,
          isDefault: updated.isDefault,
        },
      });
      
      // Verificar conflito
      if (result.conflict) {
        throw new Error("Folder foi modificado por outro processo. Tente novamente.");
      }
      
      return { folder: updated };
    },
  });

/**
 * Tool: DELETE_FOLDER
 * 
 * Deleta um folder (exceto o default)
 */
export const createDeleteFolderTool = (env: Env) =>
  createTool({
    id: "DELETE_FOLDER",
    description: "Deleta um folder (exceto o default)",
    inputSchema: z.object({
      folderId: z.string(),
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      deletedId: z.string(),
    }),
    execute: async ({ context }) => {
      const { folderId, branch } = context;
      
      // Não permitir deletar folder default
      if (folderId === STORAGE_CONSTANTS.DEFAULT_FOLDER_ID) {
        throw new Error("Não é possível deletar o folder padrão");
      }
      
      // Verificar se existe
      const existing = await loadFolder(env, branch, folderId);
      if (!existing) {
        throw new Error(`Folder não encontrado: ${folderId}`);
      }
      
      // Deletar arquivo
      await env.DECONFIG.DELETE_FILE({
        branch,
        path: getFolderPath(folderId),
      });
      
      // Atualizar índice
      const index = await loadFoldersIndex(env, branch);
      index.folderIds = index.folderIds.filter((id) => id !== folderId);
      index.lastUpdated = Date.now();
      await saveFoldersIndex(env, index);
      
      return {
        success: true,
        deletedId: folderId,
      };
    },
  });

/**
 * Tool: REORDER_FOLDERS
 * 
 * Reordena folders
 */
export const createReorderFoldersTool = (env: Env) =>
  createTool({
    id: "REORDER_FOLDERS",
    description: "Reordena folders mudando a ordem de exibição",
    inputSchema: z.object({
      folderIds: z.array(z.string()),
      branch: z.string().default("main"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      folders: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          emoji: z.string(),
          branch: z.string(),
          drawingIds: z.array(z.string()),
          createdAt: z.number(),
          updatedAt: z.number(),
          order: z.number(),
          isDefault: z.boolean(),
        })
      ),
    }),
    execute: async ({ context }) => {
      const { folderIds, branch } = context;
      
      // Atualizar ordem de cada folder
      const folders: Folder[] = [];
      for (let i = 0; i < folderIds.length; i++) {
        const folder = await loadFolder(env, branch, folderIds[i]);
        if (folder) {
          folder.order = i;
          folder.updatedAt = Date.now();
          await saveFolder(env, folder);
          folders.push(folder);
        }
      }
      
      // Atualizar índice
      const index = await loadFoldersIndex(env, branch);
      index.folderIds = folderIds;
      index.lastUpdated = Date.now();
      await saveFoldersIndex(env, index);
      
      return {
        success: true,
        folders,
      };
    },
  });

/**
 * Exportar todas as tools de folders
 */
export const folderTools = [
  createEnsureDefaultFolderTool,
  createCreateFolderTool,
  createListFoldersTool,
  createGetFolderTool,
  createUpdateFolderTool,
  createDeleteFolderTool,
  createReorderFoldersTool,
];
