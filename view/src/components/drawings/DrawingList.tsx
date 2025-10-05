/**
 * Lista de todos os drawings do folder atual
 * 
 * Exibe drawings, permite criar, duplicar e deletar
 */

import { useState } from "react";
import { Plus, FileText, Search } from "lucide-react";
import { Button } from "../ui/button";
import { DrawingItem } from "./DrawingItem";
import { useDrawings, useFolders } from "../../hooks/useDrawingManagement";

export const DrawingList = () => {
  const { currentFolder } = useFolders();
  const {
    drawings,
    currentDrawing,
    isLoading,
    error,
    createDrawing,
    loadDrawing,
    duplicateDrawing,
    deleteDrawing,
  } = useDrawings();
  
  const [newDrawingName, setNewDrawingName] = useState("");
  const [showNewDrawingInput, setShowNewDrawingInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredDrawings = drawings.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleCreateDrawing = async () => {
    if (!newDrawingName.trim()) return;
    
    try {
      await createDrawing(newDrawingName.trim());
      setNewDrawingName("");
      setShowNewDrawingInput(false);
    } catch (err) {
      console.error("Erro ao criar drawing:", err);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateDrawing();
    } else if (e.key === "Escape") {
      setShowNewDrawingInput(false);
      setNewDrawingName("");
    }
  };
  
  if (!currentFolder) {
    return (
      <div className="p-4 text-center">
        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm text-slate-500">Selecione um folder</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4">
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3">
          {error}
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300">Desenhos</h3>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-slate-800"
            onClick={() => setShowNewDrawingInput(true)}
            title="Novo Desenho"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Busca */}
        {drawings.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar desenhos..."
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
        
        {/* Input de novo drawing */}
        {showNewDrawingInput && (
          <div className="space-y-1">
            <input
              type="text"
              value={newDrawingName}
              onChange={(e) => setNewDrawingName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nome do desenho"
              className="w-full px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              maxLength={100}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleCreateDrawing}
                disabled={!newDrawingName.trim()}
                className="flex-1 h-7 bg-blue-600 hover:bg-blue-500"
              >
                Criar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowNewDrawingInput(false);
                  setNewDrawingName("");
                }}
                className="flex-1 h-7"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Lista de drawings */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {isLoading && drawings.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-sm text-slate-400">Carregando...</div>
          </div>
        ) : filteredDrawings.length === 0 ? (
          <div className="py-8 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-500 mb-2">
              {searchQuery
                ? "Nenhum desenho encontrado"
                : "Nenhum desenho neste folder"}
            </p>
            {!searchQuery && !showNewDrawingInput && (
              <Button
                size="sm"
                onClick={() => setShowNewDrawingInput(true)}
                className="mt-2"
              >
                Criar Primeiro Desenho
              </Button>
            )}
          </div>
        ) : (
          filteredDrawings.map((drawing) => (
            <DrawingItem
              key={drawing.id}
              id={drawing.id}
              name={drawing.name}
              updatedAt={drawing.updatedAt}
              elementCount={drawing.elementCount}
              isActive={currentDrawing?.id === drawing.id}
              onClick={() => loadDrawing(drawing.id)}
              onDuplicate={() => duplicateDrawing(drawing.id)}
              onDelete={() => deleteDrawing(drawing.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
