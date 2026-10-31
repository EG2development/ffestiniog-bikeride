# Design: 3D cycling route animation (modules, interfaces, data flow)

Status: written at task t3 of mission `msn_abdfd5eabd397f0f653da39f`, then updated at t13
(2026-10-25) to match the shipped proof of concept, including the fixes from the t8
benchmark, the t9 security review and the t10 code review. **Extended 2026-10-25
for the 1:30 reel** (mission `msn_44274a1de641722956fc9ce5`, task t3): see "Reel
design" at the end, decisions D23–D36. Implements
`docs/spec-3d.md`; builds on `docs/adr/0001-use-remotion-three-threecanvas.md` and
`docs/prior-art-3d.md`. Requirement ids (G1, RN2, …) refer to the spec.

## Shape of the system

The core is pure functions; the React parts are thin. All geometry, placement,
motion and camera maths live in `src/three-core/` as pure TypeScript with no
React, no three.js and no DOM, so `npm test` (vitest, Node) can check every
**T** criterion directly. React components only turn arrays and poses into
three.js objects.

```text
data pipeline (run once, committed)              runtime (Remotion render)
──────────────────────────────────              ─────────────────────────────────────────────
scripts/dem/*.py  ─ range-read lidar COG ─┐
scripts/osm/*.py  ─ OSM API, POC bbox ────┼──▶ public/data/*  ──▶ RouteDataProvider (existing)
scripts/build_poc_data.py (orchestrates) ─┘     (dem, landcover,     + Scene3DDataProvider (new)
data/*.json registers ── npm run data:sync ──▶   trail profile,         │  delayRender until loaded
                                                  osm features,          ▼
                                                  registers)       src/three-core/* (pure)
                                                                   terrain mesh, trail, poses,
                                                                   camera shots, registers
                                                                         │ plain props
                                                                         ▼
                                       src/scenes3d/PocMaentwrog.tsx ─▶ <ThreeCanvas> ─▶ src/three/*Views
                                                                    └─▶ HTML overlays (Caption, badge,
                                                                        attribution) beside the canvas
```

## Decisions

Each decision has its own record in `docs/adr/`; the index there maps D1–D22
(and the pure-core shape above, ADR 3) to ADR numbers. To change a
decision, follow `docs/sop-3d.md`.

| # | Decision | Why |
|---|---|---|
| D1 | The 3D work is a **separate composition** (`Poc3DMaentwrog`, 360 frames, 1920×1080, 30 fps) registered in `src/Root.tsx`, loaded lazily so the 2D bundle doesn't carry three.js (ADR 24, found by the t8 benchmark). `CyclingVision` and the 8 scenes are not touched. | RG1, spec "reuse". |
| D2 | **Data enters the canvas as props.** Providers and `useRouteData()` are read outside `<ThreeCanvas>`, and nothing inside the canvas uses React context. | Context forwarding inside `ThreeCanvas` is documented but unverified here (`docs/prior-art-3d.md`). Props also keep components trivially testable. |
| D3 | **Coordinates:** 3D `(x, y, z) = (project().x, elevation_m / 10 × VE, project().y)` with VE = 1; world unit = 10 m. Every geographic point, including terrain grid nodes, goes through the existing `project()`. | G1, G3, RG5. Measured precision is fine: float32 at ±1,000 units is about 0.6 mm. |
| D4 | **Terrain DEM: Welsh Government/NRW lidar DTM, 1 m, float32 COG** (`https://dmwproductionblob.blob.core.windows.net/cogs/lidar/wales_dtm_32bit_cog.tif`). Header read on 2026-10-25: 191,007 × 233,000 px, 1.0 m pixels, EPSG:27700 (British National Grid), Deflate, 256×256 tiles, nodata −9999, overviews at 2/4/8/16/32/64 m, 48.6 GB, HTTP range requests work. Licence: OGL per the DataMapWales LiDAR page; one catalogue lists "Not Specified", so it must be confirmed on the layer's metadata page before release (risk K2). The 16-bit variant stores whole metres and was rejected (it would put 1 m terraces in the mesh). Copernicus GLO-30 (reachable on AWS, 30 m) is the fallback for any nodata holes; each cell records which source it came from. (Built: the POC window had 0 nodata cells, so the fallback is not implemented; the pipeline stops if nodata appears.) | G2: 1 m bare-earth data shows real cuttings and embankments, which a 30–90 m DSM cannot. |
| D5 | **Reading the DTM:** a Python stdlib + numpy script reads the IFD tile index and range-reads only the tiles covering the POC box. No GDAL or pyproj (neither is installed). The terrain mesh uses the **4 m overview**; the trail profile samples the **1 m** level. | Keeps the download to tens of MB instead of 48.6 GB. |
| D6 | **Datum:** WGS84 ↔ OSGB36 by the Ordnance Survey 7-parameter Helmert transform plus Transverse Mercator, implemented in both `scripts/dem/bng.py` and `src/three-core/bng.ts`. The error is about ±5 m horizontally, recorded as a gap. OSTN15 is the upgrade path if the measured profile noise (K1) is too high. | No proj library available; Helmert is the OS-published method. |
| D7 | **Trail height comes from the lidar DTM along the centreline**, sampled at 1 m and smoothed with a 25 m window, into `public/data/trail-profile-poc.json`. Across the OSM bridge (km 9.150–9.169, way `159029124`) the height is interpolated between the abutments, because a DTM removes bridge decks. `data/elevation-profile.json` stays unchanged for the 2D video. **Spec G4 is amended to match.** | A real formation level instead of a 90 m DSM; RG1 is preserved. |
| D8 | **Ground colour comes from OSM land cover as vertex colours** (no textures in the POC). Classes: woodland, grassland/farmland, heath/scrub, water, built-up, quarry/rock/scree, other. Each DEM node is classified by point-in-polygon in the pipeline into `landcover-poc.u8`. The cached OpenTopoMap tiles stay available as a later "map mode" drape for aerial shots (P3). | Grounded in real data, ODbL-clean, cheap: one draw call and no texture budget. |
| D9 | **Vegetation:** two instanced tree meshes placed only inside OSM woodland polygons by a seeded PRNG (`mulberry32`, fixed seed), kept 10 m off the trail and 2 m off every registered road's carriageway (review R4), at the scene's vertical exaggeration. Registered as **decorative** (the woodland extent is OSM; individual trees are not). | Brief §2 vegetation, RN1 determinism, RN6 budget. |
| D10 | **Structures:** only OSM way `159029124` (`bridge=yes`, `layer=1`, source tag `OS_OpenData_StreetView`): a 19.3 m railway bridge over an unclassified road (OSM way `357873359`), both from cached OSM data. It's modelled as a deck plus parapets on the centreline, with the road draped on terrain beneath. It's registered as **approximate** because the form is generic and only the position is from OSM. | G6. |
| D11 | **Trail:** a ribbon along the centreline, 3.0 m wide (TR1; the primary ATAG source is still pending, risk K4), surface 0.05 m above the profile height. Terrain nodes within width/2 + 1 m plus one grid diagonal (so every triangle under the ribbon is covered) are flattened to the profile height, 0.05 m below the surface (G5a). Cut or fill deeper than 2 m within width/2 + 1 m is computed by a pure function, reported in real metres whatever the vertical exaggeration, and must be covered by register entries marked "approximate (DEM-derived)" (G5b); `npm run data:earthworks` writes those entries. The surface uses a warm buff colour unlike any land-cover colour, and is labelled "Proposed trail (concept)" from frame 0 to 90 (H2). | G5, H2, TR1. |
| D12 | **Cyclist: a procedural low-poly model built from three.js primitives** (an original asset, registered as such). Dimensions: wheel Ø 0.68 m, wheelbase 1.05 m, riding height 1.70 m, overall length 1.75 m. A rigged CC0 model is evaluated in P3. | Exact proportions (C1), no licence dependency (C8); the brief allows "reusable … without unnecessarily complex" systems. |
| D13 | **Motion:** speed comes from gradient, clamped to 12–25 km/h (C2), and is integrated per frame into a precomputed distance table (deterministic, no per-render drift). The cyclist keeps 0.5 m left of the centreline (C3). Wheel angle = distance / radius (C6). Cadence is fixed at 75 rpm (C7; gearing implied). Pose = position, yaw from the tangent, pitch from the gradient, wheel angle, crank angle. The start is km 9.120; at 15.1–16.2 km/h (about 4.3 m/s) the rider is on the bridge (km 9.150–9.169) from frame 212 to 339, in the follow shot, and ends at km 9.172. | C2–C7, a visible structure mid-shot. |
| D14 | **Camera:** a `Shot` is a pure `(frame) → { position, target, fovDeg }`. The POC has two shots. Shot A (frames 0–179) is a drone side-track descending from 120 m to 25 m above the terrain along km 8.98–9.10, looking at the rider. (The first plan, km 9.00–9.15, overtook the rider abeam at about 50 m and panned at 30.7°/s, failing CA2 in the acceptance test; the drone now ends about 50 m behind the rider.) Shot B (frames 180–359) follows 8 m behind and 3 m up, rear-left, through the bridge. A `withClearance` wrapper enforces ≥ 2 m above the terrain and ≥ 1.5 m from the rider (CA3). The drone's speed ramps up and down with a smoothstep over 0.5 s at each end of its shot (CA2). The vertical FOV is 45° (CA4). | CA1–CA4. |
| D15 | **Applying the camera without `useFrame`:** a `CameraRig` component sets the default camera's position, `lookAt` and FOV from props during render (via `useThree`). `ThreeCanvas` then calls `advance()`. Camera clearance (CA3) is measured against the rendered terrain, after corridor flattening, and a camera with no terrain under it throws instead of rendering NaN (review R5, R7). | RN1. Must be confirmed by the RN2 determinism check in the build. |
| D16 | **Lighting:** one fixed directional "sun" (azimuth 200°, elevation 35°) with a shadow map (2048², frustum limited to about 300 m around the rider), a hemisphere fill light, linear fog towards a pale sky colour, and a flat sky background. No HDRI (licence and size). | Realism within the RN6 budget. |
| D17 | **GL renderer: `--gl=angle` on 3D render commands only, not globally.** Measured 2026-10-25: two default renders of `CyclingVision` frame 2200 were byte-identical (sha256 `6a9065e5…`), while `--gl=angle` gave a different image (`a41e9d6e…`). A global `Config.setChromiumOpenGlRenderer('angle')` would therefore break RG1. **Spec RN4 is amended to match.** | RG1 vs RN4 conflict found by measurement. |
| D18 | **Registers:** `data/features-3d.json` and `data/assets-3d.json` (schemas below; plus one `data/features-<id>.json` per reel window, ADR 29) are validated by a small hand-written validator in `src/three-core/registers.ts`, so no new dependency is needed. | H1, G5–G8, L1. |
| D19 | **One copy direction:** `data/` is the source of truth, and `npm run data:sync` copies its JSON/GeoJSON into `public/data/`. A static test fails if any pair differs. Large generated binaries (`*.f32`, `*.u8`) live only in `public/data/`, with their provenance in a JSON header beside them. | Removes the manual-copy drift the README warns about. |
| D21 | **Road-bridge decks are removed from the trail profile** (ADR 23). Found during the build: the lidar DTM keeps the A470 deck at km 8.56, which put a 26 % hump in the profile. Overbridge spans are interpolated like rail-over bridges, still flattened beneath, and not reported as earthworks. | Geographic accuracy; spec TR2. |
| D22 | **Render-check diagnostics use Remotion's Node API** (`renderStill` with `onBrowserLog`). The CLI does not print the page's console output, so the draw-call, triangle and overlay logs can only be read this way. `@remotion/renderer` and `@remotion/bundler` are pinned dev dependencies at 4.0.538. | Spec RN6, H2a, L2. |
| D20 | **Dependencies, pinned exactly:** `three@0.186.1`, `@react-three/fiber@9.8.2` (peers react ≥19 <19.4: installed 19.2.3 ✓; three ≥0.156 ✓), `@remotion/three@4.0.538` (matches remotion), `@types/three@0.186.0` (dev). No drei. | ADR compatibility table; minimal deps. |

