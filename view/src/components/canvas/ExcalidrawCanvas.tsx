/**
 * Componente principal do canvas Excalidraw
 * 
 * Integrado com Zustand store para auto-save e sincronização
 */

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef } from "react";
import { useCurrentDrawing, useAutoSave } from "../../hooks/useDrawingManagement";

export const ExcalidrawCanvas = () => {
  const { currentDrawing, isLoading } = useCurrentDrawing();
  const { scheduleAutoSave, syncStatus } = useAutoSave();
  const apiRef = useRef<any>(null);
  const isInitialLoadRef = useRef(true);
  
  // Callback quando API do Excalidraw monta
  const onExcalidrawAPIMount = useCallback((api: any) => {
    apiRef.current = api;
  }, []);
  
  // Carregar drawing no canvas quando mudar
  useEffect(() => {
    if (!apiRef.current || !currentDrawing) return;
    
    // Marcar que está carregando para não triggerar auto-save
    isInitialLoadRef.current = true;
    
    // Carregar elementos no canvas
    apiRef.current.updateScene({
      elements: currentDrawing.elements || [],
      appState: currentDrawing.appState || {},
    });
    
    // Carregar arquivos (imagens)
    if (currentDrawing.files && Object.keys(currentDrawing.files).length > 0) {
      apiRef.current.addFiles(Object.values(currentDrawing.files));
    }
    
    // Liberar auto-save após um pequeno delay
    setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 500);
  }, [currentDrawing?.id]); // Apenas quando o ID mudar
  
  // Handler de mudanças (auto-save)
  const handleChange = useCallback(() => {
    if (!apiRef.current || !currentDrawing || isInitialLoadRef.current) return;
    
    const elements = apiRef.current.getSceneElements();
    const appState = apiRef.current.getAppState();
    const files = apiRef.current.getFiles();
    
    // Agendar auto-save com debounce
    scheduleAutoSave(elements, appState, files);
  }, [currentDrawing, scheduleAutoSave]);
  
  // Empty state quando não há drawing
  if (!currentDrawing) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-slate-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          <div className="text-lg text-slate-400 mb-2">
            Nenhum desenho selecionado
          </div>
          <div className="text-sm text-slate-600">
            Selecione ou crie um desenho na sidebar
          </div>
        </div>
      </div>
    );
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-slate-400">Carregando desenho...</div>
      </div>
    );
  }
  
  return (
    <div className="h-full w-full relative">
      {/* Indicador de sync */}
      {syncStatus === "saving" && (
        <div className="absolute top-4 right-4 z-50 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Salvando...
        </div>
      )}
      
      {syncStatus === "error" && (
        <div className="absolute top-4 right-4 z-50 bg-red-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
          Erro ao salvar
        </div>
      )}
      
      {/* Canvas Excalidraw */}
      <Excalidraw
        excalidrawAPI={onExcalidrawAPIMount}
        onChange={handleChange}
        initialData={{
          appState: {
            viewBackgroundColor: "#ffffff",
            theme: "light",
          },
        }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
          },
        }}
      />
    </div>
  );
};