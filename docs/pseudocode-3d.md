# Pseudocode: 3D cycling route animation (core logic)

Status: draft for mission `msn_abdfd5eabd397f0f653da39f`, task t5. It
implements `docs/spec-3d.md` (requirement ids in brackets) following
`docs/design-3d.md` and the ADRs in `docs/adr/`. Section 6 traces every
acceptance criterion to the logic that meets it and the logic that checks it.

**The reel (mission `msn_44274a1de641722956fc9ce5`) has its own part: `docs/pseudocode-reel.md`** (kept separate so this file stays under 500 lines).

**Where the shipped code differs (updated at t13, 2026-10-25).** This is the pre-implementation
pseudocode. Where it disagrees with the code, the code and `docs/design-3d.md` are authoritative:

- §1.5: road-bridge decks over the line are also interpolated out of the profile (ADR 23), by
  `interpolate_spans`, which clips spans to the profile (review R6).
- §2.5: `flattenCorridor(mesh, trail, { widthM, shoulderM, spacingM, bridges, noReport, ve })`.
  Overbridge spans are flattened but not reported. Depths are reported in real metres whatever the ve (R3).
- §2.7 and §4.1 CA3: camera clearance uses the *rendered* ground (the flattened mesh), not
  `heightAtWorld` on the bare DTM. A camera with no terrain under it throws (R5, R7). The drone's
  parameters are `fromDistM`, `toDistM` and `sideM`, with `riderAt` and `heightAt` passed in.
- §2.8: trees also keep 2 m off every registered road's carriageway, and use the scene's ve (R4, R3).
  Their scale is 0.75 + 0.5·rand().
- Roads (not in this pseudocode): resampled every 4 m. There are 3 vertices per cross-section, each
  draped 0.3 m above max(bare DTM, rendered ground) (R5, R11).
- §3: both data providers release their hold in an effect after their children mount (RN5c). Every
  data file is validated at the boundary, and a failed load goes to `cancelRender` (RN5d, R8).
  `src/Root.tsx` registers the 3D composition lazily (ADR 24).
- §4.3: render checks also scan every frame of the full POC render for a blank canvas, and read the
  overlays from the page (`data-overlay` markers), not a list in the code (R2).

## 0. Conventions

- World units: 1 unit = 10 m. 3D point = `(px, hM/10·VE, py)` where `(px, py) = project(lon, lat)` and VE = 1 (ADR 5).
- Frames: `f = 0 … N−1`, with N = 360 and FPS = 30 for the POC. `t_s = f / FPS`.
- Distances along the route (`d`) are in metres from Blaenau Ffestiniog (km 0).
- Section: `startKm = 7.7`, `endKm = 9.7`. Rider start: `d0 = 9120 m`. Bridge (OSM way 159029124): `d ∈ [9150, 9169]`.
- Trail width `W = 3.0 m`, shoulder `S = 1.0 m`, DEM mesh spacing `s = 4 m`.
- The only randomness is `mulberry32(SEED)` with a fixed SEED (RN1). No clocks.

## 1. Data pipeline (Python 3 + numpy, `scripts/`), run once

### 1.1 Read the lidar COG by range requests (ADR 7)

```text
read_header(url):
  bytes ← GET url, Range 0–65535;  require "II" + magic 43 (BigTIFF)
  for each IFD: parse tags ImageWidth, ImageLength, TileWidth, TileLength,
                Compression, Predictor, SampleFormat, BitsPerSample, nodata;
                ModelPixelScale and ModelTiepoint from IFD0
  require Compression = 8 (Deflate), Predictor = 1, SampleFormat = 3, Bits = 32,
          else FAIL "unsupported COG layout"
  level k has pixel size 2^k m; raster origin (Et, Nt) = tiepoint (164993, 397000)

read_window(level, Emin, Nmin, Emax, Nmax):
  px ← 2^level;  col = floor((E − Et)/px);  row = floor((Nt − N)/px)
  tilesAcross ← ceil(width / 256)
  for each tile (tr, tc) covering the window:
     i ← tr·tilesAcross + tc
     offset, count ← range-read 8 bytes at TileOffsets[i] and TileByteCounts[i]
     raw ← GET url, Range offset … offset+count−1
     tile ← float32(zlib.decompress(raw)).reshape(256, 256)
  stitch into a window array; cells == −9999 are nodata
```

