# Plano de Persistência: Webdraw com DECONFIG

## 🎯 Visão Geral

Sistema de persistência para o Webdraw usando DECONFIG como backend de storage, com integração via Zustand para gerenciamento de estado no frontend. O DECONFIG fornece um sistema de branches similar ao Git, permitindo versionamento e organização de desenhos.

## 🚀 Quick Start - Por Onde Começar

**IMPORTANTE:** Este projeto segue uma abordagem **API-First**. Começamos criando as **tools no servidor**, testamos via MCP no Cursor, e só depois criamos o frontend.

### Ordem de Implementação

```
1. Server Tools (Folders)     ← COMEÇAR AQUI
   ↓
2. Server Tools (Drawings)
   ↓
3. Testar via MCP no Cursor
   ↓
4. Frontend (Storage Layer)
   ↓
5. Frontend (Zustand Store)
   ↓
6. Frontend (UI Components)
```

### Primeira Tarefa (Agora)

Criar `server/tools/folders.ts` com as seguintes tools:
- `CREATE_FOLDER` - Criar folder
- `LIST_FOLDERS` - Listar folders
- `UPDATE_FOLDER` - Atualizar nome/emoji
- `DELETE_FOLDER` - Deletar folder
- `ENSURE_DEFAULT_FOLDER` - Garantir folder padrão

Depois de criar as tools, vamos:
1. Adicionar ao `server/tools/index.ts`
2. Registrar no `server/main.ts`
3. Rodar `npm run dev`
4. Rodar `DECO_SELF_URL=<dev-url> npm run gen:self`
5. **Testar cada tool no Cursor via MCP**

Só após validar que as tools funcionam, partimos para o frontend.

---

## 🛠️ FASE 1: Implementação das Tools de Folders

### Passo 1: Criar server/tools/folders.ts

Esta é a **primeira coisa a implementar**. Estas tools gerenciam folders (pastas) para organização de desenhos.

```typescript
// server/tools/folders.ts

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
    });
    return JSON.parse(result.content);
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
    contentType: "application/json",
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
    });
    return JSON.parse(result.content);
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
    contentType: "application/json",
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
      
      // Carregar folder existente
      const existing = await loadFolder(env, branch, folderId);
      
      if (!existing) {
        throw new Error(`Folder não encontrado: ${folderId}`);
      }
      
      // Atualizar campos
      const updated: Folder = {
        ...existing,
        name: name ?? existing.name,
        emoji: emoji ?? existing.emoji,
        updatedAt: Date.now(),
      };
      
      // Salvar
      await saveFolder(env, updated);
      
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
```

### Passo 2: Atualizar server/tools/index.ts

```typescript
// server/tools/index.ts

import { todoTools } from "./todos.ts";
import { userTools } from "./user.ts";
import { folderTools } from "./folders.ts";

export const tools = [
  ...todoTools,
  ...userTools,
  ...folderTools,
];

// Re-export para acesso direto
export { todoTools } from "./todos.ts";
export { userTools } from "./user.ts";
export { folderTools } from "./folders.ts";
```

### Passo 3: Atualizar server/main.ts

O arquivo `server/main.ts` já deve estar importando de `tools/index.ts`, então não precisa mudar nada se já estiver assim:

```typescript
import { tools } from "./tools/index.ts";

const { Workflow, ...runtime } = withRuntime<Env>({
  workflows: [],
  tools,
  fetch: fallbackToView("/"),
});
```

### Passo 4: Testar as Tools

Depois de criar as tools:

1. **Iniciar servidor:**
   ```bash
   npm run dev
   ```

2. **Copiar URL do dev** (aparece nos logs, algo como `https://localhost-xxxxx.deco.host/mcp`)

3. **Gerar types:**
   ```bash
   DECO_SELF_URL=https://localhost-xxxxx.deco.host/mcp npm run gen:self
   ```

4. **Testar no Cursor** (via MCP):
   
   ```
   @webdraw ENSURE_DEFAULT_FOLDER com branch "main"
   
   @webdraw CREATE_FOLDER com name "Projetos" emoji "🚀" branch "main"
   
   @webdraw LIST_FOLDERS branch "main"
   
   @webdraw UPDATE_FOLDER folderId "folder_xxx" name "Meus Projetos"
   
   @webdraw GET_FOLDER folderId "default"
   ```

5. **Validar resultados:**
   - Folder default foi criado automaticamente
   - Novos folders são criados com ID único
   - Lista retorna folders ordenados
   - Update funciona corretamente
   - Não é possível deletar folder default

---

## 📋 Arquitetura de Storage

### Estrutura de Diretórios no DECONFIG

```
webdraw/
├── main/                          # Branch principal (padrão)
│   ├── folders/
│   │   ├── default.json          # Folder padrão (sempre existe)
│   │   ├── {folder-id}.json      # Outros folders
│   │   └── index.json            # Índice de todos os folders
│   ├── drawings/
│   │   ├── {drawing-id}.json     # Dados do desenho
│   │   └── {drawing-id}.meta.json # Metadados do desenho
│   ├── assets/
│   │   └── {file-id}.{ext}       # Imagens e arquivos binários
│   └── index.json                 # Índice global (desenhos sem folder)
└── {custom-branch}/               # Branches customizadas (futuro: workspaces)
    └── ... (mesma estrutura)
```

### Convenções de Nomenclatura

- **Drawing ID**: `drawing_{timestamp}_{random}` (ex: `drawing_1704123456789_a3f9k2`)
- **Folder ID**: `folder_{timestamp}_{random}` (ex: `folder_1704123456789_x8k3m1`)
- **Folder padrão**: `default` (sempre criado automaticamente)
- **Branch padrão**: `main`
- **Path prefix**: `webdraw/`
- **Extensões**: `.json` para dados, `.meta.json` para metadados

## 🏗️ Sistema de Tipos Unificado

