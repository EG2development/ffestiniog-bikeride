# 9. Take the trail height from the DTM along the centreline

Date: 2026-10-25

Scope: `public/data/trail-profile-poc.json`, `src/three-core/trail.ts`

## Status

Proposed

## Context

The existing profile is a 90 m DSM, and the 2D video depends on it. A DTM gives the real formation level but removes bridge decks.

## Decision

Sample the 1 m DTM along the OSM centreline and smooth with a 25 m window. Across bridge spans, interpolate between the abutments given by the OSM bridge endpoints. `data/elevation-profile.json` stays unchanged for the 2D video. This amends spec G4.

## Consequences

- Real gradients.
- Features shorter than 25 m are smoothed out.
- Datum error shows up as profile noise (ADR 8).

## Verification

G4, TR2 (see docs/spec-3d.md). Design reference: D7 in docs/design-3d.md.

## Relations

Amended by: [23. Remove road-bridge decks from the trail profile](0023-remove-road-decks-from-profile.md)

Related to: [6. Use the Welsh lidar DTM for terrain](0006-welsh-lidar-dtm.md)
Related to: [8. Convert WGS84 and British National Grid with the OS Helmert transform](0008-helmert-datum.md)
Related to: [12. Model only structures that have a cited source](0012-sourced-structures-only.md)
