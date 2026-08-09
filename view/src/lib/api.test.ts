import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "./api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("requestJson", () => {
  it("returns a successful JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;

    await expect(requestJson<{ ok: boolean }>("/api/test")).resolves.toEqual({ ok: true });
  });

  it("returns undefined for a successful 204 response without parsing JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(requestJson<void>("/api/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("returns undefined for an empty successful response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));

    await expect(requestJson<void>("/api/delete", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("uses same-origin credentials and only adds a JSON content type for bodies", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}")));
    globalThis.fetch = fetchMock;

    await requestJson("/api/without-body");
    await requestJson("/api/null-body", { body: null });
    await requestJson("/api/with-body", { body: JSON.stringify({ name: "Sketch" }) });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/without-body", {
      credentials: "same-origin",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/null-body", {
      body: null,
      credentials: "same-origin",
    });

    const [, requestInit] = fetchMock.mock.calls[2];
    expect(requestInit).toMatchObject({
      body: '{"name":"Sketch"}',
      credentials: "same-origin",
    });
    expect(new Headers(requestInit.headers).get("Content-Type")).toBe("application/json");
  });

  it("preserves a caller-provided content type for a request body", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}")));
    globalThis.fetch = fetchMock;

    await requestJson("/api/upload", {
      body: "--webdraw-boundary--",
      headers: { "content-type": "multipart/form-data; boundary=webdraw-boundary" },
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(new Headers(requestInit.headers).get("Content-Type")).toBe(
      "multipart/form-data; boundary=webdraw-boundary",
    );
  });

  it("normalizes a 401 API error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "unauthorized", message: "Sign in required" },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(requestJson("/api/private")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 401,
      code: "unauthorized",
      message: "Sign in required",
    });
  });

  it("preserves version-conflict details from a 409 API error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "version_conflict",
            message: "The drawing was updated elsewhere",
            details: { currentVersion: 7 },
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(requestJson("/api/drawings/drawing-1")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 409,
      code: "version_conflict",
      details: { currentVersion: 7 },
    });
  });

  it("normalizes a non-JSON error response as an internal error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("upstream unavailable", { status: 503 }),
    );

    await expect(requestJson("/api/unavailable")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 503,
      code: "internal_error",
      message: "Request failed with status 503",
    });
  });
});
