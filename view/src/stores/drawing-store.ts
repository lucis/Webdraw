/**
 * Zustand Store para gerenciamento de Folders e Drawings
 * 
 * Este store gerencia todo o estado global da aplicação Webdraw:
 * - Folders e drawings
 * - Desenho e folder atuais
 * - Branch atual
 * - Status de sincronização
 * - Auto-save
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { client } from "../lib/rpc";

/**
 * Tipos
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

type SyncStatus = "idle" | "saving" | "loading" | "error";

interface DrawingStoreState {
  // ==================== STATE ====================
  
  /** Lista de folders */
  folders: Folder[];
  
  /** Folder atualmente selecionado */
  currentFolderId: string | null;
  
  /** Lista de drawings do folder atual */
  drawings: DrawingMetadata[];
  
  /** Drawing atualmente aberto no canvas */
  currentDrawing: Drawing | null;
  
  /** Branch atual */
  branch: string;
  
  /** Status de sincronização */
  syncStatus: SyncStatus;
  
  /** Se está carregando */
  isLoading: boolean;
  
  /** Mensagem de erro */
  error: string | null;
  
  /** Timeout do auto-save */
  autoSaveTimeout: NodeJS.Timeout | null;
  
  /** Último hash dos dados salvos (para prevenir saves desnecessários) */
  lastSaveHash: string | null;
  
  // ==================== FOLDER ACTIONS ====================
  
  /**
   * Carrega todos os folders da branch atual
   */
  loadFolders: () => Promise<void>;
  
  /**
   * Cria um novo folder
   */
  createFolder: (name: string, emoji: string) => Promise<Folder>;
  
  /**
   * Atualiza um folder existente
   */
  updateFolder: (id: string, name: string, emoji: string) => Promise<void>;
  
  /**
   * Deleta um folder
   */
  deleteFolder: (id: string) => Promise<void>;
  
  /**
   * Seleciona um folder (carrega seus drawings)
   */
  selectFolder: (id: string) => Promise<void>;
  
  // ==================== DRAWING ACTIONS ====================
  
  /**
   * Carrega drawings do folder atual
   */
  loadDrawings: () => Promise<void>;
  
  /**
   * Cria um novo drawing
   */
  createDrawing: (name: string, description?: string) => Promise<Drawing>;
  
  /**
   * Carrega um drawing no canvas
   */
  loadDrawing: (id: string) => Promise<void>;
  
  /**
   * Salva o drawing atual (elementos + appState + files)
   */
  saveCurrentDrawing: (
    elements: any[],
    appState: Record<string, any>,
    files: Record<string, any>
  ) => Promise<void>;
  
  /**
   * Deleta um drawing
   */
  deleteDrawing: (id: string) => Promise<void>;
  
  /**
   * Duplica um drawing
   */
  duplicateDrawing: (id: string) => Promise<void>;
  
  /**
   * Move drawing para outro folder
   */
  moveDrawing: (drawingId: string, targetFolderId: string) => Promise<void>;
  
  /**
   * Renomeia o drawing atual
   */
  renameCurrentDrawing: (newName: string) => Promise<void>;
  
  // ==================== BRANCH ACTIONS ====================
  
  /**
   * Troca de branch
   */
  switchBranch: (newBranch: string) => Promise<void>;
  
  // ==================== AUTO-SAVE ====================
  
  /**
   * Agenda auto-save com debounce
   */
  scheduleAutoSave: (
    elements: any[],
    appState: Record<string, any>,
    files: Record<string, any>
  ) => void;
  
  /**
   * Força save imediato
   */
  forceSave: () => Promise<void>;
  
  /**
   * Cancela auto-save pendente
   */
  cancelAutoSave: () => void;
  
  // ==================== UTILITY ====================
  
  /**
   * Limpa erro
   */
  clearError: () => void;
  
  /**
   * Inicializa o store (carrega folders, etc)
   */
  initialize: () => Promise<void>;
}

/**
 * Hook do Zustand Store
 */
