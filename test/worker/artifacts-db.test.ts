import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ArtifactVersionMetadata, HtmlArtifact } from "../../shared/contracts/artifacts";
import {
  activateArtifactVersion,
  createArtifact,
  createCandidateVersion,
  getArtifact,
  listArtifactVersions,
} from "../../worker/db/artifacts";
import { createDrawing } from "../../worker/db/drawings";
import { listFolders } from "../../worker/db/folders";
import { ensureUser } from "../../worker/db/sessions";

const metadata: ArtifactVersionMetadata = {
  prompt: "Create a checkout interface",
  model: "openrouter/example",
  sourceSnapshot: { selectedElementIds: ["checkout-card"] },
};

const versionOne: HtmlArtifact = {
  kind: "html",
  title: "Checkout",
  sourceHtml: "<!doctype html><html><body>version one</body></html>",
};

const versionTwo: HtmlArtifact = {
  kind: "html",
  title: "Checkout revised",
  sourceHtml: "<!doctype html><html><body>version two</body></html>",
};

async function createOwnedDrawing(userId: string) {
  const [folder] = await listFolders(env.DB, userId);
  return createDrawing(env.DB, userId, {
    folderId: folder.id,
    name: "Checkout source",
    scene: { elements: [], appState: {}, files: {} },
  });
}

describe("artifact D1 repository", () => {
  it("preserves version-one source while a candidate is activated", async () => {
    const user = await ensureUser(env.DB, `artifact-owner-${crypto.randomUUID()}`);
    const drawing = await createOwnedDrawing(user.id);
    const artifact = await createArtifact(env.DB, user.id, drawing.id, versionOne, metadata);

    const candidate = await createCandidateVersion(env.DB, user.id, artifact.id, versionTwo, {
      ...metadata,
      prompt: "Make the checkout compact",
    });

    await expect(getArtifact(env.DB, user.id, artifact.id)).resolves.toMatchObject({
      id: artifact.id,
      activeVersion: 1,
    });
    await expect(listArtifactVersions(env.DB, user.id, artifact.id)).resolves.toMatchObject([
      { version: 1, artifact: versionOne },
      { version: 2, artifact: versionTwo },
    ]);

    await activateArtifactVersion(env.DB, user.id, artifact.id, 1, candidate.version);

    await expect(getArtifact(env.DB, user.id, artifact.id)).resolves.toMatchObject({ activeVersion: 2 });
    await expect(listArtifactVersions(env.DB, user.id, artifact.id)).resolves.toMatchObject([
      { version: 1, artifact: versionOne },
      { version: 2, artifact: versionTwo },
    ]);
  });

  it("rejects stale activation without changing the active version", async () => {
    const user = await ensureUser(env.DB, `artifact-concurrency-${crypto.randomUUID()}`);
    const drawing = await createOwnedDrawing(user.id);
    const artifact = await createArtifact(env.DB, user.id, drawing.id, versionOne, metadata);
    const candidate = await createCandidateVersion(env.DB, user.id, artifact.id, versionTwo, metadata);

    await expect(
      activateArtifactVersion(env.DB, user.id, artifact.id, 99, candidate.version),
    ).rejects.toMatchObject({ code: "version_conflict" });
    await expect(getArtifact(env.DB, user.id, artifact.id)).resolves.toMatchObject({ activeVersion: 1 });
  });

  it("does not reveal or activate another user's artifact versions", async () => {
    const owner = await ensureUser(env.DB, `artifact-owner-${crypto.randomUUID()}`);
    const intruder = await ensureUser(env.DB, `artifact-intruder-${crypto.randomUUID()}`);
    const drawing = await createOwnedDrawing(owner.id);
    const artifact = await createArtifact(env.DB, owner.id, drawing.id, versionOne, metadata);
    const candidate = await createCandidateVersion(env.DB, owner.id, artifact.id, versionTwo, metadata);

    await expect(getArtifact(env.DB, intruder.id, artifact.id)).resolves.toBeNull();
    await expect(listArtifactVersions(env.DB, intruder.id, artifact.id)).resolves.toEqual([]);
    await expect(
      activateArtifactVersion(env.DB, intruder.id, artifact.id, 1, candidate.version),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(getArtifact(env.DB, owner.id, artifact.id)).resolves.toMatchObject({ activeVersion: 1 });
  });
});
