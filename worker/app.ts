import { Hono } from "hono";
import { createAuthRoutes } from "./auth/routes";
import { RepositoryError } from "./db/types";
import { AppError } from "./lib/errors";
import { requireUser } from "./middleware/session";
import { createDrawingRoutes } from "./routes/drawings";
import { createFolderRoutes } from "./routes/folders";

export interface AuthEnv {
  APP_ORIGIN: string;
  AUTH_ENCRYPTION_KEY: string;
}

export type AppBindings = {
  Bindings: Env & AuthEnv;
  Variables: { user: { id: string; openRouterUserId: string } };
};

export interface AppOptions {
  fetch?: typeof globalThis.fetch;
}

export function createApp(options: AppOptions = {}) {
  const app = new Hono<AppBindings>();

  app.get("/api/health", (context) => context.json({ ok: true }));
  app.route("/api/auth", createAuthRoutes({ fetch: options.fetch }));
  app.get("/api/me", requireUser, (context) => context.json({ user: context.get("user") }));
  app.use("/api/folders/*", requireUser);
  app.route("/api/folders", createFolderRoutes());
  app.use("/api/drawings/*", requireUser);
  app.route("/api/drawings", createDrawingRoutes());

  app.onError((error, context) => {
    if (error instanceof RepositoryError) {
      const repositoryError = {
        default_folder: new AppError(403, "forbidden", "Default folder cannot be deleted"),
        not_found: new AppError(404, "not_found", "Resource not found"),
        version_conflict: new AppError(409, "version_conflict", "Drawing has been updated"),
      }[error.code];
      return context.json({ error: { code: repositoryError.code, message: repositoryError.message } }, repositoryError.status);
    }

    if (error instanceof AppError) {
      return context.json({ error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) } }, error.status);
    }

    return context.json(
      { error: { code: "internal_error", message: "Internal server error" } },
      500,
    );
  });

  return app;
}
