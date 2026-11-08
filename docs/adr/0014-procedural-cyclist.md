# 14. Use a procedural cyclist model for the proof of concept

Date: 2026-10-25

Scope: `src/three/CyclistView.tsx`, `data/assets-3d.json`

## Status

Proposed

## Context

The brief prefers rigged, licensed models but warns against complex character systems. No model has been sourced.

## Decision

Build the bike and rider from three.js primitives: wheel diameter 0.68 m, wheelbase 1.05 m, riding height 1.70 m, overall length 1.75 m. Register it as an original asset (`data/assets-3d.json`, done at t14). A rigged CC0 model is evaluated in Phase 3 under its own ADR.

## Consequences

- Exact proportions and no licence risk.
- Less natural body movement than a rigged model.

## Verification

C1, C8 (see docs/spec-3d.md). Design reference: D12 in docs/design-3d.md.

## Relations

Amended by: [34. Build the cyclist from its dimensions](0034-cyclist-from-dims.md)

Related to: [15. Drive cyclist motion from a precomputed distance table](0015-distance-table-motion.md)
