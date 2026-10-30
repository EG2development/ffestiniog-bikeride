# Specification: 3D cycling route animation

Status: draft for mission `msn_abdfd5eabd397f0f653da39f`, task t2. Inputs:
`docs/mission-3d-brief.md` (brief), `docs/adr/0001-use-remotion-three-threecanvas.md` (dependency
decision), `docs/prior-art-3d.md` (what exists and is reusable).

This document says **what** must be true and **how each requirement is
checked**. Modules and interfaces belong to the design task, not here.

## Decisions this spec makes

| Decision | Choice | Reason |
|---|---|---|
| Proof-of-concept section | **Maentwrog Road, km 7.7–9.7** of the route (27 trackbed points over 1,725 m; smoothed elevation 177.6–199.0 m) | Closest station match to the trackbed (13.7 m); one OSM-tagged railway bridge in range (way `159029124`); clear of the known gaps (dropped OSM way near km 10.2, 214 m start offset at km 0). |
| POC length | **12 s = 360 frames** at 30 fps | Inside the brief's 10–15 s. |
| Cyclist speed | **Real time, no time-lapse** | At 12–25 km/h a cyclist covers 40–83 m in 12 s. The terrain can show the whole section; the rider covers only part of it. |
| Coordinates | 3D `x` = 2D `x`, 3D `z` = 2D `y`, 3D `y` = elevation (m) / 10 | Matches `project()`'s 1 unit = 10 m with no mirroring (`docs/prior-art-3d.md`). |
| Vertical scale | 1:1 by default | Any exaggeration must be a single constant and shown on screen (G3). |

## How criteria are checked

Every criterion names its method. The mission requires each criterion to be
checked by something other than its author, so each check is either automated
or done by a separate reviewer.

| Code | Method | Runs in |
|---|---|---|
| **T** | Automated unit test against pure functions (placement, camera, speed, register) | `npm test` (vitest) |
| **S** | Automated static check that scans source or config | `npm test` |
| **R** | Scripted render check (`remotion still`/`render`, `ffprobe`, byte or pixel comparison) | `npm run test:render` (new; too slow for `npm test`) |
| **D** | Document check: a register entry or doc section exists and is complete | `npm test` where the register is JSON, otherwise review |
| **V** | Visual review against a checklist, by a reviewer other than the builder, recorded with name or agent id in `docs/validation-3d.md` | Review step |

## Requirements

Phase column: **P2** proof of concept, **P3** reusable components, **P4** more
route sections, **P5** final video. A requirement marked P2 also holds in every
later phase.

### Geographic accuracy (brief §1, §9)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| G1 | P2 | The trail centreline comes from `data/railway-route.geojson` through `buildRouteModel().project()`. | For every route point in the rendered section, the 3D centreline's `(x, z)` equals `project(lon, lat)`'s `(x, y)` within 1e-6 world units. | T |
| G2 | P2 | Terrain heights come from a real gridded DEM. | (a) `data/source-register.md` names the DEM's source, resolution, licence and retrieval date. (b) Grid spacing in the POC section is ≤ 30 m. (c) At every route point in the section, terrain height differs from that point's elevation in `railway-route.geojson` by a median ≤ 5 m and a maximum ≤ 20 m. If a different DEM family than Copernicus is used, the tolerance and the reason are recorded. *Amended by `docs/design-3d.md` D4: the terrain is a lidar DTM, so the maximum is ≤ 30 m (the Copernicus reference is a DSM that includes tree canopy); the median stays ≤ 5 m.* | D, T |
| G3 | P2 | Vertical scale is honest. | The vertical exaggeration constant is 1, or the frame shows "vertical exaggeration ×N" for every frame where terrain is visible. | T, R |
| G4 | P2 | The trail's height follows a smoothed profile, not raw per-node samples. *Amended by `docs/design-3d.md` D7: the profile is sampled from the terrain DEM along the centreline (`public/data/trail-profile-poc.json`); `data/elevation-profile.json` stays for the 2D video.* | At each `trail-profile-poc.json` point in the section, the trail surface height equals `elevationM / 10 × exaggeration` within 0.1 units (1 m). | T |
| G5 | P2 | Terrain doesn't clip the trail, and implied earthworks aren't presented as verified. | (a) Terrain inside the 3 m trail corridor sits at the trail surface height. (b) Every stretch where the corridor is cut or filled by more than 2 m is listed in the feature register as "approximate (DEM-derived)" unless an OSM or Coflein source verifies it. | T |
| G6 | P2 | Only sourced structures are modelled. | Every bridge, cutting, embankment or tunnel object carries a source id (OSM way id with the matching tag, or a Coflein NPRN) that resolves in the feature register; there are no unsourced structures. In the POC section the one known candidate is OSM way `159029124` (`bridge=yes`). | T |
| G7 | P2 | Places, roads and water come from verified coordinates. | Every labelled place, road or water body has coordinates from `data/waypoints.json`, an OSM id, or the cached map tiles, recorded in the feature register. Road ribbons lie on the rendered terrain (every vertex ≥ 0.2 m above it), and no decorative tree stands within 2 m of a carriageway (amended by the t10 review). | D, T |
| G8 | P4 | Known gaps stay visible. | For each scene, the feature register lists which `data/source-register.md` gaps apply to its location, and the scene labels affected features "approximate". | D, V |

