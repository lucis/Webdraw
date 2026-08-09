/**
 * Componente principal do canvas Excalidraw
 * 
 * Padrão simples:
 * - onChange → debounce → save via HTTP API
 * - Scene fingerprint tracking para evitar loops
 * - API imperativa única
 */

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDrawingStore } from "../../stores/drawing-store";

export const ExcalidrawCanvas = () => {
  // Estado do store
  const currentDrawing = useDrawingStore((state) => state.currentDrawing);
  const syncStatus = useDrawingStore((state) => state.syncStatus);
  const saveCurrentDrawing = useDrawingStore((state) => state.saveCurrentDrawing);

  const navigate = useNavigate();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSceneRef = useRef<string | null>(null);

  // Preparar initialData do drawing atual
  // ⚠️ IMPORTANTE: Não incluir campos que causam loops no Excalidraw
  const initialData = currentDrawing?.scene;
  
  // Atualizar URL quando desenho carregar
  useEffect(() => {
    if (currentDrawing?.id) {
      navigate({ 
        to: "/app", 
        search: { drawingId: currentDrawing.id },
        replace: true 
      });
    }
  }, [currentDrawing?.id, navigate]);
  
  // Callback quando API do Excalidraw monta
  const onExcalidrawAPIMount = useCallback((api: any) => {
    console.log('🎯 Excalidraw API montada');
    void api;

    // O desenho é carregado pelo initialData do remount, não por updateScene.
    if (currentDrawing) {
      lastSavedSceneRef.current = sceneFingerprint(currentDrawing.scene);
    }
  }, [currentDrawing]);
  
  // Handler de mudanças (auto-save com debounce)
  const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    // Guard 1: Sem drawing
    if (!currentDrawing) {
      return;
    }
    
    // Guard 2: Drawing ainda não foi carregado no canvas.
    if (lastSavedSceneRef.current === null) {
      return;
    }

    const scene = { elements: [...elements], appState, files };
    const fingerprint = sceneFingerprint(scene);
    if (fingerprint === lastSavedSceneRef.current) {
      return;
    }
    
    console.log('✅ onChange - Agendando save:', {
      drawingId: currentDrawing.id,
    });
    
    // Cancelar timeout anterior
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Agendar save com debounce de 2s
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const savedDrawing = await saveCurrentDrawing(scene);
        lastSavedSceneRef.current = sceneFingerprint(savedDrawing.scene);
        
        console.log('✅ Salvo!');
        
      } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        useDrawingStore.setState({ syncStatus: "error" });
      }
    }, 2000);
    
  }, [currentDrawing, saveCurrentDrawing]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  }, []);
  
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
  
  return (
    <div className="h-full w-full relative">
      {/* Indicador de sync simples */}
      <div className="absolute top-4 right-4 z-50">
        {syncStatus === "saving" && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-full text-sm shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            Salvando...
          </div>
        )}
        {syncStatus === "error" && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-sm shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            Erro
          </div>
        )}
      </div>
      
      {/* Canvas Excalidraw */}
      <Excalidraw
        key={currentDrawing.id}
        excalidrawAPI={onExcalidrawAPIMount}
        onChange={handleChange}
        initialData={initialData}
        UIOptions={{
          canvasActions: {
            loadScene: false,
          },
        }}
      />
    </div>
  );
};

function sceneFingerprint(scene: { elements: readonly unknown[]; appState: unknown; files: unknown }): string {
  return JSON.stringify(scene);
}
