import React, { useState } from "react";
import { useArtifactStore } from "../../stores/artifact-store";
import { ArtifactEditor } from "./ArtifactEditor";

interface ArtifactControlsProps {
  artifactId: string;
}

/** Small preview controls shared by future editing and revision affordances. */
export function ArtifactControls({ artifactId }: ArtifactControlsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const artifact = useArtifactStore((state) => state.artifacts[artifactId]);
  const showActive = useArtifactStore((state) => state.showActive);
  const reload = useArtifactStore((state) => state.reload);

  if (!artifact) return null;

  return (
    <div className="relative">
      <div className="flex gap-2">
        {artifact.candidateVersion !== null && (
          <button type="button" onClick={() => showActive(artifactId)}>Show active</button>
        )}
        <button type="button" onClick={() => setIsEditing(true)}>Edit source</button>
        <button type="button" onClick={() => void reload(artifactId).catch(() => undefined)}>Reload</button>
      </div>
      {isEditing && (
        <div className="absolute right-0 top-8 z-20">
          <ArtifactEditor artifactId={artifactId} onClose={() => setIsEditing(false)} />
        </div>
      )}
    </div>
  );
}
