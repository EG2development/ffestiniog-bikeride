# Pseudocode: the 1:30 reel (core logic)

Status: written 2026-10-25 for mission `msn_44274a1de641722956fc9ce5`, task t5. It
implements the reel extension of `docs/spec-3d.md` (RL1–RL34, ids in brackets)
following the "Reel design" part of `docs/design-3d.md` (D23–D36) and ADRs 27–40. The water,
readiness, clarity and buildings iteration (WA, RD, CL, BL, X; ADRs 41–52) is in
`docs/pseudocode-reel-v2.md`.
Part I (`docs/pseudocode-3d.md`) still holds for everything it covers; this file only
adds what the reel changes. Section 5 traces every RL criterion to the logic that
meets it and the check that proves it.

## 0. Conventions (unchanged from Part I)

- World units: 1 unit = 10 m; 3D point = `(px, hM/10·VE, py)` with `(px, py) = project(lon, lat)`, VE = 1.
- Two ground heights: `heightAt` is the **rendered** ground (after corridor flattening), `bareHeightAt` the DTM. Every new object names the one it uses [RL15].
- Frames: `F = 2700`, FPS = 30 [RL1]. Nothing reads a clock; every animation is `f(frame)` [RL23].

## 1. Data pipeline per section (ADR 29, ADR 32)

```text
SECTIONS ← { corridor:    {km: [0, 13.24],  level: 4, spacing: 16 m, margin: 600 m, kind: aerial},
             blaenau:     {km: [0, 1.5],    level: 2, spacing: 4 m,  margin: 600 m, kind: ground},
             vale-north:  {km: [1.5, 4.8],  level: 2, spacing: 4 m,  margin: 600 m, kind: ground},
             vale-south:  {km: [4.8, 7.7],  level: 2, spacing: 4 m,  margin: 600 m, kind: ground},
             maentwrog:   {km: [7.7, 9.7],  level: 2, spacing: 4 m,  margin: 600 m, kind: ground},   # exists
             trawsfynydd: {km: [9.7, 13.24],level: 2, spacing: 4 m,  margin: 600 m, kind: ground} }
# level is the COG overview index (0 = 1 m, 1 = 2 m, 2 = 4 m, 3 = 8 m, 4 = 16 m); spacing is the node spacing in metres written to the header

build_section(id):                                                   [RL5, RL6, RL7]
  S ← SECTIONS[id];  pts ← route points with S.km[0]·1000 ≤ dist ≤ S.km[1]·1000
  bbox ← bounds(pts) grown by S.margin;  (E0, N0, E1, N1) ← wgs84_to_bng(bbox corners)
  grid ← cog.read_window(S.level, bbox)            # Part I §1.1; the level is a parameter now
  osm ← fetch_bbox(bbox) if S.kind = ground else []                   # K6: the corridor fetches nothing (it is draped, ADR 33)
  water ← polygons in osm classed as water (natural=water, waterway=riverbank, landuse=reservoir, any water=*)   [RL14]
  for each w in water:                                                # ADR 32
    shoreH ← median(grid height at ring nodes of w that are not nodata)
    for each grid node inside w with value = nodata or |value − shoreH| > 2 m: value ← shoreH   # counted as fill.waterShoreHeight
  nodata outside water: value ← mean of the valid 8-neighbours, repeated up to 50 passes      # counted as fill.neighbourMean
  if any grid node still nodata: stop ("nodata cells remain after filling")
  header ← {cols, rows, spacingM: S.spacing, originE, originN, crs, source, licence, nodata, fallbackCells,
            fill: {nodataBefore, waterShoreHeight, neighbourMean, note}, file: "dem.f32", sourceFile: "dem-source.u8"}   # filled cells have sourceIndex 1
  landcover ← Part I §1.7 on this grid (ground only; the corridor's nodes are all "other")
  profile ← Part I §1.5 on this km range with ADR 23 spans, sampled at 1 m (ground) or at the window's own level (corridor, 16 m)   [RL8]
  write public/data/sections/<id>/{dem.json, dem.f32, dem-source.u8, landcover.json, landcover.u8, trail-profile.json, osm.geojson}
  registers → data/features-<id>.json: one terrain (and, ground only, landcover) entry per window; bridges, overbridges, roads and
             water bodies with their OSM ids (none for maentwrog, whose entries live in features-3d.json)                  [RL7, RL29]
             earthworks are written separately by scripts/gen-earthworks.ts --section <id>; no gapRefs are written (RL9 is a recorded limitation)
  tags: only KEEP_TAGS leave the pipeline (building reduced to "yes"; name only for the railway); a register note copies just highway=<value>   [RL31]
```

