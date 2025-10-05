/**
 * Rota de teste do Excalidraw
 * Mostra integração funcionando + debugger JSON
 */

import { createRoute, type RootRoute } from "@tanstack/react-router";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css"; // ⚡ IMPORTANTE: CSS do Excalidraw
import { useState, useCallback, useRef } from "react";
import { Button } from "../components/ui/button";

function ExcalidrawTestPage() {
  const [api, setApi] = useState<any>(null);
  const [elements, setElements] = useState<any[]>([]);
  const [appState, setAppState] = useState<any>(null);
  const [files, setFiles] = useState<any>({});

  // Callback quando a API do Excalidraw é montada
  const onExcalidrawAPIMount = useCallback((excalidrawAPI: any) => {
    console.log("✅ Excalidraw API mounted:", excalidrawAPI);
    setApi(excalidrawAPI);

    // Listener para mudanças
    excalidrawAPI.onChange((elements: any, appState: any, files: any) => {
      console.log("📝 Scene changed:", { elements, appState, files });
      setElements(elements);
      setAppState(appState);
      setFiles(files);
    });
  }, []);

  // Adicionar retângulo de teste
  const handleAddRectangle = useCallback(() => {
    if (!api) {
      alert("API do Excalidraw ainda não está pronta!");
      return;
    }

    try {
      const currentElements = api.getSceneElements();
      console.log("Current elements:", currentElements);

      // Criar novo retângulo usando o padrão correto
      const newRectangle = {
        type: "rectangle",
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100,
        width: 200,
        height: 100,
        strokeColor: "#1971c2",
        backgroundColor: "#a5d8ff",
        fillStyle: "hachure",
        strokeWidth: 2,
        roughness: 1,
        opacity: 100,
        angle: 0,
        seed: Math.floor(Math.random() * 1000000),
      };

      console.log("Adding rectangle:", newRectangle);

      // Atualizar cena
      api.updateScene({
        elements: [...currentElements, newRectangle],
        appState: {
          ...api.getAppState(),
          selectedElementIds: {},
        },
      });

      console.log("✅ Rectangle added successfully!");
    } catch (error) {
      console.error("❌ Error adding rectangle:", error);
      alert(`Erro ao adicionar retângulo: ${error}`);
    }
  }, [api]);

  // Limpar canvas
  const handleClear = useCallback(() => {
    if (!api) return;
    
    api.updateScene({
      elements: [],
    });
  }, [api]);

  // Exportar como JSON
  const handleExportJSON = useCallback(() => {
    if (!api) return;

    const data = {
      type: "excalidraw",
      version: 2,
      source: "webdraw-test",
      elements: api.getSceneElements(),
      appState: api.getAppState(),
      files: api.getFiles(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `excalidraw-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [api]);

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Canvas Principal */}
      <div className="flex-1 relative">
        <Excalidraw
          excalidrawAPI={onExcalidrawAPIMount}
          initialData={{
            appState: {
              viewBackgroundColor: "#ffffff",
              currentItemFontFamily: 1,
            },
            elements: [],
            collaborators: new Map(), // ⚡ IMPORTANTE: Deve ser um Map
          }}
        />

        {/* Botões de Ação Flutuantes */}
        <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
          <Button
            onClick={handleAddRectangle}
            disabled={!api}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg"
            size="sm"
          >
            🎨 Teste: Add Rectangle
          </Button>

          <Button
            onClick={handleClear}
            disabled={!api}
            variant="destructive"
            size="sm"
            className="shadow-lg"
          >
            🗑️ Limpar Canvas
          </Button>

          <Button
            onClick={handleExportJSON}
            disabled={!api}
            variant="outline"
            size="sm"
            className="bg-white shadow-lg"
          >
            💾 Exportar JSON
          </Button>
        </div>

        {/* Status da API */}
        <div className="absolute top-4 right-[320px] z-50">
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium shadow-lg ${
              api
                ? "bg-green-500 text-white"
                : "bg-yellow-500 text-black"
            }`}
          >
            {api ? "✅ API Pronta" : "⏳ Aguardando API..."}
          </div>
        </div>
      </div>

      {/* Debugger Sidebar */}
      <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-lg">
            🐛 Debugger
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Estado atual do Excalidraw
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stats */}
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <h3 className="text-white font-medium text-sm mb-2">
              📊 Estatísticas
            </h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Elementos:</span>
                <span className="font-mono">{elements.length}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Arquivos:</span>
                <span className="font-mono">{Object.keys(files).length}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Zoom:</span>
                <span className="font-mono">
                  {appState?.zoom?.value?.toFixed(2) || "1.00"}
                </span>
              </div>
            </div>
          </div>

          {/* Elements JSON */}
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <h3 className="text-white font-medium text-sm mb-2">
              📦 Elements ({elements.length})
            </h3>
            <pre className="text-xs text-slate-300 overflow-x-auto font-mono bg-slate-950 p-2 rounded max-h-96 overflow-y-auto">
              {JSON.stringify(elements, null, 2)}
            </pre>
          </div>

          {/* AppState JSON */}
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <h3 className="text-white font-medium text-sm mb-2">
              ⚙️ AppState
            </h3>
            <pre className="text-xs text-slate-300 overflow-x-auto font-mono bg-slate-950 p-2 rounded max-h-64 overflow-y-auto">
              {JSON.stringify(
                appState
                  ? {
                      zoom: appState.zoom,
                      offsetLeft: appState.offsetLeft,
                      offsetTop: appState.offsetTop,
                      selectedElementIds: appState.selectedElementIds,
                      zenModeEnabled: appState.zenModeEnabled,
                      activeTool: appState.activeTool,
                    }
                  : null,
                null,
                2
              )}
            </pre>
          </div>

          {/* Files JSON */}
          {Object.keys(files).length > 0 && (
            <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
              <h3 className="text-white font-medium text-sm mb-2">
                🖼️ Files
              </h3>
              <pre className="text-xs text-slate-300 overflow-x-auto font-mono bg-slate-950 p-2 rounded max-h-48 overflow-y-auto">
                {JSON.stringify(
                  Object.keys(files).reduce(
                    (acc: any, key: string) => {
                      acc[key] = {
                        mimeType: files[key].mimeType,
                        created: files[key].created,
                      };
                      return acc;
                    },
                    {}
                  ),
                  null,
                  2
                )}
              </pre>
            </div>
          )}

          {/* Dicas */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
            <h3 className="text-blue-300 font-medium text-sm mb-2">
              💡 Dicas
            </h3>
            <ul className="text-xs text-blue-200 space-y-1">
              <li>• Use as ferramentas do Excalidraw normalmente</li>
              <li>• Clique em "Add Rectangle" para testar a API</li>
              <li>• O JSON atualiza automaticamente</li>
              <li>• Console do navegador tem logs detalhados</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/excalidraw",
    component: ExcalidrawTestPage,
    getParentRoute: () => parentRoute,
  });
