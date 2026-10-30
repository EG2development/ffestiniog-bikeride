# Design: the photoreal layer (ADRs 54–58)

Status: written 2026-10-29 with the build. The research and the comparison of approaches are in
`docs/research-photoreal.md`; what must be true is spec RN1–RN6, CA1–CA5 (CA3 as amended by ADR 56), H1–H4, L1–L2
and the budgets of RL24. `docs/design-3d.md` stays the binding record of the core; its pure-core block carries the
new exports (kept equal to the code by `tests/docs.test.ts`).

## Shape

```text
data pipeline (per ground window, on demand; two allowlisted hosts)         runtime (one Remotion render)
──────────────────────────────────────────────────────────────────         ──────────────────────────────────────────
scripts/build_canopy.py --section <id>  ─ lidar DSM − DTM ─► canopy.json/.f32   Section3D({ section, look: "photo" })
scripts/fetch_barriers.py --section <id> ─ OSM barrier ways ─► barriers.geojson    Scene3DDataProvider (wants from cfg.photo)
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

## Modules and interfaces (views and providers; the pure-core signatures are in `docs/design-3d.md`)

| File | Kind | Interface |
|---|---|---|
| `src/three/photo/assetRoles.ts` | data + stand-ins | `TextureRole`, `RoleFiles`, `TEXTURE_ROLES` (empty until files are registered), `SKY_IMAGE` (null = procedural dome), `standInTextures(role)`, `TEXTURE_ROLE_NAMES` |
| `src/data/PhotoAssetsProvider.tsx` | provider (load gate) | `PhotoAssetsProvider({ section })`, `usePhotoAssets(): { textures: PhotoTextures; sky: Texture \| null }`; the only file with a texture loader; errors name section and path (RD5) |
| `src/three/photo/TerrainPhotoView.tsx` | view | `TerrainPhotoView({ mesh, land, textures, detailFadeM? })`; `splatWeights(land)` one-hot per node; `MeshStandardMaterial` with `onBeforeCompile`: four planar-mapped sets blended by weight and slope, two tile scales, vertex-colour tint, fade to the vertex colour beyond 600 m |
| `src/three/photo/TrailPhotoView.tsx` | view | `TrailPhotoView({ ribbon, gravel, widthM })`: the ribbon's UVs (u across, v in 3 m units) rescaled to the gravel tile, under `TRAIL_COLOUR` |
| `src/three/photo/BridgePhotoView.tsx` | view | `BridgePhotoView({ mesh, stone })`: planar UVs from position; no hatch; the legend line `PHOTO_LEGEND.bridge` |
| `src/three/photo/TreesPhotoView.tsx` | view | `TreesPhotoView({ trees })`: per kind and variant one trunk, one card and (conifers) one disc instanced mesh; canvas sprites from `mulberry32`; card normals from the crown centre; `userData.noAO` |
| `src/three/photo/GrassView.tsx` | view | `GrassView({ clumps, mask? })`: one instanced mesh, three bent blades per clump, instance colour = tint, no shadow casting |
| `src/three/photo/BarriersView.tsx` | view | `BarriersView({ meshes, mask?, textures? })`: one mesh per kind, stone, leaf and timber roles or flat colours |
| `src/three/photo/PhotoSky.tsx` | view | `PhotoSky({ atmosphere, centre, sunDirection, image })`: gradient dome with a fixed cloud layer and sun glow, fog colour = horizon (RL11), PMREM environment from the dome or the image, `scene.environmentIntensity = SKY_PHOTO.environmentIntensity` |
| `src/three/photo/PostFX.tsx` | view (render) | `PostFX({ width, height, ve, diagnostics? })`; `SceneAwareGTAOPass` |
| `src/three/Lighting.tsx` | view (changed) | `variant?: "concept" \| "photo"` picks `LIGHTING` or `LIGHTING_PHOTO`; `shadow?: ShadowSetup` ({ rangeM, normalBias, bias }; the reel's 300 m, 0.02, −0.0002 when absent) sets the shadow camera's extent and biases, and the projection is rebuilt when the extent changes; `Section3D` passes `SHADOW_PHOTO_CLOSE` in the photo look's rider's view and follow shot |
| `src/three/WalkersView.tsx` | view (both looks) | `WalkersView({ tracks, frame, mask? })`: per walker two instanced meshes (unit cylinders for the limbs, unit spheres for the joints, head and hair) whose matrices and colours are rebuilt from `walkerParts` each frame as declarative attributes; black under a mask |
| `src/scenes3d/Section3D.tsx` | composition (changed) | `look`, `captions: "photo"`, `configById`, `wants` from `cfg.photo`, `shotKindAt` hides the rider and moves the near plane in; the photo legend adds `PHOTO_LEGEND.people` and `.corridor` on ground frames and `photoEarthworksLine` for the registered earthworks a drone shot flies over (`earthworksInRange`); `WalkersView` for `scene.walkers` |
| `src/scenes3d/PocMaentwrogPhoto.tsx` | composition (new) | `Poc3DMaentwrogPhoto`, `FEATURE_IDS` (adds `trees-canopy-maentwrog`, `grass-maentwrog`, `walkers-maentwrog`) |

## Data files

- `public/data/sections/<w>/canopy.json` + `canopy.f32` (ADR 57): the DEM grid's header fields, `file`, `units`,
  `urls`, `licence`, `surveyDate`, `stats`.
- `public/data/sections/<w>/barriers.geojson` (ADR 58): LineStrings with `barrier`, `wall`, `height`, `natural`,
  `leaf_type`; `data/features-<w>.json` gains `barrier` entries (`barrier-<w>-<osm id>`).
- `data/features-3d.json` gains `trees-canopy-maentwrog` (approximate, lidar-derived), `grass-maentwrog` (decorative) and
  `walkers-maentwrog` (decorative, kind `walker`, with a note that the use is conceptual).
- `data/assets-3d.json`: one entry per file under `public/3d/` (none yet; the stand-ins are code).

## Checks

| Spec | Where |
|---|---|
| RN1 (amended), CL14 (amended), RN4, ADR 53 | `tests/static-3d.test.ts` |
| CA1–CA4 for the rider's view; the prototype config | `tests/three-core/first-person.test.ts` |
| ADR 57 | `tests/three-core/trees-canopy.test.ts`; `python3 scripts/build_canopy.py --self-test` |
| ADR 58 | `tests/three-core/barriers.test.ts`; `python3 scripts/fetch_barriers.py --self-test` |
| Grass | `tests/three-core/grass.test.ts` |
| C9, ADR 59 (walkers; the prototype's choreography on the real trail) | `tests/three-core/walkers.test.ts` |
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
| K19 | The stand-in textures are not the Vale's surfaces. | Replace by role with registered CC0 files (`docs/research-photoreal.md`); nothing else changes. |
| K20 | Adding `photo` to a reel section moves its trees (ADR 57) and breaks its before stills. | Opt-in per config; capture new before stills first (ADR 45). |
