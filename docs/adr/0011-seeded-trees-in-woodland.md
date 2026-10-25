# 11. Place trees by seeded random inside OSM woodland

Date: 2026-10-25

Scope: `src/three-core/rng.ts`, `src/three/TreesView.tsx`, `data/features-3d.json`

## Status

Proposed

## Context

The brief asks for vegetation, and renders must be deterministic.

## Decision

Two instanced tree meshes, positioned by `mulberry32` with a fixed seed, only inside OSM woodland polygons, at a set density. Registered as decorative.

## Consequences

- Deterministic (RN1, RN2) and cheap (two draw calls).
- Individual trees and species are not real, so they're labelled decorative.

## Verification

RN1, RN2, H1 (see docs/spec-3d.md). Design reference: D9 in docs/design-3d.md.

## Relations

Related to: [10. Colour the terrain from OSM land cover](0010-landcover-vertex-colours.md)