## 2. Pure core

### 2.1 Section config and assembly (ADR 27, ADR 40)

```text
SectionConfig ← {id, title, kind, kmRange, window, frames, startDistM, shots: ShotSpec[], captionIds, featureIds, ve: 1, maxTreesPerKind?}
SECTIONS ← one entry per scene (nine: intro, heritage, overview, blaenau, vale-north, vale-south, maentwrog, trawsfynydd, closing);
           SECTIONS.maentwrog reproduces POC exactly (km 7.7–9.7, start 9120, two shots)   [D36]

buildSectionScene(cfg, inputs):                                   # replaces buildPocScene + buildPocExtras
  trail ← buildTrail(route, profile, cfg.kmRange, {widthM: 3, ve})           # Part I §2.3
  terrain ← flattenCorridor(buildTerrainMesh(dem, land, project, ve), trail, {…, ve})   # Part I §2.5
  terrain ← shadeTerrain(terrain, dem)                                        # §2.3 below        [RL10]
  heightAt / bareHeightAt as Part I (rendered ground from the flattened mesh)                     [RL15]
  table ← distanceTable(trail, cfg.startDistM, cfg.frames, 30);  riderAt, poseAt as Part I
  roads ← buildRoadMesh(roads in register, project, max(bareHeightAt, heightAt))                   [RL15]
  water ← cfg.kind = ground ? waterBodies(osm, project, heightAt, 10 000 m²) : []                 [RL14]
  trees ← cfg.kind = ground ? placeTrees(dem, land, project, trail, {roads, ve, maxTrees: cfg.maxTreesPerKind if set}) : none   # near zone 300 m, 4 per 100 m² are the defaults   [RL13]
  shot  ← shotsOf(cfg, scene)                                                 # §2.6            [CA1–4]
  return {trail, terrain, cutFill, table, riderAt, heightAt, bareHeightAt, roads, bridges, water, trees, shot}
invariant: buildSectionScene(SECTIONS.maentwrog, pocInputs) ≡ buildPocScene(pocInputs) + buildPocExtras(…)   [D36 test]
```

### 2.2 Atmosphere (ADR 30)

```text
ATMOSPHERE[kind] ← { zenith, horizon, fogDensity, sunAzimuthDeg: 200, sunElevationDeg: 35 }     # ground: 0.0009, aerial: 0.0003 per unit
skyDome(kind): inside-out sphere r = 1200 units centred on the camera; colour(y) ← mix(horizon, zenith, clamp(y, 0, 1)^0.6); sun disc at sunDirection
fog ← FogExp2(colour = ATMOSPHERE[kind].horizon, density = fogDensity)          # equality by construction      [RL11]
test: fogColour(kind) = ATMOSPHERE[kind].horizon for both kinds
```

### 2.3 Terrain shading (ADR 31)

```text
shadeTerrain(mesh, grid):                                                      [RL10]
  for each node (r, c): slope ← |∇h| from central differences of the DEM (m/m), capped at 1
    hNorm ← (h − hMin) / (hMax − hMin)
    k ← (1 − 0.35·slope) · (0.92 + 0.12·hNorm)        # steeper darker, higher slightly paler; k ∈ [0.60, 1.04]
    colour(node) ← clamp(landCoverColour(node) · k, 0, 1)
  return mesh with the new colours (positions untouched)
test: a 45° slope node is darker than a flat node of the same class; every channel stays in [0, 1]; a flat grid is unchanged within 8 %
```

### 2.4 Water bodies (ADR 32)

```text
waterBodies(osm, project, heightAt, minAreaM2):                                [RL14]
  for each feature tagged natural=water, waterway=riverbank or landuse=reservoir with Polygon or MultiPolygon geometry (outer rings only):
    rings ← project each outer ring to world (x, z);  areaM2 ← shoelace(outer ring) · 100
    if areaM2 < minAreaM2: skip
    surfaceY ← median(heightAt(x, z) for ring nodes with finite height)        # the DTM statistic, not a level
    yield {id: osm id, rings, surfaceY, areaM2}
view: ShapeUtils.triangulateShape(outer ring, no holes) into a BufferGeometry at y = surfaceY + 0.002; normal offset ← (frame · 0.0007) mod 1 in both axes   # f(frame) only
test: a 100 m square polygon gives area 10 000 m² and surfaceY = the median of its corner heights; a 0.5 ha pond is skipped
```

### 2.5 Tile UVs for the aerial drape (ADR 33)

