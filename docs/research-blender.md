# Research: building the reel in Blender

Researched 2026-10-30 for [the Blender build plan](blender-build-plan.md); the build specification it leads to is
[design-blender.md](design-blender.md). Three strands ran in parallel (platform, assets and licences, data pipeline),
and the claims that steer the plan were spot-checked against the primary pages. **(V)** = verified on the cited page,
by running Blender 5.2.3 as a Python module (`bpy==5.2.3`) on this Mac, or by measuring the project's own data; **(I)**
= inferred or second-hand. Where a page could not be opened it says so. Nothing here was installed permanently or
bought; the scratch `bpy` environment used for the tests was deleted afterwards.

## 1. What changes the plan

1. **Blender 5.2 LTS is the right pin**, and the patch to pin is **5.2.3** (22 Oct 2026). The Homebrew `blender` cask
   moves to 5.3 within days; install `blender@lts` or the sha256-pinned DMG (§2.1).
2. **Scripts written for Blender 4.x break on 5.x**: the legacy Action API (`action.fcurves`) is gone, Geometry Nodes
   modifier inputs moved in 5.2, an output's `media_type` must be set before its `file_format`, the EEVEE identifier
   changed, `sequences` became `strips` (§2.6). Most online examples are 4.x.
3. **The M4 Pro's GPU renders Cycles at about a quarter of an RTX 4090**, so final-quality frames cost tens of
   seconds each: at 60 s per frame the 90 s reel is 45 hours (§2.2).
