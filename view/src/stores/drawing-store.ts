import { create } from "zustand";
import type {
  Drawing,
  DrawingScene,
  DrawingSummary,
} from "../../../shared/contracts/drawings";
import type { Folder } from "../../../shared/contracts/folders";
import { requestJson } from "../lib/api";

type SyncStatus = "idle" | "saving" | "loading" | "error";

interface DrawingStoreState {
  folders: Folder[];
  currentFolderId: string | null;
  drawings: DrawingSummary[];
  currentDrawing: Drawing | null;
  syncStatus: SyncStatus;
  isLoading: boolean;
  error: string | null;
  loadFolders: () => Promise<void>;
  createFolder: (name: string, emoji: string) => Promise<Folder>;
  updateFolder: (id: string, name: string, emoji: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  selectFolder: (id: string) => Promise<void>;
  loadDrawings: () => Promise<void>;
  createDrawing: (name: string) => Promise<Drawing>;
  loadDrawing: (id: string) => Promise<void>;
  saveCurrentDrawing: (scene: DrawingScene) => Promise<Drawing>;
  deleteDrawing: (id: string) => Promise<void>;
  duplicateDrawing: (id: string) => Promise<void>;
  moveDrawing: (drawingId: string, targetFolderId: string) => Promise<void>;
  renameCurrentDrawing: (newName: string) => Promise<void>;
  clearError: () => void;
  initialize: () => Promise<void>;
}

const drawingListPath = (folderId: string) =>
  `/api/drawings?folderId=${encodeURIComponent(folderId)}`;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useDrawingStore = create<DrawingStoreState>((set, get) => ({
  folders: [],
  currentFolderId: null,
  drawings: [],
  currentDrawing: null,
  syncStatus: "idle",
  isLoading: false,
  error: null,

  loadFolders: async () => {
    set({ isLoading: true, error: null });
    try {
      const { folders } = await requestJson<{ folders: Folder[] }>("/api/folders");
      set({ folders, isLoading: false });
      if (!get().currentFolderId) {
        const defaultFolder = folders.find((folder) => folder.isDefault) ?? folders[0];
        if (defaultFolder) await get().selectFolder(defaultFolder.id);
      }
    } catch (error) {
      set({ error: `Erro ao carregar folders: ${errorMessage(error)}`, isLoading: false });
    }
  },

  createFolder: async (name, emoji) => {
    set({ isLoading: true, error: null });
    try {
      const { folder } = await requestJson<{ folder: Folder }>("/api/folders", {
        method: "POST",
        body: JSON.stringify({ name, emoji }),
      });
      await get().loadFolders();
      return folder;
    } catch (error) {
      set({ error: `Erro ao criar folder: ${errorMessage(error)}`, isLoading: false });
      throw error;
    }
  },

  updateFolder: async (id, name, emoji) => {
    set({ isLoading: true, error: null });
    try {
      await requestJson(`/api/folders/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ name, emoji }),
      });
      await get().loadFolders();
    } catch (error) {
      set({ error: `Erro ao atualizar folder: ${errorMessage(error)}`, isLoading: false });
      throw error;
    }
  },

  deleteFolder: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await requestJson(`/api/folders/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (get().currentFolderId === id) {
        set({ currentFolderId: null, drawings: [], currentDrawing: null });
      }
      await get().loadFolders();
    } catch (error) {
      set({ error: `Erro ao deletar folder: ${errorMessage(error)}`, isLoading: false });
      throw error;
    }
  },

  selectFolder: async (id) => {
    set({ currentFolderId: id, isLoading: true, error: null });
    try {
      const { drawings } = await requestJson<{ drawings: DrawingSummary[] }>(drawingListPath(id));
      set({ drawings, isLoading: false });
    } catch (error) {
      set({ error: `Erro ao carregar drawings: ${errorMessage(error)}`, isLoading: false });
    }
  },

  loadDrawings: async () => {
    const { currentFolderId } = get();
    if (!currentFolderId) return;
    await get().selectFolder(currentFolderId);
  },

  createDrawing: async (name) => {
    const { currentFolderId } = get();
    if (!currentFolderId) throw new Error("Nenhum folder selecionado");
    set({ isLoading: true, error: null });
    try {
      const { drawing } = await requestJson<{ drawing: Drawing }>("/api/drawings", {
        method: "POST",
        body: JSON.stringify({ folderId: currentFolderId, name }),
      });
      await get().loadDrawings();
      await get().loadDrawing(drawing.id);
      set({ isLoading: false });
      return drawing;
    } catch (error) {
      set({ error: `Erro ao criar drawing: ${errorMessage(error)}`, isLoading: false });
      throw error;
    }
  },

  loadDrawing: async (id) => {
    set({ syncStatus: "loading", error: null });
    try {
      const { drawing } = await requestJson<{ drawing: Drawing }>(`/api/drawings/${encodeURIComponent(id)}`);
      set({ currentDrawing: drawing, syncStatus: "idle" });
    } catch (error) {
      set({ error: `Erro ao carregar drawing: ${errorMessage(error)}`, syncStatus: "error" });
      throw error;
    }
  },

  saveCurrentDrawing: async (scene) => {
    const currentDrawing = get().currentDrawing;
    if (!currentDrawing) throw new Error("Nenhum drawing aberto");
    set({ syncStatus: "saving", error: null });
    try {
      const { drawing } = await requestJson<{ drawing: Drawing }>(
        `/api/drawings/${encodeURIComponent(currentDrawing.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({ expectedVersion: currentDrawing.version, scene }),
        },
      );
      set((state) => ({
        currentDrawing: drawing,
        drawings: state.drawings.map((item) => item.id === drawing.id ? toSummary(drawing) : item),
        syncStatus: "idle",
      }));
      return drawing;
    } catch (error) {
      set({ error: errorMessage(error), syncStatus: "error" });
      throw error;
    }
  },

  deleteDrawing: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await requestJson(`/api/drawings/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (get().currentDrawing?.id === id) set({ currentDrawing: null });
      await get().loadDrawings();
    } catch (error) {
      set({ error: `Erro ao deletar drawing: ${errorMessage(error)}`, isLoading: false });
      throw error;
    }
  },

  duplicateDrawing: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { drawing } = await requestJson<{ drawing: Drawing }>(`/api/drawings/${encodeURIComponent(id)}`);
      await requestJson("/api/drawings", {
        method: "POST",
        body: JSON.stringify({ folderId: drawing.folderId, name: `${drawing.name} (copy)`, scene: drawing.scene }),
      });
      await get().loadDrawings();
    } catch (error) {
      set({ error: `Erro ao duplicar drawing: ${errorMessage(error)}`, isLoading: false });
      throw error;
    }
  },

  moveDrawing: async (drawingId, targetFolderId) => {
    set({ isLoading: true, error: null });
    try {
      const { drawing } = await requestJson<{ drawing: Drawing }>(`/api/drawings/${encodeURIComponent(drawingId)}`);
      await requestJson(`/api/drawings/${encodeURIComponent(drawingId)}`, {
        method: "PUT",
        body: JSON.stringify({ expectedVersion: drawing.version, folderId: targetFolderId }),
      });
      await get().loadDrawings();
    } catch (error) {
      set({ error: `Erro ao mover drawing: ${errorMessage(error)}`, isLoading: false });
      throw error;
    }
  },

  renameCurrentDrawing: async (name) => {
    const currentDrawing = get().currentDrawing;
    if (!currentDrawing) throw new Error("Nenhum drawing aberto");
    set({ isLoading: true, error: null });
    try {
      const { drawing } = await requestJson<{ drawing: Drawing }>(
        `/api/drawings/${encodeURIComponent(currentDrawing.id)}`,
        { method: "PUT", body: JSON.stringify({ expectedVersion: currentDrawing.version, name }) },
      );
      set((state) => ({ currentDrawing: drawing, drawings: state.drawings.map((item) => item.id === drawing.id ? toSummary(drawing) : item), isLoading: false }));
    } catch (error) {
      set({ error: `Erro ao renomear drawing: ${errorMessage(error)}`, isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  initialize: async () => get().loadFolders(),
}));

function toSummary(drawing: Drawing): DrawingSummary {
  const { scene: _scene, ...summary } = drawing;
  return summary;
}
