# Independent validation report: 3D cycling route animation, phase 2 (t14)

**Validator:** t14 production-validation agent. It did not build or review this work before.
**When:** 2026-10-25, 12:24–12:40 GMT.
**What was checked:** the worktree at `~/ffestiniog-bikeride`. The 3D work is uncommitted (HEAD `4493c87`), and `git status --porcelain` was the same before and after this run.
**Machine:** darwin-arm64, Node 24.13.1, Python 3.13 with numpy 2.4.4.
**Scratch directory (S):** `/private/tmp/claude-501/-Users-eray-ffestiniog-bikeride/bb3f26c8-7af5-483b-b78b-7ff809bf3730/scratchpad/t14`

**Method.** I re-ran every check myself, read the tests to see whether each one checks its criterion as worded, and rendered my own frames. I also wrote an independent numeric check against the real POC data: `S/check.ts`, bundled to `S/check.mjs` and run with node. It calls `project(lon, lat)` directly rather than reusing the test fixtures, and its output is quoted below as "check.mjs". I used the builder's docs (`docs/validation-3d.md`, the ADRs, memory) only to find where to look.

**Commands run, with their results:**

| Command | Result |
|---|---|
| `npx vitest run --reporter=verbose` (`S/vitest.txt`) | 15 files, **90/90 pass**, exit 0 |
| `npm run lint` (`S/lint.txt`) | exit 0 |
| `npm audit --audit-level=high` | `found 0 vulnerabilities`, exit 0 |
| `python3 -I scripts/dem/bng.py` | `self-test passed: OS worked example 651409.903 313177.27`, exit 0 |
| `python3 -I -m py_compile scripts/build_poc_data.py scripts/dem/bng.py scripts/dem/cog.py scripts/osm/fetch_bbox.py` | exit 0 |
| `npx remotion bundle src/index.ts --out-dir=S/bundle` | exit 0 |
| `remotion still` | 11 POC stills with `--gl=angle`; frames 0, 180 and 359 rendered twice. 4 CyclingVision stills with the default GL. Port 3519 throughout. |
| `npx remotion render src/index.ts Poc3DMaentwrog S/poc.mp4 --gl=angle --port=3519 --log=verbose` | exit 0 in 6 s, concurrency 7 |
| `npx remotion render src/index.ts CyclingVision S/cv-full.mp4 --port=3519` | exit 0 in 35 s |
| `node S/diag.mjs` (Node API `renderStill` with `diagnostics: true`, reading `THREE_STATS` and `OVERLAYS` from the browser log) | 7 frames |
| `ffprobe` and `ffmpeg signalstats` on `S/poc.mp4` | see RN3 and RN5 |
| `ffmpeg -f md5` on `S/cv-full.mp4` | see RG1 |

## 1. Spec requirements (`docs/spec-3d.md`)

The spec has **50** requirement rows, not 45: G1–G8, H1–H5, RN1–RN7, TR1–TR4, C1–C9, CA1–CA5, RG1–RG5, L1–L2, and five P3–P5 rows. All 50 are below, in spec order.

