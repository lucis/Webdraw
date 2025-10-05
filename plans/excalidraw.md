# Plano de Integração: Excalidraw no Webdraw

## Visão Geral

O Webdraw será uma aplicação de desenho baseada na biblioteca Excalidraw, com capacidades de IA integradas. Este documento detalha a estratégia de integração da biblioteca Excalidraw, gerenciamento de estado e abstração de persistência.

## Arquitetura Proposta

```
view/
├── src/
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── ExcalidrawCanvas.tsx    # Componente principal do canvas
│   │   │   ├── DrawingSidebar.tsx      # Sidebar com lista de desenhos
│   │   │   └── DrawingToolbar.tsx      # Toolbar customizada
│   │   └── ui/
│   ├── lib/
│   │   ├── storage.ts                   # Abstração de persistência
│   │   ├── excalidraw-state.ts         # Gerenciamento de estado do canvas
│   │   └── excalidraw-utils.ts         # Utilitários
│   ├── stores/
│   │   └── drawing-store.ts            # ⭐ Zustand store global
│   ├── hooks/
│   │   ├── useExcalidrawCanvas.ts      # Hook principal do canvas
│   │   └── useDrawingStore.ts          # Hook para acessar Zustand store
│   └── types/
│       └── drawing.ts                   # Tipos TypeScript
```

## 1. Instalação e Dependências

### Pacotes Necessários

```bash
cd view
npm install @excalidraw/excalidraw zustand
npm install --save-dev @types/node
```

### Versões Recomendadas

- `@excalidraw/excalidraw`: ^0.17.0 ou superior
- `zustand`: ^4.5.0 ou superior
- React: ^18.0.0 (já instalado)

### Por que Zustand?

Zustand será usado para:
- **Estado global da aplicação**: Gerenciar desenho atual, lista de desenhos
- **Estado de UI**: Loading states, modals, sidebar
- **Performance**: Evitar prop drilling e re-renders desnecessários
- **DevTools**: Integração com Redux DevTools para debugging
- **Simplicidade**: API minimalista e type-safe

## 2. Tipos de Dados

### 2.1. Estrutura de Dados de Desenho

```typescript
// view/src/types/drawing.ts

import type {
  ExcalidrawElement,
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types/types";

/**
 * Representa um desenho completo com seus elementos e estado
 */
export interface Drawing {
  id: string;
  name: string;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Dados serializados para persistência
 */
export interface SerializedDrawing {
  id: string;
  name: string;
  data: string; // JSON stringificado
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Lista de desenhos (metadados apenas)
 */
export interface DrawingMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string; // Base64 data URL
}

/**
 * Operações de storage disponíveis
 */
export interface DrawingStorage {
  // Create
  createDrawing(name: string, initialData?: Partial<Drawing>): Promise<Drawing>;
  
  // Read
  getDrawing(id: string): Promise<Drawing | null>;
  getCurrentDrawing(): Promise<Drawing | null>;
  listDrawings(): Promise<DrawingMetadata[]>;
  
  // Update
  updateDrawing(id: string, data: Partial<Drawing>): Promise<Drawing>;
  saveCurrentDrawing(elements: readonly ExcalidrawElement[], appState: Partial<AppState>, files: BinaryFiles): Promise<void>;
  
  // Delete
  deleteDrawing(id: string): Promise<void>;
  
  // State management
  setCurrentDrawingId(id: string | null): Promise<void>;
  getCurrentDrawingId(): Promise<string | null>;
}
```

## 3. Camada de Storage (storage.ts)

### 3.1. API de Storage

A camada de storage abstrai completamente a persistência, permitindo trocar a implementação (localStorage → IndexedDB → Server) sem afetar o resto da aplicação.

