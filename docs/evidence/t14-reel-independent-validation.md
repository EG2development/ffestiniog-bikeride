# Independent validation of the 1:30 reel (mission `msn_44274a1de641722956fc9ce5`, task t14, 2026-10-25)

Reviewer: independent validation agent (t14), not the author. Everything below was run or looked at by me on 2026-10-25, 17:58–18:20 UTC, on the uncommitted worktree of branch `mission/3d-reel` (git HEAD `bb9c039`), Apple M4 Pro, Node 24.13.1, no network. The author's records were treated as claims; where I reproduced a number I say so.

## 1. Commands I ran and their key output

| Command | Key output |
|---|---|
| `npm run lint` | `eslint src && tsc`, exit 0 |
| `npx vitest run --reporter=verbose` | 24 files; **132 passed, 2 expected fail (134)**; exit 0. The two are `section-acceptance.test.ts › RL8` for `vale-south` and `trawsfynydd`, marked `it.fails` with a comment that names the open item (lines 28–33). Honest: the failure is expected by the spec, the register and the log, and the test flips to a failure when the profiles are fixed. |
| `npm run build -- --out-dir=out/bundle --log=error` | exit 0; 73 files; entry `bundle.js` 1,335,530 B (pre-reel baseline 1,333,784 B: +1,746 B, +0.13 %, limit 2 %; the author recorded 1,335,844 B at t8) |
| `npm run test:render` (17:58:36–18:01:31 UTC) | **12 of 12 pass** (table appended to `docs/validation-3d.md` at 18:01:31Z): reel 1920×1080 30 fps H.264 2,700 frames in 39 s (0.0143 s/frame); blank scan luma 36.1–180.6; frames 0/1349/2699 byte-identical; worst load frame 2399 at 62 calls, 1,936,811 triangles; RL10 colour bins 254–2,171; 9 previews written |
| `npx remotion render src/index.ts CyclingVision …` then `ffmpeg -f md5 -` | 3,150 frames, H.264 1920×1080 30/1, decoded **MD5 `adfca9a7f31577885e4ec84c1aca3f53`** = the pre-3D baseline (RL25 reproduced in full, not only RG1's four stills) |
| 14 × `npx remotion still src/index.ts Reel3D … --gl=angle --port=3523` | frames 20, 1000, 1050, 1150, 1300, 1560, 1600, 1850, 2000, 2240, 2300, 2350, 2450, 2690; 2–4 s each |
| `ffmpeg … select=eq(n,F)` on the render checks' `reel.mp4` | the frame on each side of every cut: 239/240, 479/480, 779/780, 1079/1080, 1349/1350, 1619/1620, 1919/1920, 2399/2400 |
| my script `section-check.ts` (esbuild bundle, node), over every section on the real data | per-section rider, camera, trees, water, bridges, roads, earthworks, registers and RL5 figures; see §3 |
| my script `cam-speed.ts` | per-frame camera speed in the vale-south and trawsfynydd drone shots; see §3 |
| ruflo `memory_search` (`patterns`, "3d-reel"), `memory_list` (`patterns`), `memory_retrieve` (`ffestiniog-bikeride/3d-reel/decisions`), `memory_search` (`default`) | `patterns` holds **4 entries**, all from the first mission (`3d-upgrade/t1-prior-art`, `t3-design`, `t4-adrs-sop`, `t6-failing-tests`); no `3d-reel` key; `default` returns nothing |

Frames viewed: **39 distinct frames** (the 16 cut frames, the 9 caption/diagnostic stills from the render checks at 100, 350, 600, 900, 1200, 1500, 1750, 2050, 2600, and my 14 stills), plus 2× crops of 1000, 1850 and 2300 around the rider. Files: `/private/tmp/claude-501/-Users-eray-ffestiniog-bikeride/bb3f26c8-7af5-483b-b78b-7ff809bf3730/scratchpad/t14-validator/` (`stills/`, `cuts/`, `section-check.jsonl`, `render-checks.log`, `vitest.log`, `stills.log`).

## 2. Verdicts, RL1–RL34 and the brief's items

PASS = criterion met and checked by me; PARTIAL = met in part; FAIL = not met; NOT CHECKED = I could not check it.

| ID | Verdict | Evidence (mine unless stated) |
|---|---|---|
| RL1 | PASS | ffprobe in my `test:render` run: 1920×1080, 30/1, h264, 2,700 frames |
| RL2 | PASS | `src/data/reel-timeline.ts` read against the spec table: nine sequences, boundaries 0/240/480/780/1080/1350/1620/1920/2400, sum 2,700; `reel-timeline.test.ts` passed |
| RL3 | PASS | `src/Root.tsx` registers `Reel3D` and nine `Section-<id>` entries with `lazyComponent` and imports no 3D module; static test RL3 passed |
| RL4 | PASS | `src/three-core/sections.ts`: `SectionConfig`, nine `SECTIONS`, one `buildSectionScene`; `POC` is the Maentwrog numbers; `sections.test.ts` passed |
| RL5 | PASS | Reproduced per window (median / max m vs GLO-90): corridor 3.8 / 20.9, blaenau 7.5 / 22.3, vale-north 6.2 / 19.0, vale-south 5.0 / 15.3, maentwrog 2.7 / 12.6, trawsfynydd 3.1 / 12.4 (author: 7.6 for blaenau, otherwise the same). Headers name the lidar, `EPSG:27700` and the km range; grid 4 m |
| RL6 | PASS | corridor window 226 × 692 at 16 m, 310,950 triangles (≤ 400 k), km 0–13.24 |
| RL7 | PASS | Every road drawn is a register `road` entry (the assembly filters by `source.ref`); bridges drawn = register bridges in range: blaenau 4, vale-north 5, vale-south 3, maentwrog 1, trawsfynydd 1; water polygons drawn are registered (ids 3084421, 4685059, 4684879 found) |
| RL8 | **FAIL** (vale-south, trawsfynydd; disclosed) | Reproduced at 5 m steps: blaenau 2.7 %, vale-north 2.8 %, maentwrog 11.9 % only inside the listed km 8.985–9.030 dip, **vale-south 18.7 % at km 5.895** (44 steps over 4 %), **trawsfynydd 13.6 % at km 10.360** (88 steps). New: the listed trawsfynydd stretches are incomplete; my runs over 4 % also include **km 11.995–12.185** (about 190 m, right after bridge way 373584158), 12.885–12.895 and 13.025–13.045, which neither the spec nor `data/source-register.md` lists |
| RL9 | **FAIL** | No register entry in any window carries `gapRefs` (0 of 479 / 411 / 272 / 92 / 295 merged entries); no note names the 214 m offset, way 270718795 or the steep stretches; nothing on screen labels the affected features "approximate". The design table (D-row `data/features-<id>.json`) admits it |
| RL10 | PASS | Colour bins reproduced (254–2,171); every ground still shows slope-and-height shading, no single-material ground. Realism caveat: large single-hue fields (frames 1500, 1600, 2300) |
| RL11 | PASS | `atmosphere.ts`: fog colour is `horizon` by construction, sun 200° / 35° (ADR 18); `atmosphere.test.ts` passed; the gradient sky and haze are visible in every ground still |
| RL12 | PARTIAL | `Lighting.tsx`: 2048², frustum ±15 units = 300 m, `normalBias` 0.02, `shadows={{ type: 1 }}`. Terrain shows no acne in any of the 39 frames. But the bridge parapets at 1850 and 1919 show diagonal self-shadow stripes, and in every follow shot (1000, 1079, 1349, 1619, 1850, 2240, 2300, 2350) the rider's shadow carries a dithered speckle wedge beside the dark body shadow (thin spokes, 0.8 mm radius, against a 15 cm shadow texel) |
| RL13 | PASS | My counts (conifer / broadleaf, cap): blaenau 2,290 / 1,890, vale-north 1,421 / 1,218, vale-south 4,859 / 3,996, maentwrog 3,016 / 2,341 (cap 6,000), trawsfynydd 2,042 / 1,740 (cap 2,500); nearest tree to the trail 10.0–10.2 m in every window (the untested 10 m holds); 0 beyond 300 m; 0 within 2 m of a carriageway; 370–1,257 trees within 300 m of the rider's start. The 1–15 per 100 m² band I did not re-measure (the author's synthetic test only) |
| RL14 | PASS | Llyn Trawsfynydd (relation 3084421, 507 ha) at **197.2 m** in the trawsfynydd window and **197.7 m** in the maentwrog window (two shore medians for one lake; never on screen together); vale-north tarn 8.1 ha at 405.9 m; ripple offset = frame × 0.0007 (RN1). Frames 1920, 2000, 2050 show the lake at the shore; the surface reads flat, the ripple is not perceptible at this distance |
| RL15 | PASS | Extended the author's Maentwrog-only test to every window: 0 road vertices under 0.2 m above the rendered ground; minimum lift 0.3 m in all five |
| RL16 | PASS | `cyclistModel.test.ts` passed; `CyclistView` maps parts (design D30) |
| RL17 | PASS | Badge present on all 39 frames I viewed; the render checks' overlay log at the 19 measured frames |
| RL18 | PASS | Card from 2490 to the end: full opacity by 2505, no fade-out (`to >= total`); 6.5 s; viewed at 2600 and 2690 |
| RL19 | PASS | Frame 350: "The line is mothballed, not dismantled. Heritage-railway restoration has been proposed for it more than once; a rail-with-trail layout is an alternative." Fully visible 315–435, 4.0 s |
| RL20 | PASS | Frame 900: "Blaenau Ffestiniog — still a live station today (Conwy Valley Line and Ffestiniog Railway)"; 4.7 s. Nothing shows the station derelict, because nothing shows the station: no building is drawn in any scene |
| RL21 | PASS | Frame 1750 private-home caption, 2050 decommissioning caption; no building or residence is drawn anywhere, so none is closer than the mesh resolves |
| RL22 | PASS | Attribution string names the lidar DTM (OGL), OpenStreetMap (ODbL), OpenTopoMap (CC-BY-SA) and "not survey-grade" on every frame; legible at 12 px in a full-resolution still, small on a 1080p screen |
| RL23 | PASS | Render checks: 0/1349/2699 identical; static RN1 over every 3D directory; my script: `shot(f)` identical on repeat for every frame of every section |
| RL24 | PASS | Reproduced: 20 stills, worst 2399 at 62 calls / 1,936,811 triangles (97 % of budget), full reel 39 s, no `delayRender` timeout |
| RL25 | PASS | RG1 4 frames match; my own full `CyclingVision` render decodes to `adfca9a7…`; entry chunk +0.13 % |
| RL26 | PASS | 2,700 frames, luma 36.1–180.6, none under 20 |
| RL27 | PASS | Both frames of all eight cuts viewed: each is a complete frame of its own section, hard cut, no blank or half-loaded canvas |
| RL28 | PASS (vacuous) | `public/3d/` does not exist; `data/assets-3d.json` holds the procedural cyclist |
| RL29 | PARTIAL | Roads, bridges, water, earthworks, terrain, land cover, trees and cyclist are register entries in every ground window. Two gaps: water is drawn from every OSM polygon ≥ 1 ha without consulting the register (`sections.ts:203`), so the match is by construction of the pipeline, not enforced; the aerial corridor scenes imply four cut/fill runs over 2 m on the 16 m mesh (km 2.202, 3.792, 5.954, 6.645; up to 4.2 m) that no register covers. Not one feature is "verified"; all 1,500-odd are "approximate" |
| RL30 | PASS | static test RL30 passed (two hosts) |
| RL31 | PASS | static test RL31 passed; every caption comes from `reel-captions.ts` |
| RL32 | PASS | `out/previews/` 9 stills written 18:01 by my run |
| RL33 | PASS (after this task) | The log holds render results and RL5 (t7), RL8 (t13), RL13 (t7) measurements; the review verdicts are now filled in by me |
| RL34 / P4-1 | PARTIAL | Brief §5 locations evidenced: Blaenau aerial approach (780–930), countryside side-follow (vale), Llan Ffestiniog elevated view (vale-south drone over km 5.25–5.37, station at 5.33), bridges close-up (1850–1919), Maentwrog Road, Trawsfynydd lake (1920–2399), full corridor (overview). Seven of eight, so "≥ 6" holds. "Railway cuttings" is not shown (no cutting inventory; the deepest implied cut is 3.9 m and no shot frames one) and nothing lists it as left out with a reason. The "full corridor" overview at 300–600 m shows about 1–2 km of map, not the 13.2 km the frame budget promises |
| H5 | PASS | the heritage caption (frame 350) |
| G8 | **FAIL** | as RL9 |
| TR4 | PARTIAL | Maentwrog Road station (km 8.66, "private residence" in the source register) and Trawsfynydd station (km 13.24, same) lie on the trail; the ribbon runs through both with no alternative alignment. The Maentwrog caption labels the home; nothing marks the trail there as constrained, and whether the trackbed past the house is inaccessible is unverified |
| L2 | PASS | as RL22 |

