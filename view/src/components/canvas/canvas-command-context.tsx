import { createContext, useContext } from "react";
import type { ListModelsResponse } from "../../../../shared/contracts/models";

export type CanvasGenerationPhase = "idle" | "capturing" | "requesting" | "placing" | "error";

export interface CanvasCommandContextValue {
  canGenerate: boolean;
  generationLabel: "Generate interface" | "Update interface" | "Generating interface…" | "Updating interface…";
  generationPhase: CanvasGenerationPhase;
  models: ListModelsResponse["models"];
  activeModelId: string | null;
  setActiveModelId: (modelId: string) => void;
  generateInterface: () => void;
  error: string | null;
}

export const CanvasCommandContext = createContext<CanvasCommandContextValue | null>(null);

export function useCanvasCommands(): CanvasCommandContextValue {
  const commands = useContext(CanvasCommandContext);
  if (!commands) throw new Error("useCanvasCommands must be used within ExcalidrawCanvas");
  return commands;
}
