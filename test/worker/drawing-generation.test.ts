import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../worker/app";
import { encryptSecret, hashToken } from "../../worker/auth/crypto";
import { createDrawing } from "../../worker/db/drawings";
import { createSession, ensureUser, saveCredential } from "../../worker/db/sessions";
import { listFolders } from "../../worker/db/folders";
import { SESSION_COOKIE } from "../../worker/middleware/session";
import type { DrawingGenerationRequest } from "../../shared/contracts/generation";

const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(13)));
const testEnv = { ...env, APP_ORIGIN: "https://webdraw.test", AUTH_ENCRYPTION_KEY: encryptionKey };

const catalogResponse = {
  data: [{
    id: "openrouter/text-json",
    name: "Text JSON",
    architecture: { input_modalities: ["text"] },
    supported_parameters: ["response_format"],
  }],
};

async function createAuthenticatedUser() {
  const user = await ensureUser(testEnv.DB, `drawing-generation-${crypto.randomUUID()}`);
  await saveCredential(testEnv.DB, user.id, await encryptSecret("sk-or-test-only", encryptionKey));
  const [folder] = await listFolders(testEnv.DB, user.id);
  const drawing = await createDrawing(testEnv.DB, user.id, {
    folderId: folder.id,
    name: "Flowchart",
    scene: { elements: [], appState: {}, files: {} },
  });
  return { user, drawing };
}

async function authenticatedRequest(userId: string, body: unknown, fetch: typeof globalThis.fetch): Promise<Response> {
  const token = crypto.randomUUID();
  await createSession(testEnv.DB, userId, await hashToken(token), Date.now() + 60_000);
  return createApp({ fetch }).request("https://webdraw.test/api/generations/drawing", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
    body: JSON.stringify(body),
  }, testEnv);
}

function requestFor(drawingId: string, drawingVersion = 1): DrawingGenerationRequest {
  return {
    drawingId,
    drawingVersion,
    model: "openrouter/text-json",
    prompt: "Add a confirmation step.",
    selectedIds: [],
    semantic: { elements: [], viewportCenter: { x: 320, y: 180 } },
  };
}

function providerFetch(operations: unknown[] = [{
  op: "add",
  element: { type: "rectangle", x: 300, y: 160, width: 180, height: 80 },
}]) {
  return vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify(catalogResponse), { headers: { "content-type": "application/json" } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ operations, note: "Added a confirmation step." }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }), { headers: { "content-type": "application/json" } }));
}

describe("drawing generation route", () => {
  it("requires authentication", async () => {
    const response = await createApp().request("https://webdraw.test/api/generations/drawing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestFor("drawing-id")),
    }, testEnv);

    expect(response.status).toBe(401);
  });

  it("accepts a text-only structured-output model and returns validated additions without mutating the drawing", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const fetch = providerFetch();
    const response = await authenticatedRequest(user.id, requestFor(drawing.id), fetch);
    const body = await response.json() as { operations: unknown[]; generation: { id: string; status: string; promptTokens: number }; model: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ operations: [{ op: "add" }], generation: { status: "succeeded", promptTokens: 10 }, model: "openrouter/text-json" });
    const openRouterRequest = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body));
    expect(openRouterRequest.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "drawing_operations", strict: true },
    });
    const operationVariants = openRouterRequest.response_format.json_schema.schema.properties.operations.items.oneOf;
    expect(operationVariants).toEqual(expect.arrayContaining([
      expect.objectContaining({ required: ["op", "element"] }),
      expect.objectContaining({ required: ["op", "id", "patch"] }),
      expect.objectContaining({ required: ["op", "id"] }),
    ]));
    expect(operationVariants).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ required: ["op"] }),
    ]));
    expect(openRouterRequest.provider).toMatchObject({ require_parameters: true });
    expect(JSON.stringify(openRouterRequest.messages)).toContain("viewportCenter");
    expect(JSON.stringify(openRouterRequest.messages)).not.toContain("pngDataUrl");
    expect(JSON.stringify(openRouterRequest.messages)).not.toContain("sk-or-test-only");
    const persisted = await testEnv.DB.prepare("SELECT scene_json, version FROM drawings WHERE id = ?").bind(drawing.id).first<{ scene_json: string; version: number }>();
    expect(persisted).toEqual({ scene_json: JSON.stringify({ elements: [], appState: {}, files: {} }), version: 1 });
    const run = await testEnv.DB.prepare(
      "SELECT status, prompt_tokens, error_message FROM generation_runs WHERE id = ?",
    ).bind(body.generation.id).first<{ status: string; prompt_tokens: number; error_message: string | null }>();
    expect(run).toEqual({ status: "succeeded", prompt_tokens: 10, error_message: null });
  });

  it("rejects unsupported models before a completion request", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [{ ...catalogResponse.data[0], supported_parameters: [] }],
    }), { headers: { "content-type": "application/json" } }));

    const response = await authenticatedRequest(user.id, requestFor(drawing.id), fetch);

    expect(response.status).toBe(400);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects empty prompts and oversized semantic context before provider calls", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const fetch = vi.fn<typeof globalThis.fetch>();
    const emptyPrompt = requestFor(drawing.id);
    emptyPrompt.prompt = " ";
    const emptyResponse = await authenticatedRequest(user.id, emptyPrompt, fetch);
    expect(emptyResponse.status).toBe(400);

    const excessive = requestFor(drawing.id);
    excessive.semantic.elements = Array.from({ length: 41 }, (_, index) => ({
      id: `selected-${index}`,
      type: "rectangle",
      x: index,
      y: 0,
      width: 10,
      height: 10,
    }));
    const excessiveResponse = await authenticatedRequest(user.id, excessive, fetch);
    expect(excessiveResponse.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("authorizes model updates against selected IDs and records a sanitized failure", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const fetch = providerFetch([{ op: "update", id: "unselected", patch: { x: 99 } }]);
    const request = requestFor(drawing.id);
    request.prompt = "Move it";
    request.selectedIds = ["selected"];
    request.semantic.elements = [{ id: "selected", type: "rectangle", x: 0, y: 0, width: 50, height: 50 }];

    const response = await authenticatedRequest(user.id, request, fetch);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });
    const run = await testEnv.DB.prepare(
      "SELECT status, error_code, error_message FROM generation_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    ).bind(user.id).first<{ status: string; error_code: string; error_message: string }>();
    expect(run).toMatchObject({ status: "failed", error_code: "validation_failed" });
    expect(run?.error_message).not.toContain("unselected");
    expect(run?.error_message).not.toContain("Move it");
    expect(run?.error_message).not.toContain("sk-or-test-only");
  });
});
