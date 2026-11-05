# Design: the Blender build (export, import, render)

Status: specification, written 2026-10-30 from [the research](research-blender.md) for [the build
plan](blender-build-plan.md); nothing here is implemented yet. It fixes the contracts a first implementation needs: the
pinned toolchain, the interchange package, the coordinate and frame mapping, the import recipes for Blender 5.2's API,
the render preset, the checks and the disk rules. The decision is recorded as [ADR 62](adr/0062-blender-pipeline.md).

## 1. Shape

```text
TypeScript core (the reel's data and assembly, photo look)                    Blender 5.2.3 LTS (pinned)
──────────────────────────────────────────────────────────                    ─────────────────────────────────────────
src/blender/export.ts  (esbuild-bundled Node script, as scripts/gen-earthworks.ts)
  loads public/data/... through the same validators as Scene3DDataProvider
  buildSectionScene(cfg, inputs, "photo")  ─►  out/blender/exports/<config>/
  evaluates every per-frame function            manifest.json        (schema, provenance, transform, layers)
  (camera, rider, people) into arrays           *.bin                (little-endian typed arrays, sha256 each)
                                                    │
                                                    ▼
                         scripts/blender/import_section.py  (blender -b --factory-startup -P … -- <export dir>)
                           meshes via foreach_set · point meshes + Geometry Nodes instancing · cameras and people
                           keyed through action slots/channelbags · materials from registered assets
                                                    │
                                                    ▼
                         out/blender/scenes/<config>.blend  ──►  scripts/blender/render.py (Cycles, Metal)
                                                                    out/blender/frames/<config>/f_####.png
                                                    │
                                                    ▼
                         scripts/blender/assemble.py: VSE master (View = Standard), or ProRes per section into Remotion
```

One export per **section config** (`maentwrog-photo`, and each `REEL_SCENES` entry with the frame count the reel gives
it, which can be shorter than the config's own: Maentwrog's config is 360 frames, the reel uses 300).

## 2. The interchange package

`out/blender/exports/<config>/manifest.json`:

```jsonc
{
  "schema": "ffestiniog-blender-export/1",
  "config": "maentwrog-photo", "look": "photo", "kind": "ground",
  "frames": 600, "fps": 30, "frameOffset": 1,            // Blender frame = source frame + 1
  "units": { "source": "three.js world unit = 10 m, Y up", "target": "metre, Z up" },
  "transform": { "matrix": [[1,0,0],[0,0,-1],[0,1,0]], "scale": 10, "origin": [x0, 0, z0] },  // three.js units
  "provenance": { "git": "<HEAD>", "snapshotTree": "<scripts/snapshot.mjs tree>", "dirty": true,
                  "inputs": [{ "path": "public/data/sections/maentwrog/dem.f32", "sha256": "…" }, …],
                  "registerIds": ["terrain-lidar", "trees-canopy-maentwrog", …] },
  "sun": { "direction": [dx, dy, dz] },                  // unit vector towards the sun, three.js frame
  "atmosphere": { "zenith": [r,g,b], "horizon": [r,g,b], "fogDensity": 0.0009 },
  "controlPoints": [{ "id": "trail@9150", "three": [x,y,z], "blender": [X,Y,Z], "bng": [E,N], "lonLat": [lon,lat] }, …],
  "layers": { "terrain": { "positions": "terrain.positions.bin", … }, … },
  "arrays": { "terrain.positions.bin": { "dtype": "float32", "shape": [810000, 3], "bytes": 9720000, "sha256": "…" }, … }
}
```

Every array is one file of raw little-endian values; the manifest records dtype, shape, byte length and sha256, as
`dem.json` does for `dem.f32`. The importer refuses a file whose length or hash differs. Positions stay in three.js units
in the files (the exporter evaluates, it does not convert); the importer applies the transform once.

