import { create } from "zustand";
import type { ArtifactRecord, ArtifactVersion } from "../../../shared/contracts/artifacts";
import { requestJson } from "../lib/api";

export interface LoadedArtifact {
  artifact: ArtifactRecord;
  versions: ArtifactVersion[];
  candidateVersion: number | null;
  previewError: string | null;
}

interface ArtifactStoreState {
  artifacts: Record<string, LoadedArtifact>;
  loadArtifact: (artifactId: string) => Promise<LoadedArtifact>;
  reload: (artifactId: string) => Promise<LoadedArtifact>;
  upsertArtifact: (artifact: ArtifactRecord, version: ArtifactVersion) => void;
  showCandidate: (artifactId: string, version: number) => void;
  showActive: (artifactId: string) => void;
  setPreviewError: (artifactId: string, message: string | null) => void;
}

interface ArtifactResponse {
  artifact: ArtifactRecord;
  versions: ArtifactVersion[];
}

function toLoadedArtifact(response: ArtifactResponse): LoadedArtifact {
  return {
    artifact: response.artifact,
    versions: response.versions,
    candidateVersion: null,
    previewError: null,
  };
}

export const useArtifactStore = create<ArtifactStoreState>((set, get) => {
  const fetchArtifact = async (artifactId: string, force: boolean): Promise<LoadedArtifact> => {
    const current = get().artifacts[artifactId];
    if (current && !force) return current;

    const response = await requestJson<ArtifactResponse>(`/api/artifacts/${encodeURIComponent(artifactId)}`);
    const loaded = toLoadedArtifact(response);
    set((state) => ({ artifacts: { ...state.artifacts, [artifactId]: loaded } }));
    return loaded;
  };

  return {
    artifacts: {},
    loadArtifact: (artifactId) => fetchArtifact(artifactId, false),
    reload: (artifactId) => fetchArtifact(artifactId, true),
    upsertArtifact: (artifact, version) => set((state) => {
      const current = state.artifacts[artifact.id];
      const versions = current
        ? current.versions.some((item) => item.version === version.version)
          ? current.versions.map((item) => item.version === version.version ? version : item)
          : [...current.versions, version]
        : [version];
      return {
        artifacts: {
          ...state.artifacts,
          [artifact.id]: {
            artifact,
            versions,
            candidateVersion: current?.candidateVersion ?? null,
            previewError: current?.previewError ?? null,
          },
        },
      };
    }),
    showCandidate: (artifactId, version) => set((state) => {
      const current = state.artifacts[artifactId];
      if (!current || !current.versions.some((item) => item.version === version)) return state;
      return {
        artifacts: {
          ...state.artifacts,
          [artifactId]: { ...current, candidateVersion: version, previewError: null },
        },
      };
    }),
    showActive: (artifactId) => set((state) => {
      const current = state.artifacts[artifactId];
      if (!current) return state;
      return {
        artifacts: {
          ...state.artifacts,
          [artifactId]: { ...current, candidateVersion: null, previewError: null },
        },
      };
    }),
    setPreviewError: (artifactId, message) => set((state) => {
      const current = state.artifacts[artifactId];
      if (!current) return state;
      return {
        artifacts: {
          ...state.artifacts,
          [artifactId]: { ...current, previewError: message },
        },
      };
    }),
  };
});