| ID | Phase | Criterion (short) | Verdict | How I checked | Evidence |
|---|---|---|---|---|---|
| G1 | P2 | Centreline (x,z) = `project(lon,lat)` within 1e-6 | PASS | Ran my own check calling `route.project()` on every route point in km 7.7–9.7; read the test | check.mjs: 27 points, max error **0** units. `tests/three-core/poc-acceptance.test.ts:89-100` and `trail.test.ts:28` (synthetic, including midpoints) pass. |
| G2 | P2 | Real gridded DEM: (a) register names source, resolution, licence and date; (b) spacing ≤ 30 m; (c) median ≤ 5 m, max ≤ 30 m (amended by D4) | PASS | Read the register and the DEM header; recomputed (c) | (a) `data/source-register.md:91-99` names the Welsh Government / NRW lidar DTM, 1 m read at its 4 m overview, the OGL ("confirm before release") and "built 2026-10-25". (b) `public/data/dem-poc.json` gives spacingM 4. (c) check.mjs: n=27, **median 2.72 m, max 12.6 m**, which also meets the original ≤ 20 m. |
| G3 | P2 | VE = 1, or labelled | PASS | Read `POC.ve`; read the diagnostics log | `src/three-core/poc.ts:24` sets `ve: 1`. `THREE_STATS` reports `"ve":1` at all 7 frames. A `ve-label` overlay exists for VE ≠ 1 (`PocMaentwrog.tsx:65-69,138`). |
| G4 | P2 | Trail surface = profile/10 × VE within 0.1 units (amended by D7) | PASS | Recomputed over every profile point in the section | check.mjs: max difference **0.005** units (the 0.05 m surface offset). |
| G5 | P2 | (a) Terrain in the 3 m corridor at surface height; (b) cuts and fills > 2 m registered as approximate | PASS | Measured every rendered terrain vertex within 1.5 m of the centreline, outside the bridge span; compared the cut/fill runs with the register | (a) 339 vertices, max \|terrain − surface\| **0.054 m**. (b) The runs at km 8.602 (cut, 2.39 m), 8.865 (fill, 2.08 m) and 9.009 (fill, 3.53 m) each match an `earthwork-*` entry with category approximate in `data/features-3d.json`. |
| G6 | P2 | Only sourced structures; way 159029124 | PASS | Looked up each structure's OSM tags in `public/data/osm-poc.geojson` | All 5 structures are OSM ways tagged `bridge=yes`. Way 159029124 also has `railway=disused` and `name=Bala and Festiniog Railway`. Only the declared bridge is modelled (`poc.ts:113-115`). No unsourced cutting, embankment or tunnel objects. |
| G7 | P2 | Places, roads and water from verified sources; roads ≥ 0.2 m above terrain; no tree within 2 m of a carriageway | PASS | Read the register and the test logic | 79 road entries, every one OSM `way/…`. No labelled places or water in the POC. The test's checks are sound and run on real data: buried vertices (< 0.02 units) = [], trees within (half width + 2 m) of a carriageway = 0 (`poc-acceptance.test.ts:137-181`, pass). |
| G8 | P4 | Gaps listed per scene and labelled approximate | NOT YET (P4) | — | The POC gaps are listed (`source-register.md:103-107`). No per-scene gap mapping yet. |
| H1 | P2 | Register validates; every scene id in it with category and source | PASS | Read the test; listed the register | 92 features validate. `FEATURE_IDS` (`PocMaentwrog.tsx:23`) are all present; roads are drawn only from register entries (`poc.ts:109`). |
| H2 | P2 | (a) Disclaimer on first, middle and last frame; (b) trail labelled "proposed" when it appears; (c) trail surface distinct | PASS | Viewed frames 0, 15, 60, 180 and 359; read the `OVERLAYS` log | (a) "Concept visualisation — not an approved route" is visible in `poc-f0`, `poc-f180` and `poc-f359`; the badge does not fade. (b) "Proposed trail (concept): 3 m shared-use path on the old trackbed" covers frames 0–89. It fades in over frames 0–15: invisible at frame 0, full at 15 (`crop-labels-f15.png`). (c) The tan ribbon reads clearly against green terrain, dark-grey roads and the grey bridge in every frame. See also defect D4. |
| H3 | P2 | Closing caption states mothballed + heritage-railway proposals | **PARTIAL** | Viewed frames 300, 330 and 359; read `Caption.tsx` | The wording is correct and legible at full opacity (`crop-closing-f330.png`): "Concept only. The line is mothballed and heritage-railway restoration has been proposed; this is not an approved route." But it is on screen only for frames 300–359. It fades in over 300–315 (opacity 0 at frame 300, `poc-f300.png`) and out over 345–360 (opacity about 0.07 at frame 359, `crop-closing-f359.png`). That leaves **1.0 s at full opacity** for a 20-word sentence. See D1. |
| H4 | P2 | No survey-grade claims | PASS | Grepped the docs and README; read the on-screen text | The attribution reads "DEM- and OSM-derived, not survey-grade". `README.md:55` and `source-register.md:24,34` describe the data as approximate. No precision claims were found. |
| H5 | P5 | Rail-with-trail mentioned | NOT YET (P5) | — | — |
| RN1 | P2 | Only frame-driven; ThreeCanvas from @remotion/three; no clocks, timers or random | PASS | Grepped `src/three*`, `src/scenes3d` and both providers myself; read the static test; read @remotion/three | No `useFrame`, rAF, timers, `Date.now`, `performance.now` or `Math.random` (the only hit is a comment). `node_modules/@remotion/three/dist/esm/index.mjs:143` gives `frameloop: isRendering ? "never" : …`. The camera is set during render (`src/three/CameraRig.tsx`). |
| RN2 | P2 | Frames 0, 180 and 359 byte-identical across two renders | PASS | Two separate CLI `remotion still` runs, plus a third render through the Node API in a separately downloaded browser | f0 `ad6381b9…` ×3, f180 `7b099f8b…` ×3, f359 `0370bcc5…` ×3 (section 4). |
| RN3 | P2 | 1920×1080, 30 fps, H.264, 360 frames | PASS | `ffprobe -count_frames` | `h264, 1920x1080, yuv420p, avg_frame_rate 30/1, nb_read_frames 360, duration 12.000000`. |
| RN4 | P2 | 3D commands pass `--gl=angle`; config sets no GL | PASS | Read `package.json` and `remotion.config.ts` | `still:poc` and `render:poc` both carry `--gl=angle`. `remotion.config.ts` has no `setChromiumOpenGlRenderer`. CyclingVision stills with the default GL match the baselines (RG1). |
| RN5 | P2 | (a) Loaders gated; (b) frame 0 terrain drawn, no blank frame; (c) hold released after children mount | PASS | Read `src/data/Scene3DDataProvider.tsx`; viewed frame 0; luma scan of all 360 frames | (a) `delayRender` at :42, `cancelRender` on error at :69, `continueRender` in an effect at :78-79, `.ok` checked at :35. (b) `poc-f0.png` shows vertex-coloured terrain, trees, roads and the trail, with no default or white materials. Canvas-centre luma over 360 frames is **min 50.8 (f176), max 95.0**; whole-frame minimum 71.2; no frame below 20. (c) The `useEffect(() => { if (data) continueRender(handle) }, …)` pattern is in both providers. |
| RN6 | P2 | ≤ 2 s/frame, no timeout, ≤ 300 calls, ≤ 2 M triangles, logged | PASS | Timed the full render; counted timeout messages; read `renderer.info` through the Node API | 360 frames in 6 s wall time at concurrency 7 (about 0.017 s/frame); the slowest frame is 1.37 s (start-up). `was called but not cleared after` appears **0** times. All 7 frames report **55 calls, 1,150,462 triangles**. The numbers are logged at `docs/validation-3d.md:28`. |
| RN7 | P5 | 4K with `--scale 2` | NOT YET (P5) | — | — |
| TR1 | P2 | Width is one parameter, default 3.0 m, within 2.5–4.0; ATAG confirmed before P5 | PASS (P2 part) | Read `trail.ts:6`; read the test | `TRAIL_WIDTH_M = 3.0`. The test measures every ribbon vertex at 1.5 m ± 0.01 from the centreline. **ATAG 2021 confirmation is still open** (spec open item 4, register note "width not yet checked against ATAG 2021"); it is due before P5. |
| TR2 | P2 | Gradients derived from the profile; maximum reported | PASS | Recomputed the maximum gradient; read the test | check.mjs gives max **0.1192 at 9016 m**. `docs/validation-3d.md:24` reports "11.9 % over 5 m at km 9.015". The test compares each gradient with a central difference of the profile. The spec text still names `elevation-profile.json` although the source is now `trail-profile-poc.json` (D8). |
| TR3 | P4 | Crossings grounded | NOT YET (P4) | — | — |
| TR4 | P4 | Private sections not shown as accessible | NOT YET (P4) | — | — |
| C1 | P2 | Bounding box: height 1.5–1.9 m, length 1.6–1.9 m, wheel 0.62–0.72 m | **PARTIAL** | Computed the bounding box from the primitives in `src/three/CyclistView.tsx`; read the test | The model meets the criterion: helmet top at 0.159 + 0.009 units gives **1.68 m**; tyre outer radius 0.0323 × 1.055 gives **Ø 0.682 m**; wheels at ±0.0525 plus the tyre give **1.73 m** long. But `cyclist.test.ts:9-18` only checks the constants `ridingHeightM` and `lengthM` in `defaultCyclistDims()`, which the view never uses (grep finds no consumer). That half of the test is vacuous. See D2. |
| C2 | P2 | 12–25 km/h every frame; slower above +2 % than below −2 % | PASS | Recomputed on the real table; read the tests | check.mjs: **15.06–16.23 km/h**. `speedKmh(0.021) < speedKmh(-0.021)` is tested. |
| C3 | P2 | Lateral offset ≤ 1.0 m | PASS | Recomputed | max **0.50 m** |
| C4 | P2 | Wheel contacts within ±0.05 m of the surface | PASS | Recomputed through `wheelContacts` | max **0.00007 m**. In `poc-f200` and `crop-cyclist-f200.png` both tyres sit on the trail. |
| C5 | P2 | Yaw within 5°, pitch within 1° | PASS | Recomputed | yaw max ~0°, pitch max **0.062°** |
| C6 | P2 | Rolling without slip within 1 % | PASS | Recomputed | max slip about 1.6e-16 |
| C7 | P2 | Cadence 60–90 rpm, from the frame | PASS | Recomputed; read `cyclistMotion.ts:62` | **75 rpm** at every frame, from `crankAngle = 2π·(75/60)·f/fps`. |
| C8 | P2 | Model source, licence and attribution in the **asset register** | **PARTIAL** | Read `data/assets-3d.json` and ADR 0014 | `data/assets-3d.json` is `[]`. The cyclist appears only in the *feature* register (`source: original / procedural model`), with no licence or attribution text. ADR 0014 ("Register it as an original asset", scope `data/assets-3d.json`) was not carried out. The test (`poc-acceptance.test.ts:239-240`) checks the feature register instead. There is no licence risk, since the model is original. See D3. |
| C9 | P4 | Walkers | NOT YET (P4) | — | — |
| CA1 | P2 | Pose is a pure function of the frame | PASS | Recomputed every frame twice | identical poses; `buildPocScene` is pure |
| CA2 | P2 | Speed change ≤ ±10 % and angular velocity ≤ 30°/s outside the 0.5 s ramps | PASS | Recomputed both shots | max speed change **4.5 %**; max angular velocity **14.4°/s** |
| CA3 | P2 | ≥ 2 m above the rendered terrain; ≥ 1.5 m from the rider | PASS | Recomputed against `scene.heightAt`, which is the flattened ground (`poc.ts:67-74`) | min **3.17 m** above ground; min **8.67 m** from the rider |
| CA4 | P2 | FOV 35–60° | PASS | Recomputed | 45° at every frame |
| CA5 | P3 | Six reusable shot types | NOT YET (P3) | — | Two exist: `droneSideTrack` and `followShot`. |
| RG1 | P2 | CyclingVision stills = pre-3D baselines | PASS | Rendered frames 5, 1200, 2200 and 2900 with the default GL; sha256 against `tests/baselines/cyclingvision.json`; full 2D render | All 4 hashes are identical to the baseline (section 4). The full render (3150 frames, h264 1920×1080 30/1) has decoded MD5 **`adfca9a7f31577885e4ec84c1aca3f53`**, equal to the recorded pre-3D baseline. Provenance: the baselines were created at 09:53:36, when the only 3D source file was the type-only `src/three-core/types.ts` (09:47); all other 3D files date from 10:00 or later (file birth times). |
| RG2 | P2 | `tests/route.test.ts` unchanged and passes | PASS | sha256; file birth and modified times; test run | `027d815b…` matches `tests/baselines/route-test.sha256`. The file's birth and modified times are both 09:14:38, so it has never been edited. 6/6 pass. |
| RG3 | P2 | `npm run lint` passes | PASS | Ran it | exit 0 (`eslint src && tsc`) |
| RG4 | P2 | No hard-coded lat/lon in 3D source | PASS | Ran my own grep for decimals of 4 or more places in the 3D sources and the provider | The only hits are cyclist geometry constants and the shadow bias; no coordinates. |
| RG5 | P2 | One projection, imported from `src/data/route.ts` | PASS | Read `poc.ts`, `dem.ts` and the scene | World placement goes through `route.project` (`poc.ts:51`, `buildTerrainMesh(..., route.project, ...)`) and `useRouteData()`. `bng.ts` is a datum transform used only to index the DTM grid (D6), not a second world projection. |
| L1 | P2 | Every file in the 3D asset folder registered | PASS (trivially) | Listed `public/3d` | The folder does not exist and there are no 3D asset files, so the criterion holds vacuously; the test walks an empty set. |
| L2 | P2 | Map, DEM and model credits on screen in every 3D composition | PASS | Viewed every rendered frame; cropped the attribution | "Terrain: Welsh Government / NRW lidar DTM (OGL) · Map data © OpenStreetMap contributors (ODbL) · DEM- and OSM-derived, not survey-grade" is legible in every frame (`crop-attrib-f0.png`). The 3D composition uses no OpenTopoMap tiles and no third-party models (grep of 3D source finds no tile use). See D5 for the licence caveat. |
| P3-1 | P3 | Components used by ≥ 2 scenes | NOT YET (P3/P4) | — | one scene |
| P4-1 | P4 | ≥ 4 of 8 locations | NOT YET (P4) | — | one location |
| P5-1 | P5 | 90–120 s final video | NOT YET (P5) | — | — |
| P5-2 | P5 | One preview per scene in `out/previews/` | NOT YET (P5) | — | — |
| P5-3 | P5 | Complete docs | NOT YET (P5) | — | The 3D section of the README and `docs/sop-3d.md` exist for the POC. |

