# Validation log: the photoreal layer (ADRs 54–60)

The photoreal prototype's records (`Poc3DMaentwrogPhoto`; `docs/design-photoreal.md`, `docs/research-photoreal.md`), kept
apart from `docs/validation-3d.md` as the POC and reel records are (`docs/validation-poc.md`, `docs/validation-reel.md`).
Since the reel moved to the photo look (ADR 60) its records, and `npm run test:render`'s appended reports, are here too.
The independent review's own report is `docs/evidence/photo/independent-review-2026-10-30.md`.

## Photoreal prototype (ADRs 54–58, 2026-10-29)

Builder's own record; the independent review of the V rows (spec X4) ran the next day (below). Measurements
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

## The reel in the photo look (ADR 60, 2026-10-30)

Builder's own record, on the dirty worktree of `mission/3d-reel` (HEAD `8d925e8`); nothing committed or pushed;
`tests/baselines/` untouched (X2). The owner asked for every part of the reel to look like `Poc3DMaentwrogPhoto`.

**Data built** (network: the lidar COGs, the OSM API, and for the image the Earth Search STAC API and the
`sentinel-cogs` open-data bucket; all four allowlisted, RL30): canopy grids for blaenau (19.5 % of cells ≥ 2 m),
vale-north (15.5 %), vale-south (21.5 %), trawsfynydd (11.4 %) and the corridor at 16 m (17.4 %); boundaries for
blaenau (151 ways), vale-north (108), vale-south (30), trawsfynydd (134) and the corridor (478); the corridor rebuilt
with OSM (939 roads, 38 water bodies, land cover by node; 434 lake cells filled at their shore level; 13 bridges and 16
overbridges interpolated in its trail profile; existing lake levels unchanged, one new: way/271072334 at 447.76 m);
Sentinel-2 scene S2C_30UVD_20250712_0_L2A sampled on the corridor's grid at 8 m (451 × 1383, 2 tiles read). The image
lines up with OSM's lake outlines; its water nodes are under half as bright as its land nodes (tested).

