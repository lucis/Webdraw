import { Hono } from "hono";
import {
  listModelsQuerySchema,
  listModelsResponseSchema,
  type ListModelsResponse,
  type ModelPurpose,
} from "../../shared/contracts/models";
import { AppError } from "../lib/errors";
import { OpenRouterClient } from "../openrouter/client";
import { filterModelsForPurpose } from "../openrouter/models";
import type { AppBindings } from "../app";

const MODEL_CATALOG_CACHE_SECONDS = 15 * 60;

export interface ModelRouteOptions {
  fetch?: typeof globalThis.fetch;
}

export function createModelRoutes(options: ModelRouteOptions = {}) {
  const app = new Hono<AppBindings>();

  app.get("/", async (context) => {
    const query = listModelsQuerySchema.safeParse(context.req.query());
    if (!query.success) {
      throw new AppError(400, "validation_failed", "Invalid request", query.error.flatten());
    }

    const response = await getModelsForPurpose(context, query.data.purpose, options.fetch);
    return context.json(listModelsResponseSchema.parse(response));
  });

  return app;
}

async function getModelsForPurpose(
  context: { env: AppBindings["Bindings"]; req: { raw: Request }; get: (key: "user") => AppBindings["Variables"]["user"] },
  purpose: ModelPurpose,
  fetchImplementation?: typeof globalThis.fetch,
): Promise<ListModelsResponse> {
  const cacheKey = modelCatalogCacheKey(context.env.APP_ORIGIN, purpose);
  const cache = getModelCatalogCache();
  const cached = await cache.match(cacheKey);
  if (cached) {
    const parsed = listModelsResponseSchema.safeParse(await cached.json().catch(() => null));
    if (parsed.success && parsed.data.purpose === purpose) return parsed.data;
  }

  const client = new OpenRouterClient({
    appOrigin: context.env.APP_ORIGIN,
    fetch: fetchImplementation,
  });
  const response: ListModelsResponse = {
    purpose,
    models: filterModelsForPurpose(await client.listModels({ signal: context.req.raw.signal }), purpose),
  };
  const validated = listModelsResponseSchema.parse(response);

  await cache.put(cacheKey, new Response(JSON.stringify(validated), {
    headers: {
      "cache-control": `public, max-age=${MODEL_CATALOG_CACHE_SECONDS}`,
      "content-type": "application/json; charset=utf-8",
    },
  }));
  return validated;
}

/**
 * The key contains only the stable application origin and requested purpose.
 * It intentionally excludes users, sessions, and OpenRouter credentials.
 */
export function modelCatalogCacheKey(appOrigin: string, purpose: ModelPurpose): Request {
  let origin: string;
  try {
    origin = new URL(appOrigin).origin;
  } catch {
    throw new AppError(500, "internal_error", "Invalid application origin configuration");
  }
  return new Request(new URL(`/__webdraw/model-catalog?purpose=${purpose}`, origin).toString());
}

function getModelCatalogCache(): Cache {
  return (caches as CacheStorage & { default: Cache }).default;
}

export { MODEL_CATALOG_CACHE_SECONDS };
