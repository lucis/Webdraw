# Webdraw HTML Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert selected Excalidraw interface drawings into versioned `sourceHtml` artifacts through OpenRouter and render them safely in an embed positioned to the right of the source.

**Architecture:** The frontend exports a PNG and reduced semantic selection. The Worker validates model capabilities, requests a strict `HtmlArtifact`, stores immutable versions in D1, and returns artifact metadata; a custom Excalidraw embeddable renders the active or candidate version through an isolated `srcdoc` iframe.

**Tech Stack:** Excalidraw 0.18, React, Zustand, TanStack Query, Zod, Hono, D1, OpenRouter multimodal chat completions and structured outputs, iframe sandbox/CSP, Tailwind browser runtime, Vitest, Testing Library, Playwright.

## Global Constraints

- This plan starts only after the Cloudflare foundation completion gate passes.
- The implemented artifact shape is exactly `{ kind: "html"; title: string; sourceHtml: string }`.
- CSS and JavaScript remain inside `sourceHtml`; do not create separate persisted source fields.
- Reserve a `ReactArtifact` type boundary but do not implement React generation, bundling, or preview.
- Drawing-to-code sends both selection PNG and reduced semantic JSON and requires a vision-capable structured-output model.
- Generated JavaScript executes only in `sandbox="allow-scripts"` without same-origin privileges or arbitrary network access.
- Visual revisions update the same artifact through immutable candidate versions; annotations are never deleted automatically.
- Use test-driven development and one focused commit per task.

---

## Planned File Structure

```text
migrations/0002_artifacts.sql
shared/contracts/artifacts.ts
shared/contracts/models.ts
shared/contracts/generation.ts
worker/db/artifacts.ts
worker/db/generations.ts
worker/openrouter/client.ts
worker/openrouter/models.ts
worker/openrouter/interface-generation.ts
worker/routes/models.ts
worker/routes/artifacts.ts
worker/routes/generations.ts
view/src/lib/selection.ts
view/src/lib/artifact-position.ts
view/src/lib/artifact-document.ts
view/src/components/artifacts/ArtifactEmbed.tsx
view/src/components/artifacts/ArtifactEditor.tsx
view/src/components/artifacts/ArtifactControls.tsx
view/src/components/ai/AICommandPalette.tsx
view/src/stores/artifact-store.ts
view/src/hooks/useInterfaceGeneration.ts
e2e/interface-generation.spec.ts
```

---

### Task 1: Add artifact contracts and immutable D1 versions

**Files:**
- Create: `migrations/0002_artifacts.sql`
- Create: `shared/contracts/artifacts.ts`
- Create: `shared/contracts/generation.ts`
- Create: `worker/db/artifacts.ts`
- Create: `worker/db/generations.ts`
- Create: `test/worker/artifacts-db.test.ts`

**Interfaces:**
- Produces: `HtmlArtifact`, reserved `ReactArtifact`, `Artifact`, `ArtifactRecord`, and `ArtifactVersion` schemas.
- Produces: `createArtifact`, `createCandidateVersion`, `activateArtifactVersion`, `getArtifact`, and `listArtifactVersions`.

- [ ] **Step 1: Write failing immutable-version tests**

```ts
const artifact = await createArtifact(env.DB, user.id, drawing.id, {
  kind: "html",
  title: "Checkout",
  sourceHtml: "<!doctype html><html><body>v1</body></html>",
}, metadata);
const candidate = await createCandidateVersion(env.DB, user.id, artifact.id, {
  kind: "html",
  title: "Checkout",
  sourceHtml: "<!doctype html><html><body>v2</body></html>",
}, metadata);
expect((await getArtifact(env.DB, user.id, artifact.id)).activeVersion).toBe(1);
await activateArtifactVersion(env.DB, user.id, artifact.id, 1, candidate.version);
expect((await getArtifact(env.DB, user.id, artifact.id)).activeVersion).toBe(2);
```

