# 28. One master composition with hard cuts and premount

Date: 2026-10-25

Scope: `src/scenes3d/Reel3D.tsx`, `src/data/reel-timeline.ts`, `src/Root.tsx`

## Status

Proposed

## Context

The reel is 2,700 frames (1:30 at 30 fps, 16:9) over the storyboard's eight scenes, each a 3D section. The sections must stay separate, lazily loaded compositions (ADRs 2, 24), and a cut must never land on an empty canvas (spec RL27).

## Decision

`Reel3D` is a Remotion `<Series>` of nine `Series.Sequence`s (scene 5 is two windows, `vale-north` and `vale-south`) in the frame budget the spec fixes; each sequence renders one `Section3D` (a static import inside the reel; the lazy boundary is `src/Root.tsx`). The budget lives in `src/data/reel-timeline.ts`, the single source for the composition and the RL2 test. Cuts are hard cuts. `Config.setDefaultPremountInSeconds(2)` (already set) mounts the next section 60 frames early so its data has loaded and its first frame is complete. Every section is also registered on its own for stills and checks.

## Consequences

- No cross-fades: a fade through two 3D canvases would double the draw calls and blur the cut.
- At each boundary two canvases exist for 60 frames; ADR 39 measures those frames.
- `src/Root.tsx` gains lazy entries only.

## Verification

RL1, RL2, RL3, RL27 (R, T, S); `tests/reel-timeline.test.ts` (design D24).

## Relations

Amends: [2. Build the 3D work as separate compositions](0002-separate-3d-compositions.md)
Related to: [24. Load 3D compositions lazily](0024-lazy-3d-compositions.md)
