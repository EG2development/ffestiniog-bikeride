# 34. Build the cyclist from its dimensions

Date: 2026-10-25

Scope: `src/three-core/cyclistModel.ts`, `src/three/CyclistView.tsx`

## Status

Proposed

## Context

The independent validation (t14, D2) found the C1 test checking `ridingHeightM` and `lengthM`, two constants the view never reads; the view hard-codes its points. The model happened to meet C1, but nothing proved it.

## Decision

`cyclistParts(dims, crankAngle, wheelAngle)` (pure) emits the bike and rider as parts (capsules, spheres, tori; no boxes) in bike space centred on the bottom bracket, including the two-bone leg solve. Only the wheel diameter and wheelbase are read from the dims; the frame points, hip, shoulder, head and leg lengths (thigh 0.45 m, shin 0.47 m) are constants in the model. `CyclistView` only maps parts to meshes. `partsBounds` gives the bounding box the C1 test measures. A rigged model enters only under its own ADR with an asset-register entry (ADR 14).

## Consequences

- C1 is a real measurement of what is drawn.
- The view loses its hand-placed geometry; proportions stay as before.
- Leg motion is testable (feet on the pedals at every crank angle).

## Verification

RL16 (T); `tests/three-core/cyclistModel.test.ts` (design D30).

## Relations

Amends: [14. Use a procedural cyclist model for the proof of concept](0014-procedural-cyclist.md)