### 1.2 WGS84 ↔ British National Grid (ADR 8; same logic in `src/three-core/bng.ts`)

```text
constants: Airy1830 a=6377563.396 b=6356256.909;  WGS84 a=6378137.000 b=6356752.3142
           NG: F0=0.9996012717, φ0=49°N, λ0=2°W, E0=400000, N0=−100000
           Helmert WGS84→OSGB36: tx=−446.448 ty=+125.157 tz=−542.060 m,
                                 s=+20.4894 ppm, rx=−0.1502″ ry=−0.2470″ rz=−0.8421″
           (OSGB36→WGS84 uses the negated parameters)

wgs84ToBng(lon, lat):
  xyz ← geodeticToCartesian(lat, lon, h=0, WGS84)
  xyz' ← t + (1+s)·R·xyz,  R = [[1,−rz,ry],[rz,1,−rx],[−ry,rx,1]] (radians)
  (φ, λ) ← cartesianToGeodetic(xyz', Airy1830)   # iterate until Δφ < 1e−12
  return tmForward(φ, λ)                           # OS guide C.1 terms I–VI

bngToWgs84(E, N):
  (φ, λ) ← tmInverse(E, N)   # OS guide C.2: iterate φ′ until |N−N0−M| < 0.01 mm
  xyz ← geodeticToCartesian(φ, λ, 0, Airy1830);  apply negated Helmert
  return cartesianToGeodetic(xyz, WGS84)
```

### 1.3 POC box

```text
pts ← route points with dist ∈ [startKm, endKm] (plus interpolated end points)
(lonMin, latMin, lonMax, latMax) ← bbox(pts) widened by 600 m on each side
(Emin, Nmin, Emax, Nmax) ← bbox of wgs84ToBng over the 4 widened corners
snap to level-2 (4 m) pixel edges:  E = Et + 4·k,  N = Nt − 4·k
```

### 1.4 DEM grid (ADR 6) → `public/data/dem-poc.f32` + `dem-poc.json`

```text
window ← read_window(level=2, box)        # 4 m overview; nodes = pixel centres
for each node (r, c): E = Emin + 4c + 2,  N = Nmax − 4r − 2
   h ← window[r][c]
   if h is nodata: h ← bilinear(GLO-30 at bngToWgs84(E, N)); sourceIndex = 1
   else sourceIndex = 0
   if h still nodata: FAIL "no DEM coverage at (E, N)"
write heights as float32 little-endian, row-major north→south (dem-poc.f32),
  and sourceIndex as one byte per node (dem-poc-source.u8)
header: { cols, rows, spacingM: 4, originE, originN, crs: "EPSG:27700",
          source, licence: "Open Government Licence v3.0 (confirmed 2026-10-30)", retrieved, resampling: "unknown (COG overview)",
          fallbackCells: count(sourceIndex = 1) }
```

### 1.5 Trail profile (ADR 9) → `public/data/trail-profile-poc.json`

```text
line ← OSM centreline from the route GeoJSON, clipped to the section
for d from start to end in 1 m steps:
   (lon, lat) ← interpolate along line;  (E, N) ← wgs84ToBng(lon, lat)
   raw[d] ← bilinear(level-0 1 m DTM at (E, N))
for each OSM bridge way overlapping the section (d1, d2):
   a ← d1 − 5 m;  b ← d2 + 5 m                    # abutments
   raw[a…b] ← linear interpolation raw[a] → raw[b]   # DTM has no deck
smooth[d] ← mean(raw[d−12 … d+12])  (window shrinks at the ends)
noise ← stdev(raw − smooth) outside bridge spans      # design risk K1
emit points every 5 m: { distanceM[], elevationM[], smoothingM: 25, noiseStdM: noise, bridges: [[d1, d2]] }
```

### 1.6 OSM features → `public/data/osm-poc.geojson`

```text
for each 0.02°-high chunk of the box: GET api.openstreetmap.org/api/0.6/map?bbox=…
keep: land-cover polygons (landuse/natural/leisure tags), water, highway ways,
      ways tagged bridge|cutting|embankment|tunnel
assemble multipolygon relations (outer minus inner rings); keep the OSM ids
```

### 1.7 Land cover (ADR 10) → `public/data/landcover-poc.u8` + legend

