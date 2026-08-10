import { exportToBlob } from "@excalidraw/excalidraw";
import type { BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  SelectionBounds,
  SemanticSelectionElement,
} from "../../../shared/contracts/generation";

type SelectionApi = Pick<
  ExcalidrawImperativeAPI,
  "getAppState" | "getSceneElements"
>;

/** The in-memory selection used to build the transport context and PNG. */
export interface SelectionContext {
  elements: readonly NonDeletedExcalidrawElement[];
  semantic: {
    elements: SemanticSelectionElement[];
    bounds: SelectionBounds;
  };
}

/**
 * Reduces the current Excalidraw selection to the information the generation
 * service can use. Text is included only when the selected container directly
 * owns it, so a stale or unrelated text element is never pulled into context.
 */
export function getSelectionContext(api: SelectionApi): SelectionContext {
  const sceneElements = api.getSceneElements();
  const selectedElementIds = api.getAppState().selectedElementIds;
  const selectedIds = new Set(
    Object.entries(selectedElementIds)
      .filter(([, isSelected]) => isSelected)
      .map(([id]) => id),
  );
  const elementsById = new Map(sceneElements.map((element) => [element.id, element]));
  const selectedElements = sceneElements.filter((element) => selectedIds.has(element.id));

  for (const element of selectedElements) {
    for (const boundElement of element.boundElements ?? []) {
      if (boundElement.type !== "text") {
        continue;
      }

      const textElement = elementsById.get(boundElement.id);
      if (textElement?.type === "text" && textElement.containerId === element.id) {
        selectedIds.add(textElement.id);
      }
    }
  }

  const elements = sceneElements.filter((element) => selectedIds.has(element.id));
  if (elements.length === 0) {
    return {
      elements,
      semantic: {
        elements: [],
        bounds: { x: 0, y: 0, width: 1, height: 1 },
      },
    };
  }

  return {
    elements,
    semantic: {
      elements: elements.map(toSemanticElement),
      bounds: getCommonBounds(elements),
    },
  };
}

/** Exports the selected Excalidraw elements as an image payload for a vision model. */
export async function exportSelectionPng(
  context: SelectionContext,
  files: BinaryFiles,
): Promise<string> {
  if (context.elements.length === 0) {
    throw new Error("Select at least one element before generating an interface");
  }

  const png = await exportToBlob({
    elements: context.elements,
    files,
    mimeType: "image/png",
  });
  if (png.size === 0) {
    throw new Error("Excalidraw produced an empty PNG export");
  }

  const pngDataUrl = await blobToDataUrl(png);
  if (!pngDataUrl.startsWith("data:image/png;base64,") || pngDataUrl.endsWith(",")) {
    throw new Error("Excalidraw produced an empty PNG data URL");
  }

  return pngDataUrl;
}

function toSemanticElement(element: NonDeletedExcalidrawElement): SemanticSelectionElement {
  const bindings: Record<string, unknown> = {};
  if (element.type === "text" && element.containerId) {
    bindings.containerId = element.containerId;
  }
  if ("startBinding" in element && element.startBinding) {
    bindings.startBinding = element.startBinding;
  }
  if ("endBinding" in element && element.endBinding) {
    bindings.endBinding = element.endBinding;
  }

  return {
    id: element.id,
    type: element.type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    ...(element.type === "text" ? { text: element.text } : {}),
    strokeColor: element.strokeColor,
    backgroundColor: element.backgroundColor,
    ...(element.frameId ? { frameId: element.frameId } : {}),
    ...(element.groupIds.length > 0 ? { groupIds: [...element.groupIds] } : {}),
    ...(element.boundElements
      ? { boundElements: element.boundElements.map(({ id, type }) => ({ id, type })) }
      : {}),
    ...(Object.keys(bindings).length > 0 ? { bindings } : {}),
  };
}

function getCommonBounds(elements: readonly NonDeletedExcalidrawElement[]): SelectionBounds {
  const left = Math.min(...elements.map((element) => Math.min(element.x, element.x + element.width)));
  const top = Math.min(...elements.map((element) => Math.min(element.y, element.y + element.height)));
  const right = Math.max(...elements.map((element) => Math.max(element.x, element.x + element.width)));
  const bottom = Math.max(...elements.map((element) => Math.max(element.y, element.y + element.height)));

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read PNG export"));
      }
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Unable to read PNG export")));
    reader.readAsDataURL(blob);
  });
}
