import type { NonDeleted } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawEmbeddableElement } from "@excalidraw/excalidraw/element/types";
import React, { useEffect, useMemo, useRef } from "react";
import { ARTIFACT_SANDBOX, buildArtifactDocument } from "../../lib/artifact-document";
import { useArtifactStore } from "../../stores/artifact-store";
import { ArtifactControls } from "./ArtifactControls";

const artifactLinkPrefix = "webdraw://artifact/";
const artifactIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ArtifactEmbedCustomData {
  webdraw: {
    kind: "artifact";
    artifactId: string;
    schemaVersion: 1;
  };
}

export function artifactLink(artifactId: string): string {
  return `${artifactLinkPrefix}${artifactId}`;
}

export function getArtifactIdFromLink(link: string | null | undefined): string | null {
  if (!link?.startsWith(artifactLinkPrefix)) return null;
  const artifactId = link.slice(artifactLinkPrefix.length);
  return artifactIdPattern.test(artifactId) ? artifactId : null;
}

export function isArtifactEmbedLink(link: string | null | undefined): boolean {
  return getArtifactIdFromLink(link) !== null;
}

interface ArtifactEmbedProps {
  element: NonDeleted<ExcalidrawEmbeddableElement>;
}

export function ArtifactEmbed({ element }: ArtifactEmbedProps) {
  const artifactId = getArtifactIdFromLink(element.link);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadedArtifact = useArtifactStore((state) => artifactId ? state.artifacts[artifactId] : undefined);
  const initialLoadError = useArtifactStore((state) => artifactId ? state.initialLoadErrors[artifactId] ?? null : null);
  const loadArtifact = useArtifactStore((state) => state.loadArtifact);
  const reload = useArtifactStore((state) => state.reload);
  const setPreviewError = useArtifactStore((state) => state.setPreviewError);

  useEffect(() => {
    if (!artifactId || loadedArtifact) return;
    void loadArtifact(artifactId).catch((error: unknown) => {
      setPreviewError(artifactId, error instanceof Error ? error.message : "Unable to load artifact");
    });
  }, [artifactId, loadedArtifact, loadArtifact, setPreviewError]);

  useEffect(() => {
    if (!artifactId) return;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== "object" || (message as { type?: unknown }).type !== "webdraw:artifact-error") return;
      const detail = (message as { message?: unknown }).message;
      setPreviewError(artifactId, typeof detail === "string" ? detail : "Unknown runtime error");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [artifactId, setPreviewError]);

  const version = useMemo(() => {
    if (!loadedArtifact) return null;
    const selectedVersion = loadedArtifact.candidateVersion ?? loadedArtifact.artifact.activeVersion;
    return loadedArtifact.versions.find((item) => item.version === selectedVersion) ?? null;
  }, [loadedArtifact]);

  if (!artifactId) return null;

  const previewError = loadedArtifact?.previewError ?? initialLoadError;
  if (previewError) {
    return (
      <div role="alert" className="h-full w-full p-3 text-sm text-red-700 bg-red-50 overflow-auto">
        <p>{previewError}</p>
        <button type="button" onClick={() => void reload(artifactId).catch(() => undefined)}>Reload preview</button>
      </div>
    );
  }

  if (!version || version.artifact.kind !== "html") {
    return <div className="h-full w-full p-3 text-sm text-slate-600">Loading artifact…</div>;
  }

  return (
    <div className="relative h-full w-full">
      <iframe
        ref={iframeRef}
        title={version.artifact.title}
        className="h-full w-full border-0 bg-white"
        sandbox={ARTIFACT_SANDBOX}
        srcDoc={buildArtifactDocument(version.artifact.sourceHtml)}
      />
      <div className="absolute right-2 top-2 z-10">
        <ArtifactControls artifactId={artifactId} />
      </div>
    </div>
  );
}
