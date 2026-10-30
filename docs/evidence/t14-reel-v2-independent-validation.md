# t14 independent validation: water, readiness, clarity and buildings (reel v2)

Mission `msn_33e838999675db739df3c922`, task t14. Validator: independent `production-validator` agent, not the author of
any of the work under review. Date: 2026-10-26 (00:54–01:32 UTC).

| Item | Value |
|---|---|
| git HEAD | `bb9c0391c2b77b704c181bcadd6ca3abf1c58c33` (branch `mission/3d-reel`; no commit, stash or reset since: `git reflog`, `git stash list` empty) |
| Snapshot under test (`scripts/snapshot.mjs`) | tree `4727b412fb422c5bef07484180d5e142ebb09aed`, dirty, 180 untracked, untracked sha256 `a288e61124ab…`; identical at 00:54:53Z, 00:55:47Z and at the end of the render checks (01:13:41Z) |
| After the render checks | tree `490029aeb681…`: the only change is the table `npm run test:render` appends to `docs/validation-3d.md` (`find -newer` lists no other file) |
| Environment | darwin arm64, Node v24.13.1, Remotion 4.0.538, Chromium 157.0.8080.0, `--gl=angle`, scale 1 |
| Machine | very busy: other agents rendered at the same time; load average 17–100 during my runs |
| My scratch folder | `/private/tmp/claude-501/-Users-eray-ffestiniog-bikeride/bb3f26c8-7af5-483b-b78b-7ff809bf3730/scratchpad/t14/` (below: `$S`) |

## 1. Commands and key output

| # | Command | Key output |
|---|---|---|
| 1 | `npx vitest run` (and `--reporter=verbose`) | `Test Files 37 passed (37)`, `Tests 260 passed / 2 expected fail (262)`; the 2 are RL8 `it.fails` for vale-south and trawsfynydd (earlier iteration, `tests/three-core/section-acceptance.test.ts:33`) |
| 2 | `npm run lint` | `eslint src && tsc`, exit 0 |
| 3 | `npm run build -- --out-dir=$S/bundle --log=error` | exit 0; the known zod 4.6.7 vs 4.5.4 warning (ADR 25) |
| 4 | `python3 -I scripts/build_section_data.py --self-test`, `build_buildings.py --self-test`, `still_metrics.py --self-test` | `self-test: ok` three times |
| 5 | CI step: `python3 -I scripts/dem/bng.py`; `py_compile` of the 7 pipeline scripts (bytecode written to `$S`) | `bng.py self-test passed`; `py_compile ok 7` |
| 6 | `npm audit --audit-level=high --offline` | `found 0 vulnerabilities` (offline, so not conclusive; `npm ci` and the online audit need network and were not repeated: t12 evidence relied on) |
| 7 | `REMOTION_PORT=3573 npm run test:render` | 1,070 s; **exit 1**: 24 pass, **X1 FAIL** (`decoded md5 5972923116fc10aebfc3f2031ec3ba3a`); table appended to `docs/validation-3d.md` ("Render checks 2026-10-26T01:13:41.011Z"); `out/after` re-rendered on `4727b412fb42` |
| 8 | Fault injection: `$S/fault/run.sh` copies my bundle, breaks one asset, renders one still | 6 of 6 cancel with an `AssetLoadError` naming section and path (RD5 below) |
| 9 | `npx remotion still $S/bundle Reel3D … --frame=1923/2200/2398 --gl=angle --port=3561` (fresh processes) | centre luma 47.0, 65.8, 74.1; complete frames |
| 10 | `npx remotion render src/index.ts CyclingVision $S/cv/cv_run2.mp4`; HEAD exported with `git archive HEAD` into `$S/head` and rendered the same way (twice); framemd5 against `out/cycling-vision.mp4` | see X1 below: the 2D output varies with machine load, for HEAD's code as well |
| 11 | `$S/ts/bl5.ts`, `$S/ts/station.ts`, `$S/ts/station2.ts` (esbuild-bundled, read-only on repo data) | building bases and eaves; power-station visibility (BL1, BL5 below) |
| 12 | `$S/cl2.py`, crops in `$S/viz/` | independent CL2/CL3 numbers; 100 % shoreline, tree and parapet crops |
| 13 | `git diff --quiet HEAD -- tests/baselines`; `git ls-files --others -- tests/baselines` | no change, no new file |
| 14 | ruflo `memory_list` (namespace `patterns`); `aidefence_scan` / `aidefence_has_pii` on `data/landmarks.json` text | keys `ffestiniog-bikeride/3d-reel-v2/{goal-full,t1…t13}` present, no outcome entry; scan `safe: true`, no PII |

