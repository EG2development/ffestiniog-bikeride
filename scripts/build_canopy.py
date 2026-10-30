# Photoreal layer (docs/adr/0057-canopy-heights-from-lidar.md): tree heights from the lidar DSM, not from a random draw.
"""Build a canopy-height grid for one section window: lidar DSM minus lidar DTM, on the window's own DEM grid.

  python3 scripts/build_canopy.py --section <id>   network: the Welsh lidar DSM and DTM COGs (dmwproductionblob)
  python3 scripts/build_canopy.py --self-test      synthetic check, no network

Reads public/data/sections/<id>/dem.json for the grid (the same nodes the terrain mesh uses), range-reads both COGs at
that level and writes canopy.f32 (<f4, metres above ground, 0 where there is no canopy or no data) and canopy.json.
The tree placer scales each tree to the canopy height at its node, so a plantation of 20 m spruce and a 6 m birch
scrub read as what the lidar measured. The DSM's survey date is not published with the COG (design risk K16).
"""
import argparse
import datetime
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_poc_data import LIDAR_URL, ROOT, write_json  # noqa: E402
from dem.cog import Cog  # noqa: E402

DSM_URL = LIDAR_URL.replace("wales_dtm_32bit_cog.tif", "wales_dsm_32bit_cog.tif")
TODAY = datetime.date.today().isoformat()
LEVELS = {4: 2, 16: 4}  # header spacing (m) -> COG overview index, as build_section_data.py uses them
MAX_CANOPY_M = 45.0  # nothing in these windows is taller: above it the value is a building, a pylon or a DSM artefact


def canopy_from(dsm, dtm, nodata, max_m=MAX_CANOPY_M):
    """DSM minus DTM, clipped to [0, max_m]; 0 wherever either grid is nodata or not finite (pure, for the self-test)."""
    bad = (dsm == nodata) | (dtm == nodata) | ~np.isfinite(dsm) | ~np.isfinite(dtm)
    canopy = np.clip(dsm - dtm, 0.0, max_m)
    canopy[bad] = 0.0
    return canopy.astype(np.float32)


def read_level(url, level, col0, row0, cols, rows):
    cog = Cog(url)
    return cog.read_window(level, col0, row0, cols, rows).astype(np.float64), cog


def main(section):
    rel = f"public/data/sections/{section}"
    header = json.load(open(os.path.join(ROOT, rel, "dem.json")))
    level = LEVELS[int(header["spacingM"])]
    dtm_cog = Cog(LIDAR_URL)
    px, py = dtm_cog.pixel_size(level)
    # the window's nodes are pixel centres: originE = et + (col0 + 0.5) * px (build_section_data.py)
    col0 = int(round((header["originE"] - dtm_cog.origin_e) / px - 0.5))
    row0 = int(round((dtm_cog.origin_n - header["originN"]) / py - 0.5))
    cols, rows = header["cols"], header["rows"]
    dtm = dtm_cog.read_window(level, col0, row0, cols, rows).astype(np.float64)
    dsm, dsm_cog = read_level(DSM_URL, level, col0, row0, cols, rows)
    if (dsm_cog.origin_e, dsm_cog.origin_n) != (dtm_cog.origin_e, dtm_cog.origin_n) or dsm_cog.pixel_size(level) != (px, py):
        raise SystemExit("the DSM and DTM COGs are not on the same grid")
    canopy = canopy_from(dsm, dtm, dtm_cog.nodata)
    with open(os.path.join(ROOT, rel, "canopy.f32"), "wb") as f:
        f.write(canopy.astype("<f4").tobytes())
    wooded = canopy >= 2.0
    write_json(f"{rel}/canopy.json", {
        "cols": cols, "rows": rows, "spacingM": header["spacingM"], "originE": header["originE"], "originN": header["originN"], "crs": "EPSG:27700",
        "file": "canopy.f32", "units": "metres above the DTM, 0 = no canopy or no data", "maxM": MAX_CANOPY_M,
        "source": f"Welsh Government / NRW lidar DSM minus DTM, 1 m, 32-bit COGs ({header['spacingM']} m overview level)",
        "urls": [DSM_URL, LIDAR_URL], "licence": header.get("licence", "Open Government Licence (to confirm)"),
        "surveyDate": "not published with the COG (design risk K16)", "retrieved": TODAY,
        "stats": {"cellsOver2m": int(wooded.sum()), "share": round(float(wooded.mean()), 4), "p50OverTwo": round(float(np.median(canopy[wooded])), 2) if wooded.any() else 0.0,
                  "p95OverTwo": round(float(np.percentile(canopy[wooded], 95)), 2) if wooded.any() else 0.0, "max": round(float(canopy.max()), 2)},
    }, indent=2)
    print(f"{section}: canopy {cols}x{rows} @ {header['spacingM']} m; {int(wooded.sum())} cells >= 2 m ({100 * float(wooded.mean()):.1f} %), "
          f"median {float(np.median(canopy[wooded])) if wooded.any() else 0:.1f} m, p95 {float(np.percentile(canopy[wooded], 95)) if wooded.any() else 0:.1f} m, max {float(canopy.max()):.1f} m")


def self_test():
    dsm = np.array([[110.0, 125.0, -9999.0], [100.0, 160.0, 103.0]])
    dtm = np.array([[100.0, 100.0, 100.0], [100.0, 100.0, -9999.0]])
    got = canopy_from(dsm, dtm, -9999.0)
    want = np.array([[10.0, 25.0, 0.0], [0.0, MAX_CANOPY_M, 0.0]], dtype=np.float32)
    ok = got.dtype == np.float32 and np.array_equal(got, want)
    print("self-test:", "ok" if ok else f"FAIL got {got.tolist()}")
    return 0 if ok else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--section")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        sys.exit(self_test())
    if not args.section:
        ap.error("--section <id> or --self-test")
    main(args.section)
