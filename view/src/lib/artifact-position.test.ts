import { describe, expect, it } from "vitest";
import { calculateArtifactBounds } from "./artifact-position";

describe("calculateArtifactBounds", () => {
  it("places a proportional artifact to the right of a standard source selection", () => {
    expect(calculateArtifactBounds({ x: 100, y: 50, width: 500, height: 300 }))
      .toEqual({ x: 680, y: 50, width: 640, height: 384 });
  });

  it("increases a narrow source to satisfy both minimum dimensions without distorting it", () => {
    expect(calculateArtifactBounds({ x: 10, y: 20, width: 300, height: 100 }))
      .toEqual({ x: 390, y: 20, width: 1080, height: 360 });
  });

  it("keeps a tall source aspect ratio while satisfying the minimum width", () => {
    expect(calculateArtifactBounds({ x: -50, y: 15, width: 200, height: 800 }))
      .toEqual({ x: 230, y: 15, width: 640, height: 2560 });
  });
});
