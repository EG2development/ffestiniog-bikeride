# 16. Define camera shots as pure functions with clearance limits

Date: 2026-10-25

Scope: `src/three-core/camera.ts`

## Status

Proposed

## Context

Camera moves must be smooth, collision-free, reusable and testable.

## Decision

A shot is a pure `(frame) → { position, target, fovDeg }`. POC shot A (frames 0–179) is a drone side-track descending from 120 m to 25 m; shot B (frames 180–359) follows 8 m behind and 3 m up. `withClearance` keeps the camera ≥ 2 m above the terrain and ≥ 1.5 m from the rider. Shot ends use 0.5 s cubic easing; vertical FOV is 45°.

## Consequences

- A reusable, tested shot library (CA5).
- A straight cut between shots; CA2's smoothness applies within a shot.

## Verification

CA1–CA4 (see docs/spec-3d.md). Design reference: D14 in docs/design-3d.md.

## Relations

Amended by: [35. Camera shots per section from a spec, with aerial shots](0035-shot-specs.md), [56. The rider's view as a shot: handlebar height, cadence bob, no rider model](0056-first-person-shot.md)

Related to: [15. Drive cyclist motion from a precomputed distance table](0015-distance-table-motion.md)
Related to: [17. Set the camera during render, not in useFrame](0017-camera-set-during-render.md)
