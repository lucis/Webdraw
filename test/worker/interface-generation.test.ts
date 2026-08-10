import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../worker/app";
import { encryptSecret, hashToken } from "../../worker/auth/crypto";
import { createSession, ensureUser, saveCredential } from "../../worker/db/sessions";
import { createDrawing } from "../../worker/db/drawings";
import { listFolders } from "../../worker/db/folders";
import { getArtifact, listArtifactVersions } from "../../worker/db/artifacts";
import { SESSION_COOKIE } from "../../worker/middleware/session";
import type { InterfaceGenerationRequest } from "../../shared/contracts/generation";

const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(11)));
const testEnv = {
  ...env,
  APP_ORIGIN: "https://webdraw.test",
  AUTH_ENCRYPTION_KEY: encryptionKey,
};

const catalogResponse = {
  data: [{
    id: "openrouter/vision-json",
    name: "Vision JSON",
    architecture: { input_modalities: ["text", "image"] },
    supported_parameters: ["response_format"],
  }],
};

const generatedArtifact = {
  kind: "html",
  title: "Checkout",
  sourceHtml: "<!doctype html><html><head><title>Checkout</title></head><body><main class=\"p-6\"><button>Pay now</button></main></body></html>",
};

async function createAuthenticatedUser() {
  const user = await ensureUser(testEnv.DB, `generation-${crypto.randomUUID()}`);
  await saveCredential(testEnv.DB, user.id, await encryptSecret("sk-or-test-only", encryptionKey));
  const [folder] = await listFolders(testEnv.DB, user.id);
  const drawing = await createDrawing(testEnv.DB, user.id, {
    folderId: folder.id,
    name: "Checkout source",
    scene: { elements: [], appState: {}, files: {} },
  });
  return { user, drawing };
}

async function authenticatedRequest(
  userId: string,
  body: unknown,
  fetch: typeof globalThis.fetch,
): Promise<Response> {
  const token = crypto.randomUUID();
  await createSession(testEnv.DB, userId, await hashToken(token), Date.now() + 60_000);
  return createApp({ fetch }).request("https://webdraw.test/api/generations/interface", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
    body: JSON.stringify(body),
  }, testEnv);
}

function requestFor(drawingId: string, drawingVersion = 1): InterfaceGenerationRequest {
  return {
    mode: "create",
    kind: "html",
    drawingId,
    drawingVersion,
    model: "openrouter/vision-json",
    instruction: "Make the checkout controls clear.",
    selection: {
      pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      semantic: {
        elements: [{ id: "card", type: "rectangle", x: 0, y: 0, width: 320, height: 180 }],
        bounds: { x: 0, y: 0, width: 320, height: 180 },
      },
    },
  };
}

function providerFetch(output = generatedArtifact) {
  return vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify(catalogResponse), { headers: { "content-type": "application/json" } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(output) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }), { headers: { "content-type": "application/json" } }));
}

