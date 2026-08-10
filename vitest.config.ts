import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./view/src"),
      // Excalidraw 0.18.1 publishes this extensionless ESM import. Browsers
      // and Vite production resolve it, but Node's test resolver requires the
      // concrete file so tests can exercise Excalidraw's real transforms.
      "roughjs/bin/rough": path.resolve(__dirname, "./node_modules/roughjs/bin/rough.js"),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", ".worktrees/**", "test/worker/**"],
    server: {
      deps: {
        inline: ["@excalidraw/excalidraw"],
      },
    },
  },
});
