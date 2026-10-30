# 48. Overlays inside the safe area, captions paced for reading

Date: 2026-10-25

Scope: `src/three/Overlays.tsx`, `src/data/reel-captions.ts`, `docs/spec-3d.md` (RL17–RL21 ranges), `scripts/render-checks.mjs`

## Status

Proposed

## Context

Measured at t1:

- The badge sits 28 px from the top and 32 px from the right.
- The attribution sits 10 px from the bottom, in 12 px type.
- The caption box sits 80 px from the left.
- All three are outside the 5 % title-safe area (96 × 54 px).
- Captions read at up to 38 characters per second.
- Approximate and proposed features are not marked on screen, so RL9/G8 failed at t14.

## Decision

`Overlays.tsx` exports `SAFE = { x: 96, y: 54 }` and its style tokens, so tests can compute contrast and sizes. `OverlayLog` logs each overlay's rectangle and line count.

Captions are shortened or retimed in `reel-captions.ts` to at most 15 characters per second and at least 2.5 s on screen. The spec's frame ranges and the render checks' expected frames move in the same edit. The badge text and the closing card stay verbatim.

Approximate and proposed features get a hatched material and a legend line taken from curated text (ADR 38).

## Consequences

- Text stays legible at playback size, and the overlays clear the frame edges.
- The meaning and the disclaimers are kept; reviewers confirm it.

## Verification

Spec CL7–CL12; design D44.

## Relations

Amends: [36. Captions as data with frame ranges](0036-captions-as-data.md). Related to: [38. On-screen text comes only from curated files, never from OSM tags](0038-labels-from-curated-files.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- Only bridges, the approximate structures that are drawn, are hatched. Approved or demolished buildings would be translucent.
- `sectionLegend` names the hatching in ground scenes only and the translucent style when a section has it (t10).
- `OverlayLog` also logs each box's right and bottom edges, and the render checks fail a line count that is not a number.
