/**
 * Rota principal do canvas de desenho
 */

import { createRoute, type RootRoute } from "@tanstack/react-router";
import { ExcalidrawCanvas } from "../components/canvas/ExcalidrawCanvas";
import { useDrawingStore } from "../stores/drawing-store";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";

function CanvasPage() {
  const [newDrawingName, setNewDrawingName] = useState("");
  const [showNewDrawingDialog, setShowNewDrawingDialog] = useState(false);

  const {
    drawings,
    currentDrawingId,
    isLoading,
    error,
    loadDrawings,
    loadDrawing,
    createDrawing,
    deleteDrawing,
  } = useDrawingStore();

  // Carregar lista de desenhos ao montar
  useEffect(() => {
    loadDrawings();
  }, [loadDrawings]);

  // Criar primeiro desenho se não houver nenhum
  useEffect(() => {
    if (!isLoading && drawings.length === 0 && !currentDrawingId) {
      createDrawing("Meu Primeiro Desenho");
    }
  }, [isLoading, drawings, currentDrawingId, createDrawing]);

  const handleCreateNewDrawing = async () => {
    if (!newDrawingName.trim()) return;
    
    try {
      await createDrawing(newDrawingName);
      setNewDrawingName("");
      setShowNewDrawingDialog(false);
    } catch (error) {
      console.error("Erro ao criar desenho:", error);
    }
  };

  const handleSelectDrawing = (id: string) => {
    loadDrawing(id);
  };

  const handleDeleteDrawing = async (id: string) => {
    if (confirm("Tem certeza que deseja deletar este desenho?")) {
      await deleteDrawing(id);
    }
  };

  if (isLoading && drawings.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Erro: {error}</p>
          <Button onClick={() => loadDrawings()}>Tentar Novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar com lista de desenhos */}
      <div className="w-64 bg-gray-100 border-r border-gray-300 p-4 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-lg font-bold mb-2">Meus Desenhos</h2>
          <Button
            onClick={() => setShowNewDrawingDialog(true)}
            className="w-full"
            size="sm"
          >
            + Novo Desenho
          </Button>
        </div>

        {showNewDrawingDialog && (
          <div className="mb-4 p-3 bg-white rounded border">
            <input
              type="text"
              placeholder="Nome do desenho"
              value={newDrawingName}
              onChange={(e) => setNewDrawingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateNewDrawing();
                if (e.key === "Escape") setShowNewDrawingDialog(false);
              }}
              className="w-full px-2 py-1 border rounded mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={handleCreateNewDrawing}
                size="sm"
                className="flex-1"
              >
                Criar
              </Button>
              <Button
                onClick={() => setShowNewDrawingDialog(false)}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {drawings.map((drawing) => (
            <div
              key={drawing.id}
              className={`p-2 rounded cursor-pointer border ${
                currentDrawingId === drawing.id
                  ? "bg-blue-100 border-blue-500"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => handleSelectDrawing(drawing.id)}
            >
              <div className="font-medium text-sm">{drawing.name}</div>
              <div className="text-xs text-gray-500">
                {new Date(drawing.updatedAt).toLocaleDateString()}
              </div>
              {currentDrawingId === drawing.id && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDrawing(drawing.id);
                  }}
                  size="sm"
                  variant="destructive"
                  className="mt-2 w-full"
                >
                  Deletar
                </Button>
              )}
            </div>
          ))}
        </div>

        {drawings.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-4">
            Nenhum desenho ainda
          </p>
        )}
      </div>

      {/* Canvas principal */}
      <div className="flex-1">
        {currentDrawingId ? (
          <ExcalidrawCanvas />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">
              Selecione ou crie um desenho para começar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/canvas",
    component: CanvasPage,
    getParentRoute: () => parentRoute,
  });
