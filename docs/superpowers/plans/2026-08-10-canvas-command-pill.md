# Canvas Command Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the persistent navigation chrome with an accessible canvas command pill and contextual popovers.

**Architecture:** The app route owns the pill and the workspace popover. The Excalidraw canvas exposes only the small generation control interface it needs, while its scene ownership and autosave remain unchanged. Existing folder, drawing, resource and account components are composed into popover sections instead of being rewritten.

**Tech Stack:** React 19, TypeScript, Radix Popover, lucide-react, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Position the pill in the top center of the right viewport half, away from native Excalidraw edge controls.
- Remove the fixed sidebar, sidebar toggle, and fixed header from `/app`; the canvas fills the viewport.
- `Click` uses a camera icon and captures the existing selected-interface generation flow.
- Hover, focus, and coarse-pointer click expose a searchable interface-model picker sourced exclusively from `/api/models?purpose=interface`.
- Retain a keyboard-accessible workspace popover for drawings, folders, resources, and account actions.
- Do not implement AI drawing, streaming HTML, or optimistic embed placeholders in this plan.

---

### Task 1: Extract a canvas generation command interface

**Files:**
- Modify: `view/src/components/canvas/ExcalidrawCanvas.tsx`
- Modify: `view/src/components/canvas/ExcalidrawCanvas.test.tsx`
- Create: `view/src/components/canvas/canvas-command-context.tsx`

**Interfaces:**
- Produces: `CanvasCommandContext` exposing `canGenerate`, `generationLabel`, `generationPhase`, `models`, `activeModelId`, `setActiveModelId`, and `generateInterface`.
- Consumes: the current Excalidraw selection, existing model catalog, and `useInterfaceGeneration`.

- [ ] Write failing tests proving an external consumer can invoke generation and select a model without duplicate canvas state.
- [ ] Run the focused canvas test and observe the unavailable context API.
- [ ] Implement a provider colocated with the canvas that publishes current command state and callbacks while preserving current canvas persistence behavior.
- [ ] Remove the old top-right generation controls from `ExcalidrawCanvas`; leave errors and generation state available through the provider.
- [ ] Run focused tests, full tests, typecheck, lint, and build; commit `refactor: expose canvas generation commands`.

### Task 2: Build the command pill and interface model picker

**Files:**
- Create: `view/src/components/canvas/CanvasCommandPill.tsx`
- Create: `view/src/components/canvas/CanvasCommandPill.test.tsx`
- Modify: `view/src/routes/app.tsx`

**Interfaces:**
- Consumes: `CanvasCommandContext` and `syncStatus`.
- Produces: fixed `CanvasCommandPill` with camera action and model picker.

- [ ] Write failing tests for camera action disabled/enabled states, accessible Generate/Update naming, searched model filtering, selection, pointer/focus opening, Escape closure, and loading/error state.
- [ ] Run the component test and observe the missing pill.
- [ ] Implement the elevated pill at the required position. Use a labelled camera button for generation; on hover/focus/click open a Popover with text search and filtered list. Keep it open while its trigger or content contains pointer/focus, and ensure keyboard list selection commits the context model.
- [ ] Render drawing name and sync state in the pill; render model errors and generation errors in the pill rather than the canvas.
- [ ] Mount the pill above the canvas in `/app`, preserving full viewport canvas dimensions.
- [ ] Run focused tests, full tests, typecheck, lint, and build; commit `feat: add canvas command pill`.

### Task 3: Move workspace navigation into the pill menu

**Files:**
- Create: `view/src/components/canvas/WorkspacePopover.tsx`
- Create: `view/src/components/canvas/WorkspacePopover.test.tsx`
- Modify: `view/src/routes/app.tsx`
- Modify: `view/src/components/LeftSidebar.tsx`
- Modify: `view/src/components/SidebarToggle.tsx`

**Interfaces:**
- Consumes: existing `FolderNavigation`, `DrawingNavigation`, `ResourcesSection`, and `UserButton`.
- Produces: one menu trigger in `CanvasCommandPill` that opens a two-section workspace popover.

- [ ] Write failing tests for opening menu, visible Drawings/Project sections, composed navigation, account access, and no fixed sidebar/header/toggle in the app route.
- [ ] Run focused tests and observe the unavailable workspace popover.
- [ ] Implement `WorkspacePopover` below the pill with scroll boundaries appropriate to its content. Compose existing navigation and user components; keep their edit dialogs/actions functional.
- [ ] Replace the sidebar/header/toggle composition in `/app` with the workspace menu trigger and delete unused route-level visibility state. Keep `LeftSidebar` and `SidebarToggle` only if other routes import them; otherwise remove them with their tests/imports.
- [ ] Run focused tests, full tests, typecheck, lint, build, and manually verify keyboard Escape/focus return; commit `feat: move workspace controls into command pill`.

### Task 4: Verify the whole visual command surface

**Files:**
- Modify: `README.md`
- Modify: relevant test files from Tasks 1-3 only if integration gaps are exposed.

**Interfaces:**
- Produces: documented keyboard and pointer behavior for the command pill.

- [ ] Add a concise README section covering command pill, camera generation, model picker, and workspace popover.
- [ ] Run `npm test`, `npm run test:worker`, `npm run typecheck`, `npm run lint`, `npm run build`, `bash scripts/check-no-deco.sh`, and `git diff --check` scoped to authored files.
- [ ] Fix only failures caused by this plan; do not touch user-owned dirty files.
- [ ] Commit `docs: document canvas command pill`.
