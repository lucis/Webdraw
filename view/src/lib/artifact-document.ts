import tailwindBrowserRuntime from "../vendor/tailwind-browser.js?raw";

export const ARTIFACT_SANDBOX = "allow-scripts";

const artifactContentSecurityPolicy = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none";

const artifactErrorBridge = `
(() => {
  const report = (value) => {
    const message = typeof value === "string"
      ? value
      : value instanceof Error
        ? value.message
        : "Unknown runtime error";

    window.parent.postMessage({ type: "webdraw:artifact-error", message: message }, "*");
  };

  window.addEventListener("error", (event) => {
    report(event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    report(event.reason);
  });
})();
`;

export function buildArtifactDocument(sourceHtml: string): string {
  const document = new DOMParser().parseFromString(sourceHtml, "text/html");
  const charset = document.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  const csp = document.createElement("meta");
  csp.httpEquiv = "Content-Security-Policy";
  csp.content = artifactContentSecurityPolicy;

  const tailwindRuntime = document.createElement("script");
  tailwindRuntime.id = "webdraw-tailwind-runtime";
  tailwindRuntime.textContent = tailwindBrowserRuntime;

  const errorBridge = document.createElement("script");
  errorBridge.id = "webdraw-artifact-error-bridge";
  errorBridge.textContent = artifactErrorBridge;

  document.head.insertBefore(charset, document.head.firstChild);
  document.head.insertBefore(csp, charset.nextSibling);
  document.head.insertBefore(tailwindRuntime, csp.nextSibling);
  document.head.insertBefore(errorBridge, tailwindRuntime.nextSibling);

  return `<!doctype html>${document.documentElement.outerHTML}`;
}
