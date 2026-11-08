# 54. A photoreal look as a layer over the same scene, prototyped on Maentwrog Road

Date: 2026-10-29

Scope: `src/scenes3d/Section3D.tsx` (`look` prop), `src/scenes3d/PocMaentwrogPhoto.tsx`, `src/three/photo/*`, `src/data/PhotoAssetsProvider.tsx`, `src/three-core/photoLook.ts`, `src/three-core/grass.ts`, `PROTOTYPES` in `src/three-core/sections.ts`, `data/assets-3d.json`

## Status

Proposed

## Context

The reel's look (ADRs 10, 11, 18, 30, 31) is deliberately plain: vertex-coloured terrain, cone and icosahedron trees, a
gradient sky, no textures, no post-processing (spec CL14 forbade textures and HDR images in iteration 2). Its
independent review found the ground scenes "convince" as a concept but nowhere near real footage. The owner's brief now
asks for a lifelike preview of the ride, with geographic accuracy first, visual realism second, performance third and
simplicity throughout, and for a 15–20 s prototype on one section before any wider migration.

The research recorded in `docs/research-photoreal.md` compared enhanced three.js, Blender-assisted three.js, a Cesium
or 3D Tiles environment, an Unreal Engine pipeline and photogrammetry or Gaussian splatting. Only the first keeps the
pure core, the registers, the deterministic frame-based renders and the existing tests, and needs no new software,
hardware, cloud account or licence.

## Decision

Realism is a **look**, not a new scene. `Section3D` takes `look: "concept" | "photo"`; both looks build the same
`SectionScene` from the same data and shots, so geography, registers and tests are shared, and a frame can be rendered
in both looks from the same camera for comparison. The photo look replaces views, never the core:

- the terrain carries planar-mapped detail textures blended by land cover and slope (`TerrainPhotoView`), the trail a
  gravel texture under the same buff tint (`TrailPhotoView`), the OSM bridge stone (`BridgePhotoView`);
- trees are card trees with volume normals, in the concept trees' envelopes (`TreesPhotoView`); grass clumps near the
  trail (`GrassView`, `placeGrass`) and OSM field boundaries (`BarriersView`, ADR 58) are added;
- a cloud sky that also lights the scene as an environment map (`PhotoSky`) and the photo light constants
  (`LIGHTING_PHOTO`) replace the flat dome and hemisphere fill; a post-processing pass adds ambient occlusion, a grade
  and AgX tone mapping (ADR 55);
- tree heights come from the lidar canopy (ADR 57) and the rider's view is a shot (ADR 56).

Textures and sky images are permitted, **superseding CL14's scope guard**, under L1's rule: every file lives under
`public/3d/` with an entry in `data/assets-3d.json` (source, licence, attribution), is loaded only by
`PhotoAssetsProvider` behind the load gate (ADR 43), and is named by role in `src/three/photo/assetRoles.ts`. A role
without a file renders with a deterministic procedural stand-in, so the look works before any download, and a missing
asset changes a material, never a sourced feature. A static test ties the role table to the register.

The prototype is a **config outside the reel** (`PROTOTYPES["maentwrog-photo"]`, composition `Poc3DMaentwrogPhoto`,
600 frames: aerial, rider's view, follow), so the reel's budget, captions, stills and tests are untouched. The reel's
sections opt in to the photo extras through `SectionConfig.photo`; none does yet.

## Consequences

- One scene, two looks: the concept look stays byte-stable (the tree placer's new draws come from a second seeded
  stream; the trail ribbon gains UVs no concept view reads).
- Realism is bounded by the data: no texture or sprite invents a feature; the land cover still comes from OSM, the
  heights from the lidar, the walls from OSM ways. What is generic (bridge form, wall section, tree species) is marked
  in the legend or the register.
- The photo look costs about twice the frame work of the concept look (the AO pass renders the scene again) and 24 extra
  draw calls; measured figures are in `docs/validation-photoreal.md`.
- After the independent review of 2026-10-30 (`docs/evidence/photo/independent-review-2026-10-30.md`), a photo config
  may also set `treeClearOfTrailM` (the prototype: 5 m, where ADR 11 keeps the reel's trees 10 m off the line; the
  follow camera's sight lines still exclude crowns), the grass stands on the rendered ground (`groundAt`), the close
  shots use `SHADOW_PHOTO_CLOSE` (a 160 m shadow map with a 6 cm normal bias), and the legend names the people and the
  levelled verges as the concept's and a drone shot's earthworks as approximate.
- `npm run still:photo` and `npm run render:photo` exist; `Section-<id>` compositions accept `--props '{"look":"photo"}'`.

## Verification

`tests/static-3d.test.ts` (CL14 as amended, RN1 as amended), `tests/three-core/first-person.test.ts` (the prototype
config), `tests/three-core/grass.test.ts`, the render checks' RN2 determinism on the photo composition, the before/after
stills in `docs/evidence/photo/` and the reviews in `docs/validation-photoreal.md`.

## Relations

Amended by: [60. The reel in the photo look: every scene, its aerials coloured by a satellite image](0060-reel-in-the-photo-look.md)

Supersedes: spec CL14 (scope guard of iteration 2). Amends: [18. Light with a fixed sun, hemisphere fill and fog](0018-fixed-lighting.md), [30. A gradient sky dome and exponential fog](0030-sky-dome-and-fog.md), [31. Terrain relief shading without textures](0031-terrain-shading-without-textures.md). Related to: ADRs 55–58.
