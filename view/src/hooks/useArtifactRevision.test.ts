import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "../lib/api";
import { useArtifactStore } from "../stores/artifact-store";
import { useInterfaceGeneration } from "./useInterfaceGeneration";

const { getSelectionContext, exportSelectionPng } = vi.hoisted(() => ({
  getSelectionContext: vi.fn(),
  exportSelectionPng: vi.fn(),
}));

vi.mock("../lib/api", () => ({ requestJson: vi.fn() }));
vi.mock("../lib/selection", () => ({ getSelectionContext, exportSelectionPng }));
vi.mock("@excalidraw/excalidraw", () => ({
  restoreElements: (elements: unknown[]) => elements,
}));

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
    title: "Checkout",
    sourceHtml: "<!doctype html><html><body>Active checkout</body></html>",
  },
  metadata: { prompt: null, model: "vision-model", sourceSnapshot: null },
  createdAt: 1,
};

const candidateVersion = {
  ...activeVersion,
  version: 2,
  artifact: { ...activeVersion.artifact, sourceHtml: "<!doctype html><html><body>Revised checkout</body></html>" },
};

const embed = {
  id: "artifact-embed",
  type: "embeddable",
  x: 100,
  y: 50,
  width: 640,
  height: 384,
  link: "webdraw://artifact/01234567-89ab-4cde-8fab-0123456789ab",
};
const annotation = {
  id: "note",
  type: "text",
  x: 120,
  y: 460,
  width: 240,
  height: 30,
  text: "Make the primary action more prominent",
};

afterEach(() => {
  vi.resetAllMocks();
  useArtifactStore.setState({ artifacts: {}, initialLoadErrors: {} });
});

describe("useInterfaceGeneration artifact revisions", () => {
  it("revises exactly one selected artifact with annotation-only semantics without changing its embed", async () => {
    const api = {
      getFiles: vi.fn(() => ({})),
      getSceneElements: vi.fn(() => [embed, annotation]),
      updateScene: vi.fn(),
      scrollToContent: vi.fn(),
    };
    getSelectionContext.mockReturnValue({
      elements: [embed, annotation],
      semantic: {
        elements: [embed, annotation],
        bounds: { x: 100, y: 50, width: 640, height: 440 },
      },
    });
    exportSelectionPng.mockResolvedValue("data:image/png;base64,YW5ub3RhdGVk");
    useArtifactStore.setState({
      artifacts: {
        [artifact.id]: { artifact, versions: [activeVersion], candidateVersion: null, previewError: null },
      },
    });
    vi.mocked(requestJson).mockResolvedValue({ artifact, version: candidateVersion });

    const { result } = renderHook(() => useInterfaceGeneration({
      api: api as never,
      drawing: { id: "drawing-123", version: 7 },
    }));

    await act(() => result.current.generate({ model: "vision-model", instruction: "Use the annotation" }));

    expect(requestJson).toHaveBeenCalledWith("/api/generations/interface", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        mode: "revise",
        kind: "html",
        drawingId: "drawing-123",
        drawingVersion: 7,
        model: "vision-model",
        instruction: "Use the annotation",
        artifactId: artifact.id,
        expectedActiveVersion: 1,
        currentSourceHtml: activeVersion.artifact.sourceHtml,
        artifactDimensions: { width: 640, height: 384 },
        selection: {
          pngDataUrl: "data:image/png;base64,YW5ub3RhdGVk",
          semantic: {
            elements: [annotation],
            bounds: { x: 120, y: 460, width: 240, height: 30 },
          },
        },
      }),
    }));
    expect(api.updateScene).not.toHaveBeenCalled();
    expect(api.scrollToContent).not.toHaveBeenCalled();
    expect(embed).toMatchObject({ x: 100, y: 50, width: 640, height: 384 });
    expect(useArtifactStore.getState().artifacts[artifact.id]).toMatchObject({
      artifact: { id: artifact.id, activeVersion: 1 },
      versions: [activeVersion, candidateVersion],
      candidateVersion: 2,
    });
  });

  it("uses the empty semantic-selection bounds when only the artifact is selected", async () => {
    const api = {
      getFiles: vi.fn(() => ({})),
      getSceneElements: vi.fn(() => [embed]),
      updateScene: vi.fn(),
      scrollToContent: vi.fn(),
    };
    getSelectionContext.mockReturnValue({
      elements: [embed],
      semantic: {
        elements: [embed],
        bounds: { x: 100, y: 50, width: 640, height: 384 },
      },
    });
    exportSelectionPng.mockResolvedValue("data:image/png;base64,YXJ0aWZhY3Q=");
    useArtifactStore.setState({
      artifacts: {
        [artifact.id]: { artifact, versions: [activeVersion], candidateVersion: null, previewError: null },
      },
    });
    vi.mocked(requestJson).mockResolvedValue({ artifact, version: candidateVersion });

    const { result } = renderHook(() => useInterfaceGeneration({
      api: api as never,
      drawing: { id: "drawing-123", version: 7 },
    }));

    await act(() => result.current.generate({ model: "vision-model" }));

    const request = JSON.parse(String(vi.mocked(requestJson).mock.calls[0]?.[1]?.body));
    expect(request.selection.semantic).toEqual({
      elements: [],
      bounds: { x: 0, y: 0, width: 1, height: 1 },
    });
    expect(api.updateScene).not.toHaveBeenCalled();
  });

  it("keeps a one-dimensional annotation within the positive transport bounds", async () => {
    const verticalAnnotation = { ...annotation, id: "vertical-note", x: 400, y: 80, width: 0, height: 120 };
    const api = {
      getFiles: vi.fn(() => ({})),
      getSceneElements: vi.fn(() => [embed, verticalAnnotation]),
      updateScene: vi.fn(),
      scrollToContent: vi.fn(),
    };
    getSelectionContext.mockReturnValue({
      elements: [embed, verticalAnnotation],
      semantic: {
        elements: [embed, verticalAnnotation],
        bounds: { x: 100, y: 50, width: 640, height: 384 },
      },
    });
    exportSelectionPng.mockResolvedValue("data:image/png;base64,dGhpbm5vdGU=");
    useArtifactStore.setState({
      artifacts: {
        [artifact.id]: { artifact, versions: [activeVersion], candidateVersion: null, previewError: null },
      },
    });
    vi.mocked(requestJson).mockResolvedValue({ artifact, version: candidateVersion });

    const { result } = renderHook(() => useInterfaceGeneration({
      api: api as never,
      drawing: { id: "drawing-123", version: 7 },
    }));

    await act(() => result.current.generate({ model: "vision-model" }));

    const request = JSON.parse(String(vi.mocked(requestJson).mock.calls[0]?.[1]?.body));
    expect(request.selection.semantic.bounds).toEqual({ x: 400, y: 80, width: 1, height: 120 });
  });
});
