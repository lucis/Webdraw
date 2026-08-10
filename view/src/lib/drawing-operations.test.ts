import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { describe, expect, it, vi } from "vitest";
import type { DrawingOperation } from "../../../shared/contracts/drawing-operations";
import { materializeOperations } from "./drawing-operations";

// Excalidraw's published ESM entry currently contains an extensionless
// roughjs import that Node cannot resolve in Vitest. This behavioral double
// mirrors the conversion/versioning/binding-repair boundary used below while
// the production bundle continues to use Excalidraw's real exports.
vi.mock("@excalidraw/excalidraw", () => ({
  convertToExcalidrawElements: (skeletons: Array<Record<string, unknown>>) => skeletons.map((skeleton, index) => ({
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    angle: 0,
    seed: 100 + index,
    version: 1,
    versionNonce: 200 + index,
    index: null,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: null,
    boundElements: [],
    updated: 1,
    link: null,
    locked: false,
    ...skeleton,
  })),
  newElementWith: (element: Record<string, unknown>, updates: Record<string, unknown>) => ({
    ...element,
    ...updates,
    version: Number(element.version) + 1,
    versionNonce: Number(element.versionNonce) + 1,
    updated: Number(element.updated) + 1,
  }),
  restoreElements: (elements: Array<Record<string, unknown>>, _local: unknown, options: { repairBindings?: boolean }) => {
    const ids = new Set(elements.map((element) => element.id));
    return elements.map((element) => ({
      ...element,
      boundElements: options.repairBindings && Array.isArray(element.boundElements)
        ? element.boundElements.filter((binding) => ids.has((binding as { id: string }).id))
        : element.boundElements,
    }));
  },
}));

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
