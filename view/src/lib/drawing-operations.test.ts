import type { convertToExcalidrawElements as ConvertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { beforeAll, describe, expect, it } from "vitest";
import type { DrawingOperation } from "../../../shared/contracts/drawing-operations";
import type { materializeOperations as MaterializeOperations } from "./drawing-operations";

let convertToExcalidrawElements: typeof ConvertToExcalidrawElements;
let materializeOperations: typeof MaterializeOperations;

beforeAll(async () => {
  installCanvasMeasurementStub();
  ({ convertToExcalidrawElements } = await import("@excalidraw/excalidraw"));
  ({ materializeOperations } = await import("./drawing-operations"));
});

function rectangle(id: string, x = 10): ExcalidrawElement {
  const [element] = convertToExcalidrawElements([{
    id,
    type: "rectangle",
    x,
    y: 20,
    width: 120,
    height: 80,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
  }]);
  if (!element) throw new Error("Unable to create rectangle fixture");
  return element;
}

describe("materializeOperations", () => {
  it("assigns distinct cryptographic IDs to additions and reports them", () => {
    const current = [rectangle("existing")];
    const operations: DrawingOperation[] = [
      { op: "add", element: { type: "rectangle", x: 200, y: 20, width: 100, height: 60 } },
      { op: "add", element: { type: "text", x: 220, y: 40, width: 80, height: 24, text: "New" } },
    ];

    const preview = materializeOperations(current, operations);

    expect(preview.addedIds).toHaveLength(2);
    expect(new Set(preview.addedIds).size).toBe(2);
    expect(preview.addedIds).not.toContain("existing");
    for (const id of preview.addedIds) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(preview.nextElements.some((element) => element.id === id)).toBe(true);
    }
  });

  it("updates through Excalidraw versioning while preserving immutable fields", () => {
    const source = rectangle("selected");
    const original = structuredClone(source);

    const preview = materializeOperations([source], [
      { op: "update", id: source.id, patch: { x: 75, strokeColor: "#ff0000" } },
    ]);

    const updated = preview.nextElements.find((element) => element.id === source.id);
    expect(updated).toMatchObject({
      id: original.id,
      type: original.type,
      seed: original.seed,
      x: 75,
      strokeColor: "#ff0000",
      version: original.version + 1,
    });
    expect(updated?.versionNonce).not.toBe(original.versionNonce);
    expect(preview.updatedIds).toEqual([source.id]);
    expect(source).toEqual(original);
  });

  it.each(["line", "arrow"] as const)("keeps %s points consistent with patched geometry", (type) => {
    const [source] = convertToExcalidrawElements([{
      id: `${type}-selected`,
      type,
      x: 40,
      y: 50,
      width: 100,
      height: 50,
    }], { regenerateIds: false });
    if (!source || (source.type !== "line" && source.type !== "arrow")) {
      throw new Error("Unable to create linear fixture");
    }
    const original = structuredClone(source);

    const preview = materializeOperations([source], [
      { op: "update", id: source.id, patch: { x: 80, y: 90, width: 240, height: 120 } },
    ]);

    const updated = preview.nextElements[0];
    if (!updated || (updated.type !== "line" && updated.type !== "arrow")) {
      throw new Error("Expected a materialized linear element");
    }
    const xs = updated.points.map(([x]) => x);
    const ys = updated.points.map(([, y]) => y);
    expect(updated).toMatchObject({ x: 80, y: 90, width: 240, height: 120 });
    expect(Math.max(...xs) - Math.min(...xs)).toBe(updated.width);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(updated.height);
    expect(updated.points).not.toEqual(source.points);
    expect(source).toEqual(original);
  });

  it("keeps text, originalText, and measured dimensions synchronized", () => {
    const [source] = convertToExcalidrawElements([{
      id: "text-selected",
      type: "text",
      x: 20,
      y: 30,
      text: "Short",
      fontSize: 20,
    }], { regenerateIds: false });
    if (!source || source.type !== "text") throw new Error("Unable to create text fixture");
    const original = structuredClone(source);
    const replacement = "A substantially longer replacement label";

    const preview = materializeOperations([source], [
      { op: "update", id: source.id, patch: { text: replacement, fontSize: 32 } },
    ]);

    const updated = preview.nextElements[0];
    if (!updated || updated.type !== "text") throw new Error("Expected a materialized text element");
    expect(updated.text).toBe(replacement);
    expect(updated.originalText).toBe(replacement);
    expect(updated.fontSize).toBe(32);
    expect(updated.width).toBeGreaterThan(source.width);
    expect(updated.height).toBeGreaterThan(source.height);
    expect(source).toEqual(original);
  });

  it("rejects patch fields that violate the target element type", () => {
    const source = rectangle("selected");

    expect(() => materializeOperations([source], [
      { op: "update", id: source.id, patch: { text: "Not valid for a rectangle" } },
    ])).toThrow(/text.*not supported.*rectangle/i);

    expect(source).not.toHaveProperty("text");
  });

  it("represents deletion with an Excalidraw tombstone", () => {
    const source = rectangle("selected");

    const preview = materializeOperations([source], [{ op: "delete", id: source.id }]);

    expect(preview.nextElements).toHaveLength(1);
    expect(preview.nextElements[0]).toMatchObject({
      id: source.id,
      isDeleted: true,
      version: source.version + 1,
    });
    expect(preview.deletedIds).toEqual([source.id]);
  });

  it("repairs stale bindings and never mutates the input array or its elements", () => {
    const source = rectangle("box") as ExcalidrawElement & {
      boundElements: readonly { id: string; type: "arrow" }[] | null;
    };
    const current = [
      { ...source, boundElements: [{ id: "missing-arrow", type: "arrow" as const }] },
    ] as ExcalidrawElement[];
    const original = structuredClone(current);

    const preview = materializeOperations(current, []);

    expect(preview.nextElements[0]?.boundElements).toEqual([]);
    expect(current).toEqual(original);
    expect(preview.nextElements).not.toBe(current);
    expect(preview.nextElements[0]).not.toBe(current[0]);
  });
});

function installCanvasMeasurementStub() {
  class TestFontFace {
    family: string;
    status = "loaded";

    constructor(family: string) {
      this.family = family;
    }

    load() {
      return Promise.resolve(this);
    }
  }
  Object.defineProperty(globalThis, "FontFace", { configurable: true, value: TestFontFace });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      add: () => undefined,
      check: () => true,
      load: () => Promise.resolve([]),
      ready: Promise.resolve(),
    },
  });

  const getContext = function (this: HTMLCanvasElement) {
    const context = {
      canvas: this,
      filter: "none",
      font: "20px sans-serif",
      measureText: (text: string) => ({
        width: text.length * 10,
        actualBoundingBoxAscent: 16,
        actualBoundingBoxDescent: 4,
      }),
    };
    return new Proxy(context, {
      get: (target, property) => property in target
        ? target[property as keyof typeof target]
        : () => undefined,
      set: (target, property, value) => {
        (target as Record<PropertyKey, unknown>)[property] = value;
        return true;
      },
    });
  };
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: getContext });
}
