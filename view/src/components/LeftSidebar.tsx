/**
 * Left Sidebar - Nova versão minimalista e funcional
 * 
 * Layout com 3 seções principais:
 * - Folders Navigation (navegação entre pastas)
 * - Drawings Navigation (desenhos da pasta atual)  
 * - Resources Section (cards draggable para canvas)
 */

import { FolderNavigation } from "./folders/FolderNavigation";
import { DrawingNavigation } from "./drawings/DrawingNavigation";
import { ResourcesSection } from "./resources/ResourcesSection";
import { cn } from "../lib/utils";

interface LeftSidebarProps {
  isOpen: boolean;
}

export const LeftSidebar = ({ isOpen }: LeftSidebarProps) => {
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
      <div className="flex-shrink-0 h-16 p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Webdraw"
            className="w-6 h-6 object-contain"
          />
          <h1 className="text-lg font-bold text-white">Webdraw</h1>
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
      
    </div>
  );
};