**Independent finding outside the V list (CA2).** The author states CA1–CA4 run only on the Maentwrog window. Running the spec's CA2 rule (speed change ≤ ±10 % between frames outside the 0.5 s ramps) on every section: blaenau 0.908–1.081, vale-north 0.942–1.058, maentwrog 0.955–1.026 and all aerial shots pass; **vale-south drone shot: 4 frames outside (0.845–1.178, local frames 76–94); trawsfynydd drone shot: 7 frames outside (0.646–1.348, local frames 29–169)**, reel frames 1426–1444 and 1949–2089. Angular velocity stays ≤ 16.6°/s everywhere; CA3 and CA4 hold everywhere (ground ≥ 2.0 m above terrain, ≥ 8.67 m from the rider in follow shots; fov 45°). C2–C7 hold at every frame of every section (speeds 13.3–25.0 km/h, lateral 0.5 m, contacts ≤ 0.004 m, pitch error ≤ 0.87°, cadence 75 rpm).

## 3. The steep profiles (RL8), judged by eye

- **Trawsfynydd, frames 2200–2340.** The rider starts at km 10.300 and reaches km 10.382; between km 10.339 and 10.373 the profile drops 2.9 m at up to 13.6 %, so the rider's speed rises from 13.3 to the 25 km/h cap and the pitch follows. On screen (2240, 2300, 2350) the trail visibly sinks into a hollow for about 35 m while the parallel road on the right keeps its level, then climbs out. It reads as a drainage hollow or a lost culvert, not as a railway; it is not grotesque, but a viewer who knows railways will notice the trail dip under the road grade. The remaining stretches (km 10.385–10.645, 11.5–12.2, 12.74–13.05) are outside the ride and only pass under the drone.
- **Vale south, frames 1500–1619.** The rider (km 5.400–5.451) is on a −1 to −2 % grade; the 18.7 % stretches at km 5.785–6.04 are 350 m ahead and off screen in the follow shot; at 1500 and 1600 the terrain and trail look plausible. The drone shot (km 5.25–5.37) does not reach them either. So the breach is in the data, not in what the reel shows, for this section.

