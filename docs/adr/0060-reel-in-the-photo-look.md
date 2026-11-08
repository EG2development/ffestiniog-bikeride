# 60. The reel in the photo look: every scene, its aerials coloured by a satellite image

Date: 2026-10-30

Scope: `src/three-core/sections.ts` (`Look`, `buildSectionScene(cfg, inputs, look)`, every reel config's `photo`),
`src/three-core/trees.ts` (`treesPerNode`, `canopyCover`), `src/three-core/shading.ts` (`GroundImage`, `imageryPixels`,
`imageryNodeColours`), `src/three-core/photoLook.ts` (`IMAGERY_GRADE`), `src/three-core/atmosphere.ts`
(`SHADOW_PHOTO_AERIAL`), `src/three-core/registers.ts` (`validateImageryHeader`, kind `imagery`), `src/data/reel-timeline.ts`
(`REEL_LOOK`), `src/data/reel-captions.ts` (`reelCaptions`), `src/data/Scene3DDataProvider.tsx`, `src/scenes3d/Reel3D.tsx`,
`src/scenes3d/Section3D.tsx`, `src/Root.tsx`, `src/three/photo/TerrainPhotoView.tsx`, `src/three/photo/PostFX.tsx`,
`src/three/RoadView.tsx`, `src/three/WaterView.tsx`, `src/three/BuildingsView.tsx`, `src/three/photo/BarriersView.tsx`,
`scripts/build_imagery.py` (new), `scripts/build_section_data.py`, `scripts/fetch_barriers.py`, `scripts/stills.mjs`,
`scripts/render-checks.mjs`, the data under `public/data/sections/*/` and the registers

## Status

Proposed

## Context

On 2026-10-30 the owner asked for every part of the reel to look like `Poc3DMaentwrogPhoto`. ADR 54 had kept the photo
look outside the reel: only the Maentwrog window had canopy and boundary data, and adding a config's `photo` extras
moved its trees in both looks (design risk K20), which would have broken the concept look's before and after stills
(ADR 45) and its measures (CL1–CL6, WA6, WA7). The reel's four aerial scenes draped OpenTopoMap tiles (ADR 33), which
the t14 validator called "a magnified paper map"; their window had no land cover, roads or water to draw instead. No
open orthophoto of the corridor exists under a usable licence; the research (`docs/research-photoreal.md` §2) named a
Sentinel-2 true-colour scene as the first candidate for the aerials' ground, too coarse near the trail.

## Decision

- **The look owns the extras.** `buildSectionScene(cfg, inputs, look)` builds a config's `photo` extras only in the photo
  look, so every reel section now carries them and the concept look is unchanged, tree for tree (tested). The data
  provider loads the optional files only for the photo look. `REEL_LOOK = "photo"`: `Reel3D` and the `Section-<id>`
  compositions default to it; `look: "concept"` in the props renders the first look, and `scripts/stills.mjs` pins it,
  as the iteration-2 measures were defined on it.
- **Ground scenes take the prototype's extras.** Canopy trees (ADR 57; canopy grids built for blaenau, vale-north,
  vale-south and trawsfynydd), OSM walls, hedges and fences (ADR 58), grass along the stretch both shots see, trunks 5 m
  off the line, and one to three walkers (ADR 59) each, choreographed against the rider's table on the window's own
  trail: met or overtaken in the follow shot, on the rider's right, never crossing one another, never within 2.5 m of
  the camera.
- **Aerial scenes are drawn, not draped.** The corridor window gains OSM land cover, roads, water and boundaries
  (`build_section_data.py` fetches OSM for it in 6 × 6 tiles; the line's structures stay registered by the ground
  windows) and its lidar canopy at the 16 m overview level. Its ground colour is one Sentinel-2 L2A true-colour scene,
  pinned (S2C_30UVD_20250712_0_L2A, 12 July 2025, 0.06 % cloud), which `scripts/build_imagery.py` samples onto the
  window's own grid at 8 m (twice the nodes) through the OS Helmert transform and UTM zone 30N; the terrain maps it by
  node index. The splat textures, at four times their ground tile, only vary its brightness (strength 0.75) and fade
  to it over 1.5 km. The image is graded towards the ground scenes' palette (gain 1, saturation 1.1, tint 1.6/1/0.7)
  so a cut keeps one look (CL6). Trees stand wherever the canopy is at least 3 m, mapped woodland or not, three crowns
  to a node within 1.5 km of the line, at most 20,000 per kind, never on built-up, quarry or water nodes (their DSM is
  roofs and spoil, and the window has no footprints to tell). The shadow map covers 2.4 km.