```text
classes in priority order: water, built-up, quarry/rock/scree, woodland, heath/scrub, grass/farmland, other
for each DEM node: (lon, lat) ← bngToWgs84(E, N)
   class ← first class whose polygon contains (lon, lat) (ray casting; inner rings excluded), else "other"
```

### 1.8 Registers (ADR 20)

```text
features-3d.json gets, per scene "Poc3DMaentwrog":
  terrain        approximate  lidar-dtm (4 m resample; datum ±5 m)
  alignment      approximate  osm (centreline way ids)
  trail          proposed     original (concept treatment)
  bridge-159029124 approximate osm 159029124 (requires a bridge tag)
  road-357873359   approximate osm 357873359
  landcover      approximate  osm
  trees          decorative   original (placed in OSM woodland)
  cyclist        decorative   original
  station-maentwrog-road verified waypoints
  earthwork-*    approximate  lidar-dtm   ← generated by scripts/gen-earthworks.ts,
                                           which reuses flattenCorridor (2.5), so the
                                           logic exists once, in TypeScript
assets-3d.json: one entry per file under public/3d/ (none for the POC: the cyclist is procedural)
then: npm run data:sync (ADR 21)
```

## 2. Pure core, `src/three-core/` (ADR 3)

### 2.1 Inverse projection (additive export in `src/data/route.ts`)

```text
project is affine:  (px, py) = A·(lon, lat) + b
unproject(px, py):  rx = 10·px,  ry = −10·py
                    (mx, my) = rotate (rx, ry) by +bearing
                    lon = mx / mPerDegLon + lonCenter;  lat = my / mPerDegLat + latCenter
```

Because `project` is affine, linear interpolation in lon/lat equals linear
interpolation in world space. Resampled trail points therefore stay exactly
on `project()`'s image of the line [G1].

### 2.2 DEM lookups and terrain mesh

```text
heightAtBng(E, N): bilinear on grid; null outside or at nodata
heightAtWorld(x, z): (lon, lat) ← unproject(x, z); (E, N) ← wgs84ToBng(lon, lat); return heightAtBng(E, N)

buildTerrainMesh(grid, land, project, VE):
  for each node (r, c): (lon, lat) ← bngToWgs84(E, N); (px, py) ← project(lon, lat)
     position ← (px, h/10·VE, py);  colour ← PALETTE[land.classes[node]]
  indices: two triangles per cell (r, c)–(r, c+1)–(r+1, c) and (r, c+1)–(r+1, c+1)–(r+1, c)
```

### 2.3 Trail (ADR 13)

```text
buildTrail(route, profile, section, {W, VE}):
  centre ← route points in section, resampled every 2 m by linear interpolation of (px, py),
           always keeping every original vertex (so sampleAt reproduces the polyline exactly [G1])
  for each centre sample: d, hM ← lerp(profile, d)
     y ← hM/10·VE + 0.005                 # 0.05 m above the profile [G4]
     gradient ← dh/dd from the profile at d (central difference)            [TR2]
     tangent ← normalise(next − prev) in 3D
  sampleAt(d): binary search + linear interpolation
  ribbon: left/right edges = centre ± leftXZ·(W/2)/10 with the same y (flat crossfall);
          leftXZ = (tz, −tx) normalised
  maxGradient ← max |gradient|  → reported in docs/validation-3d.md      [TR2]
```

### 2.4 Rider placement on the surface

```text
surfaceY(d) ← trail.sampleAt(d).y
contacts(d): rear at d − L/2, front at d + L/2 (L = wheelbase 1.05 m), each at surfaceY   [C4]
```

### 2.5 Corridor flattening and earthworks (ADR 13)

```text
flattenCorridor(mesh, trail, W, S, s, bridges):
  R ← W/2 + S + s·√2  (in m)    # every triangle under the ribbon has all 3 vertices inside R
  index trail samples in a uniform XZ hash (cell = 2 m)
  for each terrain vertex v:
     foot ← perpendicular foot of v on the centreline (nearest segment); lat ← |v − foot|·10
     if lat ≤ R and foot.d is not inside a bridge span:
        orig ← v.y;  v.y ← trail.sampleAt(foot.d).y − 0.005    # = profile height, 0.05 m under the ribbon [G5a]
        if lat ≤ W/2 + S: depth[foot.d] ← max(depth, (orig − v.y)·10)  (signed: + cut, − fill)
  cutFill ← contiguous runs with |depth| > 2 m (gaps ≤ 4 m merged) → { fromKm, toKm, kind, maxDepthM }   [G5b]
  return { mesh, cutFill }
```

