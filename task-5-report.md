# Task 5 — OpenRouter OAuth and Session Middleware

## Scope delivered

- `GET /api/auth/login` creates an S256 PKCE transaction, stores its random state and verifier in a sealed `webdraw_oauth` cookie, and redirects to the OpenRouter authorization endpoint.
- `GET /api/auth/callback` validates the sealed transaction and state, exchanges the code through an injected-fetch OpenRouter adapter, encrypts the returned credential, creates an opaque 30-day session, and redirects only to a same-origin slash-prefixed path.
- `POST /api/auth/logout` requires a valid session, removes its D1 record, and expires the browser cookie.
- `GET /api/me` requires a valid session and returns only the public current-user contract.

## Security design

- OAuth transaction cookie: AES-GCM sealed, five-minute maximum age, `HttpOnly`, `Secure`, `SameSite=Lax`, and root path.
- Session cookie: raw random token only in `webdraw_session`; D1 receives only the SHA-256 hash. It is `HttpOnly`, `Secure`, `SameSite=Lax`, root-scoped, and expires after 30 days.
- OpenRouter keys are encrypted with the existing AES-GCM credential primitive before D1 persistence. They are never included in HTTP responses.
- The OpenRouter adapter targets `https://openrouter.ai/auth` and `https://openrouter.ai/api/v1/auth/keys`; its fetch dependency is supplied by the application factory in tests, so the test suite makes no network calls.
- `next` defaults to `/` unless it begins with `/` and resolves to the configured `APP_ORIGIN`.
- `AppError` is converted by the application's sole Hono `onError` handler to the shared API error response shape.

## Test-driven evidence

The OAuth route test was added first and run against the baseline application. It failed with `GET /api/auth/login` returning `404` instead of the expected `302`. The final Worker route suite covers PKCE redirect construction, sealed transaction attributes, state mismatch, null OpenRouter user identity, encrypted credential persistence, key-free `/api/me`, safe redirect handling, and logout invalidation.

## Local configuration

`.dev.vars.example` contains the required variable names and the non-secret local `APP_ORIGIN=http://localhost:5173` default. No `.dev.vars` content was read, copied, or reported.

## Review correction

The local `APP_ORIGIN` example was corrected to `http://localhost:5173`, so copying the template provides a valid origin for the OAuth callback without exposing any credential.