### Honesty and labelling (brief §1, §3, §9)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| H1 | P2 | A feature register classifies every rendered feature. | A JSON register validates against its schema. Every feature id used by a scene exists in it with a category (verified, approximate, proposed or decorative) and a source. | T |
| H2 | P2 | The proposed trail reads as a proposal. | (a) The concept disclaimer is visible on the first, middle and last frame of every 3D composition. (b) The trail is labelled "proposed" when it first appears. (c) Its surface is visually distinct from mapped features. | R, V |
| H3 | P2 | The railway's status is acknowledged. | The POC's closing caption states that the line is mothballed and has had heritage-railway restoration proposals. | V |
| H4 | P2 | No survey-grade claims. | On-screen text and docs claim no survey-level precision, and DEM and OSM data are described as approximate where relevant (review checklist item). | V |
| H5 | P5 | Rail-with-trail is acknowledged. | At least one scene or caption in the final video mentions a rail-with-trail alternative. | V |

### Rendering and integration (brief §7, §8)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| RN1 | P2 | Animation is driven only by Remotion's frame number. | All 3D content renders inside `@remotion/three`'s `<ThreeCanvas>`. A source scan finds no `useFrame`, `requestAnimationFrame`, `setInterval`, `Date.now`, `performance.now` or unseeded `Math.random` in the 3D source. | S |
| RN2 | P2 | Rendering is deterministic. | Rendering POC frames 0, 180 and 359 twice on the same machine gives byte-identical PNGs. | R |
| RN3 | P2 | Output format. | The POC renders to 1920×1080, 30 fps, H.264, 360 frames (checked with `ffprobe`). | R |
| RN4 | P2 | GL renderer per the Remotion docs, without changing the 2D video. *Amended by `docs/design-3d.md` D17: measured, a global `angle` setting changes `CyclingVision`'s pixels.* | Every 3D still and render command in `package.json` passes `--gl=angle`, and `remotion.config.ts` does **not** set the GL renderer globally. | S |
| RN5 | P2 | Assets are loaded before capture. | (a) Every model and texture loader is gated by `delayRender`/`continueRender`. (b) Frame 0 shows the textured terrain, with no blank or default material, and no frame of the full POC render shows a blank canvas. (c) A data provider releases its hold only after its children have mounted, so there is never a moment with no hold before the canvas draws (amended by the t8 benchmark, which found one blank first frame). | S, R, V |
| RN6 | P2 | Performance targets (measured, then confirmed or revised in the benchmark task). | At 1080p on the development machine: average render time ≤ 2 s per frame; no `delayRender` timeout; ≤ 300 draw calls and ≤ 2 M triangles per frame (from `renderer.info`). Results are logged in `docs/validation-3d.md`. | R |
| RN7 | P5 | 4K export is optional. | The final composition renders at 3840×2160 with `--scale 2` and no code change. | R |

### Proposed trail (brief §3)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| TR1 | P2 | Believable width. | Width is one parameter, default 3.0 m, inside 2.5–4.0 m. Before P5, its source is confirmed against Welsh Government Active Travel Act Guidance (2021), section 11 / appendix G. The 2.5 m minimum is so far from secondary sources only. | T, D |
| TR2 | P2 | Gradients are real. | The gradients the trail uses are derived from the trail profile, `trail-profile-poc.json` (the lidar DTM along the centreline, as G4 was amended), and the section's maximum gradient is reported in `docs/validation-3d.md`. | T |
| TR3 | P4 | Crossings and connections are grounded. | Each road crossing is placed where OSM shows a road crossing the trackbed. Conceptual treatments (signs, crossings, viewpoints) are registered as "proposed". | T |
| TR4 | P4 | Constraints are respected. | Sections the evidence marks as private or inaccessible show either no trail or a labelled alternative alignment, never the trail as if accessible. | V |

### Cyclists (brief §4)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| C1 | P2 | Realistic proportions. | Bounding box in riding pose: height 1.5–1.9 m, length 1.6–1.9 m; wheel diameter 0.62–0.72 m. | T |
| C2 | P2 | Realistic speed that responds to gradient. | Speed is 12–25 km/h at every frame, and the speed function gives a lower speed above +2 % gradient than below −2 %. | T |
| C3 | P2 | Rides on the trail. | Lateral offset from the centreline ≤ 1.0 m at every frame. | T |
| C4 | P2 | Wheels touch the surface. | Both wheel contact points are within ±0.05 m of the trail surface height at every frame. | T |
| C5 | P2 | Faces the direction of travel. | Yaw within 5° of the trail tangent, and pitch within 1° of the trail gradient, at every frame. | T |
| C6 | P2 | Wheels roll without slipping. | Wheel rotation equals distance travelled / wheel radius within 1 %. | T |
| C7 | P2 | Natural pedalling. | Cadence is 60–90 rpm and is derived from the frame number. | T |
| C8 | P2 | The model is licensed. | The model's source, licence and attribution are in the asset register (L1). | T |
| C9 | P4 | Walkers, if added, follow the same rules. | C1–C5 hold with walker-appropriate ranges (speed 3–6 km/h, height 1.5–1.95 m). | T |

### Camera (brief §6)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| CA1 | P2 | The camera is a pure function of the frame. | The same frame always gives the same pose. | T |
| CA2 | P2 | Smooth movement. | Outside the first and last 0.5 s of a shot, the camera's speed changes by no more than ±10 % between consecutive frames, and angular velocity stays ≤ 30°/s. | T |
| CA3 | P2 | No collisions. | Camera stays ≥ 2 m above the rendered terrain (after corridor flattening) and ≥ 1.5 m from the cyclist at every frame. | T |
| CA4 | P2 | Natural lens. | Vertical field of view is 35–60°. | T |
| CA5 | P3 | Reusable shot types. | Aerial, follow, first-person, side-track, ground close-up and wide establishing shots each exist as a reusable function, and each passes CA1–CA4. | T |

