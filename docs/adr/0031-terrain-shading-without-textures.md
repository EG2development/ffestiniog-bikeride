# 31. Terrain relief shading without textures

Date: 2026-10-25

Scope: `src/three-core/shading.ts`, `src/three/TerrainView.tsx`

## Status

Proposed

## Context

Vertex colours from land cover read flat (ADR 10). A detail normal map is the cheapest visual upgrade the materials guide names, but it needs a licensed texture, and the asset register is empty.

## Decision

`shadeTerrain(mesh, grid)` (pure) multiplies each vertex's land-cover colour by a slope factor from the DEM gradient and a height tint, within fixed bounds. `TerrainView` uses `MeshStandardMaterial` (roughness 0.95, metalness 0) with those vertex colours. A detail normal map waits until a CC0 texture set is registered under L1.

## Consequences

- Relief reads without any asset; the RN5b colour-bin count rises.
- The effect is subtle by design; it must not invent features.
- Adding a texture later is a view change plus a register entry, not a core change.

## Verification

RL10 (R, V); `tests/three-core/shading.test.ts` (design D27).

## Relations

Amends: [10. Colour the terrain from OSM land cover as vertex colours](0010-landcover-vertex-colours.md)
