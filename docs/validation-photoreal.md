# Validation log: the photoreal layer (ADRs 54–59)

The photoreal prototype's records (`Poc3DMaentwrogPhoto`; `docs/design-photoreal.md`, `docs/research-photoreal.md`), kept
apart from `docs/validation-3d.md` as the POC and reel records are (`docs/validation-poc.md`, `docs/validation-reel.md`).
The independent review's own report is `docs/evidence/photo/independent-review-2026-10-30.md`.

## Photoreal prototype (ADRs 54–58, 2026-10-29)

Builder's own record; the independent review of the V rows (spec X4) has not run for this iteration. Measurements
bind to snapshot tree `ed4ded731c85` (dirty worktree of `mission/3d-reel`, HEAD `bb9c039`, untracked sha256
`a95b2b610af5…`); edits after it were documentation only (this section, `docs/research-photoreal.md`, the design
block line for `PHOTO_TRAIL_TINT`). Nothing committed, pushed or stashed; `tests/baselines/` untouched (X2).

| Check | Result | Detail |
|---|---|---|
| `npm run lint`, `npm test` | pass | 41 files, 276 passed, 2 expected fails (RL8 vale-south and trawsfynydd, unchanged); 4 new test files (first-person, barriers, grass, trees-canopy) |
| Pipeline self-tests | pass | `build_canopy.py --self-test`, `fetch_barriers.py --self-test`, `py_compile` of both |
| RN2 determinism, `Poc3DMaentwrogPhoto` frames 0, 300, 599 | pass | byte-identical between a Node-API render and a fresh CLI process; **failed before** `SceneAwareGTAOPass` seeded three's `GTAOPass._generateNoise` (4–10 % of pixels differed by a mean of 1.4 levels, max 54, over the ground and trees) |
| RN3 format | pass | `ffprobe`: 1920×1080, 30/1, h264, 600 frames; 25.3 MB at 10 Mbit/s (ADR 53 encoding) |
| RN5b blank scan | pass | 600 frames, canvas-centre luma 103.2–127.1 |
| RN6 per frame (`THREE_STATS`, whole frame over both scene passes) | within the call budget; triangles above the 2 M figure that was written for one pass | rider's view (frame 240): 76 calls, 2,541,478 tris; drone and follow frames: 180 calls, 2,548,710 tris; the concept look on the same Maentwrog cameras: 65 calls, 1,104,318 |
| Render time | pass | 600 frames in 16.5 s wall, 51.8 s CPU (0.028 s/frame); one still 3.3–3.6 s through the Node API with a warm bundle (concept 1.8 s) |
| H1, H2b, CL8 for the prototype | pass | `FEATURE_IDS` resolve (`trees-canopy-maentwrog`, `grass-maentwrog` added); `proposed-label` from frame 0; `PHOTO_CAPTIONS` pace ≤ 15 cps |
| CA1–CA4 for the rider's view (CA3 as amended by ADR 56) | pass | `tests/three-core/first-person.test.ts` on a pedalling rider over the synthetic valley |
| L1 | pass | 16 Poly Haven files under `public/3d/textures/`, each registered with licence (CC0 1.0, verified on polyhaven.com/license) and sha256; the static test ties `assetRoles.ts` to the register |
| RL30 | pass | hosts now `dmwproductionblob…`, `api.openstreetmap.org`, `dl.polyhaven.org` (+ `polyhaven.com` as a cited page) |
| CL14 as amended | pass | texture loaders only in `PhotoAssetsProvider` |

**Data built (Maentwrog window):** canopy 471 × 729 at 4 m, 71,368 cells ≥ 2 m (20.8 %), median 9.4 m, p95 17.9 m,
max clipped at 45 m; barriers 43 ways (29 walls, 4 `dry_stone` walls, 4 `city_wall`, 6 fences; no `height` tags).

**Visual review (builder; `docs/evidence/photo/`):**
- *Geographic fidelity:* unchanged by construction: same lidar mesh, same OSM centreline, same registers; the trees
  now stand where the canopy is and at its height, the walls where OSM maps them. The aerial still shows the
  plantation block, the field trees along the lane and the open pasture as the OS map does.
- *Perceived realism:* the like-for-like pairs read as a different medium: photographic ground with relief, layered
  conifers and broadleaf crowns with shaded sides, a mossy stone bridge, cloud, haze and contact shadow. Still visibly
  generic at close range: the ground photographs are of similar surfaces, not this valley; conifer tier discs read flat
  from directly above; the rider is the procedural capsule model; grass clumps are sparse spikes.
