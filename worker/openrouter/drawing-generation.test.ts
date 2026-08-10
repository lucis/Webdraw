import { describe, expect, it } from "vitest";
import { validateDrawingOperations } from "./drawing-generation";

const selectedContext = { selectedIds: new Set(["selected-rectangle"]), maxOperations: 40 };

describe("validateDrawingOperations", () => {
  it("accepts bounded rectangle, text, and arrow additions without model-supplied IDs", () => {
    const operations = validateDrawingOperations([
      {
        op: "add",
        element: {
          type: "rectangle",
          x: 40,
          y: 50,
          width: 320,
          height: 180,
          strokeColor: "#1e1e1e",
          backgroundColor: "#a5d8ff",
        },
      },
      {
        op: "add",
        element: { type: "text", x: 60, y: 75, width: 180, height: 32, text: "Checkout" },
      },
      {
        op: "add",
        element: { type: "arrow", x: 200, y: 240, width: 120, height: 60, endArrowhead: "arrow" },
      },
    ], selectedContext);

    expect(operations).toHaveLength(3);
    expect(operations[0]).not.toHaveProperty("id");
  });

  it("rejects unsupported element types", () => {
    expect(() => validateDrawingOperations([
      { op: "add", element: { type: "image", x: 0, y: 0, width: 10, height: 10 } },
    ], selectedContext)).toThrow(/unsupported element type/i);
  });

  it("rejects non-finite geometry and excessive dimensions", () => {
    expect(() => validateDrawingOperations([
      { op: "add", element: { type: "rectangle", x: Number.POSITIVE_INFINITY, y: 0, width: 10, height: 10 } },
    ], selectedContext)).toThrow(/finite/i);
    expect(() => validateDrawingOperations([
      { op: "add", element: { type: "rectangle", x: 0, y: 0, width: 10_001, height: 10 } },
    ], selectedContext)).toThrow();
  });

  it("rejects unknown add and patch fields, including model-supplied IDs", () => {
    expect(() => validateDrawingOperations([
      { op: "add", element: { id: "model-id", type: "rectangle", x: 0, y: 0, width: 10, height: 10 } },
    ], selectedContext)).toThrow();
    expect(() => validateDrawingOperations([
      { op: "update", id: "selected-rectangle", patch: { arbitraryData: "nope" } },
    ], selectedContext)).toThrow(/unknown patch field/i);
  });

  it("authorizes updates and deletes only for selected IDs", () => {
    expect(() => validateDrawingOperations([
      { op: "update", id: "outside-selection", patch: { x: 40 } },
    ], selectedContext)).toThrow(/outside the selected context/i);
    expect(() => validateDrawingOperations([
      { op: "delete", id: "outside-selection" },
    ], selectedContext)).toThrow(/outside the selected context/i);

    expect(validateDrawingOperations([
      { op: "update", id: "selected-rectangle", patch: { x: 40, opacity: 80 } },
    ], selectedContext)).toHaveLength(1);
  });

  it("rejects duplicate target IDs and more than forty operations", () => {
    expect(() => validateDrawingOperations([
      { op: "update", id: "selected-rectangle", patch: { x: 40 } },
      { op: "delete", id: "selected-rectangle" },
    ], selectedContext)).toThrow(/duplicate/i);

    const operations = Array.from({ length: 41 }, (_, index) => ({
      op: "add" as const,
      element: { type: "ellipse" as const, x: index, y: 0, width: 10, height: 10 },
    }));
    expect(() => validateDrawingOperations(operations, selectedContext)).toThrow(/40 operations/i);
  });
});
