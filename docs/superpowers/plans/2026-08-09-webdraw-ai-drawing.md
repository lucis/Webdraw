# Webdraw AI Drawing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated user create a new Excalidraw drawing from a prompt or propose safe add/update/delete operations against the current selection through OpenRouter.

**Architecture:** The frontend serializes either the current selection or viewport anchor into a bounded semantic context. The Worker requires strict structured `DrawingOperation[]`; shared validators authorize every referenced identifier and field, while the frontend renders a temporary proposal and mutates/persists the scene only after explicit acceptance.

**Tech Stack:** Excalidraw 0.18, React, Zustand, Zod, Hono, OpenRouter structured outputs, D1 generation metadata, Vitest, Testing Library, Playwright.

## Global Constraints

- This plan starts only after the HTML artifact completion gate passes.
- Without a selection, generation adds elements near the center of the current viewport.
- With a selection, generation may add elements and may update/delete only selected identifiers.
- The model returns operations, never an entire replacement scene.
- All operations are schema-validated and context-authorized before preview.
- Generated skeletons pass through supported Excalidraw restoration/conversion utilities with binding repair.
- The persisted drawing changes only after the user selects Apply.
- Use test-driven development and one focused commit per task.

---

## Planned File Structure

```text
shared/contracts/drawing-operations.ts
worker/openrouter/drawing-generation.ts
worker/routes/generations.ts
view/src/lib/drawing-operations.ts
view/src/stores/ai-drawing-store.ts
view/src/hooks/useAIDrawing.ts
view/src/components/ai/AIDrawingPreview.tsx
view/src/components/ai/AICommandPalette.tsx
e2e/ai-drawing.spec.ts
```

---

### Task 1: Define and authorize drawing operations

**Files:**
- Create: `shared/contracts/drawing-operations.ts`
- Create: `worker/openrouter/drawing-generation.ts`
- Create: `worker/openrouter/drawing-generation.test.ts`

**Interfaces:**
- Produces: `DrawingOperation = AddOperation | UpdateOperation | DeleteOperation`.
- Produces: `validateDrawingOperations(operations, context): DrawingOperation[]`.

- [ ] **Step 1: Write failing schema and authorization tests**

Cover valid rectangle/text/arrow additions, disallowed element types, non-finite geometry, excessive dimensions, unknown patch fields, update/delete of an unselected ID, duplicate IDs, and operation-count limits.

```ts
expect(() => validateDrawingOperations([
  { op: "delete", id: "outside-selection" },
], { selectedIds: new Set(["selected"]), maxOperations: 40 }))
  .toThrowError(/outside the selected context/);
```

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- worker/openrouter/drawing-generation.test.ts`

Expected: FAIL resolving the contract or validator.

- [ ] **Step 3: Implement the exact bounded schema**

Allow add skeleton types `rectangle`, `diamond`, `ellipse`, `line`, `arrow`, and `text`. Permit finite `x`, `y`, positive bounded `width`, `height`, text and known style fields. Update patches exclude `id`, `type`, version fields, deletion flags, and arbitrary custom data. Delete/update references must occur in `selectedIds`; add IDs are generated client-side and therefore omitted from model output.

- [ ] **Step 4: Implement semantic authorization and verify**

Reject the entire operation set on the first invalid operation. Cap the initial release at 40 operations per response. Run focused tests and `npm run typecheck`.

- [ ] **Step 5: Commit operation contracts**

```bash
git add shared/contracts/drawing-operations.ts worker/openrouter/drawing-generation.ts worker/openrouter/drawing-generation.test.ts
git commit -m "feat: validate AI drawing operations"
```

---

### Task 2: Add OpenRouter drawing generation to the Worker

**Files:**
- Modify: `shared/contracts/generation.ts`
- Modify: `worker/openrouter/drawing-generation.ts`
- Modify: `worker/routes/generations.ts`
- Create: `test/worker/drawing-generation.test.ts`

**Interfaces:**
- Produces: `POST /api/generations/drawing`.
- Consumes: prompt, selected semantic elements, selected IDs, viewport center, selected model, drawing ID, and drawing version.
- Returns: validated operations, generation ID, model, and provider usage when present.

- [ ] **Step 1: Write failing route tests**

Cover unauthenticated request, unsupported model, empty prompt, excessive context, strict JSON Schema request, unselected update rejection, valid no-selection additions, valid selection edits, and normalized provider failure.

- [ ] **Step 2: Verify 404 failure**

Run: `npm run test:worker -- test/worker/drawing-generation.test.ts`

Expected: FAIL because the drawing-generation route is not mounted.

- [ ] **Step 3: Implement strict OpenRouter request construction**

The system prompt states coordinate conventions, viewport or selection bounds, supported element types, binding intent, and the operation limit. Send the reduced semantic context and request a strict JSON Schema response:

```ts
interface DrawingOperationResult {
  operations: DrawingOperation[];
  note?: string;
}
```

Set provider routing to require structured-output support. A text-only model is acceptable because this endpoint consumes semantic scene context rather than a screenshot in the first release.

- [ ] **Step 4: Validate, record, and return operations**

Create a generation run, call OpenRouter with the user's decrypted credential and abort signal, parse the schema, authorize operations against selected IDs, record sanitized usage/status, and return without modifying the drawing row.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test:worker -- test/worker/drawing-generation.test.ts
npm run test:worker
npm run typecheck
```

