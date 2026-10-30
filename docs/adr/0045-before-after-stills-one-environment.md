# 45. Before and after stills from one script and one environment

Date: 2026-10-25

Scope: `scripts/stills.mjs` (new); output `out/before/`, `out/after/` (ignored by git)

## Status

Proposed

## Context

The goal asks for before stills from one consistent rendering environment. The t8 benchmark showed that evidence must be bound to a source snapshot.

## Decision

`node scripts/stills.mjs <dir>` renders a fixed `FRAMES` table: Trawsfynydd and Maentwrog at several frames, then one frame for each other scene, with their mask variants. It uses `--gl=angle`, scale 1 and one port. It writes `manifest.json` with the platform, Node, Remotion, Chrome and the snapshot id: the `git stash create` SHA plus hashes of the untracked files. `out/before` is captured at the start of the build, before any code change.

## Consequences

- Before and after stills are comparable only within the environment their manifests record.
- The numbers go into `docs/validation-3d.md`; the PNGs stay out of git.

## Verification

Spec CL1 and X3; design D41.

## Relations

Related to: [19. Pass --gl=angle per 3D render, never globally](0019-gl-angle-per-render.md), [39. Performance measured per section and at the cuts](0039-performance-per-section-and-cuts.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- The masked before set is `out/before-masks`; `out/before` holds only the 15 stills without masks.
- The snapshot (`scripts/snapshot.mjs`) is content-only: the tree hash of `git stash create` (HEAD's when clean), plus one hash of the untracked files outside `.claude-flow/`, `.claude/`, `.agents/` and `.idea/`. The commit hash carried a timestamp, and the hooks rewrite the tool state on every call (t7).
