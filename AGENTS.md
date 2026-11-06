# Guidance for AI coding agents

Concise, project-specific rules for any agent (Claude Code, Codex, Copilot or another) working in this repository.
The human-facing setup is in `README.md`; the operating procedure for the 3D work is `docs/sop-3d.md`.

## What this project is

A concept visualisation, in Welsh and English, of a walking and cycling route on the mothballed Bala and Festiniog
Railway corridor between Blaenau Ffestiniog and Trawsfynydd. It is not an approved scheme. Every proposed or
approximate feature carries an on-screen label saying so, and nothing in the data is survey-grade.

Three deliverables share one code base:

| Deliverable | Entry point | Built with |
|---|---|---|
| `CyclingVision`, the 2D route video | `src/CyclingVision.tsx`, scenes in `src/scenes/` | Remotion |
| `Reel3D` and the section stills | `src/three-core/sections.ts`, `src/three/` | Remotion + Three.js |
| The community film and the social cuts | `src/data/community-film.ts`, `scripts/blender/`, `src/social/` | Blender 5.2 (EEVEE), Remotion |

## Commands

| Task | Command |
|---|---|
| Install | `npm ci` (the lockfile is the source of truth; `zod` is overridden on purpose) |
| Lint and type-check | `npm run lint` |
| Tests | `npm test` (needs Python 3 with numpy and Pillow for the pipeline self-tests) |
| Render checks before any change that affects pixels | `npm run test:render` (GPU, ffmpeg, about 10–30 minutes) |
| Preview | `npm run dev` |
| Rebuild a section's data | `npm run data:section -- <window>`, then `npm run data:sync` |
| Blender film | `npm run blender:export -- community`, `npm run blender:reel -- --dressed --film community`, then `scripts/blender/render_film.py` and `npm run film:encode` |

## Rules

- Read a file before editing it. Keep files under about 500 lines. Do not add documentation files unless asked.
- Never commit secrets, `.env` files, rendered output (`out/` is ignored) or assets whose licence is not recorded in
  `THIRD_PARTY_NOTICES.md` and `data/assets-3d.json`.
- Never change `tests/baselines/` or a visual baseline without the owner's explicit sign-off.
- Never use `useFrame`, `requestAnimationFrame`, timers, `Date.now` or unseeded `Math.random` in 3D code; use
  `mulberry32` from `src/three-core/rng.ts`. The one exception is documented in ADR 55.
- Never set the GL renderer in `remotion.config.ts`; 3D renders pass `--gl=angle` on the command line (ADR 19).
- Never hard-code latitude and longitude in `src/`; coordinates go through `project()` (ADR 5).
- Never load a texture or sky image except through `src/data/PhotoAssetsProvider.tsx` from `public/3d/` with an
  `assets-3d.json` entry (ADR 54).
- Never present a proposed or approximate feature without its label, or describe DEM or OSM data as survey-grade.
- After editing anything in `data/`, run `npm run data:sync`; a static test fails if `public/data/` differs.
- Captions are Welsh first, then English, with miles and mph on screen; distances stay metric inside the code.
- Decisions go in a new ADR under `docs/adr/` (template: `docs/adr/template.md`), not in edits to an old one.
- Commit only when the owner asks. Do not add a `Co-Authored-By` trailer. Never push, publish or upload renders
  without explicit authorisation.
- British English in documentation and comments.
