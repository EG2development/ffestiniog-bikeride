"""Structures the lidar sees near the line that no map has (docs/adr/0063-buildings-up-to-date.md): a review list.

  python3 scripts/find_lidar_structures.py [--buffer 300] [--zip <OS SH zip>]   network: the lidar DSM and DTM COGs (1 m)
  python3 scripts/find_lidar_structures.py --self-test      no network

The owner asked for buildings along the route to be found on a lidar map. Third-party lidar viewers restrict reuse and
show the bare-earth terrain, so this reads the same Welsh Government / NRW lidar (OGL v3) from its source, at full 1 m
resolution (the coarser levels are point samples, not averages). It marks cells standing 2.5 m or more above the DTM
whose surface is smooth (the DSM's second differences under 0.5 m), joins them, and keeps blobs of 25 m^2 or more that
are at least 3 m across, fill at least 45 % of their oriented box, stand at most 15 m, have at least 40 % smooth cells
and a wall-like edge (the ground just outside under 2.5 m), on ground under 25 deg (quarry faces fool the ground
filter). The DSM is interpolated, so crowns look smooth cell by cell: the edge and the smooth share are what part roofs
from trees. Calibrated on 25 route tiles (2026-10-30): 77 % of mapped buildings pass and 2.5 % of unmapped blobs. A blob within 3 m of any building OSM or OS OpenMap Local has (every window,
any size) or on a mapped bridge is known and dropped. What is left is not drawn: the flights are 2020-23, OS is
2026-10, and static caravans, stacks and lorries look like small buildings. It is written to data/lidar-structures.json
for checking in imagery or on the ground.
"""
import argparse
import json
import math
import os
import sys
from collections import deque

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_poc_data import LIDAR_URL, ROOT, point_in_ring  # noqa: E402
from dem.bng import bng_to_wgs84, wgs84_to_bng  # noqa: E402
from dem.cog import Cog  # noqa: E402
from fetch_os_buildings import CACHE, load_os  # noqa: E402

DSM_URL = LIDAR_URL.replace("wales_dtm_32bit_cog.tif", "wales_dsm_32bit_cog.tif")
TILE_M = 250
MIN_HEIGHT_M, MAX_HEIGHT_M = 2.5, 15.0
SMOOTH_M = 0.5
MIN_AREA_M2, MIN_FILL, MIN_WIDTH_M = 25, 0.45, 3.0
MIN_SMOOTH_SHARE, MAX_EDGE_M = 0.4, 2.5
MAX_GROUND_SLOPE_DEG = 25.0
KNOWN_M = 3.0


def smooth_mask(dsm):
    """Cells whose DSM bends little in either direction: roofs (planes) pass, tree crowns do not."""
    d2x = np.abs(dsm[1:-1, 2:] - 2 * dsm[1:-1, 1:-1] + dsm[1:-1, :-2])
    d2y = np.abs(dsm[2:, 1:-1] - 2 * dsm[1:-1, 1:-1] + dsm[:-2, 1:-1])
    out = np.zeros(dsm.shape, dtype=bool)
    out[1:-1, 1:-1] = (d2x < SMOOTH_M) & (d2y < SMOOTH_M)
    return out


def grow(mask, within):
    """The mask grown by one cell (8 neighbours), kept inside `within`: the eaves the second differences cut off."""
    out = mask.copy()
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            out |= np.roll(np.roll(mask, dr, axis=0), dc, axis=1)
    return out & within


def components(mask):
    """8-connected components of a boolean grid, as lists of (row, col)."""
    seen = np.zeros(mask.shape, dtype=bool)
    out = []
    rows, cols = mask.shape
    for r0, c0 in zip(*np.nonzero(mask)):
        if seen[r0, c0]:
            continue
        seen[r0, c0] = True
        comp, queue = [], deque([(r0, c0)])
        while queue:
            r, c = queue.popleft()
            comp.append((r, c))
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    rr, cc = r + dr, c + dc
                    if 0 <= rr < rows and 0 <= cc < cols and mask[rr, cc] and not seen[rr, cc]:
                        seen[rr, cc] = True
                        queue.append((rr, cc))
        out.append(comp)
    return out


