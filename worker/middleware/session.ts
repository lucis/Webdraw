import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { hashToken } from "../auth/crypto";
import { getSessionUser } from "../db/sessions";
import { AppError } from "../lib/errors";
import type { AppBindings } from "../app";

export const SESSION_COOKIE = "webdraw_session";

export const requireUser = createMiddleware<AppBindings>(async (context, next) => {
  const token = getCookie(context, SESSION_COOKIE);
  if (!token) {
    throw new AppError(401, "unauthorized", "Authentication required");
  }

  const user = await getSessionUser(context.env.DB, await hashToken(token));
  if (!user) {
    throw new AppError(401, "unauthorized", "Authentication required");
  }

  context.set("user", user);
  await next();
});
