# Pseudocode: water, readiness, clarity and buildings (reel, iteration 2)

*Written at t5 before the build; brought up to date with the shipped code at t13 (2026-10-26). Lines marked t7–t12 changed during the build.*

Status: written 2026-10-25 for mission `msn_33e838999675db739df3c922`, task t5.
- **Inputs:** spec rows WA, RD, CL, BL and X (`docs/spec-3d.md`); design D37–D48
  (`docs/design-reel-v2.md`); ADRs 41–52.
- **Tags:** each step is tagged `[ID]` with the requirement it satisfies.
- **Coverage:** §7 maps every ID to its logic and its check.

## 0. Conventions

- One world unit is 10 m. A height of h metres sits at `y = h / 10 * ve`.
- Animation is a function of the frame number only: no clocks or randomness (RN1).
- Two ground heights exist. `heightAt` is the **rendered** ground (after corridor
  flattening); `bareHeightAt` is the DTM. Water and buildings say which one they use.
- Rings are closed with no duplicate end node. In plan (x, z), "anticlockwise" means a
  positive signed area: `A = ½ Σ (x_i z_{i+1} − x_{i+1} z_i)`.

## 1. Pipeline (Python; network only where marked)

### 1.1 `polygon_rings(feature)` — one normaliser, mirrored by the core's `polygonsOf` [WA3]
```
parts ← [coords] if Polygon else coords if MultiPolygon else []
out ← [(dedupe(p[0]), [dedupe(h) for h in p[1:]]) for p in parts]          # geometry holes
for ring in feature.properties.inner_rings or []:
    k ← the part holding most of ring's vertices                           # its first vertex may lie on the shore (t10)
    if no part holds any: log("hole outside every part", feature.id); continue
    out[k].holes.append(dedupe(ring))
for (outer, holes) in out: orient(outer, anticlockwise); orient(each hole, clockwise)
return out                                   # a one-part MultiPolygon gives the same as a Polygon
```

### 1.2 Completing water relations — `fetch_bbox.py`, network: OSM API [WA5]
```
for rel in relations with type=multipolygon and water tags (natural=water | waterway=riverbank | landuse=reservoir):
    if no outer ring closes inside the box: keep rel as a placeholder {incomplete: true, no geometry}   # t10
for every water relation (placeholders included):                       # complete_water_relations
    full ← GET api.openstreetmap.org/api/0.6/relation/<id>/full
    rings ← close_rings(all member ways of full)          # outer and inner roles
    replace rel.geometry and rel.properties.inner_rings; mark completed=true
--reuse-osm: also restore any overbridge way named in trail-profile.json but missing from osm.geojson (fetch_way_full)
```

### 1.3 `water_levels(windows)` — once per body, network: lidar COG [WA5]
```
for body in water features ≥ 1 ha (area = |A(outer)| − Σ|A(hole)| in m²) touching any ground window:
    box ← bbox(body.outer) + 50 m
    dtm ← Cog(DTM_URL).read_window(level 2 (4 m), box)
    s ← nearest-node samples of dtm every 5 m along body's largest outer ring, nodata dropped
    levels[body.id] ← { levelM: median(s), samples: len(s), cogLevel: 2, retrieved: today }
write data/water-levels.json, keys sorted
```

### 1.4 `fill_water(grid, bodies, levels)` [WA4]
```
for body: for (outer, holes) in polygon_rings(body):
    inside ← point_in_ring(cells, outer) AND NOT any(point_in_ring(cells, h) for h in holes)
    level ← levels[body.id] if present else shore_median(grid, outer)
    fix ← inside AND (grid == nodata OR not finite OR |grid − level| > 2 m OR grid > level)   # ground above the level rose through the surface (t10)
    grid[fix] ← level; source[fix] ← 1; count fill.waterShoreHeight += |fix|
# island cells lie in a hole, so they are never touched
```
The land-cover pass uses the same `polygon_rings` [WA3].

