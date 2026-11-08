# 36. Captions as data with frame ranges

Date: 2026-10-25

Scope: `src/data/reel-captions.ts`, `src/scenes3d/`

## Status

Proposed

## Context

The spec fixes seven captions with frame ranges and minimum durations (RL17–RL22). The proof of concept wrote its captions inline in JSX, and the validation found the closing caption fully visible for only 1 s.

## Decision

`CAPTIONS` in `src/data/reel-captions.ts` lists `{id, text, from, to, position, scene}` for 11 reel captions: the disclaimer and the attribution (every frame), four titles (`intro-title`, `overview-title`, `vale-north-title`, `vale-title`), the heritage note, the live station, the private home, the decommissioning site and the concept card; `POC_CAPTIONS` holds the proof of concept's own five. `position` is top-left, bottom-left, bottom-center, badge or attribution. Overlays render from that list with `data-overlay` markers; a test checks every range and minimum duration; the render checks read the overlays' visibility from the page, as now.

## Consequences

- One source of truth; no caption text in a component.
- A caption change is a data change with a test.
- The 2D `Caption` components are reused for the rendering.

## Verification

RL17–RL22 (R, V); `tests/reel-captions.test.ts` (design D32).

## Relations

Amended by: [48. Overlays inside the safe area, captions paced for reading](0048-overlays-safe-area-and-pacing.md)

Related to: [20. Keep feature and asset registers as validated JSON](0020-registers-as-json.md)
