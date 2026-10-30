# 44. Mask renders for measurement only

Date: 2026-10-25

Scope: `src/scenes3d/Section3D.tsx`, the views in `src/three/`, `scripts/render-checks.mjs`, `scripts/stills.mjs` (new)

## Status

Proposed

## Context

The clarity and water criteria (WA6, WA7, CL2, CL4, CL6) need the pixels of one class: water, trees, trail, roads or terrain. Colour thresholds on normal renders break under fog, lighting and shadow.

## Decision

`Section3D` takes `mask?: "water" | "trees" | "trail" | "roads" | "terrain" | "buildings" | "cyclist"`. When it is set, every material becomes unlit black and the chosen class white, and fog, the sky and the overlays are off. The render checks render each measured still twice, normal and masked, and compute the metrics with PIL. A static test fails if `Reel3D` or a section entry in `src/Root.tsx` passes `mask`.

## Consequences

- Pixel metrics become exact per class.
- Each measured still costs one more render, about 30 s more for `npm run test:render`.
- The views take a `mask` prop.

## Verification

Spec WA6, WA7, CL2, CL4 and CL6; risk K14; design D40.

## Relations

Related to: [39. Performance measured per section and at the cuts](0039-performance-per-section-and-cuts.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- `Mask` has ten values: `water`, `water-expected` (both faces), `trees`, `trees-sun` (a white Lambert lit by the sun alone), `trail`, `roads`, `terrain`, `buildings`, `landmarks` and `cyclist`. `hide: "water"` renders the frame without water.
- `scripts/stills.mjs` renders each frame normally, under each mask (8 for ground scenes, 3 for aerial), and as `clean` and `nowater`: 139 stills. The render checks re-render them whenever the snapshot changes, which takes about 20 minutes, not 30 seconds.
