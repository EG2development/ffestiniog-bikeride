# 5. Use the 2D projection for 3D coordinates, at true vertical scale

Date: 2026-10-25

Scope: `src/data/route.ts`, `src/three-core/`

## Status

Proposed

## Context

The 2D map and the 3D scenes must agree. `project()` in `src/data/route.ts` already maps lon/lat to a local, route-aligned plane with 1 world unit = 10 m and y pointing screen-down.

## Decision

3D `(x, y, z)` = (`project().x`, `elevation_m / 10 × VE`, `project().y`) with vertical exaggeration VE = 1. Every geographic point, terrain grid nodes included, goes through `project()`. Any VE other than 1 is a single constant and is shown on screen.

## Consequences

- 2D and 3D align by construction, with no second projection to drift.
- `project()` is a local approximation, which is adequate over this ~15 km area.
- World units are small (a 1.75 m rider is 0.175 units), so the camera's near plane must be ≥ 0.02 and the trail needs a polygon offset.

## Verification

G1, G3, RG5 (see docs/spec-3d.md). Design reference: D3 in docs/design-3d.md.

## Relations

Related to: [3. Keep the 3D maths in a pure, React-free core](0003-pure-core-thin-views.md)
Related to: [8. Convert WGS84 and British National Grid with the OS Helmert transform](0008-helmert-datum.md)