### 1.5 `--self-test` (run by CI and by `tests/pipeline-python.test.ts`) [WA3, WA4]
```
grid ← 40×40 at 100 m; island cells (18..22)² at 105 m; lake = square 10..30 with hole 18..22
fill → lake cells = 100; island cells still 105                                          [WA4]
MultiPolygon of two squares, each with its own hole → each hole cuts only its own part   [WA3]
Polygon vs one-part MultiPolygon with the same rings → identical grids                   [WA3]
inner_rings in properties == the same hole in coordinates[1:] → identical                [WA3]
an island whose first vertex lies on the shore is still a hole                            [t10]
ground 0.6 m above the level inside the lake → lowered to it; island ground untouched     [t10]
a water relation cut by the box → kept as a placeholder                                    [t10]
keep_owned keeps the register's building and earthwork entries on a rebuild               [t9, t10]
exit 0 if all hold, else print the failing case and exit 1
```

## 2. Water in the core and the view

### 2.1 `waterBodies(osm, project, heightAt, minAreaM2, levels?, ve = 1)` [WA3, WA5]
```
for f in osm with water tags:
    polys ← polygonsOf(f.geometry, f.properties.inner_rings) projected to XZ
    area ← 100 · Σ_p (|A(p.outer)| − Σ |A(hole)|)                         # m²
    if area < minAreaM2: continue
    surfaceY ← levels[f.id] / 10 · ve if defined else median(heightAt on every outer vertex)
    push { id: f.id, polygons: polys, surfaceY, areaM2: area }           # one body per feature, holes kept
```

### 2.2 `waterArrays(polygons, y)` — `src/three/waterGeometry.ts` [WA1, WA2]
```
for p in polygons:
    c ← p.outer as Vector2(x, z); if ShapeUtils.isClockWise(c): reverse(c)
    hs ← p.holes as Vector2(x, z); for each h: if not isClockWise(h): reverse(h)
    tris ← ShapeUtils.triangulateShape(c, hs)
    verts ← c ++ flatten(hs)                                   # index space used by triangulateShape
    for (a, b, c3) in tris:
        u ← verts[b] − verts[a]; v ← verts[c3] − verts[a]
        ny ← u.z · v.x − u.x · v.z                             # y of (u, 0) × (v, 0) in (x, y, z)
        emit (a, b, c3) if ny > 0 else (a, c3, b)              # every triangle faces +Y
positions ← (x, y, z) per vertex, with no lift; return { positions, indices }
```

### 2.3 `WaterView` [WA1, WA6, WA7]
- Build the geometry from `waterArrays(body.polygons, body.surfaceY)`, then call
  `computeVertexNormals()`; every normal comes out +Y.
- Material: `FrontSide`, `polygonOffset` true, factor −2, units −2.
- Ripple: `normalMap.offset = (frame · 0.0007) mod 1`, as now.

## 3. Readiness

### 3.1 `createLoadGate({ label, delay, release, cancel })` — pure; `src/data/loadGate.ts` [RD1–RD4]
```
state: gen = 0, cur = null (gen, key, handle, controller, released, hasData), pending = null, disposed = false
hold(key):                                              # called in the render body (t7)
    if disposed or cur.key == key or pending.key == key: return
    old ← pending; pending ← { key, handle: delay(label(key)) }; if old: release(old.handle)
start(key, load, onData) → gen:
    if cur and cur.key == key: return cur.gen
    g ← ++gen; h ← pending.handle if pending.key == key else delay(label(key))   # reuse the render-time hold
    pending ← null                                      # the new hold comes first, so there is no gap
    if cur: cur.controller.abort(); if not cur.released: release(cur.handle)
    ctl ← new AbortController; cur ← { gen: g, key, handle: h, controller: ctl, released: false }
    onData(null)                                        # stale data never shows with the new input [RD3]
    load(ctl.signal)
      .then(d → if disposed or cur.gen ≠ g: return; cur.hasData ← true; onData(d))
      .catch(e → if disposed or cur.gen ≠ g or e.name == "AbortError": return; cancel(e))   [RD4]
mounted(g): if cur.gen == g and cur.hasData and not cur.released: release(cur.handle); cur.released ← true
dispose(): disposed ← true; release pending; abort cur; if cur and not cur.released: release(cur.handle)
```
`useLoadGate(label, key, load)` keeps the gate in a ref and calls `hold(key)` in the render body,
so the first frame of a new input is already held: a hold taken in an effect let a parallel render
capture black frames after cuts (t7). An effect on `key` calls `start`; a second effect calls
`mounted(gen)` after the children commit (RN5c). The state remembers its key, and the hook returns
data only for the current key (t10). Cleanup disposes the gate and drops it, so effects run
again after a cleanup make a fresh one (t10). `memoOnSuccess(load)` (t8) keeps successful loads by
key for a tab, so the four aerial scenes share one corridor drape.

