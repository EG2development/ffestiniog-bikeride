# Architecture decision records

Decisions for the 3D upgrade of the cycling route video. How to run the
3D work and how to change a decision: docs/sop-3d.md. Each design decision
D1–D20 in docs/design-3d.md has its own record; D21 is ADR 23. D22 (render-check
diagnostics through Remotion's Node API) is an implementation detail of the checks, recorded
in the design only. ADRs 24–26 came from the benchmark (t8), security review (t9) and CI (t12)
tasks. All records stay "Proposed" until the project owner accepts or rejects them.

| ADR | Status | Design decision |
|---|---|---|
| [1. Use @remotion/three's ThreeCanvas for 3D, alongside the 2D video](0001-use-remotion-three-threecanvas.md) | Proposed | Phase 1 dependency decision |
| [2. Build the 3D work as separate compositions](0002-separate-3d-compositions.md) | Proposed | D1 |
| [3. Keep the 3D maths in a pure, React-free core](0003-pure-core-thin-views.md) | Proposed | (system shape) |
| [4. Pass data into the canvas as props, not context](0004-props-into-canvas.md) | Proposed | D2 |
| [5. Use the 2D projection for 3D coordinates, at true vertical scale](0005-shared-projection-true-scale.md) | Proposed | D3 |
| [6. Use the Welsh lidar DTM for terrain](0006-welsh-lidar-dtm.md) | Proposed | D4 |
| [7. Read the DTM by HTTP range requests, without GDAL](0007-range-read-dtm.md) | Proposed | D5 |
| [8. Convert WGS84 and British National Grid with the OS Helmert transform](0008-helmert-datum.md) | Proposed | D6 |
| [9. Take the trail height from the DTM along the centreline](0009-trail-height-from-dtm.md) | Proposed | D7 |
| [10. Colour the terrain from OSM land cover](0010-landcover-vertex-colours.md) | Proposed | D8 |
| [11. Place trees by seeded random inside OSM woodland](0011-seeded-trees-in-woodland.md) | Proposed | D9 |
| [12. Model only structures that have a cited source](0012-sourced-structures-only.md) | Proposed | D10 |
| [13. Model the trail as a 3 m ribbon over a flattened corridor](0013-trail-ribbon-corridor.md) | Proposed | D11 |
| [14. Use a procedural cyclist model for the proof of concept](0014-procedural-cyclist.md) | Proposed | D12 |
| [15. Drive cyclist motion from a precomputed distance table](0015-distance-table-motion.md) | Proposed | D13 |
| [16. Define camera shots as pure functions with clearance limits](0016-pure-camera-shots.md) | Proposed | D14 |
| [17. Set the camera during render, not in useFrame](0017-camera-set-during-render.md) | Proposed | D15 |
| [18. Light with a fixed sun, hemisphere fill and fog](0018-fixed-lighting.md) | Proposed | D16 |
| [19. Pass --gl=angle per 3D render, never globally](0019-gl-angle-per-render.md) | Proposed | D17 |
| [20. Keep feature and asset registers as validated JSON](0020-registers-as-json.md) | Proposed | D18 |
| [21. Treat data/ as the source of truth, synced to public/data](0021-data-sync.md) | Proposed | D19 |
| [22. Pin the three.js dependencies exactly, without drei](0022-pin-three-deps.md) | Proposed | D20 |
| [23. Remove road-bridge decks from the trail profile](0023-remove-road-decks-from-profile.md) | Proposed | D21, found during the build (amends ADR 9) |
| [24. Load 3D compositions lazily](0024-lazy-3d-compositions.md) | Proposed | found by the t8 benchmark (amends ADR 2) |
| [25. Override zod to a patched version until Remotion ships one](0025-override-zod.md) | Proposed | found by the t9 security review |
| [26. Run the portable checks in CI; keep the render checks as a local gate](0026-ci-scope.md) | Proposed | t12 build and CI |
