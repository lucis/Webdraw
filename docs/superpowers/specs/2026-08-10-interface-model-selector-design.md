# Interface model selector

## Objective

Let the user choose the OpenRouter model used when generating or revising an
HTML interface from the Excalidraw canvas.

## Interaction

The canvas control stack exposes a compact native select immediately above the
Generate interface / Update interface button. It contains only models returned
by `GET /api/models?purpose=interface`; each option shows the model name and
its identifier. The first compatible model remains the initial fallback.

Changing the selection updates the model sent to the generation hook. The
choice is persisted in `sessionStorage` under a purpose-specific key, restored
only when it remains present in the freshly loaded compatible catalog, and
otherwise falls back to the first option.

The selector is disabled while a generation is in flight. If no model is
available, the existing actionable error remains visible and the generation
button stays disabled.

## Boundaries

This change does not alter the Worker catalog filtering, credential handling,
artifact schema, or the deferred floating-pill visual revamp. It adds focused
component tests for rendering, selection, persistence, and request payload.