### 3.2 Actionable errors [RD5]
```
class AssetLoadError(section, path, reason): message = `section ${section}: ${path}: ${reason}`
fetchChecked(section, path): r ← fetch(staticFile(path)); if not r.ok: throw AssetLoadError(section, path, `HTTP ${r.status}`)
json parse error   → AssetLoadError(section, path, "invalid JSON")
validator error    → AssetLoadError(section, path, e.message)
tile img.onerror   → AssetLoadError(section, tilePath, "failed to load")
manifest missing   → AssetLoadError(section, "data/tiles-manifest.json", ...)
RouteDataProvider uses section = "route"
```

### 3.3 Fix only what is shown [RD7]
- Inspection evidence (t1) is recorded at file:line, and the new tests fail first.
- A provider moves onto the gate only for the faults shown: unmount-cancel and input
  change (all three providers), and the missing section in errors (drape).
- Each fix is reverted once to watch its test fail, then restored. The record goes in
  `docs/validation-3d.md`.

### 3.4 Render-level checks — `scripts/render-checks.mjs` [RD1, RD2, RD6]
```
for id in SECTION_IDS:
    for f in {0, ⌊frames/2⌋, frames−1}:
        fresh `remotion still … Section-<id> --frame=f --gl=angle`; assert luma(centre) ≥ 20 and bins ≥ 4   [RD1, RD2]
for c in BEFORE_CUT: fresh stills of Reel3D at frames c and c+1; same asserts                            [RD2]
from the diagnostics stills and the reel render log: at least one "MAP_DRAPE missing N" line, every N = 0   [RD6]
```

## 4. Clarity

### 4.1 `scripts/stills.mjs <dir>` [CL1, X3]
```
FRAMES ← {
  trawsfynydd: [60, 200, 300, 420],
  maentwrog:   [60, 150, 240, 330],
  every other section: [⌊frames/2⌋]
}
MASKS ← ground: trees, trees-sun, trail, roads, terrain, water, water-expected, buildings
        aerial: terrain, water, water-expected
bundle once into <dir>/.bundle; snapshot ← snapshot.mjs (taken as the bundle is made)
for (id, f) in FRAMES:
    still normal → <dir>/<id>_<f>.png
    for m in MASKS(id): still with props {mask: m, captions: none} → <dir>/<id>_<f>_<m>.png
    ground: <id>_<f>_clean.png (no captions), <id>_<f>_nowater.png (hide: water, no captions)
    trawsfynydd 60: also frame 61, normal (no captions) and its water mask         [WA7]
    # each still: --gl=angle --scale=1 --port=P
snapshot ← { tree: tree hash of (git stash create or HEAD), dirty, untracked: count,
             untrackedSha256 over untracked files outside .claude-flow/ .claude/ .agents/ .idea/ }
write <dir>/manifest.json { createdAt, environment {platform, arch, node, remotion, chrome, gl, scale},
                            snapshot, stills [{id, frame, mask, extra?, file, sha256}] }
```

### 4.2 Masks — `Section3D` prop `mask` [design D40]
Every material becomes unlit (`MeshBasicMaterial`). Fog, the hemisphere light, the sky and the
overlays are off. The masked class is white and everything else black, except:
- `trees-sun`: the trees in a white `MeshLambertMaterial` lit by the sun alone; pixels darker than
  luma 10 are the shade side.
- `water-expected`: the water mesh with `DoubleSide`.
- `landmarks`: every landmark white, drawn from its own arrays over the merged buildings.
- `hide: "water"` renders the frame normally without the water.

A static test: no `mask` in `Reel3D` or `Root.tsx`.

