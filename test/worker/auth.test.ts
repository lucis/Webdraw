import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../worker/app";
import { getCredential } from "../../worker/db/sessions";

const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
const testEnv = {
  ...env,
  APP_ORIGIN: "http://example.test",
  AUTH_ENCRYPTION_KEY: encryptionKey,
};

function cookieValue(setCookie: string | null, name: string): string {
  const match = new RegExp(`${name}=([^;]+)`).exec(setCookie ?? "");
  if (!match) throw new Error(`Missing ${name} cookie`);
  return match[1];
}

function appWithExchange(body: unknown, status = 200) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  return { app: createApp({ fetch }), fetch };
}

describe("OpenRouter OAuth routes", () => {
  it("starts PKCE login with a sealed five-minute transaction cookie", async () => {
    const { app } = appWithExchange({});
    const response = await app.request(
      "http://example.test/api/auth/login?next=/canvas",
      undefined,
      testEnv,
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://openrouter.ai");
    expect(location.pathname).toBe("/auth");
    expect(location.searchParams.get("callback_url")).toBe("http://example.test/api/auth/callback");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(location.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(response.headers.get("set-cookie")).toMatch(
      /webdraw_oauth=v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+; Max-Age=300; Path=\/; HttpOnly; Secure; SameSite=Lax/,
    );
  });

  it("rejects a callback whose state does not match the sealed transaction", async () => {
    const { app, fetch } = appWithExchange({ key: "sk-or-unused", user_id: "or-unused" });
    const login = await app.request("http://example.test/api/auth/login", undefined, testEnv);
    const oauthCookie = cookieValue(login.headers.get("set-cookie"), "webdraw_oauth");
    const response = await app.request(
      "http://example.test/api/auth/callback?code=code-1&state=wrong-state",
      { headers: { cookie: `webdraw_oauth=${oauthCookie}` } },
      testEnv,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unauthorized", message: "Invalid OAuth state" },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects OpenRouter exchanges without a user identity", async () => {
    const { app } = appWithExchange({ key: "sk-or-no-user", user_id: null });
    const login = await app.request("http://example.test/api/auth/login", undefined, testEnv);
    const oauthCookie = cookieValue(login.headers.get("set-cookie"), "webdraw_oauth");
    const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
    const response = await app.request(
      `http://example.test/api/auth/callback?code=code-2&state=${state}`,
      { headers: { cookie: `webdraw_oauth=${oauthCookie}` } },
      testEnv,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: { code: "openrouter_error", message: "Invalid OpenRouter OAuth response" },
    });
  });

  it("creates an encrypted credential and opaque session, then returns a key-free current user", async () => {
    const { app, fetch } = appWithExchange({ key: "sk-or-secret", user_id: "or-user-1" });
    const login = await app.request(
      "http://example.test/api/auth/login?next=/canvas",
      undefined,
      testEnv,
    );
    const oauthCookie = cookieValue(login.headers.get("set-cookie"), "webdraw_oauth");
    const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
    const callback = await app.request(
      `http://example.test/api/auth/callback?code=code-3&state=${state}`,
      { headers: { cookie: `webdraw_oauth=${oauthCookie}` } },
      testEnv,
    );

    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/canvas");
    expect(callback.headers.get("set-cookie")).toContain("webdraw_session=");
    expect(callback.headers.get("set-cookie")).toContain("Max-Age=2592000");
    expect(callback.headers.get("set-cookie")).toContain("HttpOnly");
    expect(callback.headers.get("set-cookie")).toContain("Secure");
    expect(callback.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/auth/keys",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
      code: "code-3",
      code_challenge_method: "S256",
    });

    const session = cookieValue(callback.headers.get("set-cookie"), "webdraw_session");
    const me = await app.request(
      "http://example.test/api/me",
      { headers: { cookie: `webdraw_session=${session}` } },
      testEnv,
    );
    const body = await me.json() as { user: { id: string; openRouterUserId: string } };
    expect(me.status).toBe(200);
    expect(body).toEqual({ user: { id: expect.any(String), openRouterUserId: "or-user-1" } });
    expect(JSON.stringify(body)).not.toContain("sk-or-");

    const credential = await getCredential(testEnv.DB, body.user.id);
    expect(credential?.ciphertext).not.toContain("sk-or-secret");
  });

  it("uses only a same-origin slash-prefixed next path and deletes the session on logout", async () => {
    const { app } = appWithExchange({ key: "sk-or-logout", user_id: "or-user-logout" });
    const login = await app.request(
      "http://example.test/api/auth/login?next=https://attacker.example/steal",
      undefined,
      testEnv,
    );
    const oauthCookie = cookieValue(login.headers.get("set-cookie"), "webdraw_oauth");
    const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
    const callback = await app.request(
      `http://example.test/api/auth/callback?code=code-4&state=${state}`,
      { headers: { cookie: `webdraw_oauth=${oauthCookie}` } },
      testEnv,
    );

    expect(callback.headers.get("location")).toBe("/");
    const session = cookieValue(callback.headers.get("set-cookie"), "webdraw_session");
    const logout = await app.request(
      "http://example.test/api/auth/logout",
      { method: "POST", headers: { cookie: `webdraw_session=${session}` } },
      testEnv,
    );
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("webdraw_session=; Max-Age=0");

    const me = await app.request(
      "http://example.test/api/me",
      { headers: { cookie: `webdraw_session=${session}` } },
      testEnv,
    );
    expect(me.status).toBe(401);
  });
});
