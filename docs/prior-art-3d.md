# Prior art for the 3D upgrade (mission task t1)

What already exists in this repo, what the 3D work can reuse, and what is
missing. Checked 2026-10-25. Brief: `docs/mission-3d-brief.md`. Decision
record: `docs/adr/0001-use-remotion-three-threecanvas.md`.

## Reusable code

| What | Where | How the 3D work reuses it |
|---|---|---|
| GIS → world projection | `src/data/route.ts` `buildProjection`; exported as `project` on the model | Same x/y for 3D, so 2D and 3D stay aligned. Units: 1 world unit = 10 m. 2D y is screen-down, which maps to three.js +z with no mirroring when viewed from above (x→x, y→z, elevation→y). Heights in metres must be divided by 10 to keep scale, or any vertical exaggeration labelled. |
| Route model | `src/data/route.ts` `buildRouteModel` | `routePoints` (lon, lat, ele, dist, t, x, y), `stations` (with `t`), `elevationProfile`, `mapTiles`. |
| Position and heading along the route | `pointAtT` (`src/data/route.ts`); heading from a look-ahead point in `src/components/Cyclist.tsx` | Cyclist and camera paths: position from `pointAtT(t)`, yaw from `pointAtT(t + 0.0015)`. Pitch from the elevation slope is new work. |
| Async data loading gated on render | `src/data/RouteDataProvider.tsx` (`delayRender`/`continueRender`, `staticFile`; since t8 the hold is released in an effect after the children mount, spec RN5c) | Same pattern for GLB models and textures. Whether `useRouteData()` works inside `<ThreeCanvas>` is unverified; the Remotion docs say `ThreeCanvas` forwards React contexts, so the POC should confirm it. |
| Map tile placement | `src/components/MapBasemap.tsx:21` `useTileBasis` (tile corners → world via `project`) | The same corner mapping gives UVs to drape the cached OpenTopoMap tiles on a 3D terrain mesh. |
| Scene timing and registration | `src/data/timeline.ts`; `src/Root.tsx` | A separate POC composition is registered the same way, without touching `CyclingVision`. |
| Captions and disclaimer | `src/components/Caption.tsx:22,83,117` | HTML overlays placed beside the `<ThreeCanvas>`, not inside it. |
| Regression tests | `tests/route.test.ts` (6 tests, vitest, mutation-checked) | Gate: must keep passing unmodified. |

## Reusable data

| Asset | Contents | Licence |
|---|---|---|
| `data/railway-route.geojson` | 298 points, 13.24 km, lon/lat/elevation | Route: OSM ODbL. Elevation: Copernicus GLO-90 via Open-Meteo |
| `data/elevation-profile.json` | 54 points at 250 m steps, 170.1–247.0 m, smoothed | same |
| `data/waypoints.json` | 5 verified stations with distance along route | Wikipedia (CC BY-SA) facts |
| `public/maps/tiles/` + `public/data/tiles-manifest.json` | OpenTopoMap, zoom 12 (25 tiles, wide) and zoom 15 (147 tiles, corridor) | CC-BY-SA, OSM ODbL, SRTM; attribution required on screen |
| `data/source-register.md` | Evidence register and known gaps | — |

## ADRs and memory searched

- **Project ADRs:** only `docs/adr/0001-use-remotion-three-threecanvas.md` (Proposed): `@remotion/three` `<ThreeCanvas>`, the compatibility table, and 8 POC acceptance criteria.
- **ruflo console ADR digest** (`.claude-flow/console/adr-digest.json`, local tooling, not in the repository): no ADRs attached to mission `msn_abdfd5eabd397f0f653da39f`.
- **`.claude/helpers/adr-compliance.sh`** (local tooling, not in the repository): checks the claude-flow toolchain's own ADRs (ADR-001 "agentic-flow as core foundation", and so on). They're about the toolchain, not this project, so they don't apply.
- **Claude Code project memory:** `trawsfynydd_railway_status.md` (corridor is mothballed, not dismantled; scope stops at Trawsfynydd; heritage-trust history) and `three_js_upgrade_decision.md` (ThreeCanvas decision, vitest added).
- **ruflo memory** (`memory_search_unified`, namespaces default, claude-memories, auto-memory, patterns, tasks, feedback): no results.

