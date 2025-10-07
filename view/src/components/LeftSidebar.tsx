/**
 * Left Sidebar - Nova versão minimalista e funcional
 * 
 * Layout com 3 seções principais:
 * - Folders Navigation (navegação entre pastas)
 * - Drawings Navigation (desenhos da pasta atual)  
 * - Resources Section (cards draggable para canvas)
 */

import { GitBranch } from "lucide-react";
import { FolderNavigation } from "./folders/FolderNavigation";
import { DrawingNavigation } from "./drawings/DrawingNavigation";
import { ResourcesSection } from "./resources/ResourcesSection";
import { useBranch } from "../hooks/useDrawingManagement";
import { cn } from "../lib/utils";

interface LeftSidebarProps {
  isOpen: boolean;
}

export const LeftSidebar = ({ isOpen }: LeftSidebarProps) => {
  const { branch } = useBranch();
  
  return (
    <div 
      className={cn(
        // Base styling
        "fixed left-0 top-0 h-screen w-80 bg-slate-900 border-r border-slate-700",
        "flex flex-col z-40 shadow-xl overflow-hidden",
        // Animation
        "transition-transform duration-300 ease-in-out",
        // States
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Header - Fixed height */}
      <div className="flex-shrink-0 h-24 p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <img
            src="/logo.png"
            alt="Webdraw"
            className="w-6 h-6 object-contain"
          />
          <h1 className="text-lg font-bold text-white">Webdraw</h1>
        </div>
        
        {/* Branch Selector - Simplified */}
        <div className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded text-xs font-mono text-slate-300">
          <GitBranch className="w-3 h-3" />
          <span>{branch}</span>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        
        {/* Folders Section - Fixed height */}
        <div className="flex-shrink-0 max-h-32 border-b border-slate-700 overflow-y-auto">
          <FolderNavigation />
        </div>
        
        {/* Drawings Section - Flexible with scroll */}
        <div className="flex-1 flex flex-col min-h-0 border-b border-slate-700">
          <DrawingNavigation />
        </div>
        
        {/* Resources Section - Fixed height */}
        <div className="flex-shrink-0 max-h-40 overflow-y-auto">
          <ResourcesSection />
        </div>
        
      </div>
      
      {/* Footer - Fixed height */}
      <div className="flex-shrink-0 h-12 p-3 border-t border-slate-700 flex items-center justify-center">
        <a
          href="/debug-tools"
          className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          Debug Tools
        </a>
      </div>
    </div>
  );
};


