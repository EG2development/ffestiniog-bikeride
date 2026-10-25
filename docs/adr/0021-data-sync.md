# 21. Treat data/ as the source of truth, synced to public/data

Date: 2026-10-25

Scope: `data/`, `public/data/`, `src/data/RouteDataProvider.tsx`

## Status

Proposed

## Context

Renders fetch from `public/data/`, and the README asks for files to be re-copied by hand, which risks drift.

## Decision

`npm run data:sync` copies `data/*.json` and `data/*.geojson` to `public/data/`, and a static test fails if any pair differs. Large generated binaries (`*.f32`, `*.u8`) live only in `public/data/`, each with a JSON provenance header.

## Consequences

- No silent drift between source and runtime data.
- One more script to run after editing `data/`.

## Verification

Static test that the copies are identical (see docs/spec-3d.md). Design reference: D19 in docs/design-3d.md.

## Relations

Related to: [20. Keep feature and asset registers as validated JSON](0020-registers-as-json.md)
