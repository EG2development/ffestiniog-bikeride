# 20. Keep feature and asset registers as validated JSON

Date: 2026-10-25

Scope: `data/features-3d.json`, `data/assets-3d.json`, `src/three-core/registers.ts`

## Status

Proposed

## Context

Every rendered feature must be classified (verified, approximate, proposed, decorative) with its source, and every asset must carry its licence.

## Decision

Two JSON registers with the schemas in docs/design-3d.md (D18), checked by a small hand-written validator in `src/three-core/registers.ts` (no new dependency). A feature can't be rendered unless it's registered.

## Consequences

- Honesty and licensing become testable.
- The registers need upkeep with every new feature or asset.

## Verification

H1, G5–G8, L1 (see docs/spec-3d.md). Design reference: D18 in docs/design-3d.md.

## Relations

Related to: [12. Model only structures that have a cited source](0012-sourced-structures-only.md)
Related to: [21. Treat data/ as the source of truth, synced to public/data](0021-data-sync.md)
