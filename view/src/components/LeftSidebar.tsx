/**
 * Left Sidebar - Container principal
 * 
 * Contém:
 * - Header com branch selector e botão collapse
 * - Lista de Folders
 * - Separador
 * - Lista de Drawings
 */

import { useState } from "react";
import { ChevronLeft, ChevronRight, GitBranch } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { FolderList } from "./folders/FolderList";
import { DrawingList } from "./drawings/DrawingList";
import { useBranch } from "../hooks/useDrawingManagement";

export const LeftSidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { branch, switchBranch } = useBranch();
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false);
  
  // Branches disponíveis (por enquanto apenas main)
  const availableBranches = ["main"];
  
  if (isCollapsed) {
    return (
      <div className="w-12 bg-slate-900 border-r border-slate-700 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setIsCollapsed(false)}
          title="Expandir sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }
  
  return (
    <div className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          {/* Logo/Title */}
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Webdraw"
              className="w-6 h-6 object-contain"
            />
            <h1 className="text-lg font-bold text-white">Webdraw</h1>
          </div>
          
          {/* Collapse button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsCollapsed(true)}
            title="Recolher sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Branch Selector */}
        <Popover open={branchPopoverOpen} onOpenChange={setBranchPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs font-mono"
            >
              <GitBranch className="w-3 h-3" />
              <span className="flex-1 text-left">{branch}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2 bg-slate-800 border-slate-700">
            <div className="space-y-1">
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-400">
                Branches
              </div>
              {availableBranches.map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    if (b !== branch) {
                      switchBranch(b);
                    }
                    setBranchPopoverOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm font-mono transition-colors ${
                    b === branch
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Folders Section */}
      <div className="flex-shrink-0 border-b border-slate-700 py-2">
        <FolderList />
      </div>
      
      {/* Drawings Section */}
      <div className="flex-1 overflow-hidden flex flex-col py-2">
        <DrawingList />
      </div>
      
      {/* Footer (opcional) */}
      <div className="flex-shrink-0 p-2 border-t border-slate-700">
        <div className="text-xs text-slate-500 text-center">
          <a
            href="/debug-tools"
            className="hover:text-slate-400 transition-colors"
          >
            Debug Tools
          </a>
        </div>
      </div>
    </div>
  );
};
