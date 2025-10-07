/**
 * Navegação de Folders - Versão simplificada
 * 
 * Lista minimalista de folders com nome + emoji
 * Foco na navegação rápida entre pastas
 */

import { useState } from "react";
import { Folder, Plus, ChevronRight } from "lucide-react";
import { FolderEditor } from "./FolderEditor";
import { useFolders } from "../../hooks/useDrawingManagement";
import { cn } from "../../lib/utils";

interface FolderNavItemProps {
  name: string;
  emoji: string;
  isActive: boolean;
  drawingCount: number;
  onClick: () => void;
}

const FolderNavItem = ({ 
  name, 
  emoji, 
  isActive, 
  drawingCount,
  onClick 
}: FolderNavItemProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        // Base styling
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left",
        "sidebar-item-hover group",
        // States
        isActive 
          ? "bg-blue-600 text-white shadow-md" 
          : "text-slate-300 hover:bg-slate-800 hover:text-white",
        // Focus
        "focus:outline-none focus:ring-2 focus:ring-blue-500"
      )}
    >
      {/* Emoji */}
      <span className="text-base flex-shrink-0">{emoji}</span>
      
      {/* Name */}
      <span className="flex-1 text-sm font-medium truncate">
        {name}
      </span>
      
      {/* Drawing count */}
      <span className={cn(
        "text-xs px-1.5 py-0.5 rounded-full flex-shrink-0",
        isActive 
          ? "bg-blue-700 text-blue-100" 
          : "bg-slate-700 text-slate-400 group-hover:bg-slate-600"
      )}>
        {drawingCount}
      </span>
      
      {/* Active indicator */}
      {isActive && (
        <ChevronRight className="w-3 h-3 flex-shrink-0" />
      )}
    </button>
  );
};

export const FolderNavigation = () => {
  const {
    folders,
    currentFolderId,
    isLoading,
    error,
    createFolder,
    selectFolder,
  } = useFolders();
  
  const [editorOpen, setEditorOpen] = useState(false);
  
  const handleCreateFolder = () => {
    setEditorOpen(true);
  };
  
  const handleSaveFolder = async (name: string, emoji: string) => {
    await createFolder(name, emoji);
  };
  
  const handleSelectFolder = (id: string) => {
    selectFolder(id);
  };
  
  if (isLoading && folders.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <div className="text-sm text-slate-400">Carregando pastas...</div>
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
    <div className="py-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pb-2">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-300">Pastas</h3>
        </div>
        <button
          onClick={handleCreateFolder}
          className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors"
          title="Nova Pasta"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      
      {/* Folders list */}
      <div className="px-3 space-y-1">
        {folders.length === 0 ? (
          <div className="py-4 text-center">
            <Folder className="w-6 h-6 mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-500 mb-3">Nenhuma pasta ainda</p>
            <button
              onClick={handleCreateFolder}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded"
            >
              Criar Primeira Pasta
            </button>
          </div>
        ) : (
          folders.map((folder) => (
            <FolderNavItem
              key={folder.id}
              name={folder.name}
              emoji={folder.emoji}
              drawingCount={folder.drawingIds?.length || 0}
              isActive={folder.id === currentFolderId}
              onClick={() => handleSelectFolder(folder.id)}
            />
          ))
        )}
      </div>
      
      {/* Create folder modal */}
      <FolderEditor
        mode="create"
        initialName=""
        initialEmoji="📁"
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveFolder}
      />
    </div>
  );
};