```text
tileRange(bbox, z): x ← floor((lon + 180)/360 · 2^z);  y ← floor((1 − ln(tan φ + sec φ)/π)/2 · 2^z) for the four corners → {x0, x1, y0, y1}
tileUvs(positions, unproject, range, z):                                        [RL6, RL22]
  for each vertex (x, _, z): (lon, lat) ← unproject(x, z); (tx, ty) ← fractional tile coords at level z
    u ← (tx − range.x0) / (range.x1 − range.x0 + 1);  v ← 1 − (ty − range.y0) / (range.y1 − range.y0 + 1)
provider: composite canvas (256 px per tile) from the cached tiles that data/tiles-manifest.json lists, behind delayRender;
          a tile the cache lacks is painted the horizon colour, counted and logged (MAP_DRAPE missing …); a cached tile that fails to load → cancelRender
test: lon −3.9, lat 52.95 at z 12 gives the tile the 2D manifest lists; UVs of the bbox corners are (0, 0), (1, 1) within 1 px
```

### 2.6 Shots per section (ADR 35)

```text
ShotSpec ← drone-side | follow | aerial-orbit | pull-back | hold  (fields as in the design)
shotsOf(cfg, scene):
  for each spec in cfg.shots:
    drone-side  → droneSideTrack({trail, riderAt, heightAt, …spec})            # Part I §2.7
    follow      → followShot({poseAt, …spec})
    aerial-orbit→ aerialOrbit({centre: trail.sampleAt(centreDistM), …spec})
    pull-back   → pullBack({from: trail.sampleAt(fromDistM), target: same, …spec})
    hold        → constant pose at trail.sampleAt(distM) + side·right + heightM up, looking at the trail sample 200 m ahead
    clearance   ← cfg.kind = ground ? withClearance(shot, heightAt, riderAt(section frame), 2, 1.5)
                                    : withClearance(liftClear(shot, heightAt, spec.frames, 20), heightAt, () → far away, 20, 0)
  return sequenceShots(list)                       # Σ spec.frames = cfg.frames is checked by tests/three-core/sections.test.ts, not asserted here

aerialOrbit(p)(f): u ← ease(f);  θ ← lerp(fromDeg, toDeg, u)
  position ← centre + (radiusM/10)·(cos θ, 0, sin θ) + up·heightM/10;  target ← centre;  fov 45
pullBack(p)(f): u ← ease(f);  back ← lerp(startHeightM, backM, u)/10 along p.back (a unit XZ direction, default (0, 1); sections pass −tangent)
  position ← from + back·(bx, 0, bz) + up·lerp(startHeightM, endHeightM, u)/10;  target ← p.target   # starts as far back as it is high: a 45° look-down
liftClear(shot, heightAt, frames, minAboveM): lift ← max over f of (ground(f) + minAboveM/10 − y(f)), at least 0; the whole shot rises by that one constant
CA2 holds when (toDeg − fromDeg)/frames·30 ≤ 30°/s and the eased speed change per frame ≤ 5 %        [CA1–CA4 per section]
```

### 2.7 Vegetation near zone (ADR 37)

```text
placeTrees(…, {nearZoneM: 300, densityPer100m2: 4, density?: [dMin, dMax], maxTrees: 6000 per kind, probability?}):   # defaults; production passes {roads, ve, maxTrees?}   [RL13]
  candidate nodes ← woodland nodes with distanceToTrail ≤ nearZoneM/10 (the trail-sample hash from Part I)
  target ← densityPer100m2 clamped into density if given;  keep ← clamp(target/100 · spacing², 0, 1)
  p ← probability if passed, else min(keep, 0.9·maxTrees/(0.55·candidates))     # the cap thins the whole wood evenly (review R2); DEFAULTS.probability (0.12) is unused unless passed
  draw per node as Part I (seeded, all draws made); keep if drawn and clear of the trail (10 m) and roads (2 m)
  stop at maxTrees per kind; far woodland gets no instances (its colour stays)
test: on a synthetic 200 m woodland square around a straight trail, kept trees per 100 m² ∈ [dMin, dMax]; 0 trees beyond 300 m
```

### 2.8 Cyclist parts (ADR 34)