def oriented_box(xy):
    """(length, width, angle deg) of the minimum-area rectangle around points, by rotating calipers over 0-89 deg."""
    best = None
    for deg in range(90):
        a = math.radians(deg)
        u = xy @ np.array([math.cos(a), math.sin(a)])
        v = xy @ np.array([-math.sin(a), math.cos(a)])
        lu, lv = u.max() - u.min() + 1, v.max() - v.min() + 1  # cell centres: add one cell
        if best is None or lu * lv < best[0] * best[1]:
            best = (lu, lv, deg)
    return max(best[0], best[1]), min(best[0], best[1]), best[2]


def edge_height(cells, ndsm):
    """The median height above ground of the cells just outside a blob: near zero beside a wall, high inside a canopy."""
    inside, out = set(cells), []
    for r, c in cells:
        for rr, cc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= rr < ndsm.shape[0] and 0 <= cc < ndsm.shape[1] and (rr, cc) not in inside:
                out.append(ndsm[rr, cc])
    return float(np.median(out)) if out else 0.0


def classify(cells, ndsm, ground_slope, smooth):
    """A blob's measures and whether it passes as building-like."""
    rr = np.array([c[0] for c in cells])
    cc = np.array([c[1] for c in cells])
    area = len(cells)
    length, width, angle = oriented_box(np.column_stack([cc, -rr]).astype(float))
    fill = area / (length * width)
    h = float(np.percentile(ndsm[rr, cc], 90))
    slope = float(np.median(ground_slope[rr, cc]))
    share, edge = float(smooth[rr, cc].mean()), edge_height(cells, ndsm)
    ok = (area >= MIN_AREA_M2 and fill >= MIN_FILL and width >= MIN_WIDTH_M and MIN_HEIGHT_M <= h <= MAX_HEIGHT_M and slope <= MAX_GROUND_SLOPE_DEG
          and share >= MIN_SMOOTH_SHARE and edge <= MAX_EDGE_M)
    return ok, {"areaM2": area, "lengthM": round(float(length), 1), "widthM": round(float(width), 1), "fill": round(float(fill), 2), "heightM": round(h, 1),
                "smoothShare": round(share, 2), "edgeM": round(edge, 1), "groundSlopeDeg": round(slope, 1), "angleDeg": angle}


def known_geometry():
    """Every building outline OSM (all windows) or OS OpenMap Local (all outlines read) has, and the mapped bridges,
    as BNG point arrays."""
    sections = os.path.join(ROOT, "public/data/sections")
    rings, bridges = {}, {}
    for w in sorted(os.listdir(sections)):
        path = os.path.join(sections, w, "osm.geojson")
        if not os.path.exists(path):
            continue
        for f in json.load(open(path))["features"]:
            t, g = f["properties"].get("tags", {}), f["geometry"]
            pts = g["coordinates"] if g["type"] == "LineString" else g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0] if g["type"] == "MultiPolygon" else None
            if pts is None or len(pts) < 2:
                continue
            if t.get("building") or t.get("bridge"):
                e, n = wgs84_to_bng(np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))
                (rings if t.get("building") else bridges)[f["properties"]["id"]] = np.column_stack([e, n])
    return list(rings.values()), list(bridges.values())


def os_outlines(zip_path, line, buffer_m):
    """Every OS OpenMap Local building outline near the line, any size (BNG; the OS frame differs from OSM's by about
    1.5 m, inside KNOWN_M)."""
    outlines, _release = load_os(zip_path)
    lo, hi = line.min(axis=0) - buffer_m - 100, line.max(axis=0) + buffer_m + 100
    return [r for _i, _f, r in outlines if not ((r.max(axis=0) < lo).any() or (r.min(axis=0) > hi).any())]


def near_any(xy, shapes, dist):
    """A point within `dist` m of any vertex or inside any closed outline."""
    for s in shapes:
        lo, hi = s.min(axis=0) - dist, s.max(axis=0) + dist
        if (xy < lo).any() or (xy > hi).any():
            continue
        if np.hypot(*(s - xy).T).min() <= dist or (len(s) >= 4 and point_in_ring(np.array([xy[0]]), np.array([xy[1]]), [tuple(p) for p in s])[0]):
            return True
        seg = s[1:] - s[:-1]
        t = np.clip(((xy - s[:-1]) * seg).sum(axis=1) / np.maximum((seg * seg).sum(axis=1), 1e-9), 0, 1)
        if np.hypot(*(s[:-1] + seg * t[:, None] - xy).T).min() <= dist:
            return True
    return False


