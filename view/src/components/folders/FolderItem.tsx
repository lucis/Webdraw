/**
 * Componente de item de folder individual
 * 
 * Exibe um folder com emoji, nome e contador de drawings
 * Permite editar e deletar (exceto folder default)
 */

import { Folder, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/button";

interface FolderItemProps {
  id: string;
  name: string;
  emoji: string;
  drawingCount: number;
  isDefault: boolean;
  isActive: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const FolderItem = ({
  name,
  emoji,
  drawingCount,
  isDefault,
  isActive,
  onClick,
  onEdit,
  onDelete,
}: FolderItemProps) => {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "bg-blue-600 text-white"
          : "hover:bg-slate-800 text-slate-200"
      }`}
    >
      {/* Emoji */}
      <span className="text-lg flex-shrink-0">{emoji || <Folder className="w-4 h-4" />}</span>
      
      {/* Nome e contador */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{name}</div>
        <div
          className={`text-xs ${
            isActive ? "text-blue-100" : "text-slate-400"
          }`}
        >
          {drawingCount} {drawingCount === 1 ? "desenho" : "desenhos"}
        </div>
      </div>
      
      {/* Botões de ação (apenas se não for default) */}
      {!isDefault && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            className={`h-6 w-6 p-0 ${
              isActive ? "hover:bg-blue-500" : "hover:bg-slate-700"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`h-6 w-6 p-0 ${
              isActive ? "hover:bg-blue-500" : "hover:bg-slate-700"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Deletar folder "${name}"?`)) {
                onDelete();
              }
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
