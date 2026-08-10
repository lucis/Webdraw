import { restoreElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useState } from "react";
import type { ArtifactRecord, ArtifactVersion } from "../../../shared/contracts/artifacts";
import { calculateArtifactBounds } from "../lib/artifact-position";
import { requestJson } from "../lib/api";
import { exportSelectionPng, getSelectionContext } from "../lib/selection";
import { artifactLink, getArtifactIdFromLink, type ArtifactEmbedCustomData } from "../components/artifacts/ArtifactEmbed";
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

/** Captures a source selection or revisions one selected artifact from its annotations. */
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
      const selectedEmbeds = selection.elements.flatMap((element) => {
        if (element.type !== "embeddable") return [];
        const artifactId = getArtifactIdFromLink(element.link);
        return artifactId ? [{ element, artifactId }] : [];
      });
      const revision = selectedEmbeds.length === 1 ? selectedEmbeds[0] : null;

      setPhase("requesting");
      if (revision) {
        const artifactStore = useArtifactStore.getState();
        const loaded = artifactStore.artifacts[revision.artifactId]
          ?? await artifactStore.loadArtifact(revision.artifactId);
        const active = loaded.versions.find((version) => version.version === loaded.artifact.activeVersion);
        if (!active || active.artifact.kind !== "html") {
          throw new Error("The selected artifact has no active HTML source");
        }

        const response = await requestJson<InterfaceGenerationResponse>("/api/generations/interface", {
          method: "POST",
          body: JSON.stringify({
            mode: "revise",
            kind: "html",
            drawingId: drawing.id,
            drawingVersion: drawing.version,
            model,
            ...(instruction ? { instruction } : {}),
            artifactId: revision.artifactId,
            expectedActiveVersion: loaded.artifact.activeVersion,
            currentSourceHtml: active.artifact.sourceHtml,
            artifactDimensions: { width: revision.element.width, height: revision.element.height },
            selection: {
              pngDataUrl,
              semantic: {
                ...selection.semantic,
                elements: selection.semantic.elements.filter((element) => element.id !== revision.element.id),
              },
            },
          }),
        });
        useArtifactStore.getState().upsertArtifact(response.artifact, response.version);
        useArtifactStore.getState().showCandidate(revision.artifactId, response.version.version);
        setPhase("idle");
        return;
      }

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
