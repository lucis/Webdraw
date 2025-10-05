/**
 * Hook principal para gerenciar o canvas do Excalidraw
 * 
 * Este hook:
 * - Inicializa o ExcalidrawStateManager
 * - Gerencia o ciclo de vida da API do Excalidraw
 * - Coordena operações de carregar/salvar/criar desenhos
 * - Integra com o Zustand store
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { ExcalidrawImperativeAPI } from "../types/drawing";
import { ExcalidrawStateManager } from "../lib/excalidraw-state";
import { useDrawingStore } from "../stores/drawing-store";

export const useExcalidrawCanvas = () => {
  const [isReady, setIsReady] = useState(false);
  const stateManagerRef = useRef<ExcalidrawStateManager>(
    new ExcalidrawStateManager()
  );

  // Acessar ações do store
  const loadDrawing = useDrawingStore((state) => state.loadDrawing);
  const createDrawing = useDrawingStore((state) => state.createDrawing);

  // Callback quando a API do Excalidraw é montada
  const onExcalidrawAPIMount = useCallback((api: ExcalidrawImperativeAPI) => {
    stateManagerRef.current.initialize(api);
    setIsReady(true);
  }, []);

  // Carregar um desenho no canvas
  const handleLoadDrawing = useCallback(async (drawingId: string) => {
    try {
      await stateManagerRef.current.loadDrawing(drawingId);
      // Atualizar store com o desenho carregado
      await loadDrawing(drawingId);
    } catch (error) {
      console.error("Erro ao carregar desenho:", error);
      throw error;
    }
  }, [loadDrawing]);

  // Criar novo desenho
  const handleCreateNewDrawing = useCallback(async (name: string) => {
    try {
      const id = await createDrawing(name);
      // Limpar canvas via state manager
      await stateManagerRef.current.loadDrawing(id);
      return id;
    } catch (error) {
      console.error("Erro ao criar desenho:", error);
      throw error;
    }
  }, [createDrawing]);

  // Salvar manualmente
  const handleSaveDrawing = useCallback(async () => {
    try {
      await stateManagerRef.current.saveCurrentState();
    } catch (error) {
      console.error("Erro ao salvar desenho:", error);
      throw error;
    }
  }, []);

  // Callback quando o desenho muda (para auto-save)
  const handleChange = useCallback(() => {
    // Auto-save ao mudar
    stateManagerRef.current.scheduleAutoSave();
  }, []);

  // Exportar como imagem
  const handleExportImage = useCallback(async (type: "png" | "svg" = "png") => {
    try {
      return await stateManagerRef.current.exportAsImage(type);
    } catch (error) {
      console.error("Erro ao exportar imagem:", error);
      throw error;
    }
  }, []);

  // Exportar como JSON
  const handleExportJSON = useCallback(async () => {
    try {
      return await stateManagerRef.current.exportAsJSON();
    } catch (error) {
      console.error("Erro ao exportar JSON:", error);
      throw error;
    }
  }, []);

  // Obter estatísticas do desenho
  const getStats = useCallback(() => {
    return stateManagerRef.current.getDrawingStats();
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stateManagerRef.current.destroy();
    };
  }, []);

  return {
    isReady,
    onExcalidrawAPIMount,
    loadDrawing: handleLoadDrawing,
    createNewDrawing: handleCreateNewDrawing,
    saveDrawing: handleSaveDrawing,
    handleChange,
    exportImage: handleExportImage,
    exportJSON: handleExportJSON,
    getStats,
    stateManager: stateManagerRef.current,
  };
};