```text
cyclistParts(dims, crank, wheel):                                                [RL16, C1]
  r ← dims.wheelDiameterM/2;  half ← dims.wheelbaseM/2;  rear ← (−half, r, 0);  front ← (half, r, 0)   # centred on the bottom bracket; the only two dims read
  constants (bike space, metres): BB (0, 0.3), HIP (−0.12, 0.98), seat (−0.12, 0.85), head tube (0.45, 0.88), bar (0.4, 0.98), shoulder (0.25, 1.42);
                                   crank 0.172, thigh 0.45, shin 0.47
  parts ← [per wheel: torus tyre at the hub + 3 spoke capsules turned by −wheel (material rim);
           capsules chainstay (rear → BB), seatstay (rear → seat), seat tube (BB → seat), top tube (seat → head tube), down tube (BB → head tube),
           fork (head tube → front), bar (±0.22 m across);  capsule torso (HIP → shoulder);  one arm capsule per side (shoulder → bar);
           sphere head (skin) and sphere helmet (scaled 1, 0.72, 0.92);
           per side (z = ±0.1 m): foot ← BB + crank·(cos a, sin a) with a = −(crank ± π); knee ← twoBone(HIP, foot, thigh, shin, bend forward);
           capsules thigh (HIP → knee), shin (knee → foot), crank arm (BB → foot)]
  no box parts, no saddle, no shoes;  every part has material ∈ {frame, tyre, rim, rider, helmet, skin};  +x forward, +y up, +z to the rider's right
partsBounds(parts): min/max over every part's a, b ± r (× the largest scale component)
test: bounds height ∈ [1.5, 1.9] m, length ∈ [1.6, 1.9] m, two tyres with Ø ∈ [0.62, 0.72] m for defaultCyclistDims();
      |knee − hip| = thigh and |foot − knee| = shin at every crank angle (feet on the pedals)
```

## 3. Runtime

```text
REEL_SCENES ← [{intro, corridor, intro, 0, 240}, {heritage, corridor, heritage, 240, 240}, {overview, corridor, overview, 480, 300},
               {blaenau, blaenau, blaenau, 780, 300}, {vale, vale-north, vale-north, 1080, 270}, {vale, vale-south, vale-south, 1350, 270},
               {maentwrog, maentwrog, maentwrog, 1620, 300}, {trawsfynydd, trawsfynydd, trawsfynydd, 1920, 480}, {closing, corridor, closing, 2400, 300}]
               # {id, section (window), config, from, frames}: nine entries for eight scenes;  Σ frames = 2700                [RL2]
Reel3D: <Series> of <Series.Sequence durationInFrames=frames> each → Section3D({section: config}) (a static import; the lazy boundary is Root.tsx);
        CAPTIONS rendered once over the whole series in reel frames; premount 2 s (config)                                     [RL3, RL27]
Root.tsx: lazyComponent for Reel3D and nine Section-<id> entries (one module, Section3D); calculateMetadata reads REEL_FRAMES / SECTIONS[id].frames; no static 3D import  [RL3]

Section3D({section}): cfg ← SECTIONS[section] (unknown → named error); RouteDataProvider → Scene3DDataProvider({section: cfg.window}) [→ MapDrapeProvider(zoom 15) if aerial]
  → useMemo(buildSectionScene) → per frame pose, cam → <ThreeCanvas shadows> SkyDome, Lighting(focus: the rider on ground sections, cam.target on aerials),
    Terrain(or MapDrape), Trail, Roads, Bridges, Water, Trees, Cyclist (ground only), CameraRig
  → overlays from the caption list (POC_CAPTIONS, the section's own, or none inside the reel), each with data-overlay; OverlayLog when diagnostics   [RL17–RL22]
Scene3DDataProvider({section}): paths data/sections/<section>/…; validators as Part I; features-3d.json + features-<section>.json merged; hold released after mount (RN5c)
MapDrapeProvider: loads the cached tiles of tileRange(window bbox, 15) behind delayRender; passes {canvas, range, z, missing} as props
CAPTIONS ← [disclaimer 0–2700 badge; attribution 0–2700 (one string on every frame: lidar OGL, OSM ODbL, OpenTopoMap CC-BY-SA);
            intro-title 30–220; heritage 300–450 (≥ 4 s); overview-title 500–700; live-station 800–940; vale-north-title 1100–1260; vale-title 1380–1540;
            private-home 1650–1800; decommissioning 1950–2110; concept-card 2490–2700 (≥ 5 s, fully visible to the end)];  POC_CAPTIONS for Poc3DMaentwrog
```

## 4. Checks