| Layer | Arrays (per element) | From |
|---|---|---|
| `terrain` | positions f32 ×3, indices u32 ×3, colors f32 ×3 (sRGB), landClass u8, legend (manifest) | `scene.terrain`, `inputs.land` |
| `groundImage` (aerial) | rgba u8 W×H×4, imageUv f32 ×2 per vertex, cols/rows/scale | `scene.groundImage` (ADR 60) |
| `bareTerrain` (checks) | positions f32 ×3 (the unflattened DTM mesh), same indices | `buildTerrainMesh` before `flattenCorridor` |
| `trail` | ribbon positions, indices, uvs; samples (distM, x, y, z, gradient) every 1 m | `scene.trail` |
| `roads`, `bridges[i]`, `barriers.{wall,hedge,fence}` | positions, indices, uvs where present | `scene.roads`, `scene.bridges`, `scene.barriers` |
| `buildings[kind]` | positions, normals, indices; status per group | `scene.buildings.groups` |
| `water[i]` | positions, indices (triangulated with `waterArrays`, holes kept), surfaceY, OSM id; areaM2, `reservoir` (draw-down shore) | `scene.water`, `src/three/waterGeometry.ts` |
| `waterways[i]` (ground) | runs of [x, y, z] at the water's surface (just below the ground across the channel); kind, widthM, widthSource (default widths: river 5, stream 1.8, drain and ditch 0.8 m) | `scene.waterways` (`waterways.ts`); built by `scripts/blender/waterside.py` |
| `power` | supports: kind, position, heightM, heightSource, voltageV; lines: supports by index, cables, voltageV; status "existing" | `scene.power` (`power.ts`); built by `scripts/blender/power.py` |
| `trees.{conifer,broadleaf}` | x, y, z, scale, yaw f32; tint f32; variant u8 | `scene.trees` (all placements; Blender culls nothing by hand) |
| `grass` | x, y, z, yaw, scale, tint f32 | `scene.grass` |
| `camera` | per frame: position f32 ×3, target f32 ×3, fovDeg f32, near f32; shot index u8 and shot kinds (manifest) | `scene.shot(f)`, `shotSpecAt`, `Section3D`'s near-plane rule |
| `rider` | per frame: distM, position ×3, yaw, pitch, wheelAngle, crankAngle f32; dims (manifest) | `scene.table`, `cyclistPose` |
| `people[i]` | spec (activity, direction, sideM, heightM, seed) in the manifest; per frame: distM, position ×3, yaw f32 | `scene.walkers` (ADRs 59, 61) |
| `overlays` | captions (id, text, from, to, position) and legend lines per frame range | `reel-captions.ts`, the legend rules in `Section3D` |

The exporter is the only TypeScript change: it reads files with the validators in `src/three-core/registers.ts` (the
React provider is not a Node entry point) and must build in the **photo** look: the default `"concept"` leaves out the
canopy trees, boundaries, grass, people and the aerial image (ADR 60). Closures (`shot`, `poseAt`, `sampleAt`) are
evaluated into arrays; nothing else is re-derived in Python.

## 3. Coordinates and frames

```python
M = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))      # +90° about X, det +1: handedness kept
def B(p):                                            # three.js units → Blender metres
    return 10 * (M @ (Vector(p) - O))                # O = manifest transform.origin (vertical 0: Z is metres above datum)
```

- Blender axes are the route's rotated frame (+X about 171° clockwise from true north), not east and north. The
  control points carry BNG and lon/lat for checking; never georeference by a single similarity transform (residuals up
  to 3.5 m along the route).
- **Camera:** one camera object per shot, bound at the cut with a timeline marker; within a shot, keys on every frame
  with LINEAR interpolation, so nothing smooths across a cut.

  ```python
  cam.location = B(position)
  cam.rotation_mode = 'QUATERNION'
  cam.rotation_quaternion = (B(target) - B(position)).to_track_quat('-Z', 'Y')
  cam.data.sensor_fit = 'VERTICAL'                   # the default AUTO renders 45° as 38.5° at 16:9
  cam.data.angle_y = radians(fov_deg)                # 45°, 52° in the rider's view
  cam.data.clip_start, cam.data.clip_end = 10 * near, 26000.0
  ```

  Keep quaternion signs continuous between frames (flip when the dot product with the previous key is negative).