| Check | Result | Detail |
|---|---|---|
| `npm run lint`, `npm test` | pass | 44 files, 316 passed, 2 expected fails (RL8, unchanged); new `tests/three-core/reel-photo.test.ts` (18 tests), occlusion in both looks (10), 6 new unit tests in `trees-canopy.test.ts`, the three photo scripts' self-tests |
| The concept look unchanged by the photo extras | pass | every reel section: the same trees, roads, water, bridges and terrain colours as its config without them, and no grass, boundaries, walkers or image (tested); 132 of the 139 regenerated concept stills and masks byte-identical to the 26 Oct set (`out/after-2026-10-26/`). The other seven are the aerials, whose corridor data were rebuilt: overview 19.8 % of pixels changed by a mean of 0.52 levels (sub-pixel shifts of the map's lines as the pull-back's start height follows the new profile, and one crossing), heritage 5.0 % / 0.25, intro 1.4 % / 0.07, closing 0.00 % |
| Walkers (C9) | pass | 1–3 per ground scene, each met or overtaken in the follow shot, ≥ 0.9 m from the rider's line, ≥ 2.5 m from the camera, never crossing another walker (tested on each real trail) |
| CL5 in the photo look | pass | no tree crown between the camera and the rider in any frame of the five ground scenes |
| CL6 one look (the photo reel's aerials against its ground scenes) | pass (after a regrade) | the render checks' CL6 row measures the concept look's stills (`stills.mjs` pins it); this row is CL6's own method (`still_metrics.py`'s circular mean hue and mean saturation over each still's terrain mask) on photo-look stills and masks of the same 15 frames (`out/photo-cl6/`). With the first grade (saturation 1.3, tint 1.25/1/0.8) it **failed**: aerial hue 84.6° against the ground's 62.2° (36.2 %), saturation 7.0 %. With saturation 1.1 and tint 1.6/1/0.7: aerial 67.8° against 62.2° (9.0 %), saturation 0.282 against 0.277 (1.8 %) |
| CL10 legend lines (second run, below) | FAIL, then fixed | the photo legend had four lines on Blaenau and Maentwrog frames (bridge, earthwork, "People: illustrative", "Verges levelled and cleared for the concept"); the last two are now one line, `PHOTO_LEGEND.ground` (tested: at most three lines, each ≤ 70 characters; no reel section draws translucent buildings, the only other line) |
| RL24 first run (below) | FAIL | the intro's scene pass at 3.42 M triangles (the corridor's trees and their trunks, each drawn again for the shadow map); Trawsfynydd's at 2.35 M was not reached by the check, which stops at the first frame over |
| The three fixes (ADR 60) | byte-identical | aerial trunks dropped (the only visible change: trunks under a pixel); then `treesInShots` and the terrain tiles: five reference frames (reel 100, 1500, 2050, 2600 and the prototype's 245) rendered with the same md5 before and after each |
| Scene pass after the fixes (second run, below: worst frame 600 at 1.69 M) | within RL24 | intro/heritage/overview 1.65–1.69 M (20,000 trees per kind restored), closing 1.28 M, blaenau 1.20 M, vale-north 1.05 M, vale-south 1.31 M, Maentwrog 1.43 M, Trawsfynydd 1.48–1.60 M; at most 154 calls |

**Visual review** (stills in `out/photo-reel/`, not committed): the ground scenes read as the prototype does (lidar
trees, walls and hedges, grass, gravel trail, walkers, tarmac roads, buildings with stone relief, a lake that mirrors
the sky). The aerials are the photo views over the satellite's colours: fields, woods and moorland where the satellite
saw them, walls and roads as lines, lidar trees with shadows; they are softer than the ground scenes, as a 10 m pixel
is 30–40 screen pixels at the intro's distance (design risk K21).

### Render checks 2026-10-30T10:39:51.913Z (darwin-arm64; snapshot tree fb6aa55fc8bf, dirty, untracked ea727cf037ac)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 45.9–82.4 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104318 tris; f45: 65 calls, 1104318 tris; f180: 65 calls, 1104318 tris; f210: 65 calls, 1104318 tris; f359: 65 calls, 1104318 tris |
| RN5b terrain drawn at frame 0 | pass | 257 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 82 s (0.0302 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 96.9–136.5 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | FAIL | frame 100: 43 calls, 3422142 triangles |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 427, heritage 2109, overview 1426, blaenau 275, vale-north 231, vale-south 402, maentwrog 311, trawsfynydd 268, closing 2257 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | pass | 22 boxes at 6 frames, max 2 lines |
| RD6 no missing map tiles in the reel | pass | 1 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 43 fresh stills (9 sections x 3, 8 cuts x 2): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet HEAD -- tests/baselines; no untracked file there |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on fb6aa55fc8bf; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.11 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | pass | CL2 x1.91-x3.72 (11 stills); CL3 max change 9.5 % (15 stills) |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.9 vs 86.6 (2.0 %), saturation 0.404 vs 0.453 (10.9 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

### Render checks 2026-10-30T11:06:59.874Z (darwin-arm64; snapshot tree 27d37d33b904, dirty, untracked 21a1b49c25a7)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 45.9–82.4 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104318 tris; f45: 65 calls, 1104318 tris; f180: 65 calls, 1104318 tris; f210: 65 calls, 1104318 tris; f359: 65 calls, 1104318 tris |
| RN5b terrain drawn at frame 0 | pass | 257 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 82 s (0.0303 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 96.9–136.5 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 600: 39 calls, 1688385 tris (scene pass); whole frame at most 3029098 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 420, heritage 393, overview 388, blaenau 569, vale-north 586, vale-south 557, maentwrog 559, trawsfynydd 443, closing 480 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | FAIL | Reel3D@900 legend (1401,98,423x109, 4 lines); Reel3D@1750 legend (1404,98,420x109, 4 lines) |
| RD6 no missing map tiles in the reel | pass | 1 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 43 fresh stills (9 sections x 3, 8 cuts x 2): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet HEAD -- tests/baselines; no untracked file there |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on 27d37d33b904; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.11 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | pass | CL2 x1.91-x3.72 (11 stills); CL3 max change 9.5 % (15 stills) |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.9 vs 86.6 (2.0 %), saturation 0.404 vs 0.453 (10.9 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

### Render checks 2026-10-30T11:28:30.728Z (darwin-arm64; snapshot tree e36d647dd05d, dirty, untracked e397f19197d2)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 45.9–82.4 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104318 tris; f45: 65 calls, 1104318 tris; f180: 65 calls, 1104318 tris; f210: 65 calls, 1104318 tris; f359: 65 calls, 1104318 tris |
| RN5b terrain drawn at frame 0 | pass | 257 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 81 s (0.0301 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 96.9–139.5 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 600: 39 calls, 1688385 tris (scene pass); whole frame at most 3029098 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 377, heritage 381, overview 358, blaenau 569, vale-north 586, vale-south 557, maentwrog 559, trawsfynydd 443, closing 449 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | pass | 80 boxes at 24 frames, max 3 lines |
| RD6 no missing map tiles in the reel | pass | 1 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 43 fresh stills (9 sections x 3, 8 cuts x 2): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet HEAD -- tests/baselines; no untracked file there |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on e36d647dd05d; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.11 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | pass | CL2 x1.91-x3.72 (11 stills); CL3 max change 9.5 % (15 stills) |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.9 vs 86.6 (2.0 %), saturation 0.404 vs 0.453 (10.9 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

## Walkers, runners and prams at random (ADR 61, 2026-10-30)

The reel's ground scenes draw their people (`photo.people`); the prototype keeps its three walkers. The draw placed 24:
blaenau 3 runners and 2 prams; vale-north 2 runners and 2 prams; vale-south a pair of walkers, a runner and a pram;
maentwrog 2 walkers, 2 runners and a pram; trawsfynydd 3 walkers (a pair among them), 2 runners and a pram. The rider
meets or overtakes a runner in Blaenau (frame 143), Vale north (213) and Maentwrog (184), a walker in Maentwrog (342),
and a pram (222) and three walkers (419, 440) in Trawsfynydd.

| Check | Result | Detail |
|---|---|---|
| `npm run lint`, `npm test` | pass | 43 files, 321 passed, 2 expected fails; runner and pram figures, paces and strides (`walkers.test.ts`); per scene the same draw twice, a runner and a pram, and every placement rule checked at every frame independently of the placer (`reel-photo.test.ts`) |
| Rules tried and dropped | recorded | a 4 m camera distance, then keeping people out of the follow camera's view nearer than 6 m or 4.5 m: each left the rider meeting nobody in four of five scenes; passers may sweep past the frame's lower edge (ADR 61) |
| Render checks (below) | pass | all 23; reel 2,700 frames in 126 s (81 s before: the draw and the extra figures); worst scene pass 1.69 M triangles (the overview, unchanged), Trawsfynydd about 170 calls; legend at most 3 lines |

### Render checks 2026-10-30T13:10:13.674Z (darwin-arm64; snapshot tree 685c2191d115, dirty, untracked c213aeeb7f96)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.03 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 45.9–82.4 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104318 tris; f45: 65 calls, 1104318 tris; f180: 65 calls, 1104318 tris; f210: 65 calls, 1104318 tris; f359: 65 calls, 1104318 tris |
| RN5b terrain drawn at frame 0 | pass | 257 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 126 s (0.0465 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 96.9–139.5 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 600: 39 calls, 1688385 tris (scene pass); whole frame at most 3137210 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 377, heritage 381, overview 358, blaenau 569, vale-north 586, vale-south 557, maentwrog 559, trawsfynydd 443, closing 449 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | pass | 80 boxes at 24 frames, max 3 lines |
| RD6 no missing map tiles in the reel | pass | 1 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 43 fresh stills (9 sections x 3, 8 cuts x 2): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet HEAD -- tests/baselines; no untracked file there |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on 685c2191d115; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.11 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | pass | CL2 x1.91-x3.72 (11 stills); CL3 max change 9.5 % (15 stills) |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.9 vs 86.6 (2.0 %), saturation 0.404 vs 0.453 (10.9 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

### Render checks 2026-10-30T18:05:40.453Z (darwin-arm64; snapshot tree 78597670ec39, dirty, untracked e4ea0f8ff4a1)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 45.9–82.4 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104558 tris; f45: 65 calls, 1104558 tris; f180: 65 calls, 1104558 tris; f210: 65 calls, 1104558 tris; f359: 65 calls, 1104558 tris |
| RN5b terrain drawn at frame 0 | pass | 262 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 68 s (0.0253 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 97.4–138.9 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 600: 42 calls, 1713159 tris (scene pass); whole frame at most 3138580 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 413, heritage 407, overview 391, blaenau 598, vale-north 584, vale-south 561, maentwrog 576, trawsfynydd 443, closing 476 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | FAIL | Reel3D@900 legend (1300,98,524x109, 4 lines) |
| RD6 no missing map tiles in the reel | pass | 1 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 43 fresh stills (9 sections x 3, 8 cuts x 2): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet HEAD -- tests/baselines; no untracked file there |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on 78597670ec39; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | FAIL | trawsfynydd_60 specks 0.0114; trawsfynydd_60+1 specks 0.0117 |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | FAIL | intro_120 luma 10.4 % clipped 0.00 % |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 23.5, roads 39.3 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.8 vs 86.9 (2.4 %), saturation 0.402 vs 0.451 (10.8 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

### Render checks 2026-10-30T18:35:57.713Z (darwin-arm64; snapshot tree 20782b9df54b, dirty, untracked abe74759f6bc)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 45.9–82.4 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104558 tris; f45: 65 calls, 1104558 tris; f180: 65 calls, 1104558 tris; f210: 65 calls, 1104558 tris; f359: 65 calls, 1104558 tris |
| RN5b terrain drawn at frame 0 | pass | 262 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 105 s (0.0390 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 97.4–138.9 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 600: 41 calls, 1713097 tris (scene pass); whole frame at most 3138560 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 413, heritage 407, overview 391, blaenau 598, vale-north 584, vale-south 561, maentwrog 576, trawsfynydd 443, closing 476 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | pass | 80 boxes at 24 frames, max 3 lines |
| RD6 no missing map tiles in the reel | pass | 1 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 43 fresh stills (9 sections x 3, 8 cuts x 2): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet HEAD -- tests/baselines; no untracked file there |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on 20782b9df54b; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.11 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | FAIL | intro_120 luma 10.4 % clipped 0.00 % |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 23.5, roads 39.3 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.8 vs 86.9 (2.4 %), saturation 0.402 vs 0.451 (10.8 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

**CL3 at intro_120 (ADR 63, explained, not fixed):** the concept look's credit gained the OS licence notice ("Contains
OS data © Crown copyright and database right 2026") and now runs to two lines, so its dark box is taller. Measured on
the same before and after stills without the credit band (rows above 960 px), the luma change is 7.9 % (whole frame
10.4 %); no lighting changed. The other CL3 stills: closing 8.0 %, heritage 9.3 %, overview 8.8 %, maentwrog_150 9.0 %.
Options for the owner: accept it, shorten the concept credit to one line, or measure CL3 outside the overlay boxes.
