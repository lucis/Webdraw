import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../../worker/app";
import { createSession, ensureUser } from "../../worker/db/sessions";
import { hashToken } from "../../worker/auth/crypto";
import { SESSION_COOKIE } from "../../worker/middleware/session";

const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const testEnv = {
  ...env,
  APP_ORIGIN: "http://example.test",
  AUTH_ENCRYPTION_KEY: encryptionKey,
};
const emptyScene = { elements: [], appState: {}, files: {} };

async function authenticatedRequest(
  userId: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = crypto.randomUUID();
  await createSession(testEnv.DB, userId, await hashToken(token), Date.now() + 60_000);
  return createApp().request(`http://example.test${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}`, ...init.headers },
  }, testEnv);
}

async function createUser(): Promise<{ id: string }> {
  return ensureUser(testEnv.DB, `resource-test-${crypto.randomUUID()}`);
}

describe("folder and drawing API routes", () => {
  it("requires an authenticated session and returns the shared error envelope", async () => {
    const response = await createApp().request("http://example.test/api/folders", undefined, testEnv);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unauthorized", message: "Authentication required" },
    });
  });

  it("lists, creates, updates, and deletes a user's non-default folders", async () => {
    const user = await createUser();
    const initial = await authenticatedRequest(user.id, "/api/folders");
    const initialBody = await initial.json() as { folders: Array<{ id: string; isDefault: boolean }> };

    expect(initial.status).toBe(200);
    expect(initialBody.folders).toHaveLength(1);
    expect(initialBody.folders[0].isDefault).toBe(true);

    const create = await authenticatedRequest(user.id, "/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: "Projetos", emoji: "📁" }),
    });
    const folder = (await create.json() as { folder: { id: string; name: string; emoji: string } }).folder;

    expect(create.status).toBe(201);
    expect(folder).toMatchObject({ name: "Projetos", emoji: "📁" });

    const update = await authenticatedRequest(user.id, `/api/folders/${folder.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Arquivados", order: 9 }),
    });
    expect(update.status).toBe(200);
    await expect(update.json()).resolves.toMatchObject({
      folder: { id: folder.id, name: "Arquivados", order: 9 },
    });

    const remove = await authenticatedRequest(user.id, `/api/folders/${folder.id}`, { method: "DELETE" });
    expect(remove.status).toBe(204);
    expect((await authenticatedRequest(user.id, "/api/folders")).status).toBe(200);
  });

  it("rejects deleting a default folder and malformed folder request bodies", async () => {
    const user = await createUser();
    const list = await authenticatedRequest(user.id, "/api/folders");
    const defaultFolder = (await list.json() as { folders: Array<{ id: string }> }).folders[0];

    const remove = await authenticatedRequest(user.id, `/api/folders/${defaultFolder.id}`, { method: "DELETE" });
    expect(remove.status).toBe(403);
    await expect(remove.json()).resolves.toEqual({
      error: { code: "forbidden", message: "Default folder cannot be deleted" },
    });

    const malformed = await authenticatedRequest(user.id, "/api/folders", {
      method: "POST",
      body: "{",
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });
  });

  it("does not expose another user's folders", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const create = await authenticatedRequest(owner.id, "/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: "Privado", emoji: "🔒" }),
    });
    const folder = (await create.json() as { folder: { id: string } }).folder;

    const update = await authenticatedRequest(intruder.id, `/api/folders/${folder.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Tomado" }),
    });
    expect(update.status).toBe(404);
    await expect(update.json()).resolves.toMatchObject({ error: { code: "not_found" } });
  });

  it("creates an empty drawing by default, filters its list by folder, and reads it", async () => {
    const user = await createUser();
    const folders = await authenticatedRequest(user.id, "/api/folders");
    const defaultFolder = (await folders.json() as { folders: Array<{ id: string }> }).folders[0];
    const createFolder = await authenticatedRequest(user.id, "/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: "Outro", emoji: "🗂️" }),
    });
    const otherFolder = (await createFolder.json() as { folder: { id: string } }).folder;

    const create = await authenticatedRequest(user.id, "/api/drawings", {
      method: "POST",
      body: JSON.stringify({ folderId: defaultFolder.id, name: "Rascunho" }),
    });
    const drawing = (await create.json() as { drawing: { id: string; scene: typeof emptyScene; version: number } }).drawing;
    expect(create.status).toBe(201);
    expect(drawing).toMatchObject({ scene: emptyScene, version: 1 });

    const listed = await authenticatedRequest(user.id, `/api/drawings?folderId=${defaultFolder.id}`);
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({ drawings: [{ id: drawing.id }] });

    const filtered = await authenticatedRequest(user.id, `/api/drawings?folderId=${otherFolder.id}`);
    await expect(filtered.json()).resolves.toEqual({ drawings: [] });

    const get = await authenticatedRequest(user.id, `/api/drawings/${drawing.id}`);
    expect(get.status).toBe(200);
    await expect(get.json()).resolves.toMatchObject({ drawing: { id: drawing.id, scene: emptyScene } });
  });

  it("updates and deletes a drawing while rejecting stale versions", async () => {
    const user = await createUser();
    const folderResponse = await authenticatedRequest(user.id, "/api/folders");
    const folder = (await folderResponse.json() as { folders: Array<{ id: string }> }).folders[0];
    const create = await authenticatedRequest(user.id, "/api/drawings", {
      method: "POST",
      body: JSON.stringify({ folderId: folder.id, name: "Versões", scene: emptyScene }),
    });
    const drawing = (await create.json() as { drawing: { id: string; version: number } }).drawing;
    const nextScene = { elements: [{ id: "element-1" }], appState: {}, files: {} };

    const update = await authenticatedRequest(user.id, `/api/drawings/${drawing.id}`, {
      method: "PUT",
      body: JSON.stringify({ expectedVersion: drawing.version, scene: nextScene }),
    });
    expect(update.status).toBe(200);
    await expect(update.json()).resolves.toMatchObject({
      drawing: { id: drawing.id, scene: nextScene, version: drawing.version + 1 },
    });

    const stale = await authenticatedRequest(user.id, `/api/drawings/${drawing.id}`, {
      method: "PUT",
      body: JSON.stringify({ expectedVersion: drawing.version, scene: emptyScene }),
    });
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toEqual({
      error: { code: "version_conflict", message: "Drawing has been updated" },
    });

    const remove = await authenticatedRequest(user.id, `/api/drawings/${drawing.id}`, { method: "DELETE" });
    expect(remove.status).toBe(204);
  });

  it("renames and moves a drawing to another folder owned by the user", async () => {
    const user = await createUser();
    const folders = await authenticatedRequest(user.id, "/api/folders");
    const sourceFolder = (await folders.json() as { folders: Array<{ id: string }> }).folders[0];
    const createFolder = await authenticatedRequest(user.id, "/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: "Destino", emoji: "📥" }),
    });
    const targetFolder = (await createFolder.json() as { folder: { id: string } }).folder;
    const create = await authenticatedRequest(user.id, "/api/drawings", {
      method: "POST",
      body: JSON.stringify({ folderId: sourceFolder.id, name: "Antes" }),
    });
    const drawing = (await create.json() as { drawing: { id: string; version: number } }).drawing;

    const update = await authenticatedRequest(user.id, `/api/drawings/${drawing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        expectedVersion: drawing.version,
        name: "Depois",
        folderId: targetFolder.id,
      }),
    });

    expect(update.status).toBe(200);
    await expect(update.json()).resolves.toMatchObject({
      drawing: {
        id: drawing.id,
        name: "Depois",
        folderId: targetFolder.id,
        version: drawing.version + 1,
      },
    });
  });

  it("rejects moving a drawing to another user's folder without mutating it", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const ownerFolders = await authenticatedRequest(owner.id, "/api/folders");
    const ownerFolder = (await ownerFolders.json() as { folders: Array<{ id: string }> }).folders[0];
    const intruderFolders = await authenticatedRequest(intruder.id, "/api/folders");
    const foreignFolder = (await intruderFolders.json() as { folders: Array<{ id: string }> }).folders[0];
    const create = await authenticatedRequest(owner.id, "/api/drawings", {
      method: "POST",
      body: JSON.stringify({ folderId: ownerFolder.id, name: "Original" }),
    });
    const drawing = (await create.json() as { drawing: { id: string; version: number } }).drawing;

    const update = await authenticatedRequest(owner.id, `/api/drawings/${drawing.id}`, {
      method: "PUT",
      body: JSON.stringify({ expectedVersion: drawing.version, folderId: foreignFolder.id }),
    });

    expect(update.status).toBe(404);
    await expect(update.json()).resolves.toEqual({
      error: { code: "not_found", message: "Resource not found" },
    });

    const get = await authenticatedRequest(owner.id, `/api/drawings/${drawing.id}`);
    await expect(get.json()).resolves.toMatchObject({
      drawing: { id: drawing.id, name: "Original", folderId: ownerFolder.id, version: drawing.version },
    });
  });

  it("rejects invalid drawing input and missing or foreign drawing ownership", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const invalidList = await authenticatedRequest(owner.id, "/api/drawings");
    expect(invalidList.status).toBe(400);
    await expect(invalidList.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });

    const malformedCreate = await authenticatedRequest(owner.id, "/api/drawings", {
      method: "POST",
      body: JSON.stringify({ folderId: 42, name: "Inválido" }),
    });
    expect(malformedCreate.status).toBe(400);

    const folders = await authenticatedRequest(owner.id, "/api/folders");
    const folder = (await folders.json() as { folders: Array<{ id: string }> }).folders[0];
    const create = await authenticatedRequest(owner.id, "/api/drawings", {
      method: "POST",
      body: JSON.stringify({ folderId: folder.id, name: "Privado" }),
    });
    const drawing = (await create.json() as { drawing: { id: string } }).drawing;

    const foreign = await authenticatedRequest(intruder.id, `/api/drawings/${drawing.id}`);
    expect(foreign.status).toBe(404);
    await expect(foreign.json()).resolves.toMatchObject({ error: { code: "not_found" } });
  });

  it("rejects a serialized drawing scene above the one-million-byte storage limit", async () => {
    const user = await createUser();
    const folders = await authenticatedRequest(user.id, "/api/folders");
    const folder = (await folders.json() as { folders: Array<{ id: string }> }).folders[0];
    const oversizedScene = {
      elements: [],
      appState: {},
      files: { image: { dataURL: "x".repeat(1_000_001) } },
    };

    const response = await authenticatedRequest(user.id, "/api/drawings", {
      method: "POST",
      body: JSON.stringify({ folderId: folder.id, name: "Grande", scene: oversizedScene }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation_failed",
        message: "Drawing scene exceeds the 1000000 byte limit",
        details: { maxBytes: 1_000_000 },
      },
    });
  });

  it("rejects a drawing request body above the 1,100,000-byte transport limit", async () => {
    const user = await createUser();

    const response = await authenticatedRequest(user.id, "/api/drawings", {
      method: "POST",
      body: JSON.stringify({ payload: "x".repeat(1_100_001) }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation_failed",
        message: "Drawing request exceeds the 1100000 byte limit",
        details: { maxBytes: 1_100_000 },
      },
    });
  });
});
