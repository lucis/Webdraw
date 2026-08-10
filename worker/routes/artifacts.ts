import { Hono } from "hono";
import { getArtifact, listArtifactVersions } from "../db/artifacts";
import { AppError } from "../lib/errors";
import type { AppBindings } from "../app";

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

  return app;
}