```typescript
// view/src/types/drawing.ts

import type {
  ExcalidrawElement,
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types/types";

/**
 * ============================================================================
 * CORE DRAWING TYPES
 * ============================================================================
 */

/**
 * ID único de um desenho
 */
export type DrawingId = string;

/**
 * Nome de uma branch do DECONFIG
 */
export type BranchName = string;

/**
 * Estrutura completa de um desenho
 */
export interface Drawing {
  /** ID único do desenho */
  id: DrawingId;
  
  /** Nome do desenho */
  name: string;
  
  /** Descrição opcional */
  description?: string;
  
  /** Branch onde está salvo */
  branch: BranchName;
  
  /** ID do folder onde está (null = sem folder) */
  folderId?: FolderId | null;
  
  /** Elementos do Excalidraw */
  elements: readonly ExcalidrawElement[];
  
  /** Estado da aplicação Excalidraw */
  appState: Partial<AppState>;
  
  /** Arquivos binários (imagens, etc) */
  files: BinaryFiles;
  
  /** Timestamp de criação */
  createdAt: number;
  
  /** Timestamp de última modificação */
  updatedAt: number;
  
  /** Versão do desenho (para versionamento) */
  version: number;
  
  /** Tags para organização */
  tags?: string[];
  
  /** Se o desenho está arquivado */
  archived?: boolean;
}

/**
 * Metadados de um desenho (para listagem rápida)
 */
export interface DrawingMetadata {
  id: DrawingId;
  name: string;
  description?: string;
  branch: BranchName;
  folderId?: FolderId | null;
  createdAt: number;
  updatedAt: number;
  version: number;
  tags?: string[];
  archived?: boolean;
  /** Thumbnail em base64 (opcional) */
  thumbnail?: string;
  /** Contagem de elementos */
  elementCount?: number;
}

/**
 * Índice de todos os desenhos em uma branch
 */
export interface DrawingIndex {
  /** Branch onde está o índice */
  branch: BranchName;
  
  /** Lista de metadados de desenhos */
  drawings: DrawingMetadata[];
  
  /** Timestamp da última atualização do índice */
  lastUpdated: number;
  
  /** Versão do formato do índice */
  version: number;
}

/**
 * ============================================================================
 * FOLDER TYPES
 * ============================================================================
 */

/**
 * ID único de um folder
 */
export type FolderId = string;

/**
 * Folder para organização de desenhos
 */
export interface Folder {
  /** ID único do folder */
  id: FolderId;
  
  /** Nome do folder */
  name: string;
  
  /** Emoji do folder */
  emoji: string;
  
  /** Branch onde está salvo */
  branch: BranchName;
  
  /** IDs dos desenhos neste folder */
  drawingIds: DrawingId[];
  
  /** Timestamp de criação */
  createdAt: number;
  
  /** Timestamp de última modificação */
  updatedAt: number;
  
  /** Ordem de exibição (menor = primeiro) */
  order: number;
  
  /** Se é o folder padrão (não pode ser deletado) */
  isDefault: boolean;
}

/**
 * Metadados de um folder (para listagem rápida)
 */
export interface FolderMetadata {
  id: FolderId;
  name: string;
  emoji: string;
  branch: BranchName;
  drawingCount: number;
  createdAt: number;
  updatedAt: number;
  order: number;
  isDefault: boolean;
}

/**
 * Índice de todos os folders em uma branch
 */
export interface FolderIndex {
  /** Branch onde está o índice */
  branch: BranchName;
  
  /** Lista de metadados de folders */
  folders: FolderMetadata[];
  
  /** Timestamp da última atualização do índice */
  lastUpdated: number;
  
  /** Versão do formato do índice */
  version: number;
}

/**
 * ============================================================================
 * DECONFIG STORAGE TYPES
 * ============================================================================
 */

/**
 * Configuração de persistência
 */
export interface StorageConfig {
  /** Branch atual */
  currentBranch: BranchName;
  
  /** Delay de auto-save em ms */
  autoSaveDelay: number;
  
  /** Se auto-save está habilitado */
  autoSaveEnabled: boolean;
  
  /** Path prefix no DECONFIG */
  pathPrefix: string;
}

/**
 * Estado de sincronização
 */
export type SyncStatus = 
  | "idle"        // Nada acontecendo
  | "saving"      // Salvando no DECONFIG
  | "loading"     // Carregando do DECONFIG
  | "error"       // Erro na sincronização
  | "conflict";   // Conflito detectado

/**
 * Informação de sincronização
 */
export interface SyncInfo {
  status: SyncStatus;
  lastSyncAt?: number;
  error?: string;
  pendingChanges: boolean;
}

/**
 * ============================================================================
 * BRANCH MANAGEMENT TYPES
 * ============================================================================
 */

/**
 * Informações de uma branch
 */
export interface BranchInfo {
  name: BranchName;
  drawingCount: number;
  createdAt?: number;
  lastModified?: number;
}

/**
 * ============================================================================
 * API TYPES
 * ============================================================================
 */

/**
 * Interface do storage DECONFIG
 */
export interface DrawingStorage {
  // ==================== DRAWING OPERATIONS ====================
  
  /**
   * Cria um novo desenho
   */
  createDrawing(
    name: string,
    branch?: BranchName,
    initialData?: Partial<Drawing>
  ): Promise<Drawing>;
  
  /**
   * Obtém um desenho por ID
   */
  getDrawing(id: DrawingId, branch?: BranchName): Promise<Drawing | null>;
  
  /**
   * Lista todos os desenhos de uma branch
   */
  listDrawings(branch?: BranchName): Promise<DrawingMetadata[]>;
  
  /**
   * Atualiza um desenho existente
   */
  updateDrawing(
    id: DrawingId,
    data: Partial<Drawing>,
    branch?: BranchName
  ): Promise<Drawing>;
  
  /**
   * Deleta um desenho
   */
  deleteDrawing(id: DrawingId, branch?: BranchName): Promise<void>;
  
  /**
   * Salva o estado atual do canvas
   */
  saveCurrentDrawing(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles
  ): Promise<void>;
  
  // ==================== BRANCH OPERATIONS ====================
  
  /**
   * Lista todas as branches disponíveis
   */
  listBranches(): Promise<BranchInfo[]>;
  
  /**
   * Cria uma nova branch
   */
  createBranch(name: BranchName, sourceBranch?: BranchName): Promise<void>;
  
  /**
   * Deleta uma branch
   */
  deleteBranch(name: BranchName): Promise<void>;
  
  /**
   * Troca para outra branch
   */
  switchBranch(name: BranchName): Promise<void>;
  
  /**
   * Obtém a branch atual
   */
  getCurrentBranch(): BranchName;
  
  // ==================== CURRENT DRAWING STATE ====================
  
  /**
   * Define o desenho atual
   */
  setCurrentDrawingId(id: DrawingId | null): Promise<void>;
  
  /**
   * Obtém o ID do desenho atual
   */
  getCurrentDrawingId(): string | null;
  
  /**
   * Obtém o desenho atual completo
   */
  getCurrentDrawing(): Promise<Drawing | null>;
  
  // ==================== SYNC & CONFIG ====================
  
  /**
   * Obtém informações de sincronização
   */
  getSyncInfo(): SyncInfo;
  
  /**
   * Força sincronização imediata
   */
  forceSave(): Promise<void>;
  
  /**
   * Recarrega desenho do servidor (descarta mudanças locais)
   */
  reloadDrawing(id: DrawingId, branch?: BranchName): Promise<Drawing>;
}

/**
 * ============================================================================
 * ZUSTAND STORE TYPES
 * ============================================================================
 */

/**
 * Estado global do Zustand para desenhos
 */
export interface DrawingStore {
  // ==================== STATE ====================
  
  /** Configuração de storage */
  config: StorageConfig;
  
  /** Desenho atual carregado no canvas */
  currentDrawing: Drawing | null;
  
  /** Lista de desenhos disponíveis na branch atual */
  drawings: DrawingMetadata[];
  
  /** Branches disponíveis */
  branches: BranchInfo[];
  
  /** Estado de sincronização */
  syncInfo: SyncInfo;
  
  /** Se está carregando dados */
  isLoading: boolean;
  
  // ==================== ACTIONS ====================
  
  /** Inicializa o store */
  initialize: () => Promise<void>;
  
  /** Cria novo desenho */
  createDrawing: (name: string, description?: string) => Promise<DrawingId>;
  
  /** Carrega um desenho no canvas */
  loadDrawing: (id: DrawingId) => Promise<void>;
  
  /** Salva alterações do canvas */
  saveDrawing: (
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles
  ) => Promise<void>;
  
  /** Deleta um desenho */
  deleteDrawing: (id: DrawingId) => Promise<void>;
  
  /** Renomeia um desenho */
  renameDrawing: (id: DrawingId, newName: string) => Promise<void>;
  
  /** Atualiza metadados do desenho */
  updateMetadata: (id: DrawingId, metadata: Partial<DrawingMetadata>) => Promise<void>;
  
  /** Recarrega lista de desenhos */
  refreshDrawings: () => Promise<void>;
  
  /** Troca de branch */
  switchBranch: (branchName: BranchName) => Promise<void>;
  
  /** Cria nova branch */
  createBranch: (name: BranchName, sourceBranch?: BranchName) => Promise<void>;
  
  /** Deleta uma branch */
  deleteBranch: (name: BranchName) => Promise<void>;
  
  /** Força salvamento imediato */
  forceSave: () => Promise<void>;
  
  /** Atualiza configuração */
  updateConfig: (config: Partial<StorageConfig>) => void;
}

/**
 * ============================================================================
 * UTILITY TYPES
 * ============================================================================
 */

/**
 * Resultado de operação assíncrona
 */
export type AsyncResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Opções de exportação
 */
export interface ExportOptions {
  format: "png" | "svg" | "json";
  scale?: number;
  background?: boolean;
}
```

