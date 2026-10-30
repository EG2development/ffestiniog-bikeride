# 38. On-screen text comes only from curated files, never from OSM tags

Date: 2026-10-25

Scope: `src/scenes3d/`, `scripts/build_section_data.py`, `tests/static-3d.test.ts`

## Status

Proposed

## Context

OSM tag values are third-party text. Rendering them straight to the screen would show whatever a contributor typed, including the names of private homes (the Maentwrog Road station is one; the security review noted it).

## Decision

Place and feature labels are read from `reel-captions.ts` or a register entry's `note`, never from an OSM tag at render time (nothing under `src/scenes3d` or `src/three` reads `waypoints.json`). A static test forbids `tags.` inside JSX text. The pipeline has no screening function: it writes only the tag allowlist below (`KEEP_TAGS`), drops everything else, and copies just `highway=<value>` into a register note, so a residence name never reaches a register.

## Consequences

- A new label needs a register entry, which is where its source is recorded anyway.
- The allowlist is a pipeline step, not a render-time dependency.
- Data minimisation (added at the reel's security review, t9): the pipeline writes only the tags the renderer and the registers read (`KEEP_TAGS` in `scripts/build_section_data.py`: highway, bridge, tunnel, cutting, embankment, layer, railway, natural, landuse, water, waterway, leisure, man_made, building reduced to "yes", and `name` only for the railway). Addresses, house names, phone numbers, operators and websites that OpenStreetMap holds never enter the repository.

## Verification

RL31 (S, D) (design D34).

## Relations

Related to: [12. Model only structures that have a cited source](0012-sourced-structures-only.md), [20. Keep feature and asset registers as validated JSON](0020-registers-as-json.md)