Because a vertex takes the trail height at its own foot point, heights inside
a triangle vary linearly along the track. Terrain under the ribbon matches the
ribbon up to centreline curvature, which is second order.

### 2.6 Rider motion (ADR 15)

```text
speedKmh(g):  clamp(18 − 150·g, 12, 25)      # g as a fraction; strictly decreasing  [C2]
distanceTable(trail, d0, N, FPS):
  D[0] ← d0
  for f in 1 … N−1:  D[f] ← D[f−1] + speedKmh(trail.sampleAt(D[f−1]).gradient)/3.6 / FPS
  require D[N−1] < endKm·1000

cyclistPose(f):
  s ← trail.sampleAt(D[f]);  fwdXZ ← normalise(s.tangent.xz);  left ← (fwd.z, 0, −fwd.x)
  rearY, frontY ← surfaceY(D[f] − L/2), surfaceY(D[f] + L/2)
  position ← (s.x, 0, s.z) + left·(0.5/10);  position.y ← (rearY + frontY)/2   [C3, C4]
  pitch ← atan2(frontY − rearY, L/10)                                       [C5]
  yaw ← atan2(−fwd.z, fwd.x)        # rotates the model's +x onto the tangent  [C5]
  wheelAngle ← (D[f] − D[0]) / (0.34 m)                                      [C6]
  crankAngle ← 2π·(75/60)·f/FPS                                              [C7]
dims: wheel Ø 0.68 m, wheelbase 1.05 m, riding height 1.70 m, length 1.75 m  [C1]
```

### 2.7 Camera shots (ADR 16)

```text
ease(u): trapezoid velocity profile with 15-frame (0.5 s) cubic ramps at both ends  [CA2]

shotA(f) for f ∈ [0, 179]:     # drone side-track
  u ← ease(f/179);  d ← lerp(9000, 9150, u);  s ← trail.sampleAt(d)
  hAbove ← lerp(120, 25, u) m;  side ← 40 m to the right of the tangent
  position ← s.xz + right·side/10;  position.y ← heightAtWorld(position) + hAbove/10
  target ← riderPos(f) + up·(1/10)

shotB(g) for g = f − 180 ∈ [0, 179]:   # follow
  p ← cyclistPose(f);  position ← p.position − fwd·0.8 + left·0.15 + up·0.3   # 8 m back, 1.5 m left, 3 m up
  target ← p.position + fwd·0.5 + up·0.1

withClearance(shot):   # applied to both shots [CA3]
  if pos.y < heightAtWorld(pos) + 0.2: pos.y ← heightAtWorld(pos) + 0.2   # ≥ 2 m above terrain
  if |pos − rider| < 0.15: pos ← rider + normalise(pos − rider)·0.15      # ≥ 1.5 m from rider
fovDeg ← 45                                                                 [CA4]
pose(f) ← f < 180 ? shotA(f) : shotB(f − 180)  — pure: no state between frames  [CA1]
```

### 2.8 Trees (ADR 11)

```text
rand ← mulberry32(SEED)
for each woodland polygon: n ← round(area · density)
   repeat until n placed (max 20·n tries): candidate ← random point in polygon bbox
      keep if inside the polygon and outside the flattened corridor R
   per tree: scale ← 0.8 + 0.4·rand(), yaw ← 2π·rand(), y ← heightAtWorld(x, z)
output: matrices for 2 instanced meshes (conifer, broadleaf, chosen by rand())
```

### 2.9 Registers (ADR 20)

```text
validateFeatures(x): x is an array; each item has a unique non-empty id, kind ∈ KINDS,
   category ∈ {verified, approximate, proposed, decorative}, source.type ∈ TYPES,
   non-empty source.ref and scenes[]; throw with the JSON path of the first failure
validateAssets(x): each item has path, kind, source, licence, non-empty attribution
```

## 3. Runtime (React; ADRs 2, 4, 17)

