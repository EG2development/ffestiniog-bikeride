# 39. Performance measured per section and at the cuts

Date: 2026-10-25

Scope: `scripts/render-checks.mjs`

## Status

Proposed

## Context

RN6 is a per-frame budget. With premount (ADR 28) two section canvases exist for 60 frames at each cut, so the heaviest frames are the boundary frames, which a one-frame-per-section check would miss.

## Decision

The render checks read `renderer.info` at one frame inside each of the nine sequences and at the last frame before each of the eight cuts (239, 479, 779, 1079, 1349, 1619, 1919, 2399, where the premounted next section also exists), plus the RL23 frames 0, 1349 and 2699, and apply RN6 (≤ 300 draw calls, ≤ 2 M triangles) to all of them. If a boundary frame fails, the reel's sequences get `premountFor` of 1 s instead of the 2 s default.

## Consequences

- 19 distinct frames (20 diagnostics stills; 1349 is measured twice) per check run; the local gate takes minutes, not seconds.
- The budget is proven where it is tightest.

## Verification

RL24 (R) (design D35).

## Relations

Related to: [26. Run the portable checks in CI; keep the render checks as a local gate](0026-ci-scope.md)
