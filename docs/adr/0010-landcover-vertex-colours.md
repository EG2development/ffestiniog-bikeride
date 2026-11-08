# 10. Colour the terrain from OSM land cover

Date: 2026-10-25

Scope: `scripts/osm/`, `public/data/landcover-poc.json`, `src/three-core/dem.ts`, `src/three/TerrainView.tsx`

## Status

Proposed

## Context

The brief asks for a realistic landscape. A topographic-map drape reads as a map, and satellite imagery licences are restrictive. OSM land cover is real and ODbL-licensed.

## Decision

The pipeline classifies each DEM node by the OSM land-cover polygon it falls in (woodland, grassland/farmland, heath/scrub, water, built-up, quarry/rock/scree, other). The terrain uses vertex colours from a fixed palette, with no textures in the POC. The cached OpenTopoMap tiles stay available as an aerial "map mode" in Phase 3.

## Consequences

- One draw call, deterministic, licence-clean.
- 4 m node spacing limits colour detail.
- OSM land cover varies in completeness, so it's registered as approximate.

## Verification

H1, RN6 (see docs/spec-3d.md). Design reference: D8 in docs/design-3d.md.

## Relations

Amended by: [31. Terrain relief shading without textures](0031-terrain-shading-without-textures.md)

Related to: [11. Place trees by seeded random inside OSM woodland](0011-seeded-trees-in-woodland.md)
