# 59. Walkers on the trail, choreographed by the section, under the rider's rules

Date: 2026-10-30

Scope: `src/three-core/walkers.ts`, `src/three/WalkersView.tsx`, `SectionConfig.photo.walkers` and `SectionScene.walkers` in `src/three-core/sections.ts`, `src/scenes3d/Section3D.tsx`, the `walker` register kind in `src/three-core/registers.ts`, `walkers-maentwrog` in `data/features-3d.json`

## Status

Proposed

## Context

The brief asks for occasional walkers so the proposed path reads as the shared-use route it would be. Spec C9 (P4)
already says what a walker must do: C1–C5 at walking ranges (3–6 km/h, 1.5–1.95 m tall), and the pseudocode (§5)
gives the pace, `clamp(4.5 − 30 × gradient, 3, 6)` km/h. Nobody is recorded walking the mothballed line and no path
exists there today, so every walker is conceptual: a figure on the proposal, like the rider (ADR 14), never evidence
of use. The guidance's 3.0 m shared-use width (`data/source-register.md`) means a rider and a walker pass about a metre
apart; the scene should show that honestly rather than widen the path.

## Decision

A walker is the rider's motion model (ADR 15) at a walking pace, with its own figure:

- **Explicit, not random.** A section lists its walkers in `photo.walkers` as specs (`startDistM`, `direction`,
  `sideM`, `heightM`, `seed`). Each is a choreographed moment the shots can count on; the prototype's three are placed
  against the rider's table so the rider overtakes one and meets a pair in the rider's view, and all are behind the
  follow camera when it cuts in. The reel's sections list none, so the reel is unchanged.
- **Pure motion.** `walkerTable` integrates the pace along the trail in the walker's direction once; `walkerPose` is a
  pure function of the table and the frame: position on the trail surface `sideM` left of the route's direction
  (|sideM| ≤ 1 m keeps C3 whichever way the walker faces), yaw along the direction of travel, and a gait phase that
  advances one stride (0.8 × height) per 2π. `walkerTracks` refuses a shared seed, an offset over 1 m or a height
  outside 1.5–1.95 m at the boundary.
- **A figure from a height.** `walkerParts` builds sixteen parts (hips, torso, shoulders, neck, head, hair, and per
  side thigh, shin, foot, upper arm, forearm) from Drillis–Contini segment fractions of the height. Each foot travels
  ±0.12 H fore and aft of the hip with the phase and lifts 0.04 H while it swings forward, so one sole is always on
  y = 0; the knees follow by two-bone geometry, the arms swing against the legs, the body bobs 1.2 % of H twice a
  stride. The view draws each walker as two instanced meshes (unit cylinders for the limbs, unit spheres for the
  joints, head and hair) whose instance matrices and colours are rebuilt from the parts each frame as declarative
  attributes: two draw calls per walker per pass.
- **Colours by seed** from one palette (outdoor tops, trousers, six skin tones, five hair tones, shoes), so two walkers
  never dress alike and the same seed always dresses the same.
- **Registered as decorative** under a new kind `walker`, with a note that the use is conceptual. Drawn in both looks
  wherever a config asks; black under a measurement mask, so no walker is ever counted as the rider.

## Consequences

- In the photo look every mesh is drawn four times a frame (the scene pass, the two ambient-occlusion passes and the
  shadow map, which the shadow pass draws even when the walker is behind the camera), so sixteen meshes per walker
  cost 192 calls for three walkers at the aerial frame (372 in all, over RN6's 300) when first built; the two instanced
  meshes cost 24: the drone and follow frames go from 180 to 204 calls and the rider's view from 76 to 100.
- The rider does not slow for the walkers (C2 fixes the pace from the gradient); a considerate rider would. Recording
  that, and a walker who steps aside, is a later motion change, not a view change.
- The figures are generic (no faces, no bags or poles, clothing from a palette); heights and skin tones vary by seed and
  nothing else about the people does. The casting breadth of `docs/community-reel-research.md` is not met by three
  figures and is not claimed.
- A walker's sole follows the surface under the body's centre, not under each foot: on a 2 % grade the planted foot is
  within 4 mm of the surface 0.2 m ahead (C4's ±0.05 m holds); a 25 % grade would show it.

## Verification

`tests/three-core/walkers.test.ts`: the pace, the figure's height and width at every phase with a sole on the ground,
C2–C5 at every frame of a 20 s walk in both directions over the synthetic valley, the gait's advance, determinism, the
palette and the boundary refusals; and on the real Maentwrog trail, the prototype's choreography (passes within the
rider's view, every walker behind the follow camera from its first frame, all inside the window).

## Relations

Amended by: [60. The reel in the photo look: every scene, its aerials coloured by a satellite image](0060-reel-in-the-photo-look.md), [61. Trail users at random: walkers, runners and prams, by a seeded draw that keeps the rider's rules](0061-trail-users-at-random.md)

Implements spec C9. Related to: [14. Procedural cyclist](0014-procedural-cyclist.md), [15. Distance-table motion](0015-distance-table-motion.md), [34. Cyclist from its dimensions](0034-cyclist-from-dims.md), [54. A photoreal look as a layer](0054-photoreal-layer.md), [56. The rider's view as a shot](0056-first-person-shot.md).
