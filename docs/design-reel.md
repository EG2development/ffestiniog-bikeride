# Reel design (moved from docs/design-3d.md on 2026-10-29, unchanged)

This part of the design was moved here whole so that `docs/design-3d.md` stays under the 500-line limit after the photoreal layer's interfaces were added. The pure-core block and the tests table remain in `docs/design-3d.md` (kept equal to the code by `tests/docs.test.ts`).

# Reel design (mission `msn_44274a1de641722956fc9ce5`, task t3)

Implements the reel extension of `docs/spec-3d.md` (RL1–RL34) on the shipped
proof of concept. Nothing above is withdrawn: the pure core stays pure (ADR 3),
every point still goes through `project()` (ADR 5), every composition is
separate and lazy (ADRs 2, 24), and the 2D video is untouched (RL25). Every
interface in this part has shipped: the pure-core block above is the shipped one,
kept equal to the exports by `tests/docs.test.ts` (this part was brought into line
at t13). The step-by-step logic is `docs/pseudocode-reel.md` (t5). The water, readiness, clarity
and buildings iteration (decisions D37–D48) is designed in `docs/design-reel-v2.md`.

## Shape of the reel

```text
data pipeline (once per window)                        runtime (one Remotion render)
──────────────────────────────────                     ──────────────────────────────────────────────
scripts/build_section_data.py --section <id>           src/scenes3d/Reel3D.tsx  (2,700 frames, 16:9)
  reads SECTIONS (km range, COG level, margin)            └─ <Series> of 9 <Series.Sequence> (scene 5 is
  ─ lidar COG window at 4 m or 16 m ─┐                      two) in the frame budget of the spec; each
  ─ OSM bbox fetch (ground only) ────┼─▶ public/data/sections/<id>/   renders one statically imported Section3D
  ─ trail profile (ADR 23 spans) ─────┘      dem.json .f32 -source.u8       (premounted 2 s by remotion.config.ts;
  ─ registers: data/features-<id>.json       landcover.json .u8              the lazy boundary is src/Root.tsx)
    (+ gen-earthworks.ts --section <id>)     trail-profile.json          src/scenes3d/Section3D.tsx
                                             osm.geojson                  = Section3D({ section })
                                                                             RouteDataProvider (existing)
src/data/reel-timeline.ts  ── frame budget ──▶ Reel3D, tests (RL2)           Scene3DDataProvider({ section: window })
src/data/reel-captions.ts  ── captions ──────▶ overlays, tests (RL17–22)      merges features-3d + features-<window>
                                                                             ▼ props only (ADR 4)
                                                                           buildSectionScene(config, inputs)   [three-core]
                                                                             ▼
                                                                           <ThreeCanvas> SkyDome · Lighting · Terrain
                                                                             Trail · Roads · Bridges · Water · Trees
                                                                             Cyclist · CameraRig · (MapDrape for aerials)
```

## Decisions (each gets an ADR in t4, numbered from 27)

