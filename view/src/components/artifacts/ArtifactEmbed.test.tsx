import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "../../lib/api";
import { useArtifactStore } from "../../stores/artifact-store";
import { ArtifactEmbed } from "./ArtifactEmbed";

vi.mock("../../lib/api", () => ({ requestJson: vi.fn() }));

const artifact = {
  id: "01234567-89ab-4cde-8fab-0123456789ab",
  drawingId: "drawing-123",
  kind: "html" as const,
  activeVersion: 1,
  createdAt: 1,
  updatedAt: 1,
};

const activeVersion = {
  artifactId: artifact.id,
  version: 1,
  artifact: {
    kind: "html" as const,
    title: "Preview",
    sourceHtml: "<!doctype html><html><body><button>Active</button></body></html>",
  },
  metadata: { prompt: null, model: null, sourceSnapshot: null },
  createdAt: 1,
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  useArtifactStore.setState({ artifacts: {} });
});

describe("ArtifactEmbed", () => {
  it("loads an internal artifact link into an opaque-origin script sandbox", async () => {
    vi.mocked(requestJson).mockResolvedValue({ artifact, versions: [activeVersion] });

    render(<ArtifactEmbed element={{ link: "webdraw://artifact/01234567-89ab-4cde-8fab-0123456789ab" } as never} />);

    const iframe = await screen.findByTitle("Preview") as HTMLIFrameElement;
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe.getAttribute("srcdoc")).toContain("<button>Active</button>");
    expect(iframe.getAttribute("src")).toBeNull();
  });

  it("renders the candidate source when the store selects a candidate version", () => {
    useArtifactStore.setState({
      artifacts: {
        [artifact.id]: {
          artifact,
          versions: [
            activeVersion,
            {
              ...activeVersion,
              version: 2,
              artifact: { ...activeVersion.artifact, sourceHtml: "<!doctype html><html><body>Candidate</body></html>" },
            },
          ],
          candidateVersion: 2,
          previewError: null,
        },
      },
    });

    render(<ArtifactEmbed element={{ link: "webdraw://artifact/01234567-89ab-4cde-8fab-0123456789ab" } as never} />);

    expect((screen.getByTitle("Preview") as HTMLIFrameElement).getAttribute("srcdoc")).toContain("Candidate");
  });

  it("shows only runtime errors sent by its own preview frame", async () => {
    vi.mocked(requestJson).mockResolvedValue({ artifact, versions: [activeVersion] });
    render(<ArtifactEmbed element={{ link: "webdraw://artifact/01234567-89ab-4cde-8fab-0123456789ab" } as never} />);

    const iframe = await screen.findByTitle("Preview") as HTMLIFrameElement;
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "webdraw:artifact-error", message: "preview failed" },
      source: iframe.contentWindow,
    }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("preview failed"));
  });

  it("does not render an iframe for unrelated links", () => {
    render(<ArtifactEmbed element={{ link: "webdraw://artifact/not-a-uuid" } as never} />);

    expect(document.querySelector("iframe")).toBeNull();
  });
});
