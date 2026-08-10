# Interface Model Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user choose the compatible OpenRouter model used for interface generation and revision.

**Architecture:** Keep the compatible catalog in `ExcalidrawCanvas`, where it is already loaded. Replace its implicit first-model selection with a controlled native select and a purpose-scoped session preference that is validated against each refreshed catalog.

**Tech Stack:** React 19, TypeScript, Testing Library, Vitest, sessionStorage.

## Global Constraints

- Only models returned by `GET /api/models?purpose=interface` may appear or be submitted.
- The first compatible model remains the fallback when no valid session choice exists.
- Do not change Worker catalog filtering, credentials, artifact contracts, or floating-pill UI scope.
- Disable the selector during an in-flight generation and preserve existing error behavior.

---

### Task 1: Expose and persist the interface model choice

**Files:**
- Modify: `view/src/components/canvas/ExcalidrawCanvas.tsx`
- Modify: `view/src/components/canvas/ExcalidrawCanvas.test.tsx`

**Interfaces:**
- Consumes: `ListModelsResponse` from `/api/models?purpose=interface`.
- Produces: a labelled `select` with one option per compatible model and `model` sent to `useInterfaceGeneration.generate`.

- [ ] **Step 1: Write failing component tests**

Add tests with two catalog entries asserting that the labelled select renders both model names and IDs, uses the first as fallback, changes the outgoing generation payload after selection, restores a valid `sessionStorage` value, and discards a stale one.

```tsx
expect(await screen.findByLabelText("Interface model")).toHaveValue("vision-a");
fireEvent.change(screen.getByLabelText("Interface model"), { target: { value: "vision-b" } });
fireEvent.click(screen.getByRole("button", { name: "Generate interface" }));
await waitFor(() => expect(requestJson).toHaveBeenCalledWith(
  "/api/generations/interface",
  expect.objectContaining({ body: expect.stringContaining('"model":"vision-b"') }),
));
```

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- view/src/components/canvas/ExcalidrawCanvas.test.tsx`

Expected: FAIL because the canvas has no labelled model selector and always submits the first model.

- [ ] **Step 3: Implement controlled catalog selection**

Store the catalog as `interfaceModels`. On each drawing change, load the catalog, read `sessionStorage.getItem("webdraw.interface-model")`, and select that ID only if it is included; otherwise select `models[0]?.id ?? null`. Render:

```tsx
<label className="sr-only" htmlFor="interface-model">Interface model</label>
<select
  id="interface-model"
  aria-label="Interface model"
  value={interfaceModel ?? ""}
  disabled={!interfaceModel || interfaceGeneration.phase !== "idle"}
  onChange={(event) => {
    const model = event.target.value;
    setInterfaceModel(model);
    sessionStorage.setItem("webdraw.interface-model", model);
  }}
>
  {interfaceModels.map((model) => <option key={model.id} value={model.id}>{`${model.name} (${model.id})`}</option>)}
</select>
```

Keep it in the existing top-right control stack directly above the generation button. Do not read/write storage during server rendering.

- [ ] **Step 4: Verify the focused and full frontend suite**

Run:

```bash
npm test -- view/src/components/canvas/ExcalidrawCanvas.test.tsx
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits 0.

- [ ] **Step 5: Commit the feature**

```bash
git add view/src/components/canvas/ExcalidrawCanvas.tsx view/src/components/canvas/ExcalidrawCanvas.test.tsx
git commit -m "feat: let users select interface generation models"
```