describe("interface artifact generation route", () => {
  it("requires an authenticated session", async () => {
    const response = await createApp().request("https://webdraw.test/api/generations/interface", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestFor("drawing-id")),
    }, testEnv);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unauthorized", message: "Authentication required" },
    });
  });

  it("rejects a model without current vision and structured-output support", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [{
        ...catalogResponse.data[0],
        architecture: { input_modalities: ["text"] },
      }],
    }), { headers: { "content-type": "application/json" } }));

    const response = await authenticatedRequest(user.id, requestFor(drawing.id), fetch);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects image data URLs that are not PNG before contacting OpenRouter", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const fetch = vi.fn<typeof globalThis.fetch>();
    const request = requestFor(drawing.id);
    request.selection.pngDataUrl = "data:image/jpeg;base64,/9j/4AAQ";

    const response = await authenticatedRequest(user.id, request, fetch);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects PNG data above the image byte limit before contacting OpenRouter", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const fetch = vi.fn<typeof globalThis.fetch>();
    const request = requestFor(drawing.id);
    request.selection.pngDataUrl = `data:image/png;base64,${"A".repeat(1_400_000)}`;

    const response = await authenticatedRequest(user.id, request, fetch);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("builds a strict structured multimodal request and creates version one", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const fetch = providerFetch();

    const response = await authenticatedRequest(user.id, requestFor(drawing.id), fetch);
    const body = await response.json() as { artifact: { id: string; activeVersion: number }; version: { version: number }; generation: { status: string } };

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ artifact: { activeVersion: 1 }, version: { version: 1 }, generation: { status: "succeeded" } });
    const openRouterRequest = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body));
    expect(openRouterRequest.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "html_artifact", strict: true },
    });
    expect(openRouterRequest.provider).toMatchObject({ require_parameters: true });
    expect(openRouterRequest.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "system", content: expect.stringContaining("Tailwind utility classes") }),
      expect.objectContaining({ role: "user", content: [
        expect.objectContaining({ type: "text" }),
        expect.objectContaining({ type: "image_url", image_url: { url: requestFor(drawing.id).selection.pngDataUrl } }),
      ] }),
    ]));
    expect(JSON.stringify(openRouterRequest.messages)).not.toContain("cdn.tailwindcss.com");
    await expect(getArtifact(testEnv.DB, user.id, body.artifact.id)).resolves.toMatchObject({ activeVersion: 1 });
    const persistedMetadata = await testEnv.DB.prepare(
      "SELECT prompt, source_snapshot_json FROM artifact_versions WHERE artifact_id = ? AND version = 1",
    ).bind(body.artifact.id).first<{ prompt: string | null; source_snapshot_json: string }>();
    expect(persistedMetadata?.prompt).toBeNull();
    expect(persistedMetadata?.source_snapshot_json).not.toContain("data:image/png");
    expect(persistedMetadata?.source_snapshot_json).not.toContain("sk-or-test-only");
  });

  it("marks the generation failed without persisting invalid model HTML", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const fetch = providerFetch({ ...generatedArtifact, sourceHtml: "<main>missing full document</main>" });

    const response = await authenticatedRequest(user.id, requestFor(drawing.id), fetch);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });
    const run = await testEnv.DB.prepare(
      "SELECT status, error_code, error_message FROM generation_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    ).bind(user.id).first<{ status: string; error_code: string | null; error_message: string | null }>();
    expect(run).toMatchObject({ status: "failed", error_code: "validation_failed" });
    expect(run?.error_message).not.toContain("data:image/png");
  });

  it("rejects a doctype document that omits closing body and html tags", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const incompleteDocument = {
      ...generatedArtifact,
      sourceHtml: "<!doctype html><html><body><main class=\"p-6\">Incomplete",
    };

    const response = await authenticatedRequest(user.id, requestFor(drawing.id), providerFetch(incompleteDocument));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });
  });

  it("does not persist a caller-controlled PNG data URL nested in semantic bindings", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const nestedPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
    const request = requestFor(drawing.id);
    request.selection.semantic.elements[0].bindings = { image: nestedPng };

    const response = await authenticatedRequest(user.id, request, providerFetch());
    const body = await response.json() as { artifact: { id: string } };
    const persisted = await testEnv.DB.prepare(
      "SELECT source_snapshot_json FROM artifact_versions WHERE artifact_id = ? AND version = 1",
    ).bind(body.artifact.id).first<{ source_snapshot_json: string }>();

    expect(response.status).toBe(201);
    expect(persisted?.source_snapshot_json).not.toContain("data:image/png");
    expect(persisted?.source_snapshot_json).not.toContain("iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB");
  });

  it("redacts short and parameterized PNG data URLs from every persisted semantic string without changing the model input", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLkEwAAAABJRU5ErkJggg==";
    const parameterizedPng = `DATA:image/png;charset=UTF-8;base64,${onePixelPng}`;
    const request = requestFor(drawing.id);
    const element = request.selection.semantic.elements[0];
    element.text = `Card ${onePixelPng}`;
    element.strokeColor = `prefix ${parameterizedPng} suffix`;
    element.backgroundColor = `data:image/png;name=one-pixel;base64,${onePixelPng}`;
    element.frameId = `frame-${parameterizedPng}`;
    element.groupIds = [`group-${parameterizedPng}`];
    const fetch = providerFetch();

    const response = await authenticatedRequest(user.id, request, fetch);
    const body = await response.json() as { artifact: { id: string } };
    const persisted = await testEnv.DB.prepare(
      "SELECT source_snapshot_json FROM artifact_versions WHERE artifact_id = ? AND version = 1",
    ).bind(body.artifact.id).first<{ source_snapshot_json: string }>();
    const snapshot = JSON.parse(persisted?.source_snapshot_json ?? "{}") as {
      elements: Array<{ text?: string; strokeColor?: string }>;
    };
    const openRouterRequest = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body));

    expect(response.status).toBe(201);
    expect(persisted?.source_snapshot_json).not.toContain(onePixelPng);
    expect(persisted?.source_snapshot_json.toLowerCase()).not.toContain("data:image/png");
    expect(snapshot.elements[0]).toMatchObject({
      text: "Card [redacted-png-base64]",
      strokeColor: "prefix [redacted-data-url] suffix",
    });
    expect(JSON.stringify(openRouterRequest.messages)).toContain(parameterizedPng);
    expect(JSON.stringify(openRouterRequest.messages)).toContain(onePixelPng);
  });

  it("redacts percent-encoded PNG data URLs while preserving malformed percent text and the original model input", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLkEwAAAABJRU5ErkJggg==";
    const encodedDataUrl = `data:image/png;base64,%69${onePixelPng.slice(1)}`;
    const mixedEncodedDataUrl = `d%61t%61:image/png;charset=utf-8;base64,i%56${onePixelPng.slice(2)}`;
    const request = requestFor(drawing.id);
    const element = request.selection.semantic.elements[0];
    element.text = `Before ${encodedDataUrl} after`;
    element.strokeColor = `Before ${mixedEncodedDataUrl} after`;
    element.frameId = `%69${onePixelPng.slice(1)}`;
    element.backgroundColor = "Ordinary value with malformed %ZZ escape";
    const fetch = providerFetch();

    const response = await authenticatedRequest(user.id, request, fetch);
    const body = await response.json() as { artifact: { id: string } };
    const persisted = await testEnv.DB.prepare(
      "SELECT source_snapshot_json FROM artifact_versions WHERE artifact_id = ? AND version = 1",
    ).bind(body.artifact.id).first<{ source_snapshot_json: string }>();
    const snapshot = JSON.parse(persisted?.source_snapshot_json ?? "{}") as {
      elements: Array<{ text?: string; strokeColor?: string; frameId?: string; backgroundColor?: string }>;
    };
    const openRouterRequest = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body));

    expect(response.status).toBe(201);
    expect(persisted?.source_snapshot_json).not.toContain(onePixelPng);
    expect(persisted?.source_snapshot_json).not.toContain("%69VBORw0KGgo");
    expect(snapshot.elements[0]).toMatchObject({
      text: "Before [redacted-data-url] after",
      strokeColor: "Before [redacted-data-url] after",
      frameId: "[redacted-png-base64]",
      backgroundColor: "Ordinary value with malformed %ZZ escape",
    });
    expect(JSON.stringify(openRouterRequest.messages)).toContain(encodedDataUrl);
    expect(JSON.stringify(openRouterRequest.messages)).toContain(mixedEncodedDataUrl);
  });

  it("rejects fake document-closing tags in inline script text and comments", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const misleadingSource = {
      ...generatedArtifact,
      sourceHtml: "<!doctype html><html><head><script>const closing = \"</body></html>\";</script></head><body><main>Partial<!-- </body></html> -->",
    };

    const response = await authenticatedRequest(user.id, requestFor(drawing.id), providerFetch(misleadingSource));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });
  });

  it("rejects remote scripts, styles, URLs, and top navigation in model output", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const remoteOutput = {
      ...generatedArtifact,
      sourceHtml: "<!doctype html><html><head><link rel=\"stylesheet\" href=\"https://cdn.example.test/app.css\"></head><body><nav>Global</nav><script src=\"https://cdn.example.test/app.js\"></script></body></html>",
    };

    const response = await authenticatedRequest(user.id, requestFor(drawing.id), providerFetch(remoteOutput));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "validation_failed" } });
    const artifactCount = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS count FROM artifacts WHERE user_id = ?",
    ).bind(user.id).first<{ count: number }>();
    expect(artifactCount?.count).toBe(0);
  });

  it("creates an inactive candidate for revision and leaves version one active", async () => {
    const { user, drawing } = await createAuthenticatedUser();
    const createFetch = providerFetch();
    const created = await authenticatedRequest(user.id, requestFor(drawing.id), createFetch);
    const createBody = await created.json() as { artifact: { id: string }; version: { artifact: typeof generatedArtifact } };

    const revision = {
      ...requestFor(drawing.id),
      mode: "revise",
      artifactId: createBody.artifact.id,
      expectedActiveVersion: 1,
      currentSourceHtml: createBody.version.artifact.sourceHtml,
      instruction: "Make the button wider.",
    };
    const revisedArtifact = { ...generatedArtifact, title: "Checkout revised", sourceHtml: generatedArtifact.sourceHtml.replace("p-6", "p-8") };
    const response = await authenticatedRequest(user.id, revision, providerFetch(revisedArtifact));
    const body = await response.json() as { artifact: { id: string; activeVersion: number }; version: { version: number; artifact: typeof generatedArtifact }; generation: { status: string } };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      artifact: { id: createBody.artifact.id, activeVersion: 1 },
      version: { version: 2, artifact: revisedArtifact },
      generation: { status: "succeeded" },
    });
    await expect(listArtifactVersions(testEnv.DB, user.id, createBody.artifact.id)).resolves.toMatchObject([
      { version: 1, artifact: generatedArtifact },
      { version: 2, artifact: revisedArtifact },
    ]);
  });
});
