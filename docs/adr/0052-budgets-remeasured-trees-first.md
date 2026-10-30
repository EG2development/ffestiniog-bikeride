# 52. Re-measure the budgets after each track; trees give way first

Date: 2026-10-25

Scope: `scripts/render-checks.mjs`, `src/three-core/sections.ts` (`maxTreesPerKind`)

## Status

Proposed

## Context

Trawsfynydd's frame 2399, the last before the cut with the premounted closing scene, measured 1,936,811 of 2,000,000 triangles at t12. Water holes, buildings and landmarks all add triangles.

## Decision

The section-by-section load and the frame before each cut are measured again after each track (water, clarity, buildings). If a frame goes over RL24, that section's tree cap is lowered first and the buildings stay. The new numbers are recorded in `docs/validation-3d.md`.

## Consequences

- Trawsfynydd's tree cap may fall below 2,500 per kind, with the figures recorded.
- RL24 stays a hard limit.

## Verification

Spec BL12 and RL24; design D48.

## Relations

Related to: [37. Vegetation in a near zone with a density band](0037-vegetation-near-zone.md), [39. Performance measured per section and at the cuts](0039-performance-per-section-and-cuts.md)
