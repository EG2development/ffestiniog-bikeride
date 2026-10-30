# Validation log: 3D cycling route animation

Results of the checks in `docs/spec-3d.md`. Automated render checks
(`npm run test:render`) append their results below. Review items are filled in
by a reviewer who did not build the work, as the mission requires.

## Review checklist

This first table is the proof of concept's (first mission); its "not yet (P4/P5)" rows are superseded by the reel checklist that follows it.

| Item | What to check | Result | Reviewer | Date | Notes |
|---|---|---|---|---|---|
| H2c | The proposed trail's surface reads as distinct from mapped features | pass | independent validation agent (t14), not the author | 2026-10-25 | Frames 0, 15, 60, 180 and 359 viewed: the buff trail is distinct from the grey roads and the land-cover colours |
| H3 | The POC's closing caption says the line is mothballed and has had heritage-railway restoration proposals | pass after fix | independent validation agent (t14), not the author | 2026-10-25 | First check: PARTIAL, fully visible for only 1 s. Fixed: fully visible on frames 210–359 (5.0 s), top-left, clear of the rider; re-check passed. The render check requires it at frames 210 and 359 |
| H4 | No on-screen or doc text claims survey precision; DEM and OSM data are described as approximate where relevant | pass | independent validation agent (t14), not the author | 2026-10-25 | The on-screen attribution reads "DEM- and OSM-derived, not survey-grade"; no precision claims in the docs |
| RN5b | Frame 0 shows the coloured terrain (no blank or default material) | pass | independent validation agent (t14), not the author | 2026-10-25 | Frame 0 viewed; no blank frame in a luma scan of all 360 frames (50.8–95.0) |
| L2 | Map, DEM and any required model credits are on screen | pass | independent validation agent (t14), not the author | 2026-10-25 | Legible on every frame viewed. Before release, confirm the lidar licence and show its required wording (D5, risk K2) |
| H5 | (P5) A scene or caption mentions a rail-with-trail alternative | not yet (P5) | independent validation agent (t14), not the author | 2026-10-25 | The final video isn't built |
| G8 | (P4) Each scene's register lists the source-register gaps that apply, and affected features are labelled | not yet (P4) | independent validation agent (t14), not the author | 2026-10-25 | Phase 4 isn't built |
| TR4 | (P4) Sections flagged private or inaccessible show no trail or a labelled alternative | not yet (P4) | independent validation agent (t14), not the author | 2026-10-25 | Phase 4 isn't built |
| P4-1 | (P4) At least 4 of the brief's 8 locations rendered with evidence; exclusions listed with reasons | not yet (P4) | independent validation agent (t14), not the author | 2026-10-25 | Only the Maentwrog Road section is built |
| ADRs | ADRs 1–26 accepted, rejected or left proposed with a reason | pending: the owner's decision | independent validation agent (t14), not the author | 2026-10-25 | All 26 are "Proposed". The index numbering was fixed at t14; accepting or rejecting them is the project owner's call |

## Review checklist (reel)

