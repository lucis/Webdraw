import { useQuery } from "@tanstack/react-query";
import type { CurrentUserResponse } from "../../../shared/contracts/auth";
import { requestJson } from "./api";

export const currentUserQuery = {
  queryKey: ["current-user"],
  queryFn: () => requestJson<CurrentUserResponse>("/api/me"),
  retry: false,
};

export function useOptionalCurrentUser() {
  return useQuery({ ...currentUserQuery, retry: false });
}

export function loginPath(next = currentPath()): string {
  return `/api/auth/login?next=${encodeURIComponent(next)}`;
}

function currentPath(): string {
  return `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;
}
