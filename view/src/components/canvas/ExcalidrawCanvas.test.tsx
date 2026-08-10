import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDrawingStore } from "../../stores/drawing-store";
import { useArtifactStore } from "../../stores/artifact-store";
import { ExcalidrawCanvas } from "./ExcalidrawCanvas";
import { useCanvasCommands } from "./canvas-command-context";

const { requestJson, initialData, excalidrawApi, getSelectionContext, exportSelectionPng } = vi.hoisted(() => ({
  requestJson: vi.fn(),
  initialData: { current: undefined as unknown },
  excalidrawApi: {
    getAppState: vi.fn(() => ({ selectedElementIds: { source: true } })),
    getFiles: vi.fn(() => ({})),
    getSceneElements: vi.fn(() => [{ id: "source", type: "rectangle", x: 100, y: 50, width: 500, height: 300 }]),
    updateScene: vi.fn(),
    scrollToContent: vi.fn(),
  },
  getSelectionContext: vi.fn(),
  exportSelectionPng: vi.fn(),
}));

vi.mock("@excalidraw/excalidraw", () => ({
  restoreElements: (elements: unknown[]) => elements,
  Excalidraw: ({ excalidrawAPI, onChange, initialData: nextInitialData }: {
    excalidrawAPI: (api: object) => void;
    onChange: (elements: readonly unknown[], appState: unknown, files: unknown) => void;
    initialData: unknown;
  }) => {
    initialData.current = nextInitialData;
    React.useEffect(() => excalidrawAPI(excalidrawApi), [excalidrawAPI]);
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

vi.mock("../../lib/selection", () => ({ getSelectionContext, exportSelectionPng }));

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

const interfaceModels = [
  {
    id: "vision-a",
    name: "Vision A",
    inputModalities: ["image", "text"],
    supportedParameters: [],
    contextLength: 128_000,
    pricing: null,
  },
  {
    id: "vision-b",
    name: "Vision B",
    inputModalities: ["image", "text"],
    supportedParameters: [],
    contextLength: 128_000,
    pricing: null,
  },
];

const generatedInterface = {
  artifact: {
    id: "01234567-89ab-4cde-8fab-0123456789ab",
    drawingId: drawingA.id,
    kind: "html",
    activeVersion: 1,
    createdAt: 1,
    updatedAt: 1,
  },
  version: {
    artifactId: "01234567-89ab-4cde-8fab-0123456789ab",
    version: 1,
    artifact: { kind: "html", title: "Preview", sourceHtml: "<!doctype html><html><body>Preview</body></html>" },
    metadata: { prompt: null, model: "vision-a", sourceSnapshot: null },
    createdAt: 1,
  },
};

function CanvasCommandConsumer() {
  const commands = useCanvasCommands();

  return (
    <div>
      <label htmlFor="canvas-command-model">Canvas command model</label>
      <select
        id="canvas-command-model"
        value={commands.activeModelId ?? ""}
        onChange={(event) => commands.setActiveModelId(event.target.value)}
      >
        {commands.models.map((model) => (
          <option key={model.id} value={model.id}>{`${model.name} (${model.id})`}</option>
        ))}
      </select>
      <button type="button" disabled={!commands.canGenerate} onClick={commands.generateInterface}>
        {commands.generationLabel}
      </button>
      <output aria-label="Generation phase">{commands.generationPhase}</output>
      {commands.error && <div role="alert">{commands.error}</div>}
    </div>
  );
}

function renderCanvasWithCommandConsumer() {
  return render(
    <ExcalidrawCanvas>
      <CanvasCommandConsumer />
    </ExcalidrawCanvas>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  requestJson.mockResolvedValue({ purpose: "interface", models: [] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  requestJson.mockReset();
  sessionStorage.clear();
  excalidrawApi.getAppState.mockReturnValue({ selectedElementIds: { source: true } });
  excalidrawApi.updateScene.mockReset();
  excalidrawApi.scrollToContent.mockReset();
  getSelectionContext.mockReset();
  exportSelectionPng.mockReset();
  useDrawingStore.setState({
    currentDrawing: null,
    drawings: [],
    syncStatus: "idle",
    error: null,
  });
  useArtifactStore.setState({ artifacts: {}, initialLoadErrors: {} });
});

describe("ExcalidrawCanvas autosave", () => {
  it("lets an external command consumer select a model and invoke generation", async () => {
    useDrawingStore.setState({ currentDrawing: drawingA, drawings: [drawingA] });
    getSelectionContext.mockReturnValue({
      elements: [{ id: "source", type: "rectangle", x: 100, y: 50, width: 500, height: 300 }],
      semantic: {
        elements: [{ id: "source", type: "rectangle", x: 100, y: 50, width: 500, height: 300 }],
        bounds: { x: 100, y: 50, width: 500, height: 300 },
      },
    });
    exportSelectionPng.mockResolvedValue("data:image/png;base64,cG5n");
    requestJson.mockImplementation((path: string) => {
      if (path === "/api/models?purpose=interface") {
        return Promise.resolve({ purpose: "interface", models: interfaceModels });
      }
      if (path === "/api/generations/interface") return Promise.resolve(generatedInterface);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderCanvasWithCommandConsumer();

    const selector = await screen.findByLabelText("Canvas command model");
    expect((selector as HTMLSelectElement).value).toBe("vision-a");
    expect(screen.getByRole("option", { name: "Vision A (vision-a)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Vision B (vision-b)" })).toBeTruthy();
    expect(screen.queryByLabelText("Interface model")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Generate interface" })).toHaveLength(1);

    fireEvent.change(selector, { target: { value: "vision-b" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate interface" }));

    await waitFor(() => expect(requestJson).toHaveBeenCalledWith(
      "/api/generations/interface",
      expect.objectContaining({ body: expect.stringContaining('"model":"vision-b"') }),
    ));
    expect(sessionStorage.getItem("webdraw.interface-model")).toBe("vision-b");
  });

  it("restores a persisted interface model when it is in the compatible catalog", async () => {
    sessionStorage.setItem("webdraw.interface-model", "vision-b");
    useDrawingStore.setState({ currentDrawing: drawingA, drawings: [drawingA] });
    requestJson.mockResolvedValue({ purpose: "interface", models: interfaceModels });

    renderCanvasWithCommandConsumer();

    expect((await screen.findByLabelText("Canvas command model") as HTMLSelectElement).value).toBe("vision-b");
  });

  it("falls back to the first compatible model when the persisted model is stale", async () => {
    sessionStorage.setItem("webdraw.interface-model", "removed-model");
    useDrawingStore.setState({ currentDrawing: drawingA, drawings: [drawingA] });
    requestJson.mockResolvedValue({ purpose: "interface", models: interfaceModels });

    renderCanvasWithCommandConsumer();

    expect((await screen.findByLabelText("Canvas command model") as HTMLSelectElement).value).toBe("vision-a");
  });

  it("keeps external command availability synchronized with the canvas selection", async () => {
    useDrawingStore.setState({ currentDrawing: drawingA, drawings: [drawingA] });
    requestJson.mockResolvedValue({ purpose: "interface", models: interfaceModels });

    renderCanvasWithCommandConsumer();

    const command = await screen.findByRole("button", { name: "Generate interface" });
    expect((command as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Edit drawing" }));

    expect((command as HTMLButtonElement).disabled).toBe(true);
  });

  it("exposes model catalog errors to an external command consumer", async () => {
    useDrawingStore.setState({ currentDrawing: drawingA, drawings: [drawingA] });
    requestJson.mockRejectedValue(new Error("Model catalog unavailable"));

    renderCanvasWithCommandConsumer();

    expect((await screen.findByRole("alert")).textContent).toBe("Model catalog unavailable");
  });

  it("rehydrates persisted collaborators as a Map before opening a drawing", () => {
    useDrawingStore.setState({
      currentDrawing: {
        ...drawingA,
        scene: { ...drawingA.scene, appState: { collaborators: {} } },
      },
    });

    renderCanvasWithCommandConsumer();

    expect((initialData.current as { appState: { collaborators: unknown } }).appState.collaborators).toBeInstanceOf(Map);
  });

  it("does not save drawing A's debounced scene after selection changes to drawing B", async () => {
    vi.useFakeTimers();
    useDrawingStore.setState({ currentDrawing: drawingA, drawings: [drawingA, drawingB] });
    requestJson.mockResolvedValue({ drawing: drawingA });

    renderCanvasWithCommandConsumer();
    fireEvent.click(screen.getByRole("button", { name: "Edit drawing" }));

    act(() => {
      useDrawingStore.setState({ currentDrawing: drawingB });
      vi.advanceTimersByTime(2_000);
    });

    expect(requestJson).not.toHaveBeenCalledWith(
      "/api/drawings/drawing-a",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("runs interface generation from the canvas button and appends the embed to the mounted API scene", async () => {
    useDrawingStore.setState({ currentDrawing: drawingA, drawings: [drawingA] });
    getSelectionContext.mockReturnValue({
      elements: [{ id: "source", type: "rectangle", x: 100, y: 50, width: 500, height: 300 }],
      semantic: {
        elements: [{ id: "source", type: "rectangle", x: 100, y: 50, width: 500, height: 300 }],
        bounds: { x: 100, y: 50, width: 500, height: 300 },
      },
    });
    exportSelectionPng.mockResolvedValue("data:image/png;base64,cG5n");
    requestJson.mockImplementation((path: string) => {
      if (path === "/api/models?purpose=interface") {
        return Promise.resolve({ purpose: "interface", models: [{ id: "vision-model" }] });
      }
      if (path === "/api/generations/interface") {
        return Promise.resolve({
          artifact: {
            id: "01234567-89ab-4cde-8fab-0123456789ab",
            drawingId: drawingA.id,
            kind: "html",
            activeVersion: 1,
            createdAt: 1,
            updatedAt: 1,
          },
          version: {
            artifactId: "01234567-89ab-4cde-8fab-0123456789ab",
            version: 1,
            artifact: { kind: "html", title: "Preview", sourceHtml: "<!doctype html><html><body>Preview</body></html>" },
            metadata: { prompt: null, model: "vision-model", sourceSnapshot: null },
            createdAt: 1,
          },
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderCanvasWithCommandConsumer();

    const button = await screen.findByRole("button", { name: "Generate interface" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);

    await waitFor(() => expect(excalidrawApi.updateScene).toHaveBeenCalledWith(expect.objectContaining({
      elements: expect.arrayContaining([
        expect.objectContaining({
          link: "webdraw://artifact/01234567-89ab-4cde-8fab-0123456789ab",
        }),
      ]),
    })));
    expect(excalidrawApi.scrollToContent).toHaveBeenCalled();
  });

  it("labels a selection with exactly one artifact embed as Update interface", async () => {
    useDrawingStore.setState({ currentDrawing: drawingA, drawings: [drawingA] });
    excalidrawApi.getAppState.mockReturnValue({ selectedElementIds: { embed: true, note: true } });
    excalidrawApi.getSceneElements.mockReturnValue([
      {
        id: "embed",
        type: "embeddable",
        link: "webdraw://artifact/01234567-89ab-4cde-8fab-0123456789ab",
        x: 100,
        y: 50,
        width: 640,
        height: 384,
      },
      { id: "note", type: "text", x: 120, y: 450, width: 200, height: 24 },
    ]);
    requestJson.mockImplementation((path: string) => path === "/api/models?purpose=interface"
      ? Promise.resolve({ purpose: "interface", models: [{ id: "vision-model" }] })
      : Promise.reject(new Error(`Unexpected request: ${path}`)));

    renderCanvasWithCommandConsumer();

    expect(await screen.findByRole("button", { name: "Update interface" })).toBeTruthy();
  });
});