## Missing, and needed for the 3D phases

1. **No gridded DEM.** Elevation exists only along the track. A terrain mesh needs a grid around the corridor. Open-Meteo's elevation API answered batched point queries in this session (used for the 298 route points); its suitability for a grid (spacing, rate limits) is unverified.
2. **No structure inventory.** No bridges, cuttings or embankments are recorded. The brief's "railway cuttings" and "bridges and crossings" scenes can't show verified structures until Coflein or NLS historical OS mapping is checked.
3. **No 3D assets.** No cyclist or bicycle model and no licensed source chosen.
4. **No three.js dependencies installed** (`package.json` has none).
5. **No visual reference catalogue** (open since the 2D brief).
6. **Known GIS gaps** (`data/source-register.md:16-34`): OSM way `270718795` near Trawsfynydd Lake Halt is dropped; the route start is ~214 m from Blaenau Ffestiniog station; per-node elevation is noisy, so use the 250 m smoothed profile.

## Candidate POC section (for the spec task to decide)

**Maentwrog Road, roughly km 7.7–9.7.** It has the closest station match to the trackbed (13.7 m, `data/waypoints.json`) and a documented structure (the A470 bridge, rebuilt in 2002 with the line kept beneath). It's also away from the dropped OSM way and the Blaenau start offset.

**Trawsfynydd Lake Halt is a poor choice** (72 m station match, next to the dropped way), and so is **the Blaenau end** (214 m offset).

---

# Prior art for the 3D reel (mission `msn_44274a1de641722956fc9ce5`, task t1)

Checked 2026-10-25. Goal: make the 3D models more realistic across every part
of the route and produce a 1:30 reel. Decisions already taken by the owner:
**16:9, 1920×1080, 30 fps, 2,700 frames**; loop mode; work on branch
`mission/3d-reel` (commit `bb9c039`). Sources read: ADRs 1–26 (`docs/adr/`),
`docs/sop-3d.md`, `docs/validation-3d.md` (t8–t14), `docs/storyboard.md`,
`docs/mission-3d-brief.md` §5 and §10, `data/source-register.md`, the ruflo
`patterns` memory, and the threejsresources guides cited below.

## 1. What exists and is reusable (code)

| What | Where | Reuse in the reel |
|---|---|---|
| Shared projection and its inverse | `src/data/route.ts` `buildProjection` → `project`/`unproject` on the model | Every 3D point still goes through it (ADR 5, RG5). Unchanged. |
| Pure 3D core (1,339 lines, no React/three) | `src/three-core/`: `bng` (WGS84↔BNG), `dem` (bilinear lookup, terrain mesh with land-cover colours), `trail` (ribbon, profile, `flattenCorridor`), `cyclistMotion`, `camera` (`droneSideTrack`, `followShot`, `withClearance`, `sequenceShots`), `roads` (3-vertex draped ribbons), `bridge`, `trees` (seeded, off trail and roads), `registers` (register and runtime-data validators), `rng`, `poc` | All of it, as is. `poc.ts` is the template for a per-section assembly: `buildPocScene`/`buildPocExtras` take `{route, dem, land, profile}` and nothing Maentwrog-specific except the `POC` constants (section km, start, bridge span, shots). Generalising those constants into a per-section config is the Phase 3 step the first mission left. |
| Thin views | `src/three/`: Terrain, Trail, Road, Bridge, Trees (two `InstancedMesh`), Cyclist (procedural, leg IK), CameraRig, Lighting (sun, hemisphere, shadow frustum following the rider; the fog moved to SkyDome at ADR 30), Diagnostics | As is. Realism work lands here (materials, sky, atmosphere) without touching the core. |
| Section composition | `src/scenes3d/PocMaentwrog.tsx`: providers outside the canvas, `useMemo` build, `data-overlay` markers, `OverlayLog`, default export for `lazyComponent` | The pattern for each new section composition and for the reel's master composition (ADR 2, ADR 24). |
| Runtime data boundary | `src/data/Scene3DDataProvider.tsx`: parallel header fetch, HTTP status, validators, `cancelRender`, hold released after mount | Needs one change: it hard-codes the `-poc` file names. Parametrise by section id. |
| Data pipeline | `scripts/build_poc_data.py` (`SECTION_M = (7700, 9700)`, `MARGIN_M = 600`), `scripts/dem/cog.py` (range reads of the lidar COG, any overview level), `scripts/osm/fetch_bbox.py`, `scripts/gen-earthworks.ts`, `scripts/sync-public-data.mjs` | Reusable per section once `SECTION_M` and the output names become parameters. The COG reader already takes a level, so a coarse corridor-wide DEM for aerial shots is a parameter change, not new code. |
| Checks | `tests/three-core/{fixtures,criteria}.ts` (synthetic trail and rider, C1–C7 and CA1–CA4 assertions), `tests/three-core/poc-acceptance.test.ts` (real-data pattern), `tests/static-3d.test.ts`, `tests/docs.test.ts`, `scripts/render-checks.mjs` (RG1, RN2, RN3, RN5b full-render blank scan, RN6, overlay visibility), `.github/workflows/ci.yml` | `criteria.ts` applies to any section's trail and rider. The render checks are bound to `Poc3DMaentwrog` by name and need the reel composition added. |
| Baselines and evidence | `tests/baselines/cyclingvision.json`, the t8 decoded-md5 `adfca9a7…` for the full 2D render, `docs/evidence/` | The 2D gate stays exactly as it is. |

