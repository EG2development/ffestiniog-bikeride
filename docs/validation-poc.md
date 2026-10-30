# Validation log: proof of concept (mission `msn_abdfd5eabd397f0f653da39f`)

The first mission's task records, moved here on 2026-10-25 when `docs/validation-3d.md` neared the 500-line limit.
The review checklist, the measurements and the baselines stay in `docs/validation-3d.md`; the reel mission's records follow them there.

## Benchmark against the pre-3D baseline (t8, 2026-10-25)

**Snapshots.**
- *Baseline:* the project as it was before any 3D code, rebuilt from the current tree by reversing, in order, the 13 recorded edits made since the 3D work began, to `src/Root.tsx`, `src/data/route.ts`, `remotion.config.ts` and `package.json`. The 3D source and the 3D public data are removed. It type-checks.
- *Candidate:* the current worktree.

Both are bound by sha256 over `src`, `public` and the config files: baseline `8e892b0d…4ad3`, candidate `6a053398…23f7`, which equals the worktree. They share `node_modules`.

**Method.**
- Commands: the CLI, so `remotion.config.ts` applies. `remotion bundle --bundle-cache=false`, then `remotion render <bundle> CyclingVision`.
- Order: interleaved, B C C B B C and then C B B C C B, so drift and background load fall on both sides equally.
- Machine: Apple M4 Pro, 14 cores, Node 24.13.1, Remotion 4.0.538. The load average was 10–24 from other processes, including the Remotion Studio on port 3000.
- CPU is user plus system time of the command and its child processes.

