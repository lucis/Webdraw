import React, { useEffect } from "react";
import { Loader } from "lucide-react";
import { ApiClientError } from "../lib/api";
import { currentUserQuery, loginPath } from "../lib/auth";
import { useQuery } from "@tanstack/react-query";

function Fallback() {
  return <div className="w-screen h-screen grid place-items-center"><Loader className="mx-2 w-4 h-4 animate-spin" /></div>;
}

export default function LoggedProvider({ children }: { children: React.ReactNode }) {
  const { error, isPending } = useQuery(currentUserQuery);
  const unauthenticated = error instanceof ApiClientError && error.status === 401;
  const loginUrl = loginPath();

  useEffect(() => {
    if (unauthenticated) globalThis.location.assign(loginUrl);
  }, [loginUrl, unauthenticated]);

  if (isPending) return <Fallback />;
  if (unauthenticated) {
    return <div className="w-screen h-screen grid place-items-center text-slate-400">Redirecting to OpenRouter sign in…</div>;
  }
  if (error) throw error;
  return <>{children}</>;
}
