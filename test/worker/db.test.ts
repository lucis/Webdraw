import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  createFolder,
  deleteFolder,
  getFolder,
  listFolders,
  updateFolder,
} from "../../worker/db/folders";
import {
  createDrawing,
  deleteDrawing,
  getDrawing,
  listDrawings,
  updateDrawing,
} from "../../worker/db/drawings";
import {
  createSession,
  deleteSession,
  ensureUser,
  getCredential,
  getSessionUser,
  saveCredential,
} from "../../worker/db/sessions";

const scene = { elements: [], appState: {}, files: {} };

describe("D1 core repositories", () => {
  it("creates exactly one default folder for a new OpenRouter identity", async () => {
    const user = await ensureUser(env.DB, "openrouter-user-1");
    const sameUser = await ensureUser(env.DB, "openrouter-user-1");

    expect(sameUser.id).toBe(user.id);
    await expect(listFolders(env.DB, user.id)).resolves.toEqual([
      expect.objectContaining({ name: "Meus Desenhos", emoji: "🎨", isDefault: true }),
    ]);
  });

  it("persists encrypted credentials and resolves only unexpired sessions", async () => {
    const user = await ensureUser(env.DB, "openrouter-session-user");
    await saveCredential(env.DB, user.id, {
      ciphertext: "ciphertext-v1",
      iv: "iv-v1",
      formatVersion: 1,
    });
    await createSession(env.DB, user.id, "valid-session-hash", 20_000, 10_000);
    await createSession(env.DB, user.id, "expired-session-hash", 9_999, 1_000);

    await expect(getCredential(env.DB, user.id)).resolves.toMatchObject({
      ciphertext: "ciphertext-v1",
      iv: "iv-v1",
      formatVersion: 1,
    });
    await expect(getSessionUser(env.DB, "valid-session-hash", 10_000)).resolves.toMatchObject({
      id: user.id,
      openRouterUserId: "openrouter-session-user",
    });
    await expect(getSessionUser(env.DB, "expired-session-hash", 10_000)).resolves.toBeNull();

    await deleteSession(env.DB, user.id, "valid-session-hash");
    await expect(getSessionUser(env.DB, "valid-session-hash", 10_000)).resolves.toBeNull();
  });

  it("moves drawings to the default folder when a non-default folder is deleted", async () => {
    const user = await ensureUser(env.DB, "openrouter-folder-user");
    const [defaultFolder] = await listFolders(env.DB, user.id);
    const projectFolder = await createFolder(env.DB, user.id, { name: "Projetos", emoji: "📁" });
    const drawing = await createDrawing(env.DB, user.id, {
      folderId: projectFolder.id,
      name: "Checkout",
      scene,
    });

    await deleteFolder(env.DB, user.id, projectFolder.id);

    await expect(getFolder(env.DB, user.id, projectFolder.id)).resolves.toBeNull();
    await expect(getDrawing(env.DB, user.id, drawing.id)).resolves.toMatchObject({
      folderId: defaultFolder.id,
    });
  });

  it("does not reveal or mutate another user's folders or drawings", async () => {
    const owner = await ensureUser(env.DB, "openrouter-owner");
    const intruder = await ensureUser(env.DB, "openrouter-intruder");
    const [ownerDefaultFolder] = await listFolders(env.DB, owner.id);
    const ownerFolder = await createFolder(env.DB, owner.id, { name: "Privado", emoji: "🔒" });
    const ownerDrawing = await createDrawing(env.DB, owner.id, {
      folderId: ownerFolder.id,
      name: "Segredo",
      scene,
    });

    await expect(getFolder(env.DB, intruder.id, ownerFolder.id)).resolves.toBeNull();
    await expect(updateFolder(env.DB, intruder.id, ownerFolder.id, { name: "Tomado" })).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteFolder(env.DB, intruder.id, ownerFolder.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(getDrawing(env.DB, intruder.id, ownerDrawing.id)).resolves.toBeNull();
    await expect(updateDrawing(env.DB, intruder.id, ownerDrawing.id, { expectedVersion: 1, scene })).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteDrawing(env.DB, intruder.id, ownerDrawing.id)).rejects.toMatchObject({ code: "not_found" });

    await expect(getFolder(env.DB, owner.id, ownerFolder.id)).resolves.toMatchObject({ id: ownerFolder.id });
    await expect(getDrawing(env.DB, owner.id, ownerDrawing.id)).resolves.toMatchObject({ id: ownerDrawing.id });
    await expect(listDrawings(env.DB, owner.id, ownerDefaultFolder.id)).resolves.toEqual([]);
  });

  it("rejects stale drawing updates without overwriting the current scene", async () => {
    const user = await ensureUser(env.DB, "openrouter-concurrency-user");
    const [folder] = await listFolders(env.DB, user.id);
    const drawing = await createDrawing(env.DB, user.id, {
      folderId: folder.id,
      name: "Checkout",
      scene,
    });

    await expect(updateDrawing(env.DB, user.id, drawing.id, { expectedVersion: 99, scene })).rejects.toMatchObject({
      code: "version_conflict",
    });
    await expect(getDrawing(env.DB, user.id, drawing.id)).resolves.toMatchObject({
      scene,
      version: 1,
    });
  });
});
