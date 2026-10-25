# 23. Remove road-bridge decks from the trail profile

Date: 2026-10-25

Scope: `scripts/build_poc_data.py`, `src/three-core/trail.ts`, `public/data/trail-profile-poc.json`

## Status

Proposed

## Context

The first build of the trail profile from the lidar DTM gave a maximum gradient of 26.4 % on a former railway, where real gradients are around 1–3 %. The cause was a 5–6 m hump at km 8.550–8.595: the A470 bridge over the line at Maentwrog Road station (OSM way 159029128, `highway=trunk`). The DTM keeps that road deck, so the trail climbed over the road instead of passing under it. The road was also missing from the OSM data, because the pipeline's road filter had left out `highway=trunk`.

## Decision

Every OSM road tagged `bridge` whose line crosses the centreline is treated as an overbridge. Its deck span along the line is estimated from the road's class width plus 3 m on each side, divided by the sine of the crossing angle (capped at 0.3), plus 5 m for the abutments. Across that span the raw 1 m profile is replaced by a straight line between its ends before smoothing, the same way rail-over bridges are handled (ADR 9). The terrain under the deck is still flattened, so the trail passes beneath the road, but that flattening is not reported as an earthwork, because the "cut" there is the deck, not a cutting. Each overbridge is registered as an approximate structure, and the road ribbon draws the deck. Trunk and motorway roads are now kept.

## Consequences

- The section's gradient falls to under 4 %, apart from one unexplained DTM dip at km 9.00–9.02 that is reported, not smoothed (data/source-register.md).
- Four overbridges are found in the section (km 7.80, 8.33, 8.56, 9.47); the profile noise falls from 0.28 m to 0.16 m.
- Span lengths are estimates from OSM widths and angles, not measurements.
- A road bridge missing its OSM `bridge` tag would still put a hump in the profile. The maximum-gradient figure in docs/validation-3d.md is the check to watch.

## Verification

TR2 and G4 (see docs/spec-3d.md); G6 for the structure entries. The maximum gradient is recorded in docs/validation-3d.md.

## Relations

Amends: [9. Take the trail height from the DTM along the centreline](0009-trail-height-from-dtm.md)
Related to: [12. Model only structures that have a cited source](0012-sourced-structures-only.md)