Also assert that creating and activating later versions never mutates the source payload of version 1, and a second user cannot read or activate any version.

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:worker -- test/worker/artifacts-db.test.ts`

Expected: FAIL because the artifact schema and repository do not exist.

- [ ] **Step 3: Add schemas and migration**

Define the artifact union with a reserved React variant, but make generation request schemas accept only `kind: "html"`. Create `artifacts`, `artifact_versions`, and `generation_runs` with user/drawing foreign keys, unique `(artifact_id, version)`, active version, prompt/model/source snapshot fields, statuses `pending`, `succeeded`, `failed`, and `cancelled`, and useful ownership/status indexes.

- [ ] **Step 4: Implement transactional repository behavior**

Create artifact plus version 1 in `DB.batch`. Candidate creation uses one atomic `INSERT INTO artifact_versions SELECT COALESCE(MAX(version), 0) + 1` statement scoped through the user's artifact and returns the inserted version. Activation uses `WHERE active_version = ?` and returns `version_conflict` if stale. Version source rows are insert-only through the repository API.

- [ ] **Step 5: Apply and verify**

Run:

```bash
npm run db:migrate:local
npm run test:worker -- test/worker/artifacts-db.test.ts
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit artifact persistence**

```bash
git add migrations/0002_artifacts.sql shared/contracts/artifacts.ts shared/contracts/generation.ts worker/db/artifacts.ts worker/db/generations.ts test/worker/artifacts-db.test.ts
git commit -m "feat: persist versioned HTML artifacts"
```

---

### Task 2: Add OpenRouter model discovery and capability filtering

**Files:**
- Create: `shared/contracts/models.ts`
- Create: `worker/openrouter/client.ts`
- Create: `worker/openrouter/models.ts`
- Create: `worker/routes/models.ts`
- Create: `worker/openrouter/models.test.ts`
- Modify: `worker/app.ts`

**Interfaces:**
- Produces: `OpenRouterClient.chatCompletion`, `OpenRouterClient.listModels`.
- Produces: `supportsInterfaceGeneration(model): boolean` and `supportsStructuredOutput(model): boolean`.
- Produces: `GET /api/models?purpose=interface|drawing|code-revision`.

- [ ] **Step 1: Write failing capability tests**

```ts
expect(supportsInterfaceGeneration({
  inputModalities: ["text", "image"],
  supportedParameters: ["response_format"],
})).toBe(true);
expect(supportsInterfaceGeneration({
  inputModalities: ["text"],
  supportedParameters: ["response_format"],
})).toBe(false);
```

Test normalization of the official `/api/v1/models` response and ensure `/api/models?purpose=interface` excludes text-only models.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- worker/openrouter/models.test.ts`

Expected: FAIL resolving the model module.

- [ ] **Step 3: Implement the fetch-based OpenRouter client**

Use direct `fetch` with `Authorization: Bearer`, `HTTP-Referer: APP_ORIGIN`, `X-OpenRouter-Title: Webdraw`, JSON content type, and the caller's abort signal. Parse bodies with Zod and normalize provider errors into `AppError` without including request authorization or full prompt data.

- [ ] **Step 4: Implement model normalization and route**

Normalize `architecture.input_modalities` and `supported_parameters`. Cache the public normalized catalog through `caches.default` for 15 minutes, keyed by purpose; repeat capability checks before every generation request. Persist model preferences through the existing user repository.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- worker/openrouter/models.test.ts
npm run test:worker
npm run typecheck
```

Then:

```bash
git add shared/contracts/models.ts worker/openrouter worker/routes/models.ts worker/app.ts
git commit -m "feat: expose capability-filtered OpenRouter models"
```

---

### Task 3: Build the isolated HTML preview document

