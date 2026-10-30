# 61. Trail users at random: walkers, runners and prams, by a seeded draw that keeps the rider's rules

Date: 2026-10-30

Scope: `src/three-core/walkers.ts` (`Activity`, `paceKmh`, `strideM`, `walkerParts`, `walkerColours`, the runner, pusher
and pram figures, `RUNNER_PALETTE`, `PRAM_PALETTE`), `src/three-core/people.ts` (new: `placePeople`, `PEOPLE_RULES`),
`SectionConfig.photo.people` and the reel's ground configs in `src/three-core/sections.ts`, `src/three/WalkersView.tsx`,
the `walkers-<window>` entries in `data/features-3d.json`

## Status

Proposed

## Context

On 2026-10-30 the owner asked for "runners and baby prams, randomly set people" in the reel. ADR 59 placed every walker
by hand ("explicit, not random") and only walking; ADR 60 gave each reel ground scene one to three such walkers. A
shared path of the kind proposed is used by runners and by people pushing prams as well as by walkers (the Active
Travel guidance's 3 m width is set for that mix), and hand-placing a varied crowd in five scenes would make every
scene a set piece. Randomness is allowed only from a seeded draw (RN1), and no person may break the rules the
hand-placed walkers keep: inside the section, clear of the rider and the camera, never walking through each other.

## Decision

- **Three activities.** A `WalkerSpec` may say `activity`: `walk` (unchanged), `run` or `pram`. Pace by gradient in the
  person's direction: walking as spec C9 (3–6 km/h); running `clamp(10 − 50 g, 7.5, 12)` km/h, a recreational jog;
  pushing a pram `clamp(4 − 30 g, 3, 5)` km/h. Stride: 0.8 H walking, 1.15 H running (about 2 m at 10 km/h and 165
  steps a minute), 0.7 H behind a pram.
- **Two new figures, from the walker's proportions.** A runner's hips ride lower and the body bobs twice a stride,
  highest in flight; it leans 7° forward; each foot is down for under half its cycle and lifts towards the buttock as
  the leg comes through, so there is a moment with both feet off the ground; the arms are bent near a right angle and
  swing against the legs. A pusher walks a shorter step, leans 8°, and holds the handlebar at 0.58 H, 0.24 H ahead of
  the hips, the elbows solved by two-bone geometry. The pram is a pram's size in metres: rear wheels 0.30 m across,
  front 0.20 m, tyres touching the ground, a frame of struts and rails, a 0.78 × 0.46 m body under a hood, a pale
  blanket. Runners wear sports colours; the pram's colours come from a second seeded stream, so no walker's colours
  change. The view draws a pram's body and blanket as one box mesh and its tyres as one torus mesh beside the
  figure's two.
- **A seeded draw per section.** `photo.people = { count, seed }` (blaenau 5, vale-north 4, vale-south 4, maentwrog 5,
  trawsfynydd 6) replaces the reel's hand-placed walkers; the prototype keeps its own. The first runner and the first
  pram are guaranteed, the rest drawn 60 % walking, 20 % running, 20 % pram, shuffled. Each person's direction, side of
  the path (three in four on the rider's right), height (1.55–1.92 m) and start on the stretch the shots see come from
  the draw; a walker may bring a companion 0.55 m to their side. A candidate is kept only if at every frame it stays
  inside the section; clears the rider (0.35 m to the bars and an elbow, its own half-width, and 0.27 m between)
  whenever their spans along the path overlap (a pram's span reaches 1.3 m ahead of its pusher); clears every person
  already kept by 0.05 m beyond both half-widths (a companion excepted); stays 3 m from the camera; and is on screen
  within 40 m at some frame. Up to 120 draws per person; a person who cannot be placed is left out.
- **Passing the follow camera is allowed.** Someone the rider meets passes the follow camera (8 m behind, 3 m up)
  about a third of a second later, sweeping past the frame's lower edge as in any chase footage. Keeping people out of
  the view nearer than 6 m, or 4.5 m, left the rider meeting nobody in four of the five scenes, so that rule was tried
  and dropped.
- **Registered as before:** `walkers-<window>` (kind `walker`, decorative), its note now naming runners and prams and
  that the use is conceptual; the legend's "People illustrative" covers all three.

## Consequences

- The draw placed 24 people: 10 runners, 7 people with prams and 7 walkers; the rider meets or overtakes someone in
  four scenes (a runner in Blaenau, Vale north and Maentwrog, a walker in Maentwrog, a pram and three walkers, a
  pair among them, in Trawsfynydd); in Vale south everyone is ahead, coming into view. Changing a section's seed or count
  redraws its people; the tests check the rules, not the particular people.
- Close to the camera the figures are what they are: capsules and spheres, no faces, no pushchair detail beyond its
  shape, no baby drawn. From the follow camera's usual distance they read as a runner, a walker and a pram.
- The rider still does not slow or swerve for anyone (spec C2), and no one steps aside; people keep their line.
- Each pram adds two meshes, each person two, drawn again for the shadow map: Trawsfynydd's scene pass rose to about
  170 calls (budget 300).

## Verification

`tests/three-core/walkers.test.ts` (paces and strides by activity, a runner's height, flight phase, ground contact
and solved knees, a pram's tyres on the ground ahead of its pusher's feet with the hands on its bar, the palettes),
`tests/three-core/reel-photo.test.ts` (per ground scene: the same draw twice, a runner and a pram, every rule above
checked independently of the placer at every frame; across the reel at least three runners and three prams), and
the render checks.

## Relations

Amends [59. Walkers on the trail](0059-walkers-on-the-trail.md) (people may be drawn at random, and may run or push a
pram) and [60. The reel in the photo look](0060-reel-in-the-photo-look.md) (the reel's ground scenes draw their
people). Related to: [11. Seeded trees in woodland](0011-seeded-trees-in-woodland.md), [15. Distance-table motion](0015-distance-table-motion.md).
