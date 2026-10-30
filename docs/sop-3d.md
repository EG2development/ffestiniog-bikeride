# SOP: running and changing the 3D work

For the 3D upgrade of the cycling route video. Decisions: `docs/adr/`
(index in its README). What must be true: `docs/spec-3d.md`. How it fits
together: `docs/design-3d.md`.

Order for a fresh build of the 3D data: `python3 scripts/build_poc_data.py` (the POC
window the tests read), `npm run data:section -- <id>` for each of the six windows,
`npm run data:earthworks` and then `npm run data:earthworks -- --section <id>` for each of
the five ground windows, then the two building passes per ground window (step 3 under "Water,
readiness, clarity and buildings"), then `npm run data:sync`.

## Run

| Step | Command | Status |
|---|---|---|
| Install | `npm ci`, exactly as the lockfile says (the three.js packages are pinned per ADR 22; zod is overridden per ADR 25) | exists |
| Build the POC data (DTM window, land cover, trail profile, OSM features) | `python3 scripts/build_poc_data.py` (Python 3, numpy; network access to the lidar COG and the OSM API; about 20 s) | exists |
| Build a section's data for the reel (`Poc3DMaentwrog` also renders from the `maentwrog` window) | `npm run data:section -- <id>` (same requirements; 20–60 s each) | exists |
| Add the earthwork entries to the register | `npm run data:earthworks` for the POC window, `npm run data:earthworks -- --section <id>` for a ground window (uses the same TypeScript core as the video) | exists |
| Copy source data to the runtime folder | `npm run data:sync` (ADR 21) | exists |
| Lint and type-check | `npm run lint` | exists |
| Unit, static, docs and acceptance tests | `npm test` (needs Python 3 with numpy and Pillow: `tests/pipeline-python.test.ts` runs the pipeline self-tests) | exists; the acceptance tests run on the real data, and `tests/docs.test.ts` fails if `docs/design-3d.md` and the code drift apart |
| Render checks: 2D regression and full 2D md5; POC and reel determinism, format, blank frames, load per scene and before each cut, caption visibility; fresh-process stills per section and at each cut; overlay safe area and line counts; missing tiles; the before/after still metrics (water, trees, trail, one look); one preview still per scene in `out/previews/` | `npm run test:render` (about 10 minutes, or about 30 when it must re-render the 139 measurement stills because the code changed; needs `out/before-masks/`, Python with numpy and Pillow, and ffmpeg) | exists; appends results to `docs/validation-photoreal.md` since the reel moved to the photo look (ADR 60; earlier runs are in `docs/validation-3d.md`). Set `REMOTION_PORT` if 3517 is taken |
| Preview | `npm run dev`, then pick `CyclingVision` (2D), `Poc3DMaentwrog`, `Reel3D` or a `Section-<id>` (3D) | exists |
| Render the 2D video | `npx remotion render src/index.ts CyclingVision out/trawsfynydd-cycle-vision.mp4` | exists |
| Render the 3D POC | `npm run render:poc` (passes `--gl=angle`, ADR 19, and GPU encoding at 10 Mbit/s, ADR 53; needs the `maentwrog` window), or `npm run still:poc` for one frame | exists |
| Render the reel | `npm run render:reel` → `out/reel.mp4` in the photo look (ADR 60), or `npm run still:reel -- --frame=<n>` for one frame; add `--props='{"look":"concept"}'` for the first look | exists |

Never render 3D without `--gl=angle`, and never set the GL renderer in
`remotion.config.ts`. It changes the 2D video's pixels (ADR 19). For 3D video, also pass
`--hardware-acceleration=if-possible --video-bitrate=10M` (GPU encoding, ADR 53), never in the
config: the 2D video keeps software encoding, whose decoded md5 is its baseline.

## Change

**A decision.** Don't edit an existing ADR's decision.
1. Add a new ADR with the next number, status Proposed, and a `Supersedes: N` or `Amends: N` line.
2. Set the old ADR's status to Superseded, with a `Superseded by: M` line.
3. Add the new ADR to `docs/adr/README.md` and update the matching row in `docs/design-3d.md`.
4. If an acceptance criterion changes, amend its row in `docs/spec-3d.md` with an italic note naming the ADR.

**Accepting an ADR.** Someone other than its author changes the status to
Accepted, updates the `Date:` line, and records the review in
`docs/validation-3d.md`.

**Route, station or profile data.**
1. Edit the file in `data/`.
2. Run `npm run data:sync`.
3. Run `npm test` and `npm run test:render`.

If the 2D baselines change because the data changed on purpose, re-capture them only with a reviewer's sign-off recorded in `docs/validation-3d.md`.

**A rendered feature** (structure, road, label, vegetation): add it to the register
**before** rendering it (ADR 20): `data/features-<window>.json` for a reel window,
`data/features-3d.json` for the Maentwrog section (its window register is empty, ADR 40),
with `kind`, `category`, `source`, a `scenes` list naming `Reel3D` and `Section-<id>`, and
for a structure `fromKm`/`toKm` (it is drawn only when they fall inside the section's km
range). Ids are unique across all registers; the loader rejects a duplicate. A structure
needs an OSM way with a structure tag or a Coflein record (ADR 12). Anything approximate or
proposed is labelled on screen.

**An asset** (model, texture): put it under `public/3d/` and add a
`data/assets-3d.json` entry with source, licence and attribution. If the licence requires
attribution, add it to the on-screen credits.

**Another route section.** A section is a config entry, a data window, register
entries, captions and tests, not a copied composition (ADRs 27, 29, 36). Touch, in order:
1. `SECTIONS` in `scripts/build_section_data.py` (km range, COG level, kind, scenes), then
   build the window as in "Run".
2. `SECTIONS` in `src/three-core/sections.ts` (the `SectionConfig`), `SECTION_IDS` in
   `src/Root.tsx` (or no `Section-<id>` composition exists) and `REEL_SCENES` in
   `src/data/reel-timeline.ts` (a caption test requires every config to be in the reel).
3. Its captions in `src/data/reel-captions.ts`, named in the config's `captionIds`.
4. The window lists in `tests/three-core/sections.test.ts`,
   `tests/three-core/section-acceptance.test.ts` and `tests/reel-timeline.test.ts`; the
   budget table in `docs/spec-3d.md`; `SCENE_FRAMES`, `BEFORE_CUT`, `EXPECT_OVERLAY` and the
   BL13 window list in `scripts/render-checks.mjs`; `FRAMES` and `GROUND` in `scripts/stills.mjs`
   (then capture a new before set).

Don't edit `src/scenes/` or `src/CyclingVision.tsx` for 3D work (ADR 2).

**Upgrading Remotion.** Run `npx remotion upgrade`; it moves `@remotion/three`
with `remotion`. Check the other pins in ADR 22, then run every check above. If the new
Remotion depends on zod 4.6.6 or later, remove the `zod` override from `package.json`
(ADR 25); either way, `npm audit` should report no high-severity result. Until then, Remotion
warns "Version mismatch … zod" on every render; that warning is expected, so don't run the
`npx remotion add zod` it suggests.

## CI

`.github/workflows/ci.yml` runs on every push to `main`, on pull requests and on demand
(ADR 26). It runs on `ubuntu-24.04` with Node 24.13.1 and Python 3.13, and executes:
`npm ci --ignore-scripts` (the runner's npm 11.8.0 ignores `package.json`'s `allowScripts`, t12), `pip install numpy==2.4.4 pillow==12.1.0`, `npm run lint`, `npm test`, `npm audit --audit-level=high`, the BNG self-test
and a compile check of the seven pipeline scripts, and `npm run build`. A red run blocks the merge.

The render checks aren't in CI: their baselines are pixel hashes from the development Mac,
and the 3D renders need a GPU. Since the reel they also render the reel in full, check its
determinism, blank frames, per-scene and pre-cut load and caption visibility, and write the
previews; since reel v2 they also take fresh-process stills and the before/after metrics, so a run
takes 10–30 minutes. **Run `npm run test:render` locally before merging** any change to
`src/`, `public/data/`, `remotion.config.ts` or the Remotion and three.js versions, and add its
result to `docs/validation-3d.md` (the script appends it).

To check a workflow change before pushing, run its `run` steps in a clean copy of the files git
would ship, as a git checkout, on the runner's npm version, after a fresh `npm ci --ignore-scripts`. The t12 verifiers did exactly this; their logs are
`docs/evidence/t12-ci-local.log` (POC), `docs/evidence/t12-reel-ci-local.log` (reel) and
`docs/evidence/t12-reel-v2-ci-local.log` (reel v2, npm 11.8.0). Bump a
pinned action only to a release at least two weeks old,
and keep the comment with its version.

## The reel (ADRs 27–40; design D23–D36; spec RL1–RL34)

**Decision map.** D23 section config → ADR 27 · D24 master composition → 28 ·
D25 data windows → 29 · D26 sky and fog → 30 · D27 terrain shading → 31 · D28 water →
32 · D29 aerial tile drape → 33 · D30 cyclist from dims → 34 · D31 shot specs → 35 ·
D32 captions as data → 36 · D33 vegetation near zone → 37 · D34 labels from curated
files → 38 · D35 performance at cuts → 39 · D36 Maentwrog first → 40.

**Run.**
1. Build a section's data: `npm run data:section -- <id>` (ids: `corridor`, `blaenau`,
   `vale-north`, `vale-south`, `maentwrog`, `trawsfynydd`; network access to the lidar COG
   and the OSM API; about 20–60 s each). Then `npm run data:earthworks -- --section <id>`
   for a ground window, and `npm run data:sync`. The window's `osm.geojson` keeps only the
   tags the renderer reads (no addresses, house names, phone numbers or operators; ADR 38);
   `python3 scripts/build_section_data.py --strip-existing` re-applies that allowlist to the
   files on disk without fetching.
