# 30. A gradient sky dome and exponential fog, with the fog colour equal to the horizon

Date: 2026-10-25

Scope: `src/three-core/atmosphere.ts`, `src/three/SkyDome.tsx`, `src/three/Lighting.tsx`

## Status

Proposed

## Context

The proof of concept has a flat sky colour and linear fog (ADR 18). A realistic sky could come from a licensed HDRI, three's procedural `Sky` addon or a custom dome. An HDRI needs a licence and an asset entry; the `Sky` addon's horizon colour isn't readable, so the fog colour couldn't be guaranteed equal to it, and the threejsresources sky guide names that mismatch as the commonest outdoor-scene fault.

## Decision

A `SkyDome` view: an inside-out sphere with a zenith-to-horizon gradient and a sun disc at ADR 18's azimuth and elevation, plus `FogExp2`. Both read one `atmosphere.ts` record, `ATMOSPHERE: Record<SectionKind, Atmosphere>` (zenith, horizon, fog density, sun azimuth and elevation), with `fogColour(kind)` returning `ATMOSPHERE[kind].horizon`. The fog colour **is** the horizon colour, so the equality the spec asks for holds by construction, and a test reads both. No HDRI and no `Sky` addon. Clouds are out of scope for this mission.

## Consequences

- No asset, no licence, deterministic, two draw calls (the dome and the sun-disc mesh).
- The look is a clean gradient sky, not a photographic one.
- Changing the sun means superseding ADR 18.

## Verification

RL11 (T, V); `tests/three-core/atmosphere.test.ts` (design D26).

## Relations

Amended by: [54. A photoreal look as a layer over the same scene, prototyped on Maentwrog Road](0054-photoreal-layer.md)

Amends: [18. Light with a fixed sun, hemisphere fill and fog](0018-fixed-lighting.md)
