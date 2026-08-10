import { describe, expect, it } from "vitest";
import { interfaceGenerationRequestSchema } from "../../shared/contracts/generation";

const validRequest = {
  kind: "html",
  drawingId: "drawing-123",
  drawingVersion: 4,
  model: "openrouter/vision-model",
  instruction: "Use the source layout and make the checkout card compact.",
  selection: {
    pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    semantic: {
      elements: [{ id: "checkout-card", type: "rectangle", x: 10, y: 20, width: 320, height: 180 }],
      bounds: { x: 10, y: 20, width: 320, height: 180 },
    },
  },
};

describe("interface generation request contract", () => {
  it("accepts an HTML-only drawing selection request", () => {
    const result = interfaceGenerationRequestSchema.safeParse(validRequest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        kind: "html",
        drawingId: "drawing-123",
        drawingVersion: 4,
        selection: { semantic: { bounds: { width: 320, height: 180 } } },
      });
    }
  });

  it("rejects a reserved React artifact generation request", () => {
    const result = interfaceGenerationRequestSchema.safeParse({ ...validRequest, kind: "react" });

    expect(result.success).toBe(false);
  });
});
