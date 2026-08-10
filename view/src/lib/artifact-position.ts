import type { SelectionBounds } from "../../../shared/contracts/generation";

const ARTIFACT_MIN_WIDTH = 640;
const ARTIFACT_MIN_HEIGHT = 360;
const ARTIFACT_HORIZONTAL_GAP = 80;

/** Places the generated artifact beside its source without changing its aspect ratio. */
export function calculateArtifactBounds(sourceBounds: SelectionBounds): SelectionBounds {
  const scale = Math.max(
    1,
    ARTIFACT_MIN_WIDTH / sourceBounds.width,
    ARTIFACT_MIN_HEIGHT / sourceBounds.height,
  );

  return {
    x: sourceBounds.x + sourceBounds.width + ARTIFACT_HORIZONTAL_GAP,
    y: sourceBounds.y,
    width: sourceBounds.width * scale,
    height: sourceBounds.height * scale,
  };
}
