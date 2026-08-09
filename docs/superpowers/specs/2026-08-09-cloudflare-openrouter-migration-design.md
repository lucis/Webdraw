# Webdraw Cloudflare Workers and OpenRouter Migration Design

Date: 2026-08-09

Status: approved in conversation; awaiting review of the written specification

## Objective

Migrate Webdraw from the deco runtime to a standard Cloudflare Workers application built with Vite. Replace deco authentication and AI bindings with OpenRouter OAuth PKCE and direct OpenRouter API calls. Establish the first useful AI canvas workflows:

1. Convert a selected interface drawing into an executable HTML and Tailwind artifact.
2. Render that artifact in an embed placed to the right of the source drawing.
3. Let the user draw annotations over or around the embed and use those annotations to update the artifact.
4. Let AI create or modify Excalidraw elements from a prompt.

This is a greenfield data migration. Existing localStorage and DECONFIG data will not be imported.

## Product Contract

Webdraw is an AI canvas built on Excalidraw. The first code-generation workflow is explicit rather than continuous:

1. The user draws an interface.
2. The user selects a frame or a group of elements.
3. The user invokes **Generate interface**.
4. Webdraw sends a screenshot and a semantic representation of the selection to a vision-capable OpenRouter model.
5. The model returns one complete HTML document containing markup, Tailwind classes, optional styles, and optional JavaScript.
6. Webdraw stores the artifact, creates an embeddable element to the right of the selection, and renders the generated interface inside it.
7. The user can edit the source manually or draw annotations over or around the embed.
8. Selecting the embed and annotations and invoking AI produces a new version of the same artifact.

The canvas is the visual instruction layer. Generated source remains the source of truth for the embedded application. Webdraw will not attempt to convert arbitrary generated code back into editable Excalidraw primitives.

## Architecture

The application will remain a single full-stack deployment.

- The frontend remains a React SPA built by Vite with TanStack Router, TanStack Query, Zustand, Tailwind, and Excalidraw.
- A standard Cloudflare Worker serves `/api/*` from the same origin.
- Hono provides routing, middleware, cookie handling, and structured HTTP responses. It does not replace or wrap the Cloudflare runtime.
- The official `@cloudflare/vite-plugin` builds the frontend and Worker.
- D1 stores users, sessions, drawings, artifact versions, preferences, and generation metadata.
- The Worker calls OpenRouter directly.
- Generated HTML executes only inside sandboxed iframes in the frontend.

The main backend boundaries are:

- `worker/auth`: OpenRouter OAuth, PKCE, session lifecycle, and credential encryption.
- `worker/api`: authenticated HTTP routes for drawings, artifacts, models, and AI generation.
- `worker/db`: D1 statements, repositories, migrations, and optimistic concurrency.
- `worker/openrouter`: model discovery, capability checks, requests, response validation, and error normalization.
- `shared`: transport schemas and artifact contracts that do not depend on Hono, D1, React, or Excalidraw internals.

The main frontend boundaries are:

- drawing persistence and autosave client;
- AI command palette and generation state;
- selection capture and Excalidraw semantic serialization;
- artifact embed creation and positioning;
- sandboxed HTML renderer;
- source editor and version history.

The frontend never receives the OpenRouter API key or direct D1 access. The preview renderer does not receive the Webdraw session or privileged application APIs.

## Removal of deco

The migration removes all operational deco coupling:

- `@deco/workers-runtime`;
- `deco-cli` and all `deco` package scripts;
- the local deco Vite plugin;
- generated deco types;
- deco tools and MCP routing;
- deco OAuth and request contexts;
- DECONFIG persistence;
- the deco database proxy and runtime-specific Drizzle imports;
- deco workflows and Durable Object bindings;
- deco-specific Wrangler configuration;
- deco-specific GitHub deployment commands and secrets;
- functional UI text and assets used solely for deco authentication.

Historical planning documents may remain as historical documentation, but no production module, build step, runtime configuration, or user-facing workflow may depend on deco.

## Authentication and Sessions

OpenRouter login is the Webdraw identity for this release.