## 🔌 Implementação do Storage DECONFIG

```typescript
// view/src/lib/storage-deconfig.ts

import { client } from "./rpc";
import type {
  Drawing,
  DrawingId,
  DrawingMetadata,
  DrawingStorage,
  BranchName,
  BranchInfo,
  SyncStatus,
  SyncInfo,
  DrawingIndex,
  StorageConfig,
} from "../types/drawing";
import type {
  ExcalidrawElement,
  AppState,
  BinaryFiles,
} from "@excalidraw/excalidraw/types/types";

/**
 * Constantes de configuração
 */
const STORAGE_CONSTANTS = {
  PATH_PREFIX: "webdraw/",
  DEFAULT_BRANCH: "main",
  DRAWINGS_DIR: "drawings/",
  ASSETS_DIR: "assets/",
  INDEX_FILE: "index.json",
  META_SUFFIX: ".meta.json",
  DATA_SUFFIX: ".json",
} as const;

/**
 * Implementação do storage usando DECONFIG
 */
class DeconfigDrawingStorage implements DrawingStorage {
  private currentBranch: BranchName = STORAGE_CONSTANTS.DEFAULT_BRANCH;
  private currentDrawingId: DrawingId | null = null;
  private syncInfo: SyncInfo = {
    status: "idle",
    pendingChanges: false,
  };
  
  // ==================== HELPERS ====================
  
  /**
   * Gera ID único para desenho
   */
  private generateId(): DrawingId {
    return `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Constrói path completo para arquivo no DECONFIG
   */
  private getPath(...segments: string[]): string {
    return [STORAGE_CONSTANTS.PATH_PREFIX, ...segments].join("");
  }
  
  /**
   * Path do arquivo de dados de um desenho
   */
  private getDrawingDataPath(id: DrawingId): string {
    return this.getPath(
      STORAGE_CONSTANTS.DRAWINGS_DIR,
      `${id}${STORAGE_CONSTANTS.DATA_SUFFIX}`
    );
  }
  
  /**
   * Path do arquivo de metadados de um desenho
   */
  private getDrawingMetaPath(id: DrawingId): string {
    return this.getPath(
      STORAGE_CONSTANTS.DRAWINGS_DIR,
      `${id}${STORAGE_CONSTANTS.META_SUFFIX}`
    );
  }
  
  /**
   * Path do índice de desenhos
   */
  private getIndexPath(): string {
    return this.getPath(STORAGE_CONSTANTS.INDEX_FILE);
  }
  
  /**
   * Atualiza status de sincronização
   */
  private updateSyncStatus(status: SyncStatus, error?: string): void {
    this.syncInfo = {
      ...this.syncInfo,
      status,
      error,
      lastSyncAt: status === "idle" ? Date.now() : this.syncInfo.lastSyncAt,
    };
  }
  
  /**
   * Carrega o índice de desenhos
   */
  private async loadIndex(branch: BranchName): Promise<DrawingIndex> {
    try {
      const result = await client.DECONFIG.READ_FILE({
        branch,
        path: this.getIndexPath(),
      });
      
      return JSON.parse(result.content);
    } catch (error) {
      // Índice não existe, retornar vazio
      return {
        branch,
        drawings: [],
        lastUpdated: Date.now(),
        version: 1,
      };
    }
  }
  
  /**
   * Salva o índice de desenhos
   */
  private async saveIndex(index: DrawingIndex): Promise<void> {
    await client.DECONFIG.PUT_FILE({
      branch: index.branch,
      path: this.getIndexPath(),
      content: JSON.stringify(index, null, 2),
      contentType: "application/json",
    });
  }
  
  /**
   * Adiciona ou atualiza desenho no índice
   */
  private async updateIndexEntry(
    branch: BranchName,
    metadata: DrawingMetadata
  ): Promise<void> {
    const index = await this.loadIndex(branch);
    
    const existingIndex = index.drawings.findIndex((d) => d.id === metadata.id);
    if (existingIndex >= 0) {
      index.drawings[existingIndex] = metadata;
    } else {
      index.drawings.push(metadata);
    }
    
    index.lastUpdated = Date.now();
    await this.saveIndex(index);
  }
  
  /**
   * Remove desenho do índice
   */
  private async removeIndexEntry(
    branch: BranchName,
    id: DrawingId
  ): Promise<void> {
    const index = await this.loadIndex(branch);
    index.drawings = index.drawings.filter((d) => d.id !== id);
    index.lastUpdated = Date.now();
    await this.saveIndex(index);
  }
  
  // ==================== DRAWING OPERATIONS ====================
  
  async createDrawing(
    name: string,
    branch?: BranchName,
    initialData?: Partial<Drawing>
  ): Promise<Drawing> {
    this.updateSyncStatus("saving");
    
    try {
      const targetBranch = branch || this.currentBranch;
      const now = Date.now();
      
      const drawing: Drawing = {
        id: this.generateId(),
        name,
        branch: targetBranch,
        elements: initialData?.elements || [],
        appState: initialData?.appState || {},
        files: initialData?.files || {},
        createdAt: now,
        updatedAt: now,
        version: 1,
        description: initialData?.description,
        tags: initialData?.tags || [],
        archived: false,
      };
      
      // Salvar dados do desenho
      await client.DECONFIG.PUT_FILE({
        branch: targetBranch,
        path: this.getDrawingDataPath(drawing.id),
        content: JSON.stringify({
          elements: drawing.elements,
          appState: drawing.appState,
          files: drawing.files,
        }, null, 2),
        contentType: "application/json",
      });
      
      // Salvar metadados
      const metadata: DrawingMetadata = {
        id: drawing.id,
        name: drawing.name,
        description: drawing.description,
        branch: drawing.branch,
        createdAt: drawing.createdAt,
        updatedAt: drawing.updatedAt,
        version: drawing.version,
        tags: drawing.tags,
        archived: drawing.archived,
        elementCount: drawing.elements.length,
      };
      
      await client.DECONFIG.PUT_FILE({
        branch: targetBranch,
        path: this.getDrawingMetaPath(drawing.id),
        content: JSON.stringify(metadata, null, 2),
        contentType: "application/json",
      });
      
      // Atualizar índice
      await this.updateIndexEntry(targetBranch, metadata);
      
      this.updateSyncStatus("idle");
      return drawing;
    } catch (error) {
      this.updateSyncStatus("error", String(error));
      throw error;
    }
  }
  
  async getDrawing(id: DrawingId, branch?: BranchName): Promise<Drawing | null> {
    this.updateSyncStatus("loading");
    
    try {
      const targetBranch = branch || this.currentBranch;
      
      // Carregar metadados
      const metaResult = await client.DECONFIG.READ_FILE({
        branch: targetBranch,
        path: this.getDrawingMetaPath(id),
      });
      const metadata: DrawingMetadata = JSON.parse(metaResult.content);
      
      // Carregar dados
      const dataResult = await client.DECONFIG.READ_FILE({
        branch: targetBranch,
        path: this.getDrawingDataPath(id),
      });
      const data = JSON.parse(dataResult.content);
      
      const drawing: Drawing = {
        ...metadata,
        elements: data.elements || [],
        appState: data.appState || {},
        files: data.files || {},
      };
      
      this.updateSyncStatus("idle");
      return drawing;
    } catch (error) {
      this.updateSyncStatus("error", String(error));
      return null;
    }
  }
  
  async listDrawings(branch?: BranchName): Promise<DrawingMetadata[]> {
    const targetBranch = branch || this.currentBranch;
    const index = await this.loadIndex(targetBranch);
    return index.drawings.filter((d) => !d.archived);
  }
  
  async updateDrawing(
    id: DrawingId,
    data: Partial<Drawing>,
    branch?: BranchName
  ): Promise<Drawing> {
    this.updateSyncStatus("saving");
    
    try {
      const targetBranch = branch || this.currentBranch;
      const existing = await this.getDrawing(id, targetBranch);
      
      if (!existing) {
        throw new Error(`Desenho não encontrado: ${id}`);
      }
      
      const updated: Drawing = {
        ...existing,
        ...data,
        id: existing.id, // ID não muda
        branch: existing.branch, // Branch não muda aqui
        updatedAt: Date.now(),
        version: existing.version + 1,
      };
      
      // Salvar dados atualizados
      await client.DECONFIG.PUT_FILE({
        branch: targetBranch,
        path: this.getDrawingDataPath(id),
        content: JSON.stringify({
          elements: updated.elements,
          appState: updated.appState,
          files: updated.files,
        }, null, 2),
        contentType: "application/json",
      });
      
      // Atualizar metadados
      const metadata: DrawingMetadata = {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        branch: updated.branch,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        version: updated.version,
        tags: updated.tags,
        archived: updated.archived,
        elementCount: updated.elements.length,
      };
      
      await client.DECONFIG.PUT_FILE({
        branch: targetBranch,
        path: this.getDrawingMetaPath(id),
        content: JSON.stringify(metadata, null, 2),
        contentType: "application/json",
      });
      
      // Atualizar índice
      await this.updateIndexEntry(targetBranch, metadata);
      
      this.updateSyncStatus("idle");
      return updated;
    } catch (error) {
      this.updateSyncStatus("error", String(error));
      throw error;
    }
  }
  
  async deleteDrawing(id: DrawingId, branch?: BranchName): Promise<void> {
    this.updateSyncStatus("saving");
    
    try {
      const targetBranch = branch || this.currentBranch;
      
      // Deletar arquivos
      await client.DECONFIG.DELETE_FILE({
        branch: targetBranch,
        path: this.getDrawingDataPath(id),
      });
      
      await client.DECONFIG.DELETE_FILE({
        branch: targetBranch,
        path: this.getDrawingMetaPath(id),
      });
      
      // Remover do índice
      await this.removeIndexEntry(targetBranch, id);
      
      // Se era o desenho atual, limpar
      if (this.currentDrawingId === id) {
        this.currentDrawingId = null;
      }
      
      this.updateSyncStatus("idle");
    } catch (error) {
      this.updateSyncStatus("error", String(error));
      throw error;
    }
  }
  
  async saveCurrentDrawing(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles
  ): Promise<void> {
    if (!this.currentDrawingId) {
      throw new Error("Nenhum desenho selecionado para salvar");
    }
    
    await this.updateDrawing(this.currentDrawingId, {
      elements,
      appState,
      files,
    });
  }
  
  // ==================== BRANCH OPERATIONS ====================
  
  async listBranches(): Promise<BranchInfo[]> {
    const result = await client.DECONFIG.LIST_BRANCHES({});
    
    return Promise.all(
      result.branches.map(async (branchName) => {
        const index = await this.loadIndex(branchName);
        return {
          name: branchName,
          drawingCount: index.drawings.length,
          lastModified: index.lastUpdated,
        };
      })
    );
  }
  
  async createBranch(name: BranchName, sourceBranch?: BranchName): Promise<void> {
    await client.DECONFIG.CREATE_BRANCH({
      branch: name,
      sourceBranch,
    });
  }
  
  async deleteBranch(name: BranchName): Promise<void> {
    if (name === this.currentBranch) {
      throw new Error("Não é possível deletar a branch atual");
    }
    
    await client.DECONFIG.DELETE_BRANCH({
      branch: name,
    });
  }
  
  async switchBranch(name: BranchName): Promise<void> {
    this.currentBranch = name;
    this.currentDrawingId = null; // Limpar desenho atual ao trocar branch
  }
  
  getCurrentBranch(): BranchName {
    return this.currentBranch;
  }
  
  // ==================== CURRENT DRAWING STATE ====================
  
  async setCurrentDrawingId(id: DrawingId | null): Promise<void> {
    this.currentDrawingId = id;
  }
  
  getCurrentDrawingId(): string | null {
    return this.currentDrawingId;
  }
  
  async getCurrentDrawing(): Promise<Drawing | null> {
    if (!this.currentDrawingId) return null;
    return this.getDrawing(this.currentDrawingId);
  }
  
  // ==================== SYNC & CONFIG ====================
  
  getSyncInfo(): SyncInfo {
    return { ...this.syncInfo };
  }
  
  async forceSave(): Promise<void> {
    if (!this.currentDrawingId) return;
    
    // O auto-save já cuida disso, mas podemos forçar
    this.syncInfo.pendingChanges = false;
  }
  
  async reloadDrawing(id: DrawingId, branch?: BranchName): Promise<Drawing> {
    const drawing = await this.getDrawing(id, branch);
    if (!drawing) {
      throw new Error(`Desenho não encontrado: ${id}`);
    }
    return drawing;
  }
}

