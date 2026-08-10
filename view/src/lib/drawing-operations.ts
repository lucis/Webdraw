import {
  convertToExcalidrawElements,
  newElementWith,
  restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  OrderedExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";
import type {
  DrawingOperation,
  UpdateOperation,
} from "../../../shared/contracts/drawing-operations";

export interface OperationPreview {
  nextElements: OrderedExcalidrawElement[];
  addedIds: string[];
  updatedIds: string[];
  deletedIds: string[];
}

/**
 * Materializes an already validated model proposal without changing the live
 * scene. Excalidraw owns element defaults/versioning and repairs bindings in
 * the resulting detached scene before it can be presented to the user.
 */
export function materializeOperations(
  currentElements: readonly ExcalidrawElement[],
  operations: readonly DrawingOperation[],
): OperationPreview {
  const occupiedIds = new Set(currentElements.map((element) => element.id));
  const addedIds: string[] = [];
  const updatedIds: string[] = [];
  const deletedIds: string[] = [];
  const replacements = new Map<string, ExcalidrawElement>();

  for (const operation of operations) {
    if (operation.op === "add") {
      const id = createUniqueId(occupiedIds);
      const [element] = convertToExcalidrawElements([
        { ...operation.element, id } as ExcalidrawElementSkeleton,
      ], { regenerateIds: false });
      if (!element) throw new Error("Excalidraw could not create the proposed element");
      occupiedIds.add(element.id);
      addedIds.push(element.id);
      replacements.set(element.id, element);
      continue;
    }

    const current = currentElements.find((element) => element.id === operation.id);
    if (!current) throw new Error(`Drawing operation targets missing element "${operation.id}"`);

    if (operation.op === "update") {
      replacements.set(current.id, materializeUpdate(current, operation.patch));
      updatedIds.push(current.id);
    } else {
      replacements.set(current.id, newElementWith(current, { isDeleted: true }));
      deletedIds.push(current.id);
    }
  }

  const nextElements = currentElements.map((element) => replacements.get(element.id) ?? element);
  for (const id of addedIds) {
    const added = replacements.get(id);
    if (added) nextElements.push(added);
  }

  return {
    nextElements: restoreElements(nextElements, currentElements, { repairBindings: true }),
    addedIds,
    updatedIds,
    deletedIds,
  };
}

function materializeUpdate(
  current: ExcalidrawElement,
  patch: UpdateOperation["patch"],
): ExcalidrawElement {
  assertPatchMatchesElementType(current, patch);

  if (current.type === "line" || current.type === "arrow") {
    const hasGeometryChange = patch.width !== undefined || patch.height !== undefined;
    if (!hasGeometryChange) return newElementWith(current, patch as never);

    const { points, firstPoint } = resizeLinearPoints(current, patch.width, patch.height);
    return newElementWith(current, {
      ...patch,
      x: patch.x ?? current.x + firstPoint[0],
      y: patch.y ?? current.y + firstPoint[1],
      points,
    } as never);
  }

  if (current.type === "text") {
    const updated = newElementWith(current, {
      ...patch,
      ...(patch.text !== undefined ? { originalText: patch.text } : {}),
      ...(patch.width !== undefined ? { autoResize: false } : {}),
    } as never);
    const [normalized] = restoreElements([updated], [current], {
      refreshDimensions: true,
      repairBindings: true,
    });
    if (!normalized || normalized.type !== "text") {
      throw new Error("Excalidraw could not normalize the proposed text update");
    }
    return normalized;
  }

  return newElementWith(current, patch as never);
}

function resizeLinearPoints(
  element: ExcalidrawLinearElement,
  width: number | undefined,
  height: number | undefined,
): { points: ExcalidrawLinearElement["points"]; firstPoint: readonly [number, number] } {
  const firstPoint = element.points[0] ?? [0, 0];
  const points = element.points.map(([x, y]) => [x - firstPoint[0], y - firstPoint[1]]);
  if (width !== undefined) rescalePointDimension(points, 0, width);
  if (height !== undefined) rescalePointDimension(points, 1, height);
  return {
    points: points as unknown as ExcalidrawLinearElement["points"],
    firstPoint,
  };
}

function rescalePointDimension(points: number[][], dimension: 0 | 1, targetSize: number) {
  const values = points.map((point) => point[dimension] ?? 0);
  const currentSize = Math.max(...values) - Math.min(...values);
  if (currentSize === 0) {
    const last = points.at(-1);
    if (last) last[dimension] = targetSize;
    return;
  }
  const scale = targetSize / currentSize;
  for (const point of points) point[dimension] = (point[dimension] ?? 0) * scale;
}

function assertPatchMatchesElementType(
  element: ExcalidrawElement,
  patch: UpdateOperation["patch"],
) {
  const fields = Object.keys(patch);
  const supportedFields = element.type === "text"
    ? TEXT_PATCH_FIELDS
    : element.type === "line" || element.type === "arrow"
      ? LINEAR_PATCH_FIELDS
      : COMMON_PATCH_FIELDS;
  const unsupported = fields.find((field) => !supportedFields.has(field));
  if (unsupported) {
    throw new Error(`Drawing operation field "${unsupported}" is not supported for ${element.type} elements`);
  }
}

const COMMON_PATCH_FIELDS = new Set([
  "x",
  "y",
  "width",
  "height",
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
]);
const LINEAR_PATCH_FIELDS = new Set([
  ...COMMON_PATCH_FIELDS,
  "startArrowhead",
  "endArrowhead",
]);
const TEXT_PATCH_FIELDS = new Set([
  ...COMMON_PATCH_FIELDS,
  "fontSize",
  "fontFamily",
  "textAlign",
  "verticalAlign",
  "text",
]);

function createUniqueId(occupiedIds: ReadonlySet<string>): string {
  let id: string;
  do {
    id = crypto.randomUUID();
  } while (occupiedIds.has(id));
  return id;
}
