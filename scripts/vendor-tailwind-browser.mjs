import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const runtimePath = require.resolve("@tailwindcss/browser");
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const destination = resolve(scriptDirectory, "../view/src/vendor/tailwind-browser.js");

await mkdir(dirname(destination), { recursive: true });
await copyFile(runtimePath, destination);