- **Sun:** `D = M @ Vector(sun.direction)`; `sun_obj.rotation_quaternion = D.to_track_quat('Z', 'Y')` (light travels
  along the lamp's −Z).
- **Yaw** (rider, people, trees, grass): an angle about three.js +Y is the same angle about Blender +Z. Pitch and
  combined rotations go through matrices.
- **Frames:** source frame `f` is Blender frame `f + 1`; scene range 1…frames, 30 fps, 1920 × 1080, pixel aspect 1.

## 4. Import recipes (Blender 5.2 API)

Large meshes, never `from_pydata`:

```python
me = bpy.data.meshes.new("terrain")
me.vertices.add(n_verts); me.vertices.foreach_set("co", coords.ravel())            # already through B()
me.loops.add(n_tris * 3); me.loops.foreach_set("vertex_index", indices)
me.polygons.add(n_tris); me.polygons.foreach_set("loop_start", np.arange(0, n_tris * 3, 3, dtype=np.int32))
me.update(); me.validate()
me.attributes.new("land_class", 'INT8', 'POINT').data.foreach_set("value", land_class)
me.attributes.new("tint", 'FLOAT_COLOR', 'POINT').data.foreach_set("color", rgba.ravel())
```

Instances: a mesh of loose vertices (or `bpy.data.pointclouds`, 5.1+) with `scale`, `yaw` and `variant` attributes,
and a Geometry Nodes modifier: Instance on Points with Pick Instance on a collection of variants, Instance Index from
`variant`, rotation from `yaw`, scale from `scale`. In 5.2 the modifier's inputs are set through
`modifier.properties.inputs.<identifier>` (`.type = 'ATTRIBUTE'`, `.attribute_name = "variant"`), not
`modifier["Socket_n"]`. Do not realise the instances.

Animation (5.0 removed `action.fcurves`):

```python
from bpy_extras.anim_utils import action_ensure_channelbag_for_slot
action = bpy.data.actions.new(f"{obj.name}-motion")
slot = action.slots.new(id_type='OBJECT', name=obj.name)
cb = action_ensure_channelbag_for_slot(action, slot)
for i, values in enumerate(location_columns):                                         # three columns, metres
    fc = cb.fcurves.new("location", index=i)
    fc.keyframe_points.add(frames)
    fc.keyframe_points.foreach_set("co", np.column_stack([frame_numbers, values]).ravel())
    fc.keyframe_points.foreach_set("interpolation", np.ones(frames, np.int32))      # LINEAR
    fc.update()
obj.animation_data_create(); obj.animation_data.action = action; obj.animation_data.action_slot = slot
```

People: root keyed from the exported positions and yaws; the walk, run or pedal clip on an NLA strip with animated,
cyclic strip time keyed as `start + (d(f) − d0) / L_clip × cycle_frames`, where `L_clip` is the clip's own stride at
the character's scale (no foot sliding at varying pace). Cyclists: wheel angle = distance / wheel radius (metres,
radians), feet to pedals and hands to grips by IK (plan R03).

Materials: Principled BSDF; colour maps sRGB, normal maps Non-Color through a Normal Map node; textures only from
files registered in `data/assets-3d.json` (spec L1 holds for Blender too). The aerial ground image is an image texture
on the `imageUv` attribute; the land cover drives the detail blend as in `TerrainPhotoView`.

## 5. Render preset

| Setting | Value | Why |
|---|---|---|
| Engine, device | Cycles; `compute_device_type = 'METAL'`, `refresh_devices()`, `use` on METAL devices only; MetalRT Auto | set in the script: `--factory-startup` ignores saved preferences |
| Sampling | fixed max samples (start 256) with a noise threshold (start 0.02); never a time limit; `use_animated_seed = True` | output must not depend on speed; animated noise is less visible than noise stuck to the screen |
| Denoising | OpenImageDenoise, albedo + normal, prefilter Accurate, `denoising_use_gpu = True` | it defaults to False; the denoiser is not temporally stable, so review moving footage |
| Performance | Persistent Data on; light tree on; texture cache on only if memory needs it (it writes `.tx` files beside each image) | animation renders reuse scene data |
| Colour | view AgX, look None, exposure 0; working space Linear Rec.709 | the three.js photo look uses AgX too; the VSE scene uses View = Standard so it is not applied twice |
| Output | `media_type = 'IMAGE'` then PNG, RGB, 8-bit; `use_overwrite = False`, `use_placeholder = True` | resumable; delete zero-byte placeholders after a crash |
| Motion blur | off until geometry and timing are accepted | — |
| Previews | EEVEE (`BLENDER_EEVEE`) or Cycles at 16 samples, 50 % resolution | camera, timing and blockout only |

Command: `blender -b out/blender/scenes/<config>.blend --factory-startup --python-exit-code 1 -P
scripts/blender/render.py -- --frames 1-600 --out out/blender/frames/<config>/`.

The dressed films render in EEVEE (`landscape.render_settings`) and are finished by `scripts/blender/finish.py`
(review 2026-11-03). That covers:
- **Sky and light (review 2026-11-05):** the CC0 `kloofendal_48d_partly_cloudy_puresky` HDRI (`landscape.SKY_HDRI`),
  turned to the package's sun azimuth; EEVEE takes the shadowing sun from it at 48°. Chosen on renders of four frames
  under seven candidate skies: the 38° one the film had read flat and milky, the low-sun skies went orange with long
  shadows, and a 28° clear sky gave a southern-hemisphere blue with hard shadows.
- **Haze:** the mist pass, linear in distance and eased exponentially, hazes the land only. The film renders with a
  transparent background and the sky is laid back from the environment pass, so the sky is no longer veiled. Strength
  is 0.14 on the ground and 0.10 from the air (0.25 and 0.16 veiled the middle distance).
