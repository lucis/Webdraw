import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      ".worktrees/",
      "node_modules/",
      ".wrangler/",
      "worker-configuration.d.ts",
      "deco.gen.ts",
      "shared/deco.gen.ts",
      "server/",
      "drizzle/",
      "drizzle.config.ts",
      "plugin.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["view/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/rules-of-hooks": "error",
    },
  },
);