/**
 * Instância singleton do storage
 */
export const drawingStorage = new DeconfigDrawingStorage();
```

## 🎨 Zustand Store Implementation

```typescript
// view/src/stores/drawing-store.ts

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { drawingStorage } from "../lib/storage-deconfig";
import type {
  DrawingStore,
  Drawing,
  DrawingId,
  DrawingMetadata,
  BranchName,
  BranchInfo,
  StorageConfig,
  SyncInfo,
} from "../types/drawing";
import type {
  ExcalidrawElement,
  AppState,
  BinaryFiles,
} from "@excalidraw/excalidraw/types/types";

/**
 * Configuração padrão
 */
const DEFAULT_CONFIG: StorageConfig = {
  currentBranch: "main",
  autoSaveDelay: 2000, // 2 segundos
  autoSaveEnabled: true,
  pathPrefix: "webdraw/",
};

/**
 * Store principal de desenhos
 */
export const useDrawingStore = create<DrawingStore>()(
  devtools(
    persist(
      (set, get) => ({
        // ==================== STATE ====================
        
        config: DEFAULT_CONFIG,
        currentDrawing: null,
        drawings: [],
        branches: [],
        syncInfo: {
          status: "idle",
          pendingChanges: false,
        },
        isLoading: false,
        
        // ==================== ACTIONS ====================
        
        initialize: async () => {
          set({ isLoading: true });
          
          try {
            // Carregar branches
            const branches = await drawingStorage.listBranches();
            
            // Carregar desenhos da branch atual
            const drawings = await drawingStorage.listDrawings();
            
            set({
              branches,
              drawings,
              isLoading: false,
            });
          } catch (error) {
            console.error("Erro ao inicializar store:", error);
            set({ isLoading: false });
          }
        },
        
        createDrawing: async (name: string, description?: string) => {
          set({ isLoading: true });
          
          try {
            const drawing = await drawingStorage.createDrawing(name, undefined, {
              description,
            });
            
            await drawingStorage.setCurrentDrawingId(drawing.id);
            
            // Atualizar lista
            const drawings = await drawingStorage.listDrawings();
            
            set({
              currentDrawing: drawing,
              drawings,
              isLoading: false,
            });
            
            return drawing.id;
          } catch (error) {
            console.error("Erro ao criar desenho:", error);
            set({ isLoading: false });
            throw error;
          }
        },
        
        loadDrawing: async (id: DrawingId) => {
          set({ isLoading: true });
          
          try {
            const drawing = await drawingStorage.getDrawing(id);
            
            if (!drawing) {
              throw new Error("Desenho não encontrado");
            }
            
            await drawingStorage.setCurrentDrawingId(id);
            
            set({
              currentDrawing: drawing,
              isLoading: false,
            });
          } catch (error) {
            console.error("Erro ao carregar desenho:", error);
            set({ isLoading: false });
            throw error;
          }
        },
        
        saveDrawing: async (
          elements: readonly ExcalidrawElement[],
          appState: Partial<AppState>,
          files: BinaryFiles
        ) => {
          const { currentDrawing } = get();
          
          if (!currentDrawing) {
            throw new Error("Nenhum desenho selecionado");
          }
          
          // Marcar como tendo mudanças pendentes
          set({
            syncInfo: {
              ...get().syncInfo,
              status: "saving",
              pendingChanges: true,
            },
          });
          
          try {
            await drawingStorage.saveCurrentDrawing(elements, appState, files);
            
            // Atualizar drawing atual
            const updated = await drawingStorage.getCurrentDrawing();
            
            set({
              currentDrawing: updated,
              syncInfo: {
                status: "idle",
                lastSyncAt: Date.now(),
                pendingChanges: false,
              },
            });
            
            // Atualizar lista de desenhos
            await get().refreshDrawings();
          } catch (error) {
            console.error("Erro ao salvar desenho:", error);
            set({
              syncInfo: {
                status: "error",
                error: String(error),
                pendingChanges: true,
              },
            });
            throw error;
          }
        },
        
        deleteDrawing: async (id: DrawingId) => {
          set({ isLoading: true });
          
          try {
            await drawingStorage.deleteDrawing(id);
            
            const { currentDrawing } = get();
            
            // Se era o desenho atual, limpar
            if (currentDrawing?.id === id) {
              set({ currentDrawing: null });
            }
            
            // Atualizar lista
            await get().refreshDrawings();
            
            set({ isLoading: false });
          } catch (error) {
            console.error("Erro ao deletar desenho:", error);
            set({ isLoading: false });
            throw error;
          }
        },
        
        renameDrawing: async (id: DrawingId, newName: string) => {
          try {
            await drawingStorage.updateDrawing(id, { name: newName });
            
            // Atualizar lista
            await get().refreshDrawings();
            
            // Se era o desenho atual, atualizar
            const { currentDrawing } = get();
            if (currentDrawing?.id === id) {
              const updated = await drawingStorage.getDrawing(id);
              set({ currentDrawing: updated });
            }
          } catch (error) {
            console.error("Erro ao renomear desenho:", error);
            throw error;
          }
        },
        
        updateMetadata: async (id: DrawingId, metadata: Partial<DrawingMetadata>) => {
          try {
            await drawingStorage.updateDrawing(id, metadata);
            await get().refreshDrawings();
            
            // Atualizar desenho atual se necessário
            const { currentDrawing } = get();
            if (currentDrawing?.id === id) {
              const updated = await drawingStorage.getDrawing(id);
              set({ currentDrawing: updated });
            }
          } catch (error) {
            console.error("Erro ao atualizar metadados:", error);
            throw error;
          }
        },
        
        refreshDrawings: async () => {
          try {
            const drawings = await drawingStorage.listDrawings();
            set({ drawings });
          } catch (error) {
            console.error("Erro ao atualizar lista:", error);
          }
        },
        
        switchBranch: async (branchName: BranchName) => {
          set({ isLoading: true });
          
          try {
            await drawingStorage.switchBranch(branchName);
            
            // Carregar desenhos da nova branch
            const drawings = await drawingStorage.listDrawings();
            
            set({
              config: {
                ...get().config,
                currentBranch: branchName,
              },
              currentDrawing: null, // Limpar desenho ao trocar branch
              drawings,
              isLoading: false,
            });
          } catch (error) {
            console.error("Erro ao trocar branch:", error);
            set({ isLoading: false });
            throw error;
          }
        },
        
        createBranch: async (name: BranchName, sourceBranch?: BranchName) => {
          try {
            await drawingStorage.createBranch(name, sourceBranch);
            
            // Atualizar lista de branches
            const branches = await drawingStorage.listBranches();
            set({ branches });
          } catch (error) {
            console.error("Erro ao criar branch:", error);
            throw error;
          }
        },
        
        deleteBranch: async (name: BranchName) => {
          try {
            await drawingStorage.deleteBranch(name);
            
            // Atualizar lista de branches
            const branches = await drawingStorage.listBranches();
            set({ branches });
          } catch (error) {
            console.error("Erro ao deletar branch:", error);
            throw error;
          }
        },
        
        forceSave: async () => {
          const { currentDrawing } = get();
          if (!currentDrawing) return;
          
          await drawingStorage.forceSave();
          set({
            syncInfo: {
              ...get().syncInfo,
              pendingChanges: false,
            },
          });
        },
        
        updateConfig: (config: Partial<StorageConfig>) => {
          set({
            config: {
              ...get().config,
              ...config,
            },
          });
        },
      }),
      {
        name: "drawing-storage",
        // Persistir apenas configuração e ID do desenho atual
        partialize: (state) => ({
          config: state.config,
        }),
      }
    ),
    { name: "DrawingStore" }
  )
);
```

## 🔄 Auto-Save com Debounce (Sem Infinite Loop)

```typescript
// view/src/lib/auto-save.ts