**Files:**
- Create: `view/src/lib/artifact-document.ts`
- Create: `view/src/lib/artifact-document.test.ts`
- Add: `view/src/vendor/tailwind-browser.js`
- Create: `scripts/vendor-tailwind-browser.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildArtifactDocument(sourceHtml: string): string`.
- Produces: `ARTIFACT_SANDBOX = "allow-scripts"`.

- [ ] **Step 1: Write failing document-builder tests**

Assert that a complete and a fragment HTML input produce a document containing UTF-8 metadata, a restrictive CSP, the inline pinned Tailwind runtime, the original markup/script, and a runtime-error bridge. Assert the result contains neither `allow-same-origin` nor a remote Tailwind CDN URL.

```ts
const output = buildArtifactDocument("<button onclick=\"boom()\">Go</button>");
expect(output).toContain("default-src 'none'");
expect(output).toContain("webdraw-tailwind-runtime");
expect(output).not.toContain("cdn.jsdelivr.net");
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- view/src/lib/artifact-document.test.ts`

Expected: FAIL because the builder is absent.

- [ ] **Step 3: Vendor the pinned preview runtime**

Install `@tailwindcss/browser` as an exact dev dependency and add a Node script that resolves and copies its browser bundle to `view/src/vendor/tailwind-browser.js`. Import that file with Vite's `?raw` suffix and inline the pinned runtime into `srcdoc`; a sandboxed opaque-origin document must not depend on a same-origin script fetch. Run the vendor script from `postinstall` and verify the copied asset hash is stable for the lockfile version.

- [ ] **Step 4: Implement deterministic document construction**

Use `DOMParser` in the browser and a test-compatible parser in jsdom. Inject this policy before user content:

```text
default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'
```

Inject a message bridge that reports only `{ type: "webdraw:artifact-error", message }` to the parent. Do not pass application objects into the iframe.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- view/src/lib/artifact-document.test.ts
npm run build
```

Then:

```bash
git add package.json package-lock.json scripts/vendor-tailwind-browser.mjs view/src/vendor/tailwind-browser.js view/src/lib/artifact-document.ts view/src/lib/artifact-document.test.ts
git commit -m "feat: sandbox generated HTML previews"
```

---

### Task 4: Serialize and position Excalidraw selections

**Files:**
- Create: `view/src/lib/selection.ts`
- Create: `view/src/lib/selection.test.ts`
- Create: `view/src/lib/artifact-position.ts`
- Create: `view/src/lib/artifact-position.test.ts`

**Interfaces:**
- Produces: `getSelectionContext(api): SelectionContext`.
- Produces: `exportSelectionPng(context, files): Promise<string>` returning a PNG data URL.
- Produces: `calculateArtifactBounds(sourceBounds): { x; y; width; height }`.

- [ ] **Step 1: Write failing semantic-selection tests**

Use fixtures with a rectangle bound to text, an unrelated element, and volatile fields. Assert the bound text is included, unrelated content is excluded, and semantic output contains only `id`, `type`, `x`, `y`, `width`, `height`, `text`, colors, frame/group relationships, and bindings.

- [ ] **Step 2: Write failing placement tests**

```ts
expect(calculateArtifactBounds({ x: 100, y: 50, width: 500, height: 300 }))
  .toEqual({ x: 680, y: 50, width: 640, height: 384 });
