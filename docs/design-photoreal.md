# Design: the photoreal layer (ADRs 54–61)

Status: written 2026-10-29 with the build; since ADR 60 (2026-10-30) the reel itself is drawn in this look, its aerial
scenes coloured by a Sentinel-2 image. The research and the comparison of approaches are in
`docs/research-photoreal.md`; what must be true is spec RN1–RN6, CA1–CA5 (CA3 as amended by ADR 56), H1–H4, L1–L2
and the budgets of RL24. `docs/design-3d.md` stays the binding record of the core; its pure-core block carries the
new exports (kept equal to the code by `tests/docs.test.ts`).

## Shape

```text
data pipeline (per ground window, on demand; two allowlisted hosts)         runtime (one Remotion render)
──────────────────────────────────────────────────────────────────         ──────────────────────────────────────────
scripts/build_canopy.py --section <id>  ─ lidar DSM − DTM ─► canopy.json/.f32   Section3D({ section, look: "photo" })
scripts/fetch_barriers.py --section <id> ─ OSM barrier ways ─► barriers.geojson    Scene3DDataProvider (wants from cfg.photo, photo look only)
scripts/build_imagery.py --section corridor ─ Sentinel-2 TCI ─► imagery.json/.u8
                                                              + register entries   PhotoAssetsProvider (roles → textures | stand-ins)
src/three/photo/assetRoles.ts ─ role → public/3d file (registered in assets-3d.json)  ▼ props only (ADR 4)
                                                                                 buildSectionScene(cfg, inputs + canopy + barriers)
                                                                                   trees scaled by canopy · barrier meshes · grass clumps
                                                                                   ▼
                                                                                 <ThreeCanvas> PhotoSky (env map) · Lighting(photo)
                                                                                   TerrainPhotoView · TrailPhotoView · BridgePhotoView
                                                                                   RoadView · WaterView · BuildingsView · BarriersView
                                                                                   GrassView · TreesPhotoView · CyclistView (not in
                                                                                   first-person frames) · CameraRig · PostFX (AO, grade, AgX)
```

## Decisions

