# Tailwind Preview CDN Report

## Delivered

- Replaced the inlined Tailwind browser bundle with the pinned script URL
  `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3`.
- Preserved the opaque iframe sandbox as `allow-scripts` (without
  `allow-same-origin`).
- Kept `default-src 'none'`; `script-src` permits inline artifact scripts and
  only `https://cdn.jsdelivr.net`. Existing data/blob image handling, inline
  styles, data fonts, disabled connections, forms, and base URLs are unchanged.
- Removed the vendored browser asset, its copy script, the exact dev dependency,
  and the vendor step from `postinstall`. `patch-package` remains the sole
  postinstall action.

## TDD evidence

The updated builder test was run before the implementation and failed because
the prior CSP omitted the CDN origin. It now asserts the exact pinned script,
the restrictive CSP, absence of the old embedded-runtime marker, and the
opaque sandbox.

## Verification

Completed with exit code 0:

```text
npm test -- view/src/lib/artifact-document.test.ts  # 1 file, 3 tests passed
npm run build
npm run typecheck
```

The CDN endpoint was also checked: it responded with HTTP 200, JavaScript
content, and `x-jsd-version: 4.3.3`.

The pre-existing dirty files
`.specstory/history/2025-10-07_19-23Z-sidebar-changes-affecting-drawing-visibility.md`
and `view/CANVAS-SYNC.md` were not modified.