Render-check table of my run (abridged): RG1 4 frames match · RN2/RN3/RN5b/RN6 pass (POC 0.03 s/frame, 65 calls, 1.10 M tris) ·
RL1/RL24 2,700 frames in 62 s · RL26/RL27 luma 45.9–168.3 · RL23 deterministic · RL24/BL12 worst frame 2399: 64 calls,
1,937,530 tris · RL10 · RL32 · CL9/CL10 80 boxes at 24 frames, max 2 lines · RD6 16 `MAP_DRAPE` lines, all 0 missing ·
RD1/RD2 43 fresh stills pass · **X1 FAIL** · X2 pass · CL1 139 after stills on `4727b412fb42`, 7 environment fields equal ·
WA6 100.0 % at trawsfynydd 60 and 200; WA7 specks ≤ 0.11 % at 3 frames · CL2 ×1.91–×3.72, CL3 max 9.5 % · CL4 ΔE ≥ 25.6
(terrain), ≥ 42.0 (roads) · CL6 hue 2.0 %, saturation 10.9 % · BL13 "no landmark is listed".

## 2. Requirement verdicts

Method codes as in the spec: T test, R render check, S static, D document, V visual review.

| ID | Verdict | Method used | Evidence |
|---|---|---|---|
| WA1 | PASS | T, R, V | `tests/water-geometry.test.ts` (both windings; every lake of the 5 ground windows) pass. `src/three/WaterView.tsx`: `MeshStandardMaterial`, `FrontSide`, `computeVertexNormals` after upward winding. WA6 `meanDiff > 8` (lit). `trawsfynydd_60.png` before vs after: flat terrain-coloured lake → lit, rippled surface. |
| WA2 | PASS | T | `water-geometry.test.ts` "leaves the island open" (area 96 ± 1 %, no centroid in the island) and real Llyn Trawsfynydd (> 100 triangles, none facing down). |
| WA3 | PASS | T | `tests/three-core/water-holes.test.ts` (geometry holes = `inner_rings`; Polygon = one-part MultiPolygon; hole to the right part); `build_section_data.py --self-test` ok. |
| WA4 | PASS | T (amended spec) | `tests/pipeline-python.test.ts` real-data test passes: no island cell filled; islands ≥ 1,000 m² clear of 197.26 m + 0.5 m. Seven awash islets are the t7 amendment. |
| WA5 | PASS | T | `water-holes.test.ts`: relation 3084421 same level (197.26 m, `data/water-levels.json`) and same island count in trawsfynydd and maentwrog; my `bl5.ts` run also gives 22 islands in both windows. |
| WA6 | PASS | R | Render checks: coverage 100.0 % at trawsfynydd_60 and _200, `meanDiff` > 8. |
| WA7 | PASS | R, T, V | Specks ≤ 0.11 % at frames 60, 61, 200; `tests/three-core/water-terrain.test.ts` (5 windows) passes; my 100 % crops `$S/viz/tr60_shore_after.png`, `tr60_61_shore.png`: continuous shore, islands drawn in terrain colours, no speck or flicker between frames 60 and 61. Surface uses `polygonOffset` (−2, −2), no lift. |
| RD1 | PASS | R | 43 fresh-process stills (first, middle, last of 9 sections; both sides of 8 cuts): centre luma ≥ 20, ≥ 4 bins. |
| RD2 | PASS | R | As RD1, plus RL26/RL27 full-reel scan (2,700 frames, min luma 45.9) and my cold stills at reel 1923, 2200, 2398 (luma 47.0, 65.8, 74.1). |
| RD3 | PASS | T | `tests/load-gate.test.ts` (new hold before old release, stale data cleared) and `tests/load-gate-hook.test.ts` (hook in a mocked React runtime: new key never returns old data; StrictMode re-run). Code read: `src/data/loadGate.ts:39-71`, `:91-112`. |
| RD4 | PASS | T | `load-gate.test.ts` RD4 cases: superseded settle, failure after unmount, abort: no data, no `cancelRender`. |
| RD5 | PASS | T, my fault injection | Gate test passes. Rendered from a broken bundle copy: `section maentwrog: data/sections/maentwrog/buildings.json: HTTP 404`; `section intro: maps/tiles/15/16023/10674.png: failed to load`; `section overview: data/tiles-manifest.json: …tiles[0].path: expected a relative image path`; `section trawsfynydd: data/water-levels.json: HTTP 404`; `section route: data/railway-route.geojson: HTTP 404`; `section blaenau: data/sections/blaenau/dem.f32: … expected 980288 bytes … got 1000` (logs `$S/fault/*.log`). |
| RD6 | PASS | R | 16 `MAP_DRAPE` lines, all `missing 0`. |
| RD7 | PARTIAL | D, code read | Recorded in `docs/validation-3d.md` (t6, t7). But the t6 "failing first" load-gate tests failed only because `src/data/loadGate.ts is not implemented yet` (`docs/evidence/t6-reel-v2-failing-tests.log:88-168`); no test reproduced the old providers' faults. Those faults rest on the recorded inspection (`docs/prior-art-3d.md` §B), which the spec's decision row allows. The provider tests (`load-gate.test.ts:182-198`) are source-string checks. The render-time hold fix does have a genuine failing-first test. |
| CL1 | PASS | D, R | CL1 pass on `4727b412fb42`; 7 environment fields equal. The 15 normal stills in `out/before-masks` are byte-identical (sha256) to `out/before` (tree `984a1b50`, 20:18Z, after t6's tests and before t7's code at 22:00Z), so adding the masks did not change the before images. |
| CL2 | PARTIAL | R, V | R passes (×1.91–×3.72). My numbers (`$S/cl2.py`): shade-side median luma 3.9–4.6 → 8.0–17.2 of 255. In `vale-north_135` the three foreground conifers measure median and p90 luma 8.0: flat black silhouettes with no readable form. The CL2/CL3 conflict is author-accepted and left to the spec owner (`docs/validation-3d.md:141`, t10 last row); the spec was not amended. |
| CL3 | PASS | R | Max change 9.5 % (maentwrog_150: my figure 49.3 → 54.0), 0 % clipped in all 11 ground stills. |
| CL4 | PASS | R, V | Min ΔE 25.6 (terrain) and 42.0 (roads) in 11 stills; the buff trail is the most distinct element in every ground still. Note: in the aerial scenes the trail is a thin buff line beside the orange A470 and the map's own track symbol (`out/previews/intro.png`, `closing.png`); the spec measures ground stills only. |
| CL5 | PASS | T, V | `tests/three-core/occlusion.test.ts`: 0 blocked frames in 5 sections (drawn crown shapes). In all 11 ground stills and my reel stills the rider is unobstructed. In the drone-side frames the rider is 5–10 px tall: framing, not occlusion. |
| CL6 | PARTIAL | S, R, V | S: `static-3d.test.ts` "CL6 Lighting takes its values from LIGHTING" passes. R: hue 2.0 %, saturation 10.9 %. V: the aerial scenes still read as a flat, bright lime topographic map (`out/previews/intro.png`, `overview.png`), the ground scenes as olive shaded 3D terrain; light and sky match, the look does not. |
| CL7 | PARTIAL | T, V | T: `tests/three-core/positions.test.ts` passes, but it compares source ref, category and km range, not coordinates. V: bridges are hatched and the legend names it; but buildings (155 of 156 `approximate`), roads (1,056 `approximate`) and water carry no on-screen mark beyond the attribution's "not survey-grade"; the reel never labels the trail "proposed" (only the badge says "not an approved route"); RL9's steep-stretch gaps are still "not yet labelled on screen" (`docs/spec-3d.md:195`). |
| CL8 | PASS | T, V | `tests/reel-captions.test.ts` passes. My pace table: every caption ≤ 15.0 characters/s (vale-title, concept-card and POC proposed-label exactly 15.0). Meaning kept: heritage, live station, private home, decommissioning, badge and closing card. |
| CL9 | PASS | R, S | 80 boxes at 24 frames inside 96/54 px; `SAFE = {x: 96, y: 54}`. Confirmed in every still viewed. |
| CL10 | PASS | R, S | Max 2 lines; `CaptionBox` sets `hyphens: none`, `overflowWrap: normal` (`src/three/Overlays.tsx:49`). No broken word seen. |
| CL11 | PASS | T | `tests/overlays.test.ts` CL11 (worst case over black and white ≥ 4.5:1). |
| CL12 | PASS | S | Caption 28 px; badge, attribution, legend 18 px. Legible at half size (`$S/viz/vs_half.png`). |
| CL13 | N/A | V | Not built (optional). Place captions plus the aerial map give enough orientation; I do not ask for a locator. |
| CL14 | PASS | S, V | `static-3d.test.ts` CL14 passes; `data/assets-3d.json` lists one asset (the procedural cyclist). New textures are procedural `DataTexture`s (ripple, hatch); the drape tiles predate this mission (ADR 33). |
| BL1 | PARTIAL | T, my check | Tests pass (`buildings-real.test.ts` "candidates at measured heights", `visibility.test.ts`). But candidates come only from each window's `osm.geojson`. Trawsfynydd power station's reactor halls (OSM ways 289033763 and 289033764, about 54 m) lie just outside the maentwrog window yet are inside the Maentwrog follow shot's frustum and above the bare-earth terrain line in frames 180–359, 1.2–1.3 km away and 64–68 px tall (`$S/ts/station2.out`; screen x ≈ 1430–1630, y ≈ 275–341 at frame 240). They are not listed or drawn. The t7 record checked only the Trawsfynydd shots (`docs/validation-3d.md:159`). Real woodland may hide them; that is unverified. |
| BL2 | PASS | T | `tests/registers-buildings.test.ts` BL2 cases; every real building entry has urls, evidence, `observedAt`, `retrievedAt`, licence, confidence, status. |
| BL3 | PASS | T | Planning evidence alone is rejected for `existing`; all 156 drawn buildings are `existing` with map or lidar evidence. |
| BL4 | PARTIAL | T, D | The 3-year and calendar rules are tested and hold. The first clause ("no register text or caption calls a feature current beyond its `observedAt`") has no check. Captions "still a live station" and "now a private home" carry no dated observation. `observedAt` is the OSM edit date (2013–2026); the lidar DSM's survey date is unknown (design K16). |
| BL5 | PASS | T, my check | Synthetic tests pass. My `bl5.ts` on real data: at every footprint vertex the wall reaches the DTM. Between the 2 m samples, one wall foot floats 0.22 m (`building-blaenau-372451116`), two by 5–6 cm. The real-data "BL5" test only checks finiteness and holds dead code (`tests/three-core/buildings-real.test.ts:101-114`). |
| BL6 | PASS | T | `build_buildings.py --self-test` ok; 150 `lidar-dsm`, 6 `default` heights. Note: 13 buildings are drawn 0.2–2.2 m taller than recorded on slopes, because eaves stay ≥ 2 m above the highest ground (`src/three-core/buildings.ts:137`). |
| BL7 | PASS | T (amended spec) | `buildings-real.test.ts` BL7: only the listed trackbed building `289033748` crosses the trail; no road crosses. |
| BL8 | PASS | T, my check | Overlap test passes. The "duplicates a structure" clause has no test; my check finds no building footprint crossed by any bridge or overbridge way registered in the 5 ground windows (36 window-way checks), and no building typed as a bridge. |
| BL9 | NOT YET | T, V | No featured landmark is drawn (`data/landmarks.json`: Capel Utica `featured: false`). Only the synthetic church test exists. Nothing to review. |
| BL10 | PASS | T, R | ≤ 3 groups per section (test); worst frame 64 calls. |
| BL11 | PASS | T | `dataPaths(section).buildings`; fault f1 names `data/sections/maentwrog/buildings.json`. |
| BL12 | PASS | R | Worst frame 2399: 64 calls, 1,937,530 tris; reel 0.023 s/frame; no new texture assets. |
| BL13 | NOT YET | R, V | `scripts/render-checks.mjs:384` passes only because no landmark is listed. See BL1: the reactor halls would meet the 40 px rule in the Maentwrog shot. |
| BL14 | PASS | T | Translucent group and legend line tested (`buildings.test.ts`, `overlays.test.ts`); no approved or demolished building exists, so V is not applicable. |
| BL15 | PASS | T, V | `buildings-real.test.ts` credits test; on-screen credit names the lidar DTM and DSM (OGL), OSM (ODbL) and OpenTopoMap (CC-BY-SA) in every still. |
| BL16 | PASS | T | Every drawn id resolves to an `osm` register entry with URLs (5 sections). |
| BL17 | PASS | T, my check | Self-test ok; `buildings.json` keys are only `id, osm, footprint, heightM, heightSource, roof, kind, status, type` (+1 `curated`); no names or addresses. |
| BL18 | PASS | D, my check | `data/landmarks.json` `screened` field; my re-scan of its text: `aidefence_scan` safe, `aidefence_has_pii` false. |
| X1 | FAIL | R | Render checks: decoded md5 `59729231…`, not `adfca9a7…`; my re-render gives the same `59729231…`; RG1's 4 stills match. **Not attributable to this mission's code:** HEAD's own code, rendered from `git archive HEAD`, gave `dde1e66b…`; HEAD and current code rendered side by side gave the same `686fdcee…`. Only frames in the 2D map scenes differ from the baseline (500–749 and 1005–1019, starting frame varying with load), as slightly blurrier tiles (`$S/cv/crop700.png`, max 27 levels). `out/cycling-vision.mp4` (25 Oct) still decodes to `adfca9a7…`. Cause, likely: `src/components/MapBasemap.tsx:60-93` waits for `Image()` loads but captures SVG `<image>` elements whose raster can differ under memory pressure. The 2D files are unchanged from HEAD. |
| X2 | PASS | S, R | `git diff --quiet HEAD -- tests/baselines`; no untracked file there. |
| X3 | PASS | D | HEAD `bb9c039` unchanged; reflog has no new entry; stash list empty; no remote; every check above is bound to tree `4727b412fb42` + untracked `a288e61124ab`. |
| X4 | PARTIAL | D, V | This report is the independent check of every V row. BL9/BL13 cannot be reviewed (not built). The record belongs in `docs/validation-3d.md`, which I may not edit; the owner should link this file. |
| X5 | FAIL | R | lint, `npm test`, build and the CI self-tests pass on one snapshot, but `npm run test:render` exits 1 on X1 (see X1 for cause). |

