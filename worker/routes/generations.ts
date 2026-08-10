import { Hono } from "hono";
import { interfaceGenerationRequestSchema } from "../../shared/contracts/generation";
import type { ArtifactRecord, ArtifactVersion } from "../../shared/contracts/artifacts";
import { decryptSecret } from "../auth/crypto";
import { createArtifact, createCandidateVersion, getArtifact, listArtifactVersions } from "../db/artifacts";
import { getDrawing } from "../db/drawings";
import { completeGenerationRun, createGenerationRun, type GenerationRun } from "../db/generations";
import { getCredential } from "../db/sessions";
import { AppError } from "../lib/errors";
import { OpenRouterClient } from "../openrouter/client";
import { buildInterfaceGenerationRequest, parseGeneratedHtmlArtifact, validatePngDataUrl, validateSourceHtml } from "../openrouter/interface-generation";
import { requireCompatibleModel } from "../openrouter/models";
import type { AppBindings } from "../app";

export interface GenerationRouteOptions {
  fetch?: typeof globalThis.fetch;
}

export function createGenerationRoutes(options: GenerationRouteOptions = {}) {
  const app = new Hono<AppBindings>();

  app.post("/interface", async (context) => {
    const input = await parseInput(context.req.raw);
    validatePngDataUrl(input.selection.pngDataUrl);

    const userId = context.get("user").id;
    const drawing = await getDrawing(context.env.DB, userId, input.drawingId);
    if (!drawing) throw new AppError(404, "not_found", "Drawing not found");
    if (drawing.version !== input.drawingVersion) {
      throw new AppError(409, "version_conflict", "Drawing has been updated");
    }

    let existingArtifact: ArtifactRecord | null = null;
    let activeVersion: ArtifactVersion | null = null;
    if (input.mode === "revise") {
      existingArtifact = await getArtifact(context.env.DB, userId, input.artifactId!);
      if (!existingArtifact || existingArtifact.drawingId !== drawing.id || existingArtifact.kind !== "html") {
        throw new AppError(404, "not_found", "Artifact not found");
      }
      if (existingArtifact.activeVersion !== input.expectedActiveVersion) {
        throw new AppError(409, "version_conflict", "Artifact version has been updated");
      }
      activeVersion = (await listArtifactVersions(context.env.DB, userId, existingArtifact.id))
        .find((version) => version.version === existingArtifact!.activeVersion) ?? null;
      if (!activeVersion || activeVersion.artifact.kind !== "html" || activeVersion.artifact.sourceHtml !== input.currentSourceHtml) {
        throw new AppError(409, "version_conflict", "Artifact source has been updated");
      }
      validateSourceHtml(input.currentSourceHtml!);
    }

    const run = await createGenerationRun(context.env.DB, userId, {
      drawingId: drawing.id,
      artifactId: existingArtifact?.id,
      purpose: input.mode === "create" ? "interface" : "artifact_revision",
      model: input.model,
    });
    const startedAt = Date.now();

    try {
      const credential = await getCredential(context.env.DB, userId);
      if (!credential) throw new AppError(401, "unauthorized", "OpenRouter credential unavailable");

      // Decryption is deliberately deferred until the first provider fetch is imminent.
      let apiKey: string | undefined;
      try {
        apiKey = await decryptSecret({
          ciphertext: credential.ciphertext,
          iv: credential.iv,
          formatVersion: credential.formatVersion as 1,
        }, context.env.AUTH_ENCRYPTION_KEY);
      } catch {
        throw new AppError(401, "unauthorized", "OpenRouter credential unavailable");
      }

      try {
        const client = new OpenRouterClient({ apiKey, appOrigin: context.env.APP_ORIGIN, fetch: options.fetch });
        // This catalog request is uncached and happens immediately before the generation call.
        await requireCompatibleModel(() => client.listModels({ signal: context.req.raw.signal }), input.model, "interface");
        const completion = await client.chatCompletion({
          ...buildInterfaceGenerationRequest(input),
          signal: context.req.raw.signal,
        });
        const artifact = parseGeneratedHtmlArtifact(completion);
        const metadata = {
          // Never store the full constructed prompt or the data URL. The reduced semantic input is enough for provenance.
          prompt: null,
          model: input.model,
          sourceSnapshot: input.selection.semantic,
        };
        const persisted = input.mode === "create"
          ? await createArtifact(context.env.DB, userId, drawing.id, artifact, metadata)
          : await createCandidateVersion(context.env.DB, userId, existingArtifact!.id, artifact, metadata);
        const artifactRecord = input.mode === "create" ? persisted as ArtifactRecord : existingArtifact!;
        const version = input.mode === "create"
          ? { artifactId: artifactRecord.id, version: 1, artifact, metadata, createdAt: artifactRecord.createdAt }
          : persisted as ArtifactVersion;
        const generation = await completeGenerationRun(context.env.DB, userId, run.id, {
          status: "succeeded",
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
          elapsedMs: Date.now() - startedAt,
        });

        return context.json({ artifact: artifactRecord, version, generation }, input.mode === "create" ? 201 : 200);
      } finally {
        apiKey = undefined;
      }
    } catch (error) {
      const normalized = normalizeGenerationError(error);
      await markFailed(context.env.DB, userId, run, normalized, startedAt);
      throw normalized;
    }
  });

  return app;
}

async function parseInput(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError(400, "validation_failed", "Invalid request");
  }
  const parsed = interfaceGenerationRequestSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, "validation_failed", "Invalid request", parsed.error.flatten());
  return parsed.data;
}

function normalizeGenerationError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError(502, "openrouter_error", "OpenRouter request failed");
}

async function markFailed(
  db: D1Database,
  userId: string,
  run: GenerationRun,
  error: AppError,
  startedAt: number,
): Promise<void> {
  try {
    await completeGenerationRun(db, userId, run.id, {
      status: "failed",
      errorCode: error.code,
      // AppError messages are controlled here; provider bodies and generation source are intentionally excluded.
      errorMessage: error.message,
      elapsedMs: Date.now() - startedAt,
    });
  } catch {
    // The original generation failure remains the safest response even if telemetry storage is unavailable.
  }
}
