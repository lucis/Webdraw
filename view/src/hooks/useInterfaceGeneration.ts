import { restoreElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useState } from "react";
import type { ArtifactRecord, ArtifactVersion } from "../../../shared/contracts/artifacts";
import { calculateArtifactBounds } from "../lib/artifact-position";
import { requestJson } from "../lib/api";
import { exportSelectionPng, getSelectionContext } from "../lib/selection";
import { artifactLink, type ArtifactEmbedCustomData } from "../components/artifacts/ArtifactEmbed";
import { useArtifactStore } from "../stores/artifact-store";

type GenerationPhase = "idle" | "capturing" | "requesting" | "placing" | "error";

interface InterfaceGenerationOptions {
  api: ExcalidrawImperativeAPI | null;
  drawing: { id: string; version: number } | null;
}

interface GenerateInterfaceOptions {
  model: string;
  instruction?: string;
}

interface InterfaceGenerationResponse {
  artifact: ArtifactRecord;
  version: ArtifactVersion;
}

/** Captures the live selection, creates the artifact, and appends its canvas embed. */
export function useInterfaceGeneration({ api, drawing }: InterfaceGenerationOptions) {
  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async ({ model, instruction }: GenerateInterfaceOptions) => {
    if (!api || !drawing) throw new Error("Open a drawing before generating an interface");

    setError(null);
    setPhase("capturing");
    try {
      const selection = getSelectionContext(api);
      const pngDataUrl = await exportSelectionPng(selection, api.getFiles());

      setPhase("requesting");
      const response = await requestJson<InterfaceGenerationResponse>("/api/generations/interface", {
        method: "POST",
        body: JSON.stringify({
          kind: "html",
          drawingId: drawing.id,
          drawingVersion: drawing.version,
          model,
          ...(instruction ? { instruction } : {}),
          selection: {
            pngDataUrl,
            semantic: selection.semantic,
          },
        }),
      });

      setPhase("placing");
      const bounds = calculateArtifactBounds(selection.semantic.bounds);
      const customData: ArtifactEmbedCustomData = {
        webdraw: { kind: "artifact", artifactId: response.artifact.id, schemaVersion: 1 },
      };
      const currentElements = api.getSceneElements();
      const restoredElements = restoreElements([
        ...currentElements,
        {
          type: "embeddable",
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          link: artifactLink(response.artifact.id),
          customData,
        },
      ], currentElements);
      const restoredEmbed = restoredElements[restoredElements.length - 1];
      if (!restoredEmbed || restoredEmbed.type !== "embeddable") {
        throw new Error("Unable to create artifact embed");
      }

      api.updateScene({ elements: restoredElements });
      api.scrollToContent([...selection.elements, restoredEmbed], { fitToContent: true, animate: true });
      useArtifactStore.getState().upsertArtifact(response.artifact, response.version);
      setPhase("idle");
    } catch (generationError) {
      setPhase("error");
      setError(generationError instanceof Error ? generationError.message : "Unable to generate interface");
      throw generationError;
    }
  }, [api, drawing]);

  return { phase, error, generate };
}