### Reuse and regression (brief §7 "preserve existing functionality")

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| RG1 | P2 | The 2D video is unchanged. | `CyclingVision` stills at frames 5, 1200, 2200 and 2900 are pixel-identical to baselines captured before any 3D code lands. | R |
| RG2 | P2 | Existing tests keep passing. | `tests/route.test.ts` is unchanged and passes. | T |
| RG3 | P2 | Lint and types pass. | `npm run lint` passes. | S |
| RG4 | P2 | Data stays separate from rendering. | A source scan finds no hard-coded latitude or longitude literals in the 3D source; geographic data lives in `data/` and `public/data/`. | S |
| RG5 | P2 | One projection, shared by 2D and 3D. | 3D placement imports from `src/data/route.ts`; no second projection is written (G1 checks the numbers). | S |

### Licensing (brief §2, §12)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| L1 | P2 | Assets are registered. | Every file under the 3D asset folder has an asset-register entry with source, licence and attribution text. | T |
| L2 | P2 | Required attribution is visible. | Map tiles (OpenTopoMap, OSM), the DEM, and any model that requires it are credited on screen in every 3D composition. | R, V |

### Later phases and deliverables (brief §5, §10, §11)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| P3-1 | P3 | Components are reusable. | Terrain, trail, cyclist and camera components are each used by at least two scenes by the end of P4. | S |
| P4-1 | P4 | Several verified sections. | At least 4 of the 8 brief §5 locations are rendered, each supported by the evidence register. Locations left out are listed with the reason. | D, V |
| P5-1 | P5 | Final video. | 90–120 s, 1920×1080, 30 fps, H.264 (checked with `ffprobe`). | R |
| P5-2 | P5 | Preview images. | One still per scene in `out/previews/`. | R |
| P5-3 | P5 | Documentation. | The evidence register is complete; `docs/validation-3d.md` holds the performance and render results; the README explains editing, previewing and rendering the 3D compositions. | D |

## Open items for the design task

Status after `docs/design-3d.md`: items 1 (D4), 2 (D12), 3 (D10) and 5 (D18)
are decided; item 4 is still pending (risk K4).

1. **DEM source** for G2: Copernicus GLO-30, or Welsh LiDAR DTM if openly licensed with coverage here (both unverified).
2. **Cyclist model** source and licence for C1 and C8.
3. **What OSM way `159029124` crosses** (river, road or track), so the bridge is modelled honestly under G6.
4. **Trail width source** for TR1: confirm the primary ATAG 2021 text.
5. **Feature- and asset-register format**: the JSON schema H1, G5–G8 and L1 test against.

---

# Specification extension: the 1:30 reel (mission `msn_44274a1de641722956fc9ce5`, task t2)

