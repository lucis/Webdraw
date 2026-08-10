/**
 * Componente principal do canvas Excalidraw
 * 
 * Padrão simples:
 * - onChange → debounce → save via HTTP API
 * - Scene fingerprint tracking para evitar loops
 * - API imperativa única
 */

import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { ListModelsResponse } from "../../../../shared/contracts/models";
import { requestJson } from "../../lib/api";
import { useInterfaceGeneration } from "../../hooks/useInterfaceGeneration";
import { useDrawingStore } from "../../stores/drawing-store";
import { ArtifactEmbed, isArtifactEmbedLink } from "../artifacts/ArtifactEmbed";
import { CanvasCommandContext, type CanvasCommandContextValue } from "./canvas-command-context";

interface ExcalidrawCanvasProps {
  children?: ReactNode;
}

export const ExcalidrawCanvas = ({ children }: ExcalidrawCanvasProps) => {
  // Estado do store
  const currentDrawing = useDrawingStore((state) => state.currentDrawing);
  const syncStatus = useDrawingStore((state) => state.syncStatus);
  const saveCurrentDrawing = useDrawingStore((state) => state.saveCurrentDrawing);

  const navigate = useNavigate();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSceneRef = useRef<string | null>(null);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [apiMountVersion, setApiMountVersion] = useState(0);
  const [hasSelection, setHasSelection] = useState(false);
  const [isArtifactRevisionSelection, setIsArtifactRevisionSelection] = useState(false);
  const [interfaceModels, setInterfaceModels] = useState<ListModelsResponse["models"]>([]);
  const [interfaceModel, setInterfaceModel] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const interfaceGeneration = useInterfaceGeneration({
    api: apiMountVersion > 0 ? excalidrawApiRef.current : null,
    drawing: currentDrawing ? { id: currentDrawing.id, version: currentDrawing.version } : null,
  });

  // Preparar initialData do drawing atual
  // ⚠️ IMPORTANTE: Não incluir campos que causam loops no Excalidraw
  const initialData = currentDrawing && {
    ...currentDrawing.scene,
    appState: {
      ...currentDrawing.scene.appState,
      // Collaborators are transient Excalidraw runtime state. JSON persistence
      // turns Maps into plain objects, so always rehydrate an empty Map.
      collaborators: new Map(),
    },
  };
  
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

  useEffect(() => {
    let disposed = false;
    setInterfaceModels([]);
    setInterfaceModel(null);
    setModelError(null);
    if (!currentDrawing) return;

    void requestJson<ListModelsResponse>("/api/models?purpose=interface")
      .then(({ models }) => {
        if (disposed) return;
        const persistedModel = sessionStorage.getItem("webdraw.interface-model");
        const selectedModel = models.some((model) => model.id === persistedModel)
          ? persistedModel
          : models[0]?.id ?? null;
        setInterfaceModels(models);
        setInterfaceModel(selectedModel);
        if (models.length === 0) setModelError("No compatible interface model is available");
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setModelError(error instanceof Error ? error.message : "Unable to load interface models");
      });

    return () => { disposed = true; };
  }, [currentDrawing?.id]);
  
  // Callback quando API do Excalidraw monta
  const onExcalidrawAPIMount = useCallback((api: ExcalidrawImperativeAPI) => {
    console.log('🎯 Excalidraw API montada');
    excalidrawApiRef.current = api;
    setApiMountVersion((version) => version + 1);
    setHasSelection(hasSelectedElements(api));
    setIsArtifactRevisionSelection(hasExactlyOneSelectedArtifact(api));

    // O desenho é carregado pelo initialData do remount, não por updateScene.
    if (currentDrawing) {
      lastSavedSceneRef.current = sceneFingerprint(currentDrawing.scene);
    }
  }, [currentDrawing]);

  const validateEmbeddable = useCallback((link: string) => isArtifactEmbedLink(link), []);
  const renderEmbeddable = useCallback((element: Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>["renderEmbeddable"]>>[0]) => {
    if (!isArtifactEmbedLink(element.link)) return null;
    return <ArtifactEmbed element={element} />;
  }, []);

  const generateInterface = useCallback(() => {
    if (!interfaceModel || !hasSelection || interfaceGeneration.phase !== "idle") return;
    void interfaceGeneration.generate({ model: interfaceModel }).catch(() => undefined);
  }, [hasSelection, interfaceGeneration, interfaceModel]);

  const setActiveModelId = useCallback((modelId: string) => {
    if (!interfaceModels.some((model) => model.id === modelId)) return;
    setInterfaceModel(modelId);
    sessionStorage.setItem("webdraw.interface-model", modelId);
  }, [interfaceModels]);

  const generationLabel = interfaceGeneration.phase === "idle"
    ? isArtifactRevisionSelection ? "Update interface" : "Generate interface"
    : isArtifactRevisionSelection ? "Updating interface…" : "Generating interface…";
  const canvasCommands = useMemo<CanvasCommandContextValue>(() => ({
    canGenerate: hasSelection && interfaceModel !== null && interfaceGeneration.phase === "idle",
    generationLabel,
    generationPhase: interfaceGeneration.phase,
    models: interfaceModels,
    activeModelId: interfaceModel,
    setActiveModelId,
    generateInterface,
    error: interfaceGeneration.error ?? modelError,
  }), [
    generateInterface,
    generationLabel,
    hasSelection,
    interfaceGeneration.error,
    interfaceGeneration.phase,
    interfaceModel,
    interfaceModels,
    modelError,
    setActiveModelId,
  ]);
  
  // Handler de mudanças (auto-save com debounce)
  const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    setHasSelection(hasSelectedElementsFromAppState(appState));
    setIsArtifactRevisionSelection(hasExactlyOneSelectedArtifactInScene(elements, appState));
    // Guard 1: Sem drawing
    if (!currentDrawing) {
      return;
    }
    
    // Guard 2: Drawing ainda não foi carregado no canvas.
    if (lastSavedSceneRef.current === null) {
      return;
    }

    const { collaborators: _collaborators, ...persistedAppState } = appState as Record<string, unknown>;
    const scene = { elements: [...elements], appState: persistedAppState, files };
    const fingerprint = sceneFingerprint(scene);
    if (fingerprint === lastSavedSceneRef.current) {
      return;
    }
    
    console.log('✅ onChange - Agendando save:', {
      drawingId: currentDrawing.id,
    });

    const drawingId = currentDrawing.id;
    const expectedVersion = currentDrawing.version;
    
    // Cancelar timeout anterior
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Agendar save com debounce de 2s
    saveTimeoutRef.current = setTimeout(async () => {
      const selectedDrawing = useDrawingStore.getState().currentDrawing;
      if (!selectedDrawing || selectedDrawing.id !== drawingId || selectedDrawing.version !== expectedVersion) {
        return;
      }

      try {
        const savedDrawing = await saveCurrentDrawing(scene);
        if (useDrawingStore.getState().currentDrawing?.id !== drawingId) {
          return;
        }
        lastSavedSceneRef.current = sceneFingerprint(savedDrawing.scene);
        
        console.log('✅ Salvo!');
        
      } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        useDrawingStore.setState({ syncStatus: "error" });
      }
    }, 2000);
    
  }, [currentDrawing, saveCurrentDrawing]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, [currentDrawing?.id, currentDrawing?.version]);
  
  // Empty state quando não há drawing
  if (!currentDrawing) {
    return (
      <CanvasCommandContext.Provider value={canvasCommands}>
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
          {children}
        </div>
      </CanvasCommandContext.Provider>
    );
  }
  
  return (
    <CanvasCommandContext.Provider value={canvasCommands}>
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

        {children}
        {/* Canvas Excalidraw */}
        <Excalidraw
          key={currentDrawing.id}
          excalidrawAPI={onExcalidrawAPIMount}
          onChange={handleChange}
          initialData={initialData}
          validateEmbeddable={validateEmbeddable}
          renderEmbeddable={renderEmbeddable}
          UIOptions={{
            canvasActions: {
              loadScene: false,
            },
          }}
        />
      </div>
    </CanvasCommandContext.Provider>
  );
};

function sceneFingerprint(scene: { elements: readonly unknown[]; appState: unknown; files: unknown }): string {
  return JSON.stringify(scene);
}

function hasSelectedElements(api: Pick<ExcalidrawImperativeAPI, "getAppState">): boolean {
  return hasSelectedElementsFromAppState(api.getAppState());
}

function hasSelectedElementsFromAppState(appState: { selectedElementIds?: Record<string, boolean> }): boolean {
  return Object.values(appState.selectedElementIds ?? {}).some(Boolean);
}

function hasExactlyOneSelectedArtifact(api: Pick<ExcalidrawImperativeAPI, "getAppState" | "getSceneElements">): boolean {
  return hasExactlyOneSelectedArtifactInScene(api.getSceneElements(), api.getAppState());
}

function hasExactlyOneSelectedArtifactInScene(
  elements: readonly { id: string; type?: string; link?: string | null }[],
  appState: { selectedElementIds?: Record<string, boolean> },
): boolean {
  const selectedIds = appState.selectedElementIds ?? {};
  return elements.filter((element) => selectedIds[element.id] && element.type === "embeddable" && isArtifactEmbedLink(element.link)).length === 1;
}