```

Cover narrow and tall sources with minimum width 640, minimum height 360, preserved aspect ratio, and 80-pixel horizontal gap.

- [ ] **Step 3: Verify both suites fail**

Run: `npm test -- view/src/lib/selection.test.ts view/src/lib/artifact-position.test.ts`

Expected: FAIL resolving both modules.

- [ ] **Step 4: Implement selection and PNG export**

Read `selectedElementIds` from the imperative API, include bound text, compute common bounds, create the reduced semantic representation, and use Excalidraw's supported `exportToBlob` utility with selected elements and files. Reject an empty selection before generating a PNG.

- [ ] **Step 5: Implement deterministic placement and verify**

Run:

```bash
npm test -- view/src/lib/selection.test.ts view/src/lib/artifact-position.test.ts
npm run typecheck
```

Then commit:

```bash
git add view/src/lib/selection.ts view/src/lib/selection.test.ts view/src/lib/artifact-position.ts view/src/lib/artifact-position.test.ts
git commit -m "feat: capture interface selections for generation"
```

---

### Task 5: Generate validated HTML artifacts through OpenRouter

**Files:**
- Create: `worker/openrouter/interface-generation.ts`
- Create: `worker/routes/generations.ts`
- Create: `test/worker/interface-generation.test.ts`
- Modify: `worker/app.ts`

**Interfaces:**
- Produces: `POST /api/generations/interface` for `create` and `revise` modes.
- Consumes: encrypted user credential, model capability service, artifact repository, PNG data URL, semantic selection, and strict `HtmlArtifact` schema.

- [ ] **Step 1: Write failing generation-route tests**

Cover unauthenticated access, non-vision model rejection, invalid image MIME type, oversized payload, valid strict request construction, invalid model output, artifact creation, revision candidate creation, and generation-run status.

```ts
expect(openRouterRequest.response_format).toMatchObject({
  type: "json_schema",
  json_schema: { name: "html_artifact", strict: true },
});
expect(openRouterRequest.provider).toMatchObject({ require_parameters: true });
```

- [ ] **Step 2: Verify tests fail at the missing route**

Run: `npm run test:worker -- test/worker/interface-generation.test.ts`

Expected: FAIL with 404.

- [ ] **Step 3: Implement prompt and response validation**

The system instruction requires one complete `sourceHtml` document, Tailwind utilities, embedded optional CSS/JavaScript, no remote dependencies, no markdown fences, and accessible semantic markup. Send text first, then the base64 PNG. Validate JSON Schema output and reject missing doctype/body, external script/style URLs, top navigation, and source above the configured byte limit.

- [ ] **Step 4: Implement route lifecycle**

Create a pending generation run, decrypt the credential only immediately before fetch, call OpenRouter with the request abort signal, validate output, persist artifact/version and success metadata, and mark normalized failures. Never persist the credential, Authorization header, or full base64 image in generation logs.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test:worker -- test/worker/interface-generation.test.ts
npm run test:worker
npm run typecheck
```

Then:

```bash
git add worker/openrouter/interface-generation.ts worker/routes/generations.ts worker/app.ts test/worker/interface-generation.test.ts
git commit -m "feat: generate HTML artifacts with OpenRouter"
```

---

### Task 6: Render and place artifact embeds on the canvas

**Files:**
- Create: `view/src/stores/artifact-store.ts`
- Create: `view/src/hooks/useInterfaceGeneration.ts`
- Create: `view/src/hooks/useInterfaceGeneration.test.ts`
- Create: `view/src/components/artifacts/ArtifactEmbed.tsx`
- Create: `view/src/components/artifacts/ArtifactControls.tsx`
- Create: `view/src/components/artifacts/ArtifactEmbed.test.tsx`
- Modify: `view/src/components/canvas/ExcalidrawCanvas.tsx`

**Interfaces:**
- Produces: custom embed link `webdraw://artifact/<uuid>`.
- Produces: typed custom data `{ webdraw: { kind: "artifact"; artifactId: string; schemaVersion: 1 } }`.
- Consumes: generation endpoint, selection helpers, artifact document builder, and Excalidraw imperative API.

- [ ] **Step 1: Write failing embed component tests**

Assert internal-link recognition, artifact fetch, candidate/active selection, `sandbox="allow-scripts"`, `srcDoc` construction, runtime error display, and no iframe render for unrelated links.

- [ ] **Step 2: Write the failing generation-placement test**

With a fake Excalidraw API and successful generation response, assert `updateScene` receives the existing elements plus one restored embeddable at the calculated bounds, and the viewport scrolls to source plus embed.