## 4. Mission acceptance criteria

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Specification with a testable criterion per requirement | PASS | `docs/spec-3d.md` RL1–RL34, each with a method letter; two (RL8, RL9) are knowingly unmet and say so |
| 2 | Design written down | PASS | `docs/design-3d.md` reel design D23–D36, modules table, shipped interfaces; ADRs 27–40 each with six sections and a Status |
| 3 | Whole test suite passes | PASS, with a caveat | 132 pass, 2 `it.fails` by design (RL8 for two windows). The suite is green because those two criteria are declared open, not because they are met |
| 4 | Build and CI pass | PASS (local) | lint 0, build 0; `docs/evidence/t12-reel-ci-local.log` clean-room run GREEN; no remote, so the hosted run is unexercised; I did not run `npm audit` (network) |
| 5 | Every criterion checked by someone other than the author | PASS (this report) | T/S/R checks exist and ran under me; V items are above |
| 6 | Prior art, ADRs and memory searched and recorded | PARTIAL | `docs/prior-art-3d.md` reel section and ADRs 27–40 exist. The prior art claims 15 `3d-upgrade` entries plus `3d-reel/decisions` in ruflo memory; the store I can read holds 4 entries from the first mission and no reel key |
| 7 | Outcome stored as patterns, routing trained | **NOT DONE** | `memory_list` of `patterns`: 4 entries, none for the reel; no `3d-reel` key in `patterns` or `default` |
| 8 | Review findings resolved or accepted | PASS | t9 S1 fixed, S2–S6 clean; t10 R1–R10 fixed or accepted with a reason; t13 audits resolved. RL8/RL9 remain open for the owner and are recorded as such |

