# 15. Drive cyclist motion from a precomputed distance table

Date: 2026-10-25

Scope: `src/three-core/cyclistMotion.ts`

## Status

Proposed

## Context

Motion must be deterministic, realistic in speed, and respond to gradient.

## Decision

Speed is a function of gradient, clamped to 12–25 km/h, integrated once per frame into a `Float64Array`. The pose at a frame reads the table: position 0.5 m left of the centreline, yaw from the tangent, pitch from the gradient, wheel angle = distance / radius, cadence 75 rpm. The rider starts at km 9.12, so the bridge crossing falls around frames 180–260.

## Consequences

- Deterministic, constant time per frame, and no time-lapse.
- In 12 s the rider covers only 40–83 m; the camera supplies the wider context.

## Verification

C2–C7 (see docs/spec-3d.md). Design reference: D13 in docs/design-3d.md.

## Relations

Related to: [14. Use a procedural cyclist model for the proof of concept](0014-procedural-cyclist.md)
Related to: [16. Define camera shots as pure functions with clearance limits](0016-pure-camera-shots.md)
