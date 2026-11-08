# 58. Field boundaries from OSM barrier ways, in their own file, with a gap at the trail

Date: 2026-10-29

Scope: `scripts/fetch_barriers.py` (`npm run data:barriers`), `public/data/sections/<id>/barriers.geojson`, `src/three-core/barriers.ts`, `src/three/photo/BarriersView.tsx`, the `barrier` kind in `src/three-core/registers.ts`, `Scene3DDataProvider` (`wants.barriers`), `SectionConfig.photo.barriers`

## Status

Proposed

## Context

Drystone walls are the signature of the Vale's fields, and the brief names them. The section pipeline keeps only roads,
structures and land-cover polygons from OSM (ADR 38's tag allowlist), and the reel's windows must stay byte-stable
(spec CL7), so the boundaries cannot simply be added to `osm.geojson`.

## Decision

`fetch_barriers.py` fetches the window's bbox from the OSM API (the allowlisted host, RL30) and writes the
`barrier=wall|city_wall|retaining_wall|hedge|fence` and `natural=tree_row` ways as LineStrings to `barriers.geojson`,
keeping only `barrier`, `wall`, `height`, `natural` and `leaf_type` (data minimisation, ADR 38), and adds one
`approximate` register entry of the new kind `barrier` per way, which `build_section_data.py`'s rebuild keeps.

`buildBarrierMeshes` lofts each line into a box on the rendered ground, sampled every 2 m: a wall 0.6 × 1.2 m, a hedge
1.6 × 1.8 m, a fence as posts every 3 m with two rails, or the tagged `height` when it is between 0 and 4 m. Faces are
unshared, with UVs along and up the face for a stone or leaf texture. A boundary that crosses the proposed trail is
left open for 3 m either side of the centreline: the gap is itself a proposal (a gate, a stile) and the register note
says so. Barriers are keep-out corridors for the tree placer (no trunk in a wall). A section receives barriers only when
its config asks.

## Consequences

- Lines and tagged heights are OSM's; sections and materials are generic, so every barrier is "approximate" and the
  legend's wording covers it with the bridge ("generic form").
- Three draw calls at most per section; Maentwrog has 37 walls and 6 fences, no hedge mapped.
- Heights without a tag are typical, not surveyed; a wall OSM has not mapped is not drawn.

## Verification

`tests/three-core/barriers.test.ts`; `python3 scripts/fetch_barriers.py --self-test`; `tests/three-core/trees-canopy.test.ts`
(the register kind).

## Relations

Amended by: [60. The reel in the photo look: every scene, its aerials coloured by a satellite image](0060-reel-in-the-photo-look.md)

Amends: [12. Model only structures that have a cited source](0012-sourced-structures-only.md), [20. Keep feature and asset registers as validated JSON](0020-registers-as-json.md). Related to: [54. A photoreal look as a layer](0054-photoreal-layer.md).