Then:

```bash
git add shared/contracts/generation.ts worker/openrouter/drawing-generation.ts worker/routes/generations.ts test/worker/drawing-generation.test.ts
git commit -m "feat: generate Excalidraw operations with OpenRouter"
```

---

### Task 3: Preview and apply drawing operations safely

**Files:**
- Create: `view/src/lib/drawing-operations.ts`
- Create: `view/src/lib/drawing-operations.test.ts`
- Create: `view/src/stores/ai-drawing-store.ts`
- Create: `view/src/components/ai/AIDrawingPreview.tsx`
- Create: `view/src/components/ai/AIDrawingPreview.test.tsx`

**Interfaces:**
- Produces: `materializeOperations(currentElements, operations): OperationPreview`.
- Produces: `OperationPreview` containing `nextElements`, `addedIds`, `updatedIds`, and `deletedIds`.
- Produces: store actions `setProposal`, `applyProposal`, `discardProposal`, and `clearProposal`.

- [ ] **Step 1: Write failing materialization tests**

Assert additions receive unique cryptographic IDs, updates preserve immutable Excalidraw fields, deletes produce the supported deletion representation, bindings are repaired, and the input element array is never mutated.

- [ ] **Step 2: Write failing preview component tests**

Assert added/updated/deleted counts, visible note, Apply/Discard/Regenerate actions, and no call to drawing persistence before Apply.

- [ ] **Step 3: Verify tests fail**

Run: `npm test -- view/src/lib/drawing-operations.test.ts view/src/components/ai/AIDrawingPreview.test.tsx`

Expected: FAIL because materializer, store, and preview are absent.

- [ ] **Step 4: Implement immutable materialization**

Use Excalidraw conversion/restoration APIs for added skeletons, cryptographic IDs/nonces where the library does not supply them, and library-supported mutation for updates/deletes. Build preview metadata without inserting temporary proposal elements into the persisted scene.

- [ ] **Step 5: Implement proposal state and explicit apply**

`setProposal` stores the base drawing version and computed preview. `applyProposal` first checks that the current drawing version still equals the base version, calls `api.updateScene({ elements: nextElements })`, then triggers the normal versioned autosave. `discardProposal` leaves the Excalidraw API untouched.

- [ ] **Step 6: Verify and commit**

Run focused tests, the full frontend suite, and typecheck. Then:

```bash
git add view/src/lib/drawing-operations.ts view/src/lib/drawing-operations.test.ts view/src/stores/ai-drawing-store.ts view/src/components/ai/AIDrawingPreview.tsx view/src/components/ai/AIDrawingPreview.test.tsx
git commit -m "feat: preview AI drawing changes before apply"
```

---

### Task 4: Integrate both AI drawing modes into the canvas command surface

**Files:**
- Create: `view/src/hooks/useAIDrawing.ts`
- Create: `view/src/hooks/useAIDrawing.test.ts`
- Modify: `view/src/components/ai/AICommandPalette.tsx`
- Modify: `view/src/components/canvas/ExcalidrawCanvas.tsx`
- Modify: `view/src/routes/app.tsx`