1. `GET /api/auth/login` creates a cryptographically random state value and PKCE verifier and challenge using S256.
2. The Worker stores the short-lived authorization transaction in a protected cookie and redirects to OpenRouter.
3. `GET /api/auth/callback` validates the state and exchanges the returned authorization code and verifier for a user-controlled OpenRouter API key.
4. The returned OpenRouter user identifier is the stable external identity.
5. The API key is encrypted with AES-GCM using key material stored as a Cloudflare Worker secret.
6. Webdraw creates an opaque random session token, stores only its hash in D1, and returns the raw value in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie.
7. Authenticated API requests resolve the session and user before accessing any user-owned record.
8. Logout deletes the session and clears the cookie.

Encryption records include an algorithm/version marker and IV so the storage format can be rotated. OpenRouter credentials never appear in client responses, browser storage, URLs, or logs.

## D1 Data Model

The initial schema contains these logical tables:

### `users`

- `id`: internal UUID primary key
- `openrouter_user_id`: unique external identifier
- default interface-generation model
- default drawing-generation model
- creation and update timestamps

### `credentials`

- `user_id`: unique foreign key
- encrypted OpenRouter API key
- AES-GCM IV
- encryption format version
- update timestamp

### `sessions`

- hash of opaque session token as primary key
- `user_id`
- creation, expiration, and last-used timestamps

### `drawings`

- `id`: UUID primary key
- `user_id`
- name
- complete Excalidraw scene JSON
- monotonic version
- creation and update timestamps

### `artifacts`

- `id`: UUID primary key
- `user_id`
- `drawing_id`
- artifact kind
- active version number
- creation and update timestamps

### `artifact_versions`

- `artifact_id`
- version number
- complete artifact payload
- originating prompt
- model identifier
- semantic source snapshot
- creation timestamp
- composite primary key over artifact and version

### `generation_runs`

- `id`
- `user_id`
- optional drawing and artifact identifiers
- generation purpose
- model identifier
- status
- provider usage fields when reported
- elapsed time
- sanitized error code and message
- creation and completion timestamps

Every repository method takes the authenticated user identifier and includes it in its selection or mutation predicate. Drawing updates use a supplied expected version. Artifact versions are immutable; activating a version is an optimistic update of the artifact record.

## Artifact Contract

The transport contract is an extensible discriminated union:

```ts
type Artifact = HtmlArtifact | ReactArtifact;

interface HtmlArtifact {
  kind: "html";
  title: string;
  sourceHtml: string;
}

interface ReactArtifact {
  kind: "react";
  files: Record<string, string>;
  entrypoint: string;
}
```

Only `HtmlArtifact` is implemented in the first release. `ReactArtifact` reserves the boundary without adding React generation, compilation, or preview behavior.

`sourceHtml` is one complete HTML document. Styles and JavaScript are embedded in that document. Splitting HTML, CSS, and JavaScript into independently synchronized fields is explicitly out of scope.

## Sandboxed Preview

The artifact embed uses an internal link such as `webdraw://artifact/<artifact-id>` plus typed Excalidraw `customData` containing the artifact identifier and schema version.

The custom Excalidraw renderer resolves the active artifact version and constructs `iframe.srcdoc` from `sourceHtml`.

The renderer applies these constraints:

- `sandbox="allow-scripts"` without `allow-same-origin`;
- an injected CSP that denies network access by default;
- no access to Webdraw cookies, local storage, DOM, or JavaScript objects;
- no top-level navigation, pop-ups, downloads, or external form submission;
- no arbitrary third-party script or stylesheet dependencies;
- a pinned Tailwind browser runtime served by Webdraw solely for preview compilation;
- captured runtime errors displayed in the artifact UI rather than propagated to the canvas.

The stored and exported artifact continues to use Tailwind classes. The in-browser compiler is a preview implementation detail, not the recommended deployment mechanism for exported production code.

## Model Discovery and Selection

The Worker retrieves the current OpenRouter model catalog and normalizes the fields needed by the UI: identifier, name, input modalities, supported parameters, context length, and pricing metadata when present. The catalog may be cached for a bounded interval.

The UI filters models by operation:

- drawing to HTML requires image input and structured-output support;
- AI drawing requires structured-output support;
- code-only revisions may use a text model if no image or visual annotations are supplied.

The last selected model is stored independently for interface generation and drawing generation. The Worker repeats capability validation and does not trust the frontend filter.

## Drawing to HTML Flow

1. The user selects a frame or group of Excalidraw elements.
2. The frontend expands the selection to include relevant bound text and calculates the source bounds.
3. It exports only that selection as PNG and encodes it as a private base64 image input.
4. It also builds a reduced semantic document containing element type, text, position, size, color, hierarchy, and bindings. Volatile Excalidraw fields are omitted.
5. The frontend submits the image, semantic document, optional instruction, drawing version, and selected model.
6. The Worker validates authentication, payload limits, drawing ownership, version, and model capabilities.
7. OpenRouter receives the visual input, semantic input, and an exact JSON Schema for `HtmlArtifact`.
8. The Worker validates the response. Invalid source is not persisted or executed.
9. The Worker creates the artifact and immutable version 1 in D1.
10. The frontend creates an Excalidraw embeddable approximately 80 scene pixels to the right of the source bounds. Its initial aspect ratio follows the source while enforcing usable minimum dimensions.
11. The drawing and artifact association are saved.
12. The viewport adjusts to show the source and embed together.

## Artifact Editing and Visual Revision Flow

Selecting an artifact exposes controls for interacting with the iframe, opening source, requesting an AI revision, browsing versions, and reloading the preview.

The source editor contains one editable `sourceHtml` document. A manual save validates the document, creates a new immutable artifact version, and activates it with optimistic concurrency.

For visual revisions:

1. The user leaves iframe interaction mode and draws annotations over or around the embed.
2. The user selects the embed and annotations together.
3. Webdraw detects the artifact relationship and offers **Update interface**.
4. The request includes the active `sourceHtml`, a screenshot of the embed plus annotations, semantic annotation data, a textual instruction, current preview dimensions, and expected artifact version.
5. The Worker asks a compatible OpenRouter model for a complete replacement `HtmlArtifact`.
6. The result is saved as a candidate version.
7. The preview can render the candidate without changing the active version.
8. Applying the candidate activates it. Discarding it leaves the previous active version unchanged.

Annotations remain on the canvas after apply or discard. Webdraw never deletes them automatically.

## AI Drawing Flow

The same AI command surface supports two contexts:

- with no selection, generate elements around the center of the current viewport;
- with a selection, add, update, or remove elements relative to that selection.

The model returns validated operations rather than an entire replacement scene:

```ts
type DrawingOperation =
  | { op: "add"; element: ElementSkeleton }
  | { op: "update"; id: string; patch: ElementPatch }
  | { op: "delete"; id: string };
```

The operation schema limits element types and mutable fields. Updates and deletes may reference only elements included in the authorized request context. The frontend converts skeletons through supported Excalidraw utilities, repairs bindings, and renders a temporary visual preview. The persisted scene changes only when the user applies the result.

## Initial User Experience

Webdraw adds one **AI** button to its canvas chrome. It opens a compact command palette with:

- **Generate interface** or **Update interface**, selected from context;
- **Draw with AI**.

Generation panels include the current selection summary, an optional instruction, a capability-filtered model selector, progress, and errors.

After interface generation, the embed is placed to the right and both source and result remain visible. Selecting the embed exposes these controls:

- Interact
- Edit code
- Update with AI
- Versions
- Reload preview

Code opens in a side panel rather than permanently occupying canvas space. AI drawing results appear as a temporary overlay with Apply, Discard, and Regenerate actions.

This UX is intentionally utilitarian. Visual polish and alternate interaction patterns follow only after the complete workflow works reliably.

## HTTP API

The initial route surface is:

```text
GET    /api/auth/login
GET    /api/auth/callback
POST   /api/auth/logout
GET    /api/me

GET    /api/models

GET    /api/drawings
POST   /api/drawings
GET    /api/drawings/:id
PUT    /api/drawings/:id
DELETE /api/drawings/:id

POST   /api/generations/interface
POST   /api/generations/drawing

GET    /api/artifacts/:id
POST   /api/artifacts/:id/versions
POST   /api/artifacts/:id/activate/:version
```

