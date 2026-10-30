# Independent review: the photoreal prototype `Poc3DMaentwrogPhoto`

| Item | Value |
|---|---|
| Date | 2026-10-30 |
| Reviewer | independent production-validator agent, not the author |
| Git HEAD | `bb9c0391c2b77b704c181bcadd6ca3abf1c58c33` (branch `mission/3d-reel`) |
| Worktree | dirty: 886 entries in `git status --porcelain` at the time of writing; the prototype is uncommitted |
| Scope | `src/scenes3d/PocMaentwrogPhoto.tsx`, `PROTOTYPES["maentwrog-photo"]` in `src/three-core/sections.ts`, `src/three/photo/`, `src/three/WalkersView.tsx`, `src/three-core/walkers.ts`, ADRs 54–59 |
| Spec row | X4: this report checks the V rows for the photo look; the builder's own notes were read only after the verdicts were formed |

## Method

- Every evidence image in `docs/evidence/photo/` was read at 100 %, with full-resolution crops of the walkers, the cyclist,
  the bridge, the tree crowns and the drone ground.
- 22 further stills were rendered from today's code (frames 0, 60, 119, 120, 150, 230, 238, 243, 248, 280, 295, 300, 304,
  310, 330, 359, 360, 405, 410, 415, 450, 599) as `out/review-<n>.png` (git-ignored), on port 3561.
- `out/poc-maentwrog-photo.mp4` was scanned in full with `ffprobe` and `ffmpeg` (luma, frame differences, scene changes).
- The lidar canopy, the land cover, the OSM barriers and the trail profile were measured against the route line with a
  reviewer's script that uses the project's own `wgs84ToBng` (Helmert, about ±5 m). The script lives in the session
  scratchpad, not in the repository.
- `npm test` and `npm run lint` were run once each. No repository file was changed except this report.

## Verdicts

Counts: 6 PASS, 10 PARTIAL, 1 FAIL, 1 N/A.

