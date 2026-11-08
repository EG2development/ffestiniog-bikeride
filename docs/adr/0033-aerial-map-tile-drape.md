# 33. Aerial scenes drape the cached map tiles on the corridor terrain

Date: 2026-10-25

Scope: `src/three-core/tileUv.ts`, `src/three/MapDrapeView.tsx`, `src/data/MapDrapeProvider.tsx`

## Status

Proposed

## Context

Land-cover colouring of the whole corridor would need a corridor-wide OSM fetch. The 2D video already renders the corridor from cached OpenTopoMap tiles (z12 wide, z15 detail; CC-BY-SA, map data ODbL) with their credit on screen.

## Decision

Scenes 1, 2, 3 and 8 texture the 16 m corridor DTM with a composite canvas of the cached z15 tiles. `tileUv.ts` (pure Web Mercator maths) gives each vertex its UV into that canvas; `MapDrapeProvider` loads the tiles behind `delayRender` outside the canvas and passes the canvas as a prop. A tile the cache lacks is painted the horizon colour, counted and logged (`MAP_DRAPE missing …`); only a cached tile that fails to load fails the render. The CC-BY-SA credit is part of the attribution on every aerial frame.

## Consequences

- The aerials and the 2D video share one look and one source.
- No new network fetch: only the cache is read.
- Spec RL6 and RL22 are amended as the design records.

## Verification

RL6 (amended), RL22 (R); `tests/three-core/tileUv.test.ts` (design D29).

## Relations

Amended by: [46. Clarity tuned as data, from one source, against metrics](0046-clarity-tuned-as-data.md), [60. The reel in the photo look: every scene, its aerials coloured by a satellite image](0060-reel-in-the-photo-look.md)

Related to: [10. Colour the terrain from OSM land cover as vertex colours](0010-landcover-vertex-colours.md), [4. Pass data into the canvas as props, not context](0004-props-into-canvas.md)
