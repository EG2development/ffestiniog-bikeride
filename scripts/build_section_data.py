# Iteration 2: water holes and shared lake levels (docs/adr/0041-water-polygons-with-holes.md, docs/adr/0042-one-level-per-water-body.md); buildings are built by a separate script (docs/adr/0049-buildings-from-sourced-data.md).
"""Build one section's data window for the reel (docs/adr/0029-terrain-windows-per-section.md,
docs/adr/0032-water-from-osm.md, docs/pseudocode-reel.md §1).

  python3 scripts/build_section_data.py --section <id>   # corridor | blaenau | vale-north | vale-south | maentwrog | trawsfynydd
  npm run data:sync

Writes public/data/sections/<id>/{dem.json,dem.f32,dem-source.u8,landcover.json,landcover.u8,trail-profile.json,osm.geojson}
and data/features-<id>.json. Needs network access to the Welsh lidar COG and (ground windows) the OSM API.
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
from bridge_ground import span_ground  # noqa: E402
from build_poc_data import (LEGEND, LIDAR_URL, PROFILE_PAD_M, ROAD_CLASSES, ROOT, along, distance_of,  # noqa: E402
                            interpolate_spans, landcover_class, load_route, overbridge_spans, point_in_ring, section_box,
                            write_json)
from dem.bng import bng_to_wgs84, wgs84_to_bng  # noqa: E402
from dem.cog import Cog  # noqa: E402
from osm.fetch_bbox import _relation_features, complete_water_relations, fetch_bbox, fetch_way_full, to_features  # noqa: E402
from osm.extras import building_value, extra_tags, extras_of, owned_by_extras  # noqa: E402
from lidar_underbridges import owns as owns_underbridge, underbridge_spans  # noqa: E402

TODAY = datetime.date.today().isoformat()
MARGIN_M = 600
# level: the COG overview index (0 = 1 m, 1 = 2 m, 2 = 4 m, 3 = 8 m, 4 = 16 m); spacing: the nominal node spacing written to the header
SECTIONS = {
    "corridor": {"km": (0, 13240), "level": 4, "spacing": 16, "kind": "aerial", "osm": True, "splits": 6, "scenes": ["Reel3D", "Section-intro", "Section-heritage", "Section-overview", "Section-closing"]},
    "blaenau": {"km": (0, 1500), "level": 2, "spacing": 4, "kind": "ground", "scenes": ["Reel3D", "Section-blaenau"]},
    "vale-north": {"km": (1500, 4800), "level": 2, "spacing": 4, "kind": "ground", "scenes": ["Reel3D", "Section-vale-north"]},
    "vale-south": {"km": (4800, 7700), "level": 2, "spacing": 4, "kind": "ground", "scenes": ["Reel3D", "Section-vale-south"]},
    "maentwrog": {"km": (7700, 9700), "level": 2, "spacing": 4, "kind": "ground", "scenes": ["Reel3D", "Section-maentwrog"]},
    "trawsfynydd": {"km": (9700, 13240), "level": 2, "spacing": 4, "kind": "ground", "scenes": ["Reel3D", "Section-trawsfynydd"]},
}
# Only the tags the renderer and the registers read leave the pipeline (data minimisation; docs/adr/0038-labels-from-curated-files.md).
# Everything else OSM holds about a feature (addresses, house names, phone numbers, operators, websites) is dropped at write time.
KEEP_TAGS = {"highway", "bridge", "tunnel", "cutting", "embankment", "layer", "railway", "natural", "landuse", "water", "waterway", "leisure", "man_made", "building"}


def minimise_tags(features):
    """Returns the features with only KEEP_TAGS (an extra kind its own, osm/extras.py), `building` reduced to "yes" ("ruins"
    or "abandoned" for those), and `name` kept only for the railway itself."""
    out = []
    for f in features:
        tags = f["properties"].get("tags", {})
        kept = extra_tags(f) or {k: v for k, v in tags.items() if k in KEEP_TAGS}
        if "building" in kept:
            kept["building"] = building_value(tags)
        if tags.get("name") == "Bala and Festiniog Railway":
            kept["name"] = tags["name"]
        props = {k: v for k, v in f["properties"].items() if k != "tags"}
        props["tags"] = kept
        out.append({**f, "properties": props})
    return out


def sample(grid, origin_e, origin_n, px, py, e, n):
    """Nearest-node DTM value at BNG (e, n), or nodata outside the grid."""
    c = int(round((e - origin_e) / px))
    r = int(round((origin_n - n) / py))
    if 0 <= r < grid.shape[0] and 0 <= c < grid.shape[1]:
        return float(grid[r, c])
    return float("nan")


def _signed_area(ring):
    return sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring))) / 2


def _dedupe(ring):
    ring = [tuple(p) for p in ring]
    return ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring


def _oriented(ring, anticlockwise):
    return ring if (_signed_area(ring) > 0) == anticlockwise else ring[::-1]


def polygon_rings(feature):
    """One normaliser for polygons with holes (ADR 41), mirrored by the core's polygonsOf: [(outer, holes)] per part,
    from the geometry's own holes and from properties.inner_rings, each inner ring given to the part that holds most of
    its vertices; outer rings anticlockwise and holes clockwise in lon/lat, with no closing duplicate."""
    g = feature["geometry"]
    parts = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"] if g["type"] == "MultiPolygon" else []
    out = [(_dedupe(p[0]), [_dedupe(h) for h in p[1:]]) for p in parts if p and len(p[0]) >= 4]
    for ring in feature["properties"].get("inner_rings") or []:
        lons, lats = np.array([p[0] for p in ring]), np.array([p[1] for p in ring])
        votes = [int(point_in_ring(lons, lats, outer + [outer[0]]).sum()) for outer, _ in out]
        if votes and max(votes) > 0:
            out[votes.index(max(votes))][1].append(_dedupe(ring))  # most vertices inside: robust to a shore-touching first vertex (t10 P-L6)
        else:
            print(f"warning: {feature['properties'].get('id')}: an inner ring lies in no outer ring; dropped")
    return [(_oriented(o, True), [_oriented(h, False) for h in hs]) for o, hs in out]


def _inside(nlon, nlat, outer, holes, box):
    inside = np.zeros_like(box)
    inside[box] = point_in_ring(nlon[box], nlat[box], outer + [outer[0]])
    for h in holes:
        inside[box] &= ~point_in_ring(nlon[box], nlat[box], h + [h[0]])
    return inside


def fill_water(grid, nodata, origin_e, origin_n, px, py, water, levels=None):
    """Inside each water polygon, minus its holes (islands), nodata, outliers (> 2 m from the level) and any ground above
    the level (it would rise through the surface; t10 P-H1) take the level:
    the body's shared level from data/water-levels.json if given, else the median of the grid along its outer ring
    (ADRs 41, 42). Returns the mask filled. `water` is [(feature id, polygon_rings(feature))]."""
    rows, cols = grid.shape
    cc, rr = np.meshgrid(np.arange(cols), np.arange(rows))
    nlon, nlat = bng_to_wgs84(origin_e + cc * px, origin_n - rr * py)
    filled = np.zeros(grid.shape, dtype=bool)
    for fid, rings in water:
        for outer, holes in rings:
            xs, ys = [p[0] for p in outer], [p[1] for p in outer]
            box = (nlon >= min(xs)) & (nlon <= max(xs)) & (nlat >= min(ys)) & (nlat <= max(ys))
            if not box.any():
                continue
            inside = _inside(nlon, nlat, outer, holes, box)
            if not inside.any():
                continue
            level = (levels or {}).get(fid)
            if level is None:
                re, rn = wgs84_to_bng(np.array(xs), np.array(ys))
                shore = [sample(grid, origin_e, origin_n, px, py, e, n) for e, n in zip(re, rn)]
                shore = [h for h in shore if np.isfinite(h) and h != nodata]
                if not shore:
                    continue
                level = float(np.median(shore))
            bad = inside & ((grid == nodata) | ~np.isfinite(grid) | (np.abs(grid - level) > 2.0) | (grid > level))
            grid[bad] = level
            filled |= bad
    return filled


def water_levels(cog, water, min_area_m2=10_000, step_m=5.0, margin_m=50.0):
    """One level per water body, read once over the whole body at the 4 m level (ADR 42): the median of the DTM along
    its outer ring every `step_m`, nodata dropped. Returns {id: {levelM, samples, cogLevel, retrieved}}."""
    level_ix = 2
    out = {}
    for fid, rings in water:
        outer = max((o for o, _ in rings), key=lambda o: abs(_signed_area(o)), default=None)
        if outer is None:
            continue
        e, n = wgs84_to_bng(np.array([p[0] for p in outer]), np.array([p[1] for p in outer]))
        area = abs(sum(e[i] * n[(i + 1) % len(e)] - e[(i + 1) % len(e)] * n[i] for i in range(len(e)))) / 2
        area -= sum(abs(_signed_area(list(zip(*wgs84_to_bng(np.array([p[0] for p in h]), np.array([p[1] for p in h])))))) for _, hs in rings for h in hs)
        if area < min_area_m2:
            continue
        px, py = cog.pixel_size(level_ix)
        col0 = math.floor((e.min() - margin_m - cog.origin_e) / px)
        col1 = math.ceil((e.max() + margin_m - cog.origin_e) / px)
        row0 = math.floor((cog.origin_n - (n.max() + margin_m)) / py)
        row1 = math.ceil((cog.origin_n - (n.min() - margin_m)) / py)
        g = cog.read_window(level_ix, col0, row0, col1 - col0, row1 - row0).astype(np.float64)
        oe, on = cog.origin_e + (col0 + 0.5) * px, cog.origin_n - (row0 + 0.5) * py
        samples = []
        for i in range(len(e)):
            e0, n0, e1, n1 = e[i], n[i], e[(i + 1) % len(e)], n[(i + 1) % len(n)]
            steps = max(1, int(math.hypot(e1 - e0, n1 - n0) // step_m))
            for k in range(steps):
                h = sample(g, oe, on, px, py, e0 + (e1 - e0) * k / steps, n0 + (n1 - n0) * k / steps)
                if np.isfinite(h) and h != cog.nodata:
                    samples.append(h)
        if samples:
            out[fid] = {"levelM": round(float(np.median(samples)), 3), "samples": len(samples), "cogLevel": level_ix, "retrieved": TODAY}
    return out


def merge_water_levels(new):
    path = os.path.join(ROOT, "data/water-levels.json")
    levels = json.load(open(path)) if os.path.exists(path) else {}
    levels.update(new)
    with open(path, "w") as f:
        json.dump(dict(sorted(levels.items())), f, indent=2)
        f.write("\n")
    return {k: v["levelM"] for k, v in levels.items()}


def fill_neighbours(grid, nodata, passes=50):
    """Last resort for nodata outside water: the mean of valid 8-neighbours, repeated. Returns the mask filled."""
    filled = np.zeros(grid.shape, dtype=bool)
    for _ in range(passes):
        bad = (grid == nodata) | ~np.isfinite(grid)
        if not bad.any():
            break
        padded = np.pad(np.where(bad, np.nan, grid), 1, constant_values=np.nan)
        stack = np.stack([padded[1 + dr:1 + dr + grid.shape[0], 1 + dc:1 + dc + grid.shape[1]] for dr in (-1, 0, 1) for dc in (-1, 0, 1) if dr or dc])
        mean = np.nanmean(stack, axis=0)
        fix = bad & np.isfinite(mean)
        grid[fix] = mean[fix]
        filled |= fix
    return filled


def main(section, reuse_osm=False):
    S = SECTIONS[section]
    s0, s1 = S["km"]
    out_rel = f"public/data/sections/{section}"
    os.makedirs(os.path.join(ROOT, out_rel), exist_ok=True)
    lons, lats, dist = load_route()

    (lon0, lat0, lon1, lat1), lat_c = section_box(lons, lats, dist, s0, s1, MARGIN_M)
    ce, cn = wgs84_to_bng(np.array([lon0, lon0, lon1, lon1]), np.array([lat0, lat1, lat0, lat1]))
    emin, emax, nmin, nmax = float(ce.min()), float(ce.max()), float(cn.min()), float(cn.max())

    # OSM for the ground windows, and for the corridor's photo look, which draws land cover, roads and water instead of the
    # map tiles (ADR 33 for the concept look; docs/adr/0060-reel-in-the-photo-look.md). `splits` cuts a large box for the API.
    feats = []
    if S["kind"] == "ground" or S.get("osm"):
        if reuse_osm:
            # the window's own allowlisted OSM, so every other feature stays byte-stable (spec CL7)
            feats = json.load(open(os.path.join(ROOT, out_rel, "osm.geojson")))["features"]
            # overbridge ways the last build found but an older osm.geojson did not keep (t10 P-M3)
            prof_path = os.path.join(ROOT, out_rel, "trail-profile.json")
            have = {f["properties"]["id"] for f in feats}
            for wid in (json.load(open(prof_path)).get("overbridgeWays", []) if os.path.exists(prof_path) else []):
                if wid not in have and (f := fetch_way_full(wid.split("/")[1])) is not None:
                    print(f"restored {wid} from the OSM API")
                    feats.append(f)
        else:
            splits = S.get("splits") or (2 if (s1 - s0) <= 2200 else 3)
            feats = to_features(*fetch_bbox(lon0, lat0, lon1, lat1, splits=splits))
        feats = complete_water_relations(feats)
    polys = [(landcover_class(f["properties"]["tags"]), f) for f in feats if f["geometry"]["type"] in ("Polygon", "MultiPolygon")]
    water = [(f["properties"]["id"], polygon_rings(f)) for cls, f in polys if cls == 0]

    # DEM window at the section's level: nodes are pixel centres.
    cog = Cog(LIDAR_URL)
    et, nt = cog.origin_e, cog.origin_n
    px, py = cog.pixel_size(S["level"])
    assert abs(px - S["spacing"]) < 0.01 * S["spacing"], (px, S["spacing"])
    col0, col1 = math.floor((emin - et) / px), math.ceil((emax - et) / px)
    row0, row1 = math.floor((nt - nmax) / py), math.ceil((nt - nmin) / py)
    grid = cog.read_window(S["level"], col0, row0, col1 - col0, row1 - row0).astype(np.float64)
    rows, cols = grid.shape
    origin_e, origin_n = et + (col0 + 0.5) * px, nt - (row0 + 0.5) * py
    before = int(((grid == cog.nodata) | ~np.isfinite(grid)).sum())
    levels = merge_water_levels(water_levels(cog, water)) if water else {}
    water_filled = fill_water(grid, cog.nodata, origin_e, origin_n, px, py, water, levels)
    other_filled = fill_neighbours(grid, cog.nodata)
    left = int(((grid == cog.nodata) | ~np.isfinite(grid)).sum())
    if left:
        raise SystemExit(f"{left} nodata cells remain in the {section} window after filling")
    source = np.where(water_filled | other_filled, 1, 0).astype(np.uint8)
    with open(os.path.join(ROOT, out_rel, "dem.f32"), "wb") as f:
        f.write(grid.astype("<f4").tobytes())
    with open(os.path.join(ROOT, out_rel, "dem-source.u8"), "wb") as f:
        f.write(source.tobytes())
    write_json(f"{out_rel}/dem.json", {
        "cols": cols, "rows": rows, "spacingM": S["spacing"], "pixelSizeM": [px, py], "originE": origin_e, "originN": origin_n,
        "crs": "EPSG:27700", "nodata": cog.nodata, "fallbackCells": int(source.sum()), "file": "dem.f32", "sourceFile": "dem-source.u8",
        "source": f"Welsh Government / NRW lidar DTM, 1 m, 32-bit COG ({S['spacing']} m overview level)", "url": LIDAR_URL,
        "licence": "Open Government Licence v3.0 (confirmed 2026-10-30 on the DataMapWales LiDAR viewer; data/source-register.md)",
        "fill": {"nodataBefore": before, "waterShoreHeight": int(water_filled.sum()), "neighbourMean": int(other_filled.sum()),
                 "note": "filled cells have sourceIndex 1 and are approximate (ADR 32)"},
        "section": section, "kmRange": [s0 / 1000, s1 / 1000], "retrieved": TODAY, "heightsMin": float(grid.min()), "heightsMax": float(grid.max()),
    }, indent=2)

    # Bridges on the railway, and road bridges over it (ADR 23).
    bridges = []
    for f in feats:
        tags = f["properties"]["tags"]
        if tags.get("bridge") and tags.get("name") == "Bala and Festiniog Railway" and f["geometry"]["type"] == "LineString":
            ds = [distance_of(lons, lats, dist, lo, la) for lo, la in f["geometry"]["coordinates"]]
            if max(ds) >= s0 and min(ds) <= s1:  # any overlap with the window, so a bridge across its edge is kept (review R7)
                bridges.append([round(min(ds), 1), round(max(ds), 1), f["properties"]["id"]])
    bridges = sorted(bridges + underbridge_spans(s0, s1))  # with the decks the lidar shows and OSM lacks (lidar_underbridges.py)
    overbridges = overbridge_spans(feats, lons, lats, dist, s0, s1, lon0, lat0, lat_c)

    # Trail profile along the centreline: 1 m for ground windows, the window's own level for the corridor.
    plevel = 0 if S["kind"] == "ground" else S["level"]
    ds = np.arange(s0 - PROFILE_PAD_M if s0 > 0 else 0, s1 + PROFILE_PAD_M + 1, 1.0)
    plon, plat = along(lons, lats, dist, ds)
    pe, pn = wgs84_to_bng(plon, plat)
    p0x, p0y = cog.pixel_size(plevel)
    c0, c1 = int(math.floor((pe.min() - et) / p0x)) - 2, int(math.ceil((pe.max() - et) / p0x)) + 2
    r0, r1 = int(math.floor((nt - pn.max()) / p0y)) - 2, int(math.ceil((nt - pn.min()) / p0y)) + 2
    fine = cog.read_window(plevel, c0, r0, c1 - c0, r1 - r0).astype(np.float64)
    fine[(fine == cog.nodata) | ~np.isfinite(fine)] = np.nan
    fx, fy = (pe - et) / p0x - 0.5 - c0, (nt - pn) / p0y - 0.5 - r0
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    u, v = fx - ix, fy - iy
    raw = (fine[iy, ix] * (1 - u) * (1 - v) + fine[iy, ix + 1] * u * (1 - v) + fine[iy + 1, ix] * (1 - u) * v + fine[iy + 1, ix + 1] * u * v)
    if np.isnan(raw).any():
        # nodata on the centreline (a bridge over water, say): bridge it from the neighbours
        good = ~np.isnan(raw)
        raw = np.interp(ds, ds[good], raw[good])
    ground = span_ground(ds, raw, [(b0, b1) for b0, b1, _ in bridges])  # what passes under each span (bridge_ground.py)
    on_bridge = np.zeros(ds.shape, dtype=bool)
    spans = [(b0 - 5, b1 + 5) for b0, b1, _ in bridges] + [(o0, o1) for o0, o1, _, _ in overbridges]
    interpolate_spans(ds, raw, on_bridge, spans)
    half = 12
    cs = np.concatenate([[0.0], np.cumsum(raw)])
    smooth = np.array([(cs[min(len(raw), i + half + 1)] - cs[max(0, i - half)]) / (min(len(raw), i + half + 1) - max(0, i - half)) for i in range(len(raw))])
    noise = float(np.std((raw - smooth)[~on_bridge]))
    keep = (ds % 5 == 0)
    write_json(f"{out_rel}/trail-profile.json", {
        "distanceM": [float(d) for d in ds[keep]], "elevationM": [round(float(h), 3) for h in smooth[keep]],
        "smoothingM": 25, "noiseStdM": round(noise, 3), "bridges": [[b0, b1] for b0, b1, _ in bridges], "bridgeWays": [w for _, _, w in bridges], "bridgeGroundM": ground,
        "overbridges": [[o0, o1] for o0, o1, _, _ in overbridges], "overbridgeWays": [w for _, _, w, _ in overbridges],
        "source": f"lidar DTM {1 if plevel == 0 else S['spacing']} m along the OSM centreline", "retrieved": TODAY,
    })

    # Land cover per node wherever OSM was fetched; without it a window is all "other".
    classes = np.full((rows, cols), LEGEND.index("other"), dtype=np.uint8)
    if feats:
        cc, rr = np.meshgrid(np.arange(cols), np.arange(rows))
        nlon, nlat = bng_to_wgs84(origin_e + cc * px, origin_n - rr * py)
        assigned = np.zeros((rows, cols), dtype=bool)
        for k in range(len(LEGEND) - 1):
            for cls, f in polys:
                if cls != k:
                    continue
                for outer, holes in polygon_rings(f):
                    xs, ys = [p[0] for p in outer], [p[1] for p in outer]
                    box = (~assigned) & (nlon >= min(xs)) & (nlon <= max(xs)) & (nlat >= min(ys)) & (nlat <= max(ys))
                    if not box.any():
                        continue
                    inside = _inside(nlon, nlat, outer, holes, box)
                    classes[inside] = k
                    assigned |= inside
    with open(os.path.join(ROOT, out_rel, "landcover.u8"), "wb") as f:
        f.write(classes.tobytes())
    counts = {LEGEND[k]: int((classes == k).sum()) for k in range(len(LEGEND))}
    write_json(f"{out_rel}/landcover.json", {"legend": LEGEND, "file": "landcover.u8", "counts": counts,
                                             "source": "OpenStreetMap contributors (ODbL)" if feats else "none (aerial window: map-tile drape)", "retrieved": TODAY}, indent=2)

    roads = [f for f in feats if f["properties"]["tags"].get("highway") in ROAD_CLASSES and f["geometry"]["type"] == "LineString"]
    structures = [f for f in feats if any(k in f["properties"]["tags"] for k in ("bridge", "cutting", "embankment", "tunnel"))
                  and f["properties"]["tags"].get("name") == "Bala and Festiniog Railway"]
    over_ids = {w for _, _, w, _ in overbridges}  # footbridges and other non-road overbridges must survive a --reuse-osm rebuild (t10 P-M3)
    kept = minimise_tags(roads + structures + [f for f in feats if f["properties"]["id"] in over_ids and f not in roads] + [f for c, f in polys if c is not None] + extras_of(feats))
    write_json(f"{out_rel}/osm.geojson", {"type": "FeatureCollection", "retrieved": TODAY, "section": section,
                                          "source": "OpenStreetMap contributors (ODbL), api.openstreetmap.org/api/0.6/map" if feats else "none",
                                          "features": kept})

    # Register entries for this window; Maentwrog's live in data/features-3d.json already.
    scenes = S["scenes"]
    features = []
    if section != "maentwrog":
        features.append({"id": f"terrain-{section}", "kind": "terrain", "category": "approximate", "source": {"type": "lidar-dtm", "ref": LIDAR_URL}, "scenes": scenes,
                         "note": f"lidar DTM at its {S['spacing']} m overview; {int(source.sum())} cells filled (water shore height or neighbour mean), see dem.json"})
        if feats:
            features.append({"id": f"landcover-{section}", "kind": "landcover", "category": "approximate",
                             "source": {"type": "osm", "ref": f"landuse/natural polygons in {out_rel}/osm.geojson"}, "scenes": scenes})
        # the line's structures are registered by the ground windows; an aerial window would draw them twice
        for b0, b1, wid in ([b for b in bridges if b[2].startswith("way/")] if S["kind"] == "ground" else []):  # lidar ones: lidar_underbridges.py
            features.append({"id": f"bridge-{section}-{wid.split('/')[1]}", "kind": "structure", "category": "approximate", "source": {"type": "osm", "ref": wid},
                             "scenes": scenes, "fromKm": b0 / 1000, "toKm": b1 / 1000, "note": "position from OSM; generic deck and parapets"})
        for o0, o1, wid, hw in (overbridges if S["kind"] == "ground" else []):
            features.append({"id": f"overbridge-{section}-{wid.split('/')[1]}", "kind": "structure", "category": "approximate", "source": {"type": "osm", "ref": wid},
                             "scenes": scenes, "fromKm": o0 / 1000, "toKm": o1 / 1000, "note": f"highway={hw} bridge over the line; deck removed from the trail profile (ADR 23)"})
        for f in roads:
            pid = f["properties"]["id"]
            features.append({"id": f"road-{section}-{pid.split('/')[1]}", "kind": "road", "category": "approximate", "source": {"type": "osm", "ref": pid},
                             "scenes": scenes, "note": f"highway={f['properties']['tags'].get('highway')}"})
        for cls, f in polys:
            if cls == 0:
                pid = f["properties"]["id"]
                features.append({"id": f"water-{section}-{pid.split('/')[1]}", "kind": "water", "category": "approximate", "source": {"type": "osm", "ref": pid},
                                 "scenes": scenes, "note": "surface at the median DTM height along the shore; not a surveyed level (ADR 32)"})
    write_json(f"data/features-{section}.json", keep_owned(os.path.join(ROOT, f"data/features-{section}.json"), features), indent=2)
    print(f"{section}: DEM {cols}x{rows} @ {S['spacing']} m, {float(grid.min()):.1f}-{float(grid.max()):.1f} m, filled {int(source.sum())} "
          f"(water {int(water_filled.sum())}); bridges {len(bridges)}; overbridges {len(overbridges)}; noise {noise:.2f} m; roads {len(roads)}; "
          f"water bodies {len(water)} (levels {', '.join(f'{k} {v:.2f} m' for k, v in levels.items() if any(k == w for w, _ in water))}); land cover {counts}")


# register entries other steps own: build_buildings.py writes the buildings, gen-earthworks.ts the earthworks, fetch_barriers.py
# the boundaries, fetch_osm_extras.py the watercourses and power lines and lidar_underbridges.py its bridges (each replaces only
# its own), so a rebuild keeps them (t9 F4; t10: vale-north lost its 17 earthworks on a rebuild)
OWNED_ELSEWHERE = ("building", "earthwork", "barrier")


def keep_owned(path, generated):
    """The window register as generated, plus the existing entries another step owns."""
    existing = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else []  # gen-earthworks.ts writes UTF-8
    return generated + [e for e in existing if e.get("kind") in OWNED_ELSEWHERE or owned_by_extras(e) or owns_underbridge(e)]


def self_test():
    """Synthetic checks of the water normaliser and fill (spec WA3, WA4; no network). Exit 0 when all hold."""
    def sq(x0, y0, s):
        return [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s], [x0, y0]]
    failures = []
    # a 40 x 40 grid of 1 m cells near (lon 0.0005, lat 0.0005) is awkward in BNG; test in grid space instead:
    # project lon/lat = BNG metres via a stand-in transform, so the fill sees an island lake at 100 m with a 105 m island
    global bng_to_wgs84
    saved = bng_to_wgs84
    bng_to_wgs84 = lambda e, n: (np.asarray(e, dtype=float), np.asarray(n, dtype=float))  # noqa: E731
    try:
        grid = np.full((40, 40), 100.0)
        grid[18:23, 18:23] = 105.0
        grid[12, 12] = 103.5  # an outlier in open water
        lake = {"properties": {"id": "relation/1", "inner_rings": [sq(17.5, 17.5, 5)]}, "geometry": {"type": "Polygon", "coordinates": [sq(9.5, 9.5, 21)]}}
        # grid origin (0, 39): row r is northing 39 - r, so the stand-in lat runs 39 .. 0
        g = grid[::-1].copy()  # northing up = row 0 at the top
        fill_water(g, -9999.0, 0.0, 39.0, 1.0, 1.0, [("relation/1", polygon_rings(lake))], {"relation/1": 100.0})
        island = g[::-1][18:23, 18:23]
        if not (island == 105.0).all():
            failures.append("WA4: island cells were flattened")
        if g[::-1][12, 12] != 100.0:
            failures.append("WA4: an outlier in open water was not filled")
        # Polygon == one-part MultiPolygon; inner_rings == geometry holes
        poly = {"properties": {"id": "a"}, "geometry": {"type": "Polygon", "coordinates": [sq(0, 0, 10), sq(4, 4, 2)]}}
        multi = {"properties": {"id": "a"}, "geometry": {"type": "MultiPolygon", "coordinates": [[sq(0, 0, 10), sq(4, 4, 2)]]}}
        props = {"properties": {"id": "a", "inner_rings": [sq(4, 4, 2)]}, "geometry": {"type": "Polygon", "coordinates": [sq(0, 0, 10)]}}
        if polygon_rings(poly) != polygon_rings(multi):
            failures.append("WA3: Polygon and one-part MultiPolygon differ")
        if polygon_rings(poly) != polygon_rings(props):
            failures.append("WA3: inner_rings and geometry holes differ")
        two = {"properties": {"id": "b", "inner_rings": [sq(24, 4, 2)]}, "geometry": {"type": "MultiPolygon", "coordinates": [[sq(0, 0, 10)], [sq(20, 0, 10)]]}}
        if [len(h) for _, h in polygon_rings(two)] != [0, 1]:
            failures.append("WA3: a hole went to the wrong MultiPolygon part")
        o, hs = polygon_rings(poly)[0]
        if not (_signed_area(o) > 0 and _signed_area(hs[0]) < 0):
            failures.append("WA3: ring orientation (outer anticlockwise, holes clockwise)")
    finally:
        bng_to_wgs84 = saved
    # t10 P-L6: an island whose first vertex lies on the lake's east shore still becomes a hole
    lake = {"properties": {"id": "relation/1", "inner_rings": [[[10.0, 5.0], [8.0, 4.0], [8.0, 6.0], [10.0, 5.0]]]},
            "geometry": {"type": "MultiPolygon", "coordinates": [[sq(0, 0, 10)]]}}
    if [len(h) for _, h in polygon_rings(lake)] != [1]:
        failures.append("t10 P-L6: a shore-touching island was dropped")
    # t10 P-H1: ground above the level inside the lake is lowered to it; an island above it is not
    g = np.full((20, 20), 101.0)
    if True:
        # a lake over the whole grid with an island, in grid lon/lat from bng_to_wgs84 of a fake origin: reuse fill_water's own maths
        oe, on, px = 260000.0, 340000.0, 4.0
        lon0, lat0 = bng_to_wgs84(np.array([oe - 10]), np.array([on + 10]))
        lon1, lat1 = bng_to_wgs84(np.array([oe + 90]), np.array([on - 90]))
        il0, ila0 = bng_to_wgs84(np.array([oe + 30]), np.array([on - 30]))
        il1, ila1 = bng_to_wgs84(np.array([oe + 50]), np.array([on - 50]))
        outer = [[float(lon0[0]), float(lat0[0])], [float(lon1[0]), float(lat0[0])], [float(lon1[0]), float(lat1[0])], [float(lon0[0]), float(lat1[0])], [float(lon0[0]), float(lat0[0])]]
        island = [[float(il0[0]), float(ila0[0])], [float(il1[0]), float(ila0[0])], [float(il1[0]), float(ila1[0])], [float(il0[0]), float(ila1[0])], [float(il0[0]), float(ila0[0])]]
        f = {"properties": {"id": "way/2"}, "geometry": {"type": "Polygon", "coordinates": [outer, island]}}
        g[2, 2] = 100.6  # 0.6 m above the 100 m level, inside the lake
        g[10, 10] = 103.0  # on the island
        fill_water(g, -9999.0, oe, on, px, px, [("way/2", polygon_rings(f))], {"way/2": 100.0})
        if g[2, 2] != 100.0 or g[10, 10] != 103.0:
            failures.append(f"t10 P-H1: lake ground {g[2, 2]} (want 100.0), island {g[10, 10]} (want 103.0)")
    # t10 P-M2: a water relation whose outer ring the box cuts is kept as a placeholder for completion
    placeholder = _relation_features({}, {}, {"7": ({"type": "multipolygon", "natural": "water"}, [("way", "70", "outer")])})
    if not (placeholder and placeholder[0]["properties"].get("incomplete")):
        failures.append("t10 P-M2: a cut water relation must be kept for completion")
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump([{"id": "road-x-1", "kind": "road"}, {"id": "building-x-2", "kind": "building"}, {"id": "earthwork-cut-1.000", "kind": "earthwork"}], fh)
    kept = keep_owned(fh.name, [{"id": "road-x-1", "kind": "road"}])
    os.unlink(fh.name)
    if [e["id"] for e in kept] != ["road-x-1", "building-x-2", "earthwork-cut-1.000"]:
        failures.append(f"t9 F4: a rebuild must keep the building entries, got {[e['id'] for e in kept]}")
    for f in failures:
        print("FAIL", f)
    print("self-test:", "ok" if not failures else f"{len(failures)} failure(s)")
    return 0 if not failures else 1


def strip_existing():
    """Re-applies minimise_tags to every window file already on disk (no network), including the proof of concept's."""
    import glob
    for path in sorted(glob.glob(os.path.join(ROOT, "public/data/sections/*/osm.geojson"))) + [os.path.join(ROOT, "public/data/osm-poc.geojson")]:
        with open(path) as f:
            doc = json.load(f)
        before = sum(len(x["properties"].get("tags", {})) for x in doc["features"])
        doc["features"] = minimise_tags(doc["features"])
        after = sum(len(x["properties"].get("tags", {})) for x in doc["features"])
        with open(path, "w") as f:
            json.dump(doc, f)
            f.write("\n")
        print(f"{os.path.relpath(path, ROOT)}: {len(doc['features'])} features, tags {before} -> {after}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--section", choices=sorted(SECTIONS))
    ap.add_argument("--strip-existing", action="store_true", help="re-apply the tag allowlist to the files on disk, without fetching")
    ap.add_argument("--reuse-osm", action="store_true", help="build from the window's osm.geojson on disk (only water relations are re-fetched, in full)")
    ap.add_argument("--self-test", action="store_true", help="synthetic checks of the water normaliser and fill; no network")
    args = ap.parse_args()
    if args.self_test:
        sys.exit(self_test())
    if args.strip_existing:
        strip_existing()
    elif args.section:
        main(args.section, reuse_osm=args.reuse_osm)
    else:
        ap.error("--section <id> or --strip-existing")
