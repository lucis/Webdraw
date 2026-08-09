import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { requestJson } from "../lib/api";
import { loginPath, useOptionalCurrentUser } from "../lib/auth";

function LoginButton() {
  return (
    <Button asChild size="sm" className="bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white border-slate-600">
      <a href={loginPath()}>Sign in with OpenRouter</a>
    </Button>
  );
}

export function UserButton() {
  const { data, isPending } = useOptionalCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  if (isPending || loggedOut || !data?.user) return <LoginButton />;
  const { openRouterUserId } = data.user;

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      await requestJson<void>("/api/auth/logout", { method: "POST" });
      setLoggedOut(true);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" className="bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white border-slate-600">
          {openRouterUserId}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-slate-800 border-slate-700 text-white p-4" align="end">
        <div className="space-y-4">
          <p className="text-sm text-slate-300 text-center">Signed in with OpenRouter</p>
          <div className="border-t border-slate-700" />
          <div className="text-xs text-slate-400 break-all">{openRouterUserId}</div>
          <Button type="button" size="sm" variant="ghost" disabled={isLoggingOut} onClick={logout} className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30">
            <LogOut className="w-3 h-3 mr-2" />
            Log out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
