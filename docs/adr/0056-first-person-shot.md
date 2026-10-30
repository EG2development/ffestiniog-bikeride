# 56. The rider's view as a shot: handlebar height, cadence bob, no rider model

Date: 2026-10-29

Scope: `firstPersonShot` and `FIRST_PERSON_FOV_DEG` in `src/three-core/camera.ts`, the `first-person` shot spec and `shotKindAt` in `src/three-core/sections.ts`, `src/scenes3d/Section3D.tsx`

## Status

Proposed

## Context

The brief asks for first-person, handlebar-height perspectives so viewers feel they are riding the proposed path. The
existing shots (drone side-track, follow, aerial orbit, pull-back, hold) all look at the rider from outside. Spec CA3
requires every camera to stay 2 m above the terrain and 1.5 m from the cyclist, which a camera on the bicycle cannot do;
CA5 asks for a first-person shot that passes CA1–CA4.

## Decision

`firstPersonShot` is a pure shot (ADR 16): the camera rides `eyeHeightM` (1.2 m by default) above the trail surface
and 0.4 m ahead of the rider's centre, looks at the trail `lookAheadM` (15 m) ahead and a little down, and bobs and sways
with the cadence as a function of the pose's crank angle. Its lens is 52° vertical, inside CA4. It reads the rider's
distance from the section's table (`distAt`), so it plays at the section frame like every other shot.

**CA3 is amended for this shot kind:** the camera is the rider, so the rider distance does not apply and the terrain
clearance is 1 m over the rendered ground (`withClearance(shot, heightAt, far, 1, 0)`). The rider model is not drawn in
first-person frames (`shotKindAt` tells `Section3D` which shot owns a frame), and the near plane moves in to 0.2 m. CA1,
CA2 and CA4 apply unchanged, and the shot is tested against them with a pedalling rider.

## Consequences

- An immersive view with no new geometry; the bob is small (12 mm) so CA2's speed and angular limits hold.
- Trees are already kept 10 m off the trail (ADR 11), so no crown enters the rider's own view corridor.
- No handlebars or hands are drawn yet; a cockpit is a later view, not a core change.

## Verification

`tests/three-core/first-person.test.ts` (CA1, CA2, CA4; CA3 as amended; the section-frame rule; the prototype's shot
order), the RN2 determinism check on the photo composition.

## Relations

Amends: spec CA3 (for first-person shots), [16. Define camera shots as pure functions with clearance limits](0016-pure-camera-shots.md), [35. Camera shots per section from a spec](0035-shot-specs.md). Related to: [54. A photoreal look as a layer](0054-photoreal-layer.md).
