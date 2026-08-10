import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { exportSelectionPng, getSelectionContext } from "./selection";

const { exportToBlob } = vi.hoisted(() => ({ exportToBlob: vi.fn() }));

vi.mock("@excalidraw/excalidraw", () => ({ exportToBlob }));

beforeEach(() => {
  exportToBlob.mockReset();
});

const card = {
  id: "card",
  type: "rectangle",
  x: 100,
  y: 50,
  width: 320,
  height: 180,
  strokeColor: "#1d4ed8",
  backgroundColor: "#dbeafe",
  frameId: "checkout-frame",
  groupIds: ["checkout"],
  boundElements: [{ id: "card-label", type: "text" }],
  version: 9,
  versionNonce: 101,
  updated: 123456789,
  seed: 42,
  isDeleted: false,
} as unknown as NonDeletedExcalidrawElement;

const cardLabel = {
  id: "card-label",
  type: "text",
  x: 132,
  y: 92,
  width: 180,
  height: 30,
  text: "Checkout",
  strokeColor: "#111827",
  backgroundColor: "transparent",
  frameId: "checkout-frame",
  groupIds: ["checkout"],
  containerId: "card",
  version: 7,
  versionNonce: 202,
  updated: 123456790,
  seed: 43,
  isDeleted: false,
} as unknown as NonDeletedExcalidrawElement;

const unrelated = {
  id: "unrelated",
  type: "ellipse",
  x: 900,
  y: 900,
  width: 50,
  height: 50,
  strokeColor: "#ef4444",
  backgroundColor: "transparent",
  groupIds: [],
  version: 3,
  versionNonce: 303,
  updated: 123456791,
  seed: 44,
  isDeleted: false,
} as unknown as NonDeletedExcalidrawElement;

function apiWithSelection(
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElementIds: Record<string, boolean>,
): Pick<ExcalidrawImperativeAPI, "getSceneElements" | "getAppState"> {
  return {
    getSceneElements: () => elements,
    getAppState: () => ({ selectedElementIds }) as ReturnType<ExcalidrawImperativeAPI["getAppState"]>,
  };
}

describe("getSelectionContext", () => {
  it("includes directly bound text but excludes unrelated scene elements and volatile fields", () => {
    const context = getSelectionContext(apiWithSelection([card, cardLabel, unrelated], { card: true }));

    expect(context.semantic.bounds).toEqual({ x: 100, y: 50, width: 320, height: 180 });
    expect(context.semantic.elements).toEqual([
      {
        id: "card",
        type: "rectangle",
        x: 100,
        y: 50,
        width: 320,
        height: 180,
        strokeColor: "#1d4ed8",
        backgroundColor: "#dbeafe",
        frameId: "checkout-frame",
        groupIds: ["checkout"],
        boundElements: [{ id: "card-label", type: "text" }],
      },
      {
        id: "card-label",
        type: "text",
        x: 132,
        y: 92,
        width: 180,
        height: 30,
        text: "Checkout",
        strokeColor: "#111827",
        backgroundColor: "transparent",
        frameId: "checkout-frame",
        groupIds: ["checkout"],
        bindings: { containerId: "card" },
      },
    ]);
    expect(context.elements).toEqual([card, cardLabel]);
  });

  it("does not include text that is merely named by a stale bound-element reference", () => {
    const staleCard = {
      ...card,
      boundElements: [{ id: "unrelated", type: "text" }],
    } as unknown as NonDeletedExcalidrawElement;
    const unrelatedText = {
      ...cardLabel,
      id: "unrelated",
      containerId: null,
      text: "Do not include me",
    } as unknown as NonDeletedExcalidrawElement;

    const context = getSelectionContext(apiWithSelection([staleCard, unrelatedText], { card: true }));

    expect(context.semantic.elements.map((element) => element.id)).toEqual(["card"]);
  });
});

describe("exportSelectionPng", () => {
  it("exports the selection through Excalidraw and returns a non-empty PNG data URL", async () => {
    exportToBlob.mockResolvedValue(new Blob(["png-bytes"], { type: "image/png" }));
    const context = getSelectionContext(apiWithSelection([card, cardLabel], { card: true }));
    const files = {} as BinaryFiles;

    await expect(exportSelectionPng(context, files)).resolves.toBe("data:image/png;base64,cG5nLWJ5dGVz");
    expect(exportToBlob).toHaveBeenCalledWith(expect.objectContaining({
      elements: [card, cardLabel],
      files,
      mimeType: "image/png",
    }));
  });

  it("rejects an empty selection before attempting PNG export", async () => {
    const context = getSelectionContext(apiWithSelection([card], {}));

    await expect(exportSelectionPng(context, {} as BinaryFiles)).rejects.toThrow("Select at least one element");
    expect(exportToBlob).not.toHaveBeenCalled();
  });

  it("rejects an empty PNG export instead of producing an unusable data URL", async () => {
    exportToBlob.mockResolvedValue(new Blob([], { type: "image/png" }));
    const context = getSelectionContext(apiWithSelection([card], { card: true }));

    await expect(exportSelectionPng(context, {} as BinaryFiles)).rejects.toThrow("empty PNG");
  });
});
