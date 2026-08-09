import { AppError } from "../lib/errors";

const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_KEY_EXCHANGE_URL = "https://openrouter.ai/api/v1/auth/keys";

export interface AuthorizationRequest {
  callbackUrl: string;
  codeChallenge: string;
  state: string;
}

export interface AuthorizationCodeExchange {
  code: string;
  verifier: string;
}

export interface OpenRouterCredential {
  key: string;
  userId: string;
}

export function buildAuthorizationUrl(request: AuthorizationRequest): string {
  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set("callback_url", request.callbackUrl);
  url.searchParams.set("code_challenge", request.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", request.state);
  return url.toString();
}

export async function exchangeAuthorizationCode(
  exchange: AuthorizationCodeExchange,
  fetchImplementation: typeof globalThis.fetch,
): Promise<OpenRouterCredential> {
  let response: Response;

  try {
    response = await fetchImplementation(OPENROUTER_KEY_EXCHANGE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: exchange.code,
        code_verifier: exchange.verifier,
        code_challenge_method: "S256",
      }),
    });
  } catch {
    throw new AppError(502, "openrouter_error", "OpenRouter OAuth exchange failed");
  }

  if (!response.ok) {
    throw new AppError(502, "openrouter_error", "OpenRouter OAuth exchange failed");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!isCredentialResponse(body)) {
    throw new AppError(502, "openrouter_error", "Invalid OpenRouter OAuth response");
  }

  return { key: body.key, userId: body.user_id };
}

function isCredentialResponse(value: unknown): value is { key: string; user_id: string } {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  return typeof response.key === "string" && response.key.length > 0 &&
    typeof response.user_id === "string" && response.user_id.length > 0;
}
