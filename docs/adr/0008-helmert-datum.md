# 8. Convert WGS84 and British National Grid with the OS Helmert transform

Date: 2026-10-25

Scope: `scripts/dem/bng.py`, `src/three-core/bng.ts`

## Status

Proposed

## Context

The DTM is in EPSG:27700 and the OSM route is in WGS84. No projection library is available.

## Decision

Implement the Ordnance Survey's published 7-parameter Helmert transform plus Transverse Mercator in Python (pipeline) and TypeScript (runtime). Both are tested against the OS worked example and a round trip.

## Consequences

- No dependencies.
- About ±5 m horizontal error, compared with OSTN15. In 1 m data that can put the centreline off the trackbed formation; it is measured as profile noise (design risk K1) and recorded as a gap in data/source-register.md.
- Upgrade to OSTN15 if the noise exceeds 1.5 m.

## Verification

`tests/three-core/bng.test.ts` (see docs/spec-3d.md). Design reference: D6 in docs/design-3d.md.

## Relations

Related to: [5. Use the 2D projection for 3D coordinates, at true vertical scale](0005-shared-projection-true-scale.md)
Related to: [6. Use the Welsh lidar DTM for terrain](0006-welsh-lidar-dtm.md)
