# 4. Pass data into the canvas as props, not context

Date: 2026-10-25

Scope: `src/scenes3d/`, `src/three/`, `src/data/Scene3DDataProvider.tsx`

## Status

Proposed

## Context

React Three Fiber renders through its own reconciler. Remotion's docs say `<ThreeCanvas>` forwards React contexts, but that is unverified in this project, and `useRouteData()` throws outside its provider.

## Decision

Providers are read outside `<ThreeCanvas>`. The scene component builds pure data and passes plain props to the views. Nothing inside the canvas calls `useContext` or the data hooks.

## Consequences

- No reliance on context forwarding.
- Views are pure functions of their props.
- The scene component carries more props.

## Verification

A static test that `src/three/` calls no `useContext`, `useRouteData` or `useScene3DData` (see docs/spec-3d.md). Design reference: D2 in docs/design-3d.md.

## Relations

Related to: [3. Keep the 3D maths in a pure, React-free core](0003-pure-core-thin-views.md)