**Counts (51 rows):** PASS 39 · PARTIAL 7 (RD7, CL2, CL6, CL7, BL1, BL4, X4) · FAIL 2 (X1, X5) · NOT YET 2 (BL9, BL13) · N/A 1 (CL13).

## 3. Mission criteria

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Specification with testable acceptance criteria | PASS | `docs/spec-3d.md:234-330`: 51 rows, each with a criterion and a method; amendments dated inside their cells. |
| 2 | Design written down | PASS | `docs/design-reel-v2.md` (D37–D48, module and interface table, data files, checks map, budget, risks); `docs/design-3d.md`; ADRs 0041–0053 indexed (all still "Proposed"). |
| 3 | Whole suite passes, new tests included | PASS | 37 files, 260 passed + 2 documented RL8 `it.fails` from the earlier iteration. |
| 4 | Build and CI checks pass | PASS | lint, test, build, BNG self-test and compile check re-run locally; `npm ci --ignore-scripts` and the online audit need network: t12 log relied on. |
| 5 | Every criterion checked by someone other than the author | PASS | This report (51 rows, own commands, renders and scripts). |
| 6 | Prior art, ADRs and memory searched; reuse recorded | PASS | `docs/prior-art-3d.md:158-346` (file:line findings, hypotheses, ADRs and memory reused); memory `…/3d-reel-v2/t1-prior-art`. |
| 7 | Outcome stored as patterns; routing trained | NOT YET | `patterns` has `3d-reel-v2/goal-full` and `t1`–`t13`; no outcome entry (the earlier mission has `3d-reel/mission-outcome`); `routing-decision:*` entries only up to t6. t15 has not run. |
| 8 | Review findings resolved or accepted | PARTIAL | t9 (8) and t10 (24) findings all fixed or accepted, but two items wait for the owner: the CL2/CL3 conflict and the power-station caption question (`docs/validation-3d.md:141`, `:159`, `:301`). This report adds new findings (section 5). |

