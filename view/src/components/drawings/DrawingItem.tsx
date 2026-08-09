/**
 * Componente de item de drawing individual
 * 
 * Exibe um drawing com nome, data e ações
 */

import { FileText, Copy, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface DrawingItemProps {
  id: string;
  name: string;
  updatedAt: number;
  isActive: boolean;
  onClick: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const DrawingItem = ({
  name,
  updatedAt,
  isActive,
  onClick,
  onDuplicate,
  onDelete,
}: DrawingItemProps) => {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  };
  
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "bg-blue-600 text-white"
          : "hover:bg-slate-800 text-slate-200"
      }`}
    >
      {/* Ícone */}
      <FileText className="w-4 h-4 flex-shrink-0" />
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{name}</div>
        <div
          className={`text-xs flex items-center gap-2 ${
            isActive ? "text-blue-100" : "text-slate-400"
          }`}
        >
          <span>{formatDate(updatedAt)}</span>
        </div>
      </div>
      
      {/* Menu de ações */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className={`h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
              isActive ? "hover:bg-blue-500" : "hover:bg-slate-700"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-48 p-1 bg-slate-800 border-slate-700"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors"
          >
            <Copy className="w-4 h-4" />
            Duplicar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Deletar "${name}"?`)) {
                onDelete();
              }
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-slate-700 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Deletar
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
};
