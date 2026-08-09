import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppBindings } from "../app";
import { createPkce, encryptSecret, hashToken, openAuthTransaction, randomToken, sealAuthTransaction } from "./crypto";
import { buildAuthorizationUrl, exchangeAuthorizationCode } from "./openrouter-oauth";
import { createSession, deleteSession, ensureUser, saveCredential } from "../db/sessions";
import { AppError } from "../lib/errors";
import { requireUser, SESSION_COOKIE } from "../middleware/session";

const AUTH_TRANSACTION_COOKIE = "webdraw_oauth";
const AUTH_TRANSACTION_MAX_AGE_SECONDS = 5 * 60;
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface AuthRouteOptions {
  fetch?: typeof globalThis.fetch;
}

export function createAuthRoutes(options: AuthRouteOptions = {}) {
  const app = new Hono<AppBindings>();
  const fetchImplementation = options.fetch ?? globalThis.fetch;

  app.get("/login", async (context) => {
    const appOrigin = getAppOrigin(context.env.APP_ORIGIN);
    const next = safeNext(context.req.query("next"), appOrigin);
    const state = randomToken();
    const pkce = await createPkce();
    const transaction = await sealAuthTransaction({ state, verifier: pkce.verifier, next }, context.env.AUTH_ENCRYPTION_KEY);

    setCookie(context, AUTH_TRANSACTION_COOKIE, transaction, secureCookieOptions(AUTH_TRANSACTION_MAX_AGE_SECONDS));
    return context.redirect(buildAuthorizationUrl({
      callbackUrl: new URL("/api/auth/callback", appOrigin).toString(),
      codeChallenge: pkce.challenge,
      state,
    }));
  });

  app.get("/callback", async (context) => {
    const code = context.req.query("code");
    const state = context.req.query("state");
    if (!code || !state) {
      throw new AppError(400, "validation_failed", "Missing OAuth callback parameters");
    }

    const transactionCookie = getCookie(context, AUTH_TRANSACTION_COOKIE);
    if (!transactionCookie) {
      throw new AppError(401, "unauthorized", "Invalid OAuth state");
    }

    let transaction;
    try {
      transaction = await openAuthTransaction(transactionCookie, context.env.AUTH_ENCRYPTION_KEY);
    } catch {
      throw new AppError(401, "unauthorized", "Invalid OAuth state");
    }
    if (transaction.state !== state) {
      throw new AppError(401, "unauthorized", "Invalid OAuth state");
    }

    const credential = await exchangeAuthorizationCode({ code, verifier: transaction.verifier }, fetchImplementation);
    const user = await ensureUser(context.env.DB, credential.userId);
    await saveCredential(
      context.env.DB,
      user.id,
      await encryptSecret(credential.key, context.env.AUTH_ENCRYPTION_KEY),
    );

    const sessionToken = randomToken();
    await createSession(
      context.env.DB,
      user.id,
      await hashToken(sessionToken),
      Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    );

    deleteCookie(context, AUTH_TRANSACTION_COOKIE, secureCookieOptions(0));
    setCookie(context, SESSION_COOKIE, sessionToken, secureCookieOptions(SESSION_MAX_AGE_SECONDS));
    return context.redirect(transaction.next);
  });

  app.post("/logout", requireUser, async (context) => {
    const token = getCookie(context, SESSION_COOKIE);
    if (token) {
      await deleteSession(context.env.DB, context.get("user").id, await hashToken(token));
    }
    deleteCookie(context, SESSION_COOKIE, secureCookieOptions(0));
    return context.body(null, 204);
  });

  return app;
}

function secureCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "Lax" as const,
    secure: true,
  };
}

function getAppOrigin(value: string): string {
  try {
    const origin = new URL(value).origin;
    if (origin === "null") throw new Error("Invalid origin");
    return origin;
  } catch {
    throw new AppError(500, "internal_error", "Invalid application origin configuration");
  }
}

function safeNext(value: string | undefined, appOrigin: string): string {
  if (!value || !value.startsWith("/")) return "/";

  try {
    const destination = new URL(value, appOrigin);
    if (destination.origin !== appOrigin) return "/";
    if (destination.pathname === "/canvas") {
      return `/app${destination.search}${destination.hash}`;
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