- [ ] **Step 3: Verify tests fail**

Run: `npm test -- view/src/components/artifacts/ArtifactEmbed.test.tsx view/src/hooks/useInterfaceGeneration.test.ts`

Expected: FAIL resolving the new modules.

- [ ] **Step 4: Implement artifact store and custom renderer**

Cache artifacts by identifier, track candidate version and preview errors, and expose `loadArtifact`, `showCandidate`, `showActive`, and `reload`. Pass `renderEmbeddable` and `validateEmbeddable` to Excalidraw; return `ArtifactEmbed` only for `webdraw://artifact/` links.

- [ ] **Step 5: Implement create flow and preserve user changes**

Capture the selected context, export PNG, call the endpoint, create the embed through Excalidraw restoration utilities, append it to the live scene, and schedule drawing persistence. Preserve the current uncommitted initial-data and URL-loading behavior in `ExcalidrawCanvas.tsx` while replacing its `any` API reference with the package type where supported.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test -- view/src/components/artifacts/ArtifactEmbed.test.tsx view/src/hooks/useInterfaceGeneration.test.ts
npm test
npm run typecheck
```

Then:

```bash
git add view/src/stores/artifact-store.ts view/src/hooks/useInterfaceGeneration.ts view/src/components/artifacts view/src/components/canvas/ExcalidrawCanvas.tsx
git commit -m "feat: place generated interfaces beside drawings"
```

---

### Task 7: Add source editing and version activation

**Files:**
- Create: `worker/routes/artifacts.ts`
- Create: `test/worker/artifact-routes.test.ts`
- Create: `view/src/components/artifacts/ArtifactEditor.tsx`
- Create: `view/src/components/artifacts/ArtifactEditor.test.tsx`
- Modify: `worker/app.ts`
- Modify: `view/src/components/artifacts/ArtifactControls.tsx`

**Interfaces:**
- Produces: `GET /api/artifacts/:id`, `POST /api/artifacts/:id/versions`, `POST /api/artifacts/:id/activate/:version`.
- Produces: a side panel with one `sourceHtml` editor, active/candidate preview, version list, save, apply, discard, and restore.

- [ ] **Step 1: Write failing API tests**

Assert owner-only reads, manual candidate creation with exact `sourceHtml`, stale activation conflict, and active-version restoration.

- [ ] **Step 2: Write failing editor tests**

Assert one source tab, unsaved-change state, candidate preview without activation, apply activation, discard restoring active preview, and version restoration creating no mutable rewrite.

- [ ] **Step 3: Verify tests fail**

Run:

```bash
npm run test:worker -- test/worker/artifact-routes.test.ts
npm test -- view/src/components/artifacts/ArtifactEditor.test.tsx
```

Expected: Worker route returns 404 and editor module is absent.

- [ ] **Step 4: Implement routes and editor**

Use the same source validation as AI generation for manual saves. The editor sends `expectedActiveVersion`, creates a candidate, and separately activates it. Keep all source in one textarea/editor model; do not split CSS or JavaScript.

- [ ] **Step 5: Verify and commit**

Run all artifact route and editor tests, then `npm run typecheck` and `npm run build`.

```bash
git add worker/routes/artifacts.ts worker/app.ts test/worker/artifact-routes.test.ts view/src/components/artifacts
git commit -m "feat: edit and restore artifact versions"
```

---

### Task 8: Revise artifacts from visual annotations

**Files:**
- Modify: `shared/contracts/generation.ts`
- Modify: `worker/openrouter/interface-generation.ts`
- Modify: `worker/routes/generations.ts`
- Modify: `view/src/hooks/useInterfaceGeneration.ts`
- Create: `view/src/hooks/useArtifactRevision.test.ts`
- Modify: `view/src/components/ai/AICommandPalette.tsx`
- Modify: `view/src/components/artifacts/ArtifactControls.tsx`
- Modify: `test/worker/interface-generation.test.ts`

**Interfaces:**
- Produces: revision request containing artifact ID, expected active version, current `sourceHtml`, annotated screenshot, semantic annotations, instruction, dimensions, and model.
- Produces: candidate version of the same artifact; never a second artifact/embed.

- [ ] **Step 1: Add failing backend revision tests**

Assert revision requires artifact ownership, includes current source and annotation image in the OpenRouter request, rejects stale expected version, and creates version 2 without activating it.

- [ ] **Step 2: Add failing frontend context tests**

Given one selected artifact embed plus text/arrow annotations, assert the action is labeled **Update interface**, screenshot bounds include both embed and annotations, and the returned candidate updates the same artifact store entry without inserting an Excalidraw element.

- [ ] **Step 3: Verify the new tests fail for revision behavior**

Run focused Worker and frontend suites and confirm failures mention missing revision context or incorrect artifact creation.

- [ ] **Step 4: Implement revision flow**

Detect exactly one artifact embed in the selection, treat other selected elements as annotations, capture combined bounds, and submit the active source plus semantic annotations. Preserve the embed's coordinates and dimensions. Candidate apply changes only `active_version`; discard changes only frontend candidate state. Never delete annotations.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test:worker -- test/worker/interface-generation.test.ts
npm test -- view/src/hooks/useArtifactRevision.test.ts
npm test
npm run typecheck
npm run build
```