- *Lighting and materials:* AgX removes the clipped highlights and grey shadows of the concept look; the sky image
  lights the shade sides. The exposure (0.98) keeps mean luma near the concept look's.
- *Cyclist movement:* unchanged (C2–C7 hold); in the rider's view the 12 mm cadence bob is visible but gentle.
- *Immersion and camera stability:* the rider's view passes CA2 (speed change within ±10 %, angular velocity ≤ 30°/s);
  the 15 m look-ahead turns the view through the bend before the bridge without snatching.
- *Rendering reliability:* deterministic across two render paths after the noise fix; no delayRender timeouts; the
  stand-ins render when a texture is missing, so a lost download cannot blank a frame.
- *Cost:* about twice the concept look's frame work; 16 MB of CC0 textures; no new dependency, service or hardware.

**Open (ranked):** 1. independent review of the V rows for the photo look; 2. the trail's gravel still shows a faint
tiling along the ribbon at the rider's eye height (a second tile scale or a detail map); 3. conifer tier discs for the
aerial; 4. the procedural rider; 5. a cockpit in the rider's view; 6. textured roads (asphalt registered, view not
built); 7. the other windows' canopy and barrier data. The lidar licence wording (K2) is closed: the research agents'
reports, received 2026-10-30, found the OGL statement on the DataMapWales LiDAR viewer page and the corridor's flight
date (2022-01-11) in the tile catalogue; `data/source-register.md` records both.

### Walkers added (ADR 59, 2026-10-30)

Builder's own record. Three walkers now share the path in the prototype (`PROTOTYPES["maentwrog-photo"].photo.walkers`):
one walking the rider's way on the right, overtaken at frame 241; a pair coming the other way on the rider's right,
met at frames 298 and 302; all three behind the follow camera from its first frame (frame 360). Nothing committed,
pushed or stashed; `tests/baselines/` untouched (X2). The video and `docs/evidence/photo/prototype_frame_<n>.jpg`
(30, 200, 245, 300, 400, 520) were re-rendered from this state.

| Check | Result | Detail |
|---|---|---|
| `npm run lint`, `npm test` | pass | 42 files, 284 passed, 2 expected fails (RL8, unchanged); new `tests/three-core/walkers.test.ts` (8 tests) |
| C9 (C1–C5 at walking ranges) | pass | pace 3–6 km/h and slower uphill; figure height 0.95–1.0 × its 1.5–1.95 m at every gait phase with a sole on the ground; offset ≤ 1 m on the spec's side; planted sole within ±0.05 m of the surface; yaw within 5° of the direction of travel; one stride per 0.8 × height; deterministic |
| The prototype's choreography on the real Maentwrog trail | pass | passes at frames 241, 298, 302 (all within the rider's view, 150–345); every walker ≥ 2 m behind the follow camera from frame 360; all inside km 7.7–9.7 |
| RN2 determinism, frames 245 (walker 1 beside the rider, the pair about 10 m ahead) and 420 | pass | byte-identical between two fresh CLI processes (`md5` 51144bc4… and b49df6f7…) |
| RN3 format | pass | `ffprobe`: h264, 1920×1080, 30/1, 600 frames; 25.3 MB |
| RN5b blank scan | pass | 600 frames, centre-crop mean luma 104.2–131.4 (`signalstats` on a 400 × 300 centre crop) |
| RN6 per frame (`THREE_STATS`, whole frame) | within the call budget | rider's view 100 calls (was 76), drone and follow frames 204 (was 180), 2,622,598–2,629,830 triangles. **First built with one mesh per part, the three walkers cost 192 calls at the aerial frame (372 in all, over 300):** in the photo look every mesh is drawn by the scene pass, the two ambient-occlusion passes and the shadow map, which draws walkers behind the camera too. Two instanced meshes per walker (declarative instance attributes) brought it to 24 |
| Render time | pass | 600 frames in 13.6 s wall, 51.1 s CPU (0.023 s/frame; the earlier 16.5 s run shared the machine with a Studio) |
| H1, H2b, CL8 for the prototype | pass | `FEATURE_IDS` gains `walkers-maentwrog` (kind `walker`, decorative, conceptual-use note); captions unchanged |
| The reel is unchanged (CL1, RG) | pass | `Section-maentwrog` frames 150 and 330 in the concept look (`captions: "none"`, scale 1, `--gl=angle`) are byte-identical to `out/after/maentwrog_<f>_clean.png` of 2026-10-26 (`md5` 3b0668e6… and 8992834f…): the whole photoreal layer, walkers included, leaves the reel's frames as they were |