## 4. Visual review of the V rows

I viewed every still in `out/after` (re-rendered on `4727b412fb42` at 01:04–01:13Z), its counterpart in `out/before-masks`,
the nine `out/previews`, my three reel stills, and 100 % or 200 % crops.

- **Water (WA7).** Llyn Trawsfynydd is now a lit, slightly rippled blue-grey surface. Before, it was terrain-coloured. Islands show as raised green and brown land. At 100 % the shoreline is continuous at frames 60 and 61, with no specks, gaps or flicker between them. The only oddity is cosmetic: shore trees cast near-black navy shadows on the water, which read as dark blobs at 100 % (`$S/viz/tr60_blue_after.png`).
- **Shade-side trees (CL2).** Broadleaf crowns now show their facets on the shaded side. Conifers on the shaded side are still black: the three foreground cones in Vale north are a uniform luma 8. Their form is not readable at playback size. Nothing washes out: no pixel is clipped.
- **Trail (CL4).** On the ground the buff trail is unmistakable against grass, heath, quarry grey and roads. From the air it is thin and close to the map's own track and A-road colours. It is still findable, but it does not stand out.
- **One look (CL6).** Ground sections match each other in light, sky and materials. The four aerial scenes are a flat topographic map in bright lime and orange. They have the same sky and the same hue on average, but still read as a different medium. The drape is kept by spec decision.
- **Positions and categories (CL7).** Bridges carry the hatching and the legend explains it. But the hatch is a 16 × 16 nearest-filtered texture (`src/three/BridgeView.tsx:12-22`), and at close range it renders as coarse saw-tooth bands on the parapets. In the Maentwrog follow shot it reads as a rendering glitch (`out/after/maentwrog_240.png`, `_330.png`; `$S/viz/mw330_parapet.png`). The legend also stays up when no bridge is on screen (reel frame 2200). Buildings, roads and water have no approximate marking.
- **Captions (CL8).** The shortened texts keep their meaning: the heritage proposals, the live station, the private home (wording unchanged), the decommissioning site, the badge and the card verbatim. All sit inside the safe area, wrap to at most 2 lines and read easily at half size.
- **Buildings (BL5, BL9, BL13, BL14).** Background buildings sit on the ground with plausible gabled or flat roofs and do not float (Blaenau at 200 %, `$S/viz/bl150_bld.png`). They are simple grey and stone boxes, far from the cyclist and trail. No landmark is recognisable, because none is modelled. Capel Utica is a background box at about 30 px. The power station is the area's dominant landmark, and its caption names it; it is off screen in Trawsfynydd but geometrically in view in the Maentwrog follow shot, where the window ends before it. Nothing is drawn translucent, so BL14 has nothing to show.
- **Cyclist (CL5).** In every ground still the rider is fully visible. Foreground crowns overhang the top-left corner in the Trawsfynydd follow shot (reel 2200) but never cross the rider. In the drone-side frames the rider is a few pixels: a framing choice, not occlusion.
- **Scope (CL14).** No photorealism, HDRI or new infrastructure was added. The only new textures are the procedural ripple and hatch.

