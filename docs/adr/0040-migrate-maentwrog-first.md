# 40. Migrate the Maentwrog section first

Date: 2026-10-25

Scope: `src/scenes3d/PocMaentwrog.tsx`, `src/three-core/sections.ts`

## Status

Proposed

## Context

The section refactor (ADR 27) touches the only scene with real-data evidence: the proof of concept's acceptance tests, render checks and independent validation. A refactor that silently changed it would invalidate that evidence.

## Decision

Before any new section is built, `Poc3DMaentwrog` is re-expressed as `SECTIONS.maentwrog` through `buildSectionScene` and the shot specs. Its composition id stays; its acceptance tests pass unchanged; the render checks pass, with only the triangle count allowed to change as the realism work lands (sky, shading, water, trees). RN2 (determinism) must hold throughout.

## Consequences

- The refactor is proven on known data before it meets new data.
- The first realism changes are reviewed on a scene the reviewers already know.

## Verification

`tests/three-core/poc-acceptance.test.ts` unchanged; RN2; the render checks (design D36).

## Relations

Related to: [2. Build the 3D work as separate compositions](0002-separate-3d-compositions.md), [27. Build every section from one config and one assembly](0027-section-config.md)
