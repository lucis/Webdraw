import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./view/src"),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", ".worktrees/**", "test/worker/**"],
  },
});