import type { ExcalidrawElement, AppState, BinaryFiles } from "@excalidraw/excalidraw/types/types";
import { useDrawingStore } from "../stores/drawing-store";

/**
 * Gerenciador de auto-save com debounce
 */
export class AutoSaveManager {
  private saveTimeout: NodeJS.Timeout | null = null;
  private lastSaveData: string | null = null;
  private isSaving = false;
  
  /**
   * Agenda um salvamento com debounce
   * 
   * IMPORTANTE: Usa hash dos dados para evitar infinite loop
   * - Se os dados não mudaram desde o último save, não salva
   * - Se já está salvando, não agenda outro save
   */
  scheduleAutoSave(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
    delay: number
  ): void {
    // Criar hash dos dados atuais
    const currentHash = this.hashDrawingData(elements, appState);
    
    // Se dados não mudaram, não precisa salvar
    if (currentHash === this.lastSaveData) {
      return;
    }
    
    // Se já está salvando, não agendar outro
    if (this.isSaving) {
      return;
    }
    
    // Cancelar timeout anterior
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    // Agendar novo save
    this.saveTimeout = setTimeout(async () => {
      await this.executeSave(elements, appState, files);
    }, delay);
  }
  
  /**
   * Executa o salvamento
   */
  private async executeSave(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles
  ): Promise<void> {
    if (this.isSaving) return;
    
    this.isSaving = true;
    
    try {
      const store = useDrawingStore.getState();
      
      // Salvar no DECONFIG
      await store.saveDrawing(elements, appState, files);
      
      // Atualizar hash após salvar com sucesso
      this.lastSaveData = this.hashDrawingData(elements, appState);
    } catch (error) {
      console.error("Erro no auto-save:", error);
      // Não atualizar hash em caso de erro para tentar novamente
    } finally {
      this.isSaving = false;
    }
  }
  
