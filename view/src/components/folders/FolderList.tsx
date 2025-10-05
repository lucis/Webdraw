/**
 * Lista de todos os folders
 * 
 * Exibe folders, permite criar, editar, deletar e selecionar
 */

import { useState } from "react";
import { Plus, Folder } from "lucide-react";
import { Button } from "../ui/button";
import { FolderItem } from "./FolderItem";
import { FolderEditor } from "./FolderEditor";
import { useFolders } from "../../hooks/useDrawingManagement";

export const FolderList = () => {
  const {
    folders,
    currentFolderId,
    isLoading,
    error,
    createFolder,
    updateFolder,
    deleteFolder,
    selectFolder,
  } = useFolders();
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  
  const editingFolder = folders.find((f) => f.id === editingFolderId);
  
  const handleCreateFolder = () => {
    setEditorMode("create");
    setEditingFolderId(null);
    setEditorOpen(true);
  };
  
  const handleEditFolder = (id: string) => {
    setEditorMode("edit");
    setEditingFolderId(id);
    setEditorOpen(true);
  };
  
  const handleSaveFolder = async (name: string, emoji: string) => {
    if (editorMode === "create") {
      await createFolder(name, emoji);
    } else if (editingFolderId) {
      await updateFolder(editingFolderId, name, emoji);
    }
  };
  
  const handleDeleteFolder = async (id: string) => {
    await deleteFolder(id);
  };
  
  const handleSelectFolder = (id: string) => {
    selectFolder(id);
  };
  
  if (isLoading && folders.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-slate-400">Carregando folders...</div>
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
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-300">Folders</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 hover:bg-slate-800"
          onClick={handleCreateFolder}
          title="Novo Folder"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Lista de folders */}
      <div className="space-y-1">
        {folders.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <Folder className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-500">Nenhum folder ainda</p>
            <Button
              size="sm"
              className="mt-2"
              onClick={handleCreateFolder}
            >
              Criar Primeiro Folder
            </Button>
          </div>
        ) : (
          folders.map((folder) => (
            <FolderItem
              key={folder.id}
              id={folder.id}
              name={folder.name}
              emoji={folder.emoji}
              drawingCount={folder.drawingIds?.length || 0}
              isDefault={folder.isDefault}
              isActive={folder.id === currentFolderId}
              onClick={() => handleSelectFolder(folder.id)}
              onEdit={() => handleEditFolder(folder.id)}
              onDelete={() => handleDeleteFolder(folder.id)}
            />
          ))
        )}
      </div>
      
      {/* Modal de criar/editar */}
      <FolderEditor
        mode={editorMode}
        initialName={editorMode === "edit" ? editingFolder?.name : ""}
        initialEmoji={editorMode === "edit" ? editingFolder?.emoji : "📁"}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveFolder}
      />
    </div>
  );
};