**Spec tally (50 rows):** PASS 35 · PARTIAL 3 (H3, C1, C8) · FAIL 0 · NOT YET 12 · CANNOT CHECK 0.

## 2a. Brief §12 acceptance criteria

| # | Criterion | Verdict | How I checked | Evidence |
|---|---|---|---|---|
| 1 | 3D route follows the verified railway alignment | PARTIAL (P2 scope met; other sections NOT YET, P4) | G1 recomputation | Exact for km 7.7–9.7 only. |
| 2 | Terrain from real elevation data | PASS | G2 | Lidar DTM; median 2.7 m and max 12.6 m against the route elevations. |
| 3 | Distinctive local features geographically credible | PARTIAL | Frames and registers | What is shown is sourced and plausible: OSM bridge 159029124, OSM roads, OSM woodland. But the section's landmarks are not identified on screen: neither the Maentwrog Road station site nor the A470 overbridge is labelled. The km 9.00–9.02 dip is an open gap. See D6. |
| 4 | Cyclists move naturally along the trail | PASS | C2–C7 recomputed; frames 150–359 viewed | 15–16 km/h, wheels on the surface, 75 rpm. The rider is low-poly but well proportioned. |
| 5 | Multiple identifiable sections | NOT YET (P4) | — | — |
| 6 | Three.js and Remotion work together reliably | PASS | 18 stills, 1 full render, Node API | No failures, timeouts or blank frames. Every Remotion command prints a zod "Version mismatch" notice, the expected effect of ADR 25's override; it caused no failure. |
| 7 | Deterministic and reproducible | PASS | RN2, RG1 | Byte-identical across 3 independent renders. Baselines reproduced exactly. |
| 8 | Distinguishes factual geography from proposed infrastructure | PASS | H1, H2 | Disclaimer, "proposed" label, distinct trail colour, register categories. |
| 9 | Existing functionality preserved | PASS | RG1, RG2, full 2D render | Decoded MD5 equals the baseline; 6/6 route tests pass. |
| 10 | Models and imagery comply with licensing | PARTIAL | Register and on-screen text | No third-party models or textures. OSM ODbL credited. But the **lidar DTM licence is unconfirmed**: `source-register.md:99` says "confirm before release" and one catalogue lists "Not Specified". The screen shows "(OGL)", not the OGL v3 attribution statement. The asset register is empty (C8). See D5. |
| 11 | Simple, reusable, maintainable | PARTIAL | Code read; line counts | Pure core with tests, no file over 500 lines, lint clean. Reuse across scenes is not shown yet (P3-1). Review item R9 (duplicated scale and normal helpers) is deferred to P3. |
| 12 | POC and final video rendered and visually reviewed | PARTIAL (POC PASS; final NOT YET, P5) | My renders and frame review | This report is the visual review of the POC. |