```typescript
// view/src/lib/storage.ts

import type {
  Drawing,
  SerializedDrawing,
  DrawingMetadata,
  DrawingStorage,
} from "../types/drawing";
import type {
  ExcalidrawElement,
  AppState,
  BinaryFiles,
} from "@excalidraw/excalidraw/types/types";

/**
 * Chaves do localStorage
 */
const STORAGE_KEYS = {
  DRAWINGS: "webdraw:drawings",
  CURRENT_DRAWING_ID: "webdraw:current-drawing-id",
  DRAWING_PREFIX: "webdraw:drawing:",
} as const;

/**
 * Implementação de storage usando localStorage
 * 
 * NOTA: Esta implementação será substituída por chamadas de tools no futuro
 * A API é desenhada para ser 1:1 com os tools do servidor
 */
class LocalStorageDrawingStorage implements DrawingStorage {
  
  /**
   * Gera um ID único para um desenho
   */
  private generateId(): string {
    return `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Serializa um desenho para armazenamento
   */
  private serializeDrawing(drawing: Drawing): SerializedDrawing {
    return {
      id: drawing.id,
      name: drawing.name,
      data: JSON.stringify({
        elements: drawing.elements,
        appState: drawing.appState,
        files: drawing.files,
      }),
      createdAt: drawing.createdAt,
      updatedAt: drawing.updatedAt,
      version: drawing.version,
    };
  }

  /**
   * Desserializa um desenho do armazenamento
   */
  private deserializeDrawing(serialized: SerializedDrawing): Drawing {
    const data = JSON.parse(serialized.data);
    return {
      id: serialized.id,
      name: serialized.name,
      elements: data.elements || [],
      appState: data.appState || {},
      files: data.files || {},
      createdAt: serialized.createdAt,
      updatedAt: serialized.updatedAt,
      version: serialized.version,
    };
  }

  /**
   * Obtém chave de storage para um desenho específico
   */
  private getDrawingKey(id: string): string {
    return `${STORAGE_KEYS.DRAWING_PREFIX}${id}`;
  }

  /**
   * Cria um novo desenho
   * Futuro: Mapeará para tool CREATE_DRAWING
   */
  async createDrawing(name: string, initialData?: Partial<Drawing>): Promise<Drawing> {
    const now = Date.now();
    const drawing: Drawing = {
      id: this.generateId(),
      name,
      elements: initialData?.elements || [],
      appState: initialData?.appState || {},
      files: initialData?.files || {},
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Salvar desenho
    const serialized = this.serializeDrawing(drawing);
    localStorage.setItem(this.getDrawingKey(drawing.id), JSON.stringify(serialized));

    // Atualizar lista de desenhos
    const metadata = await this.listDrawings();
    metadata.push({
      id: drawing.id,
      name: drawing.name,
      createdAt: drawing.createdAt,
      updatedAt: drawing.updatedAt,
    });
    localStorage.setItem(STORAGE_KEYS.DRAWINGS, JSON.stringify(metadata));

    return drawing;
  }

  /**
   * Obtém um desenho por ID
   * Futuro: Mapeará para tool GET_DRAWING
   */
  async getDrawing(id: string): Promise<Drawing | null> {
    const data = localStorage.getItem(this.getDrawingKey(id));
    if (!data) return null;

    try {
      const serialized: SerializedDrawing = JSON.parse(data);
      return this.deserializeDrawing(serialized);
    } catch (error) {
      console.error("Erro ao desserializar desenho:", error);
      return null;
    }
  }

  /**
   * Obtém o desenho atualmente selecionado
   * Futuro: Mapeará para tool GET_CURRENT_DRAWING
   */
  async getCurrentDrawing(): Promise<Drawing | null> {
    const currentId = await this.getCurrentDrawingId();
    if (!currentId) return null;
    return this.getDrawing(currentId);
  }

  /**
   * Lista todos os desenhos (metadados apenas)
   * Futuro: Mapeará para tool LIST_DRAWINGS
   */
  async listDrawings(): Promise<DrawingMetadata[]> {
    const data = localStorage.getItem(STORAGE_KEYS.DRAWINGS);
    if (!data) return [];

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Erro ao listar desenhos:", error);
      return [];
    }
  }

  /**
   * Atualiza um desenho existente
   * Futuro: Mapeará para tool UPDATE_DRAWING
   */
  async updateDrawing(id: string, data: Partial<Drawing>): Promise<Drawing> {
    const existing = await this.getDrawing(id);
    if (!existing) {
      throw new Error(`Desenho não encontrado: ${id}`);
    }

    const updated: Drawing = {
      ...existing,
      ...data,
      id: existing.id, // ID não pode mudar
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    // Salvar desenho atualizado
    const serialized = this.serializeDrawing(updated);
    localStorage.setItem(this.getDrawingKey(id), JSON.stringify(serialized));

    // Atualizar metadados na lista
    const allDrawings = await this.listDrawings();
    const index = allDrawings.findIndex((d) => d.id === id);
    if (index >= 0) {
      allDrawings[index] = {
        id: updated.id,
        name: updated.name,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
      localStorage.setItem(STORAGE_KEYS.DRAWINGS, JSON.stringify(allDrawings));
    }

    return updated;
  }

  /**
   * Salva o estado atual do desenho
   * Futuro: Mapeará para tool SAVE_CURRENT_DRAWING
   */
  async saveCurrentDrawing(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles
  ): Promise<void> {
    const currentId = await this.getCurrentDrawingId();
    if (!currentId) {
      throw new Error("Nenhum desenho selecionado para salvar");
    }

    await this.updateDrawing(currentId, {
      elements,
      appState,
      files,
    });
  }

  /**
   * Deleta um desenho
   * Futuro: Mapeará para tool DELETE_DRAWING
   */
  async deleteDrawing(id: string): Promise<void> {
    // Remover desenho
    localStorage.removeItem(this.getDrawingKey(id));

    // Atualizar lista
    const allDrawings = await this.listDrawings();
    const filtered = allDrawings.filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DRAWINGS, JSON.stringify(filtered));

    // Se era o desenho atual, limpar seleção
    const currentId = await this.getCurrentDrawingId();
    if (currentId === id) {
      await this.setCurrentDrawingId(null);
    }
  }

  /**
   * Define o ID do desenho atual
   * Futuro: Mapeará para tool SET_CURRENT_DRAWING
   */
  async setCurrentDrawingId(id: string | null): Promise<void> {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAWING_ID);
    } else {
      localStorage.setItem(STORAGE_KEYS.CURRENT_DRAWING_ID, id);
    }
  }

  /**
   * Obtém o ID do desenho atual
   * Futuro: Mapeará para tool GET_CURRENT_DRAWING_ID
   */
  async getCurrentDrawingId(): Promise<string | null> {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_DRAWING_ID);
  }
}

