# 17. Set the camera during render, not in useFrame

Date: 2026-10-25

Scope: `src/three/CameraRig.tsx`

## Status

Proposed

## Context

During rendering, `<ThreeCanvas>` forces `frameloop` to never and advances once per frame; animation built on `useFrame` breaks scrubbing (Remotion docs).

## Decision

`CameraRig` takes the pose as props and sets the default camera's position, look-at target and FOV during render, through `useThree`. `<ThreeCanvas>` then advances. If the pose turns out not to be applied before the advance, fall back to `useLayoutEffect` plus `advance(0)` (design risk K3).

## Consequences

- No hidden animation loop.
- Needs the RN2 determinism render to confirm.

## Verification

RN1, RN2 (see docs/spec-3d.md). Design reference: D15 in docs/design-3d.md.

## Relations

Related to: [16. Define camera shots as pure functions with clearance limits](0016-pure-camera-shots.md)