  /**
   * Cria hash dos dados do desenho para detectar mudanças
   * 
   * Usa apenas informações relevantes para evitar false positives:
   * - IDs dos elementos
   * - Versões dos elementos
   * - Propriedades importantes do appState
   */
  private hashDrawingData(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>
  ): string {
    const relevantData = {
      elementIds: elements.map((e) => e.id),
      elementVersions: elements.map((e) => e.version),
      viewState: {
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      },
    };
    
    return JSON.stringify(relevantData);
  }
  
  /**
   * Força salvamento imediato (cancela debounce)
   */
  async forceSave(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles
  ): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    
    await this.executeSave(elements, appState, files);
  }
  
  /**
   * Limpa timers
   */
  destroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }
}
```

## 🎯 Hook de Integração com Excalidraw

```typescript
// view/src/hooks/useExcalidrawCanvas.ts

import { useState, useCallback, useRef, useEffect } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useDrawingStore } from "../stores/drawing-store";
import { AutoSaveManager } from "../lib/auto-save";

/**
 * Hook principal para integração Excalidraw + DECONFIG + Zustand
 */
export const useExcalidrawCanvas = () => {
  const [isReady, setIsReady] = useState(false);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const autoSaveRef = useRef<AutoSaveManager>(new AutoSaveManager());
  
  const {
    currentDrawing,
    config,
    saveDrawing,
    loadDrawing: loadDrawingAction,
  } = useDrawingStore();
  
  /**
   * Callback quando API do Excalidraw está pronta
   */
  const onExcalidrawAPIMount = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
    setIsReady(true);
  }, []);
  
  /**
   * Carrega um desenho no canvas
   */
  const loadDrawing = useCallback(async (drawingId: string) => {
    if (!apiRef.current) {
      throw new Error("Canvas não inicializado");
    }
    
    // Carregar do store (que busca do DECONFIG)
    await loadDrawingAction(drawingId);
    
    // Aguardar store atualizar
    const drawing = useDrawingStore.getState().currentDrawing;
    if (!drawing) return;
    
    // Atualizar canvas
    apiRef.current.updateScene({
      elements: drawing.elements,
      appState: drawing.appState,
    });
    
    // Carregar arquivos
    if (drawing.files && Object.keys(drawing.files).length > 0) {
      apiRef.current.addFiles(Object.values(drawing.files));
    }
  }, [loadDrawingAction]);
  
  /**
   * Handler de mudanças no canvas
   * 
   * IMPORTANTE: Este é o ponto de integração do auto-save
   */
  const handleChange = useCallback(() => {
    if (!apiRef.current || !config.autoSaveEnabled) return;
    
    const elements = apiRef.current.getSceneElements();
    const appState = apiRef.current.getAppState();
    const files = apiRef.current.getFiles();
    
    // Agendar auto-save com debounce
    autoSaveRef.current.scheduleAutoSave(
      elements,
      appState,
      files,
      config.autoSaveDelay
    );
  }, [config.autoSaveEnabled, config.autoSaveDelay]);
  
  /**
   * Força salvamento imediato
   */
  const forceSave = useCallback(async () => {
    if (!apiRef.current) return;
    
    const elements = apiRef.current.getSceneElements();
    const appState = apiRef.current.getAppState();
    const files = apiRef.current.getFiles();
    
    await autoSaveRef.current.forceSave(elements, appState, files);
  }, []);
  
  /**
   * Cleanup ao desmontar
   */
  useEffect(() => {
    return () => {
      autoSaveRef.current.destroy();
    };
  }, []);
  
  return {
    isReady,
    onExcalidrawAPIMount,
    loadDrawing,
    handleChange,
    forceSave,
    currentDrawing,
    api: apiRef.current,
  };
};
```

## 📱 Componentes UI

### Seletor de Branches

```typescript
// view/src/components/BranchSelector.tsx

import { useState } from "react";
import { useDrawingStore } from "../stores/drawing-store";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { GitBranch, Plus } from "lucide-react";

