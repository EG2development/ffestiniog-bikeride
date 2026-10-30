# Design: water, readiness, clarity and buildings (reel, iteration 2)

Status: written 2026-10-25 for mission `msn_33e838999675db739df3c922`, task t3.

| Input | Where |
|---|---|
| Spec rows WA1–WA7, RD1–RD7, CL1–CL14, BL1–BL18, X1–X5 | `docs/spec-3d.md`, "Specification extension: water, readiness, clarity and buildings" |
| Findings with file:line | `docs/prior-art-3d.md`, "Prior art for the water, readiness, clarity and buildings iteration" |
| The goal, in full | ruflo memory `ffestiniog-bikeride/3d-reel-v2/goal-full` |

This file holds the design because `docs/design-3d.md` is close to the 500-line limit.
`docs/design-3d.md` stays the binding record. When code lands (t7), its pure-core interface
block and tests table gain the exports and test files named here; `tests/docs.test.ts`
enforces this. Decisions D37–D48 become ADRs from 41 (t4).

## Shape

```
                       ┌─────────────── pipeline (Python, run on demand, network: 2 allowlisted hosts) ───────────────┐
 OSM API ──fetch_bbox (+ relation/<id>/full for water) ──► osm.geojson ──┐
 lidar DTM COG ──────────────────────────────────────────────────────────┼─► build_section_data.py ──► dem.f32 (islands kept)
                                                                          │      ├─ polygon_rings(): outer + holes per part (D37)
                                                                          │      └─ water levels, once per body ──► data/water-levels.json (D38)
 lidar DSM COG ─► build_buildings.py ◄── footprints from osm.geojson     │
 curated data/landmarks.json (sources, dates, status; screened) ─────────┴─► sections/<id>/buildings.json + register entries (D45, D47)
                       └──────────────────────────────────────────────────────────────────────────────────────────────┘
 runtime:  Scene3DDataProvider ─useLoadGate (D39)─► { dem, land, osm, profile, features, buildings, waterLevels }
           MapDrapeProvider ───useLoadGate────────► graded drape canvas (D42)
           buildSectionScene ─► water (polygons, level) · trees (keep-out from shots, D43) · buildings (D46)
           Section3D ─► views (one LIGHTING source, D42; mask mode for checks only, D40) + overlays (safe area, D44)
 checks:   vitest (pure core, gate, geometry, captions, registers, python self-test)
           render-checks (fresh-process stills, mask metrics, overlay rects, budgets) · stills.mjs before/after (D41)
```

## Decisions (ADRs 41–53; D37 → ADR 41 … D48 → ADR 52, and ADR 53 from t8), as built

Each decision as it shipped (t7–t12). Where the build departed from the t3 plan, the row says so.

