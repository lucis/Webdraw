/**
 * Landing Page - /about
 * 
 * Página pública com informações sobre o Webdraw
 * Usuários não logados são redirecionados para cá
 */

import { createRoute, type RootRoute, Link } from "@tanstack/react-router";
import { Folder, Zap, Users, Shield, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { UserButton } from "../components/user-button";
import { useOptionalCurrentUser } from "../lib/auth";

function AboutPage() {
  const user = useOptionalCurrentUser();
  
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Webdraw"
              className="w-8 h-8 object-contain"
            />
            <h1 className="text-xl font-bold text-white">Webdraw</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user.data && (
              <Link to="/app">
                <Button size="sm" variant="outline">
                  Abrir App
                </Button>
              </Link>
            )}
            <UserButton />
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            Desenhe suas ideias.
            <br />
            <span className="text-blue-500">Organize com inteligência.</span>
          </h2>
          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            Webdraw é uma aplicação de desenho colaborativa baseada em Excalidraw,
            com organização em folders e sincronização automática.
          </p>
          
          {user.data ? (
            <Link to="/app">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-lg h-12 px-8">
                Abrir Webdraw
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <UserButton />
              <p className="text-sm text-slate-500">
                Faça login para começar a desenhar
              </p>
            </div>
          )}
        </div>
      </section>
      
      {/* Features */}
      <section className="py-20 px-6 bg-slate-950/50">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-white text-center mb-12">
            Features Premium
          </h3>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="bg-blue-600/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Folder className="w-6 h-6 text-blue-500" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">
                Organização em Folders
              </h4>
              <p className="text-sm text-slate-400">
                Organize seus desenhos em folders customizáveis com nome e emoji personalizável.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="bg-green-600/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-green-500" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">
                Auto-Save Inteligente
              </h4>
              <p className="text-sm text-slate-400">
                Salvamento automático com debounce. Nunca perca seu trabalho, sem sobrecarregar o sistema.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="bg-purple-600/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">
                Branches
              </h4>
              <p className="text-sm text-slate-400">
                Seus desenhos são organizados em um workspace pessoal e seguro.
              </p>
            </div>
            
            {/* Feature 4 */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="bg-yellow-600/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-yellow-500" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">
                Conflict Detection
              </h4>
              <p className="text-sm text-slate-400">
                Detecção automática de conflitos para prevenir perda de dados em edições simultâneas.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-white mb-6">
            Pronto para começar?
          </h3>
          <p className="text-lg text-slate-400 mb-8">
            Webdraw é gratuito e open source. Comece a desenhar agora!
          </p>
          
          {user.data ? (
            <Link to="/app">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-lg h-12 px-8">
                Ir para o App
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <UserButton />
          )}
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-slate-500">
            Powered by{" "}
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-400 transition-colors"
            >
              OpenRouter
            </a>
            {" "}• Built with Excalidraw
          </p>
        </div>
      </footer>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/about",
    component: AboutPage,
    getParentRoute: () => parentRoute,
  });
