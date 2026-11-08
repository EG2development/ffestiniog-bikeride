# 62. A Blender build fed by the project's own scene data, pinned to Blender 5.2.3 LTS

Date: 2026-10-30

Scope: the planned Blender build ([plan](../blender-build-plan.md), [design](../design-blender.md), [research](../research-blender.md));
built 2026-10-31 to 2026-11-06 (see "As built" below)

## Status

Proposed

## Context

The owner asked for the Blender implementation to be researched and documented ready to build. The plan of 29–30
October set the goals (a native Blender film with a richer landscape and an inclusive cast) but left the toolchain,
the data contract and the checks open, and parts of it predated ADRs 60 and 61. Research on 30 October
([research-blender.md](../research-blender.md)) found: Blender 5.2 LTS is current (patch 5.2.3), and 5.x breaks most
published 4.x scripting (the Action API, Geometry Nodes inputs, output formats); Cycles on this Mac's GPU runs at about
a quarter of an RTX 4090 and is not bit-repeatable; GIS add-ons fetch coarser live data; a JSON manifest with binary
sidecars imports two orders of magnitude faster than glTF instancing; the lidar's coarse levels are point samples; and
licence-clean assets cover most, not all, of the cast and landscape.

## Decision

- **Toolchain:** Blender **5.2.3 LTS**, installed from the sha256-pinned DMG or Homebrew `blender@lts`, and
  `bpy==5.2.3` for headless tests. Upgrades are deliberate, with the import tests re-run.
- **One source of truth:** a Node exporter calls `buildSectionScene(cfg, inputs, "photo")` and evaluates every
  per-frame function (camera, rider, people) into arrays. It writes a versioned JSON manifest (schema, provenance with
  input hashes, transform, control points) and raw little-endian sidecars with dtype, shape, length and sha256. No
  geometry, placement or motion is recomputed in Python; GIS add-ons are not used.
- **Mapping:** three.js units → Blender metres by `10 · M · (p − origin)` with `M` a +90° rotation about X. Cameras
  use `sensor_fit = 'VERTICAL'` and the vertical field of view, one camera per shot with linear keys, and source frame
  `f` is Blender frame `f + 1`.
- **Import** uses Blender 5.2's API only: `foreach_set` meshes and attributes, point meshes with Geometry Nodes
  instancing (never realised), and action slots and channelbags for keys. People are keyed from their exported paths,
  with clips on distance-driven NLA strips.
- **Render:** Cycles on Metal with a fixed sample count and noise threshold, an animated seed, the GPU denoiser and
  AgX. Output is a resumable PNG sequence per section, assembled in the Video Sequencer (View = Standard). A section
  enters Remotion only as ProRes, never as thousands of files in `public/`.
- **Checks:** package hashes; transfer ≤ 0.05 m; camera ≤ 0.5 px against three.js; contact and clearance; same-machine
  image tolerance (`oiiotool --fail 0.016 --failpercent 1`). Bit-exact repeatability is not claimed.
- **Assets:** CC0 first, then CC BY with registered attribution. Royalty Free assets stay out of the public repository.
  No non-commercial (NC) licences, no AI-generated assets, and every file is registered in `data/assets-3d.json` (spec
  L1). Gaps are modelled in-house: heather, bracken and rushes, a hand-cycle, North Wales drystone, textured hair and
  darker skin textures.
- **Close-ups:** trees near the camera come from a 1 m canopy model (pit-filled, height-dependent local maxima,
  allometric crowns), labelled approximate and leaf-off. The 4 m canopy stays for distant views.
- **Disk:** every render first checks free space against measured bytes per frame, and frames are deleted once a
  section is encoded.

## Consequences

- The three.js reel stays the geographic and timing reference; the Blender film can be compared camera for camera.
- Final renders cost tens of seconds a frame on this Mac (45 hours for the reel at 60 s per frame); the plan's phases
  benchmark before committing to quality settings.
- Image checks are statistical, unlike the three.js pipeline's byte-identical frames.
- This machine's free disk (about 5 GB) does not hold the reel's frames; an external volume or section-by-section
  encoding is required.

## Verification

As built: `tests/blender/` holds vitest checks of the coordinate contract, the interchange package and the reel build; the
Blender-side checks (version, engine, view transform, objects) are reported by the import and build scripts themselves.

## As built (2026-11-06)

The build followed the decision with three changes, recorded in `docs/design-blender.md` §5 and
`docs/film-enhancement-2026-11.md`: the films render in EEVEE (the render settings in `scripts/blender/landscape.py`,
finished by `finish.py`), not Cycles on Metal; the frames are encoded by `scripts/film/encode.mjs` with ffmpeg instead
of being assembled in the Video Sequencer; and Blender runs on Windows, found by `scripts/blender/lib.mjs` and started
with `--factory-startup`. The exporter is `scripts/blender/export-section.ts`; the scene builders are
`import_blockout.py` and `build_reel.py`.

## Relations

Related to: [54. A photoreal look as a layer](0054-photoreal-layer.md), [60. The reel in the photo look](0060-reel-in-the-photo-look.md), [61. Trail users at random](0061-trail-users-at-random.md), [5. Shared projection at true scale](0005-shared-projection-true-scale.md).