- **Vignette:** 10 % at the corners.
- **Shadows:** a 1.5 GB shadow pool.
- **Look and grade:** AgX Punchy for every scene, after a grade in scene-linear (`finish.grade`): an ASC-CDL slope of
  (1.04, 1.0, 0.95) with an offset of (−0.004, 0, 0.006) for warm highlights and cool shadows, then saturation ×1.05
  and +0.12 EV on the ground, ×1.0 and +0.05 EV from the air. The social plates take the same finish, with no grade of
  their own.
- **Depth of field:** f/4 on the ground shots, focused on each shot's aim point.

The aerial imagery takes `FILM_IMAGERY_GRADE`, warming only vegetation, so slate tips and shingle keep their grey.
The path is `roadway.path_material`: compacted stone dust at a 0.9 m tile, with the verge creeping raggedly over its
edges. Distant trees take one of four broadleaf or three conifer crown shapes (`vegetation.BROADLEAF_CROWNS`,
`CONIFER_CROWNS`).

The community film's cargo cycles (review 2026-11-04; `src/three-core/cycles.ts`) are `scripts/blender/cargobikes.py`'s.
Each is built on `bike.build_bicycle`, which takes `rear_extra` and `front` for them:
- **Long-tail:** the rear axle 0.40 m back, under a deck with footboards, wheel guards, and a padded seat and hoop for a
  child.
- **Long john:** a plywood box between the head tube and a 20-inch front wheel steered by a rod.
- **Christiania-style box tricycle:** its box, bar posts and two 20-inch front wheels fitted to the rider's hands once
  the rider is seated (`finish`).

Children are cast from `cast.PASSENGERS` (ages 4 to 6). They sit on the box's bench, or astride the long-tail's seat,
parented to the cycle and looking about. Shopping is a crate and bags.

Every caption of the community film is bilingual, Welsh first: `build_reel.body` sets a caption's `cy` above its
`text`, and each legend line's Welsh stands above its English (`SectionConfig.bilingual`). The film's `layout`
(`COMMUNITY_LAYOUT`) widens the caption box to 900 px. `build_reel.captions` places the captions and legend clear of
the credits and the badge, whose heights it measures from the font's own metrics (`blf`).

Typography (review 2026-11-05): every strip is set in Inter, the OFL font Blender ships in its datafiles, in place of
the sequencer's monospaced default. A scene caption is a translucent panel with a leaf-green accent bar, its Welsh at
36 px over its English at 27 px in a lighter ink, pre-wrapped to the caption width; the credits run throughout in one
13 px line per language; a scene's legend (what is proposed or illustrative) shows for its first six seconds under
the badge, then clears the frame.

The opening shows what is there before what could be: `community-then` draws the mothballed railway's track on the
trail's line (`SectionConfig.photo.railway`; `scripts/blender/railway.py` builds rails and sleepers within 350 m of
the cameras, gives the ribbon a ballast finish with the verge creeping over it, and lets the sward grow through it),
and `community-now`, the same camera with people on the path, cross-dissolves over its last 30 frames
(`ReelScene.dissolve`: the dissolving strip sits on channel 2 with its alpha keyed up over the overlap).

The film renders to PNG frames with `scripts/blender/render_film.py` (resumable; a changed scene is re-rendered over
its own frames alone) and is encoded with its soundtrack by `npm run film:encode` (the social cuts' delivery preset:
H.264 High CRF 16, closed GOP 15 with two B-frames, BT.709, AAC 320 kbps, Fast Start). The soundtrack is
`npm run film:audio`: the social cuts' original score shaped to the film's chapters (low under the opening, resting at
the bench, full under the ride) over a breeze, birdsong and the hush of tyres in the ride scenes, at −14 LUFS.
`npm run film:compare` writes before-and-after sheets of two cuts at the same moments.

The community film's social cuts (`src/data/social-cuts.ts`) are rendered fresh from its dressed master, not cropped
from the 3-minute film, which is never re-saved:
- **Plates:** `scripts/blender/render_social.py` renders each plate at its format's own size (1080 × 1920, 1440 × 1800 or
  1920 × 1080), clean of captions. Each plate is a run of one of the film's camera shots. The camera keeps the plan's
  share of the master's horizontal view (half for 9:16), pans about the vertical and shifts its lens to hold the
  subject and the view. The finish is sharpened for phones: 48 samples, a 1.25 px filter, a 126° shutter and f/5.6. The
  grade is the film's own (`finish.grade`, review 2026-11-05), so a cut matches the film shot for shot; the story,
  highlights and feed cuts open with the film's then-and-now pair.