| Criterion | Verdict | Evidence |
|---|---|---|
| G8 Known gaps stay visible | PARTIAL | The register carries the km 9.00–9.02 gap as `earthwork-fill-9.009` (approximate, fill up to 3.5 m) and the bridge as approximate. On screen, "Bridge: OSM position, generic form" shows on every frame (all six `prototype_frame_*.jpg`). The drone shot (frames 0–119, `review-0`, `review-60`) flies over km 8.96–9.06, where the fill is drawn as plain grass with no mark. The photo legend also drops the word "approximate" that the concept legend used. The register entries for the bridge, roads and earthworks list only `Poc3DMaentwrog` as their scene, not the photo composition. |
| H3 Railway status acknowledged | PASS | Frames 410–599 show "Concept only. Mothballed line; heritage rail has been proposed. Not an approved route." (`prototype_frame_520`, `review-450`, `review-599`), at full opacity for 5.8 s. |
| H4 No survey-grade claims | PASS | The attribution "… DEM- and OSM-derived, not survey-grade" is on every frame. The badge is on every frame. No caption claims precision; "gradients from the lidar profile" names a source. |
| CL7 Approximate and proposed features marked | PASS | The trail is labelled "Proposed trail (concept)" in frames 0–160, the badge is on every frame, and the gravel ribbon is distinct from every land cover. The bridge's generic form is labelled on every frame. The unmarked earthwork at km 9.009 is counted under G8. |
| CL8 Captions readable in time | PASS | Full-opacity times, with the 15-frame fades, against max(2.5 s, characters ÷ 15): section title 4.67 s against 4.33 s needed; proposed label 4.33 s against 4.33 s, exactly at the limit; rider's view 4.50 s against 4.40 s; closing 5.83 s against 5.73 s. Text is 28 px light on a 78 % dark box and is legible in every frame. Two captions have 0.1 s or less in hand, so any trim breaks CL8. |
| BL14 Translucent buildings | N/A | All 8 window buildings are status `existing`. No translucent group is drawn and the translucent legend line never appears. The buildings that are in view are untextured grey boxes (`review-119`, `review-599`). |
| RL11 Sky and fog | PASS | `PhotoSky` sets the background and the `FogExp2` colour (density 0.0009 per 10 m unit) to `atmosphere.horizon`, and the dome blends to the same colour at the horizon. The sun stays at ADR 18's 200° azimuth and 35° elevation. The horizon is seamless in `review-120` to `review-330`. |
| RL12 Shadows | PARTIAL | The written clauses hold: a 2048 map, 300 m across, `normalBias` 0.02, PCF soft, and no acne in any still. At the photo look's close range they fail visually. A `normalBias` of 0.02 units is 0.2 m, against a 0.15 m texel. The shadows of walkers and rider sit away from the feet and wheels, so the figures read as floating (`prototype_frame_200`, `_245`, `_400`, `_520`; `review-280` crop). |
| RL15 Roads and trees on the rendered ground | PARTIAL | Roads are tested to be at least 0.2 m above the rendered ground. Trunks, walkers and buildings stand on the ground in every still. The new grass layer reads the bare DTM (`heightAtBng(dem, …)` in `grass.ts`) rather than the flattened ground, and its code does not say which surface it uses. Measured 2–8 m off the line over km 8.85–9.32, the bare DTM is more than 0.15 m below the flattened shelf at 88 % of points, so that grass is buried and the verges read bare. It is more than 0.15 m above the shelf at 6 % of points, so that grass floats, by up to 1.96 m at km 9.306. |
| RL29 Sourced features only | PARTIAL | Every drawn kind has a register entry: terrain, land cover, trail, canopy trees, grass, cyclist, walkers, the bridge, 79 roads, 8 buildings, 43 barriers and 3 earthworks. Each has an OSM id, a DTM or DSM derivation or an "original" decorative source. Nothing structural is invented. `FEATURE_IDS` in `PocMaentwrogPhoto.tsx` omits roads, buildings, barriers and earthworks. The config's `featureIds` lists `trees` (the concept's woodland draw) instead of `trees-canopy-maentwrog` and omits `grass-maentwrog`, so the two lists disagree. Tree species are a 55 % conifer random draw, which is disclosed as generic in the source register. |
| Geographic fidelity | PARTIAL | The terrain, the line, the bridge, the roads and the tree positions and heights all come from lidar or OSM. Three things depart from the data. First, the corridor flattening reaches 8.2 m either side of the line, so where the trackbed is on an embankment it becomes a flat shelf about 16 m wide; this shelf is the wide verge in every rider-view frame. Second, the 10 m tree keep-out removes real canopy: lidar canopy of 3 m or more covers 51–63 % of the 5–15 m band along km 8.95–9.35, all of it drawn as open grass. Third, hedgerow tree lines, which show in the canopy grid as continuous rows, become isolated field trees (`review-0`). The OSM woodland polygons also appear as a pale-green swathe 60–100 m wide that matches no visible feature (`review-0`, `review-60`). |
| Perceived realism | FAIL | No frame would pass as a photograph. The tells are listed in rank order under "Synthetic tells" below. The people are the first thing a viewer notices. |
| Lighting and materials | PARTIAL | Reads real: AgX tone mapping, sky light on shade sides, distance haze, ambient occlusion, the gravel surface and the mossy stone at mid range. Reads synthetic: contact shadows are detached; trunks are flat untextured brown; walker and rider materials are flat colours; roads and buildings are flat grey; the parapet tops carry the wall-face texture and the parapet end faces are untextured grey (`prototype_frame_300` crop); the woodland has none of the dappled light the project's own reference describes. |
| Cyclist movement | PARTIAL | C2–C7 are tested and the pedalling is animated (`review-405`, `-410`, `-415`). The look is a box mannequin: a rectangular torso and arms, a white sphere for helmet and head, legs that splay outside the frame, and a near foot that hangs beside the wheel instead of on a pedal (`review-405`). Its shadow is detached. |
| Immersion and camera stability | PARTIAL | Stability passes: frame-to-frame change over frames 121–359 is 3.6–7.2 levels, against 18.6 and 33.5 at the cuts, with no spikes. The bob is 12 mm. Immersion is limited: the camera is at 1.2 m, there is no bike or hands in view and no motion blur, and the verges are an open shelf rather than a wooded trackbed. |
| Rendering reliability | PASS | The video has 600 frames at 1920×1080, 30 fps, h264, 20.0 s. Mean luma per frame is 98.5–130.8, so no frame is blank. No two consecutive frames are identical, and the only scene changes are at frames 120 and 360. Frames 300 and 450 re-rendered are byte-identical to the first render. Fresh stills match the video at 33–35 dB PSNR, which is codec loss only. |
| Walkers (ADR 59, C9) | PARTIAL | At distance they read as people sharing the path (`review-119`, `prototype_frame_200`). The choreography works: overtake at about frame 241, meeting at about frames 298–302, and all clear before the follow shot. Close up they are capsule mannequins. The heads have no faces, so front and back are hard to tell apart at 10 m (`prototype_frame_245`). The thigh and hip spheres are swollen (`prototype_frame_200`), the pale forearms read as sticks (`review-280`), and the figures float on detached shadows. The overtaken walker leaves the frame between frames 200 and 230, so the overtake itself is never on screen. The passing distances are in the walkers table below. |
| Honesty and labels | PARTIAL | The badge, the concept trail label, the bridge legend, the closing card and the "not survey-grade" credit are all present. The walkers and rider are not labelled illustrative on screen; the register says nobody walks the line today. The photoreal treatment invites viewers to read the open shelf and the cleared 10 m band as the real corridor, and neither is labelled. Section 6 of `docs/visual-reference-prompts.md` describes the trail passing beneath a bridge that carries a lane. The render, following OSM way 159029124 (`bridge=yes`, `layer=1` on the railway), puts the trail over a service road. Row "Textures, sky" in `data/source-register.md` still says no textures were downloaded and every material is a stand-in, but 16 registered CC0 files are in use. |

