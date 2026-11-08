# 49. Buildings and landmarks from sourced data only

Date: 2026-10-25

Scope: `scripts/build_buildings.py` (new), `scripts/osm/fetch_bbox.py`, `data/landmarks.json` (new), `public/data/sections/<id>/buildings.json` (new), `data/features-<window>.json`, `src/three-core/visibility.ts` (new)

## Status

Proposed

## Context

The ground windows already hold 1,360 OSM building footprints, but the t9 allowlist reduced their tags to `building=yes`. The goal requires dated sources, a status that never treats a planning approval as built, licences and confidence. The Welsh lidar DSM sits beside the DTM on the allowlisted host. ADR 12 allows only sourced structures.

## Decision

Footprints come from each window's OSM data. A re-fetch of building ways only adds the building type, `building:levels`, `height` and `roof:shape`: no names, addresses or contacts.

Height is the 90th percentile of DSM − DTM inside the footprint. Otherwise it is levels × 3 m or a stated default, marked approximate.

Landmarks are curated in `data/landmarks.json`: sources with URLs and observed and retrieved dates, licence, confidence, status and model parameters. Any web text is screened with `aidefence_scan` before it is stored.

`scripts/build_buildings.py --section <id>` writes `sections/<id>/buildings.json` and the register entries. Only footprints that `visibleFootprints` lists for a shot are built.

## Consequences

- Each section needs network access for the OSM building ways and the DSM, both on allowlisted hosts.
- The DSM survey date is unknown (2024-10-04 is its publication date) and is recorded that way.
- A landmark without a dated source is left out and listed.

## Verification

Spec BL1–BL6, BL11 and BL15–BL18; design D45.

## Relations

Amended by: [63. Buildings up to date: every building near the line, checked against the latest OS release and the lidar](0063-buildings-up-to-date.md)

Amends: [12. Model only structures that have a cited source](0012-sourced-structures-only.md). Related to: [20. Keep feature and asset registers as validated JSON](0020-registers-as-json.md), [38. On-screen text comes only from curated files, never from OSM tags](0038-labels-from-curated-files.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- `scripts/building-candidates.ts` lists the footprints the shots see, each tested at its measured height from `data/building-heights-<w>.json`, or at a 60 m bound until measured. It runs in two passes with `build_buildings.py`; footprints off the terrain window are left out.
- `build_buildings.py` fetches the candidates' tags and dates itself, ways and relations alike, and skips deleted ways. `observedAt` is the OSM element's timestamp; no DSM survey date is recorded.
- An incomplete curated landmark (no screening record or dated sources) stops the build. Only `featured` landmarks are drawn as models.