### 4.3 Metrics, `scripts/still_metrics.py`, given a normal still N, its clean copy C and masks M [WA6, WA7, CL2, CL3, CL4, CL6]
```
only files the manifests list are read; a region under 2,000 px gives null, never a pass
WA6:  E ← M[water-expected]; V ← M[water]; coverage ← |E ∩ V| / |E| ≥ 0.95
      and mean|C − C_noWater| inside E > 8 (C_noWater: hide water; missing → not a pass)
WA7:  W ← pixels of C inside V; w̄ ← median Lab of W; specks ← share of W with ΔE76(px, w̄) > 25 ≤ 0.01
      at every lake still and at Trawsfynydd frame 61 (the frame after 60)
      the masks cannot see terrain rising through the surface (it hides both): a geometric test
      checks the DEM inside each lake instead (tests/three-core/water-terrain.test.ts; t10)
CL2:  shade ← M[trees] ∧ luma(M[trees-sun]) < 10; median luma of N over shade: after / before ≥ 1.20
CL3:  |mean luma(after) − mean luma(before)| / before ≤ 0.10 and share(luma ≥ 250) ≤ 0.01
CL4:  band ← dilate(M[trail], 20 px) − M[trail]
      ΔE76(mean Lab(N ∩ trail), mean Lab(N ∩ band ∩ roads)) ≥ 20
      ΔE76(mean Lab(N ∩ trail), mean Lab(N ∩ band ∩ terrain)) ≥ 20
CL6:  over terrain pixels: circular mean hue and mean saturation, pooled over all ground stills and over
      all aerial stills; |aerial − ground| / ground ≤ 0.15 for both
```

### 4.4 Tuning loops (deterministic; every step recorded with its numbers) [CL2, CL3, CL6]
```
for fill in candidates (TREE_FILL, with the crowns darkened by 1.5 / (1.5 + fill) in linear light):
    render the masked and normal stills; keep the largest fill whose CL3 holds on every still (0.08 since t10)
grade the drape (gradeDrapePixels, DRAPE_GRADE): each pixel × brightness; w ← alpha · max(0, 1 − sat / neutral);
    blend towards the tint scaled to the pixel's own luma by w       # only near-neutral map paper changes
    search (tint, alpha, neutral, brightness) by render until CL6 holds and CL3 stays within 10 %
```

### 4.5 Rider visibility [CL5]
```
sightLines(cfg, scene):                      # computed before trees, since the camera doesn't depend on trees
    for every frame f of the section: lines += (cam(f), rider(f) + 1 m)
placeTrees(..., sightLines, footprints): skip a tree whose CROWN_SPHERES (which enclose CROWN_SHAPES, the
    drawn cone and icosahedron; t10) meet any line, or that stands in or over a building footprint
test: for every ground section and every frame of both shots, no drawn crown (exact cone, enclosing
    ellipsoid) meets the camera-to-rider segment
```

### 4.6 Captions [CL8, CL9, CL10, CL11, CL12]
```
REQUIRED ← { badge: verbatim, concept-card: verbatim, live-station: "still a live station",
             decommissioning: ["decommissioning site", "not part of the proposed trail"],
             heritage: ["heritage", "proposed", "rail-with-trail"], attribution: ["lidar", "OpenStreetMap", "OpenTopoMap", "not survey-grade"] }
for c in CAPTIONS:
    full ← (c.to − c.from) − 15 · (c.to ≥ total ? 1 : 2)
    need ← max(75, ⌈len(c.text) / 15 · 30⌉)
    if full < need: shorten c.text, keeping REQUIRED[c.id], or widen [from, to] inside its scene
    update the spec's RL17–RL21 ranges and EXPECT_OVERLAY in the same edit
tests:  full ≥ need [CL8]
        contrast(token text, token box) ≥ 4.5, from the WCAG relative luminance of the alpha-composited colours [CL11]
        CAPTION ≥ 28 px, BADGE ≥ 18 px, ATTRIBUTION ≥ 18 px [CL12]
render: OverlayLog → {id, x, y, w, h, right, bottom, lines}
        x ≥ 96, y ≥ 54, right ≤ 1824, bottom ≤ 1026 [CL9]
        lines = round(inner height / lineHeight) ≤ 3, a non-number fails; CSS hyphens: none [CL10]
        attribution and legend sit on backing boxes, so their contrast is a T check [CL11]
```

