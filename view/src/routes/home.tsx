import { createRoute, type RootRoute } from "@tanstack/react-router";
import { useOptionalCurrentUser } from "@/lib/auth";

function HomePage() {
  const user = useOptionalCurrentUser();

  // Redirecionar baseado em autenticação
  if (user.data) {
    // Usuário logado → redirecionar para /app
    window.location.href = "/app";
    return (
      <div className="bg-slate-900 min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Redirecionando...</div>
      </div>
    );
  }
  
  // Usuário não logado → redirecionar para /about
  window.location.href = "/about";
  return (
    <div className="bg-slate-900 min-h-screen flex items-center justify-center">
      <div className="text-slate-400">Redirecionando...</div>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/",
    component: HomePage,
    getParentRoute: () => parentRoute,
  });