- **Photo materials for what the prototype never showed:** water as a dark near-mirror that reflects the sky's
  environment, roads with the registered tarmac texture, buildings with the stone texture's relief under their stone
  and slate colours, hedges lighter and with a fill so a shade side is not black.
- **Two more allowlisted hosts** (spec RL30): the Earth Search STAC API (`earth-search.aws.element84.com`), which names
  the scene's file, and the AWS open-data bucket that serves it (`sentinel-cogs.s3.us-west-2.amazonaws.com`): free, no
  account, range reads only. The Sentinel Data Legal Notice allows adaptation and distribution with its notice, which
  the photo reel's attribution carries in place of the map-tile credit (it draws no tiles).
- **The budget is the scene pass's, and the photo look sends only what can be seen.** RN6 and RL24 were written for one
  pass; `PostFX` now logs the scene pass's counts (its shadow map included, as the concept look's are) beside the whole
  frame's, and the render checks hold the scene pass to ≤ 300 calls and ≤ 2 M triangles. The first full run failed
  RL24 (the intro at 3.42 M, Trawsfynydd at 2.35 M). Three changes brought every frame under it without thinning a
  ground scene's trees: the aerial trees have no trunks (under a pixel, and under their crowns, from 150 m up); a tree
  that no frame's view holds and no frame's shadow map can reach is not drawn, and one no shadow map reaches casts no
  shadow (`treesInShots`; the reach is half the map's range plus the window's relief and the tallest canopy, over the
  sine of the sun's elevation); and the terrain is cut into 500 m tiles, after its normals are computed on the whole
  mesh, so three culls the tiles out of view. The second and third leave every pixel as it was: five reference
  frames (aerial, three ground scenes, the prototype) rendered byte-identical before and after each.

## Consequences

- The aerials are soft: a 10 m pixel is 30–40 screen pixels at the intro's distance, so fields read as colour and the
  walls, roads and trees give the edges. A finer open orthophoto would be the improvement; the Welsh aerial photography
  is licensed to the public sector only (research §2).
- Three dates meet on screen: the lidar (flown 2022), the photograph (July 2025) and OSM (retrieved October 2026).
- Gardens in built-up areas get no trees on the aerials, since a crown cannot be told from a roof there.
- Rebuilding the corridor with OSM filled 434 lake cells at their shore level and interpolated 13 bridges and 16
  overbridges in its trail profile; the concept look's aerials share that DEM and profile under their drape.
- The data grow by the canopy grids of five more windows, five boundary files and a 1.9 MB image.
- Render cost and timings: `docs/validation-photoreal.md`.

## Verification

`tests/three-core/reel-photo.test.ts` (the reel's look and attribution, every scene's extras, the concept look
unchanged, each scene's walkers on its real trail, the image on the corridor's grid, trees only on canopy that is not
bare), `tests/three-core/occlusion.test.ts` in both looks, `tests/three-core/trees-canopy.test.ts`,
`tests/pipeline-python.test.ts` (`build_imagery.py --self-test`), `tests/static-3d.test.ts` (RL30), and the render
checks (`npm run test:render`) on the photo reel.

## Relations

Amended by: [61. Trail users at random: walkers, runners and prams, by a seeded draw that keeps the rider's rules](0061-trail-users-at-random.md)

Amends [54. A photoreal look as a layer](0054-photoreal-layer.md) (the reel now uses it), [33. Aerial map-tile drape](0033-aerial-map-tile-drape.md) (now the concept look's only), [57. Canopy heights from the lidar](0057-canopy-heights-from-lidar.md) and [58. Walls and hedges from OSM](0058-walls-and-hedges-from-osm.md) (opt-in per look, not per config), [59. Walkers on the trail](0059-walkers-on-the-trail.md) (the reel's sections list walkers). Related to: [45. Before and after stills from one environment](0045-before-after-stills-one-environment.md), [55. Post-processing takeover](0055-post-processing-takeover.md).