### 4.7 Positions and categories [CL7, CL14]
```
before the build: write tests/fixtures/feature-positions-before.json   # id → fromKm, toKm, source.ref (not a visual baseline)
test: every id in it still exists with the same values; new ids allowed (buildings)               [CL7]
bridges (the approximate structures drawn) → hatched material (world-space stripes); proposed trail unchanged;
sectionLegend(kind, bridges, translucent): "Hatched: approximate position or form" in ground scenes only,
    "Translucent: approved or demolished, not standing" when a section draws one; curated text      [CL7, BL14]
static: no TextureLoader, useTexture, .hdr or new files under public/3d                             [CL14]
```

### 4.8 Route locator (only if the independent review asks) [CL13]
```
box ≤ 6 % of the frame, inside SAFE, away from every caption rect; marker at routeKmAt(frame), within 50 m (test)
```

## 5. Buildings

### 5.1 `visibleFootprints(poses, footprints, heightAt, { far: 600 })` and `building-candidates.ts` [BL1]
```
poses ← the section's camera at every 10th frame (all shots)
footprints ← building polygons wholly on the terrain window (t10), each at its measured height from
             data/building-heights-<w>.json, else at a 60 m upper bound (t7)
for pose: frustum ← (fov 45°, aspect 16:9, far 6 km)
    for fp: p ← (centroid.x, heightAt(centroid) + heightM / 20, centroid.z)   # mid-height, world units
        if p not in frustum: continue
        march the ray cam → p in 10 m steps; terrain above it at any step → hidden
        visible += fp.id                                                    # one list over every pose
write data/building-candidates-<w>.json { section, footprints, posesSampled, farM, upperBoundM, unmeasured,
                                          candidates [{id, lon, lat, areaM2, testedAtM}] }
two passes: candidates → build_buildings.py (measures) → candidates → build_buildings.py; a third pass changes nothing
```

### 5.2 Landmark research — a procedure, recorded in `data/landmarks.json` [BL2, BL3, BL4, BL18]
```
candidates ← visible footprints whose (tag-refetched) building type is landmark-like
             (church, chapel, station, power station, …) or that are large (area ≥ 400 m²)
for each candidate:                       # recorded in data/landmarks.json; `featured: false` keeps the sources and
                                          # roof but draws a background building (Capel Utica, 28–31 px in shot)
    an entry needs id, osm, status, observedAt, confidence, licence, https sources with a kind, a model and
    `screened`; build_buildings.py stops on an incomplete one (t9)
    sources ← OSM way (version timestamp), Coflein/Cadw record URL, dated imagery, dated photos (with licences)
    every fetched text → aidefence_scan; record the verdict; reject unsafe text            [BL18]
    status ← existing or construction only if a dated observation shows it;
             approved if the only evidence is a planning record; demolished if a dated source says so   [BL3]
    observedAt ← the latest dated observation; retrievedAt ← today
    confidence ← high if ≥ 2 independent dated sources within 3 years
                 medium if one, or the newest is over 3 years old                         [BL4]
                 low otherwise (low → no landmark model; a background block only)
```

