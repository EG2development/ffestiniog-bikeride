# 57. Tree heights and field trees from the lidar canopy, when a section asks

Date: 2026-10-29

Scope: `scripts/build_canopy.py` (`npm run data:canopy`), `public/data/sections/<id>/canopy.{json,f32}`, `TreeOptions.canopy` in `src/three-core/trees.ts`, `validateCanopyHeader` in `src/three-core/registers.ts`, `Scene3DDataProvider` (`wants.canopy`), `SectionConfig.photo.canopyTrees`

## Status

Proposed

## Context

Trees are placed by a seeded draw inside OSM woodland polygons at a random size (ADR 11); OSM says where a wood is, not
how tall it is, and nothing is drawn outside the polygons, so a felled block of plantation gets trees and a hedgerow oak
in a field gets none. The project already reads the Welsh Government / NRW lidar DSM for building heights (ADR 49).

## Decision

`build_canopy.py` writes, per section window, the DSM minus the DTM on the window's own DEM grid (metres, clipped to
0–45 m, 0 where either is nodata), with a header that names both COGs, the licence and that the survey date is not
published with the COG. `validateCanopyHeader` refuses a grid that is not the DEM's.

Given `canopy`, `placeTrees`:

- keeps every woodland draw where it is (the main seeded stream is unchanged), skips a node whose canopy is under 3 m and
  scales the rest so the drawn crown reaches the measured height (`NOMINAL_TREE_HEIGHT_M`, scale 0.4–2.4);
- grows a broadleaf **field tree** outside OSM woodland where the canopy peaks at 6 m or more (a local maximum of its
  eight neighbours), from a second seeded stream keyed by node, so it never shifts the woodland draws;
- gives every tree a tint and a variant from a third stream keyed by node, read only by the photo look.

A section receives a canopy only when its config asks (`photo.canopyTrees`), so the reel's trees do not move.

## Consequences

- Tree positions and heights follow the survey: plantations read tall and even, scrub low, and field and hedgerow trees
  appear where they stand, within the 4 m grid. The tree register entry becomes "approximate (lidar-derived)" rather
  than decorative in the prototype.
- A tall non-tree (a pylon, a chimney) outside a building footprint would be drawn as a tree; the footprint rule (BL13)
  excludes buildings. The DSM's survey date was unknown when this was written (design risk K16); the tile catalogue
  dates the corridor's flights to 2022-01-11 (`data/source-register.md`), so the canopy is that winter's.
- One more file per window (1.4 MB for Maentwrog at 4 m), fetched from the same allowlisted host (RL30).

## Verification

`tests/three-core/trees-canopy.test.ts`; `python3 scripts/build_canopy.py --self-test`; the window's `canopy.json`
statistics in `docs/validation-photoreal.md`.

## Relations

Amends: [11. Place trees by seeded random inside OSM woodland](0011-seeded-trees-in-woodland.md), [37. Vegetation in a near zone](0037-vegetation-near-zone.md). Related to: [49. Buildings and landmarks from sourced data only](0049-buildings-from-sourced-data.md).
