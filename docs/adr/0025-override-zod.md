# 25. Override zod to a patched version until Remotion ships one

Date: 2026-10-25

Scope: `package.json` (`overrides`), `package-lock.json`

## Status

Proposed

## Context

The security review (task t9) found `npm audit` reporting 10 high-severity results with one cause: zod 4.5.4, which every `@remotion/*` 4.0.538 package pins exactly, is affected by GHSA-mrhx-c7xc-m3w5 ("Zod can exhaust memory while validating oversized constrained collections", fixed in 4.6.6). Remotion 4.0.538 is the latest release, so upgrading Remotion doesn't help, and `npm audit fix --force` would downgrade Remotion to 4.0.277. In this project the Studio server validates its API requests with zod, and the Studio listens on every network interface (see docs/validation-3d.md, security review), so a client on the local network could send it an oversized request.

## Decision

`package.json` overrides zod to exactly 4.6.7 (published 2026-10-12, the latest patch at the time of the review) for every package that depends on it. Nothing else in the lockfile changes.

## Consequences

- `npm audit` reports 0 vulnerabilities.
- Remotion runs on a zod minor version it doesn't declare. 4.5 → 4.6 is a minor release within zod 4; lint, the tests and the render checks pass on it, and the Studio server loads.
- Remotion's version check prints a "Version mismatch … zod: installed 4.6.7, required 4.5.4" warning on every bundle and render, and suggests `npx remotion add zod`. Don't follow that suggestion while this override stands: it would reinstall the vulnerable 4.5.4. The full test run (t11, `docs/evidence/t11-full-suite.log`) passed with the warning showing.
- The override must be removed once a Remotion release depends on zod 4.6.6 or later; otherwise it would hold zod back. `docs/sop-3d.md` ("Upgrading Remotion") says so.

## Verification

`npm ls zod` shows only 4.6.7; `npm audit` reports 0 vulnerabilities; `npm run lint`, `npm test` and `npm run test:render` pass.

## Relations

Related to: [22. Pin the three.js dependencies exactly, without drei](0022-pin-three-deps.md)
