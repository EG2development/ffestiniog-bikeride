# 7. Read the DTM by HTTP range requests, without GDAL

Date: 2026-10-25

Scope: `scripts/dem/cog.py`, `scripts/build_poc_data.py`

## Status

Proposed

## Context

GDAL, rasterio, tifffile and pyproj aren't installed; numpy and zlib are. The DTM file is 48.6 GB.

## Decision

A small BigTIFF reader parses the IFDs, range-reads only the needed tile-index entries and tiles, and decodes Deflate with zlib and numpy. It supports exactly Deflate with no predictor and fails loudly on anything else. The terrain mesh uses the 4 m overview; the trail profile uses the 1 m level. Output is `public/data/dem-poc.f32` with a JSON provenance header.

## Consequences

- No heavy dependencies, and only tens of MB downloaded.
- A small parser to maintain.
- How the overviews were resampled isn't stated in the file; record it as unknown.

## Verification

G2(b); a unit test that parses the cached header bytes (see docs/spec-3d.md). Design reference: D5 in docs/design-3d.md.

## Relations

Related to: [6. Use the Welsh lidar DTM for terrain](0006-welsh-lidar-dtm.md)