## 2. ADRs that bind the reel

All 26 are still *Proposed* (the owner's decision is pending). The ones that
constrain this mission most: **2** separate compositions, **3** pure core,
**5** shared projection at true vertical scale (any exaggeration labelled),
**11** seeded trees only inside OSM woodland, **12** only sourced structures,
**14** procedural cyclist (a rigged CC0 model "is evaluated in Phase 3 under its
own ADR"), **18** fixed sun and fog, **19** `--gl=angle` per command, **20**
validated registers, **23** road decks interpolated out of the profile, **24**
lazy registration, **25** the zod override, **26** render checks stay a local
gate. New decisions this mission will need its own ADRs for: the reel
composition and its per-section frame budget, DTM windows and levels per
section, sky and atmosphere, any texture or model assets (licences, L1), and
water for Llyn Trawsfynydd.

## 3. Memory patterns (ruflo `patterns` namespace)

`ffestiniog-bikeride/3d-upgrade/{t1-prior-art … t15-… , mission-outcome-poc}`
(15 entries) and `ffestiniog-bikeride/3d-reel/decisions`, plus five distilled
patterns stored at t15: Remotion/three rendering rules, GIS terrain
techniques, the process lesson, docs and dependency safety, and routing.
*Correction at the reel's t15: the store had been losing writes, because
`@claude-flow/cli` 3.10.46 rewrote `memory.db` on every sql.js-fallback read and
discarded the write-ahead log. Only `3d-upgrade/t1`, `t3`, `t4` and `t6`
survived. After the CLI was pinned to 3.63.0 the surviving and recovered entries
were re-imported (24 `patterns` entries and 9 ReasoningBank patterns, now in
`.swarm/agentdb-memory.db`). The recovery export is
`docs/evidence/t15-ruflo-patterns-export.json`. The first mission's t2, t5 and
t7–t15 records were not recoverable; their content lives in
`docs/validation-poc.md`.* The
process lesson applies directly: **run the benchmark and an independent review
right after the first build**; the first build's own tests missed five real
defects. `agentdb_pattern-search` returned nothing (its fallback tier is a
substring match); `memory_search` finds the entries.

## 4. Data per storyboard section: what exists, what's missing, where it comes from

Only the Maentwrog Road window has lidar terrain and OSM features today. The
km positions are from `data/waypoints.json` (stations) and the storyboard's
timings; t2 fixes the section boundaries and the frame budget (the storyboard
runs to 1:45, the reel is 1:30).

| Storyboard scene | Route km (proposed) | Terrain (lidar DTM) | OSM features | Gaps and sources |
|---|---|---|---|---|
| 1 Introduction, aerial over Eryri | whole corridor, wide | none | none needed | A wide window at a coarse overview level (the COG has 2/4/8/16/32/64 m levels; design D4). Sky and atmosphere are the realism work here. |
| 2 Historic railway, map draw-on | whole corridor | none | the stitched trackbed (`railway-route.geojson`, 36 OSM ways) | Can stay 2D (reuse scene 2) or drape the cached OpenTopoMap tiles (z12/z15, CC-BY-SA) on a coarse DEM; D8 already foresaw a "map mode". |
| 3 Route overview, full alignment | km 0–13.24 | none | trackbed, stations | A corridor-wide DTM at 16 m (as built 226 × 692 ≈ 156 k nodes, 311 k triangles) keeps RN6; at 4 m the corridor would be ≈ 2.4 M triangles, over budget. |
| 4 Blaenau Ffestiniog, live station | km 0–1.5 | none | none fetched; OSM has buildings here (the POC window alone had 40) | New window. The stitched start is ≈ 214 m from the station (register gap). Honesty: "still a live station"; the trail through the town is conceptual. |
| 5 Countryside / Vale of Ffestiniog, past Llan Ffestiniog (km 5.33) to the low point ≈ 170 m | km 1.5–7.7 | none | none fetched | The longest stretch: two or three windows. No cutting or embankment inventory exists (register gap; sources not yet queried: Coflein, NLS historical OS maps), so earthworks come from the DTM and `flattenCorridor`, labelled approximate. Llan Ffestiniog station site was demolished by 2011. |
| 6 Maentwrog Road | km 7.7–9.7 | **done**: 471 × 729 at 4 m, 0 nodata | **done**: 233 features: 79 roads, 66 land use, 47 natural, 40 buildings, 1 bridge; 4 overbridges found | Open: the dip at km 9.00–9.02; the station is a private home (caption exists); the A470 overbridge is drawn but not labelled (t14 D6). |
| 7 Trawsfynydd Lake Halt → Trawsfynydd, lake in view | km 9.7–13.24 | none | none fetched | New window(s). Llyn Trawsfynydd from OSM `natural=water` needs a water surface (new). The power-station site caption is required by the storyboard. OSM way `270718795` near Lake Halt is dropped from the stitched line (register gap). Lake Halt: platform remains. |
| 8 Future vision, aerial pull-back | whole corridor | none | — | Same corridor DTM as scene 3. |

Licences carried: lidar DTM OGL **to confirm before release** (K2), OSM ODbL,
OpenTopoMap CC-BY-SA, Copernicus for the 2D profile. Any new texture, HDRI or
model must enter `data/assets-3d.json` with source, licence and attribution
(L1, ADR 20); the asset folder is empty today.

## 5. Realism techniques, with sources

From the threejsresources guides (each verified against a stated three.js
release; ours is 0.186.1):

- **Sky and fog** ([threejsresources.com/guides/sky-and-clouds](https://threejsresources.com/guides/sky-and-clouds)): three routes to a sky: a static skybox or HDRI (fastest, also image-based lighting, but licensed), the built-in procedural `Sky` addon (physically inspired, sun position and turbidity, no texture), or a custom shader. `FogExp2` reads more natural than linear fog, and the fog colour must match the sky colour or the horizon shows a seam. Clouds: billboards are cheap and fine at a distance; volumetric clouds cost too much for background. Today we have linear fog to a flat sky colour (D16).
- **Shadows** ([threejsresources.com/guides/shadows](https://threejsresources.com/guides/shadows)): size the directional light's shadow frustum to the scene extent and no more, `mapSize` 2048, tune `normalBias` before `bias`. We already follow the rider with a tight frustum; three 0.186 maps `PCFSoftShadowMap` to `PCFShadowMap` with a removal warning (the one in our logs), so the canvas uses `shadows={{ type: 1 }}` (PCF).
- **Terrain** ([threejsresources.com/guides/maps](https://threejsresources.com/guides/maps)): large terrain is tiled, with less detail per distant tile, and real elevation data plus map imagery as the texture is the standard way to show real geography. For us that means one window per section at 4 m and a coarse corridor tile for aerials, and the cached map tiles as a drape for the overview shots.
- **Materials** ([threejsresources.com/guides/materials](https://threejsresources.com/guides/materials)): `MeshStandardMaterial` is the realistic default; a normal map is the biggest upgrade for the least cost, then roughness and ambient-occlusion maps. Our terrain uses vertex colours only (D8); a ground normal or detail map would be the first step, and every texture set needs a licence entry.
- **Vegetation** ([threejsresources.com/guides/grass](https://threejsresources.com/guides/grass)): `InstancedMesh`, one draw call per kind, with level of detail by distance to keep counts bounded. Our two instanced tree kinds already follow this; sway must be driven by the frame number, never the clock (RN1).
- **Water** ([threejsresources.com/guides/water](https://threejsresources.com/guides/water)): a plane with an animated normal map and a reflection pass; three ships a `Water` class. The reflection pass is a second render per frame, so budget it (RN6), and its animation must be frame-driven for determinism (RN2).

Remotion constraints that still apply: `<ThreeCanvas>` forces `frameloop: 'never'` (ADR 1); `--gl=angle` per 3D command only (ADR 19); diagnostics through the Node API `onBrowserLog` (D22); the POC renders 360 frames in about 6 s, so a 2,700-frame reel should take a few minutes, not hours.

## 6. Carried open items

K2 lidar licence wording (release blocker); ADR statuses; trail width against
ATAG 2021 (K4); the km 9.00–9.02 dip; OSM way `270718795`; the 214 m start
offset; no structure inventory (Coflein and NLS not yet queried); landmark
labels on screen (t14 D6); the C1 test checks constants the view doesn't use
(t14 D2, for the Phase 3 cyclist component).

# Prior art for the water, readiness, clarity and buildings iteration

Mission `msn_33e838999675db739df3c922`, t1, 2026-10-25. The goal's full text is in ruflo memory
`ffestiniog-bikeride/3d-reel-v2/goal-full`. Everything below was read in the code or measured
on the data on that date. "Hypothesis" marks what a later test must confirm or refute.

## A. Water

- **Code.** `water.ts:15-21` keeps only the outer ring of each polygon (`p[0]`). The surface
  height is the median of the *rendered* ground along that ring (`:45-47`). `WaterView.tsx:31`
  triangulates with no holes (`triangulateShape(contour, [])`). It maps 2D *y* to world *z*
  (`:35`), lifts the surface 0.002 units (2 cm) and uses the default single-sided material
  (`:48`), with no `polygonOffset`.
- **Pipeline.** `fill_water` (`build_section_data.py:72`) flattens cells inside each *outer*
  ring to the shore median, so islands are levelled. The land-cover pass (`:251-259`)
  subtracts `properties.inner_rings`, which is correct for this data.
  `scripts/osm/fetch_bbox.py:82-90` assembles each relation's inner rings into
  `properties.inner_rings`; `:41` drops any ring it cannot close because members leave the
  box.
- **Data, measured.**
  - Holes are stored only in `properties.inner_rings`; no feature in any window has a
    hole in its geometry.
  - Llyn Trawsfynydd is relation `3084421`: **15 islands in the trawsfynydd window, 0 in
    the maentwrog window**, because the island ways cross that box's edge. This explains
    t14's "one lake, two heights" (197.2 m and 197.7 m).
- **Hypothesis H1: the water mesh faces down and is culled.** With *y* mapped to *z*, a
  triangle that winds anticlockwise in plan gets a −Y normal. The front-side material would
  then be culled from above, so the lake seen in the stills would be the terrain's
  land-cover water colour. That fits t14's "ripple not perceptible". Test: the sign of the
  normals, and a still rendered with and without `WaterView`.
- **Reusable.**
  - `ShapeUtils.triangulateShape(contour, holes)` already accepts holes.
  - `TrailView` and `RoadView` use `polygonOffset` (factors −2 and −1), the same fix for
    flicker against the terrain.
  - `tests/three-core/water.test.ts` covers the area filter and shore median.
  - The threejsresources water guide (threejsresources.com/guides/water, 2026-09-04)
    confirms the plane plus scrolling normal map. A reflection pass costs a second scene
    render, and ADR 32 keeps none.

## B. Frame readiness

- **Code.** All three providers share one pattern:
  - one `delayRender` per mount, created in `useState`:
    `Scene3DDataProvider.tsx:50`, `MapDrapeProvider.tsx:27`, `RouteDataProvider.tsx:16`;
  - a `cancelled` flag in the effect, but `.catch(cancelRender)` sits outside it
    (`:79`, `:73`, `:33`), so a rejection after unmount still cancels the render;
  - the hold is released in an effect after the children mount (spec RN5c; memory
    pattern 1).
- **Input changes.**
  - `Scene3DDataProvider` refetches when `section` changes (`:83`) but keeps the old
    `data` and does not re-arm the released hold.
  - `MapDrapeProvider` depends on `[dem, zoom, fill, handle]` (`:77`).
  - In the reel each `Series.Sequence` mounts `Section3D` with a fixed `section`
    (`Reel3D.tsx`), so a section change can only happen through a prop edit in Studio.
- **Errors.**
  - Scene data errors name the path, which includes `sections/<id>`, and the validators
    name the file.
  - The drape names the manifest or tile, but not the section.
  - A missing tile is painted in the fill colour and logged as `MAP_DRAPE missing` (ADR 33).
- **Coverage today.**
  - Covered: the RN5b/RL26/RL27 blank scan of the full sequential render and both frames of
    every cut; the static tests RN1, RN5a, RN5c and RN5d, which now include
    `MapDrapeProvider`.
  - Not covered: cold single-frame stills per section, and failed-asset or input-change
    cases.
- **Reusable.** The Remotion skill's 3D rules (`remotion-markup/3d.md`) match ours:
  `<ThreeCanvas>` with an explicit width and height, `useFrame` forbidden, and
  `layout="none"` on any `Sequence` inside a canvas.

## C. Visual clarity

- **Lighting** (`Lighting.tsx:15-32`):
  - hemisphere light, sky `#dfe8ee`, ground `#5c6a4a`, intensity 0.75;
  - sun at 2.2, colour `#fff4e2`;
  - shadow map 2048², frustum ±15 units (300 m), `normalBias` 0.02, bias −0.0002.
- **Materials.**
  - Trees are one `InstancedMesh` with vertex colours that casts shadows; t14 found them
    "very dark".
  - The trail is `#d8b06a`, roughness 0.8, `polygonOffset` −2. Roads are `#5a5a56`.
- **Framing.**
  - Every ground follow shot is 8 m back, 3 m up and 1.5 m to the side
    (`sections.ts:53-58`).
  - Trees keep 10 m clear of the trail (`trees.ts:33`). Occlusion of the rider has not been
    measured yet.
- **Captions, measured.** "Visible" means full opacity, i.e. the frame range less the
  15-frame fades.

  | Caption | Reading speed (target 15 characters/s) |
  |---|---|
  | heritage | **38.2** |
  | proposed-label (POC) | **32.5** |
  | closing (POC) | **26.4** |
  | section-title (POC) | **23.0** |
  | vale-title | **21.2** |
  | live-station | 19.3 |
  | decommissioning | 18.5 |
  | concept-card | 17.7 |
  | intro-title | 17.4 |
  | vale-north-title | 14.8 |
  | overview-title | 13.8 |
  | private-home | 12.8 |

  Only three captions are at or under 15.
- **Safe margins, measured on the 1920 × 1080 frame.** The 5 % title-safe area is 96 × 54 px.
  - The badge sits 28 px from the top and 32 px from the right.
  - The attribution sits 10 px from the bottom, in 12 px type.
  - The caption box sits 80 px from the left.
  - All three are outside the safe area.
  - Pinned by tests and to be kept: the badge text (RL17) and the closing card, verbatim
    (RL18).
- **Feature status.**
  - `FeatureCategory` already has verified, approximate, proposed and decorative
    (`registers.ts:4`).
  - None of it shows on screen; RL9/G8 failed at t14.
- **Reusable.**
  - `out/previews/<scene>.png`, written by `npm run test:render` (`--gl=angle`, same
    machine), and the `still()` helper in `scripts/render-checks.mjs` for fixed-frame
    before and after stills.
  - For a route locator: the 2D components `RouteStage`, `MapBasemap` and `ElevationStrip`,
    and `RouteDataProvider`.

## D. Buildings and landmarks

- **Footprints exist.** The ground windows hold **1,360 building polygons**: blaenau 879,
  vale-north 219, vale-south 50, maentwrog 40, trawsfynydd 172. The corridor window fetches
  no OSM. (This corrects an earlier count of 0, which read the tags at the wrong level.)
- **Tags were stripped.** The t9 allowlist `KEEP_TAGS` (`build_section_data.py:40-56`)
  reduced each one to `building=yes` and dropped `height`, `building:levels`, `roof:shape`,
  the building type and names. Landmark types and heights therefore need a widened,
  still-minimised allowlist and a fresh fetch.
- **The register lacks the required provenance.** `Feature` (`registers.ts:24-35`) has `id`,
  `kind`, `category`, `source {type, ref}` (types include `coflein`), `scenes`, `gapRefs`,
  `note` and `fromKm`/`toKm`. It has no observed or retrieved date, licence, confidence or
  status (existing, construction, approved, demolished).
- **Binding ADRs.** ADR 12 (model only sourced structures), ADR 20 (register before render),
  ADR 38 (no OSM text on screen).
- **Heights.** The Welsh lidar **DSM** COG sits beside the DTM on the allowlisted host:
  `cogs/lidar/wales_dsm_32bit_cog.tif`, 52,096,926,263 bytes, Last-Modified 2024-10-04.
  That date is publication, not survey; the survey date is still to be sourced. So
  DSM − DTM through the existing reader (`scripts/dem/cog.py`) can give measured heights
  under OGL.
- **Precedents.** `BridgeView` is a generic structure registered as approximate; the trees
  are instanced in one draw call; materials are shared.
- **Window extents**, for checking candidates (WGS84):

  | Window | Longitude | Latitude |
  |---|---|---|
  | blaenau | −3.9443 to −3.9201 | 52.9786 to 52.9997 |
  | vale-north | −3.9414 to −3.9093 | 52.9571 to 52.9903 |
  | vale-south | −3.9449 to −3.9137 | 52.9404 to 52.9689 |
  | maentwrog | −3.9538 to −3.9270 | 52.9255 to 52.9521 |
  | trawsfynydd | −3.9497 to −3.9046 | 52.9000 to 52.9374 |

  A landmark outside these boxes, or out of every shot, needs a scope decision.
- **Triangle budget.**
  - Trawsfynydd's worst frame, 2399 with the premounted closing scene, uses 1,936,811 of
    2,000,000 triangles (97 %; t12). Buildings there need headroom planned first, for
    example from the 2,500-per-kind tree cap.
  - Maentwrog's worst frame uses 1.10 M (55 %).
- **Reusable checks.** The t14 validator's `section-check.ts` and `cam-speed.ts` (in the
  session scratch, not the repo) ran CA1–CA4, the tree and road checks on every section;
  candidates to adopt as tests.

## E. ADRs and memory reused

- **ADRs**, all Proposed: 4 props into the canvas · 11 and 37 vegetation · 12 sourced
  structures · 16 and 35 shots · 18 and 30 sun, sky and fog · 19 `--gl=angle` · 20 registers
  · 23 decks out of the profile · 24 lazy compositions · 29 windows · 31 relief shading ·
  32 water · 33 drape · 36 captions as data · 38 curated on-screen text · 39 budgets per
  section and at cuts.
- **ruflo patterns.**
  - ReasoningBank pattern 1: rendering rules, and release holds after mount.
  - Patterns 3 and 6: process lessons. Check per section inside the build, audit the docs
    right after it, and count "fully visible" without the fades.
  - Pattern 8: realism priorities.
  - Memory keys `ffestiniog-bikeride/3d-reel/{t7-build,t10-review,mission-outcome}` and the
    t14 report.
- **Claude memory.**
  - `three_js_upgrade_decision.md`: two ground heights, DTM decks, `--gl=angle`.
  - `ruflo_memory_store_split.md`: read back after storing.
  - `ruflo_console_limits.md`.

## F. Not yet researched (later tasks)

- Which landmarks each shot sees.
- Dated imagery, Coflein and Cadw records, and OSM history for each candidate.
- The current state of the Trawsfynydd power-station buildings, whose reactor buildings are
  being reduced in height.
- The lidar survey dates.