/**
 * Instância singleton do storage
 * 
 * IMPORTANTE: No futuro, este será substituído por uma implementação
 * que chama os tools do servidor via RPC
 */
export const drawingStorage: DrawingStorage = new LocalStorageDrawingStorage();
```

### 3.2. Migração Futura para Tools

Quando migrarmos para tools do servidor, a interface `DrawingStorage` permanecerá a mesma, mas a implementação mudará:

```typescript
// Futuro: view/src/lib/storage-rpc.ts
import { client } from "./rpc";
import type { DrawingStorage } from "../types/drawing";

class RPCDrawingStorage implements DrawingStorage {
  async createDrawing(name: string, initialData?: Partial<Drawing>): Promise<Drawing> {
    return await client.CREATE_DRAWING({ name, initialData });
  }

  async getDrawing(id: string): Promise<Drawing | null> {
    return await client.GET_DRAWING({ id });
  }

  // ... outros métodos seguem o mesmo padrão
}

export const drawingStorage: DrawingStorage = new RPCDrawingStorage();
```

## 4. Gerenciamento de Estado (excalidraw-state.ts)

```typescript
// view/src/lib/excalidraw-state.ts

import type {
  ExcalidrawElement,
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types/types";
import { drawingStorage } from "./storage";

/**
 * Configurações de auto-save
 */
const AUTO_SAVE_DELAY = 2000; // 2 segundos

/**
 * Classe para gerenciar o estado do Excalidraw
 */
export class ExcalidrawStateManager {
  private api: ExcalidrawImperativeAPI | null = null;
  private autoSaveTimeout: NodeJS.Timeout | null = null;
  private isInitialized = false;

  /**
   * Inicializa o gerenciador com a API do Excalidraw
   */
  initialize(api: ExcalidrawImperativeAPI) {
    this.api = api;
    this.isInitialized = true;
  }

  /**
   * Carrega um desenho no canvas
   */
  async loadDrawing(drawingId: string): Promise<void> {
    if (!this.api) {
      throw new Error("API do Excalidraw não inicializada");
    }

    const drawing = await drawingStorage.getDrawing(drawingId);
    if (!drawing) {
      throw new Error(`Desenho não encontrado: ${drawingId}`);
    }

    // Atualizar estado do Excalidraw
    this.api.updateScene({
      elements: drawing.elements,
      appState: drawing.appState,
    });

    // Carregar arquivos (imagens, etc)
    if (drawing.files && Object.keys(drawing.files).length > 0) {
      this.api.addFiles(Object.values(drawing.files));
    }

    // Marcar como desenho atual
    await drawingStorage.setCurrentDrawingId(drawingId);
  }

  /**
   * Cria um novo desenho e carrega no canvas
   */
  async createNewDrawing(name: string): Promise<string> {
    if (!this.api) {
      throw new Error("API do Excalidraw não inicializada");
    }

    // Criar novo desenho vazio
    const drawing = await drawingStorage.createDrawing(name);

    // Limpar canvas
    this.api.updateScene({
      elements: [],
      appState: {},
    });

    // Marcar como desenho atual
    await drawingStorage.setCurrentDrawingId(drawing.id);

    return drawing.id;
  }

  /**
   * Salva o estado atual do canvas
   */
  async saveCurrentState(): Promise<void> {
    if (!this.api) {
      throw new Error("API do Excalidraw não inicializada");
    }

    const elements = this.api.getSceneElements();
    const appState = this.api.getAppState();
    const files = this.api.getFiles();

    await drawingStorage.saveCurrentDrawing(elements, appState, files);
  }

  /**
   * Agenda um auto-save (debounced)
   */
  scheduleAutoSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = setTimeout(() => {
      this.saveCurrentState().catch((error) => {
        console.error("Erro no auto-save:", error);
      });
    }, AUTO_SAVE_DELAY);
  }

  /**
   * Exporta o desenho atual como imagem
   */
  async exportAsImage(type: "png" | "svg" = "png"): Promise<Blob> {
    if (!this.api) {
      throw new Error("API do Excalidraw não inicializada");
    }

    const elements = this.api.getSceneElements();
    const appState = this.api.getAppState();
    const files = this.api.getFiles();

    // Usar API nativa do Excalidraw para exportar
    const blob = await this.api.exportToBlob({
      elements,
      appState,
      files,
      mimeType: type === "png" ? "image/png" : "image/svg+xml",
    });

    return blob;
  }

  /**
   * Obtém estatísticas do desenho atual
   */
  getDrawingStats() {
    if (!this.api) return null;

    const elements = this.api.getSceneElements();
    
    return {
      totalElements: elements.length,
      elementTypes: elements.reduce((acc, el) => {
        acc[el.type] = (acc[el.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    this.api = null;
    this.isInitialized = false;
  }
}
```

## 5. Zustand Store

### 5.1. Drawing Store (drawing-store.ts)

```typescript
// view/src/stores/drawing-store.ts

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Drawing, DrawingMetadata } from "../types/drawing";
import { drawingStorage } from "../lib/storage";

interface DrawingState {
  // Estado
  drawings: DrawingMetadata[];
  currentDrawing: Drawing | null;
  currentDrawingId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Ações
  loadDrawings: () => Promise<void>;
  loadDrawing: (id: string) => Promise<void>;
  createDrawing: (name: string) => Promise<string>;
  updateCurrentDrawing: (data: Partial<Drawing>) => Promise<void>;
  deleteDrawing: (id: string) => Promise<void>;
  setCurrentDrawingId: (id: string | null) => void;
  clearError: () => void;
}

export const useDrawingStore = create<DrawingState>()(
  devtools(
    (set, get) => ({
      // Estado inicial
      drawings: [],
      currentDrawing: null,
      currentDrawingId: null,
      isLoading: false,
      isSaving: false,
      error: null,

      // Carregar lista de desenhos
      loadDrawings: async () => {
        set({ isLoading: true, error: null });
        try {
          const drawings = await drawingStorage.listDrawings();
          set({ drawings, isLoading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : "Erro ao carregar desenhos",
            isLoading: false 
          });
        }
      },

      // Carregar um desenho específico
      loadDrawing: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const drawing = await drawingStorage.getDrawing(id);
          if (drawing) {
            await drawingStorage.setCurrentDrawingId(id);
            set({ 
              currentDrawing: drawing,
              currentDrawingId: id,
              isLoading: false 
            });
          } else {
            throw new Error("Desenho não encontrado");
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : "Erro ao carregar desenho",
            isLoading: false 
          });
        }
      },

      // Criar novo desenho
      createDrawing: async (name: string) => {
        set({ isLoading: true, error: null });
        try {
          const drawing = await drawingStorage.createDrawing(name);
          await drawingStorage.setCurrentDrawingId(drawing.id);
          
          // Atualizar lista e estado atual
          const drawings = await drawingStorage.listDrawings();
          set({ 
            drawings,
            currentDrawing: drawing,
            currentDrawingId: drawing.id,
            isLoading: false 
          });
          
          return drawing.id;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : "Erro ao criar desenho",
            isLoading: false 
          });
          throw error;
        }
      },

      // Atualizar desenho atual
      updateCurrentDrawing: async (data: Partial<Drawing>) => {
        const { currentDrawingId } = get();
        if (!currentDrawingId) {
          throw new Error("Nenhum desenho selecionado");
        }

        set({ isSaving: true, error: null });
        try {
          const updated = await drawingStorage.updateDrawing(currentDrawingId, data);
          
          // Atualizar lista e estado atual
          const drawings = await drawingStorage.listDrawings();
          set({ 
            currentDrawing: updated,
            drawings,
            isSaving: false 
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : "Erro ao atualizar desenho",
            isSaving: false 
          });
          throw error;
        }
      },

      // Deletar desenho
      deleteDrawing: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          await drawingStorage.deleteDrawing(id);
          
          // Atualizar lista
          const drawings = await drawingStorage.listDrawings();
          
          // Se deletou o desenho atual, limpar estado
          const { currentDrawingId } = get();
          if (currentDrawingId === id) {
            set({ 
              drawings,
              currentDrawing: null,
              currentDrawingId: null,
              isLoading: false 
            });
          } else {
            set({ drawings, isLoading: false });
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : "Erro ao deletar desenho",
            isLoading: false 
          });
        }
      },

      // Definir ID do desenho atual (sem carregar)
      setCurrentDrawingId: (id: string | null) => {
        set({ currentDrawingId: id });
      },

      // Limpar erro
      clearError: () => {
        set({ error: null });
      },
    }),
    { name: "DrawingStore" }
  )
);
```

## 6. Hooks React

### 6.1. useDrawingStorage Hook (DEPRECATED - use Zustand store)

> **NOTA:** Este hook é mantido para compatibilidade, mas recomenda-se usar o Zustand store diretamente via `useDrawingStore()`.

```typescript
// view/src/hooks/useDrawingStorage.ts

