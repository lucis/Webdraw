import { createRootRoute } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import CanvasRoute from "./canvas";

vi.mock("@excalidraw/excalidraw", () => ({ Excalidraw: () => null }));

describe("legacy canvas route", () => {
  it("redirects a direct canvas link to the initialized app route with its drawing selector", () => {
    const route = CanvasRoute(createRootRoute());
    const beforeLoad = route.options.beforeLoad;

    try {
      beforeLoad!({ search: { drawingId: "drawing-123" } } as never);
      throw new Error("Expected the legacy route to redirect");
    } catch (error) {
      expect(error).toMatchObject({
        options: { to: "/app", search: { drawingId: "drawing-123" }, replace: true },
      });
    }
  });
});