### Spec amendments made by this design

- **G4:** the trail height follows the smoothed profile derived from the terrain DEM along the centreline (`trail-profile-poc.json`, D7), not `elevation-profile.json`.
- **G2(c):** the reference is the route's Copernicus GLO-90 DSM elevations, and the terrain is a lidar DTM. Median ≤ 5 m is kept; the maximum is raised to ≤ 30 m because a DSM includes tree canopy. This uses the spec's own "different DEM family" clause.
- **RN4:** 3D render and still commands pass `--gl=angle`, and `remotion.config.ts` must **not** set the GL renderer globally (D17).

## Modules and interfaces

### Pure core: `src/three-core/` (unit-tested; no React, three.js or DOM)

```ts
// Generated from the shipped code at t13 and kept in step by tests/docs.test.ts.
// types.ts
export type Vec3 = [number, number, number];
export type DemGrid = {
  cols: number; rows: number; spacingM: number;        // 4 m for the POC mesh
  originE: number; originN: number;                    // BNG of the north-west node
  heights: Float32Array;                               // row-major, north→south, metres
  sourceIndex: Uint8Array;                             // 0 = lidar DTM, 1 = GLO-30 fallback
  nodata: number;
};
export type LandCover = { classes: Uint8Array; legend: string[] }; // aligned with DemGrid nodes
export type MeshArrays = { positions: Float32Array; indices: Uint32Array; colors?: Float32Array };
export type Projector = (lon: number, lat: number) => { x: number; y: number }; // the route's project()

// bng.ts (D6, ADR 8)
export function wgs84ToBng(lon: number, lat: number): { e: number; n: number };
export function bngToWgs84(e: number, n: number): { lon: number; lat: number };
export function tmForward(latDeg: number, lonDeg: number): { e: number; n: number }; // OSGB36 lat/lon → grid
export function tmInverse(e: number, n: number): { lat: number; lon: number };

// dem.ts
export function heightAtBng(grid: DemGrid, e: number, n: number): number | null; // bilinear; null outside or at nodata
export function meshHeightAtBng(grid: DemGrid, e: number, n: number): number | null; // on the terrain mesh's own triangles
export function buildTerrainMesh(grid: DemGrid, land: LandCover, project: Projector, ve: number): MeshArrays;
export const colourForClass: (name: string) => [number, number, number];         // land-cover palette (sRGB)

// trail.ts
export const TRAIL_WIDTH_M = 3;
export type TrailProfile = { distanceM: number[]; elevationM: number[]; smoothingM: number;
  bridges?: [number, number][]; overbridges?: [number, number][] };              // spans in metres along the route
export type TrailSample = { x: number; y: number; z: number; distM: number; tangent: Vec3; gradient: number };
export type Trail = { samples: TrailSample[]; sampleAt: (distM: number) => TrailSample; ribbon: MeshArrays; maxGradient: number };
export function profileHeightAt(profile: TrailProfile, d: number): number;
export function buildTrail(route: RouteModel, profile: TrailProfile,
  section: { startKm: number; endKm: number }, opts: { widthM: number; ve: number }): Trail;
export type CutFill = { fromKm: number; toKm: number; kind: 'cut' | 'fill'; maxDepthM: number };
export function flattenCorridor(mesh: MeshArrays, trail: Trail, opts: { widthM: number; shoulderM: number;
  spacingM: number; bridges: [number, number][]; noReport?: [number, number][]; ve?: number }):
  { mesh: MeshArrays; cutFill: CutFill[] };            // G5; depths in real metres whatever ve
export function centrelineIndex(trail: Trail, reach: number):
  (x: number, z: number) => { distM: number; lateral: number; interior: boolean } | null; // nearest centreline point within reach

// cyclistMotion.ts
export type CyclistDims = { wheelDiameterM: number; wheelbaseM: number; ridingHeightM: number; lengthM: number; lateralOffsetM: number };
export function defaultCyclistDims(): CyclistDims;    // 0.68, 1.05, 1.70, 1.75, 0.5 m
export function speedKmh(gradient: number): number;  // C2: clamp(18 − 150 × gradient, 12, 25)
export function distanceTable(trail: Trail, startDistM: number, frames: number, fps: number): Float64Array;
export type CyclistPose = { position: Vec3; yaw: number; pitch: number; wheelAngle: number; crankAngle: number };
export function cyclistPose(trail: Trail, table: Float64Array, frame: number, fps: number, dims: CyclistDims): CyclistPose; // C3–C7
export function poseAxes(pose: CyclistPose): { forward: Vec3; up: Vec3 };
export function wheelContacts(pose: CyclistPose, dims: CyclistDims): { rear: Vec3; front: Vec3 }; // C4

// camera.ts
export type CameraPose = { position: Vec3; target: Vec3; fovDeg: number };
export type Shot = (frame: number) => CameraPose;
export type HeightAt = (x: number, z: number) => number; // world units; -Infinity off the terrain
export function droneSideTrack(p: { trail: Trail; riderAt: (frame: number) => Vec3; heightAt: HeightAt;
  fromDistM: number; toDistM: number; startHeightM: number; endHeightM: number; sideM: number; frames: number }): Shot;
export function followShot(p: { poseAt: (frame: number) => CyclistPose; backM: number; upM: number; sideM: number }): Shot;
export function withClearance(shot: Shot, heightAt: HeightAt, riderAt: (frame: number) => Vec3,
  minAboveM: number, minFromRiderM: number): Shot;    // CA3; this and droneSideTrack throw if no terrain is under the camera
export function sequenceShots(shots: { shot: Shot; frames: number }[]): Shot; // each shot sees its own local frames

// roads.ts: OSM roads draped on the terrain (D10)
export type RoadLine = { coords: [number, number][]; highway: string; bridge?: boolean };  // lon/lat; OSM bridge=*
export type RoadGround = { groundAt: HeightAt; openAt: (x: number, z: number) => boolean; ve: number };
export const roadWidthM: (highway: string) => number;                    // typical width by class, not surveyed
export function buildRoadMesh(roads: RoadLine[], project: Projector, heightAt: HeightAt): MeshArrays;
//   ways of one class meeting end to end are joined first; resampled every 4 m; 3 vertices per cross-section
//   (left, centre, right), each 0.3 m above heightAt; a bridge way's deck runs straight between its ends where the
//   DTM drops lower; parts of a road off the terrain are dropped
export function buildRoadStructures(roads: RoadLine[], project: Projector, heightAt: HeightAt, ground: RoadGround): MeshArrays;
//   generic masonry wherever a road stands more than 0.6 m above groundAt: walls to the ground, a deck where openAt
//   (the trail's clearance) or a bridge way's span, parapets over 2 m; position from the data, form generic (ADR 12)

// bridge.ts (D10)
export function buildBridgeMesh(trail: Trail, span: [number, number],
  opts?: { deckWidthM: number; deckDepthM: number; parapetHeightM: number; parapetThicknessM: number }): MeshArrays;

// trees.ts (D9)
export type TreeInstance = { x: number; y: number; z: number; scale: number; yaw: number };
export type TreePlacement = { conifer: TreeInstance[]; broadleaf: TreeInstance[] };
export type TreeOptions = { seed: number; probability: number; maxTrees: number; clearOfTrailM: number;
  roads: RoadLine[]; clearOfRoadM: number; ve: number }; // defaults: 20261025, 0.12, 6000, 10 m, [], 2 m, 1
export function placeTrees(dem: DemGrid, land: LandCover, project: Projector, trail: Trail,
  options?: Partial<TreeOptions>): TreePlacement;       // missing options take the defaults

// poc.ts: the POC's numbers and assembly, shared by the composition and the acceptance tests (D13, D14)
export const POC: { compositionId: 'Poc3DMaentwrog'; fps: 30; frames: 360; section: { startKm: 7.7; endKm: 9.7 };
  startDistM: 9120; bridgeM: [9150, 9169]; shotSplitFrame: 180; ve: 1 };
export type PocInputs = { route: RouteModel; dem: DemGrid; land: LandCover; profile: TrailProfile };
export type PocScene = { trail: Trail; terrain: MeshArrays; cutFill: CutFill[]; dims: CyclistDims; table: Float64Array;
  riderAt: (frame: number) => Vec3;
  heightAt: HeightAt;      // the rendered ground, after corridor flattening: camera clearance (CA3)
  surfaceAt: HeightAt;     // the same ground on the mesh's own triangles, which the roads drape on
  bareHeightAt: HeightAt;  // the bare DTM, which keeps road decks over the line
  shot: Shot };
export function buildPocScene(inputs: PocInputs): PocScene;
export function buildPocExtras(inputs: PocInputs & { osm: OsmLine[]; features: Feature[]; bridgeIds: string[] },
  scene: PocScene): { roads: MeshArrays; bridges: MeshArrays[]; trees: TreePlacement };
//   roads drape on max(bareHeightAt, surfaceAt), keeping their real level over the corridor's cut on a structure
//   (a section's roadStructures); trees keep 2 m off them; only register entries are drawn (H1, G6, G7)

// registers.ts (D18): the registers, plus the runtime data checked at the boundary (t9, review R8).
// Every validator throws an error that names the JSON path of the first problem.
export type FeatureCategory = 'verified' | 'approximate' | 'proposed' | 'decorative';
export type Feature = {
  id: string;
  kind: 'terrain' | 'alignment' | 'trail' | 'structure' | 'road' | 'water' | 'landcover' | 'vegetation' | 'place' | 'cyclist' | 'label' | 'earthwork';
  category: FeatureCategory;
  source: { type: 'osm' | 'lidar-dtm' | 'copernicus' | 'waypoints' | 'tiles' | 'original' | 'coflein'; ref: string };
  scenes: string[];
  gapRefs?: string[];                                  // ids of gaps in data/source-register.md
  note?: string;
  fromKm?: number; toKm?: number;                      // earthworks: the range they cover
};
export type Asset = { path: string; kind: 'model' | 'texture' | 'data'; source: string; licence: string; attribution: string };
export type DemHeader = { cols: number; rows: number; spacingM: number; originE: number; originN: number; nodata: number; file: string; sourceFile: string };
export type LandCoverHeader = { legend: string[]; file: string };
export type OsmLine = { properties: { id: string; tags: Record<string, string> }; geometry: { type: string; coordinates: unknown } };
export function validateFeatures(x: unknown): Feature[];
export function mergeRegisters(files: unknown[]): Feature[];   // several register files as one validated list: duplicate ids across files are caught
export function validateAssets(x: unknown): Asset[];
export function validateDemHeader(x: unknown, path: string): DemHeader;
export function validateLandCoverHeader(x: unknown, path: string): LandCoverHeader;
export function validateTrailProfile(x: unknown, path: string): TrailProfile;  // equal-length, increasing, finite
export function validateOsmLines(x: unknown, path: string): OsmLine[];
export function dataFileName(x: unknown, path: string): string;                // plain names only: no directories, no ".."
export function expectGridBytes(buf: ArrayBuffer, grid: { cols: unknown; rows: unknown }, bytesPerCell: number, path: string): ArrayBuffer;

// rng.ts
export function mulberry32(seed: number): () => number;     // deterministic; the only randomness allowed (RN1)

// --- the reel (t7; ADRs 27–37) ---
// sections.ts: configs and one assembly; poc.ts re-exports POC, PocInputs, PocScene, buildPocScene, buildPocExtras, OsmLine from here
export type SectionKind = 'ground' | 'aerial';
export type ShotSpec = { kind: 'drone-side' | 'follow' | 'aerial-orbit' | 'pull-back' | 'hold'; frames: number; /* fields per kind */ };
export type SectionConfig = { id: string; title: string; kind: SectionKind; kmRange: [number, number]; window: string; frames: number; startDistM: number; shots: ShotSpec[]; captionIds: string[]; featureIds: string[]; ve: 1; maxTreesPerKind?: number };
export type SectionScene = PocScene & { config: SectionConfig; roads: MeshArrays; roadStructures: MeshArrays; bridges: MeshArrays[]; trees: TreePlacement; water: WaterBody[]; buildings: SectionBuildings };
export const SECTIONS: Record<string, SectionConfig>;      // intro, heritage, overview, blaenau, vale-north, vale-south, maentwrog, trawsfynydd, closing
export function shotsOf(cfg: SectionConfig, scene: { trail: Trail; riderAt: (f: number) => Vec3; heightAt: HeightAt; poseAt: (f: number) => CyclistPose }): Shot;
export function buildSectionScene(cfg: SectionConfig, inputs: PocInputs & { osm: OsmLine[]; features: Feature[] }): SectionScene;
export const followStartFrame: (cfg: SectionConfig) => number;   // frames before the first follow shot (the near plane moves in there)
// atmosphere.ts (ADR 30)
export type Rgb = [number, number, number];
export type Atmosphere = { zenith: Rgb; horizon: Rgb; fogDensity: number; sunAzimuthDeg: number; sunElevationDeg: number };
export const ATMOSPHERE: Record<SectionKind, Atmosphere>;
export const fogColour: (kind: SectionKind) => Rgb;        // = ATMOSPHERE[kind].horizon (RL11)
export function sunDirection(route: RouteModel, atmosphere: Atmosphere): Vec3;
// shading.ts (ADR 31)
export function shadeTerrain(mesh: MeshArrays, grid: DemGrid): MeshArrays;
// water.ts (ADR 32)
export type WaterBody = { id: string; polygons: WaterPolygon[]; surfaceY: number; areaM2: number };
export type WaterPolygon = { outer: { x: number; z: number }[]; holes: { x: number; z: number }[][] };
export function polygonsOf(geometry: { type: string; coordinates: unknown }, innerRings?: [number, number][][]): { outer: [number, number][]; holes: [number, number][][] }[];
export function waterBodies(osm: OsmLine[], project: Projector, heightAt: HeightAt, minAreaM2: number, levels?: Record<string, number>, ve?: number): WaterBody[];
// tileUv.ts (ADR 33)
export type TileRange = { x0: number; x1: number; y0: number; y1: number };
export type Bbox = { west: number; south: number; east: number; north: number };
export function tileCoords(lon: number, lat: number, z: number): { tx: number; ty: number };
export function tileRange(bbox: Bbox, z: number): TileRange;
export function tileUvs(positions: Float32Array, unproject: (x: number, z: number) => { lon: number; lat: number }, range: TileRange, z: number): Float32Array;
// cyclistModel.ts (ADR 34)
export type PartMaterial = 'frame' | 'tyre' | 'rim' | 'rider' | 'helmet' | 'skin';
export type Part = { kind: 'capsule' | 'sphere' | 'torus' | 'box'; a: Vec3; b?: Vec3; r: number; material: PartMaterial; name?: string; scale?: Vec3 };
export function cyclistParts(dims: CyclistDims, crankAngle: number, wheelAngle: number): Part[];
export function partsBounds(parts: Part[]): { min: Vec3; max: Vec3 };
// camera.ts additions (ADR 35)
export function aerialOrbit(p: { centre: Vec3; radiusM: number; heightM: number; fromDeg: number; toDeg: number; frames: number }): Shot;
export function pullBack(p: { from: Vec3; target: Vec3; startHeightM: number; endHeightM: number; backM: number; frames: number; back?: [number, number] }): Shot;
export function liftClear(shot: Shot, heightAt: HeightAt, frames: number, minAboveM: number): Shot; // one constant lift for a whole aerial shot
// trees.ts (ADR 37): TreeOptions gains nearZoneM (300), densityPer100m2 (4) and an optional density band
// --- iteration 2 (docs/design-reel-v2.md; ADRs 41–53) --- atmosphere.ts: light for every section, one source (ADR 46)
export type Lighting = { hemiSky: string; hemiGround: string; hemiIntensity: number; sunColour: string; sunIntensity: number };
export const LIGHTING: Record<SectionKind, Lighting>; // and the drape grade (CL6): only the map's paper takes the ground palette
export type DrapeGrade = { tint: string; alpha: number; neutral: number; brightness: number }; export const DRAPE_GRADE: DrapeGrade;
export function gradeDrapePixels(data: Uint8ClampedArray, grade: DrapeGrade): void;
export const TREE_COLOURS: { trunk: string; conifer: string; broadleaf: string }; // trees.ts; TreeOptions gains keepOut and sightLines (ADR 47)
export const CROWN_SHAPES: { conifer: { baseY: number; apexY: number; radius: number }; broadleaf: { centreY: number; radius: number; yScale: number } }; // as drawn; the spheres enclose them (t10)
export const CROWN_SPHERES: { conifer: { y: number; r: number }[]; broadleaf: { y: number; r: number }[] }; export const TREE_FILL: number; // shade-side fill (CL2); TreeOptions.footprints keeps trees off buildings (BL13)
// registers.ts: buildings carry status and provenance (ADR 51)
export type FeatureStatus = "existing" | "construction" | "approved" | "demolished";
export type FeatureProvenance = { urls: string[]; evidence: ("map" | "imagery" | "record" | "photo" | "lidar" | "planning")[]; observedAt: string; retrievedAt: string; licence: string; confidence: "high" | "medium" | "low" };
// registers.ts: a section's buildings.json (BL11, RD5; heights capped at 200 m, t9) and the tile manifest (RD5, t9), checked at the boundary
export type TilesManifest = { layers: { name?: string; zoom: number; tiles: { x: number; y: number; path: string }[] }[] };
export function validateTilesManifest(x: unknown, path: string): TilesManifest;
export type SectionBuilding = { id: string; osm?: string; footprint: [number, number][]; heightM: number; heightSource?: string; roof: "flat" | "gabled"; kind: "background" | "landmark"; status: FeatureStatus; landmark?: string; model?: LandmarkModel };
export function validateBuildings(x: unknown, path: string): SectionBuilding[];
// visibility.ts: candidate buildings, one list over all the shots' poses (ADR 49)
export type Footprint = { id: string; ring: { x: number; z: number }[]; heightM: number };
export function visibleFootprints(poses: CameraPose[], footprints: Footprint[], heightAt: HeightAt, opts?: { aspect?: number; far?: number; stepUnits?: number }): string[];
// buildings.ts: merged buildings and procedural landmarks (ADR 50)
export type BuildingStatus = FeatureStatus;
export type BuildingRecord = { id: string; ring: { x: number; z: number }[]; heightM: number; roof: "flat" | "gabled"; status: BuildingStatus };
export type BuildingGroup = { kind: "existing" | "translucent"; positions: Float32Array; normals: Float32Array; indices: Uint32Array };
export function buildingBase(ring: { x: number; z: number }[], heightAt: HeightAt): number;
export function buildingShell(r: BuildingRecord, heightAt: HeightAt, ve: number): { ring: { x: number; z: number }[]; base: number; top: number; minEaves: number }; // what the walls stand on and reach; exported to Blender
export function buildingArrays(records: BuildingRecord[], heightAt: HeightAt, ve: number, landmarks?: LandmarkPlacement[]): { groups: BuildingGroup[] }; // the recorded height is the ridge (BL6)
export function footprintOverlap(a: { x: number; z: number }[], b: { x: number; z: number }[]): number;
export function segmentsInFootprints(lines: { x: number; z: number }[][], fps: { id: string; ring: { x: number; z: number }[] }[]): string[];
export type LandmarkModel = { type: "church" | "station" | "block"; lengthM: number; widthM: number; heightM: number; towerHeightM?: number };
export type LandmarkPart = { name: string; shape: "box" | "roof" | "pyramid"; centre: Vec3; size: Vec3 };
export function landmarkParts(model: LandmarkModel): { parts: LandmarkPart[]; bounds: { min: Vec3; max: Vec3 } };
// buildings.ts: registered ids only, with the register's status (BL3, BL16); landmarks on their footprint's axis, tower west (BL9)
export type LandmarkPlacement = { id: string; model: LandmarkModel; origin: Vec3; yaw: number; status: BuildingStatus };
export type SectionBuildingRecord = BuildingRecord & { kind: "background" | "landmark"; model?: LandmarkModel };
export type SectionBuildings = { records: SectionBuildingRecord[]; groups: BuildingGroup[]; landmarks: LandmarkPlacement[]; landmarkGroups: BuildingGroup[] };
export function sectionBuildings(list: SectionBuilding[], status: Map<string, BuildingStatus>, project: (lon: number, lat: number) => { x: number; y: number }, heightAt: HeightAt, ve: number): SectionBuildings;
// --- photoreal layer (docs/design-photoreal.md; ADRs 54–58) ---
// camera.ts (ADR 56): the rider's own view at handlebar height, bobbing with the crank angle; CA3 as amended (1 m over the ground, no rider distance)
export function firstPersonShot(p: { trail: Trail; poseAt: (frame: number) => CyclistPose; distAt: (frame: number) => number; eyeHeightM: number; lookAheadM: number; forwardM?: number; bobM?: number; fovDeg?: number }): Shot;
export const FIRST_PERSON_FOV_DEG: number; // 52
// sections.ts: ShotSpec gains { kind: 'first-person'; eyeHeightM; lookAheadM; frames }; SectionConfig gains photo?: { canopyTrees; barriers; grassAlongM; grassBandM; walkers?: WalkerSpec[]; treeClearOfTrailM? }; PocScene gains distAt; SectionScene gains barriers, grass and walkers: WalkerTrack[]
// grass.ts: GrassOptions gains groundAt?: (x, z) => number, the rendered ground the clumps stand on (RL15)
export function shotSpecAt(cfg: SectionConfig, frame: number): ShotSpec; // the spec behind shotKindAt
export function earthworksInRange(features: readonly Feature[], rangeM: [number, number]): [number, number] | null; // km range of the registered earthworks a drone shot flies over (G8)
// atmosphere.ts: the photo look's close-shot shadow map (review 2026-10-30, RL12)
export const SHADOW_PHOTO_CLOSE: { rangeM: number; normalBias: number; bias: number }; // 160 m, 6 cm, −0.0002
// walkers.ts (ADR 59; spec C9): walkers a section config choreographs, under the rider's rules at walking ranges
export type WalkerSpec = { startDistM: number; direction: 1 | -1; sideM: number; heightM: number; seed: number }; // sideM left of the route's direction, |sideM| ≤ 1 (C3)
export type WalkerPose = { position: Vec3; yaw: number; phase: number }; // on the trail surface; one stride per 2π of phase
export type WalkerMaterial = 'top' | 'legs' | 'skin' | 'hair' | 'shoe';
export type WalkerPart = Omit<Part, 'material'> & { material: WalkerMaterial };
export function walkerSpeedKmh(gradient: number): number;         // C9: clamp(4.5 − 30 × gradient, 3, 6), gradient in the walker's direction
export const strideM: (heightM: number) => number;                // 0.8 × height
export function walkerTable(trail: Trail, spec: WalkerSpec, frames: number, fps: number): Float64Array; // integrated once, in the walker's direction
export function walkerPose(trail: Trail, table: Float64Array, frame: number, spec: WalkerSpec): WalkerPose;
export function walkerParts(heightM: number, phase: number): WalkerPart[]; // 16 parts from Drillis–Contini fractions; a sole always on y = 0
export function walkerColours(seed: number): Record<WalkerMaterial, string>;
export const WALKER_PALETTE: Record<WalkerMaterial, readonly string[]>;
export type WalkerTrack = { spec: WalkerSpec; table: Float64Array; poseAt: (frame: number) => WalkerPose };
export function walkerTracks(trail: Trail, specs: readonly WalkerSpec[], frames: number, fps: number): WalkerTrack[]; // refuses a shared seed, |sideM| > 1, height outside 1.5–1.95
// registers.ts (ADR 59): KINDS gains 'walker'
export function shotKindAt(cfg: SectionConfig, frame: number): ShotSpec['kind'];
export const PROTOTYPES: Record<string, SectionConfig>; // 'maentwrog-photo': 600 frames outside the reel (ADR 54)
export function configById(id: string): SectionConfig;   // SECTIONS, then PROTOTYPES, else a named error
// atmosphere.ts (ADR 54): the photo look's light and sky
export const LIGHTING_PHOTO: Record<SectionKind, Lighting>;
export const SKY_PHOTO: { environmentIntensity: number; cloudCover: number; cloudScale: number; sunGlow: number };
// photoLook.ts (ADRs 54, 55): the look's numbers, tuned by render
export const POST: { exposure: number; aoRadius: number; aoIntensity: number; vignette: number; saturation: number };
export const PHOTO_TRAIL_TINT: string; // the buff the gravel is tinted with (paler than TRAIL_COLOUR, unlike any land cover)
export const GRASS: { bladeWidthM: number; bladeHeightM: number; blades: number; base: string; tip: string };
export const BARRIER_COLOURS: Record<BarrierKind, string>;
// grass.ts (ADR 54): decorative clumps on grass-like cover within a band of the trail, by a seeded draw
export type GrassClump = { x: number; y: number; z: number; yaw: number; scale: number; tint: number };
export type GrassOptions = { seed: number; alongM: [number, number]; bandM: number; per100m2: number; clearOfTrailM: number; maxClumps: number; ve: number; classes: RegExp; tintScale: number };
export function placeGrass(dem: DemGrid, land: LandCover, project: Projector, trail: Trail, options?: Partial<GrassOptions>): GrassClump[];
// barriers.ts (ADR 58): OSM field boundaries as lofted boxes on the rendered ground, open for gapM either side of the trail
export type BarrierKind = 'wall' | 'hedge' | 'fence';
export type BarrierLine = { id: string; coords: [number, number][]; kind: BarrierKind; heightM?: number };
export const BARRIER_SIZES: Record<BarrierKind, { widthM: number; heightM: number }>;
export function barrierKind(tags: Record<string, string>): BarrierKind | null;
export function barrierLines(osm: OsmLine[]): BarrierLine[];
export type BarrierMeshes = Record<BarrierKind, MeshArrays>; // MeshArrays gains uvs?: Float32Array; the trail ribbon carries UVs too
export function buildBarrierMeshes(lines: BarrierLine[], project: Projector, heightAt: HeightAt, opts: { ve: number; trail?: Trail; gapM?: number }): BarrierMeshes;
// trees.ts (ADR 57): TreeOptions gains canopy?, minCanopyM (3) and fieldTreeM (6); TreeInstance gains tint? and variant?
export const NOMINAL_TREE_HEIGHT_M: { conifer: number; broadleaf: number }; // the drawn crowns' heights per unit of scale
// registers.ts (ADR 57): the canopy grid header, which must be the DEM's grid; KINDS gains 'barrier' (ADR 58)
export type CanopyHeader = { cols: number; rows: number; spacingM: number; originE: number; originN: number; file: string };
export function validateCanopyHeader(x: unknown, path: string, dem: Pick<DemHeader, 'cols' | 'rows' | 'spacingM' | 'originE' | 'originN'>): CanopyHeader;
// --- the reel in the photo look (docs/adr/0060-reel-in-the-photo-look.md) ---
// sections.ts: every reel section carries photo extras, built in the photo look only (the concept look is unchanged);
// SectionConfig.photo gains treeZoneM?, treesPerNode?, canopyCover?, imagery?, and its grass fields become optional
export type Look = 'concept' | 'photo';
export type SceneImage = { width: number; height: number; scale: number; rgba: Uint8Array; cols: number; rows: number }; // SectionScene gains groundImage?
// buildSectionScene(cfg, inputs, look = 'concept'): inputs gain canopy?, barriers? and imagery?: GroundImage
// trees.ts: TreeOptions gains treesPerNode (1) and canopyCover (false: trees wherever the canopy stands, bare classes excepted)
export function treesInShots(trees: TreePlacement, poses: { position: Vec3; target: Vec3; fovDeg: number }[], focus: Vec3[], opts: { shadowReach: number; aspect?: number; far?: number }): { casting: TreePlacement; shadowless: TreePlacement }; // the photo look's draw lists: no pixel changes
// shading.ts: a Sentinel-2 true-colour image on the DEM's grid as the ground's colour
export type GroundImage = { width: number; height: number; scale: number; rgb: Uint8Array }; // pixel (0, 0) on node (0, 0), north row first
export function imageryPixels(image: GroundImage, grade: { gain: number; saturation: number; tint: readonly [number, number, number] }): Uint8Array; // graded sRGB RGBA
export function imageryNodeColours(image: GroundImage, pixels: Uint8Array, cols: number, rows: number): Float32Array; // the pixel on each node, in vertex order
// photoLook.ts and atmosphere.ts
export const IMAGERY_GRADE: { gain: number; saturation: number; tint: readonly [number, number, number] }; // 1, 1.1, [1.6, 1, 0.7]: towards the ground palette (CL6)
export const SHADOW_PHOTO_AERIAL: { rangeM: number; normalBias: number; bias: number }; // 2.4 km, 0.8 m, −0.0004
// registers.ts: KINDS gains 'imagery'; the image header must be the DEM's grid at a whole scale
export type ImageryHeader = CanopyHeader & { scale: number; width: number; height: number };
export function validateImageryHeader(x: unknown, path: string, dem: Pick<DemHeader, 'cols' | 'rows' | 'spacingM' | 'originE' | 'originN'>): ImageryHeader;
// --- trail users at random (docs/adr/0061-trail-users-at-random.md) ---
// walkers.ts: WalkerSpec gains activity?: Activity; strideM(heightM, activity?), walkerParts(heightM, phase, activity?) and
// walkerColours(seed, activity?) follow it (a walker's figure and colours are unchanged); WalkerMaterial gains 'frame' | 'fabric' | 'tyre' | 'blanket'
export type Activity = 'walk' | 'run' | 'pram';
export function paceKmh(activity: Activity, gradient: number): number; // walk as C9; run clamp(10 − 50 g, 7.5, 12); pram clamp(4 − 30 g, 3, 5)
export const RUNNER_PALETTE: { top: readonly string[]; legs: readonly string[]; shoe: readonly string[] };
export const PRAM_PALETTE: { frame: readonly string[]; fabric: readonly string[]; tyre: readonly string[]; blanket: readonly string[] };
// people.ts: a section's people by a seeded draw, each kept only if it clears the rider, the camera and the others
export type PeopleOptions = { count: number; seed: number };   // SectionConfig.photo gains people?: PeopleOptions
export type PeopleInputs = { trail: Trail; frames: number; fps: number; kmRange: [number, number]; alongM: [number, number]; rider: { table: Float64Array; lateralM: number }; shot: Shot };
export function placePeople(inp: PeopleInputs, opts: PeopleOptions): WalkerSpec[]; // a runner and a pram among them; a walker may bring a companion
export const PEOPLE_RULES: { span: Record<Activity, [number, number]>; half: Record<Activity, number>; rider: { span: [number, number]; half: number }; clear: { rider: number; person: number }; cameraM: number; seenM: number };
```

