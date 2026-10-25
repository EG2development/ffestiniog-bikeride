# 3. Keep the 3D maths in a pure, React-free core

Date: 2026-10-25

Scope: `src/three-core/`, `src/three/`, `tests/three-core/`

## Status

Proposed

## Context

Most acceptance criteria (G1–G6, C1–C7, CA1–CA4) are numeric, and WebGL can't run in vitest under Node. The mission also requires every criterion to be checked by something other than its author.

## Decision

All geometry, placement, motion and camera maths live in `src/three-core/` as pure TypeScript with no React, three.js, Remotion or DOM imports. Components in `src/three/` only turn arrays and poses into three.js objects.

## Consequences

- Every numeric criterion is a unit test in `npm test`.
- Output is deterministic by construction.
- Visual problems (materials, lighting) are only caught by render checks and review, not unit tests.

## Verification

A static test that `src/three-core/` imports nothing from react, three or remotion (see docs/spec-3d.md). Design reference: (system shape) in docs/design-3d.md.

## Relations

Related to: [4. Pass data into the canvas as props, not context](0004-props-into-canvas.md)
Related to: [5. Use the 2D projection for 3D coordinates, at true vertical scale](0005-shared-projection-true-scale.md)
