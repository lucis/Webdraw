import {
  apiErrorResponseSchema,
  type ApiErrorCode,
} from "../../../shared/contracts/errors";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function requestJson<TOutput>(
  path: string,
  init: RequestInit = {},
): Promise<TOutput> {
  const requestInit: RequestInit = {
    ...init,
    credentials: "same-origin",
  };

  if (init.body != null) {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    requestInit.headers = headers;
  }

  const response = await fetch(path, requestInit);

  if (response.ok) {
    if (response.status === 204 || response.status === 205) {
      return undefined as TOutput;
    }

    const body = await response.text();
    return (body.length === 0 ? undefined : JSON.parse(body)) as TOutput;
  }

  const errorBody = await response.json().catch(() => undefined);
  const parsedError = apiErrorResponseSchema.safeParse(errorBody);
  if (parsedError.success) {
    const { code, message, details } = parsedError.data.error;
    throw new ApiClientError(response.status, code, message, details);
  }

  throw new ApiClientError(
    response.status,
    "internal_error",
    `Request failed with status ${response.status}`,
  );
}
