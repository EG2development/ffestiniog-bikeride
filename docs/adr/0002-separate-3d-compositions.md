# 2. Build the 3D work as separate compositions

Date: 2026-10-25

Scope: `src/Root.tsx`, `src/scenes3d/`

## Status

Proposed

## Context

The brief requires existing functionality to be preserved, and the 2D video (`CyclingVision`, 8 scenes) already renders correctly. The 3D work starts as an unproven 12-second proof of concept.

## Decision

Each 3D piece is its own Remotion composition, registered in `src/Root.tsx`. The first is `Poc3DMaentwrog` (360 frames, 1920×1080, 30 fps). 3D work does not edit `src/CyclingVision.tsx` or `src/scenes/`. Combining 2D and 3D in the final cut is a Phase 5 decision with its own ADR.

## Consequences

- The proof of concept can be rendered and reviewed on its own.
- 2D regressions can only come through shared files (`src/Root.tsx`, the data layer, `remotion.config.ts`); RG1 guards those.
- Two compositions have to stay in step on shared data.

## Verification

RG1, RG2 (see docs/spec-3d.md). Design reference: D1 in docs/design-3d.md.

## Relations

Amended by: [24. Load 3D compositions lazily](0024-lazy-3d-compositions.md), [27. Build every section from one config and one assembly](0027-section-config.md), [28. One master composition with hard cuts and premount](0028-reel-master-composition.md)

Related to: [1. Use @remotion/three's ThreeCanvas for 3D, alongside the 2D video](0001-use-remotion-three-threecanvas.md)
Related to: [3. Keep the 3D maths in a pure, React-free core](0003-pure-core-thin-views.md)