All application routes use explicit transport schemas shared with the frontend. Authentication errors, insufficient OpenRouter credit, provider rate limits, incompatible models, invalid model output, payload limits, ownership failures, and optimistic version conflicts have distinct machine-readable error codes.

Client cancellation is propagated to OpenRouter fetches when the runtime permits. The first release uses non-streaming structured generation; progress is phase-based rather than fabricated token percentages.

## Error Handling

- No model response is persisted or executed before schema and semantic validation.
- A malformed structured response produces an explicit generation failure; the app does not silently accept partial source.
- Provider errors are normalized without logging credentials or full private prompts.
- D1 mutations that depend on a current drawing or artifact version fail with a conflict response rather than overwriting newer state.
- Applying drawing operations is atomic from the user's perspective: either the validated operation set is accepted or the scene remains unchanged.
- Preview runtime failures are contained within the artifact renderer and are visible to the user.
- API request bodies, image inputs, semantic element counts, and generated output sizes have explicit limits.

## Testing and Verification

The implementation uses test-driven development for behavioral code.

### Unit tests

- PKCE generation and verification
- credential encryption and decryption
- session token hashing and expiration
- shared transport schemas
- semantic Excalidraw filtering
- drawing operation authorization and validation
- artifact document validation
- iframe document and CSP construction
- model capability filtering

### Worker integration tests

- OAuth callback with a simulated OpenRouter server
- authenticated and unauthenticated route behavior
- user isolation for drawings and artifacts
- optimistic concurrency failures
- artifact version creation and activation
- OpenRouter request construction and error normalization
- D1 migrations against a local test database

### Frontend and browser tests

- selection capture and bound-element inclusion
- embed placement to the right of source bounds
- source editing and candidate version preview
- AI drawing preview, apply, and discard
- iframe isolation from the parent DOM, cookies, and storage
- end-to-end drawing to code to embed
- end-to-end annotated embed to candidate version

### Release verification

- unit and integration test suite
- frontend/browser test suite
- TypeScript typecheck
- lint
- production Vite build
- Wrangler configuration validation and deploy dry run
- repository scan confirming no production deco dependency or configuration remains

## Explicitly Out of Scope

- React or TypeScript artifact generation
- compilation of arbitrary multi-file projects
- automatic code-to-Excalidraw reconstruction
- continuous background regeneration
- real-time collaboration
- public artifact sharing or publishing
- arbitrary network access from artifact previews
- separate preview deployment
- migration of localStorage or DECONFIG content
- preservation of legacy MCP tools, workflows, or todo examples

## Acceptance Criteria

1. The application builds, runs, and deploys with Vite and Wrangler as a standard Cloudflare Worker.
2. No production dependency, code path, configuration, deployment workflow, functional asset, or user-facing authentication flow relies on deco.
3. A user signs in through OpenRouter, receives an opaque server session, and never receives the OpenRouter API key in frontend code or storage.
4. D1 records are isolated by the authenticated OpenRouter user.
5. A selected interface drawing produces a validated HTML/Tailwind artifact and an executable embed to its right.
6. The artifact is stored as one `sourceHtml` document.
7. Manual source edits create immutable versions.
8. Visual annotations update the same artifact through a candidate version without destroying history.
9. AI can generate a new Excalidraw drawing and propose validated operations against a selection.
10. Generated JavaScript cannot access the host application, its session, or its storage.
11. Required automated tests, typecheck, lint, production build, and Wrangler dry run pass.

## Primary References

- [Cloudflare Workers Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Cloudflare React and Vite guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare D1 Worker API](https://developers.cloudflare.com/d1/worker-api/)
- [OpenRouter OAuth](https://openrouter.ai/docs/guides/overview/auth/oauth)
- [OpenRouter model catalog](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [OpenRouter image inputs](https://openrouter.ai/docs/guides/overview/multimodal/image-understanding)
- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [Tailwind Play CDN limitations](https://tailwindcss.com/docs/installation/play-cdn)
- `plans/from_wd.md` for prior Webdraw Excalidraw integration patterns