### Walkers: passing distances (measured from the configs)

| Pass | Rider | Walker | Centre to centre | Clear gap, shoulder to bar end |
|---|---|---|---|---|
| Overtake, walker 1 (1.72 m) | 0.5 m left of centre | 0.7 m right | 1.2 m | about 0.68 m |
| Meeting, inner walker of the pair (1.78 m) | 0.5 m left | 0.45 m right | 0.95 m | about 0.42 m |
| Meeting, outer walker (1.62 m) | 0.5 m left | 1.0 m right | 1.5 m | about 1.0 m |

The rider's half-width is about 0.23 m from the cyclist model's bar and arms. A walker's half-width is 0.17 × height, which is 0.28–0.30 m. On a 3 m path these passes are possible. The meeting pass is about 0.4 m at a closing speed near 20 km/h, with the rider at 15 km/h and not slowing. That is tighter than the Highway Code's advice for shared paths, which asks cyclists not to pass pedestrians closely or at speed.

### Corridor measurements, km 8.95–9.35 (lidar 4 m grid; OSM; reviewer's script)

| Band either side of the line | Lidar canopy of 3 m or more, left / right | OSM woodland, left / right | Drawn |
|---|---|---|---|
| 0–5 m | 23 % / 44 % | 63 % / 64 % | trail and shelf |
| 5–15 m | 51 % / 63 % | 50 % / 56 % | open grass shelf, no trees inside 10 m |
| 15–30 m | 28 % / 39 % | 31 % / 26 % | trees |
| 30–60 m | 18 % / 23 % | 19 % / 14 % | trees |

The nearest OSM wall to the prototype's cameras is way 369340296, 336 m from the line at km 9.217. Most of the 43 barriers lie beyond km 9.9, so no wall appears in any frame.

### Synthetic tells, ranked

1. The figures: capsule walkers and a box cyclist, with flat colours and no faces.
2. Shadows that detach from feet and wheels, so the figures float.
3. Card trees: painted-blob crowns, card seams visible as vertical edges (`prototype_frame_300` crop), uniform untextured trunks, and fern-like conifer fans.
4. The ground: texture tiling visible from the drone (`prototype_frame_30` crop), a pale lawn-like swathe over the OSM woodland, and sparse dark grass spikes.
5. Flat grey roads and box buildings.

Closest to real: the sky, the haze and the far terrain relief (`review-119`), the gravel trail at eye level, and the parapet stone at mid range.

## The five largest gaps between this render and a photograph of the real place

1. **The people.** Walkers and rider are primitive mannequins on detached shadows. They are the first thing a viewer reads as computer graphics, and they sit at the centre of every rider-view and follow frame.
2. **The corridor's width and cover.** Along km 9.05–9.25 the lidar shows the line running through a wooded band. The render shows a flat shelf about 16 m wide, with no tree within 10 m of the trail. That reads as a parkland boulevard, not a narrow tree-lined trackbed. The project's own reference for this place describes woodland "crowding both embankments".
3. **The trees.** Alpha cards with painted crowns and visible seams. A random 55 % conifer mix stands where the line is more likely colonised by broadleaf scrub; no data says which. Hedgerow tree lines become scattered single trees. Full summer foliage is drawn from a canopy surveyed on 2022-01-11, in winter.
4. **The ground cover.** Repeating texture from the air, and a pale band whose edges follow OSM polygons rather than anything visible. There are no rushes, bracken, gorse or wet ground. There are no field walls, because OSM maps none within 336 m, although upland fields here are walled.
5. **The built fabric.** Roads are flat grey ribbons; the registered asphalt texture is unused. Buildings are grey boxes. The bridge is a generic deck: its parapet tops carry the wall texture, its end faces are untextured, and there is no coping. Its direction of crossing conflicts with the project's own visual reference and is unverified.

## Recommended fixes

### View changes (no new data)

