import type { Model, ModelPurpose } from "../../shared/contracts/models";
import { AppError } from "../lib/errors";

export interface OpenRouterModelCatalogResponse {
  data: Array<{
    id: string;
    name: string;
    architecture?: { input_modalities?: string[] | null } | null;
    supported_parameters?: string[] | null;
    context_length?: number | null;
    pricing?: {
      prompt?: string;
      completion?: string;
      image?: string;
      request?: string;
    } | null;
  }>;
}

export type ModelCapabilities = Pick<Model, "inputModalities" | "supportedParameters">;

export function normalizeOpenRouterModels(catalog: OpenRouterModelCatalogResponse): Model[] {
  return catalog.data.map((model) => ({
    id: model.id,
    name: model.name,
    inputModalities: model.architecture?.input_modalities ?? [],
    supportedParameters: model.supported_parameters ?? [],
    contextLength: model.context_length ?? null,
    pricing: model.pricing ?? null,
  }));
}

export function supportsStructuredOutput(model: ModelCapabilities): boolean {
  return model.supportedParameters.includes("response_format");
}

export function supportsInterfaceGeneration(model: ModelCapabilities): boolean {
  return model.inputModalities.includes("image") && supportsStructuredOutput(model);
}

export function supportsPurpose(model: Model, purpose: ModelPurpose): boolean {
  switch (purpose) {
    case "interface":
      return supportsInterfaceGeneration(model);
    case "drawing":
    case "code-revision":
      return supportsStructuredOutput(model);
  }
}

export function filterModelsForPurpose(models: Model[], purpose: ModelPurpose): Model[] {
  return models.filter((model) => supportsPurpose(model, purpose));
}

/**
 * Intended for generation handlers. It deliberately bypasses the public
 * catalog cache so an availability or capability change is caught immediately
 * before the provider call.
 */
export async function requireCompatibleModel(
  listModels: () => Promise<Model[]>,
  modelId: string,
  purpose: ModelPurpose,
): Promise<Model> {
  const model = (await listModels()).find((candidate) => candidate.id === modelId);
  if (!model || !supportsPurpose(model, purpose)) {
    throw new AppError(400, "validation_failed", "Selected model does not support this operation");
  }
  return model;
}