2. Preview one section: `npx remotion still src/index.ts Section-<id> out/<id>.png
   --frame=<n> --gl=angle` (section composition ids: `Section-intro`, `Section-heritage`,
   `Section-overview`, `Section-blaenau`, `Section-vale-north`, `Section-vale-south`,
   `Section-maentwrog`, `Section-trawsfynydd`, `Section-closing`), or `npm run still:reel --
   --frame=<n>` for a reel frame.
3. Render the reel: `npm run render:reel` (2,700 frames; 33 s at t12, and the gate allows 2 s per frame). Then
   `npm run test:render` for the gates.

**Change.**
- *A section's content* (rider start, shots, features): edit its `SectionConfig` in
  `src/three-core/sections.ts`; the config test (RL4), the window tests (RL5, RL6, RL8) and the
  caption test run on it; CA1–CA4 run on the Maentwrog scene.
- *The frame budget:* edit `src/data/reel-timeline.ts` **and** the budget table in
  `docs/spec-3d.md`; the RL2 test compares them. The sum must stay 2,700. A section's own
  `frames` and `shots` in `sections.ts` are a third input: a section longer than its reel
  slot is cut at the slot's end (Maentwrog keeps the POC's 360 frames in a 300-frame slot,
  ADR 40); no test ties the two.