The V criteria of the reel (spec RL1–RL34, and the brief's H5, G8, TR4 and P4-1, which the POC checklist above left at "not yet"), to be filled in at t14 by someone other than the author.

| Item | What to check | Result | Reviewer | Date | Notes |
|---|---|---|---|---|---|
| RL10 | No flat untextured ground in any section still | pass | independent validation agent (t14), not the author | 2026-10-25 | Colour bins reproduced (254–2,171); relief shading visible in every ground still. Realism caveat: large single-hue fields (frames 1500, 1600, 2300) |
| RL11 | Sky, fog colour = horizon, ADR 18 sun | pass | independent validation agent (t14), not the author | 2026-10-25 | `atmosphere.ts` read: fog = horizon by construction, sun 200°/35°; gradient sky and haze in every ground still; no cloud, sun disc never in frame |
| RL12 | No shadow acne in the section stills | partial | independent validation agent (t14), not the author | 2026-10-25 | Terrain clean in all 39 frames viewed; 2048², 300 m, `normalBias` 0.02, PCF confirmed in `Lighting.tsx`. But the bridge parapets at 1850 and 1919 show self-shadow stripes, and the rider's shadow carries a dithered speckle wedge in every follow shot (thin spokes against a 15 cm shadow texel) |
| RL14 | Llyn Trawsfynydd at the shore height, frame-driven ripple | pass | independent validation agent (t14), not the author | 2026-10-25 | Lake at 197.2 m (trawsfynydd window) and 197.7 m (maentwrog window; two shore medians for one lake, never on screen together); offset = frame × 0.0007; frames 1920, 2000, 2050 viewed; the ripple is not perceptible at the drone's distance |
| RL18 | Closing card fully visible ≥ 5 s | pass | independent validation agent (t14), not the author | 2026-10-25 | Frames 2600 and 2690 viewed; full opacity 2505–2699 (6.5 s), no fade-out |
| RL19 | Heritage note, never "abandoned", ≥ 4 s | pass | independent validation agent (t14), not the author | 2026-10-25 | Frame 350 viewed: "mothballed, not dismantled … heritage-railway restoration … rail-with-trail"; 4.0 s fully visible |
| RL20 | Blaenau Ffestiniog shown as a live station | pass | independent validation agent (t14), not the author | 2026-10-25 | Frame 900 viewed, 4.7 s. Nothing shows the station derelict because no building is drawn anywhere; the "live station" is a caption only |
| RL21 | Private home and decommissioning site labelled; no residence closer than the mesh resolves | pass | independent validation agent (t14), not the author | 2026-10-25 | Frames 1750 and 2050 viewed; no building or residence is drawn in any scene |
| RL27 | Every cut lands on a frame of each section | pass | independent validation agent (t14), not the author | 2026-10-25 | Both frames of all eight cuts viewed (239/240 … 2399/2400): complete frames of their own section, hard cuts, no blank canvas |
| RL29 | Every drawn feature has a register entry | partial | independent validation agent (t14), not the author | 2026-10-25 | Roads, bridges, water, earthworks, terrain, land cover, trees and cyclist registered in every ground window (my script). Water is drawn from every OSM polygon ≥ 1 ha without consulting the register (`sections.ts:203`); the aerial corridor implies four unregistered cut/fill runs over 2 m on the 16 m mesh; no feature is "verified" |
| RL33 | This log holds the render results and the RL5/RL8/RL13 measurements | pass | independent validation agent (t14), not the author | 2026-10-25 | t7 (RL5, RL13), t13 (RL8) and the render tables are here; the V verdicts are now filled in by me |
| RL34 / P4-1 | ≥ 6 of the brief's 8 locations rendered; exclusions listed | partial | independent validation agent (t14), not the author | 2026-10-25 | Seven of eight evidenced (Blaenau approach, countryside side-follow, Llan Ffestiniog elevated, bridge close-up, Maentwrog Road, Trawsfynydd lake, corridor overview). "Railway cuttings" is not shown and is not listed as left out with a reason; the overview at 300–600 m shows 1–2 km, not the 13.2 km the frame budget names |
| H5 | A caption mentions a rail-with-trail alternative (the heritage caption, frames 300–450) | pass | independent validation agent (t14), not the author | 2026-10-25 | Frame 350 viewed |
| G8 | Register gaps listed per section; affected features labelled | fail | independent validation agent (t14), not the author | 2026-10-25 | 0 register entries carry `gapRefs` in any window; no note names the 214 m offset, way 270718795 or the steep stretches; nothing on screen labels them approximate. The design table records this limitation |
| TR4 | Private or inaccessible sections show no trail or a labelled alternative | partial | independent validation agent (t14), not the author | 2026-10-25 | Maentwrog Road (km 8.66) and Trawsfynydd (km 13.24) stations are "private residence" in the source register and the trail ribbon runs through both with no alternative alignment; the Maentwrog caption labels the home; whether the trackbed past it is inaccessible is unverified |
| L2 | Lidar, OSM and OpenTopoMap credits on screen | pass | independent validation agent (t14), not the author | 2026-10-25 | Attribution on all 39 frames viewed: lidar DTM (OGL), OpenStreetMap (ODbL), OpenTopoMap (CC-BY-SA), "not survey-grade"; 12 px, small on a 1080p screen |
| ADRs | ADRs 27–40 accepted, rejected or left proposed with a reason | pending: the owner's decision | independent validation agent (t14), not the author | 2026-10-25 | All 14 exist with six sections each and are "Proposed"; accepting them is the owner's call |

## Measurements to record

The reel's measurements are in its task records below: RL5 window medians (t7), RL8 gradients per window (t13), RL13 tree caps (t7), load per scene and before each cut (t8, t12). The POC's (first mission; the render figures predate the reel's sky, water and three-vertex roads, which took the POC to 63 calls and 1,103,965 triangles):

- Maximum trail gradient in the POC section (TR2): 11.9 % over 5 m at km 9.015, at the unexplained DTM dip by the track crossing (see data/source-register.md); elsewhere the section is under 4 %. Before the A470 deck was removed from the profile (ADR 23) it was 26.4 %.
- Trail-profile noise, std dev of raw 1 m profile minus 25 m smoothed (design risk K1; upgrade to OSTN15 if > 1.5 m): 0.16 m, well under the threshold.
- DEM cells filled from Copernicus GLO-30 (D4): 0 (no nodata in the window).
- Rider: km 9.120 → 9.172 over 12 s at 15.1–16.2 km/h; crosses the OSM bridge (km 9.150–9.169) in the follow shot.
- Render: 55 draw calls and 1,150,462 triangles per frame, shadow pass included (1.14 M before the three-vertex roads of the t10 review); 0.0163–0.0166 s per frame wall time with Remotion's parallel tabs (t8 benchmark, 4 full renders).

## Baselines

- `tests/baselines/cyclingvision.json`: sha256 of `CyclingVision` stills at frames 5, 1200, 2200 and 2900, default GL, captured before any 3D code (RG1). Machine-specific; re-capture only with a reviewer's sign-off.
- `tests/baselines/route-test.sha256`: sha256 of `tests/route.test.ts` at the same point (RG2).

## Proof-of-concept mission records

The first mission's benchmark (t8), security review (t9), code review (t10), full test run (t11), build and CI (t12) and independent validation (t14), with its render-check runs, are in `docs/validation-poc.md`.

## Reel mission records

The first reel mission's build (t7), benchmark (t8), security review (t9), code review (t10), full test run (t11), build and CI (t12), documentation (t13), independent validation (t14) and learning (t15) are in `docs/validation-reel.md`.

## Failing tests first (water, readiness, clarity and buildings; t6, 2026-10-25)

Mission `msn_33e838999675db739df3c922`.

**Suite totals.** 34 files and 189 tests. Of those, 47 fail, 140 pass, and the 2 expected failures (RL8) are unchanged. The full output is `docs/evidence/t6-reel-v2-failing-tests.log`. Lint (`eslint src && tsc`) passes, because the tests declare their own types. No earlier test regressed: the 132 earlier passes still pass, and the 8 new passes are guards.

**Not built yet (40 tests).** These fail because the module, export, file, flag or register kind does not exist:

| Area | Tests | Requirements |
|---|---|---|
| `loadGate.ts`, and the providers' use of it | 9 | RD3–RD5 |
| Overlay tokens | 3 | CL9, CL11, CL12 |
| `waterGeometry.ts` | 3 | WA1, WA2 |
| `visibility.ts` | 2 | BL1 |
| `buildings.ts` and `dataPaths().buildings` | 7 | BL5, BL7–BL11, BL14 |
| `polygonsOf`, holes in `waterBodies`, shared levels, `water-levels.json` | 7 | WA3, WA5 |
| The two pipeline `--self-test`s | 2 | WA3, WA4, BL6, BL17 |
| The `building` register kind | 7 | BL2–BL4, BL16 |

**Real defects reproduced on today's code and data (7 tests):**

- **WA4.** Six of Llyn Trawsfynydd's islands are at or below the lake level (197.16 m + 0.5 m) in the trawsfynydd DTM: the fill levelled them.
- **CL8.** Six reel captions and three proof-of-concept captions are on screen too briefly to read at 15 characters per second.
- **CL6.** `Lighting.tsx` hard-codes its light values.
- **CL5.** The `keepOut` option is ignored: 579 trees sit inside a 20 m corridor in the fixture.
- **CL5, real sections.** A tree crown crosses the camera-to-rider line in the drone-side shot on 25 of 180 frames in Maentwrog and 149 of 240 in Trawsfynydd.

**Guards that pass now (8 tests):**

- K14: no mask in the reel.
- CL14: no texture loaders.
- X2: baselines unchanged.
- CL8: the required caption statements are present.
- CL7: the 1,182 register positions captured in `tests/fixtures/feature-positions-before.json` before any change still hold.
- CL5: Blaenau, Vale north and Vale south are already clear.

**Spec amendment made here (CL5).** The criterion covered follow shots only, and those are already clear. Measured, the blocked frames are in the drone-side shots of Maentwrog and Trawsfynydd, the two sections the goal names. The row and ADR 47 now cover every ground shot that frames the rider. The crown test uses the drawn shapes: a conifer as three spheres following the cone, a broadleaf as one sphere. A single bounding sphere would have overstated the count (113 and 240 frames).

**Left to t7, with the mask infrastructure (ADR 44).** The render-level checks: RD1, RD2, RD6, WA6, WA7, CL2–CL4, CL6, CL9, CL10, BL12 and BL13. They need the `mask` prop and the overlay rectangles, which do not exist yet.

## Implementation (water, readiness, clarity and buildings; t7, 2026-10-25)

Mission `msn_33e838999675db739df3c922`. Every change below has a test or a render check that failed before it and passes after it (RD7). Nothing is committed.

**Suite.** `npx vitest run`: 35 files and 227 tests pass, plus the 2 expected RL8 failures, which are unchanged. `npm run lint` (`eslint src && tsc`) and `npm run build` pass. The render checks are the last table under "Render check results" below; its header names the snapshot it ran on.

**Water (WA1–WA7).**

- **Pipeline.** The pipeline keeps every hole: polygon rings in the core and inner rings in the pipeline (`polygon_rings`, `polygonsOf`). Relation 3084421 was completed with `relation/<id>/full` and now has 22 islands. The Trawsfynydd fill went from 3,960 to 77 cells.
- **Levels.** Levels come from one 4 m lidar read per body (`data/water-levels.json`): 197.26 m for the lake, 306.44 m for way 4684879.
- **Mesh.** The water mesh faces up. Before, it was culled, and the "lake" was terrain colour: before coverage 0.0, after 1.00 at Trawsfynydd frames 60 and 200.
- **Specks.** WA7 is measured on caption-free frames. In the captioned still, the caption box over the lake counted as 3.3 % specks. Measured clean, frames 60 and 61 have 0.10 %.

**Readiness (RD1–RD7).** The three providers use one load gate (`loadGate.ts`, ADR 43): one hold per input, stale settles ignored, and `AssetLoadError` naming the section and the path. The drape now logs its missing-tile count every time, 0 included, so RD6 can tell a clean drape from a lost log line.

- **A regression found by the full-reel scan, and fixed.** The gate first took its hold in an effect, which runs after React has committed a frame without data. In a parallel reel render, frames 242–246, 480–482, 485 and 784–785 came out black, just after the cuts into aerial sections. The fresh-process stills (RD1, RD2) passed, so only the full-reel scan (RL26) showed it.
- **The fix.** The hook now calls `hold(key)` in the render body, and `start()` reuses that hold. A unit test and a static test failed before the fix and pass after it. A full reel render afterwards had no blank frame in 2,700 (minimum centre luma 42.5).

**Clarity (CL1–CL14).** The stills come from `scripts/stills.mjs`, with one frozen bundle and a manifest. The snapshot (`scripts/snapshot.mjs`) is content-only. Two faults were found and fixed while binding the evidence:

- **Commit hash.** The id was the `git stash create` commit, whose hash carries a timestamp, so the same code got a new id every second. It is now that commit's tree hash.
- **Tool state.** The untracked hash included tool state that the hooks rewrite on every call (`.claude-flow/`, `.claude/`, `.agents/`, `.idea/`). It now leaves those out.

| Criterion | Before | After | Change |
|---|---|---|---|
| CL2 shade-side tree luma (median) | 3.9–4.6 | ×2.06–×3.84 | `TREE_FILL` 0.10 with the crowns darkened by 1.5 / 1.6 in linear light (#2a482a, #486732) |
| CL3 frame luma change | — | ≤ 9.8 % (intro), clipped 0 % | binding still: Maentwrog 150 (+9.3 %) |
| CL4 trail ΔE, terrain / roads | — | ≥ 25.6 / ≥ 42.0 | unchanged trail colour |
| CL6 aerial terrain vs ground | hue 49 %, saturation 76 % off | hue 2.1 %, saturation 11.2 % off | `DRAPE_GRADE`: only near-neutral map paper takes `#66b34d`, at its own luma; water, roads, woods and contours keep their colours |

**Conflict between CL2 and CL3, recorded and not resolved here.** In Maentwrog frame 150, shaded tree pixels fill so much of the frame that any readable lift raises mean luma by more than 10 %. Fill 0.25 gives shade 15.8 and +16.9 %; 0.18 gives 12.9 and +13.1 %; 0.12 gives 10.2 and +10.0 %. Nothing clips, so this is not washout. The value kept (0.10) meets the spec as written. If the reviewer prefers the stronger fill, CL3 could measure exposure outside the tree-shade mask, keeping the clipped-pixel limit.

**The CL6 grade tried and rejected.** A canvas "color" blend over the whole drape passed the numbers (hue 10.8 %, saturation 7.1 %), but it turned rivers and the A-road the same lime as the fields, so it was replaced.

**Captions and overlays.** Captions are shortened or retimed (CL8), and the safe-area tokens follow ADR 48. `OverlayLog` now reports each box's unrounded right and bottom edges. Before, the legend, which ends exactly at the safe edge, read 1825 px against the 1824 px edge, because its left and its width were rounded separately. The legend (`LEGEND`, `legendLines`) shows "Hatched: approximate position or form" while a section draws a bridge, which is now hatched. It would show "Translucent: approved or demolished, not standing" for such buildings, of which there are none today (CL7, BL14). The credit line now names the lidar DSM, which gives the building heights (BL15).

**Trees and the rider (CL5).** Sight lines remove the decorative trees that blocked the camera-to-rider line in every ground shot. Trees also keep out of building footprints and their crowns stay off the walls (BL13). Before, 1 tree stood inside a Trawsfynydd building, and 4 crowns hung over walls in Blaenau and Trawsfynydd.

**Buildings (BL1–BL18).**

- **Pipeline.** `npm run data:candidates` lists the footprints the shots see (BL1). Each one is tested at its measured height.
- **The 6 m default (fixed).** The first version tested every footprint at a 6 m default, so a tall building whose base sits behind a rise was missed. Capel Moriah (Grade II, 11.9 m) was one. Now unmeasured footprints are tested at a 60 m upper bound, `build_buildings.py` measures them and keeps every height in `data/building-heights-<w>.json`, and a second pass keeps what the shots see at those heights. A third pass gives the same list.
- **Final list.** 158 buildings: 55 in Blaenau, 30 in the Vale north, 5 in the Vale south, 10 in Maentwrog and 58 in Trawsfynydd. Of these, 152 have lidar heights (the 90th percentile of DSM − DTM) and 6 are approximate. Only the allowlisted tags are kept.
- **Frustum edges.** A few Blaenau buildings swapped in or out between passes. The visibility test samples one point at mid-height, so a taller measured height can move that point out of frame.
- **Loading and drawing.** Each section loads its own `buildings.json` (BL11). `sectionBuildings` draws only ids that the register lists, with the register's status (BL3, BL16). Everything merges into at most 2 draw calls (BL10).
- **Gabled heights.** A gabled roof now sits inside the recorded height; before, it sat on top of it. A 6 m house drew at 9.2 m before and at 6.0 m now (BL6).
- **Building on the trackbed (BL7, spec amended).** OSM way 289033748 (2014-06-21, 4.9 m in the lidar, near km 10.93) stands on a 54 m stretch that OSM tags `railway=dismantled` (way 1344840040, 2024-12-22). It is kept and listed. The proposed trail would have to pass round it, a real-world finding for the concept.
- **Landmarks.** One candidate was researched: Capel Utica, way 373577738, with a Coflein record (NPRN 8551) and Geograph photos from 2007. Its fetched text was screened with `aidefence_scan` (safe) and `aidefence_has_pii` (none). Its status is existing, observed 2015-10-03, with medium confidence. The chapel is 28–31 px tall at about 400 m in the Maentwrog shots, under BL13's 40 px. So it is drawn as a sourced background building with its gabled roof (`featured: false`), not as a landmark model. No featured landmark exists yet. The landmark mask and placement (tower at the west end) are built and tested for when one does.
- **The power station.** World Nuclear News (2025-10-07, 2026-05-29) gives the reactor halls at about 54 m today, with a reduction to about 25 m planned but not yet started. They are probably OSM ways 289033763 and 289033764. They are outside every Trawsfynydd ground frame: 53–57° off the view axis in the drone shot, where the frame edge is at about 40°, and behind the camera in the follow shot. So they are rightly not drawn. The section's caption names the station while it is off screen; whether that caption should stay, change or be retimed is a question for review.
- **Licence.** Coflein's page states a Non-commercial Government Licence. Nothing from it is reproduced; it is recorded as evidence only.

**Mutation checks (a test fails when the fix is undone).**

- The water holes are ignored: the pipeline self-test fails.
- `validateBuildings` is missing: the real-data building tests fail.
- The west-end rule is reversed: the tower test fails.
- The old credit wording is restored: the BL15 test fails.
- The roof sits on top of the recorded height: the BL6 test fails at 9.2 m.
- Trees ignore the footprints: the BL13 tree test fails in Blaenau and Trawsfynydd.
- The trackbed building is left out of the listed exception: BL7 fails.
- The old candidate file, tested at the 6 m default, is restored: the BL1 candidate test fails.
- The hold is taken in an effect again: the load-gate tests fail.

## Benchmark against the baseline (reel v2, t8, 2026-10-25)

Mission `msn_33e838999675db739df3c922`, task t8.

**Baseline.** The baseline is the reel as this mission found it. Its untracked files have since changed and no snapshot of them exists, so the reel baseline is the figures recorded on this machine before t7:

- the reel t8 record (`docs/validation-reel.md`): 34.5 s and 33.7 s wall, 279 s and 270 s CPU;
- the mission-start render checks: 33–39 s;
- frame 2399 at 62 calls and 1,936,811 triangles;
- the 2D baselines.

Commit `bb9c039`, checked out as a temporary worktree (since removed), is a frozen reference: its proof of concept was measured interleaved with the candidate's, to tell environment drift from code.

**Method.** As in the earlier t8: CLI renders from bundles built with `--bundle-cache=false`. Wall time and the children's CPU come from `/usr/bin/time -p`, and outputs are compared by decoded-video md5. Runs are interleaved. The machine is an Apple M4 Pro, with load averages of 4.6–21 from other work. Between batches the same code varied by 3–4 % in CPU, so only interleaved comparisons are used.

| Measurement | Baseline | Candidate | Verdict |
|---|---|---|---|
| 2D output, decoded md5 (3,150 frames) | `adfca9a7…` | identical in 2 renders | unchanged |
| 2D render wall / CPU | 36.50 s / 337.7 s | 36.61 s / 340.0 s (n = 2) | within noise |
| Entry chunk the 2D page loads | 1,335,530 B at mission start (1,333,784 B before the reel) | 1,339,650 B: +0.31 % (+0.44 %; limit 2 %), no three.js | no worse in effect: the shared route provider now loads through `loadGate.ts` (RD) |
| Reel wall (2,700 frames) | 34.5 s, 33.7 s | **33.62, 33.68, 33.97 s** (mean 33.76 s, −1.0 %) | no worse |
| Reel CPU | 279 s, 270 s; this record predates the previous mission's t9–t15, and no CPU record exists at this mission's start | 295.2, 293.8, 293.0 s | see the attribution below |
| Reel output | — | 6 renders decode to the same md5 (`aba11166…`), before and after the cache | deterministic |
| Reel budget, frame 2399 | 62 calls, 1,936,811 triangles | 64 calls, 1,938,182 triangles (water now drawn, buildings) | inside RN6 and D46's ≤ 65 calls |
| POC wall / CPU, interleaved with frozen `bb9c039` | 5.55–5.67 s / 39.8–40.8 s | 6.14–6.47 s / 46.6–48.2 s | see below |

**Attribution (each pair interleaved in one batch, so drift cancels).**

| Change | Without | With | CPU change |
|---|---|---|---|
| Water and buildings (Maentwrog, 360 frames) | 47.4 s, 47.3 s | 47.9 s, 48.9 s | +2 %, wall +0.2 s |
| Water alone (Trawsfynydd, 480 frames) | 60.5 s, 60.4 s | 61.3 s, 59.8 s | none |
| Buildings alone (Blaenau, 300 frames) | 37.7 s, 37.3 s | 38.0 s, 38.2 s | +1.6 %, wall +0.1 s |
| Tree fill, hatching and legend (POC, reverted in a scratch copy) | 43.9, 44.6, 45.6 s | 44.6, 45.7, 46.7 s | +2 %, wall equal |
| Scene build per section: sight lines, footprint keep-out, buildings | — | 0–10 ms per section | negligible |
| Drape grade, per load (6.3 Mpx) | — | 35–45 ms | negligible |

This mission's features cost about 4 % CPU in the ground scenes. The water was culled in the baseline (a bug); the buildings, shade fill and hatching are the goal's clarity and buildings tracks. The rest of the POC's distance from `bb9c039` (from ×1.094 at the earlier t8 to ×1.18 now) is not attributable to any change measured here.

**Optimisation (t8).** The four aerial scenes load the same corridor drape, so each render tab decoded the tiles, graded 6.3 Mpx and uploaded the texture four times. `src/data/memoOnSuccess.ts` keeps a tab's successful loads by key. Failures and aborts are not kept, and loads in flight are not shared, so one caller's abort cannot reach another (RD4). It is tested first in `tests/load-gate.test.ts`.

| Reel, before and after (interleaved, n = 3) | Wall | CPU |
|---|---|---|
| Before | 35.56, 35.97, 36.68 s | 309.3, 303.6, 303.1 s |
| After | 33.62, 33.68, 33.97 s | 295.2, 293.8, 293.0 s |

That is −6.4 % wall and −3.7 % CPU, with the same decoded md5.

**GPU (asked for by the owner during t8: "use gpu").** The 3D frames were already drawn on the GPU: under `--gl=angle`, WebGL reports "ANGLE Metal Renderer: Apple M4 Pro". Without the flag it gets SwiftShader, on the CPU. The CPU left in a 3D render was mostly libx264 encoding.

3D video renders now encode with VideoToolbox (`--hardware-acceleration=if-possible --video-bitrate=10M`, ADR 53). That is the lowest bitrate whose SSIM and PSNR against a CRF 1 reference match software encoding: 0.99675 against 0.99642, and 49.4 against 49.1 dB. The 2D video keeps software encoding. These runs are interleaved, on a fresh bundle of the final code; the machine was busier than above (load 10–22):

| Render | Software encoding | GPU encoding | Change |
|---|---|---|---|
| Reel wall | 40.03, 38.28, 42.59 s | 36.55, 35.51, 35.25 s | −11 % |
| Reel CPU | 350.8, 331.3, 384.2 s | 168.4, 175.7, 165.7 s | −52 % |
| POC wall | 7.54, 6.81, 6.73 s | 6.18, 6.28, 5.87 s | −13 % |
| POC CPU | 51.5, 49.8, 50.4 s | 28.4, 28.4, 28.0 s | −44 % |
| Repeat output | `aba11166…`, `b2357c0e…` (3 of 3 each) | `ad33af81…`, `7d390a72…` (3 of 3 each) | deterministic |
| File size | 36.5 MB, 6.7 MB | 111.1 MB, 13.8 MB | about ×3 and ×2 |
| 2D (software, unchanged) | — | decodes to `adfca9a7…` in 2 of 2 | unchanged |

**Verdict.** No measurement is worse than the baseline:

- **Reel.** It renders faster than its recorded baseline (33.76 s with software encoding in the quieter batch, and faster again with GPU encoding). Its CPU, about 170 s, is well below the only CPU record, 270–279 s.
- **POC.** Its CPU (28 s) is below the frozen `bb9c039` reference measured above (39.8–40.8 s). The earlier ~4 % CPU cost of this mission's features is more than recovered.
- **2D video.** Its output, time and CPU are unchanged. Its entry chunk is +0.31 %, inside the 2 % limit.
- **Budgets.** All hold: 64 calls and 1.94 M triangles at the worst frame.

The one cost is file size: 3D video files are about two to three times larger at matched quality.

## Security review (reel v2, t9, 2026-10-25)

**Scope.** This mission's changes:

- the building pipeline and candidate scripts, and the stills and metrics tools;
- the water-relation completion;
- the load gate and the drape cache;
- the building validation, the buildings, legend and overlay views;
- `data/landmarks.json`, the building data and registers, and the CI step.

The checks were mine (tools below) plus an independent security-auditor agent that was given the file list and the threat model but not my conclusions. The earlier accepted items stand: Studio LAN exposure, and the zod override (ADR 25).

| # | Finding | Severity | Disposition |
|---|---|---|---|
| T1 | `building:levels` from OSM reached the data unchecked. `NaN` became bare `NaN` in JSON, which the browser refuses, and `1e4` became a 30 km wall that `validateBuildings` accepted. | Medium | **Fixed.** Levels count only when finite and between 1 and 30 storeys, else the 6 m default. The pipeline's JSON writer refuses `NaN`, and `validateBuildings` caps heights at 200 m. Test first; mutation-checked. |
| T2 | `tiles-manifest.json` was parsed without a structure check. A bad file cancelled the render with a bare `TypeError`, against RD5. | Low | **Fixed.** `validateTilesManifest` checks layers, integer tile coordinates and relative image paths with no `..`. The drape wraps its error in `AssetLoadError`, naming the section and the file. Test first. **Accepted:** the route file, which the 2D video shares, is committed data covered by `tests/route.test.ts`. |
| T3 | Water-relation completion has no size cap. | Low | **Accepted.** It is a manual developer step on known windows, and only Llyn Trawsfynydd (3.5 km) is completed. The run prints each relation it completes. Revisit if windows are added. |
| T4 | Rebuilding a section window wrote its register without the building entries, and the buildings then disappeared silently. | Low | **Fixed.** `keep_owned` keeps the entries `build_buildings.py` owns. Self-test; mutation-checked. |
| T5 | The BL18 screening rule wasn't enforced in code. | Low | **Fixed.** `check_landmark` refuses an entry without `screened`, dated https sources or the other required fields. Self-test; mutation-checked; the real file passes. |
| T6 | An impossible date (2015-13-40), or an observation after the retrieval, got past the age rule. | Low | **Fixed.** A calendar-date check (no clock, per RN1), and `observedAt` must not follow `retrievedAt`. Test first. |
| T7 | Standing checks. | — | **Clean.** `npm audit --audit-level=high`: 0. The zod override is in place. Python expat is 2.7.1, and ElementTree fetches no external entities. `src` has no `eval`, `innerHTML` or `new Function`. Scripts reach only the two allowlisted hosts (RL30). The 138 changed files contain no secret pattern. `aidefence_scan` and `aidefence_has_pii` on the new on-screen and curated text: safe, none. Building data holds only BL17's keys. |
| T8 | Earlier items, unchanged by this mission. | Low | **Accepted.** The owner's contact email is in the OSM User-Agent, as the OSM API policy asks; it is already committed in `bb9c039`. The evidence logs show a local home path, as six earlier logs do. pip pins versions but not hashes. Offline, CI's npm 11.8.0 could not be confirmed to honour `allowScripts`. |

After the fixes: `npx vitest run` gives 35 files, 233 passed and the 2 expected RL8 failures. `npm run lint` and `npm run build` exit 0, and the entry chunk stays at 1,339,650 B. Both pipeline self-tests are ok. An aerial still (Section-intro, frame 120) renders through the stricter manifest check with centre luma 165.0. No high-severity finding is open.

## Code review (reel v2, t10, 2026-10-25)

Three independent reviewers, given the code and the spec but not my conclusions, covered the pipeline and tooling, the pure core, and the providers and views. Every finding was traced in the code before it was changed. Each fix has a test that failed first or a mutation check. Totals: 4 High, 6 Medium, 14 Low; 22 fixed, 2 accepted. One render-check regression the fixes caused was then fixed too (last rows).

| Area | Finding | Severity | Disposition |
|---|---|---|---|
| Core | CL5 crown spheres stopped at y 1.14, below the cone's apex at 1.425. Real drone frames were blocked (Maentwrog 10, Trawsfynydd 24), and the test copied the same spheres. | High | **Fixed.** `CROWN_SHAPES` is the one source TreesView draws from. Six spheres now enclose the cone (a test checks it). The occlusion test checks the drawn cone and an enclosing ellipsoid. |
| Core | Two Maentwrog buildings, running off the terrain window, had walls to −∞. | High | **Fixed.** The core skips footprints not wholly on the terrain, and the candidates pass leaves them out. A real-data BL5 test requires every vertex to be finite. |
| Core | The WA5 shared-level test could not fail. | High | **Fixed.** It asserts the level itself in both windows. |
| Pipeline | WA6/WA7 could not see terrain rising through a lake, because it hides the water in both masks. | High | **Fixed.** `water-terrain.test.ts` checks the terrain itself. Before the fix: 19 nodes above Llyn Trawsfynydd in Maentwrog, 876 above way 4684879, and a north Vale lake with no shared level. The fill now lowers lake ground above the level. Vale-north, maentwrog and trawsfynydd were rebuilt: only lake cells changed, each lowered by at most 2 m. Profiles and registers are unchanged apart from the fill notes. |
| Core | Gabled roofs on skewed quads overhung their walls; rectangles with collinear nodes were drawn flat. | Medium | **Fixed.** Collinear nodes are dropped first, then all four corners must be square and opposite sides equal. |
| Runtime | On the render where the input changed, `useLoadGate` returned the old input's data. | Medium | **Fixed.** The state carries its key. A hook-level test runs it as React would. |
| Pipeline | A water relation cut by the box was dropped before completion. | Medium | **Fixed.** It is kept as a placeholder and completed. Self-test. |
| Pipeline | `--reuse-osm` lost footbridge overbridges. | Medium | **Fixed.** Overbridge ways are kept, and a reuse restores missing ones from the API (vale-north's `way/461362623` was restored). |
| Pipeline | Relation buildings were dated today with high confidence. | Medium | **Fixed.** Relations are fetched with their dates: `relation/6377654` is now 2016-07-02, medium. An undated element is refused. |
| Pipeline | X2 missed staged edits and new baseline files. | Medium | **Fixed.** It diffs against HEAD and requires no untracked files. |
| Core | `waterArrays` misindexed a closed ring. | Low | **Fixed.** The vertices are read after triangulation. Test. |
| Core | Walls floated over dips between corners. | Low | **Fixed.** The base samples every edge every 2 m. Test. |
| Core | Validators accepted degenerate rings, duplicate ids and negative tile numbers. | Low | **Fixed.** Tests. |
| Core | The 3-year rule depended on the date (365.25-day years). | Low | **Fixed.** A calendar rule, the same in TypeScript and Python. Tests in both. |
| Runtime | Effects run again after a cleanup (StrictMode, Activity) never reloaded. | Low | **Fixed.** A fresh gate is made after a cleanup. Hook test. |
| Runtime | RD5 errors named the window ("corridor"), not the section. | Low | **Fixed.** A `label` prop carries the section id. The route file's structure check stays accepted: it is shared with the 2D video and covered by `tests/route.test.ts` (as at t9). |
| Runtime | The legend named hatching in aerial scenes, where it cannot be seen. | Low | **Fixed.** `sectionLegend` names it on the ground only. |
| Runtime, pipeline | Badges logged `lines: null`, so CL10 passed them silently. | Low | **Fixed.** The badge has a line height, and a non-numeric count now fails. |
| Pipeline | An island touching the shore at its first vertex was dropped. | Low | **Fixed** in Python and TypeScript: assignment by most vertices. Tests. |
| Pipeline | WA6 passed when the no-water still was missing. | Low | **Fixed.** Unmeasured is not a pass. Self-test. |
| Pipeline | RD1/RD2 never cold-loaded the reel's last frame of each scene. | Low | **Fixed.** Those 8 frames are added. |
| Pipeline | Ways deleted in OSM would be built as existing. | Low | **Fixed.** They are skipped and listed. Self-test. |
| Pipeline | The metrics read files by name, not from the manifest. | Low | **Fixed.** Only the files the manifests list are read. |
| Pipeline | The rebuild also dropped vale-north's 17 earthworks (found while checking the rebuild). | Low | **Fixed.** Earthwork entries are kept like buildings, and vale-north's were regenerated identical to before. |
| Render checks | After the crown fix, the drone shots clear more trees from the sight lines. Maentwrog frame 150 rose to +10.9 % luma, over CL3. | — | **Fixed.** `TREE_FILL` re-tuned by its own rule (the largest that keeps every still within ±10 %): 0.08, with the crowns darkened to match (#2b482b, #486733). The frame measures +9.5 %, and shade-side trees ×2.03. |
| Pipeline | The CL2 shade luma, about 8 of 255, meets the spec but is dark. | — | **Accepted** as recorded at t7: the CL2/CL3 conflict is for the spec owner. |

**After the fixes:** `npx vitest run` gives 37 files, 254 passed and the 2 expected RL8 failures. `npm run lint` and `npm run build` exit 0. The entry chunk is 1,340,444 B, +0.50 % on the pre-reel size (limit 2 %); the key-aware hook is shared with the 2D route provider. The three pipeline self-tests are ok. The buildings are now 156 (55, 30, 5, 8, 58): two Maentwrog footprints off the terrain are left out. The render checks are the last table below.

## Full test run (reel v2, t11, 2026-10-26)

One run, one snapshot: tree `41507f407cb5`, with the untracked files hashed by `scripts/snapshot.mjs`. Every step's command, output and exit code is in `docs/evidence/t11-reel-v2-full-suite.log`; home paths are written as `~`.

| Step | Result |
|---|---|
| `npm run lint` (eslint and tsc) | exit 0 |
| `npx vitest run --reporter=verbose` | 37 files; 254 passed, plus the 2 expected RL8 failures (vale-south and trawsfynydd gradients, documented `it.fails`) |
| Python self-tests: `dem/bng.py`, `build_section_data.py`, `build_buildings.py`, `still_metrics.py` | all ok |
| `py_compile` of the seven pipeline scripts | exit 0 |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| `npm run build` | exit 0; 2D entry chunk 1,340,444 B (+0.50 % on the pre-reel size, limit 2 %) |
| `npm run test:render` | 25 of 25 pass (the table below), including CyclingVision's decoded md5 `adfca9a7…` and the reel's 2,700 frames in 31 s with no blank frame |

## Build and CI (reel v2, t12, 2026-10-26)

The repository has no remote, so CI was verified as before: the workflow run locally in a clean copy of the files git would ship (496 files, without tool state or build output), as a git checkout. This time the steps ran on the runner's own toolchain: npm 11.8.0, the version bundled with Node 24.13.1, through a shim. Log: `docs/evidence/t12-reel-v2-ci-local.log`.

- **Workflow static checks: pass.** Actions are pinned to commit SHAs. Permissions are `contents: read`, credentials are not persisted, there is no `pull_request_target`, and the timeout is 20 min.
- **Every `run` step: pass.**
  - `npm ci --ignore-scripts`;
  - `pip install numpy==2.4.4 pillow==12.1.0`;
  - `npm run lint`;
  - `npm test` (37 files, 255 passed and the 2 expected RL8 failures);
  - `npm audit --audit-level=high` (0);
  - the BNG self-test and the compile check of seven pipeline scripts;
  - `npm run build`.
- **Finding, fixed: npm 11.8.0 ignored `allowScripts`.** It ran esbuild's install script, which `package.json`'s `allowScripts` blocks and which npm 11.21 skips. This is the item t9 left unverified. CI now installs with `--ignore-scripts`, the same outcome on any npm version: no install script runs, as locally. esbuild, vitest and the bundle work without it. A static test pins the flag; it failed first.
- **Finding, harness only:** the first run used a plain copy, and the X2 static test's `git diff` needs a repository. The clean copy is now a git checkout, as `actions/checkout` gives.

`npm test` in CI does not include the render checks, which stay a local release gate (ADR 26). They ran at t11, 25 of 25. This task changed only `.github/workflows/ci.yml` and a static test, so nothing they render changed.

## Documentation (reel v2, t13, 2026-10-26)

Three independent auditors compared the documents with the shipped code and data, each in its own scope, without editing anything; I made every correction as the single writer.

| Scope | Drift found | Correct claims checked |
|---|---|---|
| `docs/spec-3d.md` (iteration-2 rows), `README.md` | 17, 4 | 30 rows, 3 decision rows, 15 statements |
| `docs/design-reel-v2.md`, `docs/pseudocode-reel-v2.md`, `docs/design-3d.md` | 19, 14, 3 (+2 outside scope) | 54, 47, 46 |
| `docs/adr/0041–0053` and index, `docs/sop-3d.md`, `data/source-register.md` | 16, 12, 2 + 6 missing entries | 121, 41, 4 |

**What changed:**

- **Spec.** The criteria now say what the tests and render checks do:
  - WA5–WA7 and RD2, RD5, RD6;
  - CL1, CL4, CL8, CL10, CL11;
  - BL4, BL13 (not yet measured: no landmark), BL14, BL16;
  - X3.

  WA7's t10 amendment had landed outside its table cell and was moved in. WA1 was strengthened rather than weakened: a new test checks every lake drawn in the five ground windows.
- **README.** It now covers the per-window data folders, the two building passes, GPU encoding, and the render checks' full scope and needs.
- **Design and pseudocode, rewritten as built.** The decisions D37–D48, the module table, the data files and the checks now record:
  - the render-time hold;
  - ten masks and `hide`;
  - the neutral-only drape grade and `TREE_FILL`;
  - sight lines instead of a camera corridor;
  - candidates at measured heights;
  - gables on true rectangles;
  - the calendar rule;
  - the fill clamp.

  The pseudocode says it was brought up to date at t13.
- **ADRs.** The SOP forbids editing a decision, so ADRs 41, 42 and 44–51 and 53 gained an "As built" section. The index names ADR 53.
- **SOP.** Fresh-build order, the npm test needs, the render-check scope and duration, CI's `--ignore-scripts` and Pillow, the masked before set, the DSM and DTM, the drape grade's home and `TREE_FILL`, and a new section's stills lists.
- **Source register.** It now lists the lake levels, building footprints and heights (the lidar DSM URL), the building files and the curated landmark (Coflein and Geograph as evidence only). It also records the trackbed building near km 10.93 and the reactor halls out of shot.
- **Code comments.** Two stale docstrings (the hole assignment) were fixed.

**An auditor's side effect, checked.** One auditor ran `build_poc_data.py --help`. The script took no options, so it ran the POC build, rewriting the three POC terrain files, then stopped; the auditor restored `dem-poc.json`. All three files are byte-identical to the committed versions. The JSON outputs hold no `NaN`, so the stricter writer cannot break a rebuild. The script now refuses any argument and prints its usage.

**Gates after the changes:** `npm run lint` exit 0; `npx vitest run` 37 files, 260 passed and the 2 expected RL8 failures; `npm run build` exit 0; the three pipeline self-tests are ok. No rendering code changed, so the render checks of t11 stand.

## Independent validation (reel v2, t14, 2026-10-26)

An independent `production-validator` agent checked every criterion of the iteration-2 spec, the goal's eight mission criteria and the X rows. It did not write any of the work it checked. It reran the tests, the render checks and its own measurements, and inspected the stills at 100 % and 200 %. Its report, with the commands, outputs and per-criterion evidence, is `docs/evidence/t14-reel-v2-independent-validation.md` (snapshot tree `4727b412fb42`).

**Verdicts (51 rows):** 39 PASS, 7 PARTIAL (RD7, CL2, CL6, CL7, BL1, BL4, X4), 2 FAIL (X1, X5), 2 NOT YET (BL9, BL13: no landmark is modelled), 1 N/A (CL13, optional locator). `npm run lint`, `npm test`, `npm run build` and the CI self-tests pass. `npm run test:render` gives 24 of 25 and fails only on X1.

- **X1, CyclingVision's decoded md5 (fails under load, not a code regression).** Both the validator's renders and my two re-renders at load average 83 and 103 decode to `5972923116fc…`, not `adfca9a7…`. The load came from other programs (a media-analysis daemon at 333 % CPU, a long-running terraform provider, another agent session). HEAD's own code gives the same md5 under the same load. The differing frames are the 2D map scenes (500–749, 1005–1019). X1 passed in every run today at load 10–20. The likely cause is pre-existing 2D code: `MapBasemap.tsx` waits for `Image()` loads but captures SVG `<image>` elements. That is outside this goal. **Re-run X1 on a quiet machine before release.** X5 fails only because of X1.
- **Open, for the owner:**
  - BL1/BL13: the Trawsfynydd reactor halls are in the Maentwrog follow shot, frames 180–359, at 64–68 px, but outside that window's data, so they are never listed. `data/source-register.md` calls them out of shot.
  - CL7: the bridge hatching (a 16 × 16 nearest-filtered texture) aliases into saw-tooth bands at close range; approximate buildings, roads and water carry no marking.
  - CL2: shade-side conifers are near-black, at about 8/255. The ratio is met, but from a near-zero base. The CL2/CL3 trade-off is unchanged.
  - RL21: it conflicts with drawing houses from footprints, and was not amended.
  - Mission criterion 7 (learning) is t15.
- **Low:**
  - test strength: RD7's failing-first proof, BL5's real-data test (dead code), BL4's first clause;
  - 13 slope buildings are drawn 0.2–2.2 m taller than recorded;
  - `drapeInputs` is keyed without the label;
  - the source register's "152 of 156" lidar heights is 150.

Nothing was changed at t14 except this record and the report.

## Learn (reel v2, t15, 2026-10-26)

**Stored and verified on disk.** I checked a copy of `.swarm/agentdb-memory.db` with its WAL: `integrity_check` ok. It holds:
- the goal, the t1–t14 records, `3d-reel-v2/mission-outcome` and `3d-reel-v2/t15-routing` (17 keys, 47 entries in `patterns`);
- five ReasoningBank patterns (ids 68–72) and one distilled from the trajectory feedback (73). Their topics are the render-body hold, geometric tests over shared-occluder masks, load-sensitive md5 gates, per-shot frustum candidates, and ruflo routing.

The mission trajectory (5 steps) ended successfully, and a learning cycle with consolidation ran.

**Routing.** Each of t1–t14 left one routing outcome, and the router builds learned patterns for 8 agents from them. Each has at least 2 outcomes and reliability 0.79 or more. But `hooks_route` embeds with `hash` by default, which scores them about 0.3, below its 0.4 gate, so they never route. I measured seven sample tasks with the pinned CLI (3.63.0) under both embedders:

| Task | `hash` (default) | `CLAUDE_FLOW_ROUTER_EMBEDDER=minilm` |
|---|---|---|
| Validate against the goal | `reviewer` (keyword) | `production-validator` (learned, 48 %) |
| Docs audit against the code | `coder` | `researcher` (learned) |
| Build and CI in a clean room | `tester` | `cicd-engineer` (learned) |
| Benchmark against the baseline | `tester` | `performance-engineer` |
| Landmark silhouette; failing tests; prior-art research | `architect`; `tester`; `memory-specialist` | the same |

Two more findings:
- The earlier missions' trajectories used agents that SONA routing ignores (`coordinator`, `reasoningbank-learner`); this mission's uses `coder`. A SONA pattern needs about three successes to pass its 0.6 gate.
- Five outcomes were recorded twice during the previous mission's t15, which inflates their support.

Enabling `minilm` means changing the environment of the `claude-flow` MCP server. That is the owner's choice, so it is not done.

## Render check results

Earlier reports, 11 runs from 2026-10-25 and 26, are in `docs/evidence/render-checks-history.md`.

### Render checks 2026-10-26T00:19:13.850Z (darwin-arm64; snapshot tree 41507f407cb5, dirty, untracked 3e0149333248)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 45.9–82.4 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104318 tris; f45: 65 calls, 1104318 tris; f180: 65 calls, 1104318 tris; f210: 65 calls, 1104318 tris; f359: 65 calls, 1104318 tris |
| RN5b terrain drawn at frame 0 | pass | 257 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 31 s (0.0116 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 45.9–168.3 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 2399: 64 calls, 1937530 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 1755, heritage 2109, overview 1426, blaenau 275, vale-north 231, vale-south 402, maentwrog 311, trawsfynydd 268, closing 2257 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | pass | 80 boxes at 24 frames, max 2 lines |
| RD6 no missing map tiles in the reel | pass | 16 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 43 fresh stills (9 sections x 3, 8 cuts x 2): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet HEAD -- tests/baselines; no untracked file there |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on 41507f407cb5; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.11 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | pass | CL2 x1.91-x3.72 (11 stills); CL3 max change 9.5 % (15 stills) |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.9 vs 86.6 (2.0 %), saturation 0.404 vs 0.453 (10.9 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

### Render checks 2026-10-26T01:13:41.011Z (darwin-arm64; snapshot tree 4727b412fb42, dirty, untracked a288e61124ab)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.03 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 45.9–82.4 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104318 tris; f45: 65 calls, 1104318 tris; f180: 65 calls, 1104318 tris; f210: 65 calls, 1104318 tris; f359: 65 calls, 1104318 tris |
| RN5b terrain drawn at frame 0 | pass | 257 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 62 s (0.0230 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 45.9–168.3 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 2399: 64 calls, 1937530 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 1755, heritage 2109, overview 1426, blaenau 275, vale-north 231, vale-south 402, maentwrog 311, trawsfynydd 268, closing 2257 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | pass | 80 boxes at 24 frames, max 2 lines |
| RD6 no missing map tiles in the reel | pass | 16 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 43 fresh stills (9 sections x 3, 8 cuts x 2): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | FAIL | decoded md5 5972923116fc10aebfc3f2031ec3ba3a |
| X2 visual baselines untouched | pass | git diff --quiet HEAD -- tests/baselines; no untracked file there |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on 4727b412fb42; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.11 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | pass | CL2 x1.91-x3.72 (11 stills); CL3 max change 9.5 % (15 stills) |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.9 vs 86.6 (2.0 %), saturation 0.404 vs 0.453 (10.9 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

## Photoreal prototype records (ADRs 54–59, 2026-10-29 and 2026-10-30)

The photoreal prototype's checks, measurements, visual reviews and the walkers' addendum are in `docs/validation-photoreal.md`;
the independent review's report (spec X4) is `docs/evidence/photo/independent-review-2026-10-30.md`.
