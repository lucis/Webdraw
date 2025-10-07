/**
 * Botão Toggle da Sidebar - Fixo no viewport
 * 
 * Botão externo que não interfere com o canvas,
 * posicionado no canto superior esquerdo
 */

import { Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const SidebarToggle = ({ isOpen, onToggle, className }: SidebarToggleProps) => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      className={cn(
        // Position fixed no viewport
        "fixed top-4 left-4 z-50",
        // Styling
        "h-10 w-10 p-0",
        "bg-slate-900/95 border-slate-600 backdrop-blur-sm",
        "hover:bg-slate-800 hover:border-slate-500",
        "text-slate-300 hover:text-white",
        // Shadow and transition
        "shadow-lg transition-all duration-200",
        "hover:shadow-xl hover:scale-105",
        // Pulse animation when closed
        !isOpen && "toggle-button-active",
        // When sidebar is open, move button to the right
        isOpen && "left-[21rem]", // 320px (sidebar width) + 16px margin
        className
      )}
      title={isOpen ? "Fechar sidebar" : "Abrir sidebar"}
    >
      {isOpen ? (
        <X className="w-4 h-4" />
      ) : (
        <Menu className="w-4 h-4" />
      )}
    </Button>
  );
};