- **Edit:** Remotion lays each cut's plates frame for frame under its Welsh-first captions, the concept badge, notes on
  existing and proposed furniture, and the end card (`src/social/SocialCut.tsx`), all inside the format's safe area.
- **Sound:** an original synthesised piece with a countryside bed (`scripts/social/make_audio.py`), normalised to
  −14 LUFS.
- **Export:** H.264 High, 4:2:0, BT.709, Fast Start, AAC 320 kbps at 48 kHz, with SRT subtitles and the post text
  (`npm run social:plates`, `social:audio`, `social:render`). `social:qa` then probes each export as uploaded: the
  stream and its tags, loudness and true peak, Fast Start, no frozen or black stretches, each shot's middle frame
  against its plate, and the sound in sync with its soundtrack, with a contact sheet and a still per shot.

## 6. Checks

| Check | How | Threshold |
|---|---|---|
| Package integrity | sha256 and byte lengths against the manifest | exact |
| Transfer | control points and mesh vertices after `B()` against the exported arrays | ≤ 0.05 m |
| Camera | project registered landmarks and trail points with the Blender camera and with three.js's camera | ≤ 0.5 px at 1080p (the research measured 0.0014 px) |
| Timeline | frame range, one camera bound per shot, no key interpolating across a cut | exact |
| People and rider | feet and wheels on the trail surface; no person, pram, bicycle or wheelchair intersecting another (the placer's margins, ADR 61) | contact ±0.05 m |
| Repeatability | the same frame rendered twice on this Mac | `oiiotool a b --fail 0.016 --failpercent 1` (Blender's own render tests); not bit-exact (#101726) |
| Determinism of the import | two imports from one package | identical mesh and key arrays |
| Edit | frame count, no black frame (luma scan as the reel's RL26), captions inside the safe area | as the reel's checks |

Tests run without the app through `bpy==5.2.3` under pytest (`tests/blender/`), spawned from vitest as
`tests/pipeline-python.test.ts` spawns the pipeline self-tests; the app smoke test is
`blender -b --factory-startup --python-exit-code 1 -P tests/blender/run.py`.

## 7. Close-up data (phase 3)

The 4 m canopy grid undershoots crown tops (nearest-neighbour samples). For trees within about 150 m of a ground
shot's camera path, a new step reads the 1 m DTM and DSM in a band along the shot (`scripts/dem/cog.py`, level 0) and
detects trees:

1. CHM = clip(DSM − DTM, 0, 45); nodata → 0; fill pits: where a cell is more than 1 m below its 3 × 3 median and the
   median is above 2 m, take the median.
2. Smooth once (binomial [1,4,6,4,1]/16, σ ≈ 1 px).
3. Tree tops: cells ≥ 5 m that are the maximum within a circular window of radius `round(CW(H) / 2)` px, clamped
   1–8, with CW(H) = 2.51503 + 0.00901 H² m (Popescu & Wynne, combined species; check the species-specific fits in
   the paper before using them).
4. Height from the unsmoothed CHM at the top; crown radius from the segmented area (region growing from the tops),
   capped at 0.3 H.
5. Write `public/data/sections/<window>/trees-1m.json` with a register entry (approximate, lidar-derived, leaf-off
   2020–23), and use these near the camera with the 4 m canopy placements beyond.

Calibrate the parameters against photographs before trusting the counts (102–638 tops/ha at the Maentwrog bridge
depending on them). Leaf-off capture makes broadleaves lower and harder to find than conifers.

## 8. Layout and budgets

| Path | Contents | Commit? |
|---|---|---|
| `src/blender/` | the exporter and its schema (TypeScript) | yes |
| `scripts/blender/` | import, materials, vegetation, people, render and assembly scripts (Python, < 500 lines each) | yes |
| `config/blender/` | `toolchain.json` (Blender 5.2.3, the DMG's sha256, `bpy==5.2.3`), render presets | yes |
| `tests/blender/` | pytest suites on `bpy`, the app smoke test | yes |
| `public/3d/blender/` | registered third-party assets (CC0/CC BY with attribution; Royalty Free assets stay out of the public repository) | per licence |
| `out/blender/` | exports, `.blend` files, frames, masters | no (generated) |

Disk: about 5 GB is free on this machine. Before any render the script checks free space against frames × measured
bytes per frame plus 2 GB; `out/blender/` can point at an external volume (`BLENDER_OUT`). Render a section, encode it
(ProRes or lossless H.264), keep the encode, delete the frames. Close Remotion Studio and Chrome while rendering
(memory spilling to swap fills the same disk).
