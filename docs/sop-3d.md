# SOP: running and changing the 3D work

For the 3D upgrade of the cycling route video. Decisions: `docs/adr/`
(index in its README). What must be true: `docs/spec-3d.md`. How it fits
together: `docs/design-3d.md`.

Order for a fresh build of the 3D data: `python3 scripts/build_poc_data.py`, then
`npm run data:earthworks`, then `npm run data:sync`.

## Run

| Step | Command | Status |
|---|---|---|
| Install | `npm ci`, exactly as the lockfile says (the three.js packages are pinned per ADR 22; zod is overridden per ADR 25) | exists |
| Build the POC data (DTM window, land cover, trail profile, OSM features) | `python3 scripts/build_poc_data.py` (Python 3, numpy; network access to the lidar COG and the OSM API; about 20 s) | exists |
| Add the earthwork entries to the register | `npm run data:earthworks` (uses the same TypeScript core as the video) | exists |
| Copy source data to the runtime folder | `npm run data:sync` (ADR 21) | exists |
| Lint and type-check | `npm run lint` | exists |
| Unit, static, docs and acceptance tests | `npm test` | exists; the acceptance tests run on the real POC data, and `tests/docs.test.ts` fails if `docs/design-3d.md` and the code drift apart |
| Render checks: 2D regression, determinism, format, performance | `npm run test:render` | exists; appends results to `docs/validation-3d.md`. Set `REMOTION_PORT` if 3517 is taken |
| Preview | `npm run dev`, then pick `CyclingVision` (2D) or `Poc3DMaentwrog` (3D) | exists |
| Render the 2D video | `npx remotion render src/index.ts CyclingVision out/trawsfynydd-cycle-vision.mp4` | exists |
| Render the 3D POC | `npm run render:poc` (passes `--gl=angle`, ADR 19), or `npm run still:poc` for one frame | exists |

Never render 3D without `--gl=angle`, and never set the GL renderer in
`remotion.config.ts`. It changes the 2D video's pixels (ADR 19).

## Change

**A decision.** Don't edit an existing ADR's decision.
1. Add a new ADR with the next number, status Proposed, and a `Supersedes: N` or `Amends: N` line.
2. Set the old ADR's status to Superseded, with a `Superseded by: M` line.
3. Add the new ADR to `docs/adr/README.md` and update the matching row in `docs/design-3d.md`.
4. If an acceptance criterion changes, amend its row in `docs/spec-3d.md` with an italic note naming the ADR.

**Accepting an ADR.** Someone other than its author changes the status to
Accepted, updates the `Date:` line, and records the review in
`docs/validation-3d.md`.

**Route, station or profile data.**
1. Edit the file in `data/`.
2. Run `npm run data:sync`.
3. Run `npm test` and `npm run test:render`.

If the 2D baselines change because the data changed on purpose, re-capture them only with a reviewer's sign-off recorded in `docs/validation-3d.md`.

**A rendered feature** (structure, road, label, vegetation): add it to
`data/features-3d.json` with a category and source **before** rendering it
(ADR 20). A structure needs an OSM way with a structure tag or a Coflein
record (ADR 12). Anything approximate or proposed is labelled on screen.

**An asset** (model, texture): put it under `public/3d/` and add a
`data/assets-3d.json` entry with source, licence and attribution. If the licence requires
attribution, add it to the on-screen credits.

**Another route section (Phase 4).**
1. Add a composition under `src/scenes3d/` with a default export, and register it in
   `src/Root.tsx` with `lazyComponent` and `calculateMetadata`, never a static import
   (ADR 24), so three.js stays out of the 2D video's bundle.
2. Reuse `src/three-core/`, and add a pipeline window for the section.
3. Register the section's features and the `data/source-register.md` gaps that apply to it.

Don't edit `src/scenes/` or `src/CyclingVision.tsx` for 3D work (ADR 2).

**Upgrading Remotion.** Run `npx remotion upgrade`; it moves `@remotion/three`
with `remotion`. Check the other pins in ADR 22, then run every check above. If the new
Remotion depends on zod 4.6.6 or later, remove the `zod` override from `package.json`
(ADR 25); either way, `npm audit` should report no high-severity result. Until then, Remotion
warns "Version mismatch … zod" on every render; that warning is expected, so don't run the
`npx remotion add zod` it suggests.

## CI

`.github/workflows/ci.yml` runs on every push to `main`, on pull requests and on demand
(ADR 26). It runs on `ubuntu-24.04` with Node 24.13.1 and Python 3.13, and executes:
`npm ci`, `npm run lint`, `npm test`, `npm audit --audit-level=high`, the BNG self-test
and a compile check of the pipeline scripts, and `npm run build`. A red run blocks the merge.

The render checks aren't in CI: their baselines are pixel hashes from the development Mac,
and the 3D renders need a GPU. **Run `npm run test:render` locally before merging** any change to
`src/`, `public/data/`, `remotion.config.ts` or the Remotion and three.js versions, and add its
result to `docs/validation-3d.md` (the script appends it).

To check a workflow change before pushing, run its `run` steps in a clean copy of the files git
would ship, after a fresh `npm ci`. The t12 verifier did exactly this; its log is
`docs/evidence/t12-ci-local.log`. Bump a pinned action only to a release at least two weeks old,
and keep the comment with its version.

## Never

- Use `useFrame`, `requestAnimationFrame`, `setInterval`, `Date.now`, `performance.now` or unseeded `Math.random` in 3D code. Use `mulberry32` from `src/three-core/rng.ts` (ADRs 11, 17).
- Hard-code latitude/longitude in `src/`. All coordinates go through `project()` (ADR 5).
- Read React context inside `<ThreeCanvas>` (ADR 4).
- Present a proposed or approximate feature without its on-screen label, or describe DEM or OSM data as survey-grade.
