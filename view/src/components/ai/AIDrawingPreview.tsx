import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import React from "react";
import { useState } from "react";
import { useAIDrawingStore } from "../../stores/ai-drawing-store";

interface AIDrawingPreviewProps {
  api: Pick<ExcalidrawImperativeAPI, "updateScene">;
  currentDrawingVersion: number;
  persist: (elements: readonly ExcalidrawElement[]) => Promise<void> | void;
  onRegenerate: () => Promise<void> | void;
}

export function AIDrawingPreview({
  api,
  currentDrawingVersion,
  persist,
  onRegenerate,
}: AIDrawingPreviewProps) {
  const proposal = useAIDrawingStore((state) => state.proposal);
  const applyProposal = useAIDrawingStore((state) => state.applyProposal);
  const discardProposal = useAIDrawingStore((state) => state.discardProposal);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  if (!proposal) return null;

  const apply = async () => {
    setError(null);
    setIsApplying(true);
    try {
      await applyProposal({ api, currentDrawingVersion, persist });
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Unable to apply drawing proposal");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <section aria-label="AI drawing preview" className="rounded-xl border border-violet-300 bg-white p-4 shadow-xl">
      <h2 className="text-sm font-semibold text-slate-900">Proposed drawing changes</h2>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
        <span>{countLabel(proposal.preview.addedIds.length, "added")}</span>
        <span>{countLabel(proposal.preview.updatedIds.length, "updated")}</span>
        <span>{countLabel(proposal.preview.deletedIds.length, "deleted")}</span>
      </div>
      {proposal.note && <p className="mt-3 text-sm text-slate-700">{proposal.note}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={isApplying} onClick={() => void apply()}>
          {isApplying ? "Applying…" : "Apply"}
        </button>
        <button type="button" disabled={isApplying} onClick={discardProposal}>Discard</button>
        <button type="button" disabled={isApplying} onClick={() => void onRegenerate()}>Regenerate</button>
      </div>
    </section>
  );
}

function countLabel(count: number, change: "added" | "updated" | "deleted"): string {
  return `${count} ${change}`;
}
