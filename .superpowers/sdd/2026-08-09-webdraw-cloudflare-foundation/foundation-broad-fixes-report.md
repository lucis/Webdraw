# Foundation broad fixes report — 2026-08-09

## Scope

Implemented the four Important findings from `foundation-broad-review.md` only.
The pre-existing user changes in `.specstory/**` and `view/CANVAS-SYNC.md`
were not modified or staged.

## Decisions and implementation

1. **Autosave identity isolation.** The canvas captures the selected drawing
   ID and version when it schedules its debounce. A drawing ID/version change
   clears that pending timer; the timer also verifies that selection before it
   calls the save API. The store preserves a newly selected drawing and its
   sync status if a previous drawing's in-flight save finishes later.
2. **Legacy canvas URLs.** `/canvas` is now a TanStack route redirect to
   `/app`, retaining `drawingId` and replacing history. OAuth normalizes a
   requested `/canvas` next path to `/app` (including query/hash), so the
   callback lands directly on the initialized, authenticated application.
3. **D1 scene limit.** A serialized scene is capped at **1,000,000 UTF-8
   bytes**, below D1's 2,000,000-byte row-value limit. The full drawing
   create/update request is capped at **1,100,000 bytes** while streaming the
   body. Both failures use the existing shared error envelope with HTTP 413,
   `validation_failed`, and `{ maxBytes }`. The README documents both caps and
   the need to externalize binary image payloads (for example to R2).
4. **Release migrations.** Production CI now runs
   `wrangler d1 migrations apply DB --remote` with the same account/token
   secrets immediately before `wrangler deploy`. Preview CI is unchanged and
   does not run remote migrations.

## TDD evidence

Each behavior began with a failing focused test:

- `ExcalidrawCanvas.test.tsx`: edit A, switch to B inside the two-second
  debounce, and assert no request targets B. The old code issued a PUT to B
  containing A's scene.
- `drawing-store.test.ts`: switch selections while A's save request is
  unresolved and assert the completion cannot replace B. The old code replaced
  B with A and reset its sync status.
- `canvas.test.tsx`: require the legacy route to redirect to `/app` while
  retaining `drawingId`; the original route had no `beforeLoad` redirect.
- `auth.test.ts`: require an OAuth callback started with `next=/canvas` to
  redirect to `/app`; the original response returned `/canvas`.
- `resources.test.ts`: require oversized serialized scenes and oversized raw
  request bodies to return the 413 shared validation envelope; the original
  routes respectively accepted the scene and returned 400 after parsing.

## Verification

Completed after the fixes:

```text
npm test                                      # 6 files, 26 tests passed
npm run test:worker                           # 4 files, 22 tests passed
npm run typecheck                             # passed
npm run lint                                  # passed
npm run build                                 # passed
bash scripts/check-no-deco.sh                 # passed
npx wrangler deploy --dry-run                 # passed; DB binding enumerated
```

The deployment workflows were parsed as YAML and checked for migration ordering,
the required production credentials, and the absence of remote D1 migration
commands in preview.
