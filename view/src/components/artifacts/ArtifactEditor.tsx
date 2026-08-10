import React, { useEffect, useMemo, useState } from "react";
import type { ArtifactRecord, ArtifactVersion } from "../../../../shared/contracts/artifacts";
import { requestJson } from "../../lib/api";
import { useArtifactStore } from "../../stores/artifact-store";

interface ArtifactEditorProps {
  artifactId: string;
  onClose?: () => void;
}

interface CandidateResponse {
  artifact: ArtifactRecord;
  version: ArtifactVersion;
}

interface ActivationResponse {
  artifact: ArtifactRecord;
}

/**
 * The editor intentionally owns one source document. HTML, CSS, and script
 * content stay together so every saved candidate remains a complete version.
 */
export function ArtifactEditor({ artifactId, onClose }: ArtifactEditorProps) {
  const loaded = useArtifactStore((state) => state.artifacts[artifactId]);
  const showCandidate = useArtifactStore((state) => state.showCandidate);
  const showActive = useArtifactStore((state) => state.showActive);
  const upsertArtifact = useArtifactStore((state) => state.upsertArtifact);
  const [sourceHtml, setSourceHtml] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const active = useMemo(
    () => loaded?.versions.find((version) => version.version === loaded.artifact.activeVersion) ?? null,
    [loaded],
  );
  const selected = useMemo(
    () => loaded?.versions.find((version) => version.version === (loaded.candidateVersion ?? loaded.artifact.activeVersion)) ?? null,
    [loaded],
  );

  useEffect(() => {
    if (active?.artifact.kind === "html") setSourceHtml(active.artifact.sourceHtml);
  }, [active?.version, active?.artifact]);

  if (!loaded || !active || active.artifact.kind !== "html") return null;

  const selectedSource = selected?.artifact.kind === "html" ? selected.artifact.sourceHtml : active.artifact.sourceHtml;
  const isUnsaved = sourceHtml !== selectedSource;
  const candidate = loaded.candidateVersion === null
    ? null
    : loaded.versions.find((version) => version.version === loaded.candidateVersion) ?? null;

  const preview = (version: ArtifactVersion) => {
    if (version.artifact.kind !== "html") return;
    setRequestError(null);
    showCandidate(artifactId, version.version);
    setSourceHtml(version.artifact.sourceHtml);
  };

  const discard = () => {
    showActive(artifactId);
    setSourceHtml(active.artifact.sourceHtml);
    setRequestError(null);
  };

  const saveCandidate = async () => {
    if (!isUnsaved || isSubmitting) return;
    setIsSubmitting(true);
    setRequestError(null);
    try {
      const response = await requestJson<CandidateResponse>(`/api/artifacts/${encodeURIComponent(artifactId)}/versions`, {
        method: "POST",
        body: JSON.stringify({
          title: active.artifact.title,
          sourceHtml,
          expectedActiveVersion: loaded.artifact.activeVersion,
        }),
      });
      upsertArtifact(response.artifact, response.version);
      showCandidate(artifactId, response.version.version);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Unable to save candidate");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activate = async (version: ArtifactVersion) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setRequestError(null);
    try {
      const response = await requestJson<ActivationResponse>(
        `/api/artifacts/${encodeURIComponent(artifactId)}/activate/${version.version}`,
        { method: "POST", body: JSON.stringify({ expectedActiveVersion: loaded.artifact.activeVersion }) },
      );
      upsertArtifact(response.artifact, version);
      showActive(artifactId);
      if (version.artifact.kind === "html") setSourceHtml(version.artifact.sourceHtml);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Unable to activate version");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <aside aria-label="Artifact source editor" className="w-96 max-w-[calc(100vw-2rem)] space-y-3 rounded border bg-white p-3 text-sm shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <strong>Source HTML</strong>
        {onClose && <button type="button" onClick={onClose}>Close editor</button>}
      </div>
      <textarea
        aria-label="HTML source"
        className="min-h-48 w-full resize-y rounded border p-2 font-mono text-xs"
        value={sourceHtml}
        onChange={(event) => setSourceHtml(event.target.value)}
      />
      {isUnsaved && <p role="status">Unsaved changes</p>}
      {requestError && <p role="alert">{requestError}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!isUnsaved || isSubmitting} onClick={() => void saveCandidate()}>Save candidate</button>
        {candidate && <button type="button" disabled={isSubmitting} onClick={() => void activate(candidate)}>Apply candidate</button>}
        {loaded.candidateVersion !== null && <button type="button" disabled={isSubmitting} onClick={discard}>Discard candidate</button>}
      </div>
      <div aria-label="Artifact versions" className="space-y-1">
        {loaded.versions.map((version) => (
          <div key={version.version} className="flex items-center justify-between gap-2">
            <span>Version {version.version}{version.version === loaded.artifact.activeVersion ? " (active)" : ""}</span>
            <div className="flex gap-1">
              {version.version !== loaded.artifact.activeVersion && (
                <button type="button" disabled={isSubmitting} onClick={() => preview(version)}>Preview version {version.version}</button>
              )}
              {version.version !== loaded.artifact.activeVersion && (
                <button type="button" disabled={isSubmitting} onClick={() => void activate(version)}>Restore version {version.version}</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
