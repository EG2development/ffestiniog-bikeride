# 1. Use @remotion/three's ThreeCanvas for 3D, alongside the 2D video

Date: 2026-10-25

Scope: `src/Root.tsx`, `src/scenes3d/`, `package.json`

## Status

Proposed

## Relations

Amended by: [19. Pass --gl=angle per 3D render, never globally](0019-gl-angle-per-render.md)

Nothing in this ADR has been built yet. Two parts have moved on since it was
written: the global `setChromiumOpenGlRenderer('angle')` called for below is
replaced by ADR 19, and the detailed POC acceptance criteria now live in the
spec (docs/spec-3d.md).

## Context

The mission brief ("Realistic 3D Cycling Route Animation — Three.js +
Remotion") asks for a more realistic 3D terrain/trail render than the
current project delivers. Today this repo is a **Remotion-only** 2D project:
`src/CyclingVision.tsx` sequences 8 scenes (`src/scenes/`) built from
`RouteStage`/`MapBasemap`/`Cyclist`/`ElevationStrip`, driven by real GIS data
(`data/railway-route.geojson`, `data/waypoints.json`,
`data/elevation-profile.json` — see `data/source-register.md` for
provenance) through `src/data/route.ts` (`buildRouteModel`) and
`src/data/RouteDataProvider.tsx`. That 2D video already renders correctly —
see `out/trawsfynydd-cycle-vision.mp4`.

This ADR covers only **Phase 1 (validate the ground to build on) and a
Phase 2 spec** for a small Three.js proof-of-concept. It does not cover
building the full 3D video (mission goal deliverables beyond the POC).

## Decision

Use **`@remotion/three`'s `<ThreeCanvas>`**, added alongside (not replacing)
the existing 2D composition, in a new, separate Phase-2 proof-of-concept
scene. The 8 existing 2D scenes, the data layer, and the evidence register
are kept as-is.

### Compatibility finding (cited, checked 2026-10-25)

| Check | Result | Source |
|---|---|---|
| `@remotion/three` version | `4.0.538` exists and version-locks to `remotion: "4.0.538"` exactly (our installed version) | `npm view @remotion/three@4.0.538 peerDependencies` |
| React peer range | `@remotion/three` needs `react >=16.8.0`; `@react-three/fiber@latest` (9.8.2) needs `react: '>=19 <19.4'`. Our installed `react@19.2.3` satisfies both. | `npm view` on both packages |
| Three.js peer range | `@remotion/three` needs `three >=0.137.0`; latest `three` is `0.186.1`. Satisfied. | `npm view three@latest version` |
| **Render-loop safety (goal §7)** | `<ThreeCanvas>` **forces `frameloop` to `'never'`** regardless of what's passed — the scene only re-renders via Remotion's own `advance()`, synced to `useCurrentFrame()`. R3F's `useFrame` must not be used for animation; animation must be declarative (driven by the current frame), so pausing/scrubbing/rendering stay deterministic. This directly satisfies the "no uncontrolled real-time loop" requirement. | https://www.remotion.dev/docs/three-canvas.md |
| Sequence nesting | A `<Sequence>` renders a `<div>` by default, which `<ThreeCanvas>` doesn't allow — any `<Sequence>` inside it needs `layout="none"`. | same |
| GL renderer | Needs `Config.setChromiumOpenGlRenderer('angle')` in `remotion.config.ts` for correct rendering (the config file doesn't apply to direct Node.js render API calls — those need `chromiumOptions: { gl: 'angle' }` passed explicitly, not relevant since this project renders via the CLI). | https://www.remotion.dev/docs/three.md |
| Install | `npm i three @react-three/fiber @remotion/three @types/three` (not yet run) | same |

**Conclusion: compatible.** No version conflicts found; the render-loop risk
flagged in the mission guidance is structurally addressed by `ThreeCanvas`
itself, not something we need to work around separately.

## Kept vs. added

**Kept, unchanged:**
- All 8 existing 2D scenes (`src/scenes/Scene1Intro.tsx` … `Scene8FutureVision.tsx`) and `src/CyclingVision.tsx`.
- `src/data/route.ts` (`buildRouteModel`, `project()`, `pointAtT()`), `RouteDataProvider.tsx` — the Three.js POC reuses these, it does not reimplement coordinate math.
- `data/*.geojson/.gpx/.json` and `data/source-register.md` as the single source of truth.
- `public/maps/tiles/` (OpenTopoMap basemap) for the 2D scenes.

**Added (Phase 2 POC only):**
- `three`, `@react-three/fiber`, `@remotion/three`, `@types/three` as dependencies.
- One new, separate Remotion composition (not wired into `CyclingVision`) containing a single `<ThreeCanvas>` scene, 10–15s, showing the route as a 3D tube/line over a plane positioned via the **same** `project()` function the 2D map already uses.
- `Config.setChromiumOpenGlRenderer('angle')` in `remotion.config.ts`.

## Known data gaps carried forward (not re-solved here)

Per `data/source-register.md`, unchanged by this ADR — any Phase-2+ 3D
terrain work must keep these visible as caveats, not silently upgrade them
to survey-grade just because they're rendered in 3D:
- One short OSM way (id `270718795`, near Trawsfynydd Lake Halt) didn't
  connect to its neighbours — dropped from the stitched line, not yet
  manually verified against aerial imagery.
- The stitched route start sits ~214m from the Blaenau Ffestiniog station
  coordinate (goods-yard throat vs. passenger platform).
- No bridge/tunnel/cutting/embankment inventory exists yet. Coflein
  (RCAHMW) and NLS historical OS 1:25,000 mapping are the suggested next
  sources — not yet queried.
- Elevation is DEM-sampled (Copernicus GLO-90), not surveyed; raw per-node
  ascent/descent is noisy (see `elevation-profile.json`'s documented
  smoothing). A 3D terrain mesh built directly from raw per-node elevation
  would visibly show this noise as jitter — the POC's acceptance criteria
  below require using the already-smoothed profile, not raw samples.

## Phase 2 POC acceptance criteria (testable)

A proof-of-concept, **not** the final 3D video. Scope: one new composition,
10–15 seconds, additive only.

1. `npm i three @react-three/fiber @remotion/three @types/three` installs
   without peer-dependency errors.
2. A new composition (e.g. `ThreeTerrainPOC`) renders via
   `npx remotion still`/`render` without throwing.
3. The POC's `<ThreeCanvas>` has `frameloop` confirmed `'never'` at runtime
   (no `useFrame`-driven animation) — all motion comes from `useCurrentFrame()`.
4. The 3D route path is derived from `buildRouteModel().project()` /
   `routePoints`, not hand-authored coordinates — i.e. the same x/y the 2D
   map uses, extruded with z from the already-smoothed
   `elevation-profile.json`, not raw per-node DEM samples.
5. **Render determinism smoke test**: rendering the same frame (e.g. frame
   100 of the POC) twice via `npx remotion still` produces byte-identical
   PNGs. This is the concrete, scriptable form of "the render loop is
   controlled, not real-time/nondeterministic."
6. `npm run lint` and `npm test` both pass, including the existing
   `tests/route.test.ts` geo-projection suite (unmodified — the POC must not
   need to change `buildRouteModel`'s contract).
7. The existing `CyclingVision` composition still renders unchanged
   (regression check — this work is additive, nothing in `src/scenes/` or
   `src/CyclingVision.tsx` is touched).
8. `data/source-register.md`'s gap list is referenced (not silently
   dropped) in whatever doc/comment describes the POC's terrain limitations.

## Rejected alternatives

- **Raw `@react-three/fiber` `<Canvas>` without `@remotion/three`**: rejected
  — a plain R3F canvas defaults to a real-time `requestAnimationFrame` loop
  decoupled from Remotion's frame capture, which is exactly the
  nondeterministic-render risk the mission guidance and goal §7 warn
  against. `ThreeCanvas` exists specifically to solve this.
- **Hand-coding a separate coordinate projection for the 3D scene**:
  rejected — would let the 2D map and 3D scene silently drift apart over
  time. The POC must reuse `buildRouteModel().project()`.
- **Building directly from raw per-node elevation**: rejected for the POC —
  the known DEM noise (see Known data gaps) would show up as visible jitter
  in a 3D mesh; use the already-smoothed `elevation-profile.json` instead,
  and flag (don't hide) that it's still not survey-grade.

## Open risks (from mission guidance, status noted)

1. No test suite existed before this ADR — **addressed**: `vitest` +
   `tests/route.test.ts` added, `npm test` script added, mutation-checked
   (see commit history / this session: `metersPerDegLat` was temporarily
   zeroed, confirmed 1 of 6 tests failed, reverted, confirmed 6/6 pass again).
2. Render-loop risk — **addressed** by `ThreeCanvas`'s forced `frameloop:
   'never'`, confirmed above against the official docs.
3. Dirty `main` / untracked state dirs — **not addressed by this ADR**; no
   git branching or worktrees were used for this phase (done directly,
   per the "do the work directly" choice), so this risk didn't materialize,
   but it still applies if a future phase moves to branches/worktrees.
4. GIS gaps carried forward — **addressed** by the explicit callout above;
   not re-solved, intentionally.
5. Scope — this ADR is Phase 1 + a Phase 2 **spec**, not the POC build or
   final video. Phase 2 implementation (actually installing the three.js
   packages and building `ThreeTerrainPOC`) is a separate, not-yet-started
   piece of work.
