# Trawsfynydd ↔ Blaenau Ffestiniog cycling concept video

An early-stage, concept-only animated proposal for repurposing part of the
disused Bala and Festiniog Railway corridor (Blaenau Ffestiniog ↔
Trawsfynydd) as a cycling/walking route. **Not an approved route, engineering
design, or confirmation of landowner agreement** — see
`docs/research.md` for the full research summary and limitations, including
why this corridor is not simply "abandoned" (it's a mothballed, Network
Rail-protected line with a repeated heritage-railway restoration history).

## What's in this repo

- `docs/research.md` — research summary: line history, current status,
  verified vs. proposed vs. unknown, and limitations.
- `docs/route-map.md`, `public/maps/route-preview.html` — a self-contained
  Leaflet map for sanity-checking the real alignment.
- `docs/storyboard.md` — the scene-by-scene plan behind `src/CyclingVision.tsx`.
- `data/` — the GIS pipeline's outputs: `railway-route.geojson`,
  `railway-route.gpx`, `waypoints.json`, `elevation-profile.json`, the 3D registers
  `features-3d.json`, `features-<window>.json` and `assets-3d.json`, and
  `source-register.md` documenting where every figure came from and what's
  still unverified. **Source of truth** — after editing anything here, run
  `npm run data:sync` to copy it into `public/data/` (the running video fetches from
  there, not from `data/` directly; a static test fails if the two differ) before re-rendering.
- `src/data/route.ts` — turns the raw GIS files into a stylised 2.5D
  world-space model (projection, distance, elevation lookups). Read via the
  `useRouteData()` hook (`src/data/RouteDataProvider.tsx`), which fetches the
  `public/data/*.json` files at render time.
- `src/components/` — `RouteStage` (camera/viewBox), `MapBasemap` (real
  OpenTopoMap tiles, two zoom tiers, aligned to the route via the shared
  projection), `Cyclist`, `Caption`, `ElevationStrip`.
- `src/scenes/` — one file per storyboard scene; `src/CyclingVision.tsx`
  sequences them with `<Series>`.

## 3D work (in progress)

A Three.js upgrade is being added alongside the 2D video, not in place of
it. Start with `docs/sop-3d.md` (how to run and change it), then
`docs/adr/README.md` (one record per decision), `docs/spec-3d.md`
(requirements and acceptance criteria) and `docs/design-3d.md` (modules and
interfaces). The full brief is `docs/mission-3d-brief.md`.

The first 3D piece is a 12 s proof of concept on the Maentwrog Road section,
composition `Poc3DMaentwrog`: `npm run render:poc` writes
`out/poc-maentwrog.mp4`. Always render 3D with `--gl=angle` (the npm scripts
do); see `docs/sop-3d.md`. `render:poc` and `render:reel` also encode on the GPU (VideoToolbox)
where it exists, in software elsewhere, at 10 Mbit/s; the 2D video keeps software encoding so its
md5 baseline holds (ADR 53).

The reel, composition `Reel3D`, is the 1:30 concept film: 2,700 frames at 30 fps, 1920 × 1080,
nine sections from Blaenau Ffestiniog to Trawsfynydd, each built by one assembly from its
`SectionConfig` in `src/three-core/sections.ts` on a lidar window under
`public/data/sections/<window>/` (the four aerial sections share `corridor`), built by
`npm run data:section -- <window>`, with its register `data/features-<window>.json`. The ground
windows' buildings come from OSM footprints with lidar heights: run
`npm run data:candidates -- --section <window>`, then `python3 scripts/build_buildings.py --section <window>`,
then both again, so every footprint is tested at its measured height (`docs/sop-3d.md`). `npm run render:reel`
writes `out/reel.mp4`; `npm run still:reel -- --frame=<n>` renders one frame; every section is
also registered as `Section-<id>` for stills. Captions are data in `src/data/reel-captions.ts`
and the frame budget in `src/data/reel-timeline.ts`.