| # | Decision | ADR |
|---|---|---|
| D49 | **A look, not a scene.** `look: "concept" \| "photo"` on `Section3D`; one `SectionScene`, two view sets; the prototype is `PROTOTYPES["maentwrog-photo"]` outside the reel; textures only from registered files, with procedural stand-ins per role. | 54 |
| D50 | **One render-priority subscriber.** `PostFX` owns the frame's render under the never loop: half-float 4-sample target, GTAO (skipping `userData.noAO` cards), grade, `OutputPass` with AgX. Stats logged once per frame over all passes. | 55 |
| D51 | **The rider's view is a shot.** `firstPersonShot`: 1.2 m over the surface, 0.4 m ahead, 15 m look-ahead, cadence bob; CA3 amended (1 m, no rider distance); the rider is not drawn in its frames. | 56 |
| D52 | **Canopy from the lidar.** `TreeOptions.canopy`: woodland draws unchanged, nodes under 3 m skipped, scale from the measured height, field trees at peaks ≥ 6 m outside woodland from a node-keyed stream; tint and variant from a third stream. Opt-in per config. | 57 |
| D53 | **Boundaries from OSM barrier ways** in their own file and register kind; lofted boxes with a 3 m gap at the trail; keep-out for trees. Opt-in per config. | 58 |
| D54 | **Walkers choreographed by the section** (`photo.walkers`): the rider's motion model at a walking pace (spec C9), a sixteen-part figure from a height, colours by seed, register kind `walker` (decorative, conceptual). The prototype's three are overtaken and met in the rider's view. | 59 |
| D56 | **Trail users at random.** Walkers, runners (7.5–12 km/h, a flight phase) and people pushing prams (3–5 km/h, a pram of a pram's size), placed per reel section by a seeded draw (`photo.people`) that keeps every candidate inside the section, clear of the rider, the camera and the others, and on screen within 40 m; a runner and a pram in every scene. | 61 |
| D55 | **The reel in the photo look.** The look owns the extras (`buildSectionScene(cfg, inputs, look)`), so every reel config carries them and the concept look is unchanged; `REEL_LOOK = "photo"`. Ground scenes take the prototype's extras and choreographed walkers; aerial scenes drop the map drape for the photo views over the corridor's OSM cover, its lidar canopy (three crowns a node wherever it stands) and a Sentinel-2 image as ground colour, graded to the ground palette (CL6). Photo materials for water, roads, buildings and hedges. The budget is the scene pass's. | 60 |

## Modules and interfaces (views and providers; the pure-core signatures are in `docs/design-3d.md`)

| File | Kind | Interface |
|---|---|---|
| `src/three/photo/assetRoles.ts` | data + stand-ins | `TextureRole`, `RoleFiles`, `TEXTURE_ROLES` (the eight roles' registered files under `public/3d/textures/`), `SKY_IMAGE` (null = procedural dome), `standInTextures(role)` for a role whose file is missing, `TEXTURE_ROLE_NAMES` |
| `src/data/PhotoAssetsProvider.tsx` | provider (load gate) | `PhotoAssetsProvider({ section })`, `usePhotoAssets(): { textures: PhotoTextures; sky: Texture \| null }`; the only file with a texture loader; errors name section and path (RD5) |
| `src/three/photo/TerrainPhotoView.tsx` | view | `TerrainPhotoView({ mesh, land, textures, detailFadeM?, tileScale?, image?, detailStrength? })`; `splatWeights(land)` one-hot per node; `MeshStandardMaterial` with `onBeforeCompile`: four planar-mapped sets blended by weight and slope, two tile scales, vertex-colour tint, fade to the vertex colour beyond 600 m; with an `image` (ADR 60, define `GROUND_IMAGE`) the photograph is the colour, mapped by node index, and the textures vary only its brightness around their own mean (their last mip level); the mesh is cut into 500 m tiles after its normals are computed, so three culls the tiles out of view (byte-identical frames, ADR 60) |
| `src/three/photo/TrailPhotoView.tsx` | view | `TrailPhotoView({ ribbon, gravel, widthM })`: the ribbon's UVs (u across, v in 3 m units) rescaled to the gravel tile, under `TRAIL_COLOUR` |
| `src/three/photo/BridgePhotoView.tsx` | view | `BridgePhotoView({ mesh, stone })`: planar UVs from position; no hatch; the legend line `PHOTO_LEGEND.bridge` |
| `src/three/photo/TreesPhotoView.tsx` | view | `TreesPhotoView({ trees, shadowless?, trunks? })`: per kind and variant one trunk, one card and (conifers) one disc instanced mesh; canvas sprites from `mulberry32`; card normals from the crown centre; `userData.noAO`; `shadowless` trees draw without casting and the aerial scenes draw no trunks (ADR 60). `Section3D` passes `treesInShots`' lists: only trees some frame sees or some frame's shadow map reaches |
| `src/three/photo/GrassView.tsx` | view | `GrassView({ clumps, mask? })`: one instanced mesh, three bent blades per clump, instance colour = tint, no shadow casting |
| `src/three/photo/BarriersView.tsx` | view | `BarriersView({ meshes, mask?, textures? })`: one mesh per kind, stone, leaf and timber roles or flat colours |
| `src/three/photo/PhotoSky.tsx` | view | `PhotoSky({ atmosphere, centre, sunDirection, image })`: gradient dome with a fixed cloud layer and sun glow, fog colour = horizon (RL11), PMREM environment from the dome or the image, `scene.environmentIntensity = SKY_PHOTO.environmentIntensity` |
| `src/three/photo/PostFX.tsx` | view (render) | `PostFX({ width, height, ve, diagnostics? })`; `SceneAwareGTAOPass`; a counting scene pass, so `THREE_STATS` carries `scenePass: { calls, triangles }` beside the whole frame (ADR 60) |
| `src/three/RoadView.tsx`, `WaterView.tsx`, `BuildingsView.tsx` | views (changed, ADR 60) | `tarmac?` maps the registered tarmac texture on the ground plane; `photo?` makes the water a dark near-mirror of the sky's environment; `stone?` puts the stone texture's relief on each face's plane under the wall and roof colours |
| `src/three/Lighting.tsx` | view (changed) | `variant?: "concept" \| "photo"` picks `LIGHTING` or `LIGHTING_PHOTO`; `shadow?: ShadowSetup` ({ rangeM, normalBias, bias }; the reel's 300 m, 0.02, −0.0002 when absent) sets the shadow camera's extent and biases, and the projection is rebuilt when the extent changes; `Section3D` passes `SHADOW_PHOTO_CLOSE` in the photo look's rider's view and follow shot |
| `src/three/WalkersView.tsx` | view (both looks) | `WalkersView({ tracks, frame, mask? })`: per walker two instanced meshes (unit cylinders for the limbs, unit spheres for the joints, head and hair) whose matrices and colours are rebuilt from `walkerParts` (by the spec's activity) each frame as declarative attributes, and for a pram a box mesh (body, blanket) and a torus mesh (tyres; ADR 61); black under a mask |
| `src/scenes3d/Section3D.tsx` | composition (changed) | `look`, `captions: "photo"`, `configById`, `wants` from `cfg.photo` in the photo look, `shotKindAt` hides the rider and moves the near plane in; the photo legend adds `PHOTO_LEGEND.ground` (people illustrative, verges levelled and cleared: one line, CL10) on ground frames and `photoEarthworksLine` for the registered earthworks a drone shot flies over (`earthworksInRange`); `WalkersView` for `scene.walkers`; in the photo look an aerial scene goes through the photo views too (`AERIAL_TERRAIN`: 1.5 km fade, 4× tiles, detail 0.75; `SHADOW_PHOTO_AERIAL`), and a section's captions take `reelCaptions(look)` |
| `src/scenes3d/Reel3D.tsx` | composition (changed, ADR 60) | `look` (default `REEL_LOOK`) passed to every scene; captions from `reelCaptions(look)`, whose photo attribution credits the Copernicus image instead of the map tiles |
| `src/scenes3d/PocMaentwrogPhoto.tsx` | composition (new) | `Poc3DMaentwrogPhoto`, `FEATURE_IDS` (adds `trees-canopy-maentwrog`, `grass-maentwrog`, `walkers-maentwrog`) |

## Data files

- `public/data/sections/<w>/canopy.json` + `canopy.f32` (ADR 57): the DEM grid's header fields, `file`, `units`,
  `urls`, `licence`, `surveyDate`, `stats`.
- `public/data/sections/<w>/barriers.geojson` (ADR 58): LineStrings with `barrier`, `wall`, `height`, `natural`,
  `leaf_type`; `data/features-<w>.json` gains `barrier` entries (`barrier-<w>-<osm id>`).
- `data/features-3d.json` gains `trees-canopy-maentwrog` (approximate, lidar-derived), `grass-maentwrog` (decorative) and
  `walkers-maentwrog` (decorative, kind `walker`, with a note that the use is conceptual).
- Since ADR 60 every reel window has `canopy.json`/`.f32` and `barriers.geojson`; the corridor window also has OSM
  land cover, roads and water (it had none under its drape) and `imagery.json` + `imagery.u8`: a Sentinel-2 true-colour
  scene on the window's own grid at `scale` pixels per node (8 m), north row first, with the scene id, date, cloud
  cover, URLs, licence and notice. `data/features-3d.json` gains `trees-canopy-<w>`, `grass-<w>` and `walkers-<w>` per
  ground window, `trees-canopy-corridor` and `imagery-corridor` (kind `imagery`, source `copernicus`).
- `data/assets-3d.json`: one entry per file under `public/3d/` (16 Poly Haven CC0 files: a diffuse and a normal map for
  each of eight roles, with sha256; `tests/static-3d.test.ts` ties the roles to the register).

## Checks

| Spec | Where |
|---|---|
| RN1 (amended), CL14 (amended), RN4, ADR 53 | `tests/static-3d.test.ts` |
| CA1–CA4 for the rider's view; the prototype config | `tests/three-core/first-person.test.ts` |
| ADR 57 | `tests/three-core/trees-canopy.test.ts`; `python3 scripts/build_canopy.py --self-test` |
| ADR 58 | `tests/three-core/barriers.test.ts`; `python3 scripts/fetch_barriers.py --self-test` |
| Grass | `tests/three-core/grass.test.ts` |
| C9, ADR 59 (walkers; the prototype's choreography on the real trail) | `tests/three-core/walkers.test.ts` |
| ADR 60 (the reel's look and attribution, every scene's extras, the concept look unchanged, the reel's walkers, the aerial image and trees); CL5 in both looks | `tests/three-core/reel-photo.test.ts`, `tests/three-core/occlusion.test.ts`, `tests/three-core/trees-canopy.test.ts`; `python3 scripts/build_imagery.py --self-test` |
| H1, H2b, CL8 for the prototype | `tests/three-core/poc-acceptance.test.ts` (FEATURE_IDS), `tests/reel-captions.test.ts` |
| RN2 (determinism), RN6 (budgets), timings, before/after stills, the walkers' addendum, the independent review | `docs/validation-photoreal.md`; `docs/evidence/photo/independent-review-2026-10-30.md` |

## Performance (measured on the development Mac, `--gl=angle`, 1920 × 1080)

| Frame | Concept look | Photo look (whole frame, both scene passes) |
|---|---|---|
| `Section-maentwrog` frames 60/150/240/330, draw calls | 65 | 180 |
| the same, triangles | 1,104,318 | 2,548,858 (the scene pass alone is about half: the AO pass re-renders it) |
| `Poc3DMaentwrogPhoto` frame 240 (rider's view), triangles | — | 2,541,478 at 76 calls |
| the same with the three walkers (ADR 59): frames 245 / 420 | — | 2,622,598 at 100 calls / 2,629,830 at 204 (two instanced meshes per walker; one mesh per part had cost 372 calls at the aerial frame, because the shadow pass and both AO passes draw every mesh) |
| after the review's fixes (trees to 5 m of the line): frames 245 / 420 | — | 2,638,402 at 100 calls / 2,645,634 at 204; the video 20.6 s wall (was 13.6 s) |
| one still through the Node API, warm bundle | 1.8 s | 2.1–3.3 s |

The RN6 ceiling (≤ 300 calls, ≤ 2 M triangles) was written for one scene pass; the photo look's scene pass is about
1.27 M triangles and 76–180 calls, inside it. The whole-frame figure is what `THREE_STATS` now reports for the photo
look, and is the honest cost. The video's per-frame time is in `docs/validation-photoreal.md`.

## Risks

| # | Risk | Handling |
|---|---|---|
| K17 | A tall non-tree outside a footprint (pylon, chimney) becomes a field tree. | Footprints exclude buildings; others are rare in this window; review the aerial still. |
| K18 | Alpha-cut sprites thin with distance (mipmapped alpha under the 0.5 test). | Acceptable at 1080p for this window; a distance-dependent alpha test is a view change. |
| K19 | The textures are photographs of similar surfaces, not the Vale's. | Replace a role's files in `data/assets-3d.json` and `assetRoles.ts` when a licensed local photograph exists; nothing else changes. |
| K20 | Adding `photo` to a reel section moves its trees (ADR 57) and breaks its before stills. | Resolved by ADR 60: the extras are built in the photo look only, so the concept look and its stills are unchanged (tested). |
| K21 | The aerial ground is a 10 m photograph: fields read as soft colour from 300 m. | Walls, roads and lidar trees give the edges; replace the image when a finer open orthophoto exists (one file and its register entry). |
| K22 | Canopy cover cannot tell a crown from a roof or a spoil heap without footprints. | Built-up, quarry and water nodes grow no aerial trees; review the Blaenau and Trawsfynydd aerial frames. |