### 5.3 `build_buildings.py --section <w>` — network: OSM API and lidar DSM [BL2, BL5, BL6, BL15, BL17]
```
fps ← building polygons in sections/<w>/osm.geojson ∩ candidates
elements ← GET /api/0.6/ways?ways= and /relations?relations= (batches of 100): tags, timestamp, visible
    keep only building, building:levels, height, roof:shape                                    [BL17]
    drop deleted (visible = false) elements; an element with no timestamp stops the build (t10)
dsm, dtm ← Cog(DSM_URL), Cog(DTM_URL) at level 1 (2 m) over the footprints' box + 10 m
for fp:
    cells ← 2 m cells inside the outer ring
    h ← p90(dsm − dtm over cells)
    if |cells| ≥ 4 and 2 ≤ h ≤ 60: height ← h, heightSource ← lidar-dsm
    else: height ← levels·3 if 0 < levels ≤ 30 and finite, else 6; heightSource ← levels | default   [BL6; t9]
    roof ← the curated model's roof, else roof:shape, else gabled if ≤ 6 vertices and a house-like type, else flat
           (the core draws a gable only on a true rectangle, 5.4)
    category ← verified for a curated entry with a lidar height, else approximate
    entry ← { id: building-<w>-<osmid>, kind: building, category, status: existing,
              source: { type: osm, ref: way/<id> }, scenes: [Reel3D, Section-<w>],
              provenance: { urls: [osm URL, DSM COG URL, curated source URLs], evidence: [map, lidar, …],
                            observedAt: the OSM version timestamp's date (or the curated observedAt), retrievedAt: today,
                            licence: "ODbL (footprint); OGL (lidar height)"[; curated licence],
                            confidence: high if a lidar height and not over 3 calendar years old, else medium } }   [BL2, BL15]
write sections/<w>/buildings.json (JSON without NaN); replace the window's building entries in data/features-<w>.json;
merge every measured height into data/building-heights-<w>.json
```

### 5.4 `buildings.ts` (pure core) [BL5, BL7, BL8, BL9, BL10, BL14, BL16]
```
buildingBase(ring, heightAt) = min(heightAt at the centroid and every 0.2 units along each wall)   # rendered ground [BL5; t10]
sectionBuildings(list, status, project, heightAt, ve):
    keep ids the register lists, with the register's status; project; drop a closing duplicate;
    drop footprints not wholly on the terrain (t10); place landmarks; buildingArrays          [BL3, BL5, BL16]
buildingArrays(records, heightAt, ve, landmarks):
    for r: ring ← anticlockwise; top ← the recorded height (the ridge for a gabled roof; t7)
        eaves ← max(base + h − rise, highest ground + 2 m); rise only for a gabled roof
        walls: for each edge (a, b): quad (a@base, b@base, b@eaves, a@eaves) with an outward normal
        roof: gabled only on a true rectangle (collinear nodes dropped, four square corners, equal opposite sides;
              t10) → ridge along the long side; else flat → earClip(ring) at the eaves
    landmark parts go into the same groups; approved/demolished go into a separate translucent group  [BL9, BL10, BL14]
landmarkParts(model): church → nave box (OBB), pitched roof, tower box and pyramidal cap at the recorded end;
                      station → box and pitched roof. Dimensions from model.*                           [BL9]
footprintOverlap(a, b) = |raster₀.₅m(a) ∩ raster₀.₅m(b)| / min(|a|, |b|)                               [BL8]
segmentsInFootprints(lines, fps) → pairs where an endpoint is inside, or an edge crosses               [BL7]
validate: every rendered id ∈ register with source.type ∈ {osm, coflein, lidar-dtm}                     [BL16]
```

### 5.5 Rendering and loading [BL10, BL11, BL12, BL13, BL14]
```
BuildingsView: merged existing mesh (1 shared MeshStandardMaterial, vertexColors: stone walls, slate roofs),
             landmarks included, + the translucent group (opacity 0.45, no edges)          [BL10, BL14]
Scene3DData.buildings ← load sections/<id>/buildings.json through the gate; dataPaths(id) lists only its own   [BL11]
render checks: RL24 per scene and before each cut with buildings on                                           [BL12]
for each shot that names a landmark: frames where the landmark mask's bbox height ≥ 40 px must be ≥ 60 (2 s);
    CL5 still holds. Not built yet: no section lists a landmark, so the render check asserts none is
    listed and fails as soon as one is                                                                       [BL13]
```

### 5.6 Register validation (`registers.ts`) [BL2, BL3, BL4, BL16]
```
if kind == building:
    require status ∈ {existing, construction, approved, demolished}
    require source.type ∈ {osm, coflein, lidar-dtm}
    require provenance.urls ≠ [], evidence ≠ [], observedAt and retrievedAt calendar dates with
        observedAt ≤ retrievedAt, licence, confidence
    status ∈ {existing, construction} and no dated observation in evidence → reject           [BL3]
    retrievedAt after observedAt's third anniversary and confidence == high → reject          [BL4; t10]
KINDS += building
```

