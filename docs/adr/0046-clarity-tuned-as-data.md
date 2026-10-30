# 46. Clarity tuned as data, from one source, against metrics

Date: 2026-10-25

Scope: `src/three-core/atmosphere.ts`, `src/three/Lighting.tsx`, `src/three-core/trees.ts`, `src/three/TreesView.tsx`, `src/data/MapDrapeProvider.tsx`

## Status

Proposed

## Context

t14 found the trees very dark and the aerial scenes, a magnified map, out of step with the ground scenes. The light values live as literals inside the views.

## Decision

Light constants move into `atmosphere.ts` as `LIGHTING`: hemisphere sky, ground and intensity, and sun colour and intensity. Every section kind reads them. Shadow-side form is tuned through the hemisphere ground term and the tree palette (`TREE_COLOURS`) against the CL2 and CL3 metrics, not by eye.

The trail colour changes only if CL4 fails. The aerial drape is graded in `MapDrapeProvider`'s canvas (saturation, brightness and tint) towards the ground palette.

## Consequences

- The sections share one look.
- Every tuning change comes with before and after numbers.
- CyclingVision is untouched.

## Verification

Spec CL2–CL4 and CL6; design D42.

## Relations

Amends: [18. Light with a fixed sun, hemisphere fill and fog](0018-fixed-lighting.md), [31. Terrain relief shading without textures](0031-terrain-shading-without-textures.md), [33. Aerial scenes drape the cached map tiles on the corridor terrain](0033-aerial-map-tile-drape.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- The drape grade is `DRAPE_GRADE` and `gradeDrapePixels` in `atmosphere.ts`, applied by `MapDrapeProvider`. It tints only near-neutral map paper, at its own luma.
- Shade-side form comes from `TREE_FILL` on the tree material, with the crowns darkened to keep the sunlit side; 0.08 since t10. `LIGHTING`'s values are unchanged.
