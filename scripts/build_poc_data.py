"""Build the POC data for the Maentwrog Road section (docs/pseudocode-3d.md §1, docs/design-3d.md).

  python3 scripts/build_poc_data.py
  npm run data:earthworks      # adds the earthwork entries to data/features-3d.json
  npm run data:sync

Writes public/data/{dem-poc.json,dem-poc.f32,dem-poc-source.u8,landcover-poc.json,landcover-poc.u8,
trail-profile-poc.json,osm-poc.geojson} and data/{features-3d.json,assets-3d.json}.
Needs network access to the Welsh lidar COG and the OSM API. Python 3 + numpy.
"""
# Reel: windows per section (docs/adr/0029-terrain-windows-per-section.md); water fill (docs/adr/0032-water-from-osm.md).
import datetime
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from dem.bng import bng_to_wgs84, wgs84_to_bng  # noqa: E402
from dem.cog import Cog  # noqa: E402
from osm.fetch_bbox import fetch_bbox, to_features  # noqa: E402

ROOT = os.path.dirname(HERE)
LIDAR_URL = "https://dmwproductionblob.blob.core.windows.net/cogs/lidar/wales_dtm_32bit_cog.tif"
SECTION_M = (7700, 9700)
MARGIN_M = 600
PROFILE_PAD_M = 60
MESH_LEVEL = 2  # 4 m overview
PROFILE_LEVEL = 0  # 1 m
SCENE = "Poc3DMaentwrog"
TODAY = datetime.date.today().isoformat()

LEGEND = ["water", "built-up", "quarry/rock/scree", "woodland", "heath/scrub", "grass/farmland", "other"]
ROAD_CLASSES = {"motorway", "trunk", "trunk_link", "primary", "primary_link", "secondary", "tertiary", "unclassified",
                "residential", "service", "track"}
# typical carriageway widths by class (m), mirrored from src/three-core/roads.ts; not surveyed
ROAD_WIDTH_M = {"motorway": 11, "trunk": 7.3, "trunk_link": 6, "primary": 7, "primary_link": 6, "secondary": 6.5,
                "tertiary": 6, "unclassified": 4.5, "residential": 5, "service": 3.5, "track": 2.5}


def interpolate_spans(ds, raw, on_bridge, spans):
    """Replace raw[] across each [a, b] span by a straight line between its ends (in place).
    Spans are clipped to the profile; one entirely outside it is skipped (review R6)."""
    for a, b in spans:
        if b < ds[0] or a > ds[-1]:
            continue
        ia = min(int(np.searchsorted(ds, a)), len(ds) - 1)
        ib = min(int(np.searchsorted(ds, b)), len(ds) - 1)
        raw[ia:ib + 1] = np.interp(ds[ia:ib + 1], [ds[ia], ds[ib]], [raw[ia], raw[ib]])
        on_bridge[ia:ib + 1] = True


def landcover_class(tags):
    t = tags.get
    if t("natural") == "water" or t("waterway") == "riverbank" or t("landuse") == "reservoir" or "water" in tags:
        return 0
    if "building" in tags or t("landuse") in ("residential", "commercial", "industrial", "retail", "railway"):
        return 1
    if t("landuse") == "quarry" or t("natural") in ("bare_rock", "scree", "shingle") or t("man_made") == "spoil_heap":
        return 2
    if t("landuse") == "forest" or t("natural") == "wood":
        return 3
    if t("natural") in ("heath", "scrub", "fell"):
        return 4
    if t("landuse") in ("grass", "meadow", "farmland", "village_green", "recreation_ground") or t("natural") == "grassland" \
            or t("leisure") in ("park", "pitch", "golf_course"):
        return 5
    return None


def haversine(lon1, lat1, lon2, lat2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(a))


def load_route():
    with open(os.path.join(ROOT, "data/railway-route.geojson")) as f:
        coords = json.load(f)["features"][0]["geometry"]["coordinates"]
    dist = [0.0]
    for a, b in zip(coords, coords[1:]):
        dist.append(dist[-1] + haversine(a[0], a[1], b[0], b[1]))
    return np.array([c[0] for c in coords]), np.array([c[1] for c in coords]), np.array(dist)