### Runtime data: `src/data/Scene3DDataProvider.tsx` (new)

It wraps the 3D composition outside the canvas and fetches, behind one `delayRender` hold:
- `public/data/dem-poc.json` and `landcover-poc.json`, in parallel;
- then the DEM, source and land-cover binaries, `trail-profile-poc.json`, `osm-poc.geojson`, `features-3d.json` and `assets-3d.json`.

With a `section` prop (every reel section) it loads `public/data/sections/<window>/` instead (`dem.json`, `landcover.json`, `trail-profile.json`, `osm.geojson`) and merges `features-3d.json` with `features-<window>.json` through `mergeRegisters` (D25, ADR 29).

At this boundary it checks every file: the HTTP status, the headers (`validateDemHeader`, `validateLandCoverHeader`, with plain file names only), each binary's byte count against its grid (`expectGridBytes`), the profile, the OSM lines and both registers. An error goes to `cancelRender`, naming the file and field. It exposes `{ dem, land, profile, osm, features, assets }` through `useScene3DData()`.

It releases its hold in an effect after its children have mounted, so `<ThreeCanvas>` has already registered its own hold (spec RN5c). `RouteDataProvider` follows the same rule. It's used only by 3D compositions, so the 2D video never loads the DEM.

### React layer

- **`src/scenes3d/PocMaentwrog.tsx`** is a one-line wrapper, `<Section3D section="maentwrog" captions="poc" />` (D36). **`Section3D.tsx`** reads both providers outside the canvas, builds the scene once with `useMemo` (`buildSectionScene` and the sun direction), computes the pose and the camera per frame, then renders:

  ```tsx
  <AbsoluteFill>
    <ThreeCanvas width={1920} height={1080} shadows>{/* SkyDome, Lighting, CameraRig and the views below, props only */}</ThreeCanvas>
    <CaptionOverlays captions={list} total={cfg.frames} ve={cfg.ve} />
    {/* src/three/Overlays.tsx: a Badge "Concept visualisation — not an approved route" and the Attribution (lidar OGL,
        OSM ODbL, OpenTopoMap CC-BY-SA) on all frames; a "Heights exaggerated ×ve" Badge when ve ≠ 1 (G3); Labels from
        Caption.tsx for the rest. For the POC, list = POC_CAPTIONS: section title 0–149, "Proposed trail (concept)" 0–89,
        closing 195–359 */}
    {diagnostics && <OverlayLog/>}
  </AbsoluteFill>
  ```

  Each overlay carries a `data-overlay` marker. Labels get one through an `Overlay` wrapper with `display: contents`, which adds no box. With `diagnostics: true`, `OverlayLog` logs the markers found in the page after each commit, and `Diagnostics` logs `renderer.info`. The render checks read both (H2a, L2, G3, RN6). `PocMaentwrog.tsx`'s default export is `Poc3DMaentwrog` and `Section3D.tsx`'s is `Section3D`, both for `lazyComponent`. `FEATURE_IDS` lists the register ids the scene draws (H1).

