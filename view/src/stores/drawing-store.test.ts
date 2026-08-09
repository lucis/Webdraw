import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../lib/api";

const { requestJson } = vi.hoisted(() => ({ requestJson: vi.fn() }));

vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  requestJson,
}));

const defaultFolder = {
  id: "folder-default",
  name: "My drawings",
  emoji: "🎨",
  order: 0,
  isDefault: true,
  createdAt: 1,
  updatedAt: 1,
};

const drawing = {
  id: "drawing-1",
  folderId: defaultFolder.id,
  name: "Architecture",
  scene: { elements: [], appState: {}, files: {} },
  version: 3,
  createdAt: 1,
  updatedAt: 1,
};

describe("drawing store HTTP API", () => {
  beforeEach(async () => {
    vi.resetModules();
    requestJson.mockReset();
    localStorage.clear();
  });

  it("initializes from folders and selects the default folder", async () => {
    requestJson.mockResolvedValueOnce({ folders: [defaultFolder] });
    requestJson.mockResolvedValueOnce({ drawings: [] });
    const { useDrawingStore } = await import("./drawing-store");

    await useDrawingStore.getState().initialize();

    expect(useDrawingStore.getState()).toMatchObject({
      folders: [defaultFolder],
      currentFolderId: defaultFolder.id,
      drawings: [],
    });
    expect(requestJson).toHaveBeenNthCalledWith(1, "/api/folders");
    expect(requestJson).toHaveBeenNthCalledWith(
      2,
      `/api/drawings?folderId=${defaultFolder.id}`,
    );
  });

  it("creates a drawing in the selected folder and loads its API scene", async () => {
    const { useDrawingStore } = await import("./drawing-store");
    useDrawingStore.setState({ currentFolderId: defaultFolder.id });
    requestJson.mockResolvedValueOnce({ drawing });
    requestJson.mockResolvedValueOnce({ drawings: [omitScene(drawing)] });
    requestJson.mockResolvedValueOnce({ drawing });

    await useDrawingStore.getState().createDrawing("Architecture");

    expect(useDrawingStore.getState().currentDrawing).toEqual(drawing);
    expect(requestJson).toHaveBeenNthCalledWith(1, "/api/drawings", {
      method: "POST",
      body: JSON.stringify({ folderId: defaultFolder.id, name: "Architecture" }),
    });
    expect(requestJson).toHaveBeenNthCalledWith(3, "/api/drawings/drawing-1");
  });

  it("loads a drawing selected by a URL drawing id", async () => {
    const { useDrawingStore } = await import("./drawing-store");
    requestJson.mockResolvedValue({ drawing });

    await useDrawingStore.getState().loadDrawing("drawing-1");

    expect(useDrawingStore.getState().currentDrawing).toEqual(drawing);
    expect(requestJson).toHaveBeenCalledWith("/api/drawings/drawing-1");
  });

  it("saves a scene with the server version and stores its returned version", async () => {
    const { useDrawingStore } = await import("./drawing-store");
    useDrawingStore.setState({ currentDrawing: drawing, drawings: [omitScene(drawing)] });
    const scene = { elements: [{ id: "element-1" }], appState: { gridSize: 20 }, files: {} };
    requestJson.mockResolvedValue({ drawing: { ...drawing, scene, version: 4, updatedAt: 2 } });

    await useDrawingStore.getState().saveCurrentDrawing(scene);

    expect(requestJson).toHaveBeenCalledWith("/api/drawings/drawing-1", {
      method: "PUT",
      body: JSON.stringify({ expectedVersion: 3, scene }),
    });
    expect(useDrawingStore.getState().currentDrawing?.version).toBe(4);
    expect(useDrawingStore.getState().drawings[0]).toMatchObject({ version: 4, updatedAt: 2 });
  });

  it("keeps the conflict visible after a stale autosave", async () => {
    const { useDrawingStore } = await import("./drawing-store");
    useDrawingStore.setState({ currentDrawing: drawing });
    requestJson.mockRejectedValue(
      new ApiClientError(409, "version_conflict", "The drawing was updated elsewhere", { currentVersion: 4 }),
    );

    await expect(
      useDrawingStore.getState().saveCurrentDrawing({ elements: [], appState: {}, files: {} }),
    ).rejects.toMatchObject({ status: 409 });

    expect(useDrawingStore.getState()).toMatchObject({
      syncStatus: "error",
      error: "The drawing was updated elsewhere",
    });
  });
});

function omitScene(value: typeof drawing) {
  const { scene: _scene, ...summary } = value;
  return summary;
}