def along(lons, lats, dist, d):
    """lon/lat at route distance(s) d, linear between vertices (the projection is affine, so this matches 3D)."""
    return np.interp(d, dist, lons), np.interp(d, dist, lats)


def distance_of(lons, lats, dist, lon, lat):
    """Route distance of the nearest point on the centreline (local metres)."""
    k = 111320 * math.cos(math.radians(lat))
    best = (float("inf"), 0.0)
    for i in range(len(lons) - 1):
        ax, ay = (lons[i] - lon) * k, (lats[i] - lat) * 111320
        bx, by = (lons[i + 1] - lon) * k, (lats[i + 1] - lat) * 111320
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy or 1)))
        off = math.hypot(ax + t * dx, ay + t * dy)
        if off < best[0]:
            best = (off, dist[i] + t * (dist[i + 1] - dist[i]))
    return best[1]


def point_in_ring(lons, lats, ring):
    inside = np.zeros(lons.shape, dtype=bool)
    xs = np.array([p[0] for p in ring])
    ys = np.array([p[1] for p in ring])
    for i in range(len(ring) - 1):
        x1, y1, x2, y2 = xs[i], ys[i], xs[i + 1], ys[i + 1]
        cond = (y1 > lats) != (y2 > lats)
        if not cond.any():
            continue
        xcross = x1 + (lats - y1) * (x2 - x1) / ((y2 - y1) or 1e-15)
        inside ^= cond & (lons < xcross)
    return inside


def write_json(rel, obj, indent=None):
    path = os.path.join(ROOT, rel)
    with open(path, "w") as f:
        json.dump(obj, f, indent=indent, allow_nan=False)  # NaN is not JSON: browsers refuse it (t9 F1)
        f.write("\n")
    print("wrote", rel)


