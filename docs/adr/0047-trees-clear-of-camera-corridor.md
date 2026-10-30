# 47. Keep decorative trees out of the follow-camera corridor

Date: 2026-10-25

Scope: `src/three-core/trees.ts` (`sightLines`), `src/three-core/sections.ts` (the planned `occlusion.ts` was not needed: see Consequences)

## Status

Proposed

## Context

The goal: foreground trees must not repeatedly hide the cyclist. The trees are decorative: seeded inside OSM woodland (ADR 11), so their positions are not sourced. The follow camera rides 8 m behind, 3 m up and 1.5 m to the side.

*Measured at t6, before any change: the follow shots are already clear. The drone-side shots are blocked in Maentwrog (25 of 180 frames) and Trawsfynydd (149 of 240), measured against the crown shapes as drawn. The keep-out therefore covers the lines of sight of every ground shot that frames the rider. Where clearing that wedge would remove a visible stretch of woodland, the drone-side framing (side offset or height) changes instead. The build (t7) records which one it chose.*

## Decision

`cameraKeepOut(shots)` returns segments along each follow-shot camera path, with radius crown + 1 m. They are passed to `placeTrees` as `keepOut`. `occludedFrames` ray-casts the camera-to-rider segment against the tree crowns for every follow frame. Sourced features never move.

## Consequences

- A few decorative trees along the camera paths go; woodland elsewhere is unchanged.
- The rider stays visible by construction, and a test proves it.

## Verification

Spec CL5 and CL7; design D43.

## Relations

Amends: [37. Vegetation in a near zone with a density band](0037-vegetation-near-zone.md). Related to: [11. Place trees by seeded random inside OSM woodland](0011-seeded-trees-in-woodland.md), [35. Camera shots per section from a spec, with aerial shots](0035-shot-specs.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- No `occlusion.ts` was needed. `sections.ts` passes every ground-shot frame's camera-to-rider line (rider + 1 m) to `placeTrees` as `sightLines`. A tree is not placed when its crown, the `CROWN_SPHERES` that enclose the drawn `CROWN_SHAPES`, crosses one. `keepOut` stays in `TreeOptions` but is used only in tests.
- `tests/three-core/occlusion.test.ts` checks every frame of both ground shots against the drawn cone and icosahedron (t10).