def route_line():
    f = json.load(open(os.path.join(ROOT, "data/railway-route.geojson")))["features"][0]["geometry"]["coordinates"]
    e, n = wgs84_to_bng(np.array([p[0] for p in f]), np.array([p[1] for p in f]))
    xy = np.column_stack([e, n])
    km = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]) / 1000
    dense, dkm = [], []
    for i in range(len(xy) - 1):
        k = max(1, int(np.hypot(*(xy[i + 1] - xy[i])) // 10))
        for t in np.arange(k) / k:
            dense.append(xy[i] + (xy[i + 1] - xy[i]) * t)
            dkm.append(km[i] + (km[i + 1] - km[i]) * t)
    return np.array(dense), np.array(dkm)


def main(buffer_m, zip_path):
    line, line_km = route_line()
    dsm_cog, dtm_cog = Cog(DSM_URL), Cog(LIDAR_URL)
    rings, bridges = known_geometry()
    if not os.path.exists(zip_path):
        raise SystemExit(f"{zip_path}: run scripts/fetch_os_buildings.py first, or pass --zip")
    rings += os_outlines(zip_path, line, buffer_m)
    tiles = sorted({(int(e // TILE_M), int(n // TILE_M)) for e, n in line for de in (-buffer_m, 0, buffer_m) for dn in (-buffer_m, 0, buffer_m)
                    for e, n in [(e + de, n + dn)]})
    found, checked = [], 0
    for te, tn in tiles:
        e0, n1 = te * TILE_M, (tn + 1) * TILE_M
        grids = []
        for cog in (dsm_cog, dtm_cog):
            px, py = cog.pixel_size(0)
            c0, r0 = math.floor((e0 - cog.origin_e) / px), math.floor((cog.origin_n - n1) / py)
            grids.append(cog.read_window(0, c0, r0, TILE_M, TILE_M).astype(np.float64))
        dsm, dtm = grids
        ge = e0 + (np.arange(TILE_M) + 0.5)
        gn = n1 - (np.arange(TILE_M) + 0.5)
        ok = (dsm != dsm_cog.nodata) & (dtm != dtm_cog.nodata) & np.isfinite(dsm) & np.isfinite(dtm)
        ndsm = np.where(ok, dsm - dtm, 0.0)
        gy, gx = np.gradient(np.where(ok, dtm, np.nanmean(dtm[ok]) if ok.any() else 0.0))
        slope = np.degrees(np.arctan(np.hypot(gx, gy)))
        near = np.zeros(ok.shape, dtype=bool)
        sub = line[(line[:, 0] > e0 - buffer_m) & (line[:, 0] < e0 + TILE_M + buffer_m) & (line[:, 1] > n1 - TILE_M - buffer_m) & (line[:, 1] < n1 + buffer_m)]
        if len(sub) == 0:
            continue
        for r in range(0, TILE_M, 10):  # 10 m blocks: near enough to the 300 m buffer
            for c in range(0, TILE_M, 10):
                near[r:r + 10, c:c + 10] = np.hypot(sub[:, 0] - ge[c + 5], sub[:, 1] - gn[r + 5]).min() <= buffer_m
        high = ok & near & (ndsm >= MIN_HEIGHT_M)
        smooth = smooth_mask(dsm)
        mask = grow(high & smooth, high)
        for comp in components(mask):
            if len(comp) < MIN_AREA_M2:
                continue
            checked += 1
            passes, m = classify(comp, ndsm, slope, smooth)
            if not passes:
                continue
            rr = np.array([c[0] for c in comp])
            cc = np.array([c[1] for c in comp])
            xy = np.array([ge[cc].mean(), gn[rr].mean()])
            if near_any(xy, rings, KNOWN_M + m["lengthM"] / 2) or near_any(xy, bridges, 8.0):
                continue
            k = int(np.argmin(np.hypot(*(line - xy).T)))
            lon, lat = bng_to_wgs84(np.array([xy[0]]), np.array([xy[1]]))
            found.append({"lat": round(float(lat[0]), 6), "lon": round(float(lon[0]), 6), "e": round(float(xy[0])), "n": round(float(xy[1])),
                          "gridRef": f"SH {int(xy[0]) % 100000 // 10:04d} {int(xy[1]) % 100000 // 10:04d}", "km": round(float(line_km[k]), 2),
                          "fromLineM": round(float(np.hypot(*(line[k] - xy)))), **m})
    found.sort(key=lambda s: s["km"])
    with open(os.path.join(ROOT, "data/lidar-structures.json"), "w") as fh:
        json.dump({"source": "Welsh Government / NRW lidar DSM and DTM, 1 m COGs (OGL v3), flights 2020-23", "dsm": DSM_URL, "dtm": LIDAR_URL,
                   "bufferM": buffer_m, "rules": {"minHeightM": MIN_HEIGHT_M, "maxHeightM": MAX_HEIGHT_M, "smoothM": SMOOTH_M, "minAreaM2": MIN_AREA_M2,
                                                   "minFill": MIN_FILL, "minWidthM": MIN_WIDTH_M, "minSmoothShare": MIN_SMOOTH_SHARE, "maxEdgeM": MAX_EDGE_M,
                                                   "maxGroundSlopeDeg": MAX_GROUND_SLOPE_DEG, "knownM": KNOWN_M},
                   "note": "structures in neither OSM nor OS OpenMap Local 2026-10; not drawn; check each in imagery or on the ground",
                   "blobsTested": checked, "structures": found}, fh, indent=1)
        fh.write("\n")
    print(f"{len(tiles)} tiles of {TILE_M} m, {checked} raised smooth blobs of {MIN_AREA_M2} m2 or more; {len(found)} building-like and on no map")
    for s in found:
        print(f"  km {s['km']:5.2f}  {s['fromLineM']:3d} m off  {s['gridRef']}  {s['areaM2']:4d} m2  {s['lengthM']} x {s['widthM']} m  {s['heightM']} m  ({s['lat']}, {s['lon']})")


def self_test():
    failures = []
    y, x = np.mgrid[0:40, 0:40].astype(float)
    dsm = np.zeros((40, 40))
    dsm[5:13, 5:20] = 6.0 + 0.4 * (x[5:13, 5:20] - 5)  # a 15 x 8 m roof sloping 0.4 m a metre: smooth
    rng = np.random.default_rng(1)
    dsm[25:35, 25:35] = 8.0 + rng.normal(0, 1.5, (10, 10))  # a crown: rough
    sm = smooth_mask(dsm)
    if sm[7:11, 7:18].mean() < 0.99 or sm[27:33, 27:33].mean() > 0.4:
        failures.append(f"smooth mask: roof {sm[7:11, 7:18].mean():.2f}, crown {sm[27:33, 27:33].mean():.2f}")
    comps = components(grow((dsm >= MIN_HEIGHT_M) & sm, dsm >= MIN_HEIGHT_M))
    big = max(comps, key=len)
    passes, m = classify(big, dsm, np.zeros_like(dsm), sm)
    if not passes or abs(m["lengthM"] - 15) > 1 or abs(m["widthM"] - 8) > 1:
        failures.append(f"the roof should pass as a 15 x 8 m building: {passes} {m}")
    wall = np.zeros((40, 40))
    wall[20, 2:38] = 3.0  # a 36 m wall, 1 m thick: too narrow
    if classify(components(wall > 0)[0], wall, np.zeros_like(wall), np.ones_like(wall, dtype=bool))[0]:
        failures.append("a wall must not pass")
    # a smooth patch inside a canopy: the cells around it stand high, so it is no roof
    canopy = np.full((30, 30), 12.0)
    patch = [(r, c) for r in range(10, 18) for c in range(10, 20)]
    if classify(patch, canopy, np.zeros_like(canopy), np.ones_like(canopy, dtype=bool))[0]:
        failures.append("a smooth patch in a canopy must not pass")
    if not near_any(np.array([10.0, 10.0]), [np.array([[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]], dtype=float)], 3.0):
        failures.append("a point inside a known outline is known")
    if near_any(np.array([50.0, 50.0]), [np.array([[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]], dtype=float)], 3.0):
        failures.append("a point 30 m away is not known")
    for f in failures:
        print("FAIL", f)
    print("self-test:", "ok" if not failures else f"{len(failures)} failure(s)")
    return 0 if not failures else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--buffer", type=float, default=300.0)
    ap.add_argument("--zip", default=CACHE, help="the OS OpenMap Local SH zip (default: the copy fetch_os_buildings.py caches)")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    sys.exit(self_test() if a.self_test else main(a.buffer, a.zip))