def main():
    lons, lats, dist = load_route()
    s0, s1 = SECTION_M

    # Box: the section plus a margin, in British National Grid.
    sec = (dist >= s0) & (dist <= s1)
    sl = np.concatenate([[along(lons, lats, dist, s0)[0]], lons[sec], [along(lons, lats, dist, s1)[0]]])
    sa = np.concatenate([[along(lons, lats, dist, s0)[1]], lats[sec], [along(lons, lats, dist, s1)[1]]])
    lat_c = float(sa.mean())
    dlat, dlon = MARGIN_M / 111320, MARGIN_M / (111320 * math.cos(math.radians(lat_c)))
    lon0, lon1, lat0, lat1 = sl.min() - dlon, sl.max() + dlon, sa.min() - dlat, sa.max() + dlat
    ce, cn = wgs84_to_bng(np.array([lon0, lon0, lon1, lon1]), np.array([lat0, lat1, lat0, lat1]))
    emin, emax, nmin, nmax = float(ce.min()), float(ce.max()), float(cn.min()), float(cn.max())

    # DEM grid from the 4 m overview: nodes are pixel centres.
    cog = Cog(LIDAR_URL)
    et, nt = cog.origin_e, cog.origin_n
    px, py = cog.pixel_size(MESH_LEVEL)
    col0, col1 = math.floor((emin - et) / px), math.ceil((emax - et) / px)
    row0, row1 = math.floor((nt - nmax) / py), math.ceil((nt - nmin) / py)
    grid = cog.read_window(MESH_LEVEL, col0, row0, col1 - col0, row1 - row0)
    bad = (grid == cog.nodata) | ~np.isfinite(grid)
    if bad.any():
        raise SystemExit(f"{int(bad.sum())} nodata cells in the lidar window; the GLO-30 fallback (ADR 6) is not implemented yet")
    rows, cols = grid.shape
    origin_e, origin_n = et + (col0 + 0.5) * px, nt - (row0 + 0.5) * py
    with open(os.path.join(ROOT, "public/data/dem-poc.f32"), "wb") as f:
        f.write(grid.astype("<f4").tobytes())
    with open(os.path.join(ROOT, "public/data/dem-poc-source.u8"), "wb") as f:
        f.write(np.zeros(rows * cols, dtype=np.uint8).tobytes())
    write_json("public/data/dem-poc.json", {
        "cols": cols, "rows": rows, "spacingM": 4, "pixelSizeM": [px, py], "originE": origin_e, "originN": origin_n,
        "crs": "EPSG:27700", "nodata": cog.nodata, "fallbackCells": 0, "file": "dem-poc.f32", "sourceFile": "dem-poc-source.u8",
        "source": "Welsh Government / NRW lidar DTM, 1 m, 32-bit COG (4 m overview level)", "url": LIDAR_URL,
        "licence": "Open Government Licence v3.0 (confirmed 2026-10-30 on the DataMapWales LiDAR viewer; data/source-register.md)",
        "resampling": "unknown (COG overview as published)", "retrieved": TODAY,
        "heightsMin": float(grid.min()), "heightsMax": float(grid.max()),
    }, indent=2)

    # OSM features for the box.
    feats = to_features(*fetch_bbox(lon0, lat0, lon1, lat1, splits=2))

    # Bridges on the railway in the section.
    bridges = []
    for f in feats:
        tags = f["properties"]["tags"]
        if tags.get("bridge") and tags.get("name") == "Bala and Festiniog Railway" and f["geometry"]["type"] == "LineString":
            ds = [distance_of(lons, lats, dist, lo, la) for lo, la in f["geometry"]["coordinates"]]
            if s0 <= min(ds) <= s1:
                bridges.append([round(min(ds), 1), round(max(ds), 1), f["properties"]["id"]])
    bridges.sort()

    # Road bridges over the line: the lidar DTM keeps their decks, which would put a hump in the trail profile.
    k_lon = 111320 * math.cos(math.radians(lat_c))
    loc = lambda lo, la: ((lo - lon0) * k_lon, (la - lat0) * 111320)
    sec_idx = [i for i in range(len(lons) - 1) if dist[i + 1] >= s0 - PROFILE_PAD_M and dist[i] <= s1 + PROFILE_PAD_M]
    overbridges = []
    for f in feats:
        tags = f["properties"]["tags"]
        if not tags.get("bridge") or "highway" not in tags or f["geometry"]["type"] != "LineString":
            continue
        road = [loc(*c) for c in f["geometry"]["coordinates"]]
        for i in sec_idx:
            a, b = loc(lons[i], lats[i]), loc(lons[i + 1], lats[i + 1])
            for p, q in zip(road, road[1:]):
                den = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0])
                if den == 0:
                    continue
                t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / den
                w = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / den
                if not (0 <= t <= 1 and 0 <= w <= 1):
                    continue
                d = dist[i] + t * (dist[i + 1] - dist[i])
                rail = (b[0] - a[0], b[1] - a[1])
                rd = (q[0] - p[0], q[1] - p[1])
                sin = abs(rail[0] * rd[1] - rail[1] * rd[0]) / (math.hypot(*rail) * math.hypot(*rd))
                half = (ROAD_WIDTH_M.get(tags["highway"], 4) / 2 + 3) / max(sin, 0.3) + 5  # deck footprint + abutments
                overbridges.append([round(d - half, 1), round(d + half, 1), f["properties"]["id"], tags["highway"]])
    overbridges.sort()

    # Trail profile from the 1 m DTM along the centreline.
    ds = np.arange(s0 - PROFILE_PAD_M, s1 + PROFILE_PAD_M + 1, 1.0)
    plon, plat = along(lons, lats, dist, ds)
    pe, pn = wgs84_to_bng(plon, plat)
    p0x, p0y = cog.pixel_size(PROFILE_LEVEL)
    c0, c1 = int(math.floor((pe.min() - et) / p0x)) - 2, int(math.ceil((pe.max() - et) / p0x)) + 2
    r0, r1 = int(math.floor((nt - pn.max()) / p0y)) - 2, int(math.ceil((nt - pn.min()) / p0y)) + 2
    fine = cog.read_window(PROFILE_LEVEL, c0, r0, c1 - c0, r1 - r0)
    fx, fy = (pe - et) / p0x - 0.5 - c0, (nt - pn) / p0y - 0.5 - r0
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    u, v = fx - ix, fy - iy
    raw = (fine[iy, ix] * (1 - u) * (1 - v) + fine[iy, ix + 1] * u * (1 - v)
           + fine[iy + 1, ix] * (1 - u) * v + fine[iy + 1, ix + 1] * u * v).astype(float)
    if np.any(raw == cog.nodata) or not np.all(np.isfinite(raw)):
        raise SystemExit("nodata on the centreline in the 1 m DTM")
    on_bridge = np.zeros(ds.shape, dtype=bool)
    spans = [(b0 - 5, b1 + 5) for b0, b1, _ in bridges]  # rail over: the DTM has the ground under the deck, not the deck
    spans += [(o0, o1) for o0, o1, _, _ in overbridges]  # road over: the DTM has the road deck, not the trackbed
    interpolate_spans(ds, raw, on_bridge, spans)
    half = 12
    cs = np.concatenate([[0.0], np.cumsum(raw)])
    smooth = np.array([(cs[min(len(raw), i + half + 1)] - cs[max(0, i - half)]) / (min(len(raw), i + half + 1) - max(0, i - half))
                       for i in range(len(raw))])
    noise = float(np.std((raw - smooth)[~on_bridge]))
    keep = (ds % 5 == 0)
    write_json("public/data/trail-profile-poc.json", {
        "distanceM": [float(d) for d in ds[keep]], "elevationM": [round(float(h), 3) for h in smooth[keep]],
        "smoothingM": 25, "noiseStdM": round(noise, 3), "bridges": [[b0, b1] for b0, b1, _ in bridges],
        "bridgeWays": [w for _, _, w in bridges], "overbridges": [[o0, o1] for o0, o1, _, _ in overbridges],
        "overbridgeWays": [w for _, _, w, _ in overbridges], "source": "lidar DTM 1 m along the OSM centreline", "retrieved": TODAY,
    })

    # Land cover per DEM node.
    cc, rr = np.meshgrid(np.arange(cols), np.arange(rows))
    nlon, nlat = bng_to_wgs84(origin_e + cc * 4.0, origin_n - rr * 4.0)
    classes = np.full((rows, cols), LEGEND.index("other"), dtype=np.uint8)
    assigned = np.zeros((rows, cols), dtype=bool)
    polys = [(landcover_class(f["properties"]["tags"]), f) for f in feats if f["geometry"]["type"] in ("Polygon", "MultiPolygon")]
    for k in range(len(LEGEND) - 1):
        for cls, f in polys:
            if cls != k:
                continue
            outers = f["geometry"]["coordinates"] if f["geometry"]["type"] == "Polygon" else [p[0] for p in f["geometry"]["coordinates"]]
            if f["geometry"]["type"] == "Polygon":
                outers = [outers[0]]
            inners = f["properties"].get("inner_rings", [])
            for ring in outers:
                xs, ys = [p[0] for p in ring], [p[1] for p in ring]
                box = (~assigned) & (nlon >= min(xs)) & (nlon <= max(xs)) & (nlat >= min(ys)) & (nlat <= max(ys))
                if not box.any():
                    continue
                inside = np.zeros_like(box)
                inside[box] = point_in_ring(nlon[box], nlat[box], ring)
                for hole in inners:
                    inside[box] &= ~point_in_ring(nlon[box], nlat[box], hole)
                classes[inside] = k
                assigned |= inside
    with open(os.path.join(ROOT, "public/data/landcover-poc.u8"), "wb") as f:
        f.write(classes.tobytes())
    counts = {LEGEND[k]: int((classes == k).sum()) for k in range(len(LEGEND))}
    write_json("public/data/landcover-poc.json", {"legend": LEGEND, "file": "landcover-poc.u8", "counts": counts,
                                                   "source": "OpenStreetMap contributors (ODbL)", "retrieved": TODAY}, indent=2)

    # OSM features kept for rendering and register checks.
    roads = [f for f in feats if f["properties"]["tags"].get("highway") in ROAD_CLASSES and f["geometry"]["type"] == "LineString"]
    structures = [f for f in feats if any(k in f["properties"]["tags"] for k in ("bridge", "cutting", "embankment", "tunnel"))
                  and f["properties"]["tags"].get("name") == "Bala and Festiniog Railway"]
    kept = roads + structures + [f for c, f in polys if c is not None]
    write_json("public/data/osm-poc.geojson", {"type": "FeatureCollection", "retrieved": TODAY,
                                                "source": "OpenStreetMap contributors (ODbL), api.openstreetmap.org/api/0.6/map",
                                                "features": kept})

    # Feature register (earthworks are added by scripts/gen-earthworks.mjs from the TypeScript core).
    scene = [SCENE]
    features = [
        {"id": "terrain-lidar", "kind": "terrain", "category": "approximate", "source": {"type": "lidar-dtm", "ref": LIDAR_URL},
         "scenes": scene, "note": "1 m DTM shown at its 4 m overview; WGS84-BNG by Helmert, about ±5 m horizontally"},
        {"id": "landcover-osm", "kind": "landcover", "category": "approximate",
         "source": {"type": "osm", "ref": "landuse/natural polygons in public/data/osm-poc.geojson"}, "scenes": scene},
        {"id": "trail-proposed", "kind": "trail", "category": "proposed", "source": {"type": "original", "ref": "concept treatment, 3.0 m shared-use"},
         "scenes": scene, "note": "follows the OSM centreline of the Bala and Festiniog Railway; width not yet checked against ATAG 2021"},
        {"id": "trees", "kind": "vegetation", "category": "decorative", "source": {"type": "original", "ref": "seeded placement inside OSM woodland"},
         "scenes": scene},
        {"id": "cyclist", "kind": "cyclist", "category": "decorative", "source": {"type": "original", "ref": "procedural model"}, "scenes": scene},
    ]
    for b0, b1, wid in bridges:
        features.append({"id": f"bridge-{wid.split('/')[1]}", "kind": "structure", "category": "approximate", "source": {"type": "osm", "ref": wid},
                         "scenes": scene, "fromKm": b0 / 1000, "toKm": b1 / 1000, "note": "position from OSM; generic deck and parapets"})
    for o0, o1, wid, hw in overbridges:
        features.append({"id": f"overbridge-{wid.split('/')[1]}", "kind": "structure", "category": "approximate",
                         "source": {"type": "osm", "ref": wid}, "scenes": scene, "fromKm": o0 / 1000, "toKm": o1 / 1000,
                         "note": f"highway={hw} bridge over the line; the DTM keeps its deck, so it was removed from the trail "
                                 "profile and the trail passes beneath; drawn by the road ribbon"})
    for f in roads:
        pid = f["properties"]["id"]
        features.append({"id": f"road-{pid.split('/')[1]}", "kind": "road", "category": "approximate", "source": {"type": "osm", "ref": pid},
                         "scenes": scene, "note": f"highway={f['properties']['tags'].get('highway')}"})
    write_json("data/features-3d.json", features, indent=2)
    write_json("data/assets-3d.json", [], indent=2)

    print(f"DEM {cols}x{rows} nodes, {float(grid.min()):.1f}-{float(grid.max()):.1f} m; bridges {bridges}; overbridges {overbridges}; "
          f"profile noise {noise:.2f} m; roads {len(roads)}; land cover {counts}")


if __name__ == "__main__":
    if len(sys.argv) > 1:  # no options: an argument (even --help) must not start the networked build (t13)
        sys.exit("usage: python3 scripts/build_poc_data.py   (no arguments; rebuilds the POC window over the network)")
    main()
