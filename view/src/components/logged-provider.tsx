import React from "react";
import { Loader } from "lucide-react";
import { ApiClientError } from "../lib/api";
import { currentUserQuery, loginPath } from "../lib/auth";
import { useQuery } from "@tanstack/react-query";

function Fallback() {
  return <div className="w-screen h-screen grid place-items-center"><Loader className="mx-2 w-4 h-4 animate-spin" /></div>;
}

export default function LoggedProvider({ children }: { children: React.ReactNode }) {
  const { error, isPending } = useQuery(currentUserQuery);

  if (isPending) return <Fallback />;
  if (error instanceof ApiClientError && error.status === 401) {
    return <a className="sr-only" href={loginPath()} aria-label="Sign in with OpenRouter">Sign in with OpenRouter</a>;
  }
  if (error) throw error;
  return <>{children}</>;
}
