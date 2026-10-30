# Research: a lifelike look for the Reel3D cycling preview (2026-10-29)

Brief: a photoreal, immersive preview of the proposed Blaenau Ffestiniog ↔ Trawsfynydd trail, with geographic
accuracy first, then realism, immersion, performance and simplicity; research the current tools, compare approaches,
prototype 15–20 s on one section before any wider change, keep Remotion as the sequencing layer, and preserve the
2D video and the uncommitted work. Decisions taken from this research are ADRs 54–58; the design is
`docs/design-photoreal.md`; measurements and the reviews are in `docs/validation-photoreal.md`.

**V** = verified on the page or in the installed source named; **I** = inferred or estimated. Four research agents
gathered sources in parallel (three.js and Remotion; open geodata and licences; CC0 assets; alternative pipelines).
Their working notes were used during the build and their full reports arrived after it, on 2026-10-30; this document
folds them in, and every figure that decided something was re-checked against the named source or the installed code.

## 1. Current state: why the reel does not read as real

Inspected: `Section3D`, the nine section configs, the views, the data windows and the independent validation of
reel v2 (`docs/evidence/t14-reel-v2-independent-validation.md`). The validator's verdict was that Maentwrog and the
lake shore "convince" as a concept, the aerials read "as a magnified paper map", and nothing stands in the fields.

| What limits realism | Where it comes from |
|---|---|
| Flat, untextured ground: one colour per land-cover class with slope shading | ADRs 10, 31; spec CL14 forbade textures in iteration 2 |
| Trees are 7-sided cones and icosahedra in two flat greens, all the same height | ADRs 11, 37, 46 |
| A gradient sky with no cloud, and no sky light on surfaces: a hemisphere light stands in for the sky | ADRs 18, 30 |
| No ambient occlusion, no tone mapping (clipped highlights, grey shadows), no grade | no post pass; RN1 bans `useFrame` |
| The trail is one buff colour; the bridge is a hatched box; roads are flat grey | ADRs 12, 13; CL7 hatching |
| No walls, hedges or field boundaries, the Vale's signature | the pipeline's tag allowlist (ADR 38) keeps no barriers |
| No first-person view; the rider is a capsule model | ADRs 14, 16, 35 |
| Aerials drape OpenTopoMap tiles: a map, not a photograph | ADR 33; no open orthophoto. Since ADR 60 the concept look's only: the photo reel colours its aerials from a Sentinel-2 scene |

What is already right and must be kept: 1 m lidar terrain (ADR 6), the OSM alignment through one projection (ADR 5),
the lidar trail profile with bridge spans (ADRs 9, 23), sourced structures and buildings (ADRs 12, 49), deterministic
frame-based rendering under `@remotion/three` (ADRs 1, 17), the registers and the honesty captions (ADRs 20, 36, 38).

## 2. Technology research

### 2.1 three.js, React Three Fiber and Remotion (the stack in use)

- **Installed:** three 0.186.1 (r186), `@react-three/fiber` 9.8.2, `@remotion/three` 4.0.538, Remotion 4.0.538 (V,
  `node_modules`). r186 ships, in `examples/jsm`: `postprocessing/` (EffectComposer, RenderPass, GTAOPass, SSAOPass,
  SMAAPass, UnrealBloomPass, BokehPass, OutputPass, …), `csm/` (cascaded shadow maps), `objects/Sky.js`, `Water.js`,
  `Reflector.js`, `GaussianSplat.js`, loaders for glTF, HDR/EXR, KTX2, PLY/SPLAT/SPZ (V, directory listing). The
  WebGPU renderer and TSL are present (`three/webgpu`), and `@remotion/three` 4.0.538 ships a `webgpu` entry (V,
  `dist/esm/webgpu.mjs`), but the project's headless renders run Chrome with `--gl=angle` (ANGLE Metal, WebGL 2;
  ADR 19) and that is the path every determinism check and the 2D baseline rest on. WebGPU in headless Chrome under
  Remotion is untested here and not needed for any technique used (I).