## 5. Open issues, ranked

**Real defects or unmet goal items**

1. **X1/X5: the 2D video's md5 gate fails under machine load (High for the release gate; not a code regression).**
   - The output varies with machine load, in frames 500–749 and 1005–1019 of the map scenes.
   - HEAD's code shows the same variance, and HEAD and current code agree when run side by side.
   - Re-run X1 on a quiet machine before accepting.
   - Consider making `MapBasemap` wait for the SVG images to decode before capture (a pre-existing 2D readiness gap, outside this goal's three providers).
2. **BL1/BL13: the power station is missed in the Maentwrog shot (Medium–High).**
   - Its reactor halls are inside the Maentwrog follow-shot frustum, above the terrain line, at 64–68 px.
   - The candidate pass reads only footprints inside the window, so they are never listed.
   - No landmark is modelled at all, so BL9 and BL13 are not built.
3. **Bridge hatching aliasing (Medium, new in this iteration).** Coarse saw-tooth bands on the parapets in close Maentwrog frames, from a 16 × 16 nearest-filtered `DataTexture`.
4. **CL2 in spirit (Medium).** Shade-side conifers remain black silhouettes, at about 8/255. The ×2 ratio is met from a near-zero base. The CL2/CL3 conflict is still open with the owner.
5. **CL7 on screen (Medium).** Approximate buildings, roads and water are not marked; the reel never labels the trail "proposed"; the RL9 gaps are still unlabelled.
6. **CL6 visual (Low–Medium).** The aerial drape still reads as a different medium from the ground scenes.
7. **Test strength (Low).**
   - RD7's failing-first provider tests failed only because the module was missing; the provider tests are source-string checks.
   - The real-data BL5 test only checks finiteness and contains dead code.
   - BL4's first clause and BL8's structure clause have no test.
   - CL7 compares refs, not coordinates.
8. **Geometry details (Low).**
   - One wall foot floats 0.22 m between the 2 m samples (`building-blaenau-372451116`).
   - 13 buildings are drawn 0.2–2.2 m taller than their recorded height on slopes.
   - `drapeInputs` is keyed without the label (`src/data/MapDrapeProvider.tsx:92-96`), so a shared-window failure can name another aerial section.
9. **Doc drift (Low).** `data/source-register.md:117` says "152 of 156 heights are from the lidar"; the data has 150 `lidar-dsm` and 6 `default`.
10. **Process (Low).** No outcome pattern or routing training yet (criterion 7). ADRs 41–53 are still "Proposed".

**Accepted or documented limitations (not counted as defects)**

- CL2/CL3 trade-off (`TREE_FILL` 0.08), author-accepted and awaiting the owner.
- WA4's seven awash islets; WA7's pixel metric is blind to terrain rising through water, covered by `water-terrain.test.ts`; BL7's listed trackbed building. All three are spec amendments.
- RL8 `it.fails` for vale-south and trawsfynydd (earlier iteration).
- zod override (ADR 25).
- No LOD or instancing for buildings (D46; budgets hold).
- Aerials are out of building scope.
- Lidar DSM survey date unknown (K16), so `observedAt` is the OSM edit date.
- Route locator not built (optional).
- Spec tension to settle: RL21 says no private residence is shown closer than the terrain mesh resolves. The new footprint models do show houses, terraces and residential buildings. The goal asks for footprint models, but RL21 was not amended.