**Interfaces:**
- Consumes: selection serializer, generation endpoint, materializer, proposal store, model endpoint, and Excalidraw API.
- Produces: context-aware Draw with AI flow for selection and no selection.

- [ ] **Step 1: Write failing hook tests for both modes**

For no selection, assert request context has `selectedIds: []` and the current viewport center. For a selection, assert it contains only selected and bound semantic elements and their IDs. Assert Regenerate reuses prompt/context with the newly selected model and cancellation aborts the request.

- [ ] **Step 2: Verify hook tests fail**

Run: `npm test -- view/src/hooks/useAIDrawing.test.ts`

Expected: FAIL resolving the hook.

- [ ] **Step 3: Implement the hook and palette state**

Add phases `idle`, `requesting`, `previewing`, `applying`, and `error`. Load models with purpose `drawing`, persist the last model preference, submit context, materialize the result, and open `AIDrawingPreview`. Do not claim token progress; show only real phases.

- [ ] **Step 4: Wire canvas API ownership cleanly**

Expose the mounted Excalidraw API through one focused context/hook instead of copying it into multiple module globals. The artifact and drawing generation hooks consume that context. Preserve the existing current-drawing keying and URL navigation behavior.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- view/src/hooks/useAIDrawing.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

Then:

```bash
git add view/src/hooks/useAIDrawing.ts view/src/hooks/useAIDrawing.test.ts view/src/components/ai/AICommandPalette.tsx view/src/components/canvas/ExcalidrawCanvas.tsx view/src/routes/app.tsx
git commit -m "feat: add context-aware AI drawing commands"
```

---

### Task 5: Verify the full AI canvas workflow

**Files:**
- Create: `e2e/ai-drawing.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: browser-level proof of prompt-to-drawing and selected-element revision.

- [ ] **Step 1: Write the failing browser flow**

Using the local authenticated/OpenRouter test seam, open an empty drawing, invoke Draw with AI, preview generated elements, discard and verify the scene is unchanged, regenerate and apply, reload and verify persistence. Then select generated elements, request a modification, verify only selected IDs are changed/deleted, apply, and reload.

- [ ] **Step 2: Run and verify the browser test fails before final wiring**

Run: `npx playwright test e2e/ai-drawing.spec.ts`

Expected: FAIL at the first unavailable or incomplete AI drawing interaction.

- [ ] **Step 3: Fix only integration gaps exposed by the browser test**

Keep fixes within the documented boundaries: command accessibility, selection capture, proposal rendering, explicit apply, and versioned save. Do not add continuous generation, collaboration, image generation, or React artifacts.

- [ ] **Step 4: Update user documentation**

Document OpenRouter model choice, Draw with AI with and without selection, preview/apply/discard, drawing-to-interface, visual artifact revision, source editing, iframe restrictions, and how user OpenRouter credits are consumed.

- [ ] **Step 5: Run final verification**

Run:

```bash
npx playwright test
npm test
npm run test:worker
npm run typecheck
npm run lint
npm run build
npx wrangler deploy --dry-run
bash scripts/check-no-deco.sh
git diff --check
```

Expected: every command exits 0 and both end-to-end AI workflows pass.

- [ ] **Step 6: Commit AI drawing delivery**

```bash
git add e2e/ai-drawing.spec.ts README.md
git commit -m "feat: complete the Webdraw AI canvas MVP"
```

---

## Final Acceptance Gate

1. OpenRouter OAuth sessions isolate every user's D1 records and credentials.
2. The app has no operational deco dependency.
3. Drawing, folder, artifact, and version data survive reloads.
4. A visual interface generates one sandboxed HTML/Tailwind embed to its right.
5. Drawing annotations revise the same artifact through candidate versions.
6. AI creates a drawing with no selection and proposes bounded changes with a selection.
7. Discard never mutates the scene; Apply persists one optimistic drawing version.
8. Generated iframe JavaScript cannot access the host application, cookies, storage, or network.
9. Unit, Worker integration, frontend, browser, typecheck, lint, build, and Wrangler dry-run checks all pass.