- **How a frame is rendered (V, `@remotion/three/dist/esm/index.mjs`):** while rendering, `<ThreeCanvas>` sets
  `frameloop="never"` and a `ManualFrameRenderer` effect calls `advance(now)` once per Remotion frame. In R3F's loop
  (V, `events-*.esm.js`), a `useFrame` subscriber with a positive priority makes the loop skip its own `gl.render`.
  That is the documented way to run an `EffectComposer`, and under the never loop it is exactly one composer render per
  frame. ADR 55 allows it in one file.
- **Tone mapping:** r186's renderer offers ACESFilmic, AgX and Neutral tone mapping; `OutputPass` applies the
  renderer's setting and the sRGB conversion at the end of the composer chain (V, source). AgX keeps saturated greens
  from clipping, which matters for a wooded valley (I).
- **GTAO:** `GTAOPass` renders normals and depth with an override material (V, `_renderOverride`), so it cannot read
  a material's alpha test: alpha-cut sprites occlude as slabs unless hidden for that pass (found by render, fixed in
  `SceneAwareGTAOPass`). Its denoise noise comes from `new SimplexNoise()` seeded by `Math.random` (V, line 685 of
  the installed file), which breaks byte-identical renders (RN2) until seeded (fixed the same way).
- **Terrain detail:** planar-mapped texture sets blended per fragment by vertex weights and slope through
  `MeshStandardMaterial.onBeforeCompile`, so lights, shadows, fog and the environment map stay three's (I, standard
  technique; built and measured here). Note that in this build the vertex colour varying is a `vec4`.
- **Sky light:** a `PMREMGenerator` environment from the sky dome itself (or an equirectangular image) gives
  image-based lighting of the shade side of every surface; `scene.environmentIntensity` scales it (V, r186 API).
- **Vegetation:** instanced card trees with alpha-tested sprites and normals pointing out from the crown centre read as
  volumes; three's shadow map honours a material's `alphaTest` and `map`, so the cards cast cut-out shadows (V,
  `WebGLShadowMap`). Instanced grass clumps with per-instance colour are one draw call (threejsresources grass guide).
- **Versions (V, the three.js agent's report):** three 0.186.1 is the newest release (r186, 24 Sep 2026; r187 is a
  dev branch whose PMREM rework will change the look of environment maps); Remotion 4.0.539 is current, one patch
  ahead of the pin. Other determinism traps it verified in r186's source, all avoided here: `SSAOPass` builds its
  kernel with `Math.random`; `SMAAPass` loads its lookup textures asynchronously, so a first frame can render without
  them; N8AO shifts its blue noise by an internal frame counter; R3F's `delta` and `clock` are wall-clock under
  `<ThreeCanvas>` (`advance(performance.now())`), so nothing may read them. `SSAARenderPass` (fixed jitter) is the
  deterministic anti-aliasing option if the 4-sample target ever proves insufficient.
- **Not adopted:** `@react-three/drei` (ADR 22 excludes it; nothing needed it), `@react-three/postprocessing` and
  `n8ao` (extra dependencies for what the shipped addons do), the r186 `SunLight` addon (a renderer-integrated two-
  cascade shadow map; the 300 m follow frustum is enough for these shots, but it is the next step for the aerial
  scenes), the CSM addon (overwrites global shader chunks), `Water` with a reflection pass (no lake in the Maentwrog
  window; Trawsfynydd's is a later section, and the mirror pass doubles the frame's work), KTX2 compression (16 MB of
  JPG is fine for a prototype), a WebGPU path (headless WebGPU is documented for Linux only; the Mac headless shell
  falls back to WebGL 2). For 4K, Remotion's `--scale` sets the browser's device scale factor and
  `usePixelDensity()` exposes it; R3F's `dpr` would have to follow it (I, untested).

### 2.2 Open geodata for the corridor