## 5. Realism, scene by scene

- **Intro, heritage, overview, closing (36 s of 90).** The zoom-15 OpenTopoMap drape (4.8 m per pixel) is viewed from 150–600 m, so the map is magnified into a blurry, pixelated sheet with giant road labels (frames 100, 350, 600, 2400, 2600, 2690). It is honest and credited, but it is a paper map, not the "aerial over Eryri" or the full-corridor view the frame budget names. The spec's "trackbed draws on" in scene 2 is a static hold.
- **Blaenau (780–1079).** Roads are flat grey ribbons, "built-up" land cover is a flat grey patch with no building; the slate quarry faces (frames 1000, 1050) are the one recognisable landform. No slate tips, walls or houses.
- **Vale north and south (1080–1619).** Rolling single-hue green and brown fields with sparse, very dark low-poly trees casting hard shadows; no field walls, hedges or farms; Llan Ffestiniog is only a caption. The ride itself (1349, 1619) is smooth and plausible.
- **Maentwrog (1620–1919).** The best scene: dense woodland, the A470 and the bridge with parapets (1750, 1850, 1919). Flaws: parapet self-shadow stripes; the woodland is two tree shapes repeated.
- **Trawsfynydd (1920–2399).** The lake and the wooded shore (2000, 2050) are the most convincing landscape frames. The follow shot dips through the km 10.34–10.37 hollow (above). The drone shot's speed is uneven (CA2 above).
- **Everywhere.** Sky is a clean gradient with no cloud and the sun disc is never in frame; the rider is a capsule mannequin with a grey ball head; the rider's shadow has a speckled wedge; water has no visible ripple; captions and the badge are clear and consistent.