export const useDrawingStore = create<DrawingStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // ==================== INITIAL STATE ====================
        
        folders: [],
        currentFolderId: null,
        drawings: [],
        currentDrawing: null,
        branch: "main",
        syncStatus: "idle",
        isLoading: false,
        error: null,
        autoSaveTimeout: null,
        lastSaveHash: null,
        
        // ==================== FOLDER ACTIONS ====================
        
        loadFolders: async () => {
          set({ isLoading: true, error: null });
          
          try {
            const result = await client.LIST_FOLDERS({ branch: get().branch });
            
            set({
              folders: result.folders || [],
              isLoading: false,
            });
            
            // Se não há folder selecionado, selecionar o default
            if (!get().currentFolderId && result.folders.length > 0) {
              const defaultFolder = result.folders.find((f: Folder) => f.isDefault);
              if (defaultFolder) {
                await get().selectFolder(defaultFolder.id);
              }
            }
          } catch (error) {
            set({
              error: `Erro ao carregar folders: ${error}`,
              isLoading: false,
            });
          }
        },
        
        createFolder: async (name: string, emoji: string) => {
          set({ isLoading: true, error: null });
          
          try {
            const result = await client.CREATE_FOLDER({
              name,
              emoji,
              branch: get().branch,
            });
            
            // Recarregar folders
            await get().loadFolders();
            
            set({ isLoading: false });
            
            return result.folder;
          } catch (error) {
            set({
              error: `Erro ao criar folder: ${error}`,
              isLoading: false,
            });
            throw error;
          }
        },
        
        updateFolder: async (id: string, name: string, emoji: string) => {
          set({ isLoading: true, error: null });
          
          try {
            await client.UPDATE_FOLDER({
              folderId: id,
              name,
              emoji,
              branch: get().branch,
            });
            
            // Recarregar folders
            await get().loadFolders();
            
            set({ isLoading: false });
          } catch (error) {
            set({
              error: `Erro ao atualizar folder: ${error}`,
              isLoading: false,
            });
            throw error;
          }
        },
        
        deleteFolder: async (id: string) => {
          set({ isLoading: true, error: null });
          
          try {
            await client.DELETE_FOLDER({
              folderId: id,
              branch: get().branch,
            });
            
            // Se era o folder atual, limpar
            if (get().currentFolderId === id) {
              set({
                currentFolderId: null,
                drawings: [],
                currentDrawing: null,
              });
            }
            
            // Recarregar folders
            await get().loadFolders();
            
            set({ isLoading: false });
          } catch (error) {
            set({
              error: `Erro ao deletar folder: ${error}`,
              isLoading: false,
            });
            throw error;
          }
        },
        
        selectFolder: async (id: string) => {
          set({
            currentFolderId: id,
            isLoading: true,
            error: null,
          });
          
          try {
            // Carregar drawings do folder
            const result = await client.LIST_DRAWINGS({
              folderId: id,
              branch: get().branch,
            });
            
            set({
              drawings: result.drawings || [],
              isLoading: false,
            });
          } catch (error) {
            set({
              error: `Erro ao carregar drawings: ${error}`,
              isLoading: false,
            });
          }
        },
        
        // ==================== DRAWING ACTIONS ====================
        
        loadDrawings: async () => {
          const { currentFolderId, branch } = get();
          
          if (!currentFolderId) return;
          
          set({ isLoading: true, error: null });
          
          try {
            const result = await client.LIST_DRAWINGS({
              folderId: currentFolderId,
              branch,
            });
            
            set({
              drawings: result.drawings || [],
              isLoading: false,
            });
          } catch (error) {
            set({
              error: `Erro ao carregar drawings: ${error}`,
              isLoading: false,
            });
          }
        },
        
        createDrawing: async (name: string, description?: string) => {
          const { currentFolderId, branch } = get();
          
          if (!currentFolderId) {
            throw new Error("Nenhum folder selecionado");
          }
          
          set({ isLoading: true, error: null });
          
          try {
            const result = await client.CREATE_DRAWING({
              name,
              description,
              folderId: currentFolderId,
              branch,
            });
            
            // Recarregar drawings
            await get().loadDrawings();
            
            // Carregar o novo drawing no canvas
            await get().loadDrawing(result.drawing.id);
            
            set({ isLoading: false });
            
            return result.drawing;
          } catch (error) {
            set({
              error: `Erro ao criar drawing: ${error}`,
              isLoading: false,
            });
            throw error;
          }
        },
        
        loadDrawing: async (id: string) => {
          set({ syncStatus: "loading", error: null });
          
          try {
            const result = await client.GET_DRAWING({
              drawingId: id,
              branch: get().branch,
            });
            
            if (!result.drawing) {
              throw new Error("Drawing não encontrado");
            }
            
            set({
              currentDrawing: result.drawing,
              syncStatus: "idle",
              lastSaveHash: null, // Reset hash ao carregar novo drawing
            });
          } catch (error) {
            set({
              error: `Erro ao carregar drawing: ${error}`,
              syncStatus: "error",
            });
            throw error;
          }
        },
        
        saveCurrentDrawing: async (
          elements: any[],
          appState: Record<string, any>,
          files: Record<string, any>
        ) => {
          const { currentDrawing, branch } = get();
          
          if (!currentDrawing) {
            throw new Error("Nenhum drawing aberto");
          }
          
          // Criar hash dos dados para comparação
          const currentHash = JSON.stringify({ elements, appState });
          
          // Se dados não mudaram, não salvar
          if (currentHash === get().lastSaveHash) {
            return;
          }
          
          set({ syncStatus: "saving" });
          
          try {
            await client.UPDATE_DRAWING({
              drawingId: currentDrawing.id,
              elements,
              appState,
              files,
              branch,
            });
            
            set({
              syncStatus: "idle",
              lastSaveHash: currentHash,
            });
            
            // Recarregar lista de drawings para atualizar metadados
            await get().loadDrawings();
          } catch (error) {
            set({
              error: `Erro ao salvar drawing: ${error}`,
              syncStatus: "error",
            });
            throw error;
          }
        },
        
        deleteDrawing: async (id: string) => {
          set({ isLoading: true, error: null });
          
          try {
            await client.DELETE_DRAWING({
              drawingId: id,
              branch: get().branch,
            });
            
            // Se era o drawing atual, limpar
            if (get().currentDrawing?.id === id) {
              set({ currentDrawing: null });
            }
            
            // Recarregar drawings
            await get().loadDrawings();
            
            set({ isLoading: false });
          } catch (error) {
            set({
              error: `Erro ao deletar drawing: ${error}`,
              isLoading: false,
            });
            throw error;
          }
        },
        
        duplicateDrawing: async (id: string) => {
          set({ isLoading: true, error: null });
          
          try {
            await client.DUPLICATE_DRAWING({
              drawingId: id,
              branch: get().branch,
            });
            
            // Recarregar drawings
            await get().loadDrawings();
            
            set({ isLoading: false });
          } catch (error) {
            set({
              error: `Erro ao duplicar drawing: ${error}`,
              isLoading: false,
            });
            throw error;
          }
        },
        
        moveDrawing: async (drawingId: string, targetFolderId: string) => {
          set({ isLoading: true, error: null });
          
          try {
            await client.MOVE_DRAWING_TO_FOLDER({
              drawingId,
              targetFolderId,
              branch: get().branch,
            });
            
            // Recarregar drawings do folder atual
            await get().loadDrawings();
            
            set({ isLoading: false });
          } catch (error) {
            set({
              error: `Erro ao mover drawing: ${error}`,
              isLoading: false,
            });
            throw error;
          }
        },
        
        renameCurrentDrawing: async (newName: string) => {
          const { currentDrawing, branch } = get();
          
          if (!currentDrawing) {
            throw new Error("Nenhum drawing aberto");
          }
          
          set({ isLoading: true, error: null });
          
          try {
            await client.UPDATE_DRAWING({
              drawingId: currentDrawing.id,
              name: newName,
              branch,
            });
            
            // Atualizar drawing atual
            set({
              currentDrawing: {
                ...currentDrawing,
                name: newName,
              },
              isLoading: false,
            });
            
            // Recarregar lista
            await get().loadDrawings();
          } catch (error) {
            set({
              error: `Erro ao renomear drawing: ${error}`,
              isLoading: false,
            });
            throw error;
          }
        },
        
        // ==================== BRANCH ACTIONS ====================
        
        switchBranch: async (newBranch: string) => {
          set({
            branch: newBranch,
            folders: [],
            drawings: [],
            currentFolderId: null,
            currentDrawing: null,
          });
          
          // Recarregar tudo
          await get().initialize();
        },
        
        // ==================== AUTO-SAVE ====================
        
        scheduleAutoSave: (
          elements: any[],
          appState: Record<string, any>,
          files: Record<string, any>
        ) => {
          // Cancelar timeout anterior
          const timeout = get().autoSaveTimeout;
          if (timeout) {
            clearTimeout(timeout);
          }
          
          // Agendar novo save
          const newTimeout = setTimeout(async () => {
            try {
              await get().saveCurrentDrawing(elements, appState, files);
            } catch (error) {
              console.error("Auto-save falhou:", error);
            }
          }, 2000); // 2 segundos de debounce
          
          set({ autoSaveTimeout: newTimeout });
        },
        
        forceSave: async () => {
          // Cancelar auto-save pendente
          get().cancelAutoSave();
          
          // Não temos os dados aqui, então apenas marcamos para forçar no próximo onChange
          set({ lastSaveHash: null });
        },
        
        cancelAutoSave: () => {
          const timeout = get().autoSaveTimeout;
          if (timeout) {
            clearTimeout(timeout);
            set({ autoSaveTimeout: null });
          }
        },
        
        // ==================== UTILITY ====================
        
        clearError: () => {
          set({ error: null });
        },
        
        initialize: async () => {
          // Garantir folder default
          try {
            await client.ENSURE_DEFAULT_FOLDER({ branch: get().branch });
          } catch (error) {
            console.error("Erro ao garantir folder default:", error);
          }
          
          // Carregar folders
          await get().loadFolders();
        },
      }),
      {
        name: "drawing-storage",
        // Persistir apenas branch atual
        partialize: (state) => ({
          branch: state.branch,
        }),
      }
    ),
    { name: "DrawingStore" }
  )
);