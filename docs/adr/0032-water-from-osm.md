# 32. Water surfaces from OSM polygons at the shore height

Date: 2026-10-25

Scope: `src/three-core/water.ts`, `src/three/WaterView.tsx`, `scripts/build_section_data.py`

## Status

Proposed

## Context

Scene 7 shows Llyn Trawsfynydd. A lidar DTM is noisy or has nodata over open water, and the proof-of-concept pipeline stops on nodata. Three's `Water` class adds a reflection pass, a second render of the scene per frame.

## Decision

Every OSM `natural=water`, `waterway=riverbank` or `landuse=reservoir` polygon of at least 1 ha inside a window becomes a water body: its outer ring is projected, and its surface sits at the shore height, the median DTM height along the ring. The pipeline replaces DTM nodata and outliers (cells more than 2 m from the shore median) inside the polygon with that height and records the count in the DEM header; the fill is registered as approximate. `WaterView` triangulates the outer ring with `ShapeUtils.triangulateShape` into a hand-built `BufferGeometry` (no holes) and offsets a normal pattern by a function of the frame number. No reflection pass in this mission.

## Consequences

- Lakes read as flat, lit water with frame-driven ripples; no reflections.
- The shore height is a DTM statistic, not a surveyed level.
- A reflection pass is a later ADR with its own budget check.

## Verification

RL14 (T, V); `tests/three-core/water.test.ts` (design D28).

## Relations

Related to: [12. Model only structures that have a cited source](0012-sourced-structures-only.md), [6. Use the Welsh lidar DTM](0006-welsh-lidar-dtm.md)
