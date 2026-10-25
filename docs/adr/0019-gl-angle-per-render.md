# 19. Pass --gl=angle per 3D render, never globally

Date: 2026-10-25

Scope: `remotion.config.ts`, `package.json`

## Status

Proposed

## Context

Remotion's docs recommend the angle GL renderer for three.js. Measured on 2026-10-25: two default renders of `CyclingVision` frame 2200 were byte-identical (sha256 6a9065e5…), while a render with `--gl=angle` differed (a41e9d6e…). A global setting would therefore break RG1.

## Decision

Every 3D still and render script in `package.json` passes `--gl=angle`. `remotion.config.ts` does not set a GL renderer. This amends spec RN4 and ADR 1.

## Consequences

- The 2D video keeps rendering exactly as before.
- Anyone rendering 3D by hand must remember the flag; the npm scripts carry it.

## Verification

RN4 (static check), RG1 (see docs/spec-3d.md). Design reference: D17 in docs/design-3d.md.

## Relations

Amends: [1. Use @remotion/three's ThreeCanvas for 3D, alongside the 2D video](0001-use-remotion-three-threecanvas.md)