- **`src/three/` views,** each `(props) → three objects`, with no data fetching and no `useFrame`:
  - `TerrainView({ mesh })`: one `BufferGeometry` with vertex colours (sRGB converted to linear).
  - `TrailView({ ribbon })`: colour `TRAIL_COLOUR` (#d8b06a), polygon offset so it doesn't z-fight the terrain.
  - `BridgeView({ mesh })` and `RoadView({ mesh })`.
  - `TreesView({ trees })`: two `InstancedMesh` objects (conifer, broadleaf).
  - `CyclistView({ pose, dims })`: procedural groups for the wheels, frame, cranks and rider, with two-bone leg IK.
  - `CameraRig({ pose, near, far })`: D15.
  - `Lighting({ sunDirection, focus })`: D16; the shadow frustum follows `focus`, the rider.
  - `Diagnostics({ ve })`: logs `THREE_STATS` (draw calls, triangles, ve) after each render.
  - `useMeshGeometry(mesh)` (`geometry.ts`): a `BufferGeometry` per mesh, disposed on change.
- **`src/Root.tsx`** registers `Poc3DMaentwrog` (360 frames), `Reel3D` (2,700) and nine `Section-<id>` entries, all with `lazyComponent` and a `calculateMetadata` that imports `POC`, `reel-timeline` or `SECTIONS` dynamically; it imports no 3D module statically (ADR 24).

### Data pipeline: `scripts/` (committed; Python 3 stdlib + numpy)

- `scripts/dem/cog.py`: a BigTIFF IFD parser plus range reads of the tile index and tiles (Deflate via zlib).
- `scripts/dem/bng.py`: D6, with a self-test against the Ordnance Survey worked example.
- `scripts/osm/fetch_bbox.py`: `api.openstreetmap.org/api/0.6/map` in chunks. Overpass mirrors proved unreliable from this environment.
- `scripts/build_poc_data.py`: orchestrates the POC box (km 7.7–9.7 bbox plus 600 m margin) and writes:
  - `public/data/dem-poc.*`, `landcover-poc.*`, `trail-profile-poc.json` and `osm-poc.geojson`;
  - the non-earthwork entries of `data/features-3d.json`, and `data/assets-3d.json`.

  Bridge and overbridge spans are interpolated by `interpolate_spans`, which clips spans to the profile (ADR 23, review R6).
- `scripts/gen-earthworks.ts` (`npm run data:earthworks`): runs the shipped `flattenCorridor` on the real data and writes one "approximate" earthwork entry per cut or fill deeper than 2 m.
- `scripts/sync-public-data.mjs` (`npm run data:sync`, D19); `scripts/render-checks.mjs` (`npm run test:render`, the **R** checks).
- `package.json` scripts:
  - `still:poc` and `render:poc`, both with `--gl=angle` (D17);
  - `lint`, `test` and `build`.
- `.github/workflows/ci.yml` runs the portable checks; the render checks stay local (ADR 26).

### Tests (mapping to the spec's methods)

| File | Checks |
|---|---|
| `tests/route.test.ts` | The existing 2D projection tests, unchanged (RG2). |
| `tests/blender/export.test.ts` | The Blender transfer (docs/blender-build-plan.md): the Three.js→Blender coordinate contract, and the Maentwrog prototype package matching its source within 0.05 m, repeatably. |
| `tests/blender/reel.test.ts` | The reel's Blender export: nine scenes, 2,700 frames, the concept badge and credits kept, aerial and ground scenes as the three.js reel draws them. |
| `tests/three-core/bng.test.ts` | OS worked example; WGS84→BNG→WGS84 round trip < 0.01 m. |
| `tests/three-core/unproject.test.ts` | `unproject` inverts `project` (RG5). |
| `tests/three-core/dem.test.ts` | `heightAtBng`; `buildTerrainMesh` (G1, G3, D8). |
| `tests/three-core/trail.test.ts` | `buildTrail`: G1 (centreline = `project()`), G4, TR1, TR2. |
| `tests/three-core/corridor.test.ts` | `flattenCorridor`: G5a, G5b, bridge spans, depths in metres whatever the ve (R3). |
| `tests/three-core/cyclist.test.ts` | C1–C7 on every frame of a synthetic run. |
| `tests/three-core/camera.test.ts` | CA1–CA4 on every frame of the two POC shots; `sequenceShots`; `withClearance`; throws with no terrain (R7); ADR 35: `aerialOrbit` and `pullBack` meet CA1–CA4 over a synthetic valley. |
| `tests/three-core/roads.test.ts` | `buildRoadMesh` drops the parts of a road off the terrain, joins ways end to end and carries bridge decks over dips; `buildRoadStructures` walls raised roads and spans the trail; on the real Maentwrog data the A470 overbridge keeps its deck level and no raised road floats. |
| `tests/three-core/trees.test.ts` | `placeTrees`: 2 m off carriageways (R4); RL13 near zone, 1–15 per 100 m² and none beyond 300 m (ADR 37); R2 per-kind cap spread over the whole woodland; ve (R3). |
| `tests/three-core/rng.test.ts` | `mulberry32` determinism (RN1, RN2). |
| `tests/three-core/poc-acceptance.test.ts` | On the real POC data: G2, G1, G4, C1–C7, CA1–CA4, finite geometry, roads on the rendered terrain and trees off them (R4, R5), H1, G5b, G6, G7, L1, C8. |
| `tests/registers.test.ts` | Register validators (H1, L1); data-file names and grid sizes (t9); runtime data validators (R8). |
| `tests/static-3d.test.ts` | RN1 (banned APIs in `src/three*/`, `src/scenes3d/`), RN4 (`--gl=angle` in 3D scripts, no global GL in config), RN5a (loaders gated by `delayRender`), RN5c (holds released after children mount), RN5d (load errors reported), overlays logged from the page (R2), ADR 24 (lazy 3D registration), RG4 (no lat/lon literals), RG5 (imports `src/data/route`), D19 (data/public copies identical). |
| `tests/docs.test.ts` | This document's interface block matches the exports of `src/three-core`; every `npm run` script named in the docs exists; this table lists every test file. |
| `tests/reel-timeline.test.ts` | RL1, RL2: 2,700 frames at 30 fps; the nine sequences match the spec's 8-scene budget, contiguous and summing to 2,700. |
| `tests/reel-captions.test.ts` | RL17–RL22: every caption's id, text, frame range and minimum duration; no caption text inside `src/scenes3d/` (ADR 36). |
| `tests/three-core/sections.test.ts` | RL4: every `SECTIONS` config is complete; the Maentwrog config reproduces the POC scene (ADR 40). |
| `tests/three-core/atmosphere.test.ts` | RL11, RL12, CL6: both section kinds defined; the fog colour equals the horizon colour (ADR 30); the drape grade tints only the map's neutral paper, at its own luma. |
| `tests/three-core/shading.test.ts` | RL10: `shadeTerrain` keeps positions and colour ranges, darkens slopes, barely changes flat ground (ADR 31). |
| `tests/three-core/water.test.ts` | RL14: `waterBodies` area filter, shore-height median, non-water ignored (ADR 32). |
| `tests/three-core/tileUv.test.ts` | RL6: `tileRange` matches the cached wide layer; corner UVs (ADR 33). |
| `tests/three-core/cyclistModel.test.ts` | RL16, C1: bounds of the built parts; thigh and shin lengths constant over the crank cycle (ADR 34). |
| `tests/three-core/section-acceptance.test.ts` | RL5, RL6, RL8 per window on the real data: a DTM at the window's level agreeing with the route's elevations (median ≤ 10 m, max ≤ 30 m), the corridor mesh ≤ 400 k triangles, the per-window gradient limit, and the header's `source` and `crs`. |
| `tests/three-core/water-holes.test.ts` | WA3, WA5: `polygonsOf` keeps holes from the geometry and `inner_rings` alike, orients rings, assigns each hole to its part; `waterBodies` keeps holes and uses shared levels; Llyn Trawsfynydd has one level and the same islands in both windows (ADRs 41, 42). |
| `tests/water-geometry.test.ts` | WA1, WA2: `waterArrays` faces every triangle up for either winding, leaves islands open, keeps the area; real lake (ADR 41). |
| `tests/three-core/water-terrain.test.ts` | WA7: no terrain node inside a lake, more than 0.1 m from its shore and outside its islands, rises above the lake's shared level; every drawn lake has one (t10). |
| `tests/pipeline-python.test.ts` | WA3, WA4, WA6, WA7, CL4, BL6, BL17: the pipeline and still-metric self-tests, and the canopy, boundary and imagery scripts' (ADRs 57, 58, 60); Llyn Trawsfynydd's islands rise above the lake level in the real DTM (ADRs 41, 42, 49). |
| `tests/load-gate.test.ts` | RD3–RD5: one hold per input, taken while rendering (not in an effect), new hold before the old is released, stale and unmounted settles ignored, errors name section and asset; the providers use the gate; `memoOnSuccess` keeps only successful loads (ADR 43, t8). |
| `tests/load-gate-hook.test.ts` | RD3: in a component, the render with a new input never returns the old input's data and is already held; effects run again after a cleanup still load (t10). |
| `tests/three-core/occlusion.test.ts` | CL5: no drawn tree crown (exact cone, enclosing ellipsoid) between the camera and the rider in any frame of both ground shots in the five ground sections, in both looks (ADRs 47, 60). |
| `tests/overlays.test.ts` | CL7, CL9, CL11, CL12, BL14: safe-area tokens, 4.5:1 contrast over black and white frames, minimum text sizes (ADR 48); the legend names exactly the styles drawn. |
| `tests/registers-buildings.test.ts` | BL2–BL4, BL16: building entries need status and provenance; planning alone is not "existing"; old observations cannot be high confidence; real source types (ADR 51). |
| `tests/three-core/visibility.test.ts` | BL1: `visibleFootprints` lists footprints in view and not behind terrain (ADR 49). |
| `tests/three-core/buildings.test.ts` | BL5, BL6, BL7–BL11, BL14: base on the lowest ground, no floating walls, drawn at the recorded height (gabled ridge included), no roads through, overlap share, ≤ 3 merged groups, translucent approved/demolished, landmark dimensions and placement (tower to the west), per-section loading (ADR 50). |
| `tests/three-core/buildings-real.test.ts` | BL1, BL7, BL8, BL10, BL13, BL15, BL16 on the real sections: candidates tested at measured heights; drawn buildings resolve to sourced register entries, no trail or road through a footprint (one listed building on a dismantled stretch), no overlaps, ≤ 3 groups, no tree in or over a building, ODbL/OGL recorded and credited; `validateBuildings` names the file and field. |
| `tests/three-core/positions.test.ts` | CL7: every register entry captured before the iteration keeps its source, category and km range (fixture `tests/fixtures/feature-positions-before.json`). |
| `tests/three-core/first-person.test.ts` | ADRs 54, 56: the rider's view meets CA1, CA2, CA4 and CA3 as amended, bobs with the crank, plays at the section frame; the prototype config sits outside the reel and names the shot owning each frame. |
| `tests/three-core/barriers.test.ts` | ADR 58: OSM tags to wall, hedge or fence; lofted boxes of each kind's size or the tagged height, embedded 0.3 m, on a slope, with UVs; the gap at the trail; stations off the terrain dropped. |
| `tests/three-core/grass.test.ts` | ADR 54: clumps only on grass-like cover inside the band and clear of the ribbon, never on woodland; the stretch, the thinning band edge, determinism, the cap. |
| `tests/three-core/trees-canopy.test.ts` | ADR 57: woodland draws unchanged, felled nodes skipped, scales from the measured height, field trees at canopy peaks outside woodland from their own stream; the canopy header must be the DEM's grid; `barrier` is a register kind (ADR 58); ADR 60: several trees a node inside the node's cell, canopy cover off bare classes, the photo look's draw lists (`treesInShots`), the image's grade and node colours, its header at a whole scale, `imagery` a register kind. |
| `tests/three-core/walkers.test.ts` | C9 (ADR 59): the walking pace, the figure's height and width at every gait phase with a sole on the ground, C2–C5 at every frame in both directions, the gait's advance, determinism, the palette, the boundary refusals; the prototype's choreography on the real Maentwrog trail (passes in the rider's view, every walker behind the follow camera, inside the window). ADR 61: runner and pram paces and strides, a runner's flight phase and reach, a pram's tyres on the ground ahead of its pusher's feet with the hands on its bar. |
| `tests/three-core/reel-photo.test.ts` | ADR 60: the reel's look and its attribution; every reel scene's photo extras; the concept look unchanged by them (trees, roads, water, terrain colours; no grass, boundaries, walkers or image); ADR 61: each ground scene's people on its real trail (the same draw every time, a runner and a pram in each, inside the section, on screen, clear of the rider, the camera and each other; three runners and three prams across the reel); the aerial image on the corridor's grid (dark lakes) and trees only where the canopy stands on cover that is not bare. |
| `scripts/render-checks.mjs` (`npm run test:render`) | RG1 (sha256 of `CyclingVision` stills 5/1200/2200/2900 vs `tests/baselines/cyclingvision.json`, captured before any 3D code), RN2 (POC frames 0/180/359 rendered twice), RN3 (`ffprobe`), RN5b (no blank canvas in any frame of the full render; terrain drawn at frame 0), RN6 (timings, `renderer.info`), H2(a), L2, G3. The reel (ADR 39): RL1/RL24 full render, format and time; RL26/RL27 blank scan of all 2,700 frames; RL23 frames 0/1349/2699 twice; RL24 `renderer.info` at one frame per scene and at the last frame before each cut; RL17/RL22 overlays visible; RL32 one preview still per scene in `out/previews/`. Results are appended to `docs/validation-3d.md`. |

