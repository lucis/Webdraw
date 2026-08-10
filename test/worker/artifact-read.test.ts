import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../../worker/app";
import { hashToken } from "../../worker/auth/crypto";
import { createArtifact } from "../../worker/db/artifacts";
import { createDrawing } from "../../worker/db/drawings";
import { listFolders } from "../../worker/db/folders";
import { createSession, ensureUser } from "../../worker/db/sessions";
import { SESSION_COOKIE } from "../../worker/middleware/session";

const testEnv = {
  ...env,
  APP_ORIGIN: "https://webdraw.test",
  AUTH_ENCRYPTION_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(13))),
};

async function authenticatedRequest(userId: string, artifactId: string): Promise<Response> {
  const token = crypto.randomUUID();
  await createSession(testEnv.DB, userId, await hashToken(token), Date.now() + 60_000);
  return createApp().request(`https://webdraw.test/api/artifacts/${artifactId}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  }, testEnv);
}

describe("GET /api/artifacts/:id", () => {
  it("returns an owner's artifact versions without exposing it to another user", async () => {
    const owner = await ensureUser(testEnv.DB, `artifact-read-owner-${crypto.randomUUID()}`);
    const otherUser = await ensureUser(testEnv.DB, `artifact-read-other-${crypto.randomUUID()}`);
    const [folder] = await listFolders(testEnv.DB, owner.id);
    const drawing = await createDrawing(testEnv.DB, owner.id, {
      folderId: folder.id,
      name: "Source",
      scene: { elements: [], appState: {}, files: {} },
    });
    const artifact = await createArtifact(testEnv.DB, owner.id, drawing.id, {
      kind: "html",
      title: "Preview",
      sourceHtml: "<!doctype html><html><body>Preview</body></html>",
    }, { prompt: null, model: null, sourceSnapshot: null });

    const ownerResponse = await authenticatedRequest(owner.id, artifact.id);

    expect(ownerResponse.status).toBe(200);
    await expect(ownerResponse.json()).resolves.toMatchObject({
      artifact: { id: artifact.id, activeVersion: 1 },
      versions: [{ artifactId: artifact.id, version: 1, artifact: { kind: "html", title: "Preview" } }],
    });
    const foreignResponse = await authenticatedRequest(otherUser.id, artifact.id);
    expect(foreignResponse.status).toBe(404);
  });
});
