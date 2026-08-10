import { z } from "zod";

export const modelPurposeSchema = z.enum(["interface", "drawing", "code-revision"]);

export const modelPricingSchema = z.object({
  prompt: z.string().optional(),
  completion: z.string().optional(),
  image: z.string().optional(),
  request: z.string().optional(),
}).strip();

/** Public, credential-free subset of an OpenRouter catalog entry. */
export const modelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  inputModalities: z.array(z.string()),
  supportedParameters: z.array(z.string()),
  contextLength: z.number().int().nonnegative().nullable(),
  pricing: modelPricingSchema.nullable(),
}).strip();

export const listModelsQuerySchema = z.object({
  purpose: modelPurposeSchema,
}).strip();

export const listModelsResponseSchema = z.object({
  purpose: modelPurposeSchema,
  models: z.array(modelSchema),
}).strip();

export type ModelPurpose = z.infer<typeof modelPurposeSchema>;
export type ModelPricing = z.infer<typeof modelPricingSchema>;
export type Model = z.infer<typeof modelSchema>;
export type ListModelsResponse = z.infer<typeof listModelsResponseSchema>;
