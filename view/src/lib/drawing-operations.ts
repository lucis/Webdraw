import {
  convertToExcalidrawElements,
  newElementWith,
  restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";
import type { DrawingOperation } from "../../../shared/contracts/drawing-operations";

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
      ]);
      if (!element) throw new Error("Excalidraw could not create the proposed element");
      occupiedIds.add(element.id);
      addedIds.push(element.id);
      replacements.set(element.id, element);
      continue;
    }

    const current = currentElements.find((element) => element.id === operation.id);
    if (!current) throw new Error(`Drawing operation targets missing element "${operation.id}"`);

    if (operation.op === "update") {
      replacements.set(current.id, newElementWith(current, operation.patch as never));
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

function createUniqueId(occupiedIds: ReadonlySet<string>): string {
  let id: string;
  do {
    id = crypto.randomUUID();
  } while (occupiedIds.has(id));
  return id;
}
