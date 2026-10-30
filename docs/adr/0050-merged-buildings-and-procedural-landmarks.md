# 50. Draw buildings as one merged mesh per section plus procedural landmarks

Date: 2026-10-25

Scope: `src/three-core/buildings.ts` (new), `src/three/BuildingsView.tsx` (new), `src/scenes3d/Section3D.tsx`

## Status

Proposed

## Context

Trawsfynydd's frame 2399 already uses 97 % of the triangle budget. About 1,360 unique footprints come to roughly 25 k triangles. The goal asks for instancing and levels of detail where useful.

## Decision

Background buildings are one merged mesh per section. Walls run from the lowest DTM height under the footprint to the top, with a flat or gabled roof from the footprint's oriented bounding box, in one shared material. Landmarks are procedural parts (nave, tower, roof types) that share the same materials. Approved, demolished or reconstructed features are drawn translucent and named in the legend.

There is no level of detail and no instancing: unique footprints merge into 1–2 draw calls, and the triangle cost is small. This is reversed if BL12 fails.

## Consequences

- +1–3 draw calls per section.
- Landmarks are recognisable, while background buildings stay plain.
- Every building sits on the ground.

## Verification

Spec BL5, BL7–BL10 and BL12–BL14; design D46.

## Relations

Related to: [39. Performance measured per section and at the cuts](0039-performance-per-section-and-cuts.md), [49. Buildings and landmarks from sourced data only](0049-buildings-from-sourced-data.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- Walls start at the lowest rendered ground (`heightAt`), sampled every 2 m along each wall, not only at the corners. The recorded height is the ridge.
- A roof is gabled only on a true rectangle once collinear nodes are dropped, else flat (t10). Translucent means approved or demolished; there is no `reconstructed` status.
- Buildings add at most 2 draw calls. No landmark is drawn yet: Capel Utica is sourced but too small in shot (`featured: false`).
