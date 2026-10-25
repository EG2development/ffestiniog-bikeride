# 6. Use the Welsh lidar DTM for terrain

Date: 2026-10-25

Scope: `scripts/dem/`, `public/data/dem-poc.json`, `src/three-core/dem.ts`

## Status

Proposed

## Context

The brief requires real DEM terrain that shows cuttings and embankments. The existing elevations are a Copernicus GLO-90 DSM (90 m, including canopy). Checked on 2026-10-25, the Welsh Government/NRW lidar DTM is a cloud-optimised GeoTIFF: 1 m pixels, float32, EPSG:27700, Deflate, overviews at 2–64 m, 48.6 GB, and it answers HTTP range requests. The 16-bit variant stores whole metres. DataMapWales lists the licence as OGL, but one catalogue says "Not Specified".

## Decision

Use the 32-bit DTM (`https://dmwproductionblob.blob.core.windows.net/cogs/lidar/wales_dtm_32bit_cog.tif`) for terrain. Copernicus GLO-30 fills any nodata cells, and each cell records which source it came from.

## Consequences

- Bare-earth detail at 1 m.
- The grid is in British National Grid, so a datum conversion is needed (ADR 8).
- Bare earth has no trees or buildings (vegetation is ADR 11), and the DTM removes the rail bridge's deck (ADR 9), though it keeps some road decks over the line (ADR 23).
- Spec G2(c) compares against a DSM, so its maximum tolerance becomes 30 m (spec amended).
- The licence must be confirmed on the layer's metadata page before release.

## Verification

G2; licence confirmation under L1 (see docs/spec-3d.md). Design reference: D4 in docs/design-3d.md.

## Relations

Related to: [7. Read the DTM by HTTP range requests, without GDAL](0007-range-read-dtm.md)
Related to: [8. Convert WGS84 and British National Grid with the OS Helmert transform](0008-helmert-datum.md)
Related to: [9. Take the trail height from the DTM along the centreline](0009-trail-height-from-dtm.md)
