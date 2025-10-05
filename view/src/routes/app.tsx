/**
 * Rota principal do aplicativo (/app)
 * 
 * Página principal do Webdraw com:
 * - Left Sidebar (folders + drawings)
 * - Canvas do Excalidraw
 * - Header com user button
 */

import { createRoute, type RootRoute } from "@tanstack/react-router";
import { LeftSidebar } from "../components/LeftSidebar";
import { ExcalidrawCanvas } from "../components/canvas/ExcalidrawCanvas";
import { UserButton } from "../components/user-button";
import { useInitializeDrawingStore } from "../hooks/useDrawingManagement";
import LoggedProvider from "../components/logged-provider";

function AppPage() {
  const { isInitialized } = useInitializeDrawingStore();
  
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
  
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-slate-900">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Webdraw"
            className="w-6 h-6 object-contain"
          />
          <h1 className="text-lg font-bold text-white">Webdraw</h1>
        </div>
        
        <UserButton />
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar />
        
        {/* Canvas */}
        <main className="flex-1 overflow-hidden">
          <ExcalidrawCanvas />
        </main>
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
  });
