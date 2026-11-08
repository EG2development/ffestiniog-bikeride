# 18. Light with a fixed sun, hemisphere fill and fog

Date: 2026-10-25

Scope: `src/three/Lighting.tsx`

## Status

Proposed

## Relations

Amended by: [30. A gradient sky dome and exponential fog, with the fog colour equal to the horizon](0030-sky-dome-and-fog.md), [46. Clarity tuned as data, from one source, against metrics](0046-clarity-tuned-as-data.md), [54. A photoreal look as a layer over the same scene, prototyped on Maentwrog Road](0054-photoreal-layer.md)

## Context

The look should be natural, deterministic and inside the performance budget, without large or restrictively licensed assets.

## Decision

One directional sun (azimuth 200°, elevation 35°) with a 2048² shadow map limited to about 300 m around the rider, a hemisphere fill light, linear fog towards a pale sky colour, and a flat sky background. No HDRI.

## Consequences

- Deterministic and cheap.
- The sun position is illustrative, not tied to a real date or time.

## Verification

RN6, review (see docs/spec-3d.md). Design reference: D16 in docs/design-3d.md.