- *A caption:* edit `src/data/reel-captions.ts`; never write caption text in a
  component (ADR 36). The ranges in spec RL17–RL22 are tested.
- *Sky, fog or the sun:* `src/three-core/atmosphere.ts`; the fog colour must stay
  equal to the horizon colour (ADR 30). A different sun supersedes ADR 18.
- *Terrain look:* `src/three-core/shading.ts` (ADR 31). A texture needs an
  `assets-3d.json` entry with its licence first.
- *Water:* `src/three-core/water.ts` (ADR 32); the surface is the body's level from `data/water-levels.json` (ADR 42), else the median of the rendered ground along its shore.
- *Trees:* `src/three-core/trees.ts` (ADR 37); keep the near-zone density inside
  1–15 per 100 m².
- *An on-screen label:* a register entry or a caption, never an OSM tag (ADR 38).
- *Every new ground object* states which height it uses (`heightAt`, the rendered
  ground, or `bareHeightAt`, the DTM) and applies `ve`.
- *Docs:* `tests/docs.test.ts` keeps the pure-core block of `docs/design-3d.md` equal
  to the exports, the tests table equal to the test files, and every `npm run` name
  real. When you add an export, a test file or a script, update the design in the
  same change.

## Water, readiness, clarity and buildings (ADRs 41–53; `docs/design-reel-v2.md` D37–D48; spec WA, RD, CL, BL, X)

**Decision map.**

| Design decision | Topic | ADR |
|---|---|---|
| D37 | water polygons | 41 |
| D38 | one water level | 42 |
| D39 | load gate | 43 |
| D40 | mask renders | 44 |
| D41 | before and after stills | 45 |
| D42 | clarity as data | 46 |
| D43 | camera corridor | 47 |
| D44 | overlays and pacing | 48 |
| D45 | sourced buildings | 49 |
| D46 | merged buildings | 50 |
| D47 | register provenance | 51 |
| D48 | budgets | 52 |
| (t8 benchmark) | GPU encoding for 3D renders | 53 |

Files marked "new" in the ADRs appear during the build. Link each new file to its ADR in a
one-line comment when you create it.