- **Shadows.** In the rider and follow shots, use a tight near cascade around the camera focus, about ±30 m, or three's cascaded shadow maps. Set `normalBias` to 3 cm or less for that cascade, and add contact shadows under feet and wheels.
- **People.** Replace the capsule walkers and the box rider with licensed, rigged, clothed human models with a walk cycle, registered under L1. Use inverse kinematics so the rider's feet stay on the pedals. Until then, keep figures small in frame.
- **Trees.** Put the registered bark texture on the trunks. Use alpha-to-coverage and more, jittered cards so the seams disappear, or impostors baked from 3D tree models. Use photographic leaf atlases instead of canvas blobs.
- **Ground.** Break the tiling with stochastic or hex tiling plus a macro variation map. Lower the land-cover tint so OSM polygons stop showing as colour bands. Make the grass denser and finer, with mixed colours.
- **Grass on the rendered ground.** Pass `heightAt` to `placeGrass` and state it in the code, closing RL15.
- **Roads, buildings and bridge.** Draw roads with the registered asphalt texture. Give buildings stone and slate materials. Add coping to the parapets and UVs to their end faces.
- **Walkers.** Slow the rider for the meeting pass, or have the pair step into single file, so the clear gap is about 1 m or more.
- **Camera.** Either raise the eye to about 1.5 m, an upright rider's eye, or keep 1.2 m and caption it as "camera at 1.2 m". Consider sub-frame motion blur on the near ground.
- **Labels.** Restore "approximate" in the bridge legend. Add a legend line saying the people and the cleared verges are illustrative, and mark the km 9.00–9.02 earthwork while the drone passes it.

### Data changes

- **Corridor flattening.** Flatten on the 1 m DTM, or on a local fine grid, so the shelf matches the trackbed formation of about 5–6 m instead of the 4 m grid's 16 m. Keep the real embankment and cutting slopes.
- **Tree keep-out.** For the photo look, reduce `clearOfTrailM` to the formation edge, about 3 m, and keep the lidar canopy where it stands. The rider's view needs no sight line to the rider.
- **Species.** Take broadleaf, conifer or mixed from a woodland-type dataset, for example the National Forest Inventory, with its licence to be confirmed. Otherwise use the canopy texture. Do not use a random 55 % draw.
- **Tree rows and walls.** Classify elongated canopy components outside woodland as tree rows. Extract 1–2 m linear features from the 1 m DSM minus DTM as walls or hedges. Register both as lidar-derived approximate, which is a valid source under RL29.
- **Open checks.** Resolve the km 9.00–9.02 dip and the bridge's direction of crossing against imagery, Coflein or OS historical mapping, since the source register still lists no structure inventory.
- **Documentation.** Update the stale "Textures, sky" row in `data/source-register.md`. Align `FEATURE_IDS` with the config's `featureIds`, and add `Poc3DMaentwrogPhoto` to the scene lists of the entries it draws.

## Tests and lint

| Command | Result |
|---|---|
| `npm test` (vitest 5.0.5) | 42 files passed; 284 tests passed and 2 expected fails (RL8 for vale-south and trawsfynydd, `it.fails`); 286 in all; exit 0 |
| `npm run lint` (`eslint src && tsc`) | no errors or warnings; exit 0 |

Per-frame renderer counts from `THREE_STATS`, covering all passes:

| Shot | Draw calls | Triangles |
|---|---|---|
| Rider's view | 100 | 2,622,598 |
| Follow | 204 | 2,629,830 |

Calls are within RN6's 300. Triangles are above RN6's 2 M as written; the builder notes that figure was set for one pass. Each still took about 3.5 s through the Node API. The builder's full render measured 0.023 s per frame.

## The builder's notes

`docs/validation-photoreal.md` holds the builder's visual reviews and ranked open items; `docs/validation-3d.md` only points to them. They were read after the verdicts above and did not change any verdict. Two points disagree with them:

- **Contact shadows.** The builder lists "a contact shadow" among the walkers' strengths. At 100 % the shadows are detached.
- **Geographic fidelity.** The builder calls it "unchanged by construction". It does not account for the cleared 10 m band or the 16 m flattened shelf, which the canopy measurements show departing from the lidar.

The builder's "the pair 3 m ahead" for frame 245 does not match the frame or the choreography: the pair is about 10 m ahead there, and walker 1 is beside the rider. Several of the builder's open items agree with this review: the procedural rider and walkers, the rider slowing for walkers, textured roads and a cockpit view. The detached shadows, the flattened shelf and tree keep-out, the card seams, the woodland swathe, grass on the bare DTM, the `FEATURE_IDS` mismatch, the stale source-register row and the bridge-direction conflict are not in the builder's lists.