**Top five changes for realism (my ranking):**
1. Re-think the four aerial scenes: fly high enough to show the corridor and shade the 16 m DTM with land cover and relief instead of a magnified zoom-15 tile drape, or fetch and register higher-zoom tiles for the low shots.
2. Give the ground a detail texture: a CC0 normal and roughness map for grass, heath and rock (registered in `assets-3d.json`), plus OSM `barrier=wall` and hedge lines as thin ribbons; the Vale is Welsh upland because of its walls.
3. Draw buildings from the OSM footprints the pipeline already keeps (`building=yes`): Blaenau's streets, Llan Ffestiniog, the station houses that the captions talk about.
4. Vegetation and shadows: lighter and more varied foliage, 4–6 tree shapes with scale jitter, billboards beyond the near zone; turn off shadow casting for the spokes and fix the parapet bias.
5. Resolve the two steep profiles (bridge or culvert spans, or a centreline off the trackbed) so the rider never drops at 13 %; then add a sun disc, light cloud and a perceptible lake ripple.

## 6. Claims in the author's records I could not confirm

- `docs/prior-art-3d.md` §3: "15 entries" under `ffestiniog-bikeride/3d-upgrade/…`, the key `3d-reel/decisions`, and "five distilled patterns stored at t15". The ruflo `patterns` namespace I can read holds four entries and no reel key.
- `docs/validation-3d.md` t12: the render-check detail text "20 frames measured (…)" is what the script printed then; the script now prints "20 stills, 19 distinct frames", so the two older tables and the current script differ in wording only.
- `docs/validation-3d.md` t7: "the first frame after each cut was checked … by eye" and t12 "the Trawsfynydd and intro stills were inspected by eye": the author's viewing, unverifiable; I viewed them myself (§1).
- Spec RL8 and `data/source-register.md`: the list of trawsfynydd stretches over 4 % omits km 11.995–12.185, 12.885–12.895 and 13.025–13.045 (my computation, §2).
- RL5 blaenau median: the author reports 7.6 m, I measure 7.5 m (rounding of the same data).
- Hosted CI: no remote exists, so "the workflow passes" is only the local clean-room run.
- `npm audit`: not re-run by me (network).
