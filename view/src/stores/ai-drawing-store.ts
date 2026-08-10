import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { create } from "zustand";
import type { OperationPreview } from "../lib/drawing-operations";

export interface AIDrawingProposal {
  baseDrawingVersion: number;
  preview: OperationPreview;
  note?: string;
}

interface ApplyProposalOptions {
  api: Pick<ExcalidrawImperativeAPI, "updateScene">;
  currentDrawingVersion: number;
  persist: (elements: readonly ExcalidrawElement[]) => Promise<void> | void;
}

interface AIDrawingState {
  proposal: AIDrawingProposal | null;
  setProposal: (proposal: AIDrawingProposal) => void;
  applyProposal: (options: ApplyProposalOptions) => Promise<void>;
  discardProposal: () => void;
  clearProposal: () => void;
}

export class StaleDrawingProposalError extends Error {
  constructor() {
    super("The drawing changed after this proposal was generated. Regenerate before applying it.");
    this.name = "StaleDrawingProposalError";
  }
}

export const useAIDrawingStore = create<AIDrawingState>((set, get) => ({
  proposal: null,

  setProposal: (proposal) => set({ proposal }),

  applyProposal: async ({ api, currentDrawingVersion, persist }) => {
    const proposal = get().proposal;
    if (!proposal) return;
    if (currentDrawingVersion !== proposal.baseDrawingVersion) {
      throw new StaleDrawingProposalError();
    }

    api.updateScene({ elements: proposal.preview.nextElements });
    await persist(proposal.preview.nextElements);
    if (get().proposal === proposal) set({ proposal: null });
  },

  discardProposal: () => set({ proposal: null }),
  clearProposal: () => set({ proposal: null }),
}));
