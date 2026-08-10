import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "../../lib/api";
import { useArtifactStore } from "../../stores/artifact-store";
import { ArtifactEditor } from "./ArtifactEditor";

vi.mock("../../lib/api", () => ({ requestJson: vi.fn() }));

const artifact = {
  id: "01234567-89ab-4cde-8fab-0123456789ab",
  drawingId: "drawing-123",
  kind: "html" as const,
  activeVersion: 1,
  createdAt: 1,
  updatedAt: 1,
};

const activeSource = "<!doctype html><html><head><title>Active</title></head><body>Active</body></html>";
const candidateSource = "<!doctype html><html><head><title>Candidate</title></head><body>Candidate</body></html>";

const activeVersion = {
  artifactId: artifact.id,
  version: 1,
  artifact: { kind: "html" as const, title: "Active", sourceHtml: activeSource },
  metadata: { prompt: null, model: null, sourceSnapshot: null },
  createdAt: 1,
};

const candidateVersion = {
  ...activeVersion,
  version: 2,
  artifact: { kind: "html" as const, title: "Candidate", sourceHtml: candidateSource },
};

function renderEditor(versions = [activeVersion, candidateVersion], currentArtifact = artifact) {
  useArtifactStore.setState({
    artifacts: {
      [artifact.id]: { artifact: currentArtifact, versions, candidateVersion: null, previewError: null },
    },
    initialLoadErrors: {},
  });
  return render(<ArtifactEditor artifactId={artifact.id} />);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  useArtifactStore.setState({ artifacts: {}, initialLoadErrors: {} });
});

describe("ArtifactEditor", () => {
  it("keeps all editable source in one textarea and marks unsaved changes", async () => {
    const user = userEvent.setup();
    renderEditor([activeVersion]);

    const source = screen.getByRole("textbox", { name: "HTML source" });
    expect((source as HTMLTextAreaElement).value).toBe(activeSource);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);

    await user.type(source, " ");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });

  it("previews a candidate without changing the active version", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "Preview version 2" }));

    expect(useArtifactStore.getState().artifacts[artifact.id]?.candidateVersion).toBe(2);
    expect(useArtifactStore.getState().artifacts[artifact.id]?.artifact.activeVersion).toBe(1);
    expect(vi.mocked(requestJson)).not.toHaveBeenCalled();
  });

  it("discards a candidate preview and restores the active source", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Preview version 2" }));
    await user.click(screen.getByRole("button", { name: "Discard candidate" }));

    expect(useArtifactStore.getState().artifacts[artifact.id]?.candidateVersion).toBeNull();
    expect((screen.getByRole("textbox", { name: "HTML source" }) as HTMLTextAreaElement).value).toBe(activeSource);
  });

  it("saves a draft as a candidate and applies it in a separate activation request", async () => {
    const user = userEvent.setup();
    renderEditor([activeVersion]);
    vi.mocked(requestJson)
      .mockResolvedValueOnce({ artifact, version: candidateVersion })
      .mockResolvedValueOnce({ artifact: { ...artifact, activeVersion: 2 } });

    fireEvent.change(screen.getByRole("textbox", { name: "HTML source" }), { target: { value: candidateSource } });
    await user.click(screen.getByRole("button", { name: "Save candidate" }));

    await waitFor(() => expect(useArtifactStore.getState().artifacts[artifact.id]?.candidateVersion).toBe(2));
    expect(useArtifactStore.getState().artifacts[artifact.id]?.artifact.activeVersion).toBe(1);

    await user.click(screen.getByRole("button", { name: "Apply candidate" }));
    await waitFor(() => expect(useArtifactStore.getState().artifacts[artifact.id]?.artifact.activeVersion).toBe(2));
    expect(useArtifactStore.getState().artifacts[artifact.id]?.candidateVersion).toBeNull();
    expect(vi.mocked(requestJson)).toHaveBeenNthCalledWith(2, `/api/artifacts/${artifact.id}/activate/2`, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ expectedActiveVersion: 1 }),
    }));
  });

  it("restores an earlier version by activation without rewriting immutable source", async () => {
    const user = userEvent.setup();
    renderEditor([activeVersion, candidateVersion], { ...artifact, activeVersion: 2 });
    vi.mocked(requestJson).mockResolvedValue({ artifact: { ...artifact, activeVersion: 1 } });

    await user.click(screen.getByRole("button", { name: "Restore version 1" }));

    await waitFor(() => expect(useArtifactStore.getState().artifacts[artifact.id]?.artifact.activeVersion).toBe(1));
    expect(vi.mocked(requestJson)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(requestJson)).toHaveBeenCalledWith(`/api/artifacts/${artifact.id}/activate/1`, expect.objectContaining({ method: "POST" }));
    expect(useArtifactStore.getState().artifacts[artifact.id]?.versions).toEqual([activeVersion, candidateVersion]);
  });
});
