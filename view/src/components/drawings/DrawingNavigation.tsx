/**
 * Navegação de Drawings - Versão simplificada
 * 
 * Lista focada na troca rápida entre desenhos
 * da pasta atual
 */

import { useState } from "react";
import { FileText, Plus, Clock } from "lucide-react";
import { useDrawings, useFolders, useCurrentDrawing } from "../../hooks/useDrawingManagement";
import { cn } from "../../lib/utils";

interface DrawingNavItemProps {
  name: string;
  updatedAt: number;
  elementCount: number;
  isActive: boolean;
  onClick: () => void;
}

const DrawingNavItem = ({ 
  name, 
  updatedAt, 
  elementCount,
  isActive, 
  onClick 
}: DrawingNavItemProps) => {
  const timeAgo = getTimeAgo(new Date(updatedAt));
  
  return (
    <button
      onClick={onClick}
      className={cn(
        // Base styling
        "w-full flex flex-col gap-1 px-3 py-2 rounded-lg text-left",
        "sidebar-item-hover group",
        // States
        isActive 
          ? "bg-blue-600 text-white shadow-md" 
          : "text-slate-300 hover:bg-slate-800 hover:text-white",
        // Focus
        "focus:outline-none focus:ring-2 focus:ring-blue-500"
      )}
    >
      {/* Top row: name + element count */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate flex-1">
          {name}
        </span>
        <span className={cn(
          "text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2",
          isActive 
            ? "bg-blue-700 text-blue-100" 
            : "bg-slate-700 text-slate-400 group-hover:bg-slate-600"
        )}>
          {elementCount}
        </span>
      </div>
      
      {/* Bottom row: timestamp */}
      <div className="flex items-center gap-1">
        <Clock className={cn(
          "w-3 h-3",
          isActive ? "text-blue-200" : "text-slate-500"
        )} />
        <span className={cn(
          "text-xs",
          isActive ? "text-blue-200" : "text-slate-500"
        )}>
          {timeAgo}
        </span>
      </div>
    </button>
  );
};

// Helper para calcular tempo relativo
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  
  return date.toLocaleDateString("pt-BR", { 
    day: "2-digit", 
    month: "2-digit" 
  });
}

export const DrawingNavigation = () => {
  const { currentFolder } = useFolders();
  const {
    drawings,
    isLoading,
    error,
    createDrawing,
    loadDrawing,
  } = useDrawings();
  const { currentDrawing } = useCurrentDrawing();
  
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newDrawingName, setNewDrawingName] = useState("");
  
  const handleCreateDrawing = async () => {
    if (!newDrawingName.trim()) return;
    
    try {
      await createDrawing(newDrawingName.trim());
      setNewDrawingName("");
      setShowCreateInput(false);
    } catch (err) {
      console.error("Erro ao criar desenho:", err);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateDrawing();
    } else if (e.key === "Escape") {
      setShowCreateInput(false);
      setNewDrawingName("");
    }
  };
  
  if (!currentFolder) {
    return (
      <div className="px-3 py-6 text-center">
        <FileText className="w-6 h-6 mx-auto mb-2 text-slate-600" />
        <p className="text-sm text-slate-500">Selecione uma pasta</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="px-3 py-2">
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3">
          {error}
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300">Desenhos</h3>
          </div>
          <button
            onClick={() => setShowCreateInput(!showCreateInput)}
            className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors"
            title="Novo Desenho"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        
        {/* Create input - Simplified */}
        {showCreateInput && (
          <div className="space-y-2 mb-2">
            <input
              type="text"
              value={newDrawingName}
              onChange={(e) => setNewDrawingName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nome do desenho"
              className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateDrawing}
                disabled={!newDrawingName.trim()}
                className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
              >
                Criar
              </button>
              <button
                onClick={() => {
                  setShowCreateInput(false);
                  setNewDrawingName("");
                }}
                className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Drawings list - Scrollable */}
      <div className="flex-1 overflow-y-auto px-3 min-h-0">
        {/* Debug info temporário */}
        <div className="text-xs text-slate-500 mb-2 p-2 bg-slate-800 rounded border-l-2 border-blue-500">
          <div><strong>🔍 Debug Info:</strong></div>
          <div>Pasta: {currentFolder?.name || 'Nenhuma'}</div>
          <div>Drawings: {drawings.length}</div>
          <div>Loading: {isLoading ? 'Sim' : 'Não'}</div>
          <div>Desenho atual: {currentDrawing?.name || 'Nenhum'}</div>
          {currentDrawing && (
            <div>Elementos: {currentDrawing.elements?.length || 0}</div>
          )}
          {error && <div className="text-red-400">Error: {error}</div>}
        </div>
        
        {isLoading && drawings.length === 0 ? (
          <div className="py-4 text-center">
            <div className="text-sm text-slate-400">Carregando...</div>
          </div>
        ) : drawings.length === 0 ? (
          <div className="py-4 text-center">
            <FileText className="w-6 h-6 mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-500 mb-3">
              Nenhum desenho nesta pasta
            </p>
            {!showCreateInput && (
              <button
                onClick={() => setShowCreateInput(true)}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded"
              >
                Criar Primeiro Desenho
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {drawings.map((drawing) => (
              <DrawingNavItem
                key={drawing.id}
                name={drawing.name}
                updatedAt={drawing.updatedAt}
                elementCount={drawing.elementCount}
                isActive={currentDrawing?.id === drawing.id}
                onClick={() => loadDrawing(drawing.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
