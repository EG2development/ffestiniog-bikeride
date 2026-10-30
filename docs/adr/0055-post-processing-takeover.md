# 55. Post-processing as the one render-priority subscriber under a never frame loop

Date: 2026-10-29

Scope: `src/three/photo/PostFX.tsx`, `tests/static-3d.test.ts` (RN1), `POST` in `src/three-core/photoLook.ts`

## Status

Proposed

## Context

Ambient occlusion, a grade and filmic tone mapping need an `EffectComposer`, which must run instead of react-three-fiber's
own `gl.render`. In react-three-fiber the supported way is a `useFrame` subscriber with a positive priority: the loop then
skips its render and the subscriber draws. ADR 17 and spec RN1 ban `useFrame` in 3D code, because an uncontrolled loop
would break determinism and the one-render-per-frame contract of `@remotion/three`.

Read in `@remotion/three` 4.0.538 and react-three-fiber 9.8.2: while rendering, `<ThreeCanvas>` sets `frameloop="never"`
and its `ManualFrameRenderer` calls `advance(now)` once per Remotion frame; `advance` runs the subscribers once and, only
if no subscriber has a priority, renders. The timestamp it passes is not read by the composer.

## Decision

`PostFX` is the **only** file that may call `useFrame`, with priority 1, once. Under the never loop that is exactly one
composer render per `advance()`, so per Remotion frame; no clock, timer or second loop is involved. The static test RN1
is amended to allow `useFrame` in that file alone and to require the single positive-priority call.

The composer renders the scene into a half-float, 4-sample target, then GTAO (its normal and depth pass skips objects
flagged `userData.noAO`, the alpha-cut tree cards, which it would otherwise treat as solid slabs), a grade pass
(vignette and saturation from `POST`), then `OutputPass` with the renderer set to AgX tone mapping at `POST.exposure`.
With `diagnostics`, `PostFX` logs `THREE_STATS` once per frame with the renderer's counts over every pass (the
`Diagnostics` component is not mounted in the photo look), so the render checks read the whole frame's cost.

## Consequences

- Deterministic: GTAO's noise is a fixed texture; the composer has no temporal state; RN2's double render holds.
- The frame's triangle count roughly doubles (the AO pass re-renders the scene for normals and depth); the per-frame time
  on the development machine stays far below the 2 s budget. Figures in `docs/validation-3d.md`.
- Tone mapping is set on the renderer while rendering (as `CameraRig` sets the camera, ADR 17), so the first `advance()`
  after creation already uses it.

## Verification

`tests/static-3d.test.ts` RN1 (amended); RN2 determinism of `Poc3DMaentwrogPhoto` frames in the render checks.

## Relations

Amends: [17. Set the camera during render, not in useFrame](0017-camera-set-during-render.md). Related to: [54. A photoreal look as a layer](0054-photoreal-layer.md).
