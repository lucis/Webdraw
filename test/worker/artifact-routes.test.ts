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
  AUTH_ENCRYPTION_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(14))),
};

const activeSource = "<!doctype html><html><head><title>Active</title></head><body><main>Active</main></body></html>";
const candidateSource = "<!doctype html><html><head><title>Candidate</title></head><body><main>Candidate</main></body></html>";

async function createOwnedArtifact() {
  const user = await ensureUser(testEnv.DB, `artifact-route-owner-${crypto.randomUUID()}`);
  const [folder] = await listFolders(testEnv.DB, user.id);
  const drawing = await createDrawing(testEnv.DB, user.id, {
    folderId: folder.id,
    name: "Source",
    scene: { elements: [], appState: {}, files: {} },
  });
  const artifact = await createArtifact(testEnv.DB, user.id, drawing.id, {
    kind: "html",
    title: "Active",
    sourceHtml: activeSource,
  }, { prompt: null, model: null, sourceSnapshot: null });
  return { user, artifact };
}

async function authenticatedRequest(userId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const token = crypto.randomUUID();
  await createSession(testEnv.DB, userId, await hashToken(token), Date.now() + 60_000);
  return createApp().request(`https://webdraw.test${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}`, ...init.headers },
  }, testEnv);
}

describe("artifact editing routes", () => {
  it("allows only the owner to read artifact versions", async () => {
    const { user, artifact } = await createOwnedArtifact();
    const otherUser = await ensureUser(testEnv.DB, `artifact-route-other-${crypto.randomUUID()}`);

    const ownerResponse = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}`);
    expect(ownerResponse.status).toBe(200);
    await expect(ownerResponse.json()).resolves.toMatchObject({
      artifact: { id: artifact.id, activeVersion: 1 },
      versions: [{ version: 1, artifact: { sourceHtml: activeSource } }],
    });

    expect((await authenticatedRequest(otherUser.id, `/api/artifacts/${artifact.id}`)).status).toBe(404);
  });

  it("creates an immutable manual candidate only when the expected active version is current", async () => {
    const { user, artifact } = await createOwnedArtifact();

    const created = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}/versions`, {
      method: "POST",
      body: JSON.stringify({ title: "Candidate", sourceHtml: candidateSource, expectedActiveVersion: 1 }),
    });

    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      artifact: { id: artifact.id, activeVersion: 1 },
      version: { version: 2, artifact: { kind: "html", title: "Candidate", sourceHtml: candidateSource } },
    });
    const afterCreation = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}`);
    await expect(afterCreation.json()).resolves.toMatchObject({
      artifact: { activeVersion: 1 },
      versions: [
        { version: 1, artifact: { sourceHtml: activeSource } },
        { version: 2, artifact: { sourceHtml: candidateSource } },
      ],
    });

    const stale = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}/versions`, {
      method: "POST",
      body: JSON.stringify({ title: "Stale", sourceHtml: candidateSource, expectedActiveVersion: 2 }),
    });
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({ error: { code: "version_conflict" } });
  });

  it("rejects a manual candidate that fails the generation source policy", async () => {
    const { user, artifact } = await createOwnedArtifact();

    const response = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}/versions`, {
      method: "POST",
      body: JSON.stringify({
        title: "Invalid",
        sourceHtml: "<main>Fragment source cannot be persisted</main>",
        expectedActiveVersion: 1,
      }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });
    const unchanged = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}`);
    await expect(unchanged.json()).resolves.toMatchObject({ versions: [{ version: 1, artifact: { sourceHtml: activeSource } }] });
  });

  it("activates a candidate with optimistic concurrency and restores an earlier immutable version", async () => {
    const { user, artifact } = await createOwnedArtifact();
    const candidate = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}/versions`, {
      method: "POST",
      body: JSON.stringify({ title: "Candidate", sourceHtml: candidateSource, expectedActiveVersion: 1 }),
    });
    expect(candidate.status).toBe(201);

    const staleActivation = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}/activate/2`, {
      method: "POST",
      body: JSON.stringify({ expectedActiveVersion: 2 }),
    });
    expect(staleActivation.status).toBe(409);
    await expect(staleActivation.json()).resolves.toEqual({
      error: { code: "version_conflict", message: "Resource has been updated" },
    });

    const applied = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}/activate/2`, {
      method: "POST",
      body: JSON.stringify({ expectedActiveVersion: 1 }),
    });
    expect(applied.status).toBe(200);
    await expect(applied.json()).resolves.toMatchObject({ artifact: { activeVersion: 2 } });

    const restored = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}/activate/1`, {
      method: "POST",
      body: JSON.stringify({ expectedActiveVersion: 2 }),
    });
    expect(restored.status).toBe(200);
    await expect(restored.json()).resolves.toMatchObject({ artifact: { activeVersion: 1 } });

    const afterRestore = await authenticatedRequest(user.id, `/api/artifacts/${artifact.id}`);
    await expect(afterRestore.json()).resolves.toMatchObject({
      artifact: { activeVersion: 1 },
      versions: [
        { version: 1, artifact: { sourceHtml: activeSource } },
        { version: 2, artifact: { sourceHtml: candidateSource } },
      ],
    });
  });
});
