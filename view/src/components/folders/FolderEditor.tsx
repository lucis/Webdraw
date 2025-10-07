/**
 * Modal/Dialog para criar ou editar folder
 * 
 * Permite editar nome e emoji do folder
 */

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { X } from "lucide-react";

interface FolderEditorProps {
  mode: "create" | "edit";
  initialName?: string;
  initialEmoji?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, emoji: string) => Promise<void>;
}

// Emojis comuns para folders
const COMMON_EMOJIS = [
  "📁", "🚀", "🎨", "💼", "📚", "🏠", "⭐", "💡",
  "🎯", "🔥", "✨", "🌟", "📝", "🎪", "🎭", "🎬",
];

export const FolderEditor = ({
  mode,
  initialName = "",
  initialEmoji = "📁",
  isOpen,
  onClose,
  onSave,
}: FolderEditorProps) => {
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reset form quando modal abre
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setEmoji(initialEmoji);
      setError(null);
    }
  }, [isOpen, initialName, initialEmoji]);
  
  const handleSave = async () => {
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await onSave(name.trim(), emoji);
      onClose();
    } catch (err) {
      setError(`Erro ao salvar: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {mode === "create" ? "Novo Folder" : "Editar Folder"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nome do Folder
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: Meus Projetos"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              maxLength={100}
            />
          </div>
          
          {/* Emoji Picker */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Emoji
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`text-2xl p-2 rounded-lg transition-colors ${
                    emoji === e
                      ? "bg-blue-600"
                      : "bg-slate-900 hover:bg-slate-700"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            
            {/* Custom emoji input */}
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="Ou digite um emoji"
              className="w-full mt-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={2}
            />
          </div>
          
          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-2">
              {error}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !name.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-500"
          >
            {isLoading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
};