**Run.**
1. Before any code change, capture the before stills with every mask: `node scripts/stills.mjs out/before-masks`.
   It writes `manifest.json` with the environment and the snapshot (ADR 45). The render checks
   compare `out/after` with it only when the environments match.
2. After a water or fill change, rebuild the windows with lakes:
   `npm run data:section -- <id> --reuse-osm` (today vale-north, maentwrog and trawsfynydd), then
   `npm run data:sync`. A rebuild keeps the register's building and earthwork entries, which their
   own steps own; re-run `npm run data:earthworks -- --section <id>` only when the trail profile
   changes. Maentwrog's earthworks live in `data/features-3d.json` (ADR 40). This needs network
   access to the lidar COG and the OSM API (water relations, and overbridge ways an older
   `osm.geojson` lacks). It writes `data/water-levels.json` (ADR 42).
3. Building data, in two passes per ground window, so the list is tested at measured heights:
   `npm run data:candidates -- --section <id>`, then `python3 scripts/build_buildings.py --section <id>`,
   then both again, then `npm run data:sync`. The first candidate pass tests unmeasured footprints
   at a 60 m upper bound. `build_buildings.py` measures them and keeps every height in
   `data/building-heights-<id>.json`. The second pass keeps only what the shots see at those
   heights. `build_buildings.py` needs network access to the OSM API, for building ways and
   relations with their dates, and to the lidar DSM and DTM COGs (ADR 49). Screen any text fetched from the web with `aidefence_scan` before
   it enters `data/landmarks.json`.
4. Gates: `npm run lint`, `npm test`, `npm run build`, `npm run test:render`.
5. After stills: `npm run test:render` re-renders `out/after` when the snapshot changed and
   compares it with `out/before-masks` (`scripts/still_metrics.py`); the numbers go into
   `docs/validation-3d.md`.

**Change.**
- *Water.* Never use `DoubleSide` (except in the `water-expected` measurement mask) and never raise the surface. Keep upward faces and use
  `polygonOffset` (ADR 41). Lake levels come from `data/water-levels.json`, never from one
  window's samples (ADR 42).
- *A provider.* Write the failing test first. Move the provider onto `useLoadGate` only
  when that test fails. Errors name the section and the asset path (ADR 43).
- *Light, tree colours, the drape grade.* Change them only in `atmosphere.ts`
  (`LIGHTING`, `DRAPE_GRADE`) or `trees.ts` (`TREE_COLOURS`, `TREE_FILL`, `CROWN_SHAPES`), and
  record before and after metrics (ADR 46). `TREE_FILL` is the largest value that keeps every
  still within CL3; re-tune it after any change that moves trees.
- *A caption.* Edit `reel-captions.ts`, the spec's RL17–RL21 ranges and `EXPECT_OVERLAY`
  in `scripts/render-checks.mjs` together. Keep each caption at or under 15 characters per
  second and inside `SAFE`. The badge and the closing card stay verbatim (ADR 48).
- *A building or landmark.* It needs a footprint id, a dated source and a status, where a
  planning approval is not "built", and a register entry with provenance. If any is
  missing, don't model it (ADRs 49 and 51).
- *Budgets.* Measure again after each track. If a frame exceeds RL24, lower that
  section's tree cap first (ADR 52).

## The photoreal layer (ADRs 54–61; `docs/design-photoreal.md`; research in `docs/research-photoreal.md`)

**Decision map.** ADR 54 the look as a layer and the prototype · 55 post-processing · 56 the rider's view · 57 canopy
heights · 58 walls and hedges · 59 walkers · 60 the reel in the photo look, its aerials coloured by a Sentinel-2 image ·
61 walkers, runners and prams at random.

**Run.**
1. Per ground window, the two sourced extras (network: the lidar COGs and the OSM API, both allowlisted):
   `npm run data:canopy -- <id>` (DSM minus DTM on the window's grid) and `npm run data:barriers -- <id>` (OSM
   walls, hedges and fences, plus their `barrier` register entries), then `npm run data:sync`. Built for every reel
   window, the corridor included (ADR 60; its OSM land cover, roads and water come from
   `python3 scripts/build_section_data.py --section corridor`). The aerial ground image:
   `python3 scripts/build_imagery.py --section corridor` (network: the Earth Search STAC API and the scene's open-data
   bucket, both allowlisted; the scene is pinned in the script), writing `imagery.json` and `imagery.u8` straight
   into the window's folder.
