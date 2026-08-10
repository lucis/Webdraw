import { Hono } from "hono";
import { z } from "zod";
import { activateArtifactVersion, createCandidateVersion, getArtifact, listArtifactVersions } from "../db/artifacts";
import { RepositoryError } from "../db/types";
import { AppError } from "../lib/errors";
import { validateSourceHtml } from "../openrouter/interface-generation";
import type { AppBindings } from "../app";

const candidateVersionRequestSchema = z.object({
  title: z.string().trim().min(1).max(240),
  sourceHtml: z.string(),
  expectedActiveVersion: z.number().int().positive(),
}).strict();

const activationRequestSchema = z.object({
  expectedActiveVersion: z.number().int().positive(),
}).strict();

/** Read-only artifact lookup used by canvas embeds after a drawing reload. */
export function createArtifactRoutes() {
  const app = new Hono<AppBindings>();

  app.get("/:id", async (context) => {
    const artifactId = context.req.param("id");
    if (!artifactId) throw new AppError(404, "not_found", "Artifact not found");

    const userId = context.get("user").id;
    const artifact = await getArtifact(context.env.DB, userId, artifactId);
    if (!artifact) throw new AppError(404, "not_found", "Artifact not found");

    const versions = await listArtifactVersions(context.env.DB, userId, artifactId);
    return context.json({ artifact, versions });
  });

  app.post("/:id/versions", async (context) => {
    const artifactId = context.req.param("id");
    if (!artifactId) throw new AppError(404, "not_found", "Artifact not found");

    const input = await parseRequest(context.req.raw, candidateVersionRequestSchema);
    const userId = context.get("user").id;
    const artifact = await getArtifact(context.env.DB, userId, artifactId);
    if (!artifact || artifact.kind !== "html") throw new AppError(404, "not_found", "Artifact not found");
    if (artifact.activeVersion !== input.expectedActiveVersion) {
      throw new AppError(409, "version_conflict", "Artifact version has been updated");
    }

    // Manual saves deliberately share the generation path's complete-document and resource policy.
    await validateSourceHtml(input.sourceHtml);
    const version = await withArtifactConflictMessage(() => createCandidateVersion(context.env.DB, userId, artifactId, {
      kind: "html",
      title: input.title,
      sourceHtml: input.sourceHtml,
    }, { prompt: null, model: null, sourceSnapshot: null }, input.expectedActiveVersion));
    return context.json({ artifact, version }, 201);
  });

  app.post("/:id/activate/:version", async (context) => {
    const artifactId = context.req.param("id");
    const version = Number(context.req.param("version"));
    if (!artifactId || !Number.isSafeInteger(version) || version <= 0) {
      throw new AppError(404, "not_found", "Artifact not found");
    }

    const input = await parseRequest(context.req.raw, activationRequestSchema);
    const artifact = await withArtifactConflictMessage(() => activateArtifactVersion(
      context.env.DB,
      context.get("user").id,
      artifactId,
      input.expectedActiveVersion,
      version,
    ));
    return context.json({ artifact });
  });

  return app;
}

async function parseRequest<TSchema extends z.ZodType>(request: Request, schema: TSchema): Promise<z.output<TSchema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError(400, "validation_failed", "Invalid request");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AppError(400, "validation_failed", "Invalid request", parsed.error.flatten());
  return parsed.data;
}

async function withArtifactConflictMessage<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "version_conflict") {
      throw new AppError(409, "version_conflict", "Resource has been updated");
    }
    throw error;
  }
}