## Performance budget (RN6: ≤ 300 draw calls, ≤ 2 M triangles)

| Item | Triangles (estimate) | Draw calls (estimate) |
|---|---|---|
| Terrain, 4 m grid, about 1.6 × 2.7 km (≈ 400 × 675 nodes; built: 471 × 729) | ≈ 540 k | 1 (+1 shadow) |
| Trees, 2 instanced meshes, ≤ 6,000 instances × ≤ 60 tris | ≤ 360 k | 2 (+2) |
| Trail ribbon, roads, bridge | ≈ 10 k | 3 (+3) |
| Cyclist (procedural, merged per material) | ≈ 4 k | ≤ 10 (+10) |
| **Total, estimated** | **≈ 0.9 M** | **≈ 32** |
| **Measured** (`renderer.info`, shadow pass included; t10) | **1,150,462** | **55** |

The measured figures exceed the estimate but stay well inside the RN6 budget. The terrain grid came out larger than planned, and the roads now have three vertices per cross-section. Render time is 0.016 s per frame against the 2 s budget (t8).

## Risks

| # | Risk | Handling |
|---|---|---|
| K1 | The Helmert datum error (±5 m) puts the OSM centreline off the trackbed formation in a 1 m DTM, which shows up as profile noise and cut/fill artefacts. | Report the std dev of (raw 1 m profile − 25 m smoothed) in `docs/validation-3d.md`. If it exceeds 1.5 m, upgrade to OSTN15 before P4. |
| K2 | Lidar licence listings conflict (OGL vs "Not Specified"). | Confirm on the layer metadata page; until then L1 lists the licence as "OGL (to confirm)". |
| K3 | Setting the camera in render without `useFrame` may not apply before `advance()`. | The RN2 double render detects it; the fallback is a `useLayoutEffect` that sets the camera, then calls `advance(0)`. |
| K4 | Trail width primary source unconfirmed (TR1). | The ATAG 2021 PDF is too large for the fetch tool; read §11/appendix G locally before P5. |
| K5 | The DTM has nodata in the box. | GLO-30 fallback per cell, recorded in `sourceIndex` and the register. |

---

# Reel design

The reel design (mission `msn_44274a1de641722956fc9ce5`, decisions D23–D36, the shape of the reel, modules, risks K6–K11) is in `docs/design-reel.md`, moved there whole on 2026-10-29. The photoreal layer (ADRs 54–58) is designed in `docs/design-photoreal.md`.