export const BranchSelector = () => {
  const { config, branches, switchBranch, createBranch } = useDrawingStore();
  const [isOpen, setIsOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const handleSwitchBranch = async (branchName: string) => {
    await switchBranch(branchName);
    setIsOpen(false);
  };
  
  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    
    setIsCreating(true);
    try {
      await createBranch(newBranchName, config.currentBranch);
      setNewBranchName("");
      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao criar branch:", error);
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <GitBranch className="h-4 w-4" />
          <span className="font-mono text-xs">{config.currentBranch}</span>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <div className="font-semibold text-sm">Branches</div>
          
          {/* Lista de branches */}
          <div className="space-y-1">
            {branches.map((branch) => (
              <button
                key={branch.name}
                onClick={() => handleSwitchBranch(branch.name)}
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent ${
                  branch.name === config.currentBranch ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono">{branch.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {branch.drawingCount} desenhos
                  </span>
                </div>
              </button>
            ))}
          </div>
          
          {/* Criar nova branch */}
          <div className="border-t pt-3 space-y-2">
            <input
              type="text"
              placeholder="Nome da nova branch"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBranch();
              }}
            />
            <Button
              onClick={handleCreateBranch}
              disabled={!newBranchName.trim() || isCreating}
              size="sm"
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              Criar Branch
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
```

### Lista de Desenhos

```typescript
// view/src/components/DrawingList.tsx

import { useEffect } from "react";
import { useDrawingStore } from "../stores/drawing-store";
import { Button } from "./ui/button";
import { Trash2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DrawingListProps {
  onSelectDrawing: (id: string) => void;
}

export const DrawingList = ({ onSelectDrawing }: DrawingListProps) => {
  const {
    drawings,
    currentDrawing,
    deleteDrawing,
    refreshDrawings,
    isLoading,
  } = useDrawingStore();
  
  useEffect(() => {
    refreshDrawings();
  }, [refreshDrawings]);
  
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm("Tem certeza que deseja deletar este desenho?")) {
      await deleteDrawing(id);
    }
  };
  
  if (isLoading) {
    return <div className="p-4 text-center">Carregando...</div>;
  }
  
  if (drawings.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Nenhum desenho nesta branch
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      {drawings.map((drawing) => {
        const isActive = currentDrawing?.id === drawing.id;
        
        return (
          <button
            key={drawing.id}
            onClick={() => onSelectDrawing(drawing.id)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium truncate">{drawing.name}</span>
                </div>
                
                {drawing.description && (
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {drawing.description}
                  </p>
                )}
                
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>
                    {drawing.elementCount || 0} elementos
                  </span>
                  <span>
                    {formatDistanceToNow(drawing.updatedAt, {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleDelete(drawing.id, e)}
                className="flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </button>
        );
      })}
    </div>
  );
};
```

## 🔄 Considerações sobre Realtime

### Situação Atual (Sem Realtime)

O DECONFIG **não possui suporte a realtime** no momento. Isso significa:

1. **Não há notificações push** de mudanças feitas por outros usuários
2. **Conflitos podem ocorrer** se múltiplos usuários editarem o mesmo desenho
3. **Sincronização é manual** via polling ou refresh explícito

### Estratégias de Mitigação

#### 1. Polling Periódico (Opcional)

```typescript
// view/src/lib/polling.ts

export class DrawingPoller {
  private interval: NodeJS.Timeout | null = null;
  private isPolling = false;
  
  start(callback: () => Promise<void>, intervalMs = 30000) {
    if (this.interval) return;
    
    this.interval = setInterval(async () => {
      if (this.isPolling) return;
      
      this.isPolling = true;
      try {
        await callback();
      } finally {
        this.isPolling = false;
      }
    }, intervalMs);
  }
  
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
```

#### 2. Detecção de Conflitos

```typescript
// Adicionar ao storage-deconfig.ts

/**
 * Verifica se há conflitos antes de salvar
 */
private async checkConflicts(id: DrawingId, localVersion: number): Promise<boolean> {
  try {
    const remote = await this.getDrawing(id);
    return remote ? remote.version > localVersion : false;
  } catch {
    return false;
  }
}

/**
 * Atualizar método updateDrawing com detecção de conflitos
 */
async updateDrawing(
  id: DrawingId,
  data: Partial<Drawing>,
  branch?: BranchName
): Promise<Drawing> {
  const existing = await this.getDrawing(id, branch);
  
  if (!existing) {
    throw new Error(`Desenho não encontrado: ${id}`);
  }
  
  // Verificar se versão mudou (conflito)
  if (data.version && data.version < existing.version) {
    this.updateSyncStatus("conflict");
    throw new Error("Conflito detectado: o desenho foi modificado por outro usuário");
  }
  
  // ... resto do código
}
```

#### 3. UI de Conflitos

```typescript
// view/src/components/ConflictDialog.tsx

import { Button } from "./ui/button";
import { AlertCircle } from "lucide-react";

interface ConflictDialogProps {
  onKeepLocal: () => void;
  onKeepRemote: () => void;
}

export const ConflictDialog = ({ onKeepLocal, onKeepRemote }: ConflictDialogProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg shadow-xl max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-6 w-6 text-warning" />
          <h2 className="text-xl font-semibold">Conflito Detectado</h2>
        </div>
        
        <p className="text-muted-foreground mb-6">
          Este desenho foi modificado por outro usuário. Escolha qual versão manter:
        </p>
        
        <div className="flex gap-3">
          <Button onClick={onKeepLocal} variant="outline" className="flex-1">
            Manter Minhas Alterações
          </Button>
          <Button onClick={onKeepRemote} className="flex-1">
            Usar Versão Remota
          </Button>
        </div>
      </div>
    </div>
  );
};
```

### Roadmap para Realtime (Futuro)

Quando o DECONFIG suportar realtime, a integração será:

1. **WebSocket Connection**
   ```typescript
   // Futuro: Conectar ao DECONFIG realtime
   const ws = await client.DECONFIG.SUBSCRIBE({
     branch: "main",
     path: "webdraw/",
   });
   
   ws.onMessage((event) => {
     if (event.type === "file_updated") {
       // Atualizar store automaticamente
       useDrawingStore.getState().refreshDrawings();
     }
   });
   ```

2. **Operational Transform** para edição colaborativa
3. **Presença de usuários** (quem está editando)
4. **Cursores de outros usuários** no canvas

## 📊 Fluxo de Dados Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                        Excalidraw Canvas                         │
│                     (User Interaction)                           │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ onChange event
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     useExcalidrawCanvas Hook                     │
│                                                                   │
│  • handleChange() detecta mudanças                               │
│  • Agenda auto-save com debounce                                 │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ após debounce (2s)
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AutoSaveManager                             │
│                                                                   │
│  • Hash dos dados para detectar mudanças reais                   │
│  • Evita infinite loops                                          │
│  • Evita saves duplicados                                        │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ se dados mudaram
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Zustand Store (DrawingStore)                 │
│                                                                   │
│  • saveDrawing() atualiza estado                                 │
│  • Marca status: saving → idle                                   │
│  • Chama drawingStorage.saveCurrentDrawing()                     │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│           DeconfigDrawingStorage (storage-deconfig.ts)           │
│                                                                   │
│  • updateDrawing() serializa dados                               │
│  • Chama client.DECONFIG.PUT_FILE() 2x:                          │
│    - {id}.json (dados do desenho)                                │
│    - {id}.meta.json (metadados)                                  │
│  • Atualiza índice (index.json)                                  │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ RPC call
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Server DECONFIG API                          │
│                   (via client.DECONFIG.*)                        │
│                                                                   │
│  • PUT_FILE persiste no DECONFIG                                 │
│  • Estrutura: webdraw/main/drawings/                             │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Leitura (Loading)

```
┌─────────────────────────────────────────────────────────────────┐
│                      User clicks drawing                         │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DrawingList Component                          │
│                                                                   │
│  • onSelectDrawing(id) chamado                                   │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     useExcalidrawCanvas Hook                     │
│                                                                   │
│  • loadDrawing(id) chamado                                       │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Zustand Store (DrawingStore)                 │
│                                                                   │
│  • loadDrawing() busca do storage                                │
│  • Atualiza currentDrawing no estado                             │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│           DeconfigDrawingStorage (storage-deconfig.ts)           │
│                                                                   │
│  • getDrawing() carrega do DECONFIG                              │
│  • Chama client.DECONFIG.READ_FILE() 2x:                         │
│    - {id}.json (dados)                                           │
│    - {id}.meta.json (metadados)                                  │
│  • Desserializa e retorna Drawing                                │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     useExcalidrawCanvas Hook                     │
│                                                                   │
│  • Recebe Drawing do store                                       │
│  • Atualiza Excalidraw via api.updateScene()                     │
│  • Carrega arquivos via api.addFiles()                           │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Roadmap de Implementação

### ✅ FASE 1: Server Tools - Folders (COMEÇAR AQUI)

**Objetivo:** Criar tools para gerenciamento de folders no servidor e testar via MCP

#### 1.1 Criar server/tools/folders.ts
- [ ] `CREATE_FOLDER` - Cria um novo folder
- [ ] `GET_FOLDER` - Obtém um folder por ID
- [ ] `LIST_FOLDERS` - Lista todos os folders
- [ ] `UPDATE_FOLDER` - Atualiza nome/emoji de um folder
- [ ] `DELETE_FOLDER` - Deleta um folder (exceto default)
- [ ] `REORDER_FOLDERS` - Reordena folders
- [ ] `ENSURE_DEFAULT_FOLDER` - Garante que folder default existe

#### 1.2 Adicionar ao server/tools/index.ts
- [ ] Importar e exportar `folderTools`

#### 1.3 Registrar no server/main.ts
- [ ] Adicionar `folderTools` ao array de tools

#### 1.4 Gerar types e testar
- [ ] `npm run dev` (startar servidor)
- [ ] `DECO_SELF_URL=<dev-url> npm run gen:self` (gerar types)
- [ ] Testar cada tool no Cursor via MCP
- [ ] Verificar que folder default é criado automaticamente

---

### ✅ FASE 2: Server Tools - Drawings

**Objetivo:** Criar tools para gerenciamento de desenhos

#### 2.1 Criar server/tools/drawings.ts
- [ ] `CREATE_DRAWING` - Cria um novo desenho
- [ ] `GET_DRAWING` - Obtém um desenho por ID
- [ ] `LIST_DRAWINGS` - Lista desenhos (filtro por folder opcional)
- [ ] `UPDATE_DRAWING` - Atualiza um desenho
- [ ] `DELETE_DRAWING` - Deleta um desenho
- [ ] `MOVE_DRAWING_TO_FOLDER` - Move desenho para outro folder
- [ ] `DUPLICATE_DRAWING` - Duplica um desenho

#### 2.2 Adicionar ao server/tools/index.ts
- [ ] Importar e exportar `drawingTools`

#### 2.3 Registrar no server/main.ts
- [ ] Adicionar `drawingTools` ao array de tools

#### 2.4 Gerar types e testar
- [ ] `npm run gen:self` (regenerar types)
- [ ] Testar cada tool no Cursor via MCP
- [ ] Criar desenhos em diferentes folders
- [ ] Verificar relação folder ↔ drawing

---

### ✅ FASE 3: Frontend - Setup Base

**Objetivo:** Instalar dependências e criar sistema de tipos

#### 3.1 Instalar dependências
- [ ] `cd view && npm install @excalidraw/excalidraw zustand`
- [ ] `npm install date-fns` (para formatação de datas)
- [ ] Verificar que TanStack Query já está instalado

#### 3.2 Criar sistema de tipos
- [ ] Criar `view/src/types/drawing.ts` com todos os tipos
- [ ] Tipos de Drawing, Folder, Metadata, etc.
- [ ] Interfaces para Storage e Store

---

### ✅ FASE 4: Frontend - Storage Layer

**Objetivo:** Criar camada de storage que chama as tools via RPC

#### 4.1 Implementar storage-deconfig.ts
- [ ] `DeconfigDrawingStorage` class
- [ ] Métodos de folder (createFolder, listFolders, etc.)
- [ ] Métodos de drawing (createDrawing, listDrawings, etc.)
- [ ] Helpers para paths e serialização
- [ ] Singleton `drawingStorage`

#### 4.2 Implementar auto-save.ts
- [ ] `AutoSaveManager` class
- [ ] Debounce com 2s
- [ ] Hash-based change detection
- [ ] Prevenção de infinite loops

---

### ✅ FASE 5: Frontend - Zustand Store

**Objetivo:** Criar store global para gerenciamento de estado

#### 5.1 Criar drawing-store.ts
- [ ] State: folders, drawings, currentDrawing, config, syncInfo
- [ ] Actions: createFolder, updateFolder, deleteFolder
- [ ] Actions: createDrawing, loadDrawing, saveDrawing
- [ ] Action: switchBranch
- [ ] Persist config no localStorage
- [ ] DevTools integration

---

### ✅ FASE 6: Frontend - Excalidraw Integration

**Objetivo:** Integrar biblioteca Excalidraw com auto-save

#### 6.1 Criar hooks
- [ ] `useExcalidrawCanvas` - Hook principal
- [ ] `useDrawingStorage` - Hook de folders/drawings
- [ ] Integração com AutoSaveManager
- [ ] Callbacks de onChange, onLoad, etc.

#### 6.2 Criar componente ExcalidrawCanvas
- [ ] Componente principal do canvas
- [ ] Integração com hook
- [ ] Auto-save automático
- [ ] Loading states

---

### ✅ FASE 7: Frontend - UI Components

**Objetivo:** Criar interface de navegação (left sidebar + folders)

#### 7.1 Criar FolderList component
- [ ] Lista de folders com emoji + nome
- [ ] Indicador de folder ativo
- [ ] Botão "Novo Folder"
- [ ] Contador de desenhos por folder
- [ ] Drag & drop para reordenar (futuro)

#### 7.2 Criar FolderEditor component
- [ ] Modal/popover para editar folder
- [ ] Input de nome
- [ ] Emoji picker (usar emoji-mart ou similar)
- [ ] Botão salvar/cancelar
- [ ] Validações

#### 7.3 Criar DrawingList component
- [ ] Lista de desenhos do folder selecionado
- [ ] Thumbnails (futuro)
- [ ] Nome + data de modificação
- [ ] Botão "Novo Desenho"
- [ ] Botão deletar/duplicar
- [ ] Destaque do desenho ativo

#### 7.4 Criar LeftSidebar component
- [ ] Container principal
- [ ] FolderList no topo
- [ ] DrawingList abaixo do folder selecionado
- [ ] BranchSelector no header
- [ ] Toggle de abrir/fechar sidebar
- [ ] Responsivo (colapsa em mobile)

#### 7.5 Criar DrawingActions component
- [ ] Botões de ação (salvar manual, exportar)
- [ ] Status de sincronização
- [ ] Indicador de auto-save
- [ ] Menu de opções

---

### 🔄 FASE 8: Features Avançadas

#### 8.1 Sistema de busca
- [ ] Busca por nome de desenho
- [ ] Filtros por folder
- [ ] Filtros por data

#### 8.2 Export e compartilhamento
- [ ] Exportar como PNG
- [ ] Exportar como SVG
- [ ] Exportar JSON (backup)
- [ ] Copiar link (futuro)

#### 8.3 Drag & Drop
- [ ] Arrastar desenho entre folders
- [ ] Reordenar folders
- [ ] Reordenar desenhos

#### 8.4 Atalhos de teclado
- [ ] Ctrl+S para salvar
- [ ] Ctrl+N para novo desenho
- [ ] Navegação entre desenhos (↑↓)
- [ ] Toggle sidebar (Ctrl+B)

---

### 🚀 FASE 9: Polish e Otimizações

#### 9.1 Performance
- [ ] Thumbnails lazy loading
- [ ] Virtualização da lista de desenhos
- [ ] Debounce em buscas
- [ ] Memoização de componentes

#### 9.2 UX Improvements
- [ ] Animações de transição
- [ ] Feedback visual de ações
- [ ] Toast notifications
- [ ] Empty states bem desenhados
- [ ] Loading skeletons

#### 9.3 Acessibilidade
- [ ] Navegação por teclado
- [ ] ARIA labels
- [ ] Focus management
- [ ] Contraste de cores

---

### 🔮 FASE 10: Realtime (Futuro - quando DECONFIG suportar)
- [ ] WebSocket connection ao DECONFIG
- [ ] Detecção automática de conflitos
- [ ] UI de resolução de conflitos
- [ ] Presença de usuários
- [ ] Cursores colaborativos

## 🛡️ Tratamento de Erros

```typescript
// view/src/lib/error-handling.ts

export class DrawingError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = "DrawingError";
  }
}

export const handleStorageError = (error: unknown): DrawingError => {
  if (error instanceof DrawingError) {
    return error;
  }
  
  if (error instanceof Error) {
    // Mapear erros do DECONFIG para erros amigáveis
    if (error.message.includes("not found")) {
      return new DrawingError(
        "Desenho não encontrado",
        "NOT_FOUND",
        false
      );
    }
    
    if (error.message.includes("conflict")) {
      return new DrawingError(
        "Conflito detectado: o desenho foi modificado por outro usuário",
        "CONFLICT",
        true
      );
    }
    
    if (error.message.includes("network")) {
      return new DrawingError(
        "Erro de conexão. Verifique sua internet.",
        "NETWORK_ERROR",
        true
      );
    }
  }
  
  return new DrawingError(
    "Erro desconhecido ao salvar desenho",
    "UNKNOWN",
    true
  );
};
```

## 📝 Próximos Passos

1. **Revisar features do Excalidraw pago** (aguardando seu input)
2. **Implementar Fase 1** (sistema de tipos + storage)
3. **Implementar Fase 2** (auto-save com debounce)
4. **Implementar Fase 3** (UI components)
5. **Testar fluxo completo** de criar → editar → salvar → carregar
6. **Adicionar features avançadas** conforme prioridade

---

## 🔗 Referências

- [Excalidraw Documentation](https://docs.excalidraw.com/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [DECONFIG API](shared/deco.gen.ts)
- [Excalidraw Integration Plan](plans/excalidraw.md)