import { useState, useEffect } from "react";
import { drawingStorage } from "../lib/storage";
import type { DrawingMetadata, Drawing } from "../types/drawing";

/**
 * Hook para gerenciar persistência de desenhos
 */
export const useDrawingStorage = () => {
  const [drawings, setDrawings] = useState<DrawingMetadata[]>([]);
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar lista de desenhos ao montar
  useEffect(() => {
    loadDrawings();
  }, []);

  const loadDrawings = async () => {
    setIsLoading(true);
    try {
      const list = await drawingStorage.listDrawings();
      setDrawings(list);
      
      const currentId = await drawingStorage.getCurrentDrawingId();
      setCurrentDrawingId(currentId);
    } catch (error) {
      console.error("Erro ao carregar desenhos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createDrawing = async (name: string) => {
    const drawing = await drawingStorage.createDrawing(name);
    await loadDrawings();
    return drawing;
  };

  const deleteDrawing = async (id: string) => {
    await drawingStorage.deleteDrawing(id);
    await loadDrawings();
  };

  const selectDrawing = async (id: string) => {
    await drawingStorage.setCurrentDrawingId(id);
    setCurrentDrawingId(id);
  };

  return {
    drawings,
    currentDrawingId,
    isLoading,
    createDrawing,
    deleteDrawing,
    selectDrawing,
    refresh: loadDrawings,
  };
};
```

### 5.2. useExcalidrawCanvas Hook

```typescript
// view/src/hooks/useExcalidrawCanvas.ts

import { useState, useCallback, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { ExcalidrawStateManager } from "../lib/excalidraw-state";

/**
 * Hook principal para gerenciar o canvas do Excalidraw
 */
export const useExcalidrawCanvas = () => {
  const [isReady, setIsReady] = useState(false);
  const stateManagerRef = useRef<ExcalidrawStateManager>(
    new ExcalidrawStateManager()
  );

  const onExcalidrawAPIMount = useCallback((api: ExcalidrawImperativeAPI) => {
    stateManagerRef.current.initialize(api);
    setIsReady(true);
  }, []);

  const loadDrawing = useCallback(async (drawingId: string) => {
    await stateManagerRef.current.loadDrawing(drawingId);
  }, []);

  const createNewDrawing = useCallback(async (name: string) => {
    return await stateManagerRef.current.createNewDrawing(name);
  }, []);

  const saveDrawing = useCallback(async () => {
    await stateManagerRef.current.saveCurrentState();
  }, []);

  const handleChange = useCallback(() => {
    // Auto-save ao mudar
    stateManagerRef.current.scheduleAutoSave();
  }, []);

  return {
    isReady,
    onExcalidrawAPIMount,
    loadDrawing,
    createNewDrawing,
    saveDrawing,
    handleChange,
    stateManager: stateManagerRef.current,
  };
};
```

## 6. Componente Principal

```typescript
// view/src/components/canvas/ExcalidrawCanvas.tsx

import { Excalidraw } from "@excalidraw/excalidraw";
import { useExcalidrawCanvas } from "../../hooks/useExcalidrawCanvas";
import { useEffect } from "react";

interface ExcalidrawCanvasProps {
  drawingId?: string;
  onSave?: () => void;
}

export const ExcalidrawCanvas = ({ drawingId, onSave }: ExcalidrawCanvasProps) => {
  const {
    isReady,
    onExcalidrawAPIMount,
    loadDrawing,
    handleChange,
  } = useExcalidrawCanvas();

  // Carregar desenho quando ID mudar
  useEffect(() => {
    if (isReady && drawingId) {
      loadDrawing(drawingId);
    }
  }, [isReady, drawingId, loadDrawing]);

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <Excalidraw
        excalidrawAPI={onExcalidrawAPIMount}
        onChange={handleChange}
        initialData={{
          appState: {
            viewBackgroundColor: "#ffffff",
          },
        }}
      />
    </div>
  );
};
```

## 7. Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                      Componente React                        │
│                   (ExcalidrawCanvas.tsx)                     │
└────────────┬────────────────────────────────┬────────────────┘
             │                                │
             │ useExcalidrawCanvas()          │ useDrawingStorage()
             │                                │
             ▼                                ▼
┌─────────────────────────┐      ┌─────────────────────────────┐
│  ExcalidrawStateManager │      │    drawingStorage (API)     │
│   (excalidraw-state.ts) │◄─────┤       (storage.ts)          │
└─────────────────────────┘      └─────────────────────────────┘
             │                                │
             │ ExcalidrawImperativeAPI        │ localStorage (hoje)
             │                                │ RPC Tools (futuro)
             ▼                                ▼
┌─────────────────────────┐      ┌─────────────────────────────┐
│   Biblioteca Excalidraw │      │     Camada de Persistência  │
│   (@excalidraw/...)     │      │   (localStorage/IndexedDB)  │
└─────────────────────────┘      └─────────────────────────────┘
```

## 8. Roadmap de Implementação

### Fase 1: Setup Básico (Atual)
- [x] Definir estrutura de arquivos
- [ ] Instalar dependências
- [ ] Criar tipos TypeScript
- [ ] Implementar camada de storage (localStorage)
- [ ] Criar hooks básicos

### Fase 2: Integração Excalidraw
- [ ] Implementar ExcalidrawCanvas component
- [ ] Implementar ExcalidrawStateManager
- [ ] Conectar auto-save
- [ ] Adicionar funcionalidade de criar/carregar/deletar desenhos

### Fase 3: UI e UX
- [ ] Criar sidebar com lista de desenhos
- [ ] Adicionar botões de ação (novo, salvar, exportar)
- [ ] Implementar navegação entre desenhos
- [ ] Adicionar feedback visual de salvamento

### Fase 4: Migração para Tools (Futuro)
- [ ] Criar tools no servidor (server/tools/drawings.ts):
  - CREATE_DRAWING
  - GET_DRAWING
  - LIST_DRAWINGS
  - UPDATE_DRAWING
  - DELETE_DRAWING
  - SET_CURRENT_DRAWING
  - GET_CURRENT_DRAWING
- [ ] Implementar RPCDrawingStorage
- [ ] Migrar de localStorage para RPC
- [ ] Adicionar persistência em banco de dados

### Fase 5: IA Integration (Futuro)
- [ ] Ferramentas de IA para gerar desenhos
- [ ] Auto-complete de formas
- [ ] Sugestões de layout
- [ ] Conversão de texto para diagrama

## 9. Considerações Técnicas

### 9.1. Performance
- Auto-save com debounce de 2 segundos para evitar salvamentos excessivos
- Serialização eficiente com JSON.stringify/parse
- Lazy loading de desenhos (carregar metadados primeiro)

### 9.2. Limitações do localStorage
- Limite de ~5-10MB por domínio
- Bloqueante (síncrono)
- Sem suporte a queries complexas

**Migração futura:** IndexedDB ou servidor para desenhos grandes e consultas avançadas

### 9.3. Segurança
- Validação de dados ao desserializar
- Sanitização de nomes de desenho
- Rate limiting no futuro (server-side)

### 9.4. Compatibilidade
- Versionamento de estrutura de dados (`version` field)
- Migração automática entre versões
- Backup antes de migrações

## 10. Próximos Passos

1. **Implementar storage.ts** com localStorage
2. **Criar tipos em drawing.ts**
3. **Implementar ExcalidrawStateManager**
4. **Criar hooks básicos** (useExcalidrawCanvas, useDrawingStorage)
5. **Implementar ExcalidrawCanvas component**
6. **Criar UI para gerenciar desenhos**
7. **Testar fluxo completo de criar/editar/salvar/carregar**
8. **Preparar para migração futura para tools**

---

## Referências

- [Excalidraw Documentation](https://docs.excalidraw.com/)
- [Excalidraw GitHub](https://github.com/excalidraw/excalidraw)
- [Excalidraw npm package](https://www.npmjs.com/package/@excalidraw/excalidraw)
- [Deco MCP Tools Guide](../README.md)