2. Preview the prototype: `npm run dev`, composition `Poc3DMaentwrogPhoto` (20 s: aerial, rider's view, follow).
3. One frame: `npm run still:photo -- --frame=<n>`. The video: `npm run render:photo` (pass `--port=<free>` if the
   Studio holds 3000, as every render here does). Browser console (shader errors are not shown by the CLI): render
   through the Node API with `onBrowserLog`, as `scripts/render-checks.mjs` does.
4. Like-for-like stills from the reel's own cameras: `npx remotion still src/index.ts Section-<id> out/x.png
   --frame=<n> --gl=angle` (the photo look, the default), and the same frame with `--props='{"look":"concept"}'`. The
   concept look ignores the config's photo extras, so its stills match `out/after`.
5. Textures: run the fetch script (`docs/research-photoreal.md` lists the chosen CC0 files) into `public/3d/`, add
   each file to `data/assets-3d.json` (source, licence, attribution), name it by role in
   `src/three/photo/assetRoles.ts`, then `npm test` (the static test ties the roles to the register). A role without a
   file renders with its procedural stand-in.

**Change.**
- *The look's numbers* (exposure, AO, vignette, grass, barrier colours): `src/three-core/photoLook.ts`; the sky, the
  photo light and the close shots' shadow map: `SKY_PHOTO`, `LIGHTING_PHOTO` and `SHADOW_PHOTO_CLOSE` in
  `atmosphere.ts`; how close the trees come to the line: `photo.treeClearOfTrailM` on the config. Record before and
  after stills, and re-check the concept look's stills against `out/after` (they must stay byte-identical). The aerial
  image's grade (`IMAGERY_GRADE`) keeps the aerial scenes' hue and saturation near the ground scenes' (CL6): measure
  both after changing it, or the land-cover palette.
- *A shot for the prototype:* `PROTOTYPES["maentwrog-photo"]` in `sections.ts`; its shots must sum to its frames and
  pass `tests/three-core/first-person.test.ts`. Every reel section carries `SectionConfig.photo` (ADR 60); it is built
  in the photo look only, so changing it never moves the concept look's trees (`tests/three-core/reel-photo.test.ts`).
- *A new textured view* goes under `src/three/photo/`, takes its textures as props from `PhotoAssetsProvider`, and
  falls back to a colour or a stand-in when the role has no file.
- *A walker* (ADR 59) is one spec in a config's `photo.walkers` (`startDistM`, `direction`, `sideM` ≤ 1 m, `heightM`
  1.5–1.95, a seed no other walker uses). Choreograph it against the rider's table (print `distanceTable` for the
  config, as `tests/three-core/walkers.test.ts` does on the real trail), keep every walker behind the follow camera
  from its first frame, and add the section's `walkers-<window>` register entry (kind `walker`, decorative, with the
  conceptual-use note) to the composition's `FEATURE_IDS`.
- *The reel's people* (ADR 61) are a draw, not a list: `photo.people = { count, seed }` on a ground config. A new seed
  redraws the section's walkers, runners and prams; `tests/three-core/reel-photo.test.ts` checks every rule (inside the
  section, clear of the rider, the camera and each other, on screen within 40 m, a runner and a pram in each) on the
  real trail, whatever the draw. The share of each activity and the margins are constants in
  `src/three-core/people.ts`; paces, strides and figures in `walkers.ts`.
- *Tree sprites and card layout:* `TreesPhotoView`; keep the crowns inside `CROWN_SHAPES`, which the placer's
  sight-line and building rules use.

## Never

- Use `useFrame`, `requestAnimationFrame`, `setInterval`, `Date.now`, `performance.now` or unseeded `Math.random` in 3D code. Use `mulberry32` from `src/three-core/rng.ts` (ADRs 11, 17). The one exception is `src/three/photo/PostFX.tsx`'s single priority-1 `useFrame`, which takes the one render per frame over (ADR 55).
- Load a texture or sky image anywhere but `src/data/PhotoAssetsProvider.tsx`, or from a file that is not under `public/3d/` with an `assets-3d.json` entry (ADR 54).
- Hard-code latitude/longitude in `src/`. All coordinates go through `project()` (ADR 5).
- Read React context inside `<ThreeCanvas>` (ADR 4).
- Present a proposed or approximate feature without its on-screen label, or describe DEM or OSM data as survey-grade.
- Pass `mask` from `Reel3D` or a `Root.tsx` entry (ADR 44); model a building without a dated source (ADR 49); update `tests/baselines/` without the owner's sign-off.