```text
Scene3DDataProvider: handle ← delayRender()
   fetch dem-poc.json, dem-poc.f32 (ArrayBuffer → Float32Array), landcover-poc.*, trail-profile-poc.json,
         osm-poc.geojson, features-3d.json, assets-3d.json
   validate the registers → continueRender(handle)                     [RN5a]

Poc3DMaentwrog (outside the canvas):
   export FEATURE_IDS = [register ids this scene renders]                   [H1]
   route ← useRouteData();  data ← useScene3DData()
   once (useMemo): scene ← buildPocScene({ route, dem, land, profile })   (src/three-core/poc.ts;
                   the acceptance tests call the same function), plus trees, bridge, road
   per frame: pose ← cyclistPose(f);  cam ← pose(f)
   render <ThreeCanvas width=1920 height=1080>
             TerrainView, TrailView, BridgeView, RoadView, TreesView, CyclistView(pose), CameraRig(cam), Lighting
          overlays beside the canvas:
             DisclaimerBadge every frame                                [H2a]
             "Proposed trail (concept)" frames 0–90                     [H2b]
             "Maentwrog Road (former station)" while the station is in view
             closing caption frames 300–359: mothballed line, restoration proposals, not an approved route  [H3]
             attribution every frame: lidar DTM (OGL), © OpenStreetMap contributors (ODbL)  [L2]
             if VE ≠ 1: "vertical exaggeration ×VE" every frame         [G3]

CameraRig(cam): camera ← useThree().camera; set position, fov, near 0.02, far 2000; lookAt(target);
   updateProjectionMatrix — during render, no useFrame                  [RN1]
TrailView: material with polygonOffset (factor −1) so it never z-fights the terrain
if props.diagnostics: after the first render log "THREE_STATS {calls, triangles}" from gl.info   [RN6]
```

## 4. Checks

### 4.1 Unit tests (`npm test`)

```text
bng:      OS worked example — Airy (52°39′27.2531″N, 1°43′4.5177″E) → E 651409.903, N 313177.270 (±1 mm);
          WGS84 → BNG → WGS84 round trip < 0.01 m at 10 points across the box
route:    |unproject(project(p)) − p| < 1e−9° for all route points
G1:       for each original route vertex in the section, trail centre (x, z) = project(lon, lat) ± 1e−6
G2b:      header.spacingM ≤ 30
G2c:      for each route point in the section: diff = heightAtWorld(project(p)) − p.ele;
          median |diff| ≤ 5 m, max ≤ 30 m (lidar DTM vs a Copernicus DSM, as amended)
G3:       VE = 1, or the overlay text exists for every frame (render check)
G4:       for each profile point: |trail.sampleAt(d).y − (h/10·VE + 0.005)| < 1e−6, so within 0.1 units
G5a:      for each sample outside bridge spans, at lateral offsets −W/2 … W/2 in 0.25 m steps,
          interpolating the flattened mesh's triangle under the point (in metres):
          ribbonY − 0.08 ≤ terrainY ≤ ribbonY − 0.02  (terrain 0.05 m ± 0.03 m under the ribbon)
G5b:      every cutFill run is covered by an earthwork-* feature with category approximate
TR1:      2.5 ≤ W ≤ 4.0
TR2:      every trail gradient equals the profile's central difference at that d; maxGradient is reported
C1:       procedural dims inside the ranges; wheel diameter 0.62–0.72 m
C2:       for f: 12 ≤ speed ≤ 25; speedKmh(+0.021) < speedKmh(−0.021)
C3:       for f: lateral distance(position, centreline) ≤ 1.0 m
C4:       for f: transform each wheel's lowest point by the pose (yaw, pitch, position) and compare with
          surfaceY at that point's distance along the trail: |difference| ≤ 0.05 m at both wheels
C5:       for f: |yaw − tangentYaw| ≤ 5°, |pitch − atan(gradient)| ≤ 1°
C6:       for f: |wheelAngle·r − (D[f] − D[0])| ≤ 1 % of the distance
C7:       cadence = 75 rpm ∈ [60, 90], derived only from f
CA1:      pose(f) computed twice is identical for every f
CA2:      within a shot, outside the 15 ramp frames: speed ratio between consecutive frames ∈ [0.9, 1.1];
          angle between consecutive view directions · FPS ≤ 30°/s
CA3:      for f: pos.y ≥ heightAtWorld(pos) + 0.2 − 1e−9 and |pos − rider| ≥ 0.15 − 1e−9
CA4:      35 ≤ fovDeg ≤ 60
determinism of data: buildTrail, buildTerrainMesh and trees run twice → identical arrays
```