## 6. Across all four [X1–X5]
```
X1  render checks: RG1 and the full CyclingVision render decodes to md5 adfca9a7…
X2  render checks: git diff --quiet HEAD -- tests/baselines and no untracked file there; a static test: git diff --quiet; exit ≠ 0 → fail
X3  every evidence line carries the snapshot id (4.1); no git commit, stash drop or reset anywhere in scripts
X4  the V rows go to an independent reviewer, recorded in docs/validation-3d.md
X5  lint, test, build, the clean-room CI run and test:render, all on one snapshot id
```

## 7. Traceability

**Water**

| ID | Logic | Check |
|---|---|---|
| WA1 | 2.2, 2.3 | T: `water-geometry.test.ts`, square lake with clockwise and anticlockwise rings; real windows |
| WA2 | 2.2 | T: island lake, no centroid in the hole, area within 1 % |
| WA3 | 1.1, 1.5, 2.1 | T: `water.test.ts` and the Python self-test |
| WA4 | 1.4, 1.5 | T: the self-test; on real data, the 15 islands of 3084421 above the lake level |
| WA5 | 1.2, 1.3, 2.1 | T: `water-levels.json` is used by both windows, levels within 0.1 m |
| WA6 | 2.3, 4.3 | R: coverage ≥ 0.95, and the normal still differs from the no-water still |
| WA7 | 2.3, 4.3 | R: specks ≤ 1 % at two frames; V: shorelines |

**Readiness**

| ID | Logic | Check |
|---|---|---|
| RD1 | 3.4 | R: fresh stills at the first and middle frames |
| RD2 | 3.4 | R: last frames and cuts |
| RD3 | 3.1 | T: `load-gate.test.ts`, input change |
| RD4 | 3.1 | T: stale and unmounted settles |
| RD5 | 3.2 | T: error messages |
| RD6 | 3.4 | R: `MAP_DRAPE missing` = 0 |
| RD7 | 3.3 | D: `validation-3d.md` |

**Clarity**

| ID | Logic | Check |
|---|---|---|
| CL1 | 4.1 | D, R: manifest |
| CL2 | 4.2–4.4 | R: shade luma ratio ≥ 1.2; V |
| CL3 | 4.3 | R |
| CL4 | 4.3 | R: ΔE ≥ 20; V |
| CL5 | 4.5 | T: `occlusion.test.ts` |
| CL6 | 4.3, 4.4 | S: one `LIGHTING` source; R; V |
| CL7 | 4.7 | T: positions fixture; V |
| CL8 | 4.6 | T: `reel-captions.test.ts`; V |
| CL9 | 4.6 | R: overlay rects |
| CL10 | 4.6 | R: line counts |
| CL11 | 4.6 | T: token contrast for caption, badge, attribution and legend boxes over black and white |
| CL12 | 4.6 | S: token sizes |
| CL13 | 4.8 | T, R (only if built) |
| CL14 | 4.7 | S, V |

**Buildings**

| ID | Logic | Check |
|---|---|---|
| BL1 | 5.1 | T: `visibility.test.ts`; D: candidates file |
| BL2 | 5.2, 5.3, 5.6 | T: `registers-buildings.test.ts` |
| BL3 | 5.2, 5.6 | T |
| BL4 | 5.2, 5.6 | T, D |
| BL5 | 5.3, 5.4 | T: `buildings.test.ts` |
| BL6 | 5.3 | T |
| BL7 | 5.4 | T |
| BL8 | 5.4 | T |
| BL9 | 5.4 | T; V |
| BL10 | 5.4, 5.5 | T, R: draw calls |
| BL11 | 5.5 | T |
| BL12 | 5.5 | R |
| BL13 | 5.5 | R; V |
| BL14 | 5.4, 5.5 | T; V |
| BL15 | 5.3 | T: licence fields and the attribution text |
| BL16 | 5.4, 5.6 | T |
| BL17 | 5.3 | T: tag allowlist |
| BL18 | 5.2 | D: scan verdicts recorded |

**Across all four**

| ID | Logic | Check |
|---|---|---|
| X1 | 6 | R |
| X2 | 6 | S |
| X3 | 4.1, 6 | D |
| X4 | 6 | D, V |
| X5 | 6 | R |
