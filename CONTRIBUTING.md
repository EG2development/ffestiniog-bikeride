# Contributing

Diolch am eich diddordeb. Thank you for your interest in this community concept.

This repository holds a concept visualisation of a walking and cycling route on the mothballed Bala and Festiniog
Railway corridor between Blaenau Ffestiniog and Trawsfynydd. It is **not** an approved scheme, an engineering design or
a statement about land ownership. Contributions that keep that honesty are welcome: better evidence, clearer
captions, corrections to the Welsh, and improvements to the pipeline.

## Before you start

- Read `README.md` for the setup and the commands, and `docs/sop-3d.md` for how the 3D work is run and changed.
- Decisions are recorded as ADRs in `docs/adr/`. If a change alters a decision, add a new record rather than editing
  the old one (the template is `docs/adr/template.md`).
- Open an issue first for anything larger than a fix, so the direction can be agreed before the work.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Run the checks that CI runs: `npm run lint`, `npm test`, `npm audit --audit-level=high` and `npm run build` (CI also
   byte-compiles the Python pipeline and runs its BNG self-test). The render checks (`npm run test:render`) need a GPU,
   ffmpeg and Python with numpy and Pillow; run them locally before changing anything that affects rendered pixels.
3. Keep data honest: `data/source-register.md` records where every figure and dataset came from. If you add data,
   add its source and licence there, and run `npm run data:sync` so `public/data/` matches.
4. Keep captions bilingual, Welsh first, with miles and mph on screen (`src/data/reel-captions.ts`).
5. Do not commit rendered output (`out/` is ignored), credentials, or assets whose licence does not allow
   redistribution. Third-party assets are listed in `THIRD_PARTY_NOTICES.md`; add yours there.
6. Open a pull request describing what changed and why. CI must pass.

## Style

- British English in documentation and comments.
- TypeScript and Python files stay under about 500 lines; split rather than grow.
- Commit messages follow the existing pattern: `type(scope): summary`, for example `fix(captions): …`.

## Reporting a security problem

Please do not open a public issue. See `SECURITY.md`.

## Licence

By contributing you agree that your contribution is licensed under the licence in `LICENSE`, and that any
third-party material you add is compatible with it and recorded in `THIRD_PARTY_NOTICES.md`.
