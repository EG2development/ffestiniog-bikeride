# 27. Build every section from one config and one assembly

Date: 2026-10-25

Scope: `src/three-core/sections.ts` (takes over from `poc.ts`, which survives as a re-export shim), `src/scenes3d/Section3D.tsx`

## Status

Proposed

## Context

The proof of concept keeps its numbers in `POC` (section km, rider start, bridge span, shot split) and assembles its scene in `buildPocScene` and `buildPocExtras`. The reel has six data windows and eight scenes (design D25, D24). Copying that assembly per section would let the sections drift apart, and the spec forbids it (RL4).

## Decision

A `SectionConfig` (id, title, kind `ground` or `aerial`, km range, data window, frame count, rider start, shot specs, caption ids, feature ids, `ve`, and an optional `maxTreesPerKind`, set to 2,500 on trawsfynydd) is the only per-section input. One `buildSectionScene(config, inputs)` assembles every section, and one `Section3D({ section })` composition renders any of them. `poc.ts`'s contents move to `sections.ts`; `poc.ts` stays as a re-export shim, and `POC` stays exported as the Maentwrog entry (`SECTIONS.maentwrog`) so the existing tests and the `Poc3DMaentwrog` composition keep working.

## Consequences

- One place for the assembly; a new section is a config entry, a data window and register entries.
- The pure-core interface block in `docs/design-3d.md` must be updated when the exports change (`tests/docs.test.ts` enforces it).
- The migration is done first on Maentwrog (ADR 40).

## Verification

RL4 (S, T); `tests/three-core/sections.test.ts` (design D23).

## Relations

Amends: [2. Build the 3D work as separate compositions](0002-separate-3d-compositions.md)
Related to: [3. Keep the 3D maths in a pure, React-free core](0003-pure-core-thin-views.md)
