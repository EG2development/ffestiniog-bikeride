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
- **ruflo console ADR digest** (`.claude-flow/console/adr-digest.json`): no ADRs attached to mission `msn_abdfd5eabd397f0f653da39f`.
- **`.claude/helpers/adr-compliance.sh`:** checks the claude-flow toolchain's own ADRs (ADR-001 "agentic-flow as core foundation", and so on). They're about the toolchain, not this project, so they don't apply.
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