| # | Decision | Satisfies | Notes |
|---|---|---|---|
| D37 | **One polygon normaliser for water**, in the core (`polygonsOf`) and the pipeline (`polygon_rings`). It returns outer + holes per part, from geometry holes and from `properties.inner_rings`. Each inner ring goes to the part that holds most of its vertices, so an island whose first vertex lies on the shore is kept (t10). Outer rings are anticlockwise in lon/lat and holes clockwise. The mesh is built by `src/three/waterGeometry.ts` with `ShapeUtils.triangulateShape(outer, holes)`; every triangle facing down has its index order flipped. The material stays `FrontSide`, because `DoubleSide` would hide a winding error. The surface sits exactly at the lake level, drawn over the terrain with `polygonOffset` (−2, −2) and no lift. | WA1–WA3, WA6, WA7 | amends ADR 32 |
| D38 | **One level per water body, computed once.** For each water body of at least 1 ha in a ground window, the pipeline reads the lidar DTM at the 4 m level. The level is the median of samples every 5 m along the largest outer ring. It is written to `data/water-levels.json` as `{id: {levelM, samples, cogLevel, retrieved}}`, and every window's fill and the runtime use it. The fill sets the level inside the outer ring minus the holes, for nodata, outliers more than 2 m away and any ground above the level (t10: that ground rose through the surface). Island cells keep their height. Every water multipolygon relation is replaced by `/api/0.6/relation/<id>/full`; a relation the box cuts is kept as a placeholder so it can be completed (t10). The lake windows (vale-north, maentwrog, trawsfynydd) are rebuilt with `--reuse-osm`. That restores overbridge ways an older `osm.geojson` lacks, and keeps the register's building and earthwork entries. | WA4, WA5, WA7 | The spec's default was no new fetch. That changes here, because restoring island terrain needs the original lidar anyway. Amends ADRs 29 and 32. |
| D39 | **One load gate for every provider**, built where a test reproduced a fault (RD7). `createLoadGate({ label, delay, release, cancel })` in `src/data/loadGate.ts` is a pure state machine with `delayRender`, `continueRender` and `cancelRender` injected.<br>It takes one hold per input: `hold(key)` runs in the render body (t7: a hold taken in an effect let a parallel render capture black frames after cuts), and `start(key, load, onData)` reuses that hold. It passes an `AbortSignal`, ignores settles from a superseded input or after `dispose`, calls `cancelRender` only for the current input, and releases the hold after the children mount (RN5c).<br>The hook's data carries its key, so the render with a new input never returns the old data (t10). Effects run again after a cleanup make a fresh gate. Errors are `AssetLoadError` (`section <id>: <path>: <reason>`), with a `label` prop for the section id. `memoOnSuccess` lets the aerial scenes share one drape per tab (t8). | RD1–RD5 | new ADR |
| D40 | **Mask renders for measurement only.** `Section3D` takes `mask` (`water`, `water-expected`, `trees`, `trees-sun`, `trail`, `roads`, `terrain`, `buildings`, `landmarks` or `cyclist`) and `hide: "water"`.<br>Under a mask every material is unlit black and the class is white. `water-expected` is the water mesh with both faces; `trees-sun` is a white Lambert lit by the sun alone, which gives the shade-side pixels. Fog, the hemisphere light, the sky and the overlays are off.<br>`stills.mjs` renders the normal still, each mask and the `clean` and `nowater` extras; `still_metrics.py` measures them. The reel and Root never set either prop (static test K14). | WA6, WA7, CL2, CL4, CL6, BL13 | new ADR |
| D41 | **Before and after stills from one script.** `scripts/stills.mjs <dir>` bundles once and renders a fixed `FRAMES` table: Trawsfynydd and Maentwrog at four frames each, and one frame for each other scene. For ground stills it adds `clean` and `nowater`, plus the next Trawsfynydd frame. It uses `--gl=angle`, scale 1 and one port.<br>It writes `manifest.json` with the platform, arch, Node, Remotion, Chrome, GL and scale, and the snapshot from `scripts/snapshot.mjs`: the tree hash of `git stash create` (HEAD's when clean), plus a hash of the untracked files outside the tool-state folders. The before set is `out/before-masks`. The render checks re-render `out/after` when the snapshot changes. | CL1, X3 | |
| D42 | **Clarity is tuned as data from one source.** `atmosphere.ts` holds `LIGHTING` (unchanged values) and `DRAPE_GRADE`; `trees.ts` holds `TREE_COLOURS`, `TREE_FILL` and the crown shapes.<br>Shade-side form comes from `TREE_FILL`, a fill on the tree material (0.08 since t10), with the crowns darkened to keep the sunlit side. It is the largest value that keeps every still within CL3. The trail colour is unchanged (CL4 passes).<br>The aerial drape is graded by `gradeDrapePixels`: only near-neutral map paper (HSV saturation below 0.2) is tinted towards the ground palette, at its own luma. Water, roads, woods and contours keep their colours. A whole-drape colour blend passed CL6 but turned rivers green, and was rejected. | CL2–CL4, CL6 | amends ADRs 18, 31 and 33 |
| D43 | **The rider stays visible by construction.** Every frame's line from the camera to the rider (1 m up) goes to `placeTrees` as `sightLines`; no decorative tree whose crown (`CROWN_SPHERES`) crosses one is placed. The spheres enclose `CROWN_SHAPES`, the cone and icosahedron `TreesView` draws (t10: the first set missed the cone tips). Sourced features never move. The occlusion test checks every frame of both ground shots against the drawn shapes. The planned `cameraKeepOut` corridor and `occlusion.ts` were not needed; `keepOut` remains in `TreeOptions`, unused. | CL5, CL7 | amends ADR 37 |
| D44 | **Overlays inside the safe area, captions sized to read.** `Overlays.tsx` exports `SAFE = { x: 96, y: 54 }` and the style tokens, `LEGEND_STYLE` included. `OverlayLog` logs `OVERLAY_RECTS [{id, x, y, w, h, right, bottom, lines}]`. Captions are shortened or retimed in `reel-captions.ts` to at most 15 characters/s and at least 2.5 s; the badge and closing-card texts stay verbatim. Bridges, the approximate structures drawn, are hatched. `sectionLegend` names the hatching in ground scenes only, and the translucent style if any building has it, from curated text (ADR 38). | CL7–CL12 | amends ADR 36 |
| D45 | **Building data from sources only.** Footprints come from each window's `osm.geojson`.<br>`scripts/building-candidates.ts` lists those the shots see, each tested at its measured height from `data/building-heights-<w>.json` (unmeasured ones at a 60 m bound), in two passes with `build_buildings.py` (t7). Footprints that run off the terrain window are left out (t10).<br>`build_buildings.py` re-fetches the candidate ways and relations, with their dates; it keeps only `building`, `building:levels`, `height` and `roof:shape` (BL17) and skips deleted ways. Heights are the 90th percentile of DSM − DTM at the 2 m level; otherwise levels × 3 m (1–30 levels) or 6 m, marked approximate.<br>`data/landmarks.json` holds curated entries with sources, dates, licence, confidence, status, model and their screening record (BL18); only `featured` entries are drawn as landmark models. It writes `sections/<w>/buildings.json` and the register entries. | BL1–BL6, BL11, BL15–BL18 | new ADR; keeps ADRs 12 and 20 |
| D46 | **How buildings are drawn.** All of a section's buildings merge into at most two groups, existing and translucent (approved or demolished), with one shared vertex-coloured material: stone walls, slate roofs. That is at most 2 draw calls.<br>Walls run from the lowest rendered ground under the footprint, sampled every 2 m along each wall, to the eaves; the recorded height is the ridge. A roof is gabled only on a true rectangle once collinear nodes are dropped, else flat. Landmark parts (nave, tower, pitched and pyramid roofs) go into the same groups, along the footprint's principal axis with the tower at the west end.<br>There is no level of detail or instancing: 156 footprints are drawn. This decision is reversed if BL12 fails. | BL5, BL7–BL10, BL12–BL14 | new ADR |
| D47 | **Register schema.** `Feature` gains `status` (existing, construction, approved or demolished) and `provenance` (`urls`, `evidence`, `observedAt`, `retrievedAt`, `licence`, `confidence`). Both are required for a building, whose source type must be `osm`, `coflein` or `lidar-dtm`. Dates must be calendar dates with `observedAt` no later than `retrievedAt`, and the 3-year confidence cap is a calendar rule (t10). | BL2–BL4, BL16 | amends ADR 20 |
| D48 | **Budgets are measured before and after.** Section-by-section load and the frame before each cut are re-measured after each track (RL24/BL12 in the render checks: 64 calls and 1.94 M triangles at frame 2399). If Trawsfynydd's frame 2399 goes over, the tree cap is lowered first and the buildings stay. | BL12, RL24 | keeps ADR 39 |

## Modules and interfaces (as built; exact pure-core signatures are in `docs/design-3d.md`)

| File | Change | Interface |
|---|---|---|
| `src/three-core/water.ts` | changed | `WaterPolygon`, `WaterBody`; `polygonsOf(geometry, innerRings?)`; `waterBodies(osm, project, heightAt, minAreaM2, levels?, ve?)`. The area counts outer minus holes; the level is `levels[id] / 10 * ve`, otherwise the median along the outer rings. |
| `src/three/waterGeometry.ts` | new (three, no React) | `waterArrays(polygons, y): { positions, indices }`: every triangle faces up; vertices read after triangulation |
| `src/three/WaterView.tsx` | changed | uses `waterArrays` and `polygonOffset`; no lift |
| `scripts/build_section_data.py` | changed | `polygon_rings`, `fill_water(..., levels)`, `water_levels`, `merge_water_levels`, `keep_owned`, `--reuse-osm`, `--self-test` |
| `scripts/osm/fetch_bbox.py` | changed | `complete_water_relations(feats)` for every water relation (cut ones kept as placeholders); `fetch_relation_full(id)`; `fetch_way_full(id)` |
| `src/data/loadGate.ts` | new | `createLoadGate({ label, delay, release, cancel })` returns `{ hold(key), start(key, load, onData): gen, mounted(gen), dispose() }`; `useLoadGate<T>(label, key, load): T \| null`; `class AssetLoadError extends Error { section; path }` |
| `src/data/memoOnSuccess.ts` | new (t8) | `memoOnSuccess(load)`: successful loads kept by key for a render tab; failures and aborts are not kept, and in-flight loads are not shared. Kept out of `loadGate.ts`, which the 2D entry chunk loads |
| `src/data/Scene3DDataProvider.tsx`, `MapDrapeProvider.tsx`, `RouteDataProvider.tsx` | changed | on `useLoadGate`; `Scene3DData` gains `buildings` and `waterLevels`; the providers take a `label` (section id) for errors; the tile manifest is validated |
| `src/three-core/atmosphere.ts` | changed | `LIGHTING`; `DrapeGrade`, `DRAPE_GRADE`, `gradeDrapePixels(data, grade)` |
| `src/three/mask.ts` | new | `Mask`, `MaskClass`, `maskColour(mask, cls)` |
| `src/three/Lighting.tsx`, `SkyDome.tsx`, `TreesView.tsx`, `MapDrapeView.tsx`, `TrailView.tsx`, `RoadView.tsx`, `BridgeView.tsx`, `TerrainView.tsx`, `CyclistView.tsx` | changed | read `LIGHTING`, `TREE_COLOURS`, `TREE_FILL` and `CROWN_SHAPES`; take a `mask` prop; bridges are hatched |
| `src/three-core/trees.ts` | changed | `TreeOptions` gains `keepOut?`, `sightLines?` and `footprints?`; `TREE_COLOURS`, `TREE_FILL`, `CROWN_SHAPES`, `CROWN_SPHERES` |
| `src/three/Overlays.tsx` | changed | exports `SAFE` and the four style tokens; `Legend`; `OverlayLog` logs rects with right and bottom edges and line counts |
| `src/data/reel-captions.ts` | changed | shorter or retimed texts; `LEGEND`, `legendLines`, `sectionLegend` |
| `src/three-core/visibility.ts` | new | `visibleFootprints(poses, footprints, heightAt, opts?): string[]` (frustum plus terrain ray march, one list over all poses) |
| `src/three-core/buildings.ts` | new | `buildingBase(ring, heightAt)`; `buildingArrays(records, heightAt, ve, landmarks?)`; `sectionBuildings(list, status, project, heightAt, ve)`; `landmarkParts(model)`; `footprintOverlap(a, b)`; `segmentsInFootprints(lines, fps)` |
| `src/three/BuildingsView.tsx` | new | `BuildingsView({ groups, landmarkGroups?, mask })`, `BUILDING_COLOURS` |
| `src/three-core/registers.ts` | changed | `FeatureStatus`, `FeatureProvenance`; `SectionBuilding`, `validateBuildings(raw, file)`; `TilesManifest`, `validateTilesManifest(raw, file)`; `KINDS` gains `building` |
| `src/three-core/sections.ts` | changed | passes `sightLines`, `footprints`, `waterLevels` and buildings into the scene; `SectionScene` gains `buildings` |
| `src/scenes3d/Section3D.tsx` | changed | props `mask?` and `hide?`; renders `BuildingsView` and the legend |
| `scripts/building-candidates.ts` | new | `npm run data:candidates -- --section <w>`: `data/building-candidates-<w>.json` |
| `scripts/build_buildings.py` | new | `--section <w>`, `--self-test`: candidates → DSM − DTM p90 heights → `sections/<w>/buildings.json`, register entries, `data/building-heights-<w>.json` |
| `scripts/stills.mjs`, `scripts/snapshot.mjs`, `scripts/still_metrics.py` | new | the stills and manifest; the snapshot and environment; the metrics (`--self-test`) |
| `scripts/render-checks.mjs` | changed | fresh-process stills (RD1, RD2), `MAP_DRAPE` lines (RD6), overlay rects (CL9, CL10), X1 md5, X2 against HEAD, CL1, the metrics (WA6, WA7, CL2–CL4, CL6), BL12 with RL24, a BL13 placeholder; GPU encoding for 3D renders (ADR 53) |

## Data files

- `data/water-levels.json` (new): `{ "<osm id>": { levelM, samples, cogLevel, retrieved } }`.
  Synced to `public/data/` by `data:sync`.
- `data/landmarks.json` (new): `[{ id, name, osm: "way/<id>", featured, status, observedAt,
  confidence, licence, sources: [{ url, kind: map|imagery|record|photo, observedAt, retrievedAt,
  licence, note }], model: { type, roof, lengthM, widthM, heightM, towerHeightM?, approximate },
  screened }]`. Names are curated text (ADR 38).
- `public/data/sections/<w>/buildings.json` (new): `[{ id: "building-<w>-<osmid>", osm, footprint,
  heightM, heightSource: lidar-dsm|levels|default, roof, kind: background|landmark, status, type,
  curated?, landmark?, model? }]`.
- `data/building-candidates-<w>.json` and `data/building-heights-<w>.json` (new): the visible
  footprints with the height each was tested at, and every height measured so far.
- `data/features-<w>.json`: `kind: "building"` entries carry `status` and `provenance` (D47).

## Checks (spec ID → where)

**Unit tests**

| Spec | Test file |
|---|---|
| WA1–WA3 | `tests/water-geometry.test.ts`; `tests/three-core/water.test.ts`; `tests/three-core/water-holes.test.ts` |
| WA4, WA5 | `tests/pipeline-python.test.ts` (runs `build_section_data.py --self-test`, reads the real windows); `tests/three-core/water-holes.test.ts` |
| WA7 (terrain) | `tests/three-core/water-terrain.test.ts` |
| RD1–RD5 | `tests/load-gate.test.ts` (stubbed holds); `tests/load-gate-hook.test.ts` (the hook as React runs it) |
| CL5 | `tests/three-core/occlusion.test.ts` (real sections, drawn crown shapes); `tests/three-core/trees.test.ts` (spheres enclose the crowns) |
| CL7 | positions compared with the before snapshot |
| CL8, CL11, CL12 | `tests/reel-captions.test.ts`; `tests/overlays.test.ts` |
| BL1 | `tests/three-core/visibility.test.ts`; `tests/three-core/buildings-real.test.ts` (candidates at measured heights) |
| BL2–BL4, BL16 | `tests/registers-buildings.test.ts` |
| BL5–BL10, BL13–BL16 | `tests/three-core/buildings.test.ts`; `tests/three-core/buildings-real.test.ts` |
| BL17 | `tests/pipeline-python.test.ts` (`build_buildings.py --self-test`) |
| CL14, X2, ADR 53, CI install | `tests/static-3d.test.ts` |

**Render checks** (`scripts/render-checks.mjs`): RD1, RD2, RD6, CL1, WA6, WA7, CL2–CL4, CL6, CL9,
CL10, BL12 and X1, X2. BL13 is a placeholder that passes only while no section lists a landmark.

**Documents:** RD7 and X3 (`docs/validation-3d.md`).

**Review (V):** WA7, CL2, CL4, CL6, CL7, CL8, BL9, BL13, BL14, X4, by someone other than the
author.

## Performance budget (RL24: ≤ 300 calls, ≤ 2 M triangles at every checked frame)

| Change | Estimate | Where it lands |
|---|---|---|
| Water holes | about +2× triangles per lake (rings with 15 islands) | ~4 k triangles, negligible |
| Background buildings | 1,360 footprints across 5 windows; ≤ 900 per window, about 12–20 triangles each, shadow pass ×2 | ≤ 36 k per window; Trawsfynydd ~7 k |
| Landmarks | ≤ 5 per section, ≤ 2 k triangles each | ≤ 10 k |
| Draw calls | +1–3 per section (merged buildings, landmarks, legend) | 62 → ≤ 65 at frame 2399 |
| Trawsfynydd frame 2399 | 1,936,811 + ~17 k (×2 shadow) | ≈ 1.97 M: inside, about 1.5 % spare |

If BL12 fails, lower that section's tree cap first (D48).

## Risks

| # | Risk | Mitigation |
|---|---|---|
| K11 | The lake rebuild changes the trawsfynydd and maentwrog DTMs, so RL5's medians and t7's figures shift. | Re-run the RL5 and RL8 tests and record the new figures; the spec limits stand. |
| K12 | Network fetches (lidar DTM and DSM, OSM relation and ways) fail or differ from the last fetch. | Same two allowlisted hosts; the retrieval date is recorded; on failure, stop and ask (no partial data). |
| K13 | Landmarks without dated sources. | Not modelled (BL16); listed with the reason. |
| K14 | Mask mode leaks into the reel. | A static test: `Reel3D` and the section entries in `Root.tsx` never pass `mask`. |
| K15 | Caption edits drift from the spec's frame ranges. | The RL17–RL21 rows and `EXPECT_OVERLAY` change in the same edit; the caption tests read the data. |
| K16 | The DSM survey date is unknown (Last-Modified 2024-10-04 is publication). | Recorded as unknown; heights stay "lidar DSM, survey date unknown" until sourced. |

## Sequence (one writer, main tree, no commits)

1. Before stills (D41): network not needed.
2. Water: tests first, then the core, view and pipeline.
3. Rebuild trawsfynydd and maentwrog, the only network step besides buildings.
4. Readiness: tests first; change a provider only when its test fails.
5. Clarity (D42–D44).
6. Building research: landmarks from the visibility list, sources screened.
7. Building data (DSM).
8. Building rendering.
9. Budgets, then after stills.
10. Independent validation.