**Visual review (builder; `prototype_frame_200.jpg`, `_245.jpg`, `_300.jpg`):** the figures read as people at a glance
(proportions, a gait with a planted foot, arms against the legs, a shadow under them: the review below found it detached
by 0.2 m at 100 %, which the shadow change below addresses) and as mannequins on inspection:
no faces, hands or clothing detail. The pass at about a metre is close but not alarming at the rider's 15 km/h; the
rider does not slow or move over, which a real rider would. Heights and skin and hair tones differ between the three;
nothing else about them does. The walkers are out of frame when they are beside or behind the camera, so no figure
clips the near plane. The follow shot shows none of them, by design.

**Open (ranked):** 1. the independent review of the V rows for the photo look (recorded below); 2. the rider slowing
for walkers (a motion change under C2); 3. the trail's gravel tiling at eye height; 4. conifer tier discs for the
aerial; 5. the procedural rider and walkers' detail; 6. a cockpit; 7. textured roads; 8. the other windows' canopy and
barrier data.

### Independent review (spec X4, 2026-10-30)

Reviewer: an independent `production-validator` agent, not the author of any of the work, given the evidence images,
the code, the spec rows and the brief's six visual dimensions, and told to form its verdicts before reading the
builder's notes. Its report, with its own 22 stills, a full scan of the video and canopy measurements along the line,
is `docs/evidence/photo/independent-review-2026-10-30.md`.

