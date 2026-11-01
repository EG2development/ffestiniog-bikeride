# 22. Pin the three.js dependencies exactly, without drei

Date: 2026-10-25

Scope: `package.json`

## Status

Proposed

## Context

`@remotion/three` is version-locked to `remotion`, and `@react-three/fiber` 9.8.2 needs react ≥19 <19.4 and three ≥0.156 (installed react is 19.3.1).

## Decision

Pin `three` 0.186.1, `@react-three/fiber` 9.8.2, `@remotion/three` 4.0.539 and `@types/three` 0.186.0 (dev). Don't add `@react-three/drei`.

2026-11-01: Remotion moved from 4.0.538 to its 4.0.539 patch, with react 19.3.1; three stays on 0.186.1 (0.187.0 not yet assessed).

## Consequences

- Reproducible installs.
- Upgrades are deliberate; `npx remotion upgrade` moves `@remotion/three` with `remotion`.

## Verification

Static test on `package.json` versions (see docs/spec-3d.md). Design reference: D20 in docs/design-3d.md.

## Relations

Related to: [1. Use @remotion/three's ThreeCanvas for 3D, alongside the 2D video](0001-use-remotion-three-threecanvas.md)