### 4.2 Register and static tests (`npm test`)

```text
H1:  validateFeatures passes; every feature id referenced in src/scenes3d/** exists in the register
G6:  every kind = structure item: source.type ∈ {osm, coflein}; for osm, the way's tags in osm-poc.geojson
     include bridge|cutting|embankment|tunnel
G7:  every place, road or water item has source.type ∈ {waypoints, osm, tiles} and a ref found in that source
L1/C8: every file under public/3d/ appears in assets-3d.json; validateAssets passes; the procedural
     cyclist is registered with source "original"
RN1: scan src/three-core, src/three, src/scenes3d for
     /useFrame|requestAnimationFrame|setInterval|Date\.now|performance\.now|Math\.random/ → none;
     every <ThreeCanvas> import comes from @remotion/three
RN4: every package.json script containing "remotion" and a 3D composition id contains "--gl=angle";
     remotion.config.ts contains no setChromiumOpenGlRenderer
RN5a: each file that creates a loader or calls fetch in 3D code also calls delayRender and continueRender
RG4: 3D sources contain no literal matching /\b5[23]\.\d{3,}\b/ or /-[34]\.\d{3,}\b/
RG5: 3D sources import project/unproject from src/data/route and define no other lon/lat→world function
ADR 3: src/three-core imports nothing from react, three, @react-three/*, remotion
ADR 4: src/three/** contains no useContext, useRouteData or useScene3DData
ADR 21: each data/*.json and *.geojson is byte-identical to its public/data/ copy
ADR 22: package.json pins three 0.186.1, @react-three/fiber 9.8.2, @remotion/three 4.0.539, @types/three 0.186.0
RG2: sha256(tests/route.test.ts) equals tests/baselines/route-test.sha256 (recorded before 3D work) and the suite passes
RG3: npm run lint exits 0 (CI step)
```

### 4.3 Render checks (`npm run test:render`, `scripts/render-checks.mjs`)

```text
RG1: for f in {5, 1200, 2200, 2900}: still CyclingVision (no --gl) → sha256 == tests/baselines/cyclingvision.json[f]
     (baselines captured before any 3D code lands)
RN2: for f in {0, 180, 359}: still Poc3DMaentwrog --gl=angle twice → identical sha256
RN3: render Poc3DMaentwrog --gl=angle → ffprobe: 1920×1080, 30/1 fps, h264, 360 frames
RN5b: still frame 0 → the terrain region contains ≥ 4 distinct land-cover palette colours (± 8 per channel
     after lighting) and none of the canvas clear colour → the terrain and its colours were drawn
RN6: wall time / frames ≤ 2 s; no "delayRender timeout" in the log;
     THREE_STATS from frames 0 and 180: calls ≤ 300, triangles ≤ 2,000,000
H2a, L2, G3: the overlay layers are separate DOM elements; render frames 0, 180, 359 with the diagnostics prop
     that also logs "OVERLAYS [ids]" → requires disclaimer, attribution (and the VE label if VE ≠ 1)
P5-1: ffprobe on the final video: duration 90–120 s, 1920×1080, 30 fps, h264
P5-2: out/previews/<scene>.png exists for every scene in the final composition
RN7: still final composition --scale 2 → image is 3840×2160
results appended to docs/validation-3d.md with date and machine
```

### 4.4 Review checklist (`docs/validation-3d.md`, signed by a reviewer who is not the builder)

```text
H2c  proposed trail surface reads as distinct from mapped features
H3   closing caption mentions the mothballed line and restoration proposals
H4   no on-screen or doc text claims survey precision; DEM/OSM described as approximate
H5   (P5) a scene or caption mentions rail-with-trail
G8   (P4) each scene's register lists the source-register gaps that apply, and affected features are labelled
TR4  (P4) sections flagged private or inaccessible show no trail or a labelled alternative
P4-1 (P4) ≥ 4 of the brief's 8 locations rendered with evidence; exclusions listed with reasons
RN5b visual confirmation of frame 0
each item: pass / fail / accepted-with-reason, reviewer id, date
```

## 5. Later phases (logic outline)

