# 26. Run the portable checks in CI; keep the render checks as a local gate

Date: 2026-10-25

Scope: `.github/workflows/ci.yml`, `docs/sop-3d.md` ("CI")

## Status

Proposed

## Context

The project had no CI. Its checks fall into two groups.
- **Portable checks.** Lint and type-check, the vitest suite (unit, static and acceptance tests on the committed data), the dependency audit, the Python pipeline's self-test and the bundle. These give the same answer on any machine.
- **Render checks.** `npm run test:render` compares `CyclingVision` stills with sha256 baselines captured on the development Mac (RG1). A different OS, Chrome build or font set changes those pixels. The 3D checks also render through ANGLE on a GPU, which hosted runners don't provide reliably.

## Decision

A GitHub Actions workflow runs the portable checks on every push to `main`, on pull requests and on demand. It runs on `ubuntu-24.04` with Node 24.13.1, Python 3.13 and numpy 2.4.4 (the development machine's versions). Its permissions are read-only, and each action is pinned to a commit SHA of a release at least two weeks old.

The render checks are not in CI. They stay a local release gate: run `npm run test:render` on the development machine before merging any change that can affect rendering (docs/sop-3d.md).

## Consequences

- A failing lint, test, audit, pipeline check or bundle blocks a merge without anyone running it by hand.
- Rendering regressions are caught only when someone runs the local gate. The SOP lists when that is required.
- The workflow was verified before any push. Its own `run` steps were executed in a clean copy of the files git would ship, after a fresh `npm ci` (t12, `docs/evidence/t12-ci-local.log`). Its first run on GitHub is still the final proof on Linux.
- The audit step can fail on an advisory published after a change. That's intended: t9 made "no high-severity advisory" a gate.

## Verification

`docs/evidence/t12-ci-local.log`: every workflow step passes in a clean copy. The workflow file parses, and its steps are listed.

## Relations

Related to: [19. Pass --gl=angle per 3D render, never globally](0019-gl-angle-per-render.md), [25. Override zod to a patched version until Remotion ships one](0025-override-zod.md)
