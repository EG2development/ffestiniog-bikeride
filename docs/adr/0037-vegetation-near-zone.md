# 37. Vegetation in a near zone with a density band

Date: 2026-10-25

Scope: `src/three-core/trees.ts`

## Status

Proposed

## Context

The proof of concept caps trees at 6,000 per kind over the whole window, which gives about 0.7 trees per 100 m² of woodland, well below a real wood, and instancing cost grows with the window.

## Decision

Instanced 3D trees are placed only inside OSM woodland within 300 m of the trail (the near zone). The keep probability is derived from the node spacing for a default of 4 per 100 m² of woodland (`densityPer100m2`) and held under 0.9 × cap / (0.55 × candidates), so the per-kind cap (6,000, or the section's `maxTreesPerKind`) thins the wood evenly. Production passes `{ roads, ve, maxTrees? }`; the 1–15 per 100 m² band is asserted by the RL13 test, not passed in production. Beyond the near zone, woodland is shown by its land-cover colour only. Spec RL13 is amended to the near zone.

## Consequences

- Realistic density where the camera is; flat colour where fog and distance hide detail.
- Density becomes a measured, bounded number.

## Verification

RL13 (T); `tests/three-core/trees.test.ts` (design D33).

## Relations

Amended by: [47. Keep decorative trees out of the follow-camera corridor](0047-trees-clear-of-camera-corridor.md), [57. Tree heights and field trees from the lidar canopy, when a section asks](0057-canopy-heights-from-lidar.md)

Amends: [11. Place seeded trees only inside OSM woodland](0011-seeded-trees-in-woodland.md)