Status: written 2026-10-25 for the reel mission. Inputs: the goal ("enhance and
improve 3D models, more realistic, every part of the route, a 1:30 reel"), the
owner's decisions recorded in ruflo memory (`ffestiniog-bikeride/3d-reel/decisions`),
`docs/prior-art-3d.md` (the reel section), `docs/storyboard.md` and brief §5.
Every P2 requirement above still holds (its T criteria run on the Maentwrog window's real data; the other windows have the DEM, gradient, config and caption tests). Phases: **P3** reusable components,
**P4** route sections, **P5** the reel. "Realistic" is given numeric and visual
checks here so it has an end point.

## Decisions this extension makes

| Decision | Choice | Reason |
|---|---|---|
| Format | **16:9, 1920×1080, 30 fps** (owner's decision, 2026-10-25) | Matches the brief, the 2D video, the baselines and the render checks. No 9:16 cut. |
| Length | **1:30 = 2,700 frames** | The goal. Inside the brief's 90–120 s. |
| Structure | One master composition that sequences **section compositions**, each lazily loaded (ADR 2, ADR 24) | A section is built, checked and rendered on its own, as the POC was. |
| Terrain data | One lidar DTM window at **4 m** per ground-level section; one corridor-wide window at **16 m** for the aerial scenes | The whole corridor at 4 m is about 2.4 M triangles, over RN6; 16 m keeps the corridor at about 310 k. |
| Vertical scale | 1:1 (G3 stands) | Realism first; any exaggeration is labelled. |
| Cyclist | Procedural model, derived from `CyclistDims` (fixes t14 D2); a rigged CC0 model only under its own ADR with a register entry (ADR 14) | No licence risk by default. |
| Frame budget | The table below, summing to 2,700 | The storyboard runs 1:45; every scene is shortened in proportion, the Vale and Trawsfynydd scenes least, because they carry the ride. |

### Frame budget (the storyboard's 8 scenes, scaled to 2,700 frames)

| Scene | Content | Frames | Time | Kind |
|---|---|---|---|---|
| 1 | Introduction: aerial over Eryri towards the corridor | 0–239 (240) | 0:00–0:08 | aerial (16 m DTM) |
| 2 | Historic railway: the trackbed draws on; heritage note | 240–479 (240) | 0:08–0:16 | aerial map mode |
| 3 | Route overview: the full 13.2 km alignment | 480–779 (300) | 0:16–0:26 | aerial (16 m DTM) |
| 4 | Blaenau Ffestiniog, live station, km 0–1.5 | 780–1079 (300) | 0:26–0:36 | ground (4 m DTM) |
| 5 | Vale of Ffestiniog, past Llan Ffestiniog, km 1.5–7.7 | 1080–1619 (540) | 0:36–0:54 | ground (4 m DTM) |
| 6 | Maentwrog Road, km 7.7–9.7 | 1620–1919 (300) | 0:54–1:04 | ground (4 m DTM, exists) |
| 7 | Lake Halt to Trawsfynydd, the lake in view, km 9.7–13.24 | 1920–2399 (480) | 1:04–1:20 | ground (4 m DTM) |
| 8 | Future vision: aerial pull-back and closing card | 2400–2699 (300) | 1:20–1:30 | aerial (16 m DTM) |

## Requirements: the reel

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| RL1 | P5 | The reel has the decided format and length. | `ffprobe` on the rendered reel: 1920×1080, 30/1, H.264, exactly 2,700 frames. | R |
| RL2 | P5 | The reel follows the frame budget. | The master composition's section boundaries equal the table above; a test reads them from the shared timing module and compares. | T |
| RL3 | P3 | Sections are separate, lazily loaded compositions. | `src/Root.tsx` imports no 3D module; every section and the master are registered with `lazyComponent` (extends ADR 24's static test). | S |
| RL4 | P3 | Per-section configuration, no copied assembly. | The POC's constants (`POC`) become a section config type; every section composition is built by one shared assembly function from its config, and `poc.ts` is a re-export shim (the POC's numbers live in `sections.ts` as the `maentwrog` config and `POC`); a test checks the config shape and the Maentwrog identity. | T |
| RL5 | P4 | Every ground section has lidar terrain. | Scenes 4, 5, 6 and 7 each load a 4 m DTM window whose header names the lidar source, `EPSG:27700` and the scene's km range (asserted per window; the pipeline adds a 600 m margin); G2a–c hold per window: median error ≤ 10 m and max ≤ 30 m against the route's Copernicus GLO-90 elevations (amended at t7: the reference is a 90 m surface model, so in steep ground the comparison measures its coarseness; measured medians 2.7–7.6 m, maxima ≤ 22.3 m). | T |
| RL6 | P4 | Aerial scenes use one corridor DTM. | Scenes 1, 2, 3 and 8 load a 16 m (or coarser) corridor window covering km 0–13.24 plus 600 m, with the same header checks; its mesh is ≤ 400 k triangles. | T |
| RL7 | P4 | OSM features per window. | Each ground window's OSM file holds the roads, land use, natural, water and buildings within the window; the registers list every road drawn and every structure, as G6 and G7 require, per section (the G6/G7 tests run on the Maentwrog window; the other windows are checked by their register counts and at review). | D, T, V |
| RL8 | P4 | Trail profile per section. | A lidar profile along the centreline per ground section (G4), with bridge and overbridge spans interpolated (ADR 23); the maximum gradient per section is ≤ 4 % except at listed, labelled dips, and is reported in `docs/validation-3d.md`. *Amended at t13: measured at 5 m steps, blaenau (2.7 %), vale-north (2.8 %) and maentwrog (outside the listed km 9.00–9.02 dip) meet it; vale-south (18.7 % at km 5.90; over km 5.785–5.970, 6.025–6.040, 6.290–6.325, 7.335–7.375) and trawsfynydd (13.6 % at km 10.36; over km 10.345–10.455, 10.535–10.645, 11.495–11.525, 11.715–11.735, 11.895–11.915, 11.995–12.185, 12.740–12.780, 12.885–12.895, 13.025–13.045; list corrected at t14, which found the last three missing) do not. The per-window test expects those two to fail until the profiles are explained or corrected; RL9 lists them.* | T, D |
| RL9 | P4 | Known gaps stay visible. | The source-register gaps that touch a section (the 214 m start offset at Blaenau, OSM way `270718795` near Lake Halt, the km 9.00–9.02 dip, no structure inventory, and the steep profile stretches in the Vale south and Trawsfynydd windows found at t13: cause unverified, trackbed removed or the route line off the trackbed, not yet labelled on screen) are listed in that section's register entries, and the affected feature is labelled approximate (G8). | D, V |
| RL10 | P3 | Terrain surface realism. | Ground sections use a physically based material with at least a normal or detail map, or vertex-colour land cover plus a slope-and-height shading rule; a still of each section shows no flat untextured ground (RN5b's colour-bin check ≥ 4 on the POC's frame 0 and on one still per scene). | R, V |
| RL11 | P3 | Sky and atmosphere. | A sky (procedural or a licensed HDRI) with the fog colour equal to the sky's horizon colour (a test reads both constants); `FogExp2` or linear fog with a stated range; sun azimuth and elevation stay those of ADR 18 unless its ADR is superseded. | T, V |
| RL12 | P3 | Shadows. | Shadow map ≥ 2048, frustum ≤ 400 m across following the rider or the aerial focus, `normalBias` set, soft mode PCF (`shadows={{ type: 1 }}`; three 0.186 maps `PCFSoftShadowMap` to it with a removal warning); no shadow acne on the terrain in the section stills. As built: 2048, 300 m across, `normalBias` 0.02 (`src/three/Lighting.tsx`), confirmed at review; no static test. | V |
| RL13 | P4 | Vegetation is sourced and bounded. | Trees only inside OSM woodland polygons (ADR 11) and within 300 m of the trail (ADR 37; farther woodland is colour only); density inside that zone between 1 and 15 per 100 m² (the placer targets 4), 0 outside; none within 2 m of a carriageway or 10 m of the trail (the 10 m is by construction, untested); instances per kind ≤ 6,000 per section or the section's `maxTreesPerKind` (Trawsfynydd 2,500). | T |
| RL14 | P4 | Water where the data has it. | Llyn Trawsfynydd (and any OSM `natural=water` polygon ≥ 1 ha in a window) is a water surface at the DTM's shore height; its animation is a function of the frame number; a reflection pass, if used, keeps RN6. | T, V |
| RL15 | P4 | Roads and trees sit on the rendered ground. | Every road vertex ≥ 0.2 m above the rendered terrain (tested on the Maentwrog window); every new ground object's code states which height it uses (`heightAt` or `bareHeightAt`) and applies `ve` (G7 as amended; design rule D23; a review rule, no static scan). | T, V |
| RL16 | P3 | The cyclist is built from its dimensions. | `CyclistView` derives its geometry from `CyclistDims`, and the C1 test measures the built model's bounding box (height 1.5–1.9 m, length 1.6–1.9 m, wheel Ø 0.62–0.72 m). | T |
| RL17 | P5 | Concept disclaimer on every frame. | The badge "Concept visualisation — not an approved route" is visible (effective opacity ≥ 0.9) at every checked frame: 0, 1349, 2699, one per section and the last frame before each cut. | R |
| RL18 | P5 | Opening or closing card. | "Concept visualisation only. Not an approved cycle route, engineering design or confirmation of landowner agreement." is fully visible for ≥ 5 s inside frames 0–239 or 2400–2699 (as data: frames 2455–2700 less the fade, 7.7 s; the render checks require it at frame 2600). | R, V |
| RL19 | P5 | Heritage acknowledgement. | Scene 2 or 8 shows a caption that heritage-rail restoration has been proposed for the line (never "abandoned"), fully visible ≥ 4 s (frames 255–470 less the fades, 6.2 s; required at frame 350). | R, V |
| RL20 | P5 | Live station. | Scene 4 shows "Blaenau Ffestiniog — still a live station today" fully visible ≥ 4 s within frames 780–1079 (frames 795–990 less the fades, 5.5 s; required at frame 900), and nothing presents the station as derelict. | R, V |
| RL21 | P5 | Private homes and the decommissioning site. | Scene 6 labels Maentwrog Road as a former station, now a private home (frames 1620–1919); scene 7 labels the former power-station site "decommissioning site — not part of the proposed trail" (frames 1920–2399; the render checks require them at frames 1750 and 2050); no private residence is shown closer than the terrain mesh resolves. | R, V |
| RL22 | P5 | Attribution and "not survey-grade". | The lidar, OSM and (where draped) OpenTopoMap credits are visible on every checked frame, and the words "not survey-grade" appear in the attribution (H4, L2). | R |
| RL23 | P5 | Determinism. | Reel frames 0, 1349 and 2699 are byte-identical across two renders (RN2 for the reel); no clock, timer, `useFrame` or unseeded randomness in any 3D source (RN1's static test covers every new directory). | R, S |
| RL24 | P5 | Performance. | ≤ 300 draw calls and ≤ 2 M triangles at every checked frame (one per section and the last frame before each cut, where the premounted next section is also mounted; ADR 39); ≤ 2 s per frame; the full reel renders in ≤ 30 min on the development machine; no `delayRender` timeout. | R |
| RL25 | P3 | The 2D video is untouched. | RG1's four stills match their baselines; the full `CyclingVision` render decodes to md5 `adfca9a7f31577885e4ec84c1aca3f53`; its entry chunk stays within 2 % of the pre-reel 1,333,784 bytes (RG1 by `npm run test:render`; the md5 and the chunk size by the t8 benchmark, recorded in `docs/validation-3d.md`). | R, D |
| RL26 | P5 | No blank frames. | The full-render blank-canvas scan passes for the reel (every frame's canvas-centre luma ≥ 20). | R |
| RL27 | P5 | Honest transitions. | A cut between sections lands on a frame of each section (no cross-fade through an empty canvas), checked by the blank scan and by review. | R, V |
| RL28 | P3 | Assets are licensed and registered. | Every texture, HDRI or model file under `public/3d/` has an `assets-3d.json` entry with source, licence and attribution (L1); credits required by a licence are on screen (L2). | T, R |
| RL29 | P4 | Sourced features only. | Every drawn structure, road, water body, place label and earthwork has a register entry with an OSM id, a waypoint id, a Coflein record or a DTM derivation (ADR 12, G6, G7); no feature is drawn from memory or imagination. | D, V |
| RL30 | P4 | Fetch scripts use allowlisted hosts only. | A static test finds no URL in `scripts/` outside `dmwproductionblob.blob.core.windows.net` and `api.openstreetmap.org` (documentation links to remotion.dev, github.com and threejsresources.com are exempt, and so is www.openstreetmap.org when it is only cited as a source URL in register provenance, never fetched); no secrets in the repository. | S |
| RL31 | P4 | OSM text is screened before it is shown. | Any OSM tag value rendered as on-screen text passes a content screen (no scripts, no personal data), and labels come from `waypoints.json` or the register, not raw tags. | S, D |
| RL32 | P5 | Preview stills. | One still per section in `out/previews/` from the final render settings. | R |
| RL33 | P5 | Evidence. | `docs/validation-3d.md` records the reel's render results, the per-section measurements of RL5, RL8 and RL13, and the review verdicts for every V criterion by someone other than the author. | D, V |
| RL34 | P5 | The brief's locations. | At least 6 of the 8 locations of brief §5 are rendered with evidence, and any left out is listed with the reason (supersedes P4-1's "at least 4"). | D, V |

## Open items for the design task (reel): resolved

Raised at the specification; each was decided in the design (t3) and is now shipped.

1. **Section windows for the Vale (scene 5, km 1.5–7.7):** two windows, `vale-north` (km 1.5–4.8) and `vale-south` (km 4.8–7.7), as two sequences with a hard cut at frame 1350 (ADR 29, D25).
2. **Sky:** a gradient sky dome with a sun disc and `FogExp2`, the fog colour equal to the horizon colour; no HDRI; ADR 18's sun (ADR 30).
3. **Aerial drape:** yes; scenes 1, 2, 3 and 8 drape the cached zoom-15 OpenTopoMap tiles on the 16 m corridor DTM, with the CC-BY-SA credit in the attribution (ADR 33).
4. **Water:** a plane per OSM water polygon with a frame-driven procedural normal map, not three's `Water` class (ADR 32).
5. **Terrain material:** slope-and-height shading of the land-cover colours, no texture (ADR 31).
6. **Structures:** shipped with OSM bridges and DTM-derived earthworks only; no Coflein query (ADR 38; the registers' `coflein` source kind stays unused).
7. **Cuts between sections:** hard cuts with a 2 s premount of the next section; no bridge shot (ADR 28).

# Specification extension: water, readiness, clarity and buildings

Status: written 2026-10-25 for mission `msn_33e838999675db739df3c922`, task t2. The goal's
full text is ruflo memory `ffestiniog-bikeride/3d-reel-v2/goal-full`; the findings behind
these rows are in `docs/prior-art-3d.md`, "Prior art for the water, readiness, clarity and
buildings iteration". Phase **I2**. Every RL requirement above still holds. The methods are
T, S, R, D and V, as above. "Before" means the snapshot at the start of this mission;
"after" means the snapshot under test.

## Decisions this extension makes (owner may override)

| Decision | Default | Reason |
|---|---|---|
| Rule for changing code | Change only what a failing test or a recorded inspection shows; each fix is mutation-checked (revert it, its test fails, restore it) | The goal: "change only what a test or inspection shows" |
| Llyn Trawsfynydd in the maentwrog window | Use the same relation geometry, islands included, in both windows, from data already on disk, with no new fetch | One lake, one surface, no network |
| A map tile missing from the cache | Still painted and logged (ADR 33), but the render checks fail if any reel section reports a missing tile; a listed tile that fails to load fails the render | Keeps ADR 33 and makes a gap visible |
| Aerial look | The four aerial scenes are graded to the ground palette (CL6); the drape stays | "One look in all sections" without new imagery |
| Building scope order | Trawsfynydd and Maentwrog first, then the other ground windows; aerials only if the budget allows | Ground first, as the goal says; the corridor window has no OSM data |
| Route locator | Not built unless the independent review finds orientation unclear (CL13) | "Optional"; avoids scope growth |
| Reading speed | At most 15 characters per second of full-opacity time, and at least 2.5 s on screen | Broadcast subtitle practice |
| Safe area | 5 % title-safe area: 96 px left and right, 54 px top and bottom, at 1920 × 1080 | Common title-safe area for a 1920 × 1080 frame |

## Requirements: water (goal 1)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| WA1 | I2 | Water faces up. | For a square lake given with clockwise and with anticlockwise rings, every triangle normal of the built water mesh has y > 0. The same holds for every water body drawn in the five real ground windows (t13: the test covers each of them). | T |
| WA2 | I2 | Holes survive triangulation. | Lake with one island: no triangle centroid lies inside the island ring, and the triangulated area equals the outer area minus the island to within 1 %. | T |
| WA3 | I2 | Holes survive the core and the pipeline. | Holes from `coordinates[i][1:]` and from `properties.inner_rings` are both used, by `water.ts` and by the pipeline's fill. A MultiPolygon applies each part's holes to that part only. A Polygon and a one-part MultiPolygon with the same rings give identical output. | T |
| WA4 | I2 | Terrain fill skips islands. | After the fill, DTM cells inside a hole keep their input height in a synthetic grid. On the real trawsfynydd window, no island cell of relation `3084421` is filled, and every island of 1,000 m² or more rises at least 0.5 m above the lake level. *Amended at t7: the completed relation has 22 islands, not 15. After the fix, seven small islets (168–709 m²) are within ±0.5 m of the 197.26 m level in the lidar itself, unfilled: awash at the survey's water level, not flattened.* | T |
| WA5 | I2 | One lake, one surface. | A water body present in two windows has the same number of islands and a surface height within 0.1 m in both, and that height is its shared level. Llyn Trawsfynydd in trawsfynydd and maentwrog, measured 197.2 and 197.7 m before. | T |
| WA6 | I2 | Water is drawn and lit. | In every still where the `water-expected` mask (the water mesh, both faces) covers at least 2,000 px, the `water` mask covers at least 95 % of it, islands excluded by the mesh's holes; and hiding the water (`hide: "water"`) changes that area by a mean of more than 8 levels. | R |
| WA7 | I2 | No covered islands, shore gaps or flicker. | At most 1 % of water pixels lie more than ΔE76 25 from the water's median colour, measured on caption-free frames in every still with the lake in view and at the adjacent Trawsfynydd frames 60 and 61. Island colours are confirmed in review. The surface uses `polygonOffset` (or a measured equivalent), not a larger lift. Shorelines are confirmed at 100 % in review. *Amended at t10: terrain rising through the surface hides the water in the normal and the expected-water masks alike, so the pixel metric cannot see it. `tests/three-core/water-terrain.test.ts` checks the terrain itself: no DEM node inside a lake, more than 0.1 m from its shore and outside its islands, is more than 0.05 m above the lake's shared level, and every drawn lake has one. The pipeline's fill lowers such ground to the level (none of it is island).* | R, V, T |

## Requirements: frame readiness (goal 2)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| RD1 | I2 | Cold loads draw a complete frame. | A fresh `remotion still` process at the first and a middle frame of every section passes the blank-canvas check (canvas-centre luma ≥ 20) and the colour-bin check (≥ 4 bins). | R |
| RD2 | I2 | Direct seeks and cuts draw a complete frame. | Fresh-process stills at the last frame of each section, and at the reel's last frame before and first frame after each cut, pass the same checks. RL27's blank scan of the full reel stays. | R |
| RD3 | I2 | An input change re-holds the frame. | When a provider's input changes (`section`; `dem`, `zoom`), a new hold is taken before the new load and released only once the new data is mounted. The old data is never shown with the new input. Checked with a stubbed `delayRender`/`continueRender`. | T |
| RD4 | I2 | Obsolete requests cannot win. | A request that settles after a newer one began, or after unmount, neither sets data nor calls `cancelRender`. | T |
| RD5 | I2 | Failures are actionable. | A missing or invalid file fails the render with a message naming the asset path and the section id (`route` for the shared route files, `poc` for the proof of concept). This holds for every provider, including tiles and the tile manifest. | T |
| RD6 | I2 | Missing cached tiles are caught. | The render checks fail if no `MAP_DRAPE` line is logged, or if any line reports more than 0 missing tiles. | R |
| RD7 | I2 | Fix only what is shown. | Each readiness change has a test that fails before it and passes after; recorded in `docs/validation-3d.md`. | D |

## Requirements: visual clarity (goal 3)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| CL1 | I2 | Before and after stills come from one environment. | `scripts/stills.mjs` renders a fixed frame list (Trawsfynydd and Maentwrog first, then one frame per other scene) with every mask to `out/before-masks/` and `out/after/`. It records the platform, Node, Remotion, Chrome, `--gl=angle`, scale 1 and the snapshot. Both sets come from the same script, and the render checks compare them only when the environments match. | D, R |
| CL2 | I2 | Shadow-side trees have readable form. | In the ground stills, the median luma of tree pixels on the side away from the sun rises by at least 20 % over the before stills. Tree pixels are identified by a mask render. | R, V |
| CL3 | I2 | No washout. | Frame mean luma stays within ±10 % of the before still, and at most 1 % of pixels are clipped (luma ≥ 250). | R |
| CL4 | I2 | The trail stands out. | In each ground still with at least 2,000 trail pixels, the colour difference (CIE76 ΔE) between the trail and the terrain within 20 px of it is at least 20, and between the trail and the roads within 20 px where at least 200 road pixels lie there. | R, V |
| CL5 | I2 | Trees do not hide the cyclist. | For every frame of every ground-section shot that frames the rider (drone-side and follow), the segment from the camera to the rider's centre crosses no tree crown (crown shapes as drawn). *Amended at t6: measured before any change, the follow shots are clear, but the drone-side shots are blocked in Maentwrog (25 of 180 frames) and Trawsfynydd (149 of 240), measured against the crown shapes as drawn; the follow-only wording would have passed while the defect stayed.* | T |
| CL6 | I2 | One look across sections. | All sections take light, sky, fog and materials from one source. In the stills, mean terrain hue and saturation in aerial scenes are within 15 % of the ground scenes. | S, R, V |
| CL7 | I2 | Positions and categories are kept. | No registered feature moves (positions compared with the before snapshot). Approximate and proposed features are marked on screen by a label or style, closing RL9/G8. | T, V |
| CL8 | I2 | Captions are readable in time. | Every caption has full-opacity time ≥ max(2.5 s, characters ÷ 15). The badge (RL17), the closing card (RL18) and the required heritage, live-station and decommissioning wording are pinned by tests; the private-home caption's meaning is confirmed in review; text still pinned by tests stays verbatim. | T, V |
| CL9 | I2 | Captions sit inside the safe area. | Every overlay box is inside the 5 % title-safe area at every measured frame. Boxes are logged by `OverlayLog` and checked by the render checks. | R |
| CL10 | I2 | Captions wrap cleanly. | No caption runs to more than 3 lines (render checks), and the caption style never breaks or hyphenates a word (`hyphens: none`, `overflowWrap: normal`). | R, S |
| CL11 | I2 | Captions have contrast. | Caption, badge, attribution and legend text against its own box, composited over black and over white, is at least 4.5:1 (WCAG AA), computed from the colours. | T |
| CL12 | I2 | Text is legible at playback size. | At 1920 × 1080, captions are ≥ 28 px and the badge and attribution ≥ 18 px (they were 15 px and 12 px before). | S |
| CL13 | I2 | Optional route locator. | Only if built: at most 6 % of the frame, inside the safe area, its marker at the rider's route km within 50 m (test), and it never overlaps a caption. | T, R |
| CL14 | I2 | Scope guard. | No new textures, HDRIs or photographic assets, and no structure without a source. Assets are only those `data/assets-3d.json` registers. | S, V |

## Requirements: buildings and landmarks (goal 4)

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| BL1 | I2 | Candidates are what the shots see. | A pure function lists, for each shot, the footprints inside the camera frustum and not hidden by terrain at one or more sampled frames. Only listed footprints may be modelled. The list per section is saved with the research. *Amended at t7: each footprint is tested at its measured height (unmeasured ones at a 60 m upper bound, then measured and tested again), not at a 6 m default, which missed taller buildings behind a rise, such as Capel Moriah at 11.9 m.* | T, D |
| BL2 | I2 | Every building is sourced. | Each modelled building has a register entry with source URLs, `observedAt` (latest verified observation), `retrievedAt`, licence, confidence (high, medium or low) and status (existing, construction, approved or demolished). The validator rejects any missing field. | T |
| BL3 | I2 | Status needs evidence. | Status existing or construction needs a dated observation (map, imagery, record or photograph); a planning approval alone gives status approved. Approved and demolished features are never drawn as existing. | T |
| BL4 | I2 | Currency is honest. | No register text or caption calls a feature current beyond its `observedAt`. Entries observed more than 3 calendar years before their `retrievedAt` have confidence at most medium. | T, D |
| BL5 | I2 | Footprints sit on the ground. | Models use the OSM footprint (way id), projected with `project()`. The base is at the lowest DTM height under the footprint, and every footprint vertex's wall reaches the DTM (no floating, no buried base). | T |
| BL6 | I2 | Heights are measured or marked. | Measured height is the 90th percentile of DSM − DTM inside the footprint, citing the lidar DSM. Otherwise the height is estimated (levels × 3 m or a stated default) and the entry is approximate. | T |
| BL7 | I2 | Nothing runs through a building. | No trail or road vertex or segment lies inside a footprint. *Amended at t7: one building stands on the trackbed itself. OSM way 289033748 (mapped 2014-06-21, 4.9 m in the lidar DSM, near km 10.93 in trawsfynydd) sits on a 54 m stretch that OSM tags `railway=dismantled` (way 1344840040, 2024-12-22). It is kept and listed by id, not moved or dropped: the proposed trail would have to pass round it. Any other crossing fails, and so does the listed one if it no longer crosses. Amended by ADR 63 (2026-10-30): two buildings OSM lacks, OS OpenMap Local outlines near km 11.60–11.66 in trawsfynydd (4.6 and 5.2 m in the lidar), also stand on the centreline and are listed the same way; an OS outline a registered road runs through is left out (its outline is generalised), and the Blaenau terrace with a carriage arch (way 461995265) is listed for the road it spans.* | T |
| BL8 | I2 | No duplicates. | No two modelled footprints overlap by more than 10 % of the smaller one. No building duplicates an existing structure entry, such as a bridge. | T |
| BL9 | I2 | Landmarks are recognisable. | Each sourced landmark has a procedural model with its recorded roof form and silhouette. Its main dimensions are within 10 % of the sourced values (test); recognisability is confirmed by review. | T, V |
| BL10 | I2 | Background buildings are cheap. | Background buildings are extruded footprints with flat or pitched roofs, in one shared material, merged per section: at most 3 draw calls per section for buildings. | T, R |
| BL11 | I2 | Data loads per section. | Building data is a per-section file keyed by feature id, and a section requests only its own file. | T |
| BL12 | I2 | Budgets hold. | With buildings, RL24 still holds at every checked frame and before each cut (≤ 300 calls, ≤ 2 M triangles, ≤ 2 s per frame). No textures are added. | R |
| BL13 | I2 | Landmarks, cyclist and trail are all clear. | In a shot whose list names a landmark, the landmark is on screen for at least 2 s and at least 40 px tall. CL5 still holds in that shot. *Not yet measured (t13): no section lists a landmark (Capel Utica is sourced but drawn as a background building at 28–31 px), so the render check asserts that none is listed and fails when one is.* | R, V |
| BL14 | I2 | Historic and proposed are distinct. | Approved or demolished features are drawn translucent and named in the legend, a style and a label existing features never use. | T, V |
| BL15 | I2 | Licences are honoured. | The ODbL, OGL and any Cadw or Coflein terms are recorded per entry, and the on-screen attribution carries every required credit. | T |
| BL16 | I2 | Nothing invented. | Every rendered building id resolves to a register entry with a real source type (`osm`, `coflein` or `lidar-dtm`). | T |
| BL17 | I2 | Fetched data stays minimal. | The pipeline keeps only `building` (its type value), `building:levels`, `height` and `roof:shape` for buildings: no names, addresses or contacts (extends t9 S1 and ADR 38). | T |
| BL18 | I2 | Web text is screened. | Any text fetched from the web passes `aidefence_scan` before it enters the register, and the result is recorded. | D |

## Requirements: across all four

| ID | Phase | Requirement | Acceptance criterion | Method |
|---|---|---|---|---|
| X1 | I2 | CyclingVision is unchanged. | RG1's four stills match and the full render decodes to md5 `adfca9a7f31577885e4ec84c1aca3f53` (RL25). | R |
| X2 | I2 | Baselines are unchanged. | `tests/baselines/` is byte-identical to before. | S |
| X3 | I2 | Uncommitted work is kept. | No commit, push, publish, stash drop or reset; every check is bound to a snapshot: the tree hash of `git stash create` (or HEAD's when clean), plus a hash of the untracked files outside the tool-state folders (`.claude-flow/`, `.claude/`, `.agents/`, `.idea/`). | D |
| X4 | I2 | Checks are independent. | Every V criterion is checked by someone other than its author and recorded in `docs/validation-3d.md`. | D, V |
| X5 | I2 | The suite and CI stay green. | `npm run lint`, `npm test`, `npm run build`, the clean-room CI run and `npm run test:render` pass on one snapshot. | R |