**Results** (n = 6 per side, means; p from Welch's t-test):

| Measurement | Baseline | Candidate | Change | Verdict |
|---|---|---|---|---|
| 2D output, md5 of the decoded video (3150 frames) | `adfca9a7…` | `adfca9a7…` (12 of 12 renders) | identical; mp4 129,722,615 bytes on both | no worse |
| 2D render wall time | 35.52 s (sd 0.79) | 35.14 s (sd 0.47) | −1.1 %, p = 0.34 | no worse |
| 2D render CPU time | 335.4 s (sd 4.0) | 338.7 s (sd 1.7) | +1.0 %, p = 0.12, within the baseline's own spread (329.7–338.6 s) | no measurable change |
| Bundle plus render, wall time | 36.54 s | 36.19 s | −1.0 % | no worse |
| JavaScript the 2D page loads (entry `bundle.js`) | 1,329,917 B | 1,333,725 B | +3.8 KB (+0.29 %), the lazy registration of the 3D composition; no three.js in it | no worse in effect |
| `tests/route.test.ts` | 0.22 s, 6 tests pass | 0.22 s, 6 tests pass | same | no worse |
| Bundle step, wall / CPU | 1.02 s / 1.84 s | 1.05 s / 2.04 s | +30 ms (p = 0.15) / **+0.20 s (+10.8 %, p < 0.001)** | worse: the cost of compiling the lazy 3D chunk, 0.06 % of the CPU for bundling plus rendering |
| Bundle on disk, JavaScript / total | 15.5 MB / 38.9 MB | 18.4 MB / 47.9 MB | the 3D chunk and the 3D data in `public/data` | new content, not fetched by the 2D video |

**3D POC against RN6** (no baseline; budget confirmed):
- Speed: 0.0163–0.0166 s per frame over 4 full renders, against a budget of ≤ 2 s.
- Load: 55 draw calls and 1,141,172 triangles, against ≤ 300 and ≤ 2 M. That's above the design's estimate (about 32 calls and 0.9 M triangles) but within budget.
- Output: all 4 renders were bit-identical (`13c6ee4d…`), with 0 blank frames.

**Found and fixed during the benchmark.**
1. *three.js was in the 2D video's bundle.* `src/Root.tsx` imported the POC statically, which put three.js and React Three Fiber in the entry chunk every composition loads: 3.97 MB, against 1.33 MB before the 3D work.

   Fix: ADR 24, lazy registration. The entry chunk went back to 1.33 MB. Test: `static-3d` "ADR 24".
2. *A blank first frame in the 3D render.* One full POC render had one frame whose canvas was black while the overlays were drawn. It was frame 6, probably the first frame of one of the 7 render tabs.

   Cause: both data providers released their `delayRender` hold straight after `setState`. Until React committed and `<ThreeCanvas>` registered its own hold, no hold was pending, so Remotion could capture in that gap.

   Evidence:
   - With that gap widened to 300 ms, the old order gave 124 blank frames out of 126. The fixed order, which releases the hold in an effect after the children mount, gave 0 out of 126.
   - The natural race didn't recur in 448 first frames of short stress renders: 224 unfixed with no added load, then 112 unfixed and 112 fixed with 14 CPU burners running.
   - After the fix, 4 of 4 full renders were identical, with 0 blank frames.

   Fix: spec RN5(c), test `static-3d` RN5c, and a new render check that scans every frame of the full POC render for a blank canvas. The fix closes the window the symptom fits. A cause at the level of Chrome's compositor can't be ruled out, which is why the full-render scan is now part of the gate.

**Follow-ups, not done here.**
- three r186 logs "PCFSoftShadowMap has been removed. Using PCFShadowMap instead". Passing `shadows="percentage"` would silence it, since that is the mode already in use.
- `scripts/render-checks.mjs` uses Pillow's `getdata`, which is deprecated and goes in Pillow 14 (2027-10).

## Security review (t9, 2026-10-25)

**Scope:** the project as it is used:
- dependencies;
- the data pipeline: network downloads, and TIFF and JSON parsing;
- data read at render time;
- scripts that start child processes;
- secrets and local state that could be committed;
- the Remotion Studio and render servers the project runs.

There is no deployed service. **Severity** is rated in context: npm's rating is given where it applies, and a CVSS 3.1 estimate otherwise.

| # | Finding | Severity | Disposition |
|---|---|---|---|
| F1 | `npm audit`: 10 high results, all from zod 4.5.4 (GHSA-mrhx-c7xc-m3w5, memory exhaustion on oversized constrained collections). zod is pinned exactly by every `@remotion/*` package; 4.0.538 is the latest Remotion. Reachable through the Studio server's request validation (see F2). | High (npm) | **Fixed.** `package.json` overrides zod to 4.6.7 (ADR 25); the lockfile change is that one package. `npm audit`: 0 vulnerabilities. |
| F2 | Remotion Studio (`npm run dev`) listens on every interface. `getHostToBind` returns `::` or `0.0.0.0`, and there is no localhost option. Its API has unauthenticated routes that delete and download files in `public/` and edit source files. Its same-origin check stops browsers, not a client on the network that sets `Origin` and `Host`. The macOS firewall was off, and the Studio answered on the LAN address (HTTP 200). Upstream behaviour, not introduced by the 3D work. | High (CVSS 3.1 estimate 7.6: AV:A/AC:L/PR:N/UI:N/C:L/I:H/A:L) | **Accepted by the project owner on 2026-10-25** for the current trusted home or office network, on condition that the Studio is stopped on untrusted networks such as public Wi-Fi. Recommended mitigation: turn on the macOS firewall and block incoming connections for node. Review again if Remotion adds a host option. |
| F3 | Local agent databases built from session content were not git-ignored: `.swarm/` (3 MB), `ruvector.db`, `agentdb.rvf`, `agentdb.rvf.lock`. No secrets or email addresses were found in them. | Medium | **Fixed.** They are now in `.gitignore`. Left for the owner to decide: `.claude-flow/` (except the subfolders already ignored; it holds the mission task store and 12 home-directory paths) and `.idea/`. |
| F4 | `Scene3DDataProvider` used file names from `dem-poc.json` and `landcover-poc.json` in fetch paths unchecked, and didn't check the binary files' sizes against the grid. The project rule is to validate input at system boundaries. | Low | **Fixed.** `dataFileName` (plain names only: no directories, no `..`) and `expectGridBytes` (one value per cell) in `src/three-core/registers.ts`, with 4 tests in `tests/registers.test.ts`. |
| F5 | The render server also listens on every interface while a render runs. It serves the bundle and the public data read-only, and its OffthreadVideo endpoint fetches only `http(s)://` and `data:` URLs, so there is no local file read. | Low | **Accepted.** It only runs during a render, and the same network condition as F2 applies. |
| F6 | The pipeline's downloads (the lidar COG on Azure Blob, the OSM API) are HTTPS with default certificate checks, timeouts and fixed hosts, but their content isn't pinned by hash. | Low | **Accepted.** The derived data is committed and checked by the acceptance tests (G2, G6, G7). |
| F7 | `scripts/dem/cog.py` takes IFD counts, tile offsets and byte counts from the remote header and uses them for range requests and `zlib.decompress` without bounds. A corrupted or hostile response could exhaust memory. | Low | **Accepted.** It reads one fixed official HTTPS source in a manual pipeline step. |

**Checked and clean:**
- *Secrets:* none in the worktree, the git history or the local databases. The passwords in `.claude/agents/sparc/refinement.md` are sample test code from vendor documentation.
- *Dangerous code:* no `eval`, `new Function`, `innerHTML` or `dangerouslySetInnerHTML`; no shell use, since child processes go through `execFileSync` with argument arrays; Python runs with `-I`. On-screen text from data is rendered as React text.
- *Unpinned hooks:* none of the 16 project hooks, nor any local or plugin hook, runs an unpinned `npx` package.

**Gates after the fixes:**
- `npm run lint` exits 0;
- `npm test`: 76 of 76 pass;
- `npm audit`: 0 vulnerabilities;
- `npm run test:render`: all checks pass, including RG1.

## Code review (t10, 2026-10-25)

**Reviewer:** an independent `/code-review` agent at effort "high" that didn't write the code. It read `src/three-core`, `src/three`, `src/scenes3d`, `src/data`, `src/Root.tsx`, `scripts` and `tests`.

**Verification:** the author verified each finding against the code, measured it on the real POC data where possible, and wrote a failing test before each fix. This doesn't replace the human sign-off in the review checklist above.

| # | Finding | Verified | Disposition |
|---|---|---|---|
| R1 | `RouteDataProvider` had no `.catch` or `cancelRender` and didn't check the HTTP status, so a failed load hung until Remotion's timeout, with a generic message. | Read in the code. | **Fixed.** Both providers check the HTTP status, and `RouteDataProvider` passes errors to `cancelRender`. Static test RN5d. |
| R2 | The POC's `OVERLAYS` diagnostic was a hard-coded list. It claimed a `ve-label` that no JSX rendered, so the H2a/L2/G3 render check couldn't fail. | Read in the code. | **Fixed.** Each overlay carries a `data-overlay` marker on a `display: contents` wrapper, so pixels are unchanged. `OverlayLog` reads the markers from the page after each commit, and a non-fading `VeNote` renders whenever `ve ≠ 1`. Static test; the render check now passes against the page. |
| R3 | Trees used `h / 10` without the vertical exaggeration, and corridor cut and fill depths came out multiplied by it. | Read in the code; latent at `ve = 1`. | **Fixed.** `placeTrees` and `flattenCorridor` take `ve`. Tests in `trees.test.ts` and `corridor.test.ts`. It also turned up a related defect: passing partial options to `placeTrees` dropped every default, so no tree was placed. Options now merge with the defaults. |
| R4 | Trees were kept clear of the trail only, so some stood on roads. | Measured: 80 of 6,000 trees on a carriageway, 133 within 2 m of one. | **Fixed.** Trees are kept 2 m off every registered road's carriageway (spec G7, design D9). Tests on synthetic and real data; now 0. |
| R5 | `heightAt` was the bare DTM, and it drove both road draping and camera clearance, so roads were buried where the corridor sits on fill. | Measured: 696 of 9,570 road vertices below the rendered terrain, the worst by 3.23 m. | **Fixed.** `scene.heightAt` is now the rendered ground: the flattened mesh, read with the DEM's own bilinear lookup. It's used for camera clearance (spec CA3). Roads drape on the higher of the bare DTM, which keeps the decks over the line, and the rendered ground. Acceptance test. |
| R6 | `build_poc_data.py` could raise IndexError when a bridge span ran past the end of the profile. | Reproduced with a span past the end. | **Fixed.** `interpolate_spans` clips spans to the profile and skips any outside it. Checked inline for the past-the-end, outside and interior cases; in-range spans behave as before. |
| R7 | With no terrain under the camera (−∞), the drone track gave NaN matrices and rendered silently as sky. | Read in the code; latent with the current shots. | **Fixed.** The camera throws "no terrain under (x, z)". Test in `camera.test.ts`. |
| R8 | The trail profile, the OSM lines and the DEM header's numbers were cast and used unchecked, against the project rule to validate input at system boundaries. | Read in the code. | **Fixed.** `validateDemHeader`, `validateLandCoverHeader`, `validateTrailProfile` and `validateOsmLines` each throw naming the JSON path. 4 tests in `registers.test.ts`. |
| R9 | Duplicated code: the `OsmLine` and `OsmFeature` types; the `/ 10` metres-to-world scale and the left-of-travel normal repeated across modules. | Read in the code. | **Partly fixed.** There's now one `OsmLine` type in `registers.ts`. **Accepted for now:** a shared world-scale helper and normal function, deferred to the Phase 3 component work. It would touch every 3D module without changing behaviour, and the concrete bug it caused (R3) is fixed and tested. |
| R10 | Each render tab runs the full BNG→WGS84 conversion for 343k nodes, and the two header JSONs were fetched one after the other. | Read in the code. | **Partly fixed:** the headers are fetched in parallel. **Accepted:** the per-node conversion, since the measured speed is 0.016 s per frame against a 2 s budget (t8). |
| R11 | *Found while verifying R5.* A road cross-section was flat at its centreline height, so on side slopes the uphill edge was buried (684 vertices, up to 1.40 m). Draping only the two edges then buried centres on ground convex across the road (up to 2.6 m). | Measured both. | **Fixed.** Cross-sections have three vertices (left, centre, right), each draped. All 14,350 vertices now sit 0.300 m above the rendered ground. **Accepted residual:** 29 of 9,567 points midway between vertices dip below the ground, the worst by 0.59 m, on convex ground finer than the 4 m terrain grid. |
| D1 | *The author's own finding.* `docs/prior-art-3d.md` cited line numbers that later changes moved. | Checked. | **Fixed.** It now cites symbols, and notes the RN5c change to the data-loading pattern. |

**Gates after the fixes:**
- `npm run lint` exits 0;
- `npm test`: 87 of 87 pass;
- `npm run test:render`: all checks pass. RG1 matches its 4 frames; RN2 is deterministic; the RN5b full-render scan finds no blank frame (luma 50.8–95.0); RN6 counts 55 draw calls and 1,150,462 triangles.
- `out/poc-maentwrog.mp4` was re-rendered and has no blank frames. Frames 100 (drone) and 200 (follow) were checked by eye.

## Full test run (t11, 2026-10-25)

The whole suite was run in one pass at 12:12:03–12:13:38Z. The full output, with every command, its exit code and its duration, is kept in `docs/evidence/t11-full-suite.log` (sha256 `326e5fc7…6dd25b76`).

**Source.** The log binds the run to a sha256 of the source: `6f648548…a620bb`, taken over the 269 files in `src`, `public`, `scripts`, `tests`, `data`, the configs and the lockfile. Git HEAD is `4493c87`, and the 3D work is uncommitted.

**Machine.** Apple M4 Pro with 14 cores, Node 24.13.1, Python 3.13.5 and numpy 2.4.4.

| Step | Command | Result |
|---|---|---|
| Lint and type-check | `npm run lint` | pass |
| Unit, static and acceptance tests | `npx vitest run --reporter=verbose` | 14 files, **87 of 87** pass, each test listed in the log |
| BNG transform self-test | `python3 -I scripts/dem/bng.py` | pass |
| Pipeline scripts compile | `python3 -I -m py_compile scripts/…` | pass |
| Dependency audit | `npm audit --audit-level=high` | 0 vulnerabilities |
| Build | `npm run build -- --out-dir=out/bundle` | pass |
| Render checks | `npm run test:render` | all pass: RG1 (4 frames), RN2, RN3, RN5b (full render, no blank frame), RN6 (55 calls, 1,150,462 triangles), H2a/L2/G3 |
| CyclingVision renders in full | `remotion render … CyclingVision` | pass: h264, 1920×1080, 30 fps, 3,150 frames |
| The 2D render matches the pre-3D baseline | decoded md5 of the full render | `adfca9a7…` = baseline |

**Known warnings, none failing:**
- Remotion's "Version mismatch … zod" notice, the expected result of the ADR 25 override; don't run the `npx remotion add zod` it suggests.
- three.js deprecates `require("three")`, because an acceptance test imports the scene module.
- React Three Fiber 9.8.2 uses `THREE.Clock`, which three 0.186 deprecates.
- Pillow's `getdata` is deprecated (an existing follow-up).

## Build and CI (t12, 2026-10-25)

**Workflow.** The project had no CI. `.github/workflows/ci.yml` now runs the portable checks (ADR 26):
- `npm ci`;
- lint and type-check;
- `npm test`;
- `npm audit --audit-level=high`;
- the BNG self-test and the pipeline compile check;
- `npm run build`.

It runs on `ubuntu-24.04` with Node 24.13.1, Python 3.13 and numpy 2.4.4. Its permissions are read-only, and each action is pinned to a commit SHA of a release at least two weeks old: checkout v7.0.1, setup-node v7.1.0 and setup-python v7.0.0 (v7.1.0 was only 3 days old). The render checks stay a local gate (see `docs/sop-3d.md`, "CI").

**Verified before any push** (`docs/evidence/t12-ci-local.log`). The repository has no remote yet.

| Check | Result |
|---|---|
| Workflow file parses; triggers push, pull_request and workflow_dispatch; `permissions: contents: read`; all 3 actions pinned to full SHAs | pass |
| Clean copy of the 905 files git would ship, with no `node_modules` and no `out/` | made |
| The workflow's own `run` steps in that copy, in order: `npm ci` (393 packages from the lockfile), numpy, lint, tests (87 of 87), audit (0 vulnerabilities), pipeline checks, build | all pass |
| The lockfile has a Linux x64 build for every macOS-arm64 native package (esbuild, rspack, rolldown, lightningcss, the Remotion compositor) | pass |
| Linux file-name case: 34 data-file references and 170 relative imports match their files exactly; TypeScript's `forceConsistentCasingInFileNames` is on | pass |

**Not verified:** the run on a Linux runner itself. The project owner chose not to run the workflow in a local Linux container (`act` with Docker). The first run on GitHub after the repository is pushed is the final check on Linux.

**Also changed:** `build` is now git-ignored, because `npm run build` writes the bundle there by default.

## Independent validation (t14, 2026-10-25)

**Validator.** An independent `production-validator` agent that didn't build the work checked every acceptance criterion: the 50 spec rows, the brief's §12 criteria and the mission's criteria a–h. It re-derived each result itself. It re-ran the tests and gates, rendered its own frames and a full video of each composition, ran a numeric check on the real data that calls `project()` directly, and viewed the frames. It did not take this log at face value. Its full report, including a re-check after the fixes, is `docs/evidence/t14-independent-validation.md`.

| Set | Pass | Partial | Fail | Not yet (later phase) |
|---|---|---|---|---|
| Spec rows (50), after fixes | 37 | 1 (C1) | 0 | 12 (all P3–P5) |
| Brief §12 (12) | 6 | 5 | 0 | 1 (#5, multiple sections) |
| Mission a–h | 7 | 1 (g, memory, fixed after the run) | 0 | 0 (the hosted CI run awaits a remote) |

**The validator's own measurements:**
- The 2D video still matches its baseline: 4 stills by sha256, and the full render's decoded MD5 is `adfca9a7…`.
- POC frames 0, 180 and 359 are byte-identical across 3 renders.
- 55 draw calls and 1,150,462 triangles per frame; the clip renders in 6 s.
- Trail against `project()`: error 0. Terrain against the route's elevations: median 2.7 m, maximum 12.6 m.
- Maximum gradient 11.9 % at 9,016 m; the rider rides at 15.1–16.2 km/h and pedals at 75 rpm.
- The camera stays at least 3.2 m above the rendered ground and at least 8.7 m from the rider.

| # | Finding | Disposition |
|---|---|---|
| D1 | H3: the closing caption was fully visible for only 1 s | **Fixed.** Fully visible on frames 210–359 (5 s), top-left, clear of the rider. Re-checked: pass. The render check requires it at frames 210 and 359 |
| D2 | C1: the test checks constants the view doesn't use | **Accepted.** The validator measured the rendered model: 1.68 m high, 1.73 m long, wheel Ø 0.682 m, which meets C1. Deriving the view from `CyclistDims` belongs to the Phase 3 reusable cyclist component |
| D3 | C8: the cyclist wasn't in the asset register | **Fixed.** Registered in `data/assets-3d.json`, and the test asserts it. Re-checked: pass |
| D4 | The overlay check tested presence, not visibility | **Fixed.** It now logs only overlays with an effective opacity ≥ 0.9 and a non-empty box. Re-checked: pass. **Accepted residual:** `visibility: hidden`, transparent text, a box off-screen or an overlay covered by another element wouldn't be caught. None applies to the current code |
| D5 | Lidar licence unconfirmed; the screen shows "(OGL)", not the full statement | **Accepted for the POC; blocks release.** Confirm the licence on the DataMapWales layer metadata and show the required wording before any publication (risk K2) |
| D6 | No landmark labelled on screen; the km 9.00–9.02 dip unexplained | **Accepted for the POC.** Landmark labels come with Phase 4 sections. The dip stays a listed gap in `data/source-register.md` |
| D7 | Memory entries missing for t2, t5 and the outcome | **Fixed** (ruflo `patterns`: `t2-spec`, `t5-pseudocode`, `t14-validation`, `mission-outcome-poc`) |
| D8 | Spec TR2 named `elevation-profile.json` | **Fixed.** Re-checked: pass |
| D9 | ADR index numbering; ADR 14's dimensions | **Fixed.** Re-checked: pass. ADR statuses are the owner's decision (see the checklist) |
| D10 | Review checklist still "pending" | **Fixed.** Filled in above from the validator's verdicts |
| D11 | `__pycache__` not git-ignored | **Fixed.** Re-checked: pass |

**Validator side effects, disclosed:**
- Its CI compile step rewrote 4 untracked `.pyc` files.
- In the first run it downloaded Chrome Headless Shell into scratch and then deleted it, against its no-network instruction.
- `npm audit` contacted the registry.

None changed a tracked or committed file.

## Render check results (proof-of-concept mission)


### Render checks 2026-10-25T09:56:05.049Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | FAIL | Error  Error: Could not find composition with ID Poc3DMaentwrog. Available compositions: CyclingVision, MyComp |
| RN3/RN6 POC format and speed | FAIL | Error  Error: Could not find composition with ID Poc3DMaentwrog. Available compositions: CyclingVision, MyComp |
| RN6 draw calls and triangles; H2a/L2/G3 overlays | FAIL | Error  Error: Could not find composition with ID Poc3DMaentwrog. Available compositions: CyclingVision, MyComp |
| RN5b terrain drawn at frame 0 | FAIL | no frame-0 still (previous check failed) |

### Render checks 2026-10-25T10:12:53.379Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | FAIL | a delayRender timed out |
| RN6 draw calls and triangles; H2a/L2/G3 overlays | FAIL | frame 0: no THREE_STATS line |
| RN5b terrain drawn at frame 0 | pass | 373 distinct colour bins |

### Render checks 2026-10-25T10:19:14.028Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN6 draw calls and triangles; H2a/L2/G3 overlays | FAIL | Error while getting compositions: Tried to go to http://localhost:3000/index.html and verify that it is a Remotion project by checking if window.getStaticCompositions is defined. |
| RN5b terrain drawn at frame 0 | pass | 373 distinct colour bins |

### Render checks 2026-10-25T10:20:11.186Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN6 draw calls and triangles; H2a/L2/G3 overlays | pass | f0: 55 calls, 1140544 tris; f180: 55 calls, 1140544 tris; f359: 55 calls, 1140544 tris |
| RN5b terrain drawn at frame 0 | pass | 373 distinct colour bins |

### Render checks 2026-10-25T10:23:52.341Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN6 draw calls and triangles; H2a/L2/G3 overlays | pass | f0: 55 calls, 1143764 tris; f180: 55 calls, 1143764 tris; f359: 55 calls, 1143764 tris |
| RN5b terrain drawn at frame 0 | pass | 383 distinct colour bins |

### Render checks 2026-10-25T10:26:51.528Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN6 draw calls and triangles; H2a/L2/G3 overlays | pass | f0: 55 calls, 1141172 tris; f180: 55 calls, 1141172 tris; f359: 55 calls, 1141172 tris |
| RN5b terrain drawn at frame 0 | pass | 383 distinct colour bins |

### Render checks 2026-10-25T11:08:38.911Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 50.2–95.0 |
| RN6 draw calls and triangles; H2a/L2/G3 overlays | pass | f0: 55 calls, 1141172 tris; f180: 55 calls, 1141172 tris; f359: 55 calls, 1141172 tris |
| RN5b terrain drawn at frame 0 | pass | 383 distinct colour bins |

### Render checks 2026-10-25T11:16:59.523Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 50.2–95.0 |
| RN6 draw calls and triangles; H2a/L2/G3 overlays | pass | f0: 55 calls, 1141172 tris; f180: 55 calls, 1141172 tris; f359: 55 calls, 1141172 tris |
| RN5b terrain drawn at frame 0 | pass | 383 distinct colour bins |

### Render checks 2026-10-25T12:09:35.751Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 50.8–95.0 |
| RN6 draw calls and triangles; H2a/L2/G3 overlays | pass | f0: 55 calls, 1150462 tris; f180: 55 calls, 1150462 tris; f359: 55 calls, 1150462 tris |
| RN5b terrain drawn at frame 0 | pass | 382 distinct colour bins |

### Render checks 2026-10-25T12:12:47.133Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 50.8–95.0 |
| RN6 draw calls and triangles; H2a/L2/G3 overlays | pass | f0: 55 calls, 1150462 tris; f180: 55 calls, 1150462 tris; f359: 55 calls, 1150462 tris |
| RN5b terrain drawn at frame 0 | pass | 382 distinct colour bins |

### Render checks 2026-10-25T12:40:30.564Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 50.8–95.0 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 55 calls, 1150462 tris; f45: 55 calls, 1150462 tris; f180: 55 calls, 1150462 tris; f359: 55 calls, 1150462 tris |
| RN5b terrain drawn at frame 0 | pass | 382 distinct colour bins |

### Render checks 2026-10-25T12:44:48.208Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 50.8–95.0 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 55 calls, 1150462 tris; f45: 55 calls, 1150462 tris; f180: 55 calls, 1150462 tris; f210: 55 calls, 1150462 tris; f359: 55 calls, 1150462 tris |
| RN5b terrain drawn at frame 0 | pass | 382 distinct colour bins |