## 2b. Brief §11 deliverables (phase 2 view)

| # | Deliverable | Verdict | Evidence |
|---|---|---|---|
| 1 | Updated Three.js/Remotion project | PASS | `Poc3DMaentwrog` registered lazily in `src/Root.tsx` beside CyclingVision. |
| 2 | Verified GIS and elevation 3D route model | PARTIAL | One section, km 7.7–9.7. |
| 3 | Reusable terrain, trail, cyclist and camera components | NOT YET (P3) | They exist but serve one scene. |
| 4 | Rendered 10–15 s POC | PASS | `S/poc.mp4`, 12.000 s. |
| 5 | Multiple scenes | NOT YET (P4) | — |
| 6 | 90–120 s final video | NOT YET (P5) | — |
| 7 | Preview images | NOT YET (P5) | — |
| 8 | Evidence register | PARTIAL | `data/source-register.md` and `data/features-3d.json` cover the POC; gaps listed. |
| 9 | Performance and render results | PASS (POC) | `docs/validation-3d.md`, reproduced here. |
| 10 | Editing, preview and render instructions | PASS (POC) | README "3D work" section and `docs/sop-3d.md`. |

## 3. Mission-level criteria

| | Criterion | Verdict | How I checked | Evidence |
|---|---|---|---|---|
| a | Spec exists; every requirement has a testable criterion | PASS | Read all 50 rows | Each row has a criterion and a method (T/S/R/D/V). Wording defects: TR2 (D8), and C8 points at a register nobody fills (D3). |
| b | Design written down: modules, interfaces, decisions | PASS | Read `docs/design-3d.md` and `docs/adr/` | Design D1–D21 with an interface block that `tests/docs.test.ts` keeps in step with the exports (passes); 26 ADRs; `docs/pseudocode-3d.md`; `docs/sop-3d.md`. Caveat: all 26 ADRs are still "Proposed", and the checklist item "ADRs 1–25 accepted…" is pending (D9). |
| c | Whole suite passes, including the new tests | PASS | `npx vitest run --reporter=verbose` | 15 files, 90/90. The new 3D tests are not vacuous except where noted (C1, L1). |
| d | Build and CI checks pass | PASS (locally) | Ran every non-mutating `run` step of `.github/workflows/ci.yml`; bundled into scratch | lint 0 · tests 90/90 · audit 0 vulnerabilities, exit 0 · bng.py self-test pass · py_compile pass · bundle exit 0. Not run: `npm ci` and `pip install` (forbidden). The hosted workflow has never run (no remote), so a run on ubuntu-24.04 is CANNOT CHECK. |
| e | Every acceptance criterion checked by a non-author | PASS for P2 (through this report) | This report | Every P2 row was checked independently above. `docs/validation-3d.md`'s review checklist (lines 9-20) still says "pending" for H2c, H3, H4, RN5b and L2; it should be filled from this report (D10). |
| f | Prior art, ADRs and memory searched; reuse recorded | PASS | Read `docs/prior-art-3d.md` | Reusable code and data tables; the ADRs, ruflo memory and Claude memory searched are listed; missing items enumerated. |
| g | Outcome stored as patterns | PARTIAL | `memory_list` and `memory_search` in namespace `patterns` | 11 keys under `ffestiniog-bikeride/3d-upgrade/`: t1-prior-art, t3-design, t4-adrs-sop, t6-failing-tests, t7-build, t8-benchmark, t9-security-review, t10-review, t11-full-suite, t12-ci, t13-docs. **None for t2 (spec) or t5, and no mission-outcome or validation entry yet** (D7). |
| h | Review findings resolved or explicitly accepted | PASS | Read the t9 and t10 tables; spot-checked 11 claimed fixes in code | F1: zod override in `package.json`; audit 0. F3: `.swarm/`, `ruvector.db`, `agentdb.rvf*` in `.gitignore:18-21`. F4: `dataFileName`/`expectGridBytes` used at `Scene3DDataProvider.tsx:52-54`, with tests. R1: `.ok` and `cancelRender` in `RouteDataProvider.tsx:9,33`. R2: `OverlayLog` queries `[data-overlay]` (`PocMaentwrog.tsx:82`). R5: `heightAt` is the flattened ground (`poc.ts:67-74`). R6: `interpolate_spans` clips spans (`build_poc_data.py:43-52`). R7: "no terrain" throw at `camera.ts:104`, tested. R8: validators used at `Scene3DDataProvider.tsx:49-65`. R11: three-vertex cross-sections (`roads.ts:61,73`). Every finding has a disposition. F2, F5, F6, F7, R9 and R10 are "Accepted". F2's "accepted by the project owner" is recorded, but I cannot verify the owner's consent from the files. |