**Verdicts (18 rows): 6 PASS, 10 PARTIAL, 1 FAIL, 1 N/A.** PASS: H3, H4, CL7, CL8, RL11, rendering reliability.
N/A: BL14. FAIL: perceived realism ("no frame would pass as a photograph; the figures and the card trees give it away
first"). The builder's notes changed no verdict; the reviewer disagreed with two of the builder's claims, and the
builder accepts both: the walkers' shadows were detached (0.2 m of normal bias against a 0.15 m texel), and
"geographic fidelity unchanged by construction" did not account for the 10 m tree keep-out (lidar canopy covers 51–63 %
of the 5–15 m band along km 8.95–9.35) or the 16 m flattened shelf.

| Finding | Verdict | Response (same day) |
|---|---|---|
| RL15: grass placed on the bare DTM, buried under the fill at 88 % of points 2–8 m off the line, floating at 6 % (up to 1.96 m) | PARTIAL | **Fixed.** `placeGrass` takes `groundAt` and the assembly passes the rendered ground; the code states the surface; a test checks every clump's height against it (`tests/three-core/grass.test.ts`) |
| RL12: shadows detached from feet and wheels (`normalBias` 0.02 units = 0.2 m) | PARTIAL | **Changed.** `SHADOW_PHOTO_CLOSE`: in the photo look's rider's view and follow shot the shadow map covers 160 m instead of 300 and the normal bias is 6 cm; the drone shot and the reel keep the reel's values (`Lighting` takes `shadow`) |
| RL29: `FEATURE_IDS` and the config's `featureIds` disagree ("trees" for the canopy trees; grass missing); register scene lists omit the photo composition | PARTIAL | **Fixed.** Both prototype configs list the composition's ids; `Poc3DMaentwrogPhoto` added to the bridge's and the three earthworks' `scenes` |
| G8: the drone shot crosses the registered km 9.00–9.02 fill with no mark; the photo legend dropped "approximate" | PARTIAL | **Fixed.** A drone shot's legend names the registered earthworks between its track and the rider from the register itself (`earthworksInRange`; "Earthwork at km 9.01: approximate, DEM-derived" on frames 0–119; a caption was tried first and overlapped the proposed-trail caption); the bridge legend reads "approximate generic form" |
| Honesty: the people and the cleared, levelled verges are not labelled illustrative | PARTIAL | **Fixed.** Legend lines "People: illustrative" and "Verges levelled and cleared for the concept" on every ground frame of the photo look |
| Geographic fidelity: the 10 m tree keep-out clears real canopy; the 16 m shelf; hedgerow rows become single trees | PARTIAL | **Partly changed.** `photo.treeClearOfTrailM: 5` for the prototype (the rider's view needs no sight line; the follow camera's lines of sight still exclude crowns). The shelf is ADR 13's 4 m-grid flattening and the tree rows need a classifier: both recorded as open, below |
| Honesty: the "Textures, sky" row of `data/source-register.md` was stale | PARTIAL | **Fixed.** The row names the 16 registered CC0 files and the procedural sky |
| Honesty: `docs/visual-reference-prompts.md` §6 describes a lane crossing over the trail; OSM way 159029124 (`bridge=yes`, `layer=1` on the railway) puts the trail over a service road | PARTIAL | **Open for the owner.** The render follows OSM; the prompts document is an image-prompt aid, not evidence. The crossing direction needs imagery or a record (`data/source-register.md`: no structure inventory) |
| Walkers: the meeting pass leaves about 0.42 m between shoulder and bar end at 15 km/h with no slowing; faceless capsules; swollen hips; the overtake leaves frame between 200 and 230 | PARTIAL | **Open.** The pass distance is the guidance's 3 m width with the rider's fixed 0.5 m offset; slowing the rider is a C2 motion change (open item 2). Figures stay procedural (open item 5) |
| Cyclist: box mannequin, near foot beside the pedal | PARTIAL | **Open** (item 5; ADR 34's model) |
| Lighting and materials: trunks, figures, roads and buildings flat-coloured; parapet tops carry the wall texture; no dappled light | PARTIAL | **Open** (items 5, 7; the bark texture is registered and unused) |
| Immersion: 1.2 m eye, no bike in view, open shelf | PARTIAL | **Open** (item 6 the cockpit; the eye height is ADR 56's and can be captioned) |
| Perceived realism | FAIL | **Accepted.** The ranked tells (figures, detached shadows, card seams, ground tiling and the OSM-polygon colour band, flat roads and boxes) are the next iteration's list; the research document's §10 carries them |
| RN6: triangles 2.62–2.63 M across all passes, above the 2 M as written | note | As documented in `docs/design-photoreal.md`: the figure was set for one scene pass; the scene pass alone is about 1.3 M. Rewriting RN6 for the photo look is the owner's call |

The reviewer's data recommendations (flatten on the 1 m DTM; species from a woodland-type dataset; tree rows and
walls from the 1 m DSM; resolve the km 9.00–9.02 dip and the bridge's crossing direction against imagery or records)
are recorded in `docs/research-photoreal.md` §10 as the next data work.

### After the review's fixes (2026-10-30, later the same day)

Builder's own record of the re-render after the fixes above; the stills `docs/evidence/photo/prototype_frame_<n>.jpg`
and the video were re-rendered from this state.

| Check | Result | Detail |
|---|---|---|
| `npm run lint`, `npm test` | pass | 42 files, 286 passed, 2 expected fails (RL8, unchanged); new tests for `groundAt`, `shotSpecAt`, `earthworksInRange` |
| The reel is unchanged (CL1, RG) | pass | `Section-maentwrog` frames 150 and 330 again byte-identical to `out/after` (`md5` 3b0668e6…, 8992834f…) after the `Lighting` change: the reel passes no `shadow` and keeps its values |
| RN6 per frame (`THREE_STATS`, whole frame) | within the call budget | rider's view 100 calls, 2,638,402 triangles; drone and follow frames 204 calls, 2,645,634 (the trees now reach 5 m from the line) |
| Visual check (builder; frames 60, 119, 150, 245, 330, 420, 520) | pass | shadows start at feet and wheels with no acne on the ground, the deck or the parapets; grass stands on the verges; the trackbed runs between trees in the rider's view; the earthwork legend line shows on the drone frames only; the four legend lines fit the box; no caption overlaps (a bottom-centre caption did, and was replaced by the legend line) |
| RN2 determinism, frames 60 (drone, the earthwork line) and 245 | pass | byte-identical between two fresh CLI processes (`md5` 898e1fd5… and e0dd69ec…) |
| RN3 format | pass | `ffprobe`: h264, 1920×1080, 30/1, 600 frames; 25.3 MB |
| RN5b blank scan | pass | 600 frames, centre-crop mean luma 99.8–120.8 |
| Render time | pass | 600 frames in 20.6 s wall, 60.2 s CPU (0.034 s/frame; up from 13.6 s: the trees now stand close to the camera in the rider's view and the follow shot, and the close shadow map is re-fitted per frame) |
