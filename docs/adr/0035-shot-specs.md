# 35. Camera shots per section from a spec, with aerial shots

Date: 2026-10-25

Scope: `src/three-core/camera.ts`, `src/three-core/sections.ts`

## Status

Proposed

## Context

The proof of concept hard-wires a drone side-track and a follow shot. Aerial scenes need an orbit and a pull-back; the storyboard names a camera move per scene.

## Decision

`ShotSpec` is a union (`drone-side`, `follow`, `aerial-orbit`, `pull-back`, `hold`); `shotsOf(config, scene)` builds the section's `Shot` sequence from its config. `aerialOrbit` and `pullBack` ease like the drone track. Ground shots keep `withClearance` (2 m above the rendered ground, 1.5 m from the rider); aerial shots are first lifted by one constant for the whole shot (`liftClear`, 20 m, so a smooth path stays smooth) and then pass through `withClearance` with 20 m and no rider minimum. CA1–CA4 run through `tests/three-core/criteria.ts` on the POC (`poc-acceptance.test.ts`) and on a synthetic orbit and pull-back (`camera.test.ts`); there is no per-section run on real data.

## Consequences

- Shot lists are data in the section config.
- Three new pure functions in `camera.ts` (`aerialOrbit`, `pullBack`, `liftClear`) with tests; `ShotSpec` and `shotsOf` live in `sections.ts`.
- The POC's shots are expressed as specs (ADR 40).

## Verification

CA1–CA4 on the POC and on the synthetic orbit and pull-back (T); `tests/three-core/camera.test.ts` additions (design D31).

## Relations

Amended by: [56. The rider's view as a shot: handlebar height, cadence bob, no rider model](0056-first-person-shot.md)

Amends: [16. Define camera shots as pure functions with clearance limits](0016-pure-camera-shots.md)
