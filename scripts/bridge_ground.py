"""The ground under each of the line's bridges, from the 1 m lidar: what a road passing under a span is laid on.

  python scripts/bridge_ground.py --section <id>   network: the lidar COG (byte ranges); updates the window's profile
  python scripts/bridge_ground.py --self-test      no network

Adds bridgeGroundM to public/data/sections/<id>/trail-profile.json, one value per span in its "bridges": the lowest 1 m
DTM on the centreline within the span (the road, stream or field beneath the deck; the lidar sees under a short deck).
The window's 4 m grid averages that narrow gap with the embankment either side, a metre or more too high.
build_section_data.py writes the same field when it builds a window.
"""
import argparse
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def span_ground(ds, raw, spans):
    """The lowest finite value of `raw` (sampled at distances `ds`) within each [a, b] span, or None where it has none."""
    out = []
    for a, b in spans:
        inside = raw[(ds >= a) & (ds <= b)]
        inside = inside[np.isfinite(inside)]
        out.append(round(float(inside.min()), 2) if inside.size else None)
    return out


def centreline_dtm(cog, ds, lons, lats, dist):
    """The 1 m DTM along the centreline at route distances `ds`, bilinear, NaN where it has no data."""
    from build_poc_data import along
    from dem.bng import wgs84_to_bng
    pe, pn = wgs84_to_bng(*along(lons, lats, dist, ds))
    px, py = cog.pixel_size(0)
    et, nt = cog.origin_e, cog.origin_n
    c0, r0 = int(math.floor((pe.min() - et) / px)) - 2, int(math.floor((nt - pn.max()) / py)) - 2
    c1, r1 = int(math.ceil((pe.max() - et) / px)) + 2, int(math.ceil((nt - pn.min()) / py)) + 2
    w = cog.read_window(0, c0, r0, c1 - c0, r1 - r0).astype(np.float64)
    w[(w == cog.nodata) | ~np.isfinite(w)] = np.nan
    fx, fy = (pe - et) / px - 0.5 - c0, (nt - pn) / py - 0.5 - r0
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    u, v = fx - ix, fy - iy
    return w[iy, ix] * (1 - u) * (1 - v) + w[iy, ix + 1] * u * (1 - v) + w[iy + 1, ix] * (1 - u) * v + w[iy + 1, ix + 1] * u * v


def main(section):
    from build_poc_data import LIDAR_URL, ROOT, load_route
    from dem.cog import Cog
    path = os.path.join(ROOT, "public/data/sections", section, "trail-profile.json")
    with open(path) as f:
        profile = json.load(f)
    spans = profile.get("bridges", [])
    if spans:
        lons, lats, dist = load_route()
        cog = Cog(LIDAR_URL)
        profile["bridgeGroundM"] = [span_ground(ds, centreline_dtm(cog, ds, lons, lats, dist), [(a, b)])[0]
                                    for a, b in spans for ds in [np.arange(a, b + 1, 1.0)]]
    else:
        profile["bridgeGroundM"] = []
    with open(path, "w") as f:
        json.dump(profile, f)
        f.write("\n")
    print(section, "bridgeGroundM", profile["bridgeGroundM"], "for spans", spans)


def self_test():
    ds = np.arange(0.0, 20.0, 1.0)
    raw = np.full(ds.shape, 193.0)
    raw[8:11] = [191.0, 189.9, 190.4]
    raw[15] = np.nan
    assert span_ground(ds, raw, [(5, 12), (14, 16), (30, 40)]) == [189.9, 193.0, None]
    print("self-test ok")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--section")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        self_test()
    elif a.section:
        main(a.section)
    else:
        ap.error("--section or --self-test")