| Dataset | Licence | Resolution | Access without GDAL | Verdict |
|---|---|---|---|---|
| Welsh Government / NRW lidar DTM and DSM, COGs on `dmwproductionblob` | **OGL v3, confirmed** (V): the DataMapWales LiDAR viewer page states "Open Government Licence" and lists this very COG as the published product; the tile catalogue WFS dates the corridor tiles (SH6742–SH7042) to flights on 2022-01-11, 1 m, by Bluesky for NRW. Closes design risk K2 and dates the DSM (K16) | 1 m, overviews to 64 m | HTTP range reads, in use (ADR 7) | Keep; the DSM minus DTM now gives canopy heights (ADR 57). Attribution: "Contains public sector information licensed under the Open Government Licence v3.0" |
| OpenStreetMap | ODbL | vector | `api.openstreetmap.org/api/0.6/map`, in use | Keep; now also `barrier=*` ways (ADR 58). Overpass counts for the corridor bbox (52.93–53.00 N, 3.98–3.92 W, 2026-10-29, V): 350 walls, 11 hedges, 57 fences, 9 tree rows, 38 quarries, 90 scree, 49 spoil heaps, 88 bare rock, 309 wood/forest polygons but only 7 with `leaf_type`, 107 railway ways of which 14 bridges, 5 cuttings, 1 embankment, 2 tunnels, 43 water |
| Welsh Government aerial photography (DataMapWales) | APGB Aerial Photography and Height Data Supply public-sector end-user licence: internal business use, third parties need a contractor licence (V) | 12.5–25 cm | — | Not usable for a public drape; the aerial scenes keep the map tiles |
| Sentinel-2 L2A true colour (Earth Search STAC) | Sentinel Data Legal Notice: free, full and open, including adaptation and distribution, with the notice "Contains modified Copernicus Sentinel data [year]" (V) | 10 m | STAC search plus HTTP range reads on the TCI COG, numpy + zlib as for the lidar (V: range requests answer 206); a cloud-free scene exists, S2C_30UVD_20250712 (12 Jul 2025, 0.06 % cloud) | Built (ADR 60, `scripts/build_imagery.py`): the photo reel's aerial ground colour, on the corridor's grid at 8 m, graded to the ground palette; soft from 300 m, so walls, roads and lidar trees carry the edges |
| ESA WorldCover 2021 | CC BY 4.0 with its stated credit (V) | 10 m | range reads on the N51W006 COG | Not built; a second land-cover source where OSM has no polygon (the 53 % "other" of the Maentwrog window) |
| NRW Phase 1 Habitat survey | OGL with the NRW and OS attribution line (V) | vector, fieldwork from 1979 | WFS GeoJSON | Not built; habitat classes (bracken, heath, bog) OSM lacks, but dated |
| Living Wales land cover; UKCEH Land Cover Map; CLC+ Backbone | no licence stated; non-commercial application only; excludes the UK (V) | 10 m | — | Not used |
| Google Photorealistic 3D Tiles | Map Tiles policies: no pre-fetch or storage, map visualisation only, video only as a ≤ 30 s promotional clip about the application (V, 2026-10-28) | drape in rural areas (I) | — | Not usable for this video |
| Cesium ion Community, Cesium World Terrain, Bing imagery | free non-commercial; no storing output; Bing being retired (V) | coarser than 1 m lidar | — | Adds nothing geographic; not used |
| Mapbox / MapTiler / Esri satellite | Mapbox §1.7 forbids video media beyond promotion; MapTiler §4.4 forbids pixel manipulation (a drape is one); Esri bars tile export (V) | 0.5–1 m | — | Not usable |
| Welsh Government *Active Travel Act Guidance* (2021) | Crown, OGL | — | PDF text (V) | Table 11.5: 3.0 m minimum for shared use routes up to 300 pedestrians and 300 cyclists per hour (4.5 m above); retained shared use path desirable 3.0 m, absolute 2.5 m; closes spec TR1. Gradients (§9.7.2, Table 9.7): desirable maximum 5 %, absolute 8 %, and a 4 % grade for at most 50 m, 3 % for 80 m, 2 % for 150 m: the measure for the open RL8 stretches. Surfacing (§15.1.16): machine-laid bituminous preferred, alternatives where heritage is sensitive |
| Cadw listed buildings (WFS) | OGL v3 with the credit "Designated Historic Asset GIS Data, The Welsh Historic Environment Service (Cadw), DATE" (V) | points | WFS GeoJSON | 164 records in the corridor, among them the Grade II railway bridge east of the A470 at Llan Ffestiniog (record 16835) and the former Diffwys station: landmark research for the BL rows, not used in this prototype |
| Coflein | site data OGL; images under the Non-commercial Government Licence (V) | records | web | Maentwrog Road signal box (NPRN 421805, 1882, preserved in private ownership), Lakeside Halt 41343, Trawsfynydd station 41341; facts only, no images |
| SI 2016/1003, Air Navigation (Restriction of Flying) (Nuclear Installations) | legislation.gov.uk (V) | — | — | Its schedule of 20 sites **omits Trawsfynydd** (the 2007 regulations had it), so there is no statutory no-fly circle today; the licensed-site perimeter and the operator's permission still apply |

