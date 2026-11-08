# 29. Terrain data in a window per section, plus a coarse corridor window

Date: 2026-10-25

Scope: `scripts/build_section_data.py` (generalises `build_poc_data.py`), `public/data/sections/`, `src/data/Scene3DDataProvider.tsx`

## Status

Proposed

## Context

Only the Maentwrog window (km 7.7–9.7) has lidar terrain and OSM data. The whole corridor at the 4 m level would be about 2.4 M triangles, over the RN6 budget, and the proof-of-concept pipeline hard-codes its window (`SECTION_M`) and its `-poc` file names.

## Decision

A `SECTIONS` table drives the pipeline: `corridor` km 0–13.24 at the **16 m** level for the aerial scenes 1, 2, 3 and 8; `blaenau` km 0–1.5, `vale-north` km 1.5–4.8, `vale-south` km 4.8–7.7 (with Llan Ffestiniog at km 5.33), `maentwrog` km 7.7–9.7 and `trawsfynydd` km 9.7–13.24 at the **4 m** level, each with a 600 m margin. Files go to `public/data/sections/<id>/`, and the window's register entries to `data/features-<id>.json`; the data provider takes a `section`, validates each file as it does now, and merges that register with `data/features-3d.json` (`mergeRegisters`). Scene 5 is two sequences (`vale-north` from frame 1080, `vale-south` from 1350) with a hard cut, so no shot crosses a window boundary.

## Consequences

- Five more lidar and OSM downloads, each a manual pipeline run over the network.
- The ground meshes are ≤ 1.61 M triangles (trawsfynydd, 788 × 1,023 nodes; vale-north 1.02 M), which is why trawsfynydd carries a lower tree cap (ADR 27, `maxTreesPerKind`); the corridor mesh is 310,950, under 400 k.
- Each DEM header records its level (`spacingM`), `source` and `crs`, plus the fill it received: `fill: {nodataBefore, waterShoreHeight, neighbourMean, note}` and `fallbackCells`.

## Verification

RL5, RL6, RL7 (T, D); per-window acceptance tests on the real data (design D25).

## Relations

Amended by: [42. One water level per water body, computed once](0042-one-level-per-water-body.md)

Amends: [7. Read the DTM by HTTP range requests](0007-range-read-dtm.md)
Related to: [6. Use the Welsh lidar DTM](0006-welsh-lidar-dtm.md), [21. Treat data/ as the source of truth, synced to public/data](0021-data-sync.md)
