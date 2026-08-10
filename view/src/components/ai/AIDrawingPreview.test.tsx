import React from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAIDrawingStore } from "../../stores/ai-drawing-store";
import { AIDrawingPreview } from "./AIDrawingPreview";

const nextElements = [
  { id: "added", type: "rectangle", isDeleted: false },
  { id: "updated", type: "text", isDeleted: false },
  { id: "deleted", type: "ellipse", isDeleted: true },
] as never[];

const api = {
  updateScene: vi.fn(),
} as unknown as ExcalidrawImperativeAPI;

beforeEach(() => {
  vi.mocked(api.updateScene).mockReset();
  useAIDrawingStore.getState().clearProposal();
});

afterEach(cleanup);

describe("AIDrawingPreview", () => {
  it("shows change counts, the model note, and explicit actions", () => {
    useAIDrawingStore.getState().setProposal({
      baseDrawingVersion: 7,
      note: "Aligned the content and simplified the footer.",
      preview: {
        nextElements,
        addedIds: ["added"],
        updatedIds: ["updated"],
        deletedIds: ["deleted"],
      },
    });

    render(<AIDrawingPreview api={api} currentDrawingVersion={7} persist={vi.fn()} onRegenerate={vi.fn()} />);

    expect(screen.getByText("1 added")).toBeTruthy();
    expect(screen.getByText("1 updated")).toBeTruthy();
    expect(screen.getByText("1 deleted")).toBeTruthy();
    expect(screen.getByText("Aligned the content and simplified the footer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeTruthy();
  });

  it("does not mutate or persist the drawing before Apply", async () => {
    const user = userEvent.setup();
    const persist = vi.fn();
    const onRegenerate = vi.fn();
    useAIDrawingStore.getState().setProposal({
      baseDrawingVersion: 7,
      preview: { nextElements, addedIds: ["added"], updatedIds: ["updated"], deletedIds: ["deleted"] },
    });

    render(<AIDrawingPreview api={api} currentDrawingVersion={7} persist={persist} onRegenerate={onRegenerate} />);

    expect(api.updateScene).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(api.updateScene).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("discards without touching the Excalidraw API or persistence", async () => {
    const user = userEvent.setup();
    const persist = vi.fn();
    useAIDrawingStore.getState().setProposal({
      baseDrawingVersion: 7,
      preview: { nextElements, addedIds: ["added"], updatedIds: ["updated"], deletedIds: ["deleted"] },
    });

    render(<AIDrawingPreview api={api} currentDrawingVersion={7} persist={persist} onRegenerate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(useAIDrawingStore.getState().proposal).toBeNull();
    expect(api.updateScene).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("applies only at the matching drawing version and persists afterward", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const persist = vi.fn(async () => { calls.push("persist"); });
    vi.mocked(api.updateScene).mockImplementation(() => { calls.push("scene"); });
    useAIDrawingStore.getState().setProposal({
      baseDrawingVersion: 7,
      preview: { nextElements, addedIds: ["added"], updatedIds: ["updated"], deletedIds: ["deleted"] },
    });

    render(<AIDrawingPreview api={api} currentDrawingVersion={7} persist={persist} onRegenerate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(api.updateScene).toHaveBeenCalledWith({ elements: nextElements });
    expect(persist).toHaveBeenCalledWith(nextElements);
    expect(calls).toEqual(["scene", "persist"]);
    expect(useAIDrawingStore.getState().proposal).toBeNull();
  });

  it("rejects Apply when the drawing version changed", async () => {
    const user = userEvent.setup();
    const persist = vi.fn();
    useAIDrawingStore.getState().setProposal({
      baseDrawingVersion: 7,
      preview: { nextElements, addedIds: ["added"], updatedIds: ["updated"], deletedIds: ["deleted"] },
    });

    render(<AIDrawingPreview api={api} currentDrawingVersion={8} persist={persist} onRegenerate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByRole("alert").textContent).toMatch(/drawing changed/i);
    expect(api.updateScene).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    expect(useAIDrawingStore.getState().proposal).not.toBeNull();
  });
});
