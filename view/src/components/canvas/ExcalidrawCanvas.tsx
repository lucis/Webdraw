/**
 * Componente principal do canvas Excalidraw
 * 
 * Integrado com Zustand store para auto-save e sincronização
 */

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCurrentDrawing, useAutoSave } from "../../hooks/useDrawingManagement";

export const ExcalidrawCanvas = () => {
  const { currentDrawing, isLoading, syncStatus } = useCurrentDrawing();
  const { scheduleAutoSave } = useAutoSave();
  const navigate = useNavigate();
  const apiRef = useRef<any>(null);
  const isInitialLoadRef = useRef(true);
  
  // Atualizar URL quando desenho carregar
  useEffect(() => {
    if (currentDrawing?.id) {
      console.log('🔗 Atualizando URL para desenho:', currentDrawing.name, currentDrawing.id);
      navigate({ 
        to: "/app", 
        search: { drawingId: currentDrawing.id },
        replace: true 
      });
    }
  }, [currentDrawing?.id, navigate]);
  
  // Callback quando API do Excalidraw monta
  const onExcalidrawAPIMount = useCallback((api: any) => {
    console.log('🎯 Excalidraw API montada:', !!api);
    apiRef.current = api;
    
    // Debug: verificar se API tem métodos esperados
    if (api) {
      console.log('🔍 API methods available:', {
        getSceneElements: typeof api.getSceneElements,
        getAppState: typeof api.getAppState,
        getFiles: typeof api.getFiles,
        updateScene: typeof api.updateScene
      });
    }
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
    console.log('🔥 handleChange chamado:', {
      hasAPI: !!apiRef.current,
      hasDrawing: !!currentDrawing,
      isInitialLoad: isInitialLoadRef.current,
      drawingId: currentDrawing?.id
    });
    
    if (!apiRef.current) {
      console.log('❌ Sem API ref');
      return;
    }
    
    if (!currentDrawing) {
      console.log('❌ Sem currentDrawing');
      return;
    }
    
    if (isInitialLoadRef.current) {
      console.log('❌ Ainda carregando inicial, ignorando...');
      return;
    }
    
    const elements = apiRef.current.getSceneElements();
    const appState = apiRef.current.getAppState();
    const files = apiRef.current.getFiles();
    
    console.log('🎨 Canvas mudou - dados válidos:', {
      drawingId: currentDrawing.id,
      elementCount: elements.length,
      hasFiles: Object.keys(files).length > 0,
      scheduleAutoSaveExists: typeof scheduleAutoSave === 'function'
    });
    
    // Agendar auto-save com debounce via store Zustand
    if (typeof scheduleAutoSave === 'function') {
      console.log('📝 Chamando scheduleAutoSave...');
      scheduleAutoSave(elements, appState, files);
    } else {
      console.error('❌ scheduleAutoSave não é uma função:', typeof scheduleAutoSave);
    }
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
  
  // Função de teste manual
  const testarConexao = useCallback(() => {
    console.log('🧪 TESTE MANUAL DE CONEXÃO');
    console.log('API ref:', !!apiRef.current);
    console.log('Current drawing:', !!currentDrawing);
    console.log('scheduleAutoSave:', typeof scheduleAutoSave);
    
    if (apiRef.current && currentDrawing) {
      console.log('🧪 Testando manualmente...');
      const elements = apiRef.current.getSceneElements();
      const appState = apiRef.current.getAppState();
      const files = apiRef.current.getFiles();
      
      console.log('🧪 Dados obtidos:', {
        elementCount: elements?.length,
        hasAppState: !!appState,
        hasFiles: !!files
      });
      
      if (typeof scheduleAutoSave === 'function') {
        console.log('🧪 Chamando scheduleAutoSave manualmente...');
        scheduleAutoSave(elements || [], appState || {}, files || {});
      }
    }
  }, [currentDrawing, scheduleAutoSave]);
  
  return (
    <div className="h-full w-full relative">
      {/* Debug controls */}
      <div className="absolute top-4 left-4 z-50 space-y-2">
        <button
          onClick={testarConexao}
          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-sm font-mono"
        >
          🧪 Testar Conexão
        </button>
      </div>
      
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