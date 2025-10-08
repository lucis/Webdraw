/**
 * Componente principal do canvas Excalidraw
 * 
 * Padrão simples:
 * - onChange → debounce → save via RPC
 * - Scene version tracking para evitar loops
 * - API imperativa única
 */

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDrawingStore } from "../../stores/drawing-store";
import { client } from "../../lib/rpc";

export const ExcalidrawCanvas = () => {
  // Estado do store
  const currentDrawing = useDrawingStore((state) => state.currentDrawing);
  const branch = useDrawingStore((state) => state.branch);
  const syncStatus = useDrawingStore((state) => state.syncStatus);
  
  const navigate = useNavigate();
  const apiRef = useRef<any>(null);
  const isInitialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedVersionRef = useRef(-1);
  
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
    apiRef.current = api;
  }, []);
  
  // Carregar drawing no canvas quando mudar
  useEffect(() => {
    if (!apiRef.current || !currentDrawing) return;
    
    console.log('📂 Carregando drawing no canvas:', currentDrawing.name);
    
    // Marcar que está carregando
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
    
    // Resetar version tracking
    lastSavedVersionRef.current = -1;
    
    // Liberar auto-save após delay
    setTimeout(() => {
      isInitialLoadRef.current = false;
      console.log('✅ Drawing carregado, auto-save habilitado');
    }, 500);
  }, [currentDrawing?.id]);
  
  // Handler de mudanças (auto-save com debounce)
  const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    // Guards
    if (!currentDrawing) {
      console.log('⏭️ Sem currentDrawing, ignorando onChange');
      return;
    }
    
    if (isInitialLoadRef.current) {
      console.log('⏭️ Carregamento inicial, ignorando onChange');
      return;
    }
    
    // Calcular scene version simples (número de elementos)
    const currentVersion = elements.length;
    
    // Se versão não mudou, pular
    if (currentVersion === lastSavedVersionRef.current) {
      return;
    }
    
    console.log('🎨 Canvas mudou:', {
      drawingId: currentDrawing.id,
      elementCount: elements.length,
      lastSaved: lastSavedVersionRef.current
    });
    
    // Cancelar timeout anterior
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Agendar save com debounce de 2s
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        useDrawingStore.setState({ syncStatus: "saving" });
        
        console.log('💾 Salvando drawing...');
        
        // Salvar via RPC
        await client.UPDATE_DRAWING({
          drawingId: currentDrawing.id,
          elements: [...elements], // Convert readonly to mutable
          appState,
          files,
          branch,
        });
        
        // Atualizar version tracking
        lastSavedVersionRef.current = currentVersion;
        
        // Atualizar metadata no store
        useDrawingStore.setState((state) => ({
          drawings: state.drawings.map(d => 
            d.id === currentDrawing.id 
              ? { ...d, elementCount: elements.length, updatedAt: Date.now() }
              : d
          ),
          syncStatus: "idle"
        }));
        
        console.log('✅ Drawing salvo com sucesso');
        
      } catch (error) {
        console.error('❌ Erro ao salvar drawing:', error);
        useDrawingStore.setState({ syncStatus: "error" });
      }
    }, 2000);
    
  }, [currentDrawing, branch]);
  
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
