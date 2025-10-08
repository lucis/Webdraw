/**
 * Hooks customizados para gerenciamento de Folders e Drawings
 * 
 * Estes hooks são wrappers do Zustand store que fornecem
 * uma API mais conveniente e específica para componentes.
 */

import { useDrawingStore } from "../stores/drawing-store";
import { useEffect } from "react";

/**
 * Hook para gerenciamento de folders
 */
export const useFolders = () => {
  const folders = useDrawingStore((state) => state.folders);
  const currentFolderId = useDrawingStore((state) => state.currentFolderId);
  const isLoading = useDrawingStore((state) => state.isLoading);
  const error = useDrawingStore((state) => state.error);
  
  const loadFolders = useDrawingStore((state) => state.loadFolders);
  const createFolder = useDrawingStore((state) => state.createFolder);
  const updateFolder = useDrawingStore((state) => state.updateFolder);
  const deleteFolder = useDrawingStore((state) => state.deleteFolder);
  const selectFolder = useDrawingStore((state) => state.selectFolder);
  
  const currentFolder = folders.find((f) => f.id === currentFolderId);
  
  return {
    folders,
    currentFolder,
    currentFolderId,
    isLoading,
    error,
    loadFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    selectFolder,
  };
};

/**
 * Hook para gerenciamento de drawings
 */
export const useDrawings = () => {
  const drawings = useDrawingStore((state) => state.drawings);
  const currentDrawing = useDrawingStore((state) => state.currentDrawing);
  const isLoading = useDrawingStore((state) => state.isLoading);
  const error = useDrawingStore((state) => state.error);
  const syncStatus = useDrawingStore((state) => state.syncStatus);
  
  const loadDrawings = useDrawingStore((state) => state.loadDrawings);
  const createDrawing = useDrawingStore((state) => state.createDrawing);
  const loadDrawing = useDrawingStore((state) => state.loadDrawing);
  const deleteDrawing = useDrawingStore((state) => state.deleteDrawing);
  const duplicateDrawing = useDrawingStore((state) => state.duplicateDrawing);
  const moveDrawing = useDrawingStore((state) => state.moveDrawing);
  const renameCurrentDrawing = useDrawingStore((state) => state.renameCurrentDrawing);
  
  return {
    drawings,
    currentDrawing,
    isLoading,
    error,
    syncStatus,
    loadDrawings,
    createDrawing,
    loadDrawing,
    deleteDrawing,
    duplicateDrawing,
    moveDrawing,
    renameCurrentDrawing,
  };
};


/**
 * Hook para branch management
 */
export const useBranch = () => {
  const branch = useDrawingStore((state) => state.branch);
  const switchBranch = useDrawingStore((state) => state.switchBranch);
  
  return {
    branch,
    switchBranch,
  };
};

/**
 * Hook para inicializar o store
 * Deve ser usado no componente raiz do app
 */
export const useInitializeDrawingStore = () => {
  const initialize = useDrawingStore((state) => state.initialize);
  const isInitialized = useDrawingStore((state) => state.folders.length > 0);
  
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);
  
  return { isInitialized };
};

/**
 * Hook que retorna o drawer completo (útil para canvas)
 */
export const useCurrentDrawing = () => {
  const currentDrawing = useDrawingStore((state) => state.currentDrawing);
  const renameCurrentDrawing = useDrawingStore((state) => state.renameCurrentDrawing);
  const syncStatus = useDrawingStore((state) => state.syncStatus);
  
  return {
    currentDrawing,
    renameCurrentDrawing,
    syncStatus,
    isLoading: syncStatus === "loading",
    isSaving: syncStatus === "saving",
    hasDrawing: currentDrawing !== null,
  };
};


