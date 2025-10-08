/**
 * Rota principal do aplicativo (/app)
 * 
 * Página principal do Webdraw com:
 * - Sidebar escondível com toggle externo
 * - Canvas do Excalidraw (fullscreen)
 * - Header com user button
 */

import { createRoute, type RootRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LeftSidebar } from "../components/LeftSidebar";
import { SidebarToggle } from "../components/SidebarToggle";
import { ExcalidrawCanvas } from "../components/canvas/ExcalidrawCanvas";
import { UserButton } from "../components/user-button";
import { useInitializeDrawingStore } from "../hooks/useDrawingManagement";
import { useDrawingStore } from "../stores/drawing-store";
import LoggedProvider from "../components/logged-provider";

function AppPage() {
  const { isInitialized } = useInitializeDrawingStore();
  const syncStatus = useDrawingStore((state) => state.syncStatus);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  if (!isInitialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="text-lg text-slate-400 mb-2">Carregando aplicação...</div>
          <div className="text-sm text-slate-600">Inicializando workspace</div>
        </div>
      </div>
    );
  }
  
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 relative overflow-hidden">
      {/* Sidebar Toggle - Fixo no viewport */}
      <SidebarToggle 
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
      />
      
      {/* Sidebar - Fixed overlay */}
      <LeftSidebar 
        isOpen={sidebarOpen}
      />
      
      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-slate-900 relative z-30">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Webdraw"
            className="w-6 h-6 object-contain"
          />
          <h1 className="text-lg font-bold text-white">Webdraw</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Status de sincronização */}
          {syncStatus === "saving" && (
            <div className="flex items-center gap-2 px-2 py-1 bg-blue-600 text-white rounded text-sm">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              Salvando...
            </div>
          )}
          {syncStatus === "error" && (
            <div className="flex items-center gap-2 px-2 py-1 bg-red-600 text-white rounded text-sm">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              Erro
            </div>
          )}
          
          <UserButton />
        </div>
      </header>
      
      {/* Main Content - Full screen canvas */}
      <div className="flex-1 overflow-hidden relative">
        {/* Canvas ocupa toda a tela */}
        <main className="absolute inset-0">
          <ExcalidrawCanvas />
        </main>
        
        {/* Overlay quando sidebar está aberta (mobile) */}
        {sidebarOpen && (
          <div 
            className="absolute inset-0 bg-black/20 z-30 md:hidden overlay-enter"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// Wrapper com LoggedProvider
function AppPageWithAuth() {
  return (
    <LoggedProvider>
      <AppPage />
    </LoggedProvider>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/app",
    component: AppPageWithAuth,
    getParentRoute: () => parentRoute,
    validateSearch: (search: Record<string, unknown>) => ({
      drawingId: search.drawingId as string | undefined,
    }),
  });