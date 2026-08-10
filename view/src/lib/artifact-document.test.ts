import { describe, expect, it } from "vitest";
import { ARTIFACT_SANDBOX, buildArtifactDocument } from "./artifact-document";

const restrictivePolicy = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none";

describe("buildArtifactDocument", () => {
  it("turns a complete HTML document into a sandboxed preview without changing its markup", () => {
    const source = "<!doctype html><html lang=\"en\"><head><title>Example</title><script>window.example = 1;</script></head><body><main data-artifact=\"complete\">Hello</main></body></html>";

    const output = buildArtifactDocument(source);
    const document = new DOMParser().parseFromString(output, "text/html");

    expect(document.querySelector("meta[charset]")?.getAttribute("charset")?.toLowerCase()).toBe("utf-8");
    expect(document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content"))
      .toBe(restrictivePolicy);
    expect(output).toContain("webdraw-tailwind-runtime");
    expect(output).toContain("window.example = 1;");
    expect(output).toContain('<main data-artifact="complete">Hello</main>');
    expect(document.querySelector("title")?.textContent).toBe("Example");
    expect(document.querySelector("#webdraw-artifact-error-bridge")).not.toBeNull();
    expect(output).toContain('type: "webdraw:artifact-error"');
    expect(output).toContain("message: message");
    expect(output).not.toContain("cdn.jsdelivr.net");
    expect(output).not.toContain("allow-same-origin");
  });

  it("wraps an HTML fragment in a complete hardened document while preserving its script and markup", () => {
    const source = '<button onclick="boom()">Go</button><script>throw new Error("fragment failure")</script>';

    const output = buildArtifactDocument(source);
    const document = new DOMParser().parseFromString(output, "text/html");

    expect(document.doctype?.name).toBe("html");
    expect(document.body.innerHTML).toContain('<button onclick="boom()">Go</button>');
    expect(document.body.innerHTML).toContain('throw new Error("fragment failure")');
    expect(document.querySelector("meta[charset]")?.getAttribute("charset")?.toLowerCase()).toBe("utf-8");
    expect(document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content"))
      .toBe(restrictivePolicy);
    expect(output).toContain("webdraw-tailwind-runtime");
    expect(output).not.toContain("cdn.jsdelivr.net");
    expect(output).not.toContain("allow-same-origin");
  });

  it("requires an opaque-origin script sandbox", () => {
    expect(ARTIFACT_SANDBOX).toBe("allow-scripts");
  });
});
