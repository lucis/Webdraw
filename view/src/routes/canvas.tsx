import { createRoute, redirect, type RootRoute } from "@tanstack/react-router";

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/canvas",
    getParentRoute: () => parentRoute,
    validateSearch: (search: Record<string, unknown>) => ({
      drawingId: search.drawingId as string | undefined,
    }),
    beforeLoad: ({ search }) => {
      throw redirect({ to: "/app", search, replace: true });
    },
  });
