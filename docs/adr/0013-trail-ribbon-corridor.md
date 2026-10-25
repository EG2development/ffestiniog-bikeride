# 13. Model the trail as a 3 m ribbon over a flattened corridor

Date: 2026-10-25

Scope: `src/three-core/trail.ts`, `src/three/TrailView.tsx`

## Status

Proposed

## Context

The trail must sit on the terrain without clipping, and implied earthworks must not be presented as verified.

## Decision

A ribbon 3.0 m wide (a parameter, allowed 2.5–4.0 m), 0.05 m above the profile height. Terrain nodes within width/2 + 1 m of the centreline are flattened to the trail height. Cut or fill deeper than 2 m is computed and listed in the register as approximate (DEM-derived). The surface is a warm buff colour unlike any land-cover colour, labelled "Proposed trail (concept)" for frames 0–90.

## Consequences

- No clipping, and earthworks are labelled honestly.
- The width's primary source (Active Travel Act Guidance 2021) is still unread (design risk K4).

## Verification

G5, H2, TR1 (see docs/spec-3d.md). Design reference: D11 in docs/design-3d.md.

## Relations

Related to: [9. Take the trail height from the DTM along the centreline](0009-trail-height-from-dtm.md)
Related to: [12. Model only structures that have a cited source](0012-sourced-structures-only.md)
