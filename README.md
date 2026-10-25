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
  `railway-route.gpx`, `waypoints.json`, `elevation-profile.json`, and
  `source-register.md` documenting where every figure came from and what's
  still unverified. **Source of truth** — after editing anything here, copy
  the changed file(s) into `public/data/` (the running video fetches from
  there, not from `data/` directly) before re-rendering.
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
do); see `docs/sop-3d.md`.

Checks:
- **CI** (`.github/workflows/ci.yml`) runs `npm run lint`, `npm test` (unit, static, docs
  and real-data acceptance tests), the dependency audit and the build.
- **Locally, before merging any change that can affect rendering:** `npm run test:render`
  (the 2D regression and 3D render checks).

Results, reviews and benchmarks are logged in `docs/validation-3d.md`, and the output of full
test runs is kept in `docs/evidence/`. The trail is a concept, not an approved route, and the
3D terrain and features are DEM- and OSM-derived, not survey-grade (`data/source-register.md`).

## Previewing and editing this video

```console
npm run dev
```

Then open the **CyclingVision** composition in Remotion Studio (there's also
a leftover default `MyComp` composition from the initial `remotion create`
scaffold — ignore it). Scene timing lives in one place,
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
