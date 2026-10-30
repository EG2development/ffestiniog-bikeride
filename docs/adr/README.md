# Architecture decision records

Decisions for the 3D upgrade of the cycling route video. How to run the
3D work and how to change a decision: docs/sop-3d.md. Each design decision
D1–D20 in docs/design-3d.md has its own record; D21 is ADR 23. D22 (render-check
diagnostics through Remotion's Node API) is an implementation detail of the checks, recorded
in the design only. ADRs 24–26 came from the benchmark (t8), security review (t9) and CI (t12)
tasks. ADRs 27–40 record the reel design (D23–D36, mission `msn_44274a1de641722956fc9ce5`); ADRs 41–52 record the water, readiness, clarity and buildings iteration (D37–D48 in `docs/design-reel-v2.md`, mission `msn_33e838999675db739df3c922`). ADR 53, GPU encoding for 3D renders, came from the t8 benchmark. ADRs 41, 42, 44–51 and 53 each end with an "As built" section (t13) recording how the decision shipped; the decisions themselves are unchanged. ADRs 54–58 record the photoreal layer (2026-10-29; D49–D53 in `docs/design-photoreal.md`, research in `docs/research-photoreal.md`). All records stay "Proposed" until the project owner accepts or rejects them.

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
| [27. Build every section from one config and one assembly](0027-section-config.md) | Proposed | D23 (reel) |
| [28. One master composition with hard cuts and premount](0028-reel-master-composition.md) | Proposed | D24 (reel) |
| [29. Terrain data in a window per section, plus a coarse corridor window](0029-terrain-windows-per-section.md) | Proposed | D25 (reel) |
| [30. A gradient sky dome and exponential fog, with the fog colour equal to the horizon](0030-sky-dome-and-fog.md) | Proposed | D26 (reel) |
| [31. Terrain relief shading without textures](0031-terrain-shading-without-textures.md) | Proposed | D27 (reel) |
| [32. Water surfaces from OSM polygons at the shore height](0032-water-from-osm.md) | Proposed | D28 (reel) |
| [33. Aerial scenes drape the cached map tiles on the corridor terrain](0033-aerial-map-tile-drape.md) | Proposed | D29 (reel) |
| [34. Build the cyclist from its dimensions](0034-cyclist-from-dims.md) | Proposed | D30 (reel) |
| [35. Camera shots per section from a spec, with aerial shots](0035-shot-specs.md) | Proposed | D31 (reel) |
| [36. Captions as data with frame ranges](0036-captions-as-data.md) | Proposed | D32 (reel) |
| [37. Vegetation in a near zone with a density band](0037-vegetation-near-zone.md) | Proposed | D33 (reel) |
| [38. On-screen text comes only from curated files, never from OSM tags](0038-labels-from-curated-files.md) | Proposed | D34 (reel) |
| [39. Performance measured per section and at the cuts](0039-performance-per-section-and-cuts.md) | Proposed | D35 (reel) |
| [40. Migrate the Maentwrog section first](0040-migrate-maentwrog-first.md) | Proposed | D36 (reel) |
| [41. Water polygons keep their holes and face up](0041-water-polygons-with-holes.md) | Proposed | D37 (iteration 2) |
| [42. One water level per water body, computed once](0042-one-level-per-water-body.md) | Proposed | D38 (iteration 2) |
| [43. One load gate for the data providers, applied where a test shows a fault](0043-load-gate-for-providers.md) | Proposed | D39 (iteration 2) |
| [44. Mask renders for measurement only](0044-mask-renders-for-measurement.md) | Proposed | D40 (iteration 2) |
| [45. Before and after stills from one script and one environment](0045-before-after-stills-one-environment.md) | Proposed | D41 (iteration 2) |
| [46. Clarity tuned as data, from one source, against metrics](0046-clarity-tuned-as-data.md) | Proposed | D42 (iteration 2) |
| [47. Keep decorative trees out of the follow-camera corridor](0047-trees-clear-of-camera-corridor.md) | Proposed | D43 (iteration 2) |
| [48. Overlays inside the safe area, captions paced for reading](0048-overlays-safe-area-and-pacing.md) | Proposed | D44 (iteration 2) |
| [49. Buildings and landmarks from sourced data only](0049-buildings-from-sourced-data.md) | Proposed | D45 (iteration 2) |
| [50. Draw buildings as one merged mesh per section plus procedural landmarks](0050-merged-buildings-and-procedural-landmarks.md) | Proposed | D46 (iteration 2) |
| [51. Register entries carry status and provenance](0051-register-status-and-provenance.md) | Proposed | D47 (iteration 2) |
| [52. Re-measure the budgets after each track; trees give way first](0052-budgets-remeasured-trees-first.md) | Proposed | D48 (iteration 2) |
| [53. Encode 3D renders on the GPU, per command; the 2D video keeps software encoding](0053-gpu-encoding-for-3d-renders.md) | Proposed | t8 (iteration 2) |
| [54. A photoreal look as a layer over the same scene, prototyped on Maentwrog Road](0054-photoreal-layer.md) | Proposed | D49 (photoreal, `docs/design-photoreal.md`); supersedes spec CL14 |
| [55. Post-processing as the one render-priority subscriber under a never frame loop](0055-post-processing-takeover.md) | Proposed | D50 (photoreal); amends ADR 17 |
| [56. The rider's view as a shot: handlebar height, cadence bob, no rider model](0056-first-person-shot.md) | Proposed | D51 (photoreal); amends spec CA3 for first-person shots |
| [57. Tree heights and field trees from the lidar canopy, when a section asks](0057-canopy-heights-from-lidar.md) | Proposed | D52 (photoreal); amends ADRs 11, 37 |
| [58. Field boundaries from OSM barrier ways, in their own file, with a gap at the trail](0058-walls-and-hedges-from-osm.md) | Proposed | D53 (photoreal); amends ADRs 12, 20 |
| [59. Walkers on the trail, choreographed by the section, under the rider's rules](0059-walkers-on-the-trail.md) | Proposed | D54 (photoreal); implements spec C9 |