**Photoreal prototype (2026-10-29, ADRs 54–59) and the reel in its look (ADR 60).** `Poc3DMaentwrogPhoto` is a 20 s proof of a more lifelike look on
the Maentwrog window: an aerial establishing shot, the rider's own view at handlebar height, and a follow shot across
the OSM bridge. It is the same scene and data with a `look: "photo"` layer: detail-textured terrain by land cover and
slope, a gravel trail, stone bridge, card trees sized from the lidar canopy (`npm run data:canopy -- <window>`),
OSM drystone walls and fences (`npm run data:barriers -- <window>`), grass, three walkers sharing the path in the
rider's view (ADR 59, conceptual), a cloud sky that lights the scene, and a post pass (ambient occlusion, AgX tone
mapping). `npm run render:photo` writes `out/poc-maentwrog-photo.mp4`;
`npm run still:photo -- --frame=<n>` one frame. Since 2026-10-30 the reel is drawn in this look too (ADR 60): every
ground section with its own lidar trees, walls, grass, and walkers, runners and people pushing prams placed by a
seeded draw (ADR 61), and the aerial sections over the corridor's OSM
cover and lidar canopy, coloured by a Sentinel-2 image (`python3 scripts/build_imagery.py --section corridor`; the
attribution carries the Copernicus notice). `--props='{"look":"concept"}'` renders the first look, unchanged. How it
was chosen, what it costs and what is still generic: `docs/research-photoreal.md`, `docs/design-photoreal.md`,
`docs/sop-3d.md`. A native Blender build of the film is planned and specified, not built: `docs/blender-build-plan.md` (phases and
readiness checklist), `docs/design-blender.md` (the export package, coordinate mapping, Blender 5.2 import recipes and
render preset) and `docs/research-blender.md` (the verified research; ADR 62).

Checks:
- **CI** (`.github/workflows/ci.yml`) runs `npm run lint`, `npm test` (unit, static, docs
  and real-data acceptance tests), the dependency audit, the Python pipeline's self-test and
  compile check, and the build.
- **Locally, before merging any change that can affect rendering:** `npm run test:render`.
  It runs the 2D regression and the full 2D md5, the POC and reel checks (a full reel render,
  blank-frame scan, determinism, load per scene and before each cut, caption visibility),
  fresh-process stills per section and at every cut, the overlay safe-area and missing-tile
  checks, and the before/after still metrics (water, trees, trail, one look) against
  `out/before-masks/`. When the code has changed it re-renders the measurement stills with
  `node scripts/stills.mjs out/after` (139 stills). It needs Python with numpy and Pillow, and
  ffmpeg; it writes one preview still per scene to `out/previews/` and appends its results to
  `docs/validation-3d.md`.

Results, reviews and benchmarks are logged in `docs/validation-3d.md`, and the output of full
test runs is kept in `docs/evidence/`. The trail is a concept, not an approved route, and the
3D terrain and features are DEM- and OSM-derived, not survey-grade (`data/source-register.md`).

## Previewing and editing this video

```console
npm run dev
```

Then open the **CyclingVision** composition in Remotion Studio. The 3D compositions are
there too: `Poc3DMaentwrog`, `Reel3D`, `Section-intro` … `Section-closing` and
`Poc3DMaentwrogPhoto`. Scene timing lives in one place,
`src/data/timeline.ts`, so re-pacing the cut doesn't mean hunting through
every scene file.

## Rendering

```console
npx remotion render src/index.ts CyclingVision out/trawsfynydd-cycle-vision.mp4
```

1920×1080 at 30fps by default (per `src/Root.tsx`); pass `--width`/`--height`
to render at a different resolution (e.g. 4K) for the same composition.

## Current state / what's not done yet

The video now renders over a real OpenTopoMap basemap (see
`data/source-register.md` for the tile pipeline and required attribution,
which is already burned into every scene). Still not done: a stylised
"designed" landscape look beyond the real map tiles (brief wanted an
original stylised environment, not just a real map); the visual-reference
catalogue (brief deliverable #3); narration/audio; and the cyclist icon is a
simple line-art placeholder. See `docs/research.md` §8 (Limitations) for the
data-side gaps.

---

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i --loglevel=error
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
