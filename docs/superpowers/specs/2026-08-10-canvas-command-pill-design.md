# Canvas command pill design

## Objective

Replace the persistent app sidebar and top header with one unobtrusive command
pill over the Excalidraw canvas, retaining access to drawings, folders, account,
interface generation, and saving state without competing with native canvas
controls.

## Placement and closed state

The pill is fixed near the top, centered within the right half of the viewport.
This avoids Excalidraw controls at both edges. It contains, from left to right:

1. a Webdraw mark and the current drawing name;
2. a compact sync state indicator;
3. the primary `Click` action, represented by a camera icon and accessible name
   `Generate interface`;
4. a menu trigger.

The pill does not change canvas dimensions or intercept drawing interactions
outside its bounds.

## Interface generation action

`Click` captures the active canvas selection and invokes the existing interface
generation flow. It is disabled when there is no valid selection, the model
catalog has no compatible entry, or a generation is active. Its existing
generate/update semantics remain: one selected artifact embed changes the
label to `Update interface`.

Hovering or keyboard focusing the camera action opens a searchable model
popover. The popover stays open while pointer or focus moves into it. It lists
only the existing `purpose=interface` catalog, filters by model name or ID,
and commits the chosen model to the current session preference. The active
model is indicated on the action without permanently expanding the pill.

The model popover is usable by keyboard: focus opens it, text search filters,
arrow keys move through options, Enter selects, and Escape closes it. On a
coarse pointer device, click/tap toggles the same popover.

## Workspace menu

The trailing menu opens a popover below the pill. It has two compact sections:

- **Drawings:** current folder drawings, select drawing, create drawing, and
  per-drawing context actions.
- **Project:** folders with create/select/edit/delete actions, followed by the
  existing account menu.

Folder or drawing editors remain dialogs/popovers within this menu. The canvas
does not resize and the old permanent sidebar and fixed header are removed.

## States and accessibility

The pill uses one elevated surface with high contrast over any canvas color,
visible focus rings, labelled icon-only controls, and live save/error status.
Errors remain visible within the pill/menu rather than as detached controls.
Loading generation shows a non-fabricated busy state on `Click`.

## Scope boundaries

This revamp only reorganizes existing app controls. It does not implement AI
drawing, streaming HTML artifacts, or optimistic/loading embeds; those remain
separate queued work after the visual revamp.
