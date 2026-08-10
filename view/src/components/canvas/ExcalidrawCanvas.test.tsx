import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDrawingStore } from "../../stores/drawing-store";
import { ExcalidrawCanvas } from "./ExcalidrawCanvas";

const { requestJson, initialData } = vi.hoisted(() => ({ requestJson: vi.fn(), initialData: { current: undefined as unknown } }));

vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: ({ excalidrawAPI, onChange, initialData: nextInitialData }: {
    excalidrawAPI: (api: object) => void;
    onChange: (elements: readonly unknown[], appState: unknown, files: unknown) => void;
    initialData: unknown;
  }) => {
    initialData.current = nextInitialData;
    excalidrawAPI({});
    return (
      <button onClick={() => onChange([{ id: "edited-in-a" }], {}, {})}>
        Edit drawing
      </button>
    );
  },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/api")>()),
  requestJson,
}));

const drawingA = {
  id: "drawing-a",
  folderId: "folder-1",
  name: "A",
  scene: { elements: [], appState: {}, files: {} },
  version: 1,
  createdAt: 1,
  updatedAt: 1,
};

const drawingB = { ...drawingA, id: "drawing-b", name: "B", version: 4 };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  requestJson.mockReset();
  useDrawingStore.setState({
    currentDrawing: null,
    drawings: [],
    syncStatus: "idle",
    error: null,
  });
});

describe("ExcalidrawCanvas autosave", () => {
  it("rehydrates persisted collaborators as a Map before opening a drawing", () => {
    useDrawingStore.setState({
      currentDrawing: {
        ...drawingA,
        scene: { ...drawingA.scene, appState: { collaborators: {} } },
      },
    });

    render(<ExcalidrawCanvas />);

    expect((initialData.current as { appState: { collaborators: unknown } }).appState.collaborators).toBeInstanceOf(Map);
  });

  it("does not save drawing A's debounced scene after selection changes to drawing B", async () => {
    vi.useFakeTimers();
    useDrawingStore.setState({ currentDrawing: drawingA, drawings: [drawingA, drawingB] });
    requestJson.mockResolvedValue({ drawing: drawingA });

    render(<ExcalidrawCanvas />);
    fireEvent.click(screen.getByRole("button", { name: "Edit drawing" }));

    act(() => {
      useDrawingStore.setState({ currentDrawing: drawingB });
      vi.advanceTimersByTime(2_000);
    });

    expect(requestJson).not.toHaveBeenCalled();
  });
});