```text
4.1 unit (npm test): sections (config sums, Maentwrog invariant), reel-timeline (= spec table, Σ = 2700), reel-captions (ranges, durations),
    atmosphere (fog = horizon), shading, water, tileUv, cyclistModel (C1 bounds, pedals), trees (density band), camera (orbit, pull-back CA1–4)
4.2 static: lazy registration of Reel3D and every section [RL3]; no static 3D import; RN1 over every 3D directory [RL23];
    fetch hosts ⊆ {dmwproductionblob.blob.core.windows.net, api.openstreetmap.org} [RL30]; no `tags.` in JSX text [RL31];
    RL28 (every asset under public/3d registered) is vacuous until an asset file exists; data/public copies identical
4.3 render (test:render): RG1 stills [RL25] (the full 2D md5 adfca9a7… and the entry chunk within 2 % are t8/t11 benchmark measurements in
    docs/validation-3d.md, not test:render checks); Reel3D ffprobe 1920×1080 30/1 h264 2700 [RL1];
    RN2 on frames 0, 1349, 2699 rendered twice [RL23]; blank scan over all 2700 frames [RL26, RL27];
    renderer.info at one frame per scene and at the last frame before each cut {239, 479, 779, 1079, 1349, 1619, 1919, 2399}, plus 0/1349/2699:
    19 distinct frames (20 stills; 1349 twice), each ≤ 300 calls, ≤ 2 M tris [RL24];
    wall time ≤ 2 s/frame and the full render ≤ 30 min [RL24]; overlays visible (opacity ≥ 0.9) at 0, 1349, 2699 and one frame per scene [RL17–RL22];
    previews: one still per scene into out/previews/ [RL32]
4.4 per-window acceptance (real data): G2 per window [RL5, RL6]; max gradient per section ≤ 4 % except listed dips [RL8];
    roads ≥ 0.2 m above the rendered ground [RL15] (POC only: poc-acceptance); the corridor mesh ≤ 400 k triangles [RL6]
4.5 review (someone other than the author; docs/validation-3d.md): RL9, RL10, RL11, RL12, RL14, RL18–RL21, RL27, RL29, RL33, RL34
```

## 5. Traceability: every reel criterion

| ID | Logic that meets it | Check |
|---|---|---|
| RL1 | 3 (REEL_FRAMES, Reel3D) | 4.3 ffprobe |
| RL2 | 3 (REEL_SCENES) | 4.1 reel-timeline |
| RL3 | 3 (Root.tsx lazy) | 4.2 |
| RL4 | 2.1 | 4.1 sections; 4.2 |
| RL5 | 1 (ground windows) | 4.4 G2 per window |
| RL6 | 1 (corridor at 16 m), 2.5 | 4.4; 4.1 tileUv |
| RL7 | 1 (osm, registers) | 4.1 registers; review |
| RL8 | 1 (profile per section) | 4.4 gradient |
| RL9 | — (no gapRefs are written; a limitation the spec records) | 4.5 |
| RL10 | 2.3 | 4.1 shading; 4.3 colour bins; 4.5 |
| RL11 | 2.2 | 4.1 atmosphere; 4.5 |
| RL12 | Lighting (Part I D16) + 2.2 sun | 4.2 constants; 4.5 |
| RL13 | 2.7 | 4.1 trees |
| RL14 | 1 (water fill), 2.4 | 4.1 water; 4.5 |
| RL15 | 2.1 (heightAt vs bareHeightAt) | 4.4 roads (POC only); 4.2 |
| RL16 | 2.8 | 4.1 cyclistModel |
| RL17 | 3 CAPTIONS disclaimer | 4.3 overlays |
| RL18 | 3 CAPTIONS concept-card | 4.3; 4.5 |
| RL19 | 3 CAPTIONS heritage | 4.3; 4.5 |
| RL20 | 3 CAPTIONS live-station | 4.3; 4.5 |
| RL21 | 3 CAPTIONS private-home, decommissioning | 4.3; 4.5 |
| RL22 | 3 CAPTIONS attribution (+ CC-BY-SA) | 4.3 |
| RL23 | §0 (f(frame) only), 2.4, 2.6 | 4.3 RN2; 4.2 RN1 |
| RL24 | 2.7 caps, 2.4 no reflection, 1 levels | 4.3 renderer.info at scenes and cuts; wall time |
| RL25 | nothing in 2D changes; lazy entries only | 4.3 RG1; md5 and chunk size by benchmark (docs/validation-3d.md) |
| RL26 | 3 (premount, holds after mount) | 4.3 blank scan |
| RL27 | 3 (hard cuts, premount) | 4.3 blank scan; 4.5 |
| RL28 | registers (Part I 1.8) | 4.2 (vacuous: no asset file exists yet) |
| RL29 | 1 (registers with sources) | 4.5; 4.1 registers |
| RL30 | 1 (fetch scripts) | 4.2 hosts |
| RL31 | 1 (KEEP_TAGS allowlist), 3 (labels from data) | 4.2 `tags.`; review |
| RL32 | — | 4.3 previews |
| RL33 | — | 4.5 (the log) |
| RL34 | 1, 3 (six windows; nine sequences for eight scenes) | 4.5 |
