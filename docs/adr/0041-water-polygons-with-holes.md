# 41. Water polygons keep their holes and face up

Date: 2026-10-25

Scope: `src/three-core/water.ts`, `src/three/waterGeometry.ts` (new), `src/three/WaterView.tsx`, `scripts/build_section_data.py`

## Status

Proposed

## Context

The t1 research found:

- `water.ts` keeps only outer rings.
- `WaterView` triangulates with no holes. It maps plan *y* to world *z*, which reverses the winding seen from above, and it draws with the default front-side material and a 2 cm lift.
- Holes exist only in `properties.inner_rings`, so Llyn Trawsfynydd's 15 islands are drawn under water.
- If the faces point down, the lake seen in the stills is the terrain's water colour, not the water mesh (hypothesis H1).

## Decision

One normaliser, `polygonsOf` in the core and `polygon_rings` in the pipeline, returns an outer ring plus holes for each part. It takes holes from the geometry and from `properties.inner_rings`, and gives each hole to the part that contains its first vertex. Outer rings are oriented anticlockwise in plan and holes clockwise.

`src/three/waterGeometry.ts` triangulates with `ShapeUtils.triangulateShape(outer, holes)` and flips the index order when the first normal points down. The material stays front-sided: `DoubleSide` would hide a winding error. The surface sits exactly at the lake level and is drawn over the flattened terrain with `polygonOffset` (−2, −2) instead of a lift.

## Consequences

- Islands appear in the lake, and a winding regression shows up as missing water that WA1 and WA6 catch.
- Water triangle counts roughly double: a few thousand triangles.
- Water uses the same depth-offset technique as the trail and roads.

## Verification

Spec WA1–WA3, WA6 and WA7; design D37.

## Relations

Amends: [32. Water surfaces from OSM polygons at the shore height](0032-water-from-osm.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- Each inner ring goes to the part that holds most of its vertices, not the part holding its first vertex, so an island whose first vertex lies on the shore is kept (t10). The pipeline and the core do the same.
- `waterArrays` turns every triangle to face up by its own normal, not by the first one. The rendered material stays front-sided; only the `water-expected` measurement mask draws both sides (ADR 44).