## 4. Defects found

Severity: **M** = a criterion is not fully met; **L** = test or doc quality.

- **D1 (M), H3: the closing caption is too brief to read.** It runs for frames 300–359 through `Label`'s 15-frame fades, so it is at full opacity only on frames 315–345 (1.0 s). It is invisible at frame 300 and almost gone (opacity about 0.07) on the last frame, 359. A 20-word sentence needs about 5–7 s.
  - *To pass:* the caption is at full opacity for at least 5 s and is fully visible on the last frame. For example, start it around frame 200 with no fade-out, or extend the POC to 15 s (still within the brief). Add a still or opacity check at frames 330 and 359.
- **D2 (L), C1: half of the test is vacuous.** `cyclist.test.ts` checks `ridingHeightM` and `lengthM`, but `CyclistView.tsx` hard-codes the body points and never reads them. The model does meet C1 (1.68 m × 1.73 m, wheel Ø 0.682 m, by my calculation).
  - *To pass:* move the bike and rider points into a pure `three-core` builder used by the view, and test its computed bounding box. Or derive the view from `dims`.
- **D3 (L/M), C8 and ADR 0014: the cyclist is not in the asset register.** `data/assets-3d.json` is `[]`, so the cyclist's source, licence and attribution are not there, contrary to C8 and ADR 0014's decision. The test checks the feature register instead.
  - *To pass:* add an `original` entry (source, licence, attribution text) to `assets-3d.json` and test it there. Or amend C8 and ADR 0014 to say the feature register is authoritative for procedural assets.
