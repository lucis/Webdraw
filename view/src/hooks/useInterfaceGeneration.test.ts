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

const sourceElement = { id: "source", type: "rectangle", x: 100, y: 50, width: 500, height: 300 };
const generatedArtifact = {
  id: "01234567-89ab-4cde-8fab-0123456789ab",
  drawingId: "drawing-123",
  kind: "html" as const,
  activeVersion: 1,
  createdAt: 1,
  updatedAt: 1,
};
const generatedVersion = {
  artifactId: generatedArtifact.id,
  version: 1,
  artifact: { kind: "html" as const, title: "Preview", sourceHtml: "<!doctype html><html><body>Preview</body></html>" },
  metadata: { prompt: null, model: "vision-model", sourceSnapshot: null },
  createdAt: 1,
};

afterEach(() => {
  vi.resetAllMocks();
  useArtifactStore.setState({ artifacts: {} });
});

describe("useInterfaceGeneration", () => {
  it("appends one restored linked embed beside the captured selection and reveals both", async () => {
    const api = {
      getFiles: vi.fn(() => ({})),
      getSceneElements: vi.fn(() => [sourceElement]),
      updateScene: vi.fn(),
      scrollToContent: vi.fn(),
    };
    getSelectionContext.mockReturnValue({
      elements: [sourceElement],
      semantic: {
        elements: [sourceElement],
        bounds: { x: 100, y: 50, width: 500, height: 300 },
      },
    });
    exportSelectionPng.mockResolvedValue("data:image/png;base64,cG5n");
    vi.mocked(requestJson).mockResolvedValue({ artifact: generatedArtifact, version: generatedVersion });

    const { result } = renderHook(() => useInterfaceGeneration({
      api: api as never,
      drawing: { id: "drawing-123", version: 7 },
    }));

    await act(() => result.current.generate({ model: "vision-model", instruction: "Build this" }));

    expect(api.updateScene).toHaveBeenCalledTimes(1);
    const inserted = api.updateScene.mock.calls[0][0].elements[1];
    expect(inserted).toMatchObject({
      type: "embeddable",
      x: 680,
      y: 50,
      width: 640,
      height: 384,
      link: "webdraw://artifact/01234567-89ab-4cde-8fab-0123456789ab",
      customData: {
        webdraw: { kind: "artifact", artifactId: "01234567-89ab-4cde-8fab-0123456789ab", schemaVersion: 1 },
      },
    });
    expect(api.scrollToContent).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: "source" }),
      expect.objectContaining({ link: "webdraw://artifact/01234567-89ab-4cde-8fab-0123456789ab" }),
    ]), { fitToContent: true, animate: true });
    expect(useArtifactStore.getState().artifacts[generatedArtifact.id]?.versions).toEqual([generatedVersion]);
  });
});