| # | Decision | Why |
|---|---|---|
| D23 | **A section config replaces the POC constants.** `SectionConfig` (id, title, kind `ground`/`aerial`, km range, data window id, rider start, shots, caption ids, feature ids, frame count, and an optional `maxTreesPerKind`, 2,500 on trawsfynydd) is the only per-section input; one `buildSectionScene(config, inputs)` assembles every section. `poc.ts`'s contents move to `sections.ts` (`poc.ts` survives as a re-export shim), and `POC` stays as the Maentwrog entry so the existing tests and `Poc3DMaentwrog` keep working. | RL4, P3-1. No copied assembly per section. |
| D24 | **One master composition, `Reel3D`,** a Remotion `<Series>` of 9 `Series.Sequence`s (scene 5 is two: `vale-north`, `vale-south`) in the spec's frame budget, each rendering one statically imported `Section3D({ section })`; the lazy boundary is `Root.tsx`. Every section is also registered on its own (stills, checks). The frame budget lives in `src/data/reel-timeline.ts`; a test compares it with the spec table (RL2). Cuts are hard cuts; `Config.setDefaultPremountInSeconds(2)` (already set) mounts the next section 60 frames early so its first frame is complete. | RL1, RL2, RL27. |
| D25 | **Data windows:** `SECTIONS` in the pipeline: `corridor` km 0–13.24 at **16 m** (scenes 1, 2, 3, 8), `blaenau` km 0–1.5, `vale-north` km 1.5–4.8, `vale-south` km 4.8–7.7 (holds Llan Ffestiniog, km 5.33), `maentwrog` km 7.7–9.7 (exists), `trawsfynydd` km 9.7–13.24, the ground windows at **4 m** with a 600 m margin. Files under `public/data/sections/<id>/`; `Scene3DDataProvider` takes `section` and validates each file as now. The scene-5 ride is split: `vale-north` from frame 1080, `vale-south` from frame 1350 (two sequences inside the 540). | RL5–RL7; spec open item 1 (two Vale windows). Ground meshes are ≤ 1.61 M triangles (trawsfynydd, 788 × 1,023 nodes; vale-north 1.02 M), hence trawsfynydd's lower tree cap (D23); the corridor is 310,950 (≤ 400 k). |
| D26 | **Sky and atmosphere without assets:** a `SkyDome` view (an inside-out sphere with a zenith-to-horizon gradient and a sun disc at ADR 18's azimuth and elevation) and `FogExp2`, both from one `atmosphere.ts` record, `ATMOSPHERE: Record<SectionKind, Atmosphere>` (zenith, horizon, fog density, sun azimuth and elevation), with `fogColour(kind)` and `sunDirection`. The fog colour **is** `ATMOSPHERE[kind].horizon`, so RL11's equality is by construction and a test reads both. No HDRI, no `Sky` addon. | RL11; deterministic, licence-free, cheap (threejsresources sky-and-clouds guide: fog colour must match the sky). |
| D27 | **Terrain relief without textures:** `shading.ts` (pure) multiplies each vertex's land-cover colour by a slope factor and a height tint from the DEM gradient; `TerrainView` uses `MeshStandardMaterial` (roughness 0.95, metalness 0) with vertex colours. A detail normal map is deferred until a CC0 texture is registered (spec open item 5). | RL10, L1. |
| D28 | **Water from OSM polygons:** `water.ts` (pure) takes `natural=water`, `waterway=riverbank` and `landuse=reservoir` polygons ≥ 1 ha inside a window, projects the outer rings, and sets the surface at the shore height (median DTM height along the ring; in the pipeline, DTM nodata and outliers more than 2 m from that median inside the polygon are replaced by it). `WaterView` triangulates each outer ring with `ShapeUtils.triangulateShape` into a hand-built `BufferGeometry` (no holes) and animates a normal offset from the frame number. No reflection pass in P4 (budget, determinism). | RL14; spec open item 4; lidar DTMs are noisy or nodata over water (risk K10). |
| D29 | **Aerials drape the cached map tiles.** Scenes 1, 2, 3 and 8 render the 16 m corridor DTM with the OpenTopoMap tiles (the cached z15 layer, already credited; every aerial uses zoom 15) as a texture: `tileUv.ts` (pure) gives each vertex a UV into a composite canvas; `MapDrapeProvider` loads the tiles behind `delayRender` outside the canvas and passes the canvas as a prop. Land-cover colours are not fetched for the whole corridor. | RL6, L2; spec open item 3. The 2D video already uses these tiles, so the look is consistent and the credit exists. |
| D30 | **The cyclist is built from `CyclistDims`:** `cyclistModel.ts` (pure) emits parts (capsules, spheres, tori; no boxes) in bike space centred on the bottom bracket, including the two-bone leg solve; only the wheel diameter and wheelbase come from the dims, while the frame points, hip, shoulder, head and the leg lengths (thigh 0.45 m, shin 0.47 m) are constants in the model; `CyclistView` only maps parts to meshes. The C1 test measures the parts' bounding box. A rigged model stays out until its own ADR and register entry (ADR 14). | RL16; t14 D2. |
| D31 | **Shots per section from a spec:** `ShotSpec` is a union (`drone-side`, `follow`, `aerial-orbit`, `pull-back`, `hold`); `shotsOf(config, scene)` builds the `Shot` sequence. `camera.ts` gains `aerialOrbit` and `pullBack` (eased like the drone). Ground shots keep `withClearance` (2 m, 1.5 m); aerial shots are first lifted by one constant for the whole shot (`liftClear`, 20 m, so the path stays smooth), then pass through `withClearance` with 20 m and no rider minimum. CA1–CA4 run through `criteria.ts` on the POC (poc-acceptance) and on a synthetic orbit and pull-back (camera.test.ts); there is no per-section run on real data. | CA1–CA4 per section; the storyboard's camera notes. |
| D32 | **Captions are data:** `src/data/reel-captions.ts` lists `{id, text, from, to, position, scene}` for 11 reel captions: the disclaimer and attribution (all frames), four titles (`intro-title`, `overview-title`, `vale-north-title`, `vale-title`), the heritage note, live station, private home, decommissioning site and concept card; `POC_CAPTIONS` holds the proof of concept's own five. `position` is top-left, bottom-left, bottom-center, badge or attribution. Overlays render from it with `data-overlay`; a test checks RL17–RL22's frame ranges and minimum durations; `OverlayLog` stays the render-time truth. | RL17–RL22; one source of truth, no caption written inline. |
| D33 | **Vegetation in two tiers:** instanced 3D trees inside woodland within 300 m of the trail (the near zone), capped at 6,000 per kind or the section's `maxTreesPerKind`; beyond it, woodland is shown by the land-cover colour only. The keep probability targets 4 per 100 m² of near-zone woodland (`densityPer100m2`) from the node spacing, held under 0.9 × cap / (0.55 × candidates) so the cap thins the wood evenly. Production passes `{ roads, ve, maxTrees? }`; the 1–15 per 100 m² band (RL13 as amended below) is asserted by the test, not passed in production. | RN6 per section; the grass guide's distance-based detail. |
| D34 | **Labels come only from curated files.** On-screen place and feature text is read from `reel-captions.ts` or a register `note`, never from an OSM tag at render time (nothing under `src/scenes3d` or `src/three` reads `waypoints.json`); a static test forbids `tags.` inside JSX text, and the pipeline writes only a tag allowlist (`KEEP_TAGS` in `build_section_data.py`), copying just `highway=<value>` into register notes. | RL31; the security review's PII note (Maentwrog Road is a private home). |
| D35 | **Performance is checked per section and at cuts.** The render checks run `renderer.info` at one frame per section and at the last frame before each cut (239, 479, …, 2399, where the premounted next section also exists), against RN6. | RL24; premount doubles the canvases for 60 frames (risk K7). |
| D36 | **The Maentwrog section is the migration test.** `Poc3DMaentwrog` is re-expressed as `SECTIONS.maentwrog` through the new assembly before any other section is built; its existing acceptance tests and the render checks must pass unchanged, except the triangle count, which the realism work changes. | De-risks the refactor; keeps RN2 and the POC's evidence meaningful. |

### Spec amendments made by this design (reel)

- **RL13:** the density band (1–15 per 100 m²) applies to woodland within 300 m of the trail; farther woodland is shown by land cover only (D33).
- **RL6:** the aerial drape (D29) replaces land-cover colouring for the corridor window; the CC-BY-SA tile credit is added to RL22's attribution for aerial scenes.

## Modules to add or change

| Module | Kind | Owner task | Note |
|---|---|---|---|
| `src/three-core/sections.ts` (takes over from `poc.ts`, kept as a re-export shim) | pure | t7 | `SectionConfig`, `ShotSpec`, `SECTIONS`, `shotsOf`, `buildSectionScene`, `followStartFrame`, `POC` (D23, D31) |
| `src/three-core/atmosphere.ts`, `shading.ts`, `water.ts`, `tileUv.ts`, `cyclistModel.ts` | pure | t7 | D26–D30 |
| `src/three-core/camera.ts` | pure | t7 | `aerialOrbit`, `pullBack`, `liftClear` (D31) |
| `src/three-core/trees.ts` | pure | t7 | near-zone and density parameters (D33) |
| `src/three/SkyDome.tsx`, `WaterView.tsx`, `MapDrapeView.tsx` | view | t7 | D26, D28, D29 |
| `src/three/CyclistView.tsx`, `TerrainView.tsx` | view | t7 | parts from the core (D30); `MeshStandardMaterial` (D27) |
| `src/data/reel-timeline.ts`, `reel-captions.ts` | data | t7 | D24, D32 |
| `src/data/Scene3DDataProvider.tsx`, new `MapDrapeProvider.tsx` | runtime | t7 | `section` prop; tile loading behind `delayRender` |
| `src/scenes3d/Reel3D.tsx`, `Section3D.tsx` | composition | t7 | D24; one `Section3D({ section })` for every scene; `PocMaentwrog.tsx` becomes a wrapper around it (D36) |
| `src/Root.tsx` | registration | t7 | lazy entries only (ADR 24) |
| `scripts/build_section_data.py` (generalises `build_poc_data.py`) | pipeline | t7 | `--section <id>`, `SECTIONS` table, water fill (D25, D28) |
| `scripts/render-checks.mjs` | checks | t12; reel v2 | the reel: RN2 on 0/1349/2699, blank scan, per-section and boundary `renderer.info`, previews; reel v2: fresh-process stills, `MAP_DRAPE`, overlay rects, X1, X2, CL1 and the still metrics, GPU encoding |
| `data/features-3d.json`, `data/features-<id>.json` | registers | t7 | per-window entries from the pipeline and `gen-earthworks.ts --section`, merged at load by `mergeRegisters` (RL7); no `gapRefs` are written, so RL9's gap entries are a limitation the spec records |

### Shipped interfaces

The reel's pure-core interfaces are the `sections.ts` to `camera.ts` additions in the pure-core block above; the planned block that stood here is withdrawn (it keyed `SECTIONS` by the six windows rather than the nine scene ids and lacked `liftClear`, `followStartFrame` and the `back` direction of `pullBack`). Outside the core, `src/data/reel-timeline.ts` exports `REEL_FPS`, `REEL_FRAMES` and `REEL_SCENES: ReelScene[]` (`{ id, section, config, from, frames }`, nine entries), and `src/data/reel-captions.ts` exports `Caption` (`position`: top-left, bottom-left, bottom-center, badge, attribution), `CAPTIONS` and `POC_CAPTIONS`.

### Tests added at t6

Every test planned at t6 exists and is listed in the tests table above: sections, reel-timeline, reel-captions, atmosphere, shading, water, tileUv, cyclistModel, the trees (RL13) and camera (ADR 35) additions, the static rules RL3, RL30 and RL31, and section-acceptance.

## Risks (reel)

| # | Risk | Handling |
|---|---|---|
| K6 | The corridor OSM fetch for water and roads is large (13 km × 3 km). | Fetch per ground window only; the corridor window fetches no OSM at all (0 features, `source: "none"`) and is draped with the map tiles (D29). |
| K7 | Premount doubles the mounted canvases for 60 frames at each cut. | D35 measures the boundary frames; if RN6 fails there, drop the premount to 1 s for the sections. |
| K8 | The tile drape needs the CC-BY-SA credit on every aerial frame. | RL22 as amended; the one attribution string in `reel-captions.ts` carries it on every frame of the reel. |
| K9 | Two Vale windows show a seam if a shot crosses the boundary. | No shot crosses a window boundary: scene 5 is two sequences with a hard cut (D25). |
| K10 | The lidar DTM has nodata or noise over Llyn Trawsfynydd. | The pipeline replaces nodata and outliers (> 2 m from the shore median) inside water polygons with the shore height and records the count in the DEM header (D28; 3,960 cells on trawsfynydd); the fill is registered as approximate. |
| K11 | A section's rider covers only 40–80 m, so landmarks fall outside the ride. | Landmarks appear in the drone and aerial shots; `startDistM` per section is chosen next to the landmark the storyboard names. |