4. **Disk is the binding constraint on this machine** (5–6 GB free): the full reel's frames alone do not fit (§6).
5. **Renders are not bit-identical even twice on one machine** (open issue #101726), and the denoiser is not temporally
   stable: checks need tolerances and moving-footage review (§2.4).
6. **The project's own data are the right source; GIS add-ons are not needed.** A JSON manifest with raw binary
   sidecars, built into meshes with numpy `foreach_set`, imports an 810k-vertex terrain in 0.56 s and instances 50k
   trees in 0.03 s; glTF turns 50k instances into 50,001 objects (§3.3).
7. **The plan's coordinate formula is correct** (a +90° rotation about X, ×10), and a camera converted with it projects
   to within 0.0014 px of three.js, provided `sensor_fit = 'VERTICAL'` is set: the default renders a 45° vertical
   field as 38.5° (§3.4).
8. **The lidar's 4 m and 16 m levels are nearest-neighbour samples, not averages**, so the canopy grids undershoot crown
   tops (median 0.81 of the cell's 1 m maximum); close-up trees should come from the 1 m data (§3.2).
9. **Licence-clean assets exist for almost everything, with gaps**: no CC0/CC BY heather, bracken or rush; no
   hand-cycle; no realistic CC0 rigged dog; MakeHuman's skins and hair are thin on darker skin tones and textured hair.
   A CC BY 4.0 pedalling motion-capture dataset now exists (§4, §5).
10. **Assemble in Blender's Video Sequencer**, or bring sections into Remotion only as ProRes: Remotion's programmatic
    bundler copies `public/` into every bundle, so thousands of PNGs there would be copied on each render (§2.9).

## 2. Platform: Blender on the M4 Pro

The machine: Apple M4 Pro, 20-core GPU (Metal 4), 48 GB unified memory, macOS 26.6; Blender not installed (V, measured).

### 2.1 Version and install

| Item | Finding |
|---|---|
| Releases | 5.2 LTS (14 Jul 2026) is both the newest release and the current LTS, "maintained until July 2028"; patches 5.2.1 (25 Aug), 5.2.2 (15 Sep), **5.2.3 (22 Oct)**. 4.5 LTS is the last for Intel Macs. 5.3 is in beta until about 4–10 Nov 2026 (V: [releases](https://www.blender.org/download/releases/), [download index](https://download.blender.org/release/Blender5.2/), [LTS](https://www.blender.org/download/lts/)) |
| Bundled libraries (5.2 branch) | Python 3.13.13, NumPy 2.3.4, OpenImageDenoise 2.5.0, FFmpeg 8.1, OpenEXR 3.4.10 (V, [versions.cmake](https://projects.blender.org/blender/blender/raw/branch/blender-v5.2-release/build_files/build_environment/cmake/versions.cmake)) |
| macOS | 5.0 and later need Apple silicon and macOS 13+ (V, [requirements](https://www.blender.org/download/requirements/)) |
| Install | `blender-5.2.3-macos-arm64.dmg`, 346,295,881 bytes, `.sha256` beside it (V); Homebrew `blender@lts` (the `blender` cask follows the newest release and conflicts with it; V, [formulae](https://formulae.brew.sh/cask/blender)). Installed size about 1.1–1.3 GB (I) |
| Python module | `bpy==5.2.3` on PyPI (cp313, macOS arm64, needs numpy ≥ 2.2): runs Cycles CPU renders, imports, Geometry Nodes and the import scripts headless, without the app (V, [PyPI](https://pypi.org/project/bpy/) and tests). On this Mac it needs an arm64 Python 3.13 (`uv venv --python cpython-3.13…-macos-aarch64`); the system `python3` is x86_64 (V) |

### 2.2 Cycles on Metal, denoising and speed

- Metal is supported on Apple silicon; GPU ray tracing and denoising are available; path guiding is CPU-only and OSL is
  OptiX-only (V, [GPU rendering](https://docs.blender.org/manual/en/5.2/render/cycles/gpu_rendering.html)).
- MetalRT (hardware ray tracing) is a preference Off/On/Auto, **Auto by default**; Auto selected it on M3 (V, [4.0
  notes](https://developer.blender.org/docs/release_notes/4.0/cycles/)); M4 has the same hardware (I).
- OpenImageDenoise runs on the GPU on Apple silicon since 4.1, but `scene.cycles.denoising_use_gpu` defaults to False:
  set it (V, Cycles `properties.py`, 5.2 branch).
- Blender Open Data (Blender 5.2.0, median samples per minute; as reported by the research query, the page renders in
  the browser and could not be re-read here):

  | Device | Score | Relative |
  |---|---:|---:|
  | Apple M4 Pro, 20-core GPU (this machine) | 2,904 | 1.0 |
  | Apple M4 Max, 40-core GPU | 5,867 | 2.0 |
  | NVIDIA RTX 4090 (OptiX) | 11,553 | 4.0 |
  | Apple M4 Pro CPU | 362 | 0.12 |

### 2.3 EEVEE

The engine identifier is `BLENDER_EEVEE` since 5.0 (`BLENDER_EEVEE_NEXT` is gone; V, [5.0 API
notes](https://developer.blender.org/docs/release_notes/5.0/python_api/)). Its only documented headless limitation is
Windows (V, [limitations](https://docs.blender.org/manual/en/5.2/render/eevee/limitations/limitations.html)); 5.2 adds
`gpu.init()` for GPU use in background mode (V). `blender -b` with EEVEE on macOS without a login session is untested
(I): test it in phase 1. 5.2 reworked screen-space ray tracing and made instancing up to 2× faster (V, [5.2 EEVEE
notes](https://developer.blender.org/docs/release_notes/5.2/eevee/)). Use it for camera, timing and blockout previews,
not to judge Cycles lighting (I).

### 2.4 Determinism

- `scene.cycles.seed` defaults to 0 and `use_animated_seed` to False; the manual recommends the animated seed for
  animation because "a varying noise pattern is less noticeable" (V, [sampling](https://docs.blender.org/manual/en/5.2/render/cycles/render_settings/sampling.html)).
- Issue [#101726](https://projects.blender.org/blender/blender/issues/101726), "Cycles does not generate the exact same
  images when a scene is rendered twice", is open and confirmed (27 Feb 2026): threaded float accumulation in normals
  and tangents; `-t 1` on the CPU matched exactly (V). No Metal-specific report was found (I).
- OpenImageDenoise "is *not* temporally stable" (V, [OIDN README](https://github.com/RenderKit/oidn)).
- Practice (I): fixed samples with a noise threshold, never a time limit (output would depend on speed); the animated
  seed; enough samples that the denoiser does not invent detail; judge flicker in moving footage; compare frames by
  tolerance. This differs from the three.js pipeline, whose frames are byte-identical (RN2).

### 2.5 Performance features

- Geometry Nodes instances share one geometry; realising them duplicates memory; nesting is limited to 8 levels (V,
  [instances](https://docs.blender.org/manual/en/5.2/modeling/geometry_nodes/instances.html)). About 50k tree instances
  cost little in themselves; memory goes to unique variants, the terrain and textures (I).
- Persistent Data keeps render data between frames "for faster re-renders and animation renders at the cost of extra
  memory" (V, [performance](https://docs.blender.org/manual/en/5.2/render/cycles/render_settings/performance.html)).
- 5.2 adds a Cycles texture cache (tiled, mipmapped `.tx` files in `blender_tx/` beside each image; more disk); Simplify
  has texture size limits and camera/distance culling; adaptive subdivision left experimental in 5.0 (V, [5.2
  Cycles](https://developer.blender.org/docs/release_notes/5.2/cycles/), [5.0 Cycles](https://developer.blender.org/docs/release_notes/5.0/cycles/)).
- Kernel specialisation compiles optimised kernels in the background: benchmark after a warm-up (V, 3.5 notes).

### 2.6 Python API: what breaks and what is fast

| Area | 5.x behaviour |
|---|---|
| Animation | `action.fcurves`, `action.groups`, `action.id_root` removed in 5.0. Use slots and channelbags: `slot = action.slots.new(id_type='OBJECT', name=…)`; `cb = bpy_extras.anim_utils.action_ensure_channelbag_for_slot(action, slot)`; `cb.fcurves.new(path, index=…)`; then `anim_data.action = action; anim_data.action_slot = slot` (V, [5.0 notes](https://developer.blender.org/docs/release_notes/5.0/python_api/), [4.4 examples](https://developer.blender.org/docs/release_notes/4.4/python_api/), test) |
| Bulk keys | `fc.keyframe_points.add(n)` + `foreach_set("co", xy)`; `foreach_set("interpolation", ones)` sets LINEAR (= 1) in bulk; 600 frames × 7 channels in about 1 ms (V, test) |
| Meshes | `from_pydata` goes through Python tuples (slow at millions); use `vertices.add`, `loops.add`, `polygons.add` and `foreach_set` from numpy, then `mesh.update()`; 810k vertices, 1.6 M triangles with a per-vertex class and per-corner UVs in 0.56 s, `validate()` clean (V, test) |
| Attributes | `mesh.attributes.new(name, type, domain).data.foreach_set("value" or "vector", arr)` (V) |
| Point clouds | `bpy.data.pointclouds.new()` and `PointCloud.resize(n)` from 5.1 (V); a loose-vertex mesh also works |
| Geometry Nodes | Instance on Points has Pick Instance, Instance Index, Rotation and Scale (V, [manual](https://docs.blender.org/manual/en/5.2/modeling/geometry_nodes/instances/instance_on_points.html)). **5.2:** modifier inputs moved from `modifier["Socket_n"]` to `modifier.properties.inputs.<identifier>` (`.value`, `.type = 'ATTRIBUTE'`, `.attribute_name`) (V, [5.2 API notes](https://developer.blender.org/docs/release_notes/5.2/python_api/)) |
| Output | `image_settings.media_type` ('IMAGE', 'MULTI_LAYER_IMAGE', 'VIDEO') before `file_format` since 5.0 (V) |
| Devices | `prefs.refresh_devices()`; `get_devices()` deprecated in 5.2; set `use` on METAL devices only (V) |
| Sequencer | `SequenceEditor.sequences` is `.strips` (V) |
| Maths | `mathutils` vectors are float32 since 5.0 (V) |

### 2.7 Command line and output

`blender -b scene.blend -E CYCLES -o //frames/f_#### -F PNG -s 1 -e 600 -a -- --cycles-device METAL`: `-a`/`-f` go
last; everything after `--` reaches the script; also `--python-exit-code N`, `--factory-startup`, `--offline-mode`,
`--cycles-print-stats` (V, [arguments](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html)).
`--factory-startup` ignores saved preferences, so the script must select the GPU (I). Resumable sequences:
`use_overwrite = False`, `use_placeholder = True`; delete zero-byte placeholders after a crash (V/I). PNG is 8 or 16
bit; FFmpeg 8.1 encodes H.264/H.265/AV1, 10-bit on all three (V). Frame sizes at 1080p (I): about 2–5 MB per 8-bit PNG
of path-traced foliage (the project's three.js stills are 0.65–3.6 MB), twice that at 16 bit, 6–12 MB for half-float
EXR with ZIP, 1–3 MB with DWAA.

### 2.8 Colour management

AgX is the default view since 4.0; 5.2's views are Standard, ACES 1.3, ACES 2.0, Khronos PBR Neutral, AgX, Filmic
(deprecated), Filmic Log, False Color and Raw (V, [views](https://docs.blender.org/manual/en/5.2/render/color_management/displays_views.html)).
Rendered PNGs carry the view transform (display-referred); EXR stays scene-linear (V/I). To apply AgX once: the VSE
assembly scene uses View = Standard (V, the manual describes it for footage with a look already baked in); in Remotion,
`<OffthreadVideo toneMapped={false}>` for SDR intermediates (V, [OffthreadVideo](https://www.remotion.dev/docs/offthreadvideo)).

### 2.9 Assembly: Video Sequencer or Remotion

The VSE takes image strips (`strips.new_image` + `elements.append`) and text strips
(`strips.new_effect(…, 'TEXT', …)`); 5.2 adds text style presets and line spacing (V, [5.2 sequencer
notes](https://developer.blender.org/docs/release_notes/5.2/sequencer/)). Remotion reads image sequences through
`<Img src={staticFile(…)}>` (V, [assets](https://www.remotion.dev/docs/assets)), but the installed
`@remotion/bundler` 4.0.538 **copies** `public/` into each programmatic bundle unless `symlinkPublicDir` is set (V,
`node_modules/@remotion/bundler/dist/bundle.js`), and the render checks bundle several times. A ProRes file per section
read with `<Video>` (`@remotion/media`, installed) or `<OffthreadVideo>` avoids that (V, [media
Video](https://www.remotion.dev/docs/media/video)). Remotion can also render the captions alone as transparent ProRes
4444 (`--image-format=png --pixel-format=yuva444p10le --codec=prores --prores-profile=4444`; V, [transparent
videos](https://www.remotion.dev/docs/transparent-videos)) for compositing in the VSE, which keeps the tested caption
system.

### 2.10 MCP servers for Blender

"MCP for Blender" (formerly ahujasid/blender-mcp; MIT; active) needs a GUI session with an add-on listening on
localhost, runs arbitrary Python, has telemetry on by default and bundles paid AI model generators (V, GitHub). The
official Blender Lab MCP server (GPL-3.0, v1.0.3, 11 Sep 2026, Blender 5.1+) warns that it executes model code "without
any guards" (V, [Blender Lab](https://www.blender.org/lab/mcp-server/)). For a reproducible pipeline, plain
`blender -b -P script.py -- args` with exit codes is better; MCP is at most an interactive inspection aid (I).

## 3. Data pipeline

### 3.1 GIS add-ons

BlenderGIS (GPL-3.0; last release v2.2.15, 20 Dec 2025, with a Blender 5 bug-fix; 334 open issues; not on the
extensions platform; its OSM fetch fails with HTTP 406 on 5.2 until the Overpass server is changed; reprojection to BNG
needs GDAL, pyproj or a MapTiler key) and Blosm (free tier: ~30 m terrain and OSM features; paid tier for imagery and
trees) both fetch live, coarser data (V, [BlenderGIS](https://github.com/domlysz/BlenderGIS/releases),
[Blosm](https://github.com/vvoovv/blosm)). Neither is needed: the project's windows are pinned, validated and finer.
Neither can georeference the project frame either: Blender's +X would point 171.4° clockwise from true north, and the
best single similarity transform from the route frame to BNG leaves residuals up to 3.47 m (RMS 1.29 m) along the route
(V, computed from `data/railway-route.geojson` with `route.ts`'s formulas). Export control points instead (design §2).

### 3.2 Finer terrain and trees near the trail

- **The overviews are point samples.** Every 4 m and 16 m value in both the DTM and DSM COGs equals exactly one 1 m
  pixel (RMSE 0; block means and maxima fit worse) (V, measured). So `canopy.f32` is DSM − DTM sampled every 4 m (16 m
  in the corridor): near the Maentwrog bridge, for crowns ≥ 6 m, the sampled value was a median 0.81 (quartile 0.55)
  of the cell's 1 m maximum (V).
- **Reading 1 m data** works with the existing `scripts/dem/cog.py` at level 0; a 500 × 500 m DTM+DSM patch took
  8.5 s (V). Read only a band along each shot's stretch.
- **Capture:** the DSM metadata says "over the 2020-23 winter seasons" (V, [DataMapWales](https://datamap.gov.wales/catalogue/csw_to_extra_format/e47dfac2-ed3d-44fc-8d71-a493447ef509/LiDAR%201m%20resolution%202020-23%20DSM%20(hillshade).html)):
  leaf-off, so broadleaf crowns read low and porous (I). Only rasters are offered, not points (V), so a true pit-free
  canopy model (Khosravipour 2014) is out of reach; use raster pit filling (Ben-Arie et al. 2009). In the bridge patch
  4.1 % of canopy cells lay more than 1 m below their 3 × 3 median (V).
- **Individual trees** (local-maximum filtering with a height-dependent window, as lidR's `lmf`, e.g. window diameter
  `0.07 H + 3`; V, [lidR](https://search.r-project.org/CRAN/refmans/lidR/html/itd_lmf.html)). Crown width from height,
  Popescu & Wynne's combined-species fit: **CW = 2.51503 + 0.00901 H²** m (424 trees; V via [Gu et
  al.](https://pdfs.semanticscholar.org/01c3/cb65fd9ddb02fd7d5b3b327e9f0e8241c49c.pdf); the deciduous and pine fits
  should be checked in the paper, PE&RS 70(5):589–604, before use). Crown segmentation as `dalponte2016`/`silva2016`
  (crown diameter capped at 0.6 H) (V, [rdrr](https://rdrr.io/cran/lidR/man/its_silva2016.html)). Conifers are found
  more reliably than broadleaves (about 64 % against 42 % across five methods, Hastings et al. 2020; I, from the
  abstract); leaf-off capture makes broadleaves harder here (I).
- **Measured at the bridge** (no ground truth, V): 638 tops/ha from a raw local-maximum filter, 133/ha after smoothing
  (σ ≈ 1 px, minimum 3 m), 102/ha at a 5 m minimum. The count depends strongly on the parameters: calibrate against
  photographs (`docs/evidence/photo/`, Geograph references) before trusting it.

### 3.3 Exchange format

Measured with `bpy` 5.2.3 on this Mac (background, CPU; V):

| Format | Terrain (810k vertices) | 50k tree instances | Verdict |
|---|---|---|---|
| JSON manifest + raw little-endian sidecars, numpy `foreach_set` | 0.56 s, clean | 0.03 s as a point mesh + Instance on Points | **primary**: exact attributes, provenance in the manifest, mirrors `dem.json`/`dem.f32` |
| glTF 2.0 with `EXT_mesh_gpu_instancing` | — | 50,001 objects, 9.0 s ("objects sharing the same mesh data", V, [manual](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html)); no variant id | third-party assets only |
| Alembic | baked mesh caches | Transform Cache constraints (V, [manual](https://docs.blender.org/manual/en/5.2/files/import_export/alembic.html)) | not editable keys; no Node writer |
| USD (`PointInstancer`) | — | a point cloud with Instance on Points, 0.14 s (V, [manual](https://docs.blender.org/manual/en/5.2/files/import_export/usd.html)) | viable, but needs a hand-written USDA writer |

### 3.4 Coordinates, camera and sun

- `M = ((1,0,0),(0,0,−1),(0,1,0))`, determinant +1 (a +90° rotation about X), times 10: three.js `(x, y, z)` units →
  Blender `(10x, −10z, 10y)` metres; Blender's own glTF importer applies the same mapping (V, test). The plan's
  formula is right.
- A yaw about three.js +Y becomes the same angle about Blender +Z (V); compound rotations go through matrices.
- Camera (200 random poses, at most 0.0014 px from three.js's projection at 1080p; V): location `B(position)`,
  rotation `(B(target) − B(position)).to_track_quat('-Z', 'Y')`, `sensor_fit = 'VERTICAL'`, `angle_y = fovDeg`
  (45°; 52° in the rider's view), clip range ×10. With `sensor_fit = 'AUTO'` a 45° `angle_y` renders 38.5° vertically
  at 16:9, and `Camera.angle_x` follows the sensor width, not the render (V).
- Sun: `D = M · sunDirection(route, atmosphere)` (a unit vector towards the sun: azimuth 200°, elevation 35° in the
  route's frame); `sun.rotation_quaternion = D.to_track_quat('Z', 'Y')` (light travels along local −Z; V, shadow
  test). Export the vector, not the angles: the frame is rotated.

### 3.5 Imagery

Sentinel-2 L2A at 10 m (built, ADR 60) remains the best open image of the corridor. The Welsh aerial photography
(APGB) is licensed to the public sector (V, [DataMapWales](https://datamap.gov.wales/layers/geonode:apgb_dates_flown_wales/metadata_detail));
Copernicus VHR 2021 (2–4 m) is "only available as a web map service (WMS), and not for data download" (V,
[CLMS](https://land.copernicus.eu/api/en/products/european-image-mosaic/very-high-resolution-image-mosaic-2021-true-colour-2m));
Esri and Google are not usable (I/V); OS OpenData has no imagery (I). Super-resolved Sentinel-2 is model output,
invented detail (I).

## 4. Assets and licences

Licences checked on their own pages unless marked. Poly Haven and ambientCG are CC0 (V, [Poly
Haven](https://polyhaven.com/license), [ambientCG](https://docs.ambientcg.com/license)).

| Element | Best licence-clean option | Licence | Gaps and notes |
|---|---|---|---|
| Broadleaf trees (oak, birch, rowan, ash, hawthorn) | MTree 5.6.0 presets (Oak, Birch, …) with ambientCG `LeafSet` atlases | add-on GPL-3.0+ (MIT core); generated meshes are ours (I) | Poly Haven has no oak, birch, rowan, ash, hawthorn, spruce or larch (V, its API). Blendkit "Silver Birch Tree" (773k faces) is Royalty Free: usable, not redistributable in the same form, keep out of the public repo (V, [Blendkit licences](https://blendkit.com/docs/licenses)) |
| Conifers (Sitka spruce, Scots pine, larch) | Poly Haven `fir_tree_01` (7.9 M) and `pine_tree_01` (17.4 M) near the camera; decimated saplings or baked cards far | CC0 | stand-ins for the species; one instanced copy each |
| Paid trees, if approved | Botaniq (Blender 4.2–5.2, Royalty Free; $39.99–$129 quoted) or The Grove (€99–€799; models may not be redistributed) | commercial | Megascans on Fab: "any tool or engine", paid since 2025, but fab.com/eula returned 403: **unverified** |
| Grass, moss | Poly Haven `grass_medium_01/02`, `moss_01`, `fern_02`; ambientCG `Foliage001–008`, `Moss001–004` | CC0 | **no CC0/CC BY heather, bracken or rush found**: build in Geometry Nodes or from the project's own photographs |
| People | MPFB 2.0.18 (MakeHuman for Blender 4.2+) with Rigify; core assets CC0, packs licensed per pack (CC0 skins 01–03, hair 01, clothes 01; CC BY hair 02/03, clothes 02–03) | add-on GPL-3.0+; assets CC0 (V, [licence](http://static.makehumancommunity.org/about/license.html)) | ethnicity is a three-way blend; skins mostly light; no afro-textured hair or headwear: author and review with the community. Human Generator ($68/$128) forbids sharing models with unlicensed people; Character Creator 5 is Windows-only |
| Walk, run | 100STYLE (100 styles, BVH) and the CMU database | CC BY 4.0 (V, [Zenodo 8127870](https://zenodo.org/records/8127870)); CMU "free for all uses", credit requested (V, [CMU](http://mocap.cs.cmu.edu)) | MPFB's `cmu_mb` rig matches CMU. Bandai Namco's set is CC BY-NC: avoid. Mixamo allows use in videos but not redistribution of raw files (V only via a 2022 community FAQ; Adobe's page returned 403) |
| Pedalling | "Dataset of Motion Capture of Cyclists" (Kyriakou, Chrysanthou, Kyriakou 2024), BVH and C3D | **CC BY 4.0** (V, [Zenodo 10668611](https://zenodo.org/records/10668611)) | road and time-trial bikes on a turbo trainer, 60–110 rpm, no steering: use for leg timing under IK |
| Pushing a pram | none found | — | a walk with hand IK to the handlebar |
| Bicycles | Blendkit CC0 "Pink city bicycle" (rigged, 92k faces), "Blue Bicycle" (child, 73k) | CC0 | e-bike, balance bike and cargo bike only CC BY on Sketchfab (provenance is the uploader's word); **no hand-cycle**: model it |
| Prams | Sketchfab "Stroller" (dawnio, 88k) | CC BY | no CC0 option |
| Wheelchairs | Poly Haven `wheelchair_01` (a folding hospital chair); Sketchfab rigged electric chair (CC BY) | CC0 / CC BY | model an active user's chair |
| Dogs | Sketchfab "Animated Dog, Shiba Inu" (5 clips), "Labrador Dog" (two credits) | CC BY | **no realistic CC0 rigged dog**; Blendkit "German Shepard" is Royalty Free |
| Walls, slate | Poly Haven `castle_wall_slates`, `stacked_stone_wall`, `roof_slates_03`; ambientCG `RoofingTiles001/003` | CC0 | no slab-laid North Wales drystone: build walls from instanced stones |
| Sky | Blender 5.2 Sky Texture (Multiple Scattering; no clouds) or Poly Haven `kloofendal_38d_partly_cloudy_puresky` (a 38° sun, close to the project's 35°) | built-in / CC0 | `barnaslingan_01/02` (July midday) have a higher sun |
| AI-generated 3D | not used | — | Hunyuan3D 2.1's licence excludes the UK (V); generated scenery is never evidence (brief) |

## 5. People in motion

- **Root motion:** bake each person's root from the exported per-frame poses; a Follow Path constraint re-derives arc
  length from its own curve (V, [Follow Path](https://docs.blender.org/manual/en/5.2/animation/constraints/relationship/follow_path.html)).
- **No foot sliding:** play the cycle on an NLA strip with animated, cyclic strip time and key
  `strip_time = start + (d(f) − d0) / L_clip × cycle_frames`, where `L_clip` is the clip's own stride at the
  character's scale (V, [NlaStrip](https://docs.blender.org/api/current/bpy.types.NlaStrip.html) and test). Export
  distance tables, not the three.js gait phase, whose strides (0.8 H, 1.15 H, 0.7 H) no mocap clip matches.
- **Scale:** Geometry Nodes cannot play animated armatures per instance with time offsets (I); Animation Nodes has no
  5.x release (V). For about 25 people per scene, use linked rigs with library overrides and NLA (I).
- **Cyclists:** the pedalling mocap gives cadence timing; feet follow the pedals by IK, hands the grips; wheels turn by
  distance over radius (plan R01–R08).

## 6. Risks on this machine

| Risk | Detail | Handling |
|---|---|---|
| Disk | 5–6 GB free; Blender ≈ 1.2 GB, Metal kernel cache, `.tx` texture caches, exports, `.blend` files, frames (pilot ≈ 1.8 GB, reel ≈ 8 GB at 3 MB/frame), Remotion bundle copies, swap on the same volume | an external SSD for `out/blender/`, or render a section, encode it (ProRes or lossless), delete its frames; check free space before every render |
| Memory | 48 GB shared with macOS, Chrome and Remotion; spilling to swap can fill the disk mid-render | render with Remotion and Studio closed; measure peak memory in the benchmark |
| Version drift | 5.3 lands in November; most examples are 4.x | pin 5.2.3 by checksum; run the import tests against `bpy==5.2.3` |
| Repeatability | not bit-identical (#101726); denoiser flicker | tolerance-based image checks; review moving footage |
| Headless EEVEE | untested without a login session | test in phase 1; fall back to Cycles at low samples |
| Unguarded tools | MCP servers run arbitrary code | not part of the pipeline |

## 7. Corrections to earlier documents

`docs/blender-build-plan.md` (updated with this research): only Maentwrog had canopy and boundary files (now every
window, plus the corridor's OSM cover and Sentinel-2 image, ADR 60); the aerial assembly omits extras (it draws them in
the photo look); the exporter must build in the photo look (`buildSectionScene(cfg, inputs, "photo")`); the reel's
ground scenes already place 24 walkers, runners and prams (ADR 61) and the prototype 3 walkers; the 4 m and 16 m grids
are point samples; manual links pointed at the Slovenian and Serbian manuals; the 5.x API breaks; the image checks need
tolerances on one machine as well as across GPUs; the render budget can be anchored to the benchmark.
`docs/research-photoreal.md` §2.3 found no licence-clean cycling animation; the cyclist mocap dataset above is one
(for leg timing, not a whole performance).
