# 24. Load 3D compositions lazily

Date: 2026-10-25

Scope: `src/Root.tsx`, `src/scenes3d/`

## Status

Proposed

## Context

The benchmark against the pre-3D baseline (task t8, docs/validation-3d.md) found the 2D video's output and render time unchanged, but its bundle had grown. `src/Root.tsx` imported the POC scene statically, so three.js, React Three Fiber and the 3D code sat in the entry chunk that every composition loads: `bundle.js` grew from about 1.1 MB to 3.97 MB, and the bundle's JavaScript from 15.5 MB to 18.4 MB.

## Decision

`src/Root.tsx` imports no 3D module. Each 3D composition is registered with `lazyComponent={() => import("./scenes3d/…")}`, and its frame count and frame rate come from `calculateMetadata`, which imports `src/three-core/poc` dynamically. The composition id is written as a literal; a static test checks it against `POC.compositionId`. Each 3D scene module has a default export for `lazyComponent`.

## Consequences

- The 2D video's entry chunk no longer contains the 3D code; the 3D code is fetched only when a 3D composition is selected.
- The bundler still compiles the 3D code, so building the bundle takes slightly longer than before the 3D work (about 30 ms).
- The composition id appears in two places (the literal in `src/Root.tsx` and `POC.compositionId`); the static test keeps them equal.

## Verification

`tests/static-3d.test.ts` (no static 3D import in `src/Root.tsx`, the lazy import, the id). The t8 benchmark in docs/validation-3d.md (entry-chunk size, RG1, render times).

## Relations

Amends: [2. Build the 3D work as separate compositions](0002-separate-3d-compositions.md)
