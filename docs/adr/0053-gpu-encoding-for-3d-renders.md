# 53. Encode 3D renders on the GPU, per command; the 2D video keeps software encoding

Date: 2026-10-25

Scope: `package.json`, `scripts/render-checks.mjs`

## Status

Proposed (asked for by the owner at t8: "use gpu")

## Context

3D frames are already drawn on the GPU. Under `--gl=angle`, WebGL reports "ANGLE Metal Renderer: Apple M4 Pro"; without the flag Chrome falls back to SwiftShader on the CPU (ADR 19). The remaining CPU of a reel render was mostly video encoding with libx264.

Measured at t8 on the reel, with software and hardware renders interleaved: hardware encoding (`h264_videotoolbox`) halved the render's CPU (370 and 355 s down to 182 and 176 s, under load) and gave identical decoded output on repeat. At Remotion's default bitrate, about 13.8 Mbit/s, the file was 4.25 times larger.

The quality test used reel frames 2050–2349 (Trawsfynydd) against a CRF 1 reference:

| Encode | SSIM | PSNR | Size per 10 s |
|---|---|---|---|
| libx264, default CRF | 0.99642 | 49.1 dB | 5.2 MB |
| VideoToolbox, 8 Mbit/s | 0.99604 | 48.2 dB | 8.8 MB |
| VideoToolbox, 10 Mbit/s | 0.99675 | 49.4 dB | 10.5 MB |
| VideoToolbox, 12 Mbit/s | 0.99723 | 50.4 dB | 12.2 MB |

## Decision

- 3D video renders (`render:poc`, `render:reel`, and the render checks' POC and reel renders) pass `--hardware-acceleration=if-possible --video-bitrate=10M`. That is the lowest bitrate tested whose SSIM and PSNR match software encoding.
- `if-possible` falls back to software encoding where VideoToolbox is missing, for example on Linux CI.
- Stills are PNG and are not affected.
- `remotion.config.ts` sets neither option, so the 2D video keeps software encoding and its decoded md5 baseline (RG1, RL25, X1), as ADR 19 keeps its GL renderer.

## Consequences

- 3D renders use about a third to a half less CPU and finish sooner.
- 3D files are about twice the size: the reel is about 110 MB instead of 37 MB.
- A hardware encode is repeatable on this machine. Across machines and encoders the bytes differ, so determinism checks compare decoded frames or stills, never file hashes across machines.

## Verification

A static test in `tests/static-3d.test.ts` (ADR 53) checks three things: the 3D render scripts and the checks' 3D renders carry the flags, the 2D render does not, and the config sets neither option. The t8 benchmark in `docs/validation-3d.md` records the timings.

## Relations

Extends: [19. Pass --gl=angle per 3D render, never globally](0019-gl-angle-per-render.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- Measured on the final code: the reel file is about three times the size (111 MB against 36.5 MB) and the POC about twice (13.8 MB against 6.7 MB).