### 2.3 Assets

- **Poly Haven** publishes every HDRI, texture and model under CC0, no credit required (V, polyhaven.com/license,
  2026-10-29). Download URLs are stable (`dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/<id>/<id>_<map>_1k.jpg`)
  and the eight 1K diffuse + normal sets used here total 16 MB (V, fetched and hashed by `scripts/fetch-assets.mjs`).
- **Poly Haven models are not instancing assets:** the 1K glTF of `pine_tree_01` is 17.2 M triangles and a 949 MB
  buffer, `fir_tree_01` 7.0 M, `tree_small_02` 2.1 M (V, the asset survey's glTF reads). At 5,000 trees per window
  they cannot be drawn; the card trees built here are about 40 triangles each.
- **HDRIs** on Poly Haven carry capture time and coordinates, from which the survey computed the sun's elevation:
  the British and Irish ones (`greenwich_park_03`, `dalkey_view`, `quadrangle_cloudy`) have the sun at 19–58°
  elevation but at azimuths that do not match ADR 18's 200°, and no overcast one has a sun at 35°. The prototype keeps
  a procedural dome with a fixed cloud layer and derives its environment map from it, so sun, sky and fog agree by
  construction; an image sky remains a supported option (`SKY_IMAGE`).
- **Alternatives the asset survey verified (V) and this prototype did not take:** `coast_sand_rocks_02` (tussock
  grass with rock) and `grass_path_2` for pasture, `castle_wall_slates` (coursed slaty blocks) for the bridge, `cliff_side`
  and `rock_ground_02` for slate faces and tips (the Blaenau window), `pine_bark` for conifer trunks; ambientCG
  `LeafSet026`, the only CC0 leaf atlas found; the HDRI `kloofendal_38d_partly_cloudy_puresky` (sun about 38° by its
  name) as the nearest match to ADR 18's 35° sun; `@dgreenheck/ez-tree` 1.1.0 (MIT, seeded, deterministic) as a
  procedural tree generator, whose bundled leaf images have no stated origin and would need replacing. No CC0 or CC BY
  rigged cyclist exists on Sketchfab, Poly Haven, Quaternius or Kenney, and Mixamo has no cycling clip, which confirms
  the procedural rider (ADRs 14, 34) as the only licence-clean option short of building a rig. (Update, 30 October: a
  CC BY 4.0 motion-capture dataset of cyclists pedalling exists, Zenodo 10668611, usable for leg timing under a rig;
  see `docs/research-blender.md` §4.)
- **AI-generated assets:** Hunyuan3D-2's licence excludes the United Kingdom (V, its LICENSE); TRELLIS.2 needs an
  NVIDIA GPU (V); Meshy's free tier outputs are CC BY 4.0 and Tripo's terms could not be fetched (V/I). None was used,
  and by the brief's rule none could be evidence of place. Text-to-image tools were not used for textures either: every
  texture is a photograph of a real surface under CC0.

### 2.4 Alternative pipelines (from the pipelines report, re-checked where it mattered)

- **Blender 5.2 LTS** (GPL, 330 MB, `blender -b … -P build.py`, Cycles on Metal, fixed seed with Animated Seed off):
  the realistic second pipeline. Estimated 30–90 s per 1080p frame with 128–256 samples and OpenImageDenoise, so
  5–15 h for 600 frames; EEVEE Next 2–6 s per frame at lower fidelity (I). Bit-exact repeats across runs are not
  guaranteed on Metal (V, blender issue 101726). Output as a PNG sequence into `public/` and `<Img src={staticFile()}>`
  in Remotion, with the camera path exported per frame from this project so the rider layer aligns (I; no official
  Blender → Remotion integration exists, V).
- **Unreal Engine 5.8 on macOS:** Nanite and virtual shadow maps are beta and hardware Lumen experimental on Apple
  silicon (V, Epic requirements page); Cesium for Unreal 2.31 supports it (V); Movie Render Queue has a CLI (V).
  30–60 GB install, GUI-centric, a beta renderer: not automatable by a coding agent at acceptable cost.
- **Cesium / 3D Tiles in three.js:** `3d-tiles-renderer` 0.5.3 works with three ≥ 0.167 (V), but the only
  photorealistic source, Google's tiles, is outside the licence for this video (above), and ion's terrain is coarser
  than the lidar already used.
- **Gaussian splatting / photogrammetry:** viewers exist (three r186 `GaussianSplat`, Spark 2.4, `gaussian-splats-3d`;
  V) and trainers run on Apple silicon (Brush 0.3, Apache-2.0; V). The blocker is capture: the corridor is Network
  Rail land (only its authorised pilots and approved contractors may fly near the railway, V), Eryri land needs the
  landowner's consent and the valley's SSSIs and NNRs carry byelaws (V), and the CAA code keeps camera drones 150 m
  from residential and industrial areas (V); Trawsfynydd itself is no longer in the statutory nuclear no-fly schedule,
  but the licensed site's perimeter and the operator's permission still apply (V). Geograph and Wikimedia photographs
  are sparse and non-overlapping (I). Ground capture from public rights of way for a 2 km stretch is about a week of
  work and only looks right within 20 m of the camera path (I). Not for this iteration; a lawful "stand here" vignette
  later.
- **AI video** (Veo 3.1, Runway, Kling): mood references only; generated landscapes are not evidence of place (brief).

## 3. Comparison

| Approach | Realism (1–5) | Geographic accuracy | Remotion compatibility | Cost | Complexity | Agent-automatable |
|---|---|---|---|---|---|---|
| **Enhanced three.js (built here)** | 3–4 | 5: same lidar, OSM, registers | 5: same pipeline, deterministic | £0; 16 MB CC0 textures | 2–3 | 5 |
| Blender-assisted three.js (Blender backgrounds, three.js rider) | 4–5 | 5 if fed the same data | 4: PNG sequences | £0–100; 5–15 h render per shot | 3 | 4 |
| Cesium / 3D Tiles environment | 3 | 3: coarser than the lidar | 4 | £0–50/month | 3 | 4; **Google terms forbid the use** |
| Unreal Engine cinematic | 5 | 4 (manual georeferencing) | 4 | £0; 30–60 GB; weeks | 5 | 1–2 |
| Photogrammetry / Gaussian splatting | 5 near the path | 5 where captured | 3 | £0 software; a week's lawful capture; drone refused | 4 | 3 |

**Recommendation: the simplest viable path is the enhanced three.js layer, and it was built.** It keeps every
accuracy guarantee and test, costs nothing, renders 600 frames in 16.5 s, and is entirely configured, generated and
validated by a coding agent. Blender is the one alternative worth a later experiment, for background plates of the
aerial scenes, where the map drape is weakest; it needs separate software and hours of render time per shot.

**What a coding agent can do here:** everything in §4 (scripts, shaders, views, tests, renders, measurements). What it
cannot: confirm the lidar licence wording with the data owner, choose species for the plantations (no `leaf_type` in
OSM here, the DSM gives height not species), source field photographs of the exact stretch, or operate Unreal.

## 4. Recommended architecture (as built; ADR 54)

One scene, two looks. `Section3D({ look: "photo" })` builds the identical `SectionScene` and swaps views:

1. **Ground:** `TerrainPhotoView`, four CC0 photographic sets (upland grass with rock, leaf-littered brown ground,
   forest floor, lichened rock) blended by OSM land cover per vertex and by slope, two tile scales, tinted by the
   land-cover colour's hue, fading to the vertex colour beyond 600 m.
2. **Trail and structures:** gravel under a pale buff on the ribbon's own UVs; mossy stone on the bridge along its
   deck and round its profile; the legend says "OSM position, generic form".
3. **Vegetation from data:** tree positions inside OSM woodland and heights from the lidar canopy (DSM − DTM), field
   trees at canopy peaks outside woodland (ADR 57); card trees with volume normals, three variants per kind; grass
   clumps on grass-like cover within 50 m of the trail, sparser and darker under the trees.
4. **Field boundaries:** OSM walls, hedges and fences as stone or timber boxes on the ground, open at the trail
   (ADR 58).
5. **Light:** a cloud-layer sky dome that is also the environment map; the sun as before; AgX tone mapping, GTAO,
   vignette (ADR 55).
6. **Camera:** the rider's view at handlebar height with cadence bob, plus the existing drone and follow shots
   (ADR 56).

## 5. The prototype

`Poc3DMaentwrogPhoto`: 600 frames (20 s) on the Maentwrog Road window, km 7.7–9.7, the best-documented section
(ADR 40): an aerial descent (frames 0–119, 110 → 35 m), the rider's view approaching the OSM bridge (120–359),
and the follow shot over it (360–599). Everything the brief's §7 lists is in it: lidar terrain and OSM alignment,
textured ground and vegetation, the proposed trail, one animated cyclist, the first-person and following shots,
natural light with cloud and haze, an aerial establishing shot. Three walkers (ADR 59, added 2026-10-30) share the
path in the rider's view: one walking the rider's way is overtaken at frame 241, a pair coming the other way is met at
frames 298–302, about a metre away on the guidance's 3 m width; all three are behind the follow camera when it cuts
in. `npm run render:photo` writes `out/poc-maentwrog-photo.mp4`.

## 6. Visual evidence

`docs/evidence/photo/`: `maentwrog_<60|150|240|330>_concept_vs_photo.jpg` are the reel's own Maentwrog cameras
rendered in both looks from the same code and data (then a `maentwrog-cmp` config; since ADR 60 `Section-maentwrog`
itself, whose photo extras the concept look ignores), and
`prototype_frame_<n>.jpg` (30, 200, 245, 300, 400, 520) are frames of the video; 200 and 245 show the walker being
overtaken and the pair being met. Real-world references for the comparison are the Geograph
photographs listed in `data/landmarks.json` and `docs/visual-reference-prompts.md` (looked at, not reproduced).

## 7. Performance

Development Mac (M4 Pro, 20 cores, 48 GB), `--gl=angle`, 1920 × 1080, GPU encoding (ADR 53):

| Measure | Concept look | Photo look |
|---|---|---|
| Draw calls, Maentwrog frames 60–330 | 65 | 180 (76 in the rider's view, where the rider is not drawn) |
| Triangles per frame as `THREE_STATS` counts them | 1,104,318 | 2,548,858 over both scene passes (the AO pass re-renders the scene); the scene pass alone is about 1.3 M |
| One still through the Node API | 1.8 s | 2.1–3.3 s |
| 600-frame video | — | 16.5 s wall, 51.8 s CPU (0.028 s/frame), 25.3 MB at 10 Mbit/s; with the three walkers (ADR 59): 13.6 s wall, 51.1 s CPU, 100 calls in the rider's view and 204 in the drone and follow frames; after the review's fixes (trees to 5 m of the line, close shadow map): 20.6 s wall, 60.2 s CPU, the same calls, 2.64 M triangles over both passes |
| Determinism (RN2), frames 0, 300, 599 twice | identical | identical after seeding the AO noise (before: 4–10 % of pixels ±1–2 levels) |
| No blank frames (RN5b scan) | — | 600 frames, centre luma 103–127 |

No GPU is required beyond what Remotion already uses (Chrome's ANGLE on the M4 Pro's GPU; a CPU-only machine would
render through SwiftShader, slowly but identically in content). No cloud service, account or paid asset was used.

## 8. Integration plan for the rest of the reel

1. Build `canopy` and `barriers` for the other four ground windows (`npm run data:canopy -- <id>`,
   `npm run data:barriers -- <id>`; about 15 s each, allowlisted hosts).
2. Capture new before stills (ADR 45), then set `photo` on one reel section at a time, starting with Trawsfynydd
   (the lake; add a reflection pass under its own ADR) and re-measure RL24 and the CL metrics: the tree layout of a
   section changes when its canopy arrives (ADR 57).
3. Add a textured road view (asphalt is already registered) and a cockpit (bars, hands) for the rider's view; replace
   the procedural rider's materials; let the rider slow for walkers (a motion change under spec C2). Done by ADR 60:
   textured roads, and walkers in every reel ground section.
4. For the aerial scenes, keep the map drape until an open orthophoto exists, or run the Blender background
   experiment of §3 for the intro and closing shots only. ADR 60 took a third way: the photo views over a Sentinel-2
   ground colour; a finer open orthophoto would still be the better source.
5. When the reel adopts the look, fold the photo prototype's captions into `reel-captions.ts` and retire
   `Poc3DMaentwrogPhoto` or keep it as the stills reference. The reel adopted it (ADR 60) with its own captions and a
   photo attribution; the prototype stays as the stills reference.

## 9. Documentation

`docs/sop-3d.md` ("The photoreal layer": run, change, never), `docs/design-photoreal.md` (modules, interfaces,
checks, budget, risks), ADRs 54–58, `README.md`, `data/source-register.md` (the canopy, barrier and texture rows,
the trail-width source), `docs/design-3d.md` (the pure-core block and tests table).

## 10. Limitations

- **Generic, by data limits:** tree species (OSM has `leaf_type` on 7 of 309 woods in the corridor), crown forms,
  wall heights (no `height` tags here), the bridge's form, the ground textures (photographs of similar surfaces, not of
  this valley), the sky (procedural), the cyclist's body and bicycle.
- **Data not available under a usable licence:** an orthophoto of the corridor (the Welsh aerial photography is not
  open), any photorealistic 3D tile source for a public video, drone capture over the railway.
- **Only the Maentwrog window** carries canopy, barriers and grass so far; the reel's look is unchanged by design.
- **Unverified in the field:** the trackbed's condition today, the km 9.00–9.02 dip, the steep profile stretches in
  the Vale-south and Trawsfynydd windows (spec RL8, still open; the guidance's 4 % for 50 m rule now gives them a
  measure). The lidar survey date is known (flown 2022-01-11); what grew or was felled since is not.
- **Trawsfynydd power station:** about 54 m today; demolition to a lower profile (25 m or 29 m by different reports)
  has begun under Costain for Nuclear Restoration Services (V); any future landmark model must carry the date.
- **Review:** the spec's independent review (X4) ran on 2026-10-30 (`docs/evidence/photo/independent-review-2026-10-30.md`):
  6 PASS, 10 PARTIAL, 1 FAIL (perceived realism), 1 N/A; its findings and the same-day responses are in
  `docs/validation-photoreal.md`.
- **Walkers are conceptual and generic:** three sixteen-part figures (ADR 59) with no faces, bags or poles; the rider
  does not slow for them. **No second cyclist, no signs:** no source gives the trail's signage or wording
  (`docs/storyboard.md` forbids inventing it), so none is drawn; the brief's road-crossing treatments and rest points are
  not in this window's shots.
- **From the independent review (2026-10-30; `docs/evidence/photo/independent-review-2026-10-30.md`), still open:**
  the corridor flattening on the 4 m grid makes a shelf about 16 m wide where the trackbed is on an embankment (a
  formation would be 5–6 m; flattening on the 1 m DTM is the data fix, ADR 13); tree species are a random 55 % conifer
  draw (a woodland-type dataset such as the National Forest Inventory, licence to be confirmed, would replace it);
  hedgerow tree rows in the canopy grid become isolated field trees (a classifier for elongated canopy components); no
  OSM wall lies within 336 m of the prototype's cameras although upland fields here are walled (1–2 m linear features
  from the 1 m DSM minus DTM could be registered as lidar-derived); the km 9.00–9.02 dip and the bridge's direction of
  crossing (OSM puts the trail over a service road; `docs/visual-reference-prompts.md` §6 says a lane crosses over the
  trail) are unverified against imagery or records; the card trees' seams, the ground tiling from the air and the pale
  band that follows the OSM woodland polygons are the next view fixes; the registered bark and asphalt textures are
  unused. The same day's fixes: grass on the rendered ground, a 160 m shadow map with 6 cm bias in the close shots,
  trees allowed to 5 m of the line in the prototype, the "approximate" earthwork caption and the illustrative-people and
  cleared-verges legend lines, and the register lists made consistent.