```text
P3-1: static count — each of TerrainView, TrailView, CyclistView, CameraRig is imported by ≥ 2 scene files (by end of P4)
CA5:  shot library = aerial, follow, firstPerson, sideTrack, groundClose, wideEstablishing;
      each built from 2.7 primitives; each passes the CA1–CA4 tests over a sample route window
C9:   walkers reuse 2.6 with speedKmh_walk = clamp(4.5 − 30·g, 3, 6), height 1.5–1.95 m; C1–C5 tests reused
TR3:  crossings ← intersections of the trail centreline with OSM highway ways (segment intersection, as used
      for bridge 159029124); each crossing treatment is registered as proposed with the highway's OSM id
TR4:  per section, the register flags "private" or "inaccessible" from the evidence register;
      such spans get no ribbon, or an alternative polyline registered as proposed
G8:   per scene, gapRefs ← source-register gaps whose location falls in the scene's window; the test checks they are present
P4-1: sections ← list of windows (km ranges) with an evidence check; excluded locations listed with the reason
P5-1/2: final composition = <Series> of 2D and 3D scenes (own ADR); previews via still per scene
```

## 6. Traceability: every acceptance criterion

| ID | Logic that meets it | Check |
|---|---|---|
| G1 | 2.1, 2.3 | 4.1 G1 |
| G2 | 1.1, 1.4 | 4.1 G2b, G2c; register (1.8) |
| G3 | §0 VE, 3 overlay | 4.1 G3, 4.3 |
| G4 | 1.5, 2.3 | 4.1 G4 |
| G5 | 2.5, 1.8 earthworks | 4.1 G5a, G5b |
| G6 | 1.6, 1.8 | 4.2 G6 |
| G7 | 1.6, 1.8 | 4.2 G7 |
| G8 | 5 | 4.4 |
| H1 | 1.8, 2.9 | 4.2 H1 |
| H2 | 3 overlays, 2.3 colour | 4.3, 4.4 |
| H3 | 3 closing caption | 4.4 |
| H4 | 3 wording | 4.4 |
| H5 | 5 | 4.4 |
| RN1 | 2.x pure, 3 CameraRig | 4.2 RN1 |
| RN2 | 2.x pure, 2.8 seeded | 4.3 RN2 |
| RN3 | 3 composition | 4.3 RN3 |
| RN4 | ADR 19 scripts | 4.2 RN4 |
| RN5 | 3 provider | 4.2 RN5a, 4.3 RN5b, 4.4 |
| RN6 | design budget, 3 diagnostics | 4.3 RN6 |
| RN7 | 5 | 4.3 RN7 |
| TR1 | §0 W | 4.1 TR1 |
| TR2 | 2.3 | 4.1 TR2 |
| TR3 | 5 | 4.2 (register) |
| TR4 | 5 | 4.4 |
| C1 | 2.6 dims | 4.1 C1 |
| C2 | 2.6 speedKmh | 4.1 C2 |
| C3 | 2.6 position | 4.1 C3 |
| C4 | 2.4 | 4.1 C4 |
| C5 | 2.6 pitch, yaw | 4.1 C5 |
| C6 | 2.6 wheelAngle | 4.1 C6 |
| C7 | 2.6 crankAngle | 4.1 C7 |
| C8 | 1.8 assets | 4.2 L1/C8 |
| C9 | 5 | 4.1 reused |
| CA1 | 2.7 | 4.1 CA1 |
| CA2 | 2.7 ease | 4.1 CA2 |
| CA3 | 2.7 withClearance | 4.1 CA3 |
| CA4 | 2.7 fov | 4.1 CA4 |
| CA5 | 5 | 4.1 reused |
| RG1 | ADR 2 (no 2D edits), ADR 19 | 4.3 RG1 |
| RG2 | §2.1 is additive only | 4.2 RG2 |
| RG3 | — | 4.2 RG3 |
| RG4 | 1.x data files | 4.2 RG4 |
| RG5 | 2.1 | 4.2 RG5 |
| L1 | 1.8 | 4.2 L1/C8 |
| L2 | 3 attribution | 4.3, 4.4 |
| P3-1 | 5 | 5 static count |
| P4-1 | 5 | 4.4 |
| P5-1 | 5 | 4.3 P5-1 |
| P5-2 | 5 | 4.3 P5-2 |
| P5-3 | docs | 4.4 (docs present) |
