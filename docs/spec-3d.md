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