- **D4 (L), H2a/L2/G3 render check: it tests DOM presence, not visibility.** `scripts/render-checks.mjs` passes if the overlay ids exist in the DOM. For example, `closing` is logged at frame 300, where its opacity is 0. The disclaimer and attribution are in fact visible (I checked by eye), but an opacity-0 disclaimer would pass the automated check.
  - *To pass:* the check also requires the computed opacity of each required overlay to be ≥ 0.9.
- **D5 (M for release, L for P2), licensing (brief §12 #10):** the lidar DTM licence is still "to confirm" in the DEM header and in `source-register.md:99,107`. On screen it says "(OGL)", not the OGL v3 attribution statement or any statement the provider requires.
  - *To pass:* confirm the licence from the DataMapWales layer metadata and record the date and URL in the register. Show the required attribution wording before any publication.
- **D6 (L), §12 #3:** the section's landmarks are not identified on screen (Maentwrog Road station site, A470 overbridge), and the km 9.00–9.02 dip or crossing is unexplained.
  - *To pass:* label at least one sourced landmark in the section, and resolve the dip against imagery or Coflein, or keep it listed as approximate.
- **D7 (L), mission (g):** there are no `patterns` entries for t2 or t5, and no entry for the mission outcome or this validation.
  - *To pass:* store them under `ffestiniog-bikeride/3d-upgrade/`.
- **D8 (L), spec TR2 wording:** it still says gradients come from `elevation-profile.json`. G4 was amended (D7) to `trail-profile-poc.json`, but TR2 was not, although the code and test follow the amended source.
  - *To pass:* amend TR2 like G4.
- **D9 (L), ADRs:** all 26 are "Proposed", and the checklist item asks for ADRs 1–25 to be accepted or rejected (there are 26). The ADR README says "D1–D20", but the design goes to D21. ADR 0014 says "rider 1.75 m", while design D12 gives riding height 1.70 m and length 1.75 m.
  - *To pass:* record a status decision for each ADR and align the numbers.
- **D10 (L):** the review checklist in `docs/validation-3d.md` still says "pending" for H2c, H3, H4, RN5b and L2.
  - *To pass:* fill it in from this report, with H3 marked as failing until D1 is fixed.
- **D11 (L), hygiene:** `__pycache__` is not git-ignored. The CI compile step writes `.pyc` files into `scripts/**/__pycache__`. `-I` implies `-E`, so `PYTHONPYCACHEPREFIX` is ignored.
  - *To pass:* add `__pycache__/` to `.gitignore`.

## 5. Frames and videos rendered (all under S)

POC stills were rendered with `remotion still … --gl=angle --port=3519`. `-b` marks the second, independent render. `diag-*` came through the Node API with `diagnostics: true`. CV stills used the default GL.

| File | sha256 |
|---|---|
| frames/poc-f0.png | ad6381b9b2d5702efd69f13d25f59751f0a679b7f1011f7c99177926a4b2f610 |
| frames/poc-f0-b.png | ad6381b9b2d5702efd69f13d25f59751f0a679b7f1011f7c99177926a4b2f610 |
| frames/diag-f0.png | ad6381b9b2d5702efd69f13d25f59751f0a679b7f1011f7c99177926a4b2f610 |
| frames/poc-f15.png | ceb0175dd40e41fd5c33d0e8465329d60359748a6280734ccd04992c5c932e55 |
| frames/poc-f60.png | d464df796b4b51d76a8cb5d116f0f97d7a671a2adee864e76117c69b43c5e03b |
| frames/diag-f60.png | d464df796b4b51d76a8cb5d116f0f97d7a671a2adee864e76117c69b43c5e03b |
| frames/poc-f150.png | 1a443d5907518f996bafaaea2ce393c9c4471cc9402ec183fef3d106df843c0d |
| frames/diag-f150.png | 1a443d5907518f996bafaaea2ce393c9c4471cc9402ec183fef3d106df843c0d |
| frames/poc-f180.png | 7b099f8b04877f7ff4df19dde6f374bf052e189f682ee1365a10b3c781a3aaaa |
| frames/poc-f180-b.png | 7b099f8b04877f7ff4df19dde6f374bf052e189f682ee1365a10b3c781a3aaaa |
| frames/diag-f180.png | 7b099f8b04877f7ff4df19dde6f374bf052e189f682ee1365a10b3c781a3aaaa |
| frames/poc-f200.png | f082b7108e4cff502ad45e364f980f7a866c43f4203c8f6b11bc29fca64bffab |
| frames/diag-f200.png | f082b7108e4cff502ad45e364f980f7a866c43f4203c8f6b11bc29fca64bffab |
| frames/poc-f300.png | 844f5a777197c8f45abb8a7959d7ca206916f77113b7aba07b9116236756fa49 |
| frames/diag-f300.png | 844f5a777197c8f45abb8a7959d7ca206916f77113b7aba07b9116236756fa49 |
| frames/poc-f330.png | e499dc38a856e6b91d3dfbd104a5fdb5d3293b1ca6719914501d6a124b7bc829 |
| frames/poc-f359.png | 0370bcc5312ff41c470089b7ef07f108da66dc474f29545fe0931a2afed374c8 |
| frames/poc-f359-b.png | 0370bcc5312ff41c470089b7ef07f108da66dc474f29545fe0931a2afed374c8 |
| frames/diag-f359.png | 0370bcc5312ff41c470089b7ef07f108da66dc474f29545fe0931a2afed374c8 |
| frames/cv-f5.png | 58417edab66d8baeab0e2d5c2d51967bb58a4b23eaa2c2b1bbf24ebcb768065f (= baseline) |
| frames/cv-f1200.png | c51dab24b5a8b3cdccafa85928842bf19adac17b2a00834de056f5a9bde731e8 (= baseline) |
| frames/cv-f2200.png | 6a9065e54e643f45a20fbd4e391b9f3b854cfeeb10f283b58e8cd3897b654488 (= baseline) |
| frames/cv-f2900.png | 1a09fe9ea413ab44a622901dd7741960b8e1b3b94cb8f07e65922741dca3da58 (= baseline) |
| poc.mp4 (360 frames) | dc4049e4baf979603a0827d033f8049efaa7f5197f4a7360207ec69b43723dab |
| cv-full.mp4 (3150 frames; decoded MD5 adfca9a7f31577885e4ec84c1aca3f53) | 5af263da50183c7b70a11d02f4dfc489501d6781171294a65be0d2769feb8969 |

The crops used for the legibility checks are `crop-attrib-f0.png`, `crop-labels-f15.png`, `crop-closing-f330.png`, `crop-closing-f359.png` and `crop-cyclist-f200.png`; their hashes are in `S/frames.sha256`.

## 6. Side effects of this validation (disclosed)

1. **Python bytecode rewritten in the project.** `python3 -I -m py_compile` (CI step) rewrote 4 existing `.pyc` files: `scripts/__pycache__/build_poc_data.cpython-313.pyc`, `scripts/dem/__pycache__/{bng,cog}.cpython-313.pyc` and `scripts/osm/__pycache__/fetch_bbox.cpython-313.pyc`. I had set `PYTHONPYCACHEPREFIX`, but `-I` ignores it. The directories already existed (created 10:05 and 12:06). The files are bytecode regenerated from unchanged sources, and they are untracked. No source, doc, data or config file was changed, and `git status --porcelain` was identical before and after.
2. **Network use.**
   - My Node API diagnostics script resolved Remotion's browser cache from the scratch directory, and so downloaded Chrome Headless Shell 157.0.8080.0 (171 MB) from remotion.media into `S/.remotion`. This is the same version as the project's own copy. I deleted it afterwards. It was unintended and goes against the "no network fetches" constraint.
   - `npm audit` contacts the npm registry; the brief listed it as a check to run.
3. Every Remotion command used port 3519. Port 3000 was not touched.

## Re-check after fixes

**When and how:** 2026-10-25, 12:41–12:43 GMT, same validator. I made no project edits and used no network. I did not run `npm audit` or `py_compile`. Outputs are in `S/recheck/`, and every Remotion command used port 3519.

**No side effects:**
- `git status --porcelain` was identical before and after.
- No `.pyc` was written: 0 files newer than the start of the run.
- No browser was downloaded. The Node API run (`S/recheck/overlays.mjs`) used the project's own Chrome, `node_modules/.remotion/chrome-headless-shell/…/chrome-headless-shell`, through `browserExecutable`, with an `onBrowserDownload` hook that throws. It never fired, and there is no `.remotion` folder under `S/recheck`.

**Gates:**
- `npx vitest run`: 15 files, **90/90 pass**, exit 0.
- `npm run lint`: exit 0.
- `npx vitest run tests/three-core/poc-acceptance.test.ts --reporter=verbose`: 12/12 pass, including "L1/C8 … the cyclist is an original".
- RG1 still holds after the changes: CyclingVision frames 5, 1200, 2200 and 2900 all match `tests/baselines/cyclingvision.json`.

| Item | Verdict | Evidence |
|---|---|---|
| **H3** (D1) | **PASS** (was PARTIAL) | **Code:** `src/scenes3d/PocMaentwrog.tsx` sets `CLOSING_FROM = 195` and the duration to `POC.frames − 195 + 15 = 180`. `useFade(180)` maps [0, 15, 165, 180] to [0, 1, 1, 0], so opacity is 1 for frames 210–359 and the fade-out would start only after the last frame. **Frames:** `recheck/frames/poc-f210.png`, `poc-f300.png` and `poc-f359.png` show the full caption at top left: "Concept only. The line is mothballed and heritage-railway restoration has been proposed; this is not an approved route." It is legible at 28 px on its own dark box. The box spans x 80–840 and y 64–205; the rider is at x ≈ 1000–1080, y ≈ 545–840, so they don't overlap. **Pixels:** caption-colour text pixels in the box number 0 at f195, 7305 at f210, 7405 at f300 and 7405 at f359. **Logged overlays:** `closing` is absent at 195 and 200 (fading in) and present at 210, 300 and 359. Full visibility therefore lasts frames 210–359 = 150 frames = **5.0 s**, exactly the minimum, and includes the last frame. |
| **C8** (D3) | **PASS** (was PARTIAL) | `data/assets-3d.json` holds one entry: `path` `src/three/CyclistView.tsx`, `kind` model, a `source` naming the original procedural model and ADR 14, `licence` "Original work of this project; no third-party licence applies", `attribution` "None required (original work)". `public/data/assets-3d.json` is byte-identical (`cmp`). `validateAssets` requires non-empty source, licence and attribution. The test now asserts the entry exists, with kind model and an original source; it passes. |
| **D4** (overlay check) | **RESOLVED for the failure found; residual gaps, low** | **Code:** `OverlayLog` keeps an overlay only if its box is non-empty and its effective opacity, multiplied up the parent chain, is ≥ 0.9. For `display: contents` wrappers it judges the first child. `scripts/render-checks.mjs:114-137` requires `disclaimer` and `attribution` at frames 0, 45, 180 and 359; `proposed-label` and `section-title` at 45; and `closing` at 359. **Reproduced through the Node API, no network:** f0 `["disclaimer","attribution"]` (the fading labels are now correctly left out; before the fix they were logged); f15 and f45 add `section-title` and `proposed-label`; f180, f195 and f200 have only `disclaimer` and `attribution`; **f300 and f359 `["disclaimer","closing","attribution"]`**. THREE_STATS is unchanged at 55 calls and 1,150,462 triangles. **Can it still pass with an invisible required overlay?** Yes, in cases it does not test: (1) `visibility: hidden` or transparent text colour; (2) a box placed outside the 1920×1080 viewport, because the rect is not intersected with it; (3) an overlay covered by another element; (4) opacity set on a descendant below the first child. None applies to the current code. Also, `closing` is required only at frame 359, so the 5 s duration in H3 is not enforced automatically; adding frame 210 to `expectAt` would enforce it. |
| **D8** (spec TR2) | **RESOLVED** | `docs/spec-3d.md:80` now reads "derived from the trail profile, `trail-profile-poc.json` (the lidar DTM along the centreline, as G4 was amended)". That matches the code and the TR2 test. |
| **D9** (ADR index and ADR 0014) | **RESOLVED; one nit** | `docs/adr/README.md:5-8` now maps D1–D20 to their records, D21 to ADR 23, D22 to the design only, and ADRs 24–26 to t8, t9 and t12. It states that all records stay "Proposed" until the owner decides; 26/26 are Proposed, and the index has 26 rows for 26 files. ADR 0014 line 17 now gives wheel 0.68 m, wheelbase 1.05 m, riding height 1.70 m and overall length 1.75 m, the same as design D12, and records the t14 registration. Nit: `docs/validation-3d.md:20` still says "ADRs 1–25" although there are 26. |
| **D11** (`__pycache__`) | **RESOLVED** | `.gitignore:11` reads `__pycache__/`. `git check-ignore -v` matches `scripts/__pycache__/build_poc_data.cpython-313.pyc` and `scripts/dem/__pycache__/bng.cpython-313.pyc`. |

**Determinism after the change:** CLI and Node API renders of frames 195, 210, 300 and 359 are byte-identical. Frames 0, 15 and 180 are byte-identical to the first run (`ad6381b9…`, `ceb0175d…`, `7b099f8b…`), so the fix changed nothing before frame 195.

**Re-check frames** (`S/recheck/frames/`, sha256):

| File | sha256 |
|---|---|
| poc-f195.png = diag-f195.png | e4dc08e56be04e072c7a34f7f91edc00980c2b3aa711206dc5a53dbddff81fef |
| poc-f210.png = diag-f210.png | 7beeabe46565c84ef2edacc29e02798c17d719d158a69dd3bf4e67c2df9f9937 |
| poc-f300.png = diag-f300.png | 73ffa82a3a41329326e46c6dfb2c9fee1e690eb7f8027c34911b4a08ef0baba3 |
| poc-f359.png = diag-f359.png | 1ffb12e0c7c6bf61ed5a82a4225c09f26a82a6226aee0cd19c8a1f32301faead |
| diag-f0.png | ad6381b9b2d5702efd69f13d25f59751f0a679b7f1011f7c99177926a4b2f610 |
| diag-f15.png | ceb0175dd40e41fd5c33d0e8465329d60359748a6280734ccd04992c5c932e55 |
| diag-f45.png | 20fd78eeca30d38e228187337708ba7676662287b73814359b9a5d4d26e15210 |
| diag-f180.png | 7b099f8b04877f7ff4df19dde6f374bf052e189f682ee1365a10b3c781a3aaaa |
| diag-f200.png | 758025f4e6faf61540d044ce0cc68c0e226d70b4ae43df7f34e2bac306d3c97c |
| cv-f5, cv-f1200, cv-f2200, cv-f2900 | same as the baselines (see section 5) |

**Updated spec tally (50 rows):** PASS 37 · PARTIAL 1 (C1, test weakness D2, not in this fix set) · FAIL 0 · NOT YET 12 · CANNOT CHECK 0.

**Still open from the first run:**
- D2: the C1 test.
- D5: the lidar licence confirmation and the OGL wording.
- D6: no landmarks labelled on screen.
- D7: memory entries for t2, t5 and the outcome.
- D10: the validation checklist still says "pending".
- The new D4 residual gaps above.
