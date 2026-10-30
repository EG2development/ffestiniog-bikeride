# 42. One water level per water body, computed once

Date: 2026-10-25

Scope: `scripts/build_section_data.py`, `scripts/osm/fetch_bbox.py`, `data/water-levels.json` (new), `src/three-core/water.ts`

## Status

Proposed

## Context

Llyn Trawsfynydd spans lon −3.9742 to −3.9222 and lat 52.8940 to 52.9264. That is wider than the trawsfynydd window, and the maentwrog window sees only its northern tip.

Each window computed its own shore median, so the two disagreed: 197.2 m and 197.7 m (t14). The fill also levelled island cells to the lake, and the bounding-box fetch drops inner rings it cannot close (`fetch_bbox.py:41`), so the maentwrog copy has no islands.

## Decision

For each water body of at least 1 ha that touches a ground window, the pipeline reads the lidar DTM at the 4 m level over the body's bounding box. It takes the median along the full outer ring, holes excluded, and writes it to `data/water-levels.json`. Every window's fill and the runtime use that level.

The fill flattens only cells inside the outer ring minus its holes. Water relations whose rings cross a window edge are completed with `/api/0.6/relation/<id>/full` on the already allowlisted OSM host. The trawsfynydd and maentwrog windows are rebuilt.

## Consequences

- One lake has one surface in every window, and islands keep their lidar height.
- The rebuild needs network access to the two allowlisted hosts. It overrides the spec's no-fetch default, because the island terrain has to be re-read anyway.
- The RL5 and RL8 figures for the two rebuilt windows change and are recorded again.

## Verification

Spec WA4 and WA5; the RL5 and RL8 tests re-run; design D38.

## Relations

Amends: [29. Terrain data in a window per section, plus a coarse corridor window](0029-terrain-windows-per-section.md), [32. Water surfaces from OSM polygons at the shore height](0032-water-from-osm.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- Every water multipolygon relation in a ground window is replaced by `/relation/<id>/full`, not only the ones crossing a window edge. A relation the box cuts is kept as a placeholder so it can be completed (t10).
- The fill also lowers any ground above the level inside the lake, outside its islands: that ground rose through the surface, which the pixel metrics could not see (t10; `tests/three-core/water-terrain.test.ts`). The lake windows vale-north, maentwrog and trawsfynydd were rebuilt with `--reuse-osm`.