Then:

```bash
git add shared/contracts/generation.ts worker/openrouter/interface-generation.ts worker/routes/generations.ts test/worker/interface-generation.test.ts view/src/hooks view/src/components/ai view/src/components/artifacts
git commit -m "feat: revise code with canvas annotations"
```

---

### Task 9: Complete the first-pass command UX and browser verification

**Files:**
- Complete: `view/src/components/ai/AICommandPalette.tsx`
- Modify: `view/src/routes/app.tsx`
- Create: `e2e/interface-generation.spec.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: one AI button with context-sensitive Generate/Update interface actions, model selection, phase progress, validation errors, apply/discard/regenerate, and artifact controls.

- [ ] **Step 1: Write the failing browser test**

Use a local OAuth/OpenRouter test seam. Log in, create a drawing fixture, select its interface elements, generate an artifact, assert an embed appears to the right, add an annotation, revise, preview candidate, apply version 2, reload, and assert version 2 remains active.

- [ ] **Step 2: Run and verify the end-to-end failure**

Run: `npx playwright test e2e/interface-generation.spec.ts`

Expected: FAIL because the command palette wiring and complete browser fixture are absent.

- [ ] **Step 3: Finish utilitarian UX wiring**

Add one AI button to app chrome. Disable Generate interface on empty selection, distinguish an artifact revision context, load capability-filtered models, persist last selection through the user preference endpoint, show real phases (`capturing`, `requesting`, `validating`, `previewing`), and expose provider/validation errors without fabricated percentages.

- [ ] **Step 4: Run complete artifact verification**

Run:

```bash
npx playwright test e2e/interface-generation.spec.ts
npm test
npm run test:worker
npm run typecheck
npm run lint
npm run build
npx wrangler deploy --dry-run
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 5: Commit HTML artifact delivery**

```bash
git add view/src/components/ai/AICommandPalette.tsx view/src/routes/app.tsx e2e/interface-generation.spec.ts playwright.config.ts package.json package-lock.json README.md
git commit -m "feat: complete drawing to HTML workflow"
```

---

## HTML Artifact Completion Gate

Before beginning AI drawing operations, verify with a real vision-capable OpenRouter model:

1. A selected interface produces one complete `sourceHtml` artifact.
2. The embed is placed to the right and remains linked after reload.
3. Tailwind styling and local JavaScript work without host access.
4. Manual edits and AI revisions create immutable versions.
5. Candidate discard preserves the active version.
6. Visual annotations revise the same embed and remain on the canvas.
