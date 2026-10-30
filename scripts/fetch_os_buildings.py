# Buildings up to date (docs/adr/0063-buildings-up-to-date.md): Ordnance Survey's open building outlines as a check on OSM.
"""Cross-check one window's OSM building footprints against OS OpenMap - Local, and keep the buildings OSM lacks.

  python3 scripts/fetch_os_buildings.py --section <window> [--zip <OS OpenMap Local SH shapefile zip>]
      network (without --zip): api.os.uk (the OS Downloads API, no key) and the signed blob it redirects to
  python3 scripts/fetch_os_buildings.py --self-test     no network

OS OpenMap - Local (OGL v3, released twice a year; this tile's files are dated with the release) holds building outlines
generalised from OS MasterMap: a terrace may be one polygon. It carries no per-building date, so a polygon is evidence
that the building stood at the release. The window's OSM footprints are compared with it after removing their local
offset (the OSM-to-BNG conversion is the OS Helmert transform, good to about 5 m; the median offset of matched centroids
is taken out). Writes:
  data/os-buildings-<w>.geojson     OS polygons of 25 m^2 or more that overlap no OSM footprint, in the OSM frame, as
                                    footprints the candidate and height passes read (scripts only: the renderer reads
                                    buildings.json)
  data/building-currency-<w>.json   the comparison: OSM footprints OS has and has not, the offset
Run it before `npm run data:candidates` (docs/sop-3d.md).
"""
import argparse
import datetime
import json
import os
import struct
import sys
import urllib.request
import zipfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_poc_data import ROOT, point_in_ring, write_json  # noqa: E402
from dem.bng import bng_to_wgs84, wgs84_to_bng  # noqa: E402
from osm.fetch_bbox import USER_AGENT  # noqa: E402

DOWNLOAD = "https://api.os.uk/downloads/v1/products/OpenMapLocal/downloads?area=SH&format=ESRI%C2%AE+Shapefile&redirect"
PRODUCT = "https://www.ordnancesurvey.co.uk/products/os-open-map-local"
ATTRIBUTION = "Contains OS data © Crown copyright and database right {year}"
MIN_AREA_M2 = 25.0
MATCH_M = 15.0  # centroids nearer than this pair up when measuring the offset
CACHE = os.path.join(ROOT, "out/cache/os/OpenMapLocal-SH.zip")


def read_polygons(shp: bytes):
    """Polygons (shape type 5) from a shapefile: a list of rings per record, coordinates in metres (BNG)."""
    out = []
    pos = 100
    while pos < len(shp):
        _num, length = struct.unpack(">ii", shp[pos:pos + 8])
        rec = shp[pos + 8:pos + 8 + 2 * length]
        pos += 8 + 2 * length
        stype = struct.unpack("<i", rec[:4])[0]
        if stype == 0:
            out.append([])
            continue
        if stype != 5:
            raise ValueError(f"shape type {stype}: only polygons are read")
        nparts, npoints = struct.unpack("<ii", rec[36:44])
        parts = list(struct.unpack(f"<{nparts}i", rec[44:44 + 4 * nparts])) + [npoints]
        pts = np.frombuffer(rec[44 + 4 * nparts:44 + 4 * nparts + 16 * npoints], dtype="<f8").reshape(npoints, 2)
        out.append([pts[parts[k]:parts[k + 1]] for k in range(nparts)])
    return out


def read_dbf(dbf: bytes):
    """Records of a dBASE III table as dicts of stripped strings."""
    nrec, hlen, rlen = struct.unpack("<IHH", dbf[4:12])
    fields, p = [], 32
    while dbf[p] != 0x0D:
        name = dbf[p:p + 11].split(b"\0")[0].decode()
        fields.append((name, dbf[p + 16]))
        p += 32
    out = []
    for i in range(nrec):
        r = dbf[hlen + i * rlen:hlen + (i + 1) * rlen]
        if r[:1] == b"*":  # deleted
            out.append(None)
            continue
        rec, q = {}, 1
        for name, size in fields:
            rec[name] = r[q:q + size].decode("latin-1").strip()
            q += size
        out.append(rec)
    return out


def area_m2(ring):
    x, y = ring[:, 0], ring[:, 1]
    return abs(float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))) / 2


def centroid(ring):
    return ring[:-1].mean(axis=0) if len(ring) > 1 and np.allclose(ring[0], ring[-1]) else ring.mean(axis=0)


def inside(ring, xy):
    return bool(point_in_ring(np.array([xy[0]]), np.array([xy[1]]), [tuple(p) for p in ring])[0])


def overlaps(a, b):
    """Two outlines overlap when a centroid or a vertex of either lies inside the other (enough for building outlines,
    where OS amalgamates a terrace that OSM maps house by house)."""
    if inside(a, centroid(b)) or inside(b, centroid(a)):
        return True
    return any(inside(a, p) for p in b[:-1]) or any(inside(b, p) for p in a[:-1])


def load_os(zip_path):
    with zipfile.ZipFile(zip_path) as z:
        names = {os.path.basename(n): n for n in z.namelist()}
        shp = z.read(names["SH_Building.shp"])
        dbf = z.read(names["SH_Building.dbf"])
        stamp = z.getinfo(names["SH_Building.shp"]).date_time
    polys, recs = read_polygons(shp), read_dbf(dbf)
    if len(polys) != len(recs):
        raise ValueError(f"{len(polys)} shapes but {len(recs)} records")
    release = datetime.date(*stamp[:3]).isoformat()
    return [(r["ID"], r.get("FEATCODE", ""), p[0]) for r, p in zip(recs, polys) if r and p], release


def touches(oring, pts):
    """An OS outline meets OSM geometry: a closed footprint that overlaps it, or an open one (a building way the window's
    box cut, which the OSM extract keeps as a line) with a vertex inside it."""
    return overlaps(oring, pts) if len(pts) >= 4 and np.allclose(pts[0], pts[-1]) else any(inside(oring, p) for p in pts)


def compare(os_items, osm_items, elsewhere=()):
    """(offset m, OS-confirmed OSM ids, unconfirmed OSM ids, OS outlines overlapping no OSM footprint). `elsewhere` is OSM
    building geometry outside the window's own footprints (other windows' footprints, cut ways): an OS outline that meets
    it is in OSM, so it is not kept, though it confirms none of the window's footprints."""
    os_c = np.array([centroid(r) for _i, _f, r in os_items]) if os_items else np.zeros((0, 2))
    d = []
    for _pid, ring in osm_items:
        c = centroid(ring)
        if len(os_c):
            k = int(np.argmin(np.hypot(*(os_c - c).T)))
            if np.hypot(*(os_c[k] - c)) <= MATCH_M:
                d.append(os_c[k] - c)
    offset = np.median(np.array(d), axis=0) if len(d) >= 10 else np.zeros(2)
    shifted = [(pid, ring + offset) for pid, ring in osm_items]
    confirmed, os_hit = set(), set()
    for k, (_oid, _fc, oring) in enumerate(os_items):
        lo, hi = oring.min(axis=0) - 2, oring.max(axis=0) + 2
        for pid, ring in shifted:
            if (ring.max(axis=0) < lo).any() or (ring.min(axis=0) > hi).any():
                continue
            if overlaps(oring, ring):
                confirmed.add(pid)
                os_hit.add(k)
    unconfirmed = sorted(pid for pid, _r in osm_items if pid not in confirmed)
    others = [pts + offset for pts in elsewhere]
    def in_osm_elsewhere(oring):  # noqa: E306
        lo, hi = oring.min(axis=0) - 2, oring.max(axis=0) + 2
        return any(touches(oring, pts) for pts in others if not ((pts.max(axis=0) < lo).any() or (pts.min(axis=0) > hi).any()))
    missing = [os_items[k] for k in range(len(os_items)) if k not in os_hit and area_m2(os_items[k][2]) >= MIN_AREA_M2 and not in_osm_elsewhere(os_items[k][2])]
    return offset, sorted(confirmed), unconfirmed, missing


def _cross(p, q, a, b):
    """Segments pq and ab cross (proper intersection)."""
    d = lambda u, v, w: (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0])  # noqa: E731
    return d(p, q, a) * d(p, q, b) < 0 and d(a, b, p) * d(a, b, q) < 0


def crossed(oring, line):
    """A road runs through an outline: one of its vertices is inside, or one of its segments crosses an edge (spec BL7)."""
    if any(inside(oring, p) for p in line):
        return True
    return any(_cross(line[i], line[i + 1], oring[j], oring[j + 1]) for i in range(len(line) - 1) for j in range(len(oring) - 1))


def building_geometry(features):
    """{OSM id: outer ring in BNG metres} for the building areas, and [BNG points] for building ways kept as lines."""
    areas, lines = {}, []
    for f in features:
        g = f["geometry"]
        if not f["properties"].get("tags", {}).get("building"):
            continue
        if g["type"] in ("Polygon", "MultiPolygon"):
            pts = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
        elif g["type"] == "LineString":
            pts = g["coordinates"]
        else:
            continue
        e, n = wgs84_to_bng(np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))
        if g["type"] == "LineString":
            lines.append(np.column_stack([e, n]))
        else:
            areas[f["properties"]["id"]] = np.column_stack([e, n])
    return areas, lines


def main(section, zip_path):
    if not zip_path:
        zip_path = CACHE
        if not os.path.exists(zip_path):
            os.makedirs(os.path.dirname(zip_path), exist_ok=True)
            req = urllib.request.Request(DOWNLOAD, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=600) as r, open(zip_path, "wb") as fh:
                fh.write(r.read())
    os_all, release = load_os(zip_path)
    rel = f"public/data/sections/{section}"
    h = json.load(open(os.path.join(ROOT, rel, "dem.json")))
    e0, e1 = h["originE"], h["originE"] + (h["cols"] - 1) * h["spacingM"]
    n0, n1 = h["originN"] - (h["rows"] - 1) * h["spacingM"], h["originN"]
    os_items = [(i, fc, r) for i, fc, r in os_all if r[:, 0].max() >= e0 and r[:, 0].min() <= e1 and r[:, 1].max() >= n0 and r[:, 1].min() <= n1]
    osm = json.load(open(os.path.join(ROOT, rel, "osm.geojson")))
    # a footprint data/landmarks.json records as demolished is not compared: an OS outline on its ground is what replaced it
    lm_path = os.path.join(ROOT, "data/landmarks.json")
    gone = {lm["osm"] for lm in (json.load(open(lm_path)) if os.path.exists(lm_path) else []) if lm.get("status") == "demolished"}
    own, cut = building_geometry(osm["features"])
    own = {k: v for k, v in own.items() if k not in gone}
    osm_items = sorted(own.items())
    # a building another window's OSM holds whole, or this window's box cut, is in OSM all the same
    elsewhere = {}
    sections = os.path.join(ROOT, "public/data/sections")
    for w in sorted(os.listdir(sections)):
        path = os.path.join(sections, w, "osm.geojson")
        if w != section and os.path.exists(path):
            elsewhere.update({k: v for k, v in building_geometry(json.load(open(path))["features"])[0].items() if k not in own and k not in gone})
    offset, confirmed, unconfirmed, missing = compare(os_items, osm_items, list(elsewhere.values()) + cut)
    # an OS outline a registered road runs through is the generalised outline spilling over the carriageway, or an arch
    # OSM does not show: the road is current and the outline approximate, so the outline is left out and listed (BL7)
    reg_path = os.path.join(ROOT, f"data/features-{section}.json")
    road_refs = {x["source"]["ref"] for x in (json.load(open(reg_path)) if os.path.exists(reg_path) else []) if x["kind"] == "road"}
    roads = []
    for f in osm["features"]:
        if f["properties"]["id"] in road_refs and f["geometry"]["type"] == "LineString":
            c = f["geometry"]["coordinates"]
            e, n = wgs84_to_bng(np.array([p[0] for p in c]), np.array([p[1] for p in c]))
            roads.append(np.column_stack([e, n]) + offset)
    def on_road(oring):  # noqa: E306
        lo, hi = oring.min(axis=0) - 2, oring.max(axis=0) + 2
        return any(crossed(oring, r) for r in roads if not ((r.max(axis=0) < lo).any() or (r.min(axis=0) > hi).any()))
    over_roads = [m[0] for m in missing if on_road(m[2])]
    missing = [m for m in missing if m[0] not in set(over_roads)]
    year = release[:4]
    feats = []
    for oid, fc, ring in missing:
        lon, lat = bng_to_wgs84(ring[:, 0] - offset[0], ring[:, 1] - offset[1])  # into the OSM frame the scene uses
        feats.append({"type": "Feature", "properties": {"id": f"os/{oid}", "tags": {"building": "yes"}, "featcode": fc, "areaM2": round(area_m2(ring), 1)},
                      "geometry": {"type": "Polygon", "coordinates": [[[round(float(a), 7), round(float(b), 7)] for a, b in zip(lon, lat)]]}})
    write_json(f"data/os-buildings-{section}.geojson", {"type": "FeatureCollection", "section": section, "source": f"OS OpenMap - Local, SH tile, release files dated {release}",
                                               "url": PRODUCT, "licence": "Open Government Licence v3.0", "attribution": ATTRIBUTION.format(year=year),
                                               "release": release, "offsetM": [round(float(v), 2) for v in offset], "minAreaM2": MIN_AREA_M2,
                                               "note": "outlines generalised from OS MasterMap (terraces may be one polygon); only those overlapping no OSM footprint", "features": feats})
    write_json(f"data/building-currency-{section}.json", {"section": section, "osRelease": release, "osmRetrieved": osm.get("retrieved"), "offsetM": [round(float(v), 2) for v in offset],
                                                          "osOutlines": len(os_items), "osmFootprints": len(osm_items), "osmConfirmed": len(confirmed),
                                                          "osmInOs": confirmed, "osmNotInOs": unconfirmed, "curatedDemolished": sorted(gone), "osOnlyKept": len(feats),
                                                          "osOnlyCrossedByRoad": sorted(f"os/{i}" for i in over_roads)}, indent=2)
    print(f"{section}: OS {release}: {len(os_items)} outlines; OSM {len(osm_items)} footprints, {len(confirmed)} confirmed by OS, {len(unconfirmed)} not in OS; "
          f"{len(feats)} OS buildings of {MIN_AREA_M2:.0f} m2 or more missing from OSM ({len(over_roads)} more left out: a road runs through them); offset {offset.round(2).tolist()} m")


def self_test():
    failures = []
    sq = lambda x, y, s: np.array([[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]], dtype=float)  # noqa: E731
    # a terrace OS draws as one outline matches the two houses OSM maps; a lone OS shed of 20 m^2 is too small to keep
    os_items = [("A", "15014", sq(0, 0, 20)), ("B", "15014", sq(100, 0, 8)), ("C", "15014", sq(200, 0, 4.4))]
    osm_items = [(f"way/{i}", sq(3 * i, 3, 4) + [2.0, 1.0]) for i in range(1, 12)]  # 11 houses, all shifted (2, 1) m
    offset, confirmed, unconfirmed, missing = compare(os_items, osm_items + [("way/99", sq(500, 500, 6))])
    if confirmed != sorted(f"way/{i}" for i in range(1, 6)) or "way/99" not in unconfirmed:
        failures.append(f"matching: confirmed {confirmed}, unconfirmed {unconfirmed}")
    if [m[0] for m in missing] != ["B"]:
        failures.append(f"kept {[m[0] for m in missing]}, expected only B (C is under {MIN_AREA_M2} m2)")
    # B is in another window's OSM, or its way was cut open by this window's box: either way OSM has it, so it is not kept
    for other in (sq(101, 1, 6), sq(101, 1, 6)[:3]):
        if compare(os_items, osm_items, [other])[3]:
            failures.append(f"an OS outline OSM holds elsewhere ({len(other)} points) was kept")
    if abs(area_m2(sq(0, 0, 5)) - 25) > 1e-9:
        failures.append("area")
    # BL7: a road through an outline, or clipping one corner without a vertex inside, crosses it; one beside it does not
    for line, want in (([[95, 4], [115, 4]], True), ([[99, 6], [102, 9]], True), ([[95, -2], [115, -2]], False)):
        if crossed(sq(100, 0, 8), np.array(line, dtype=float)) != want:
            failures.append(f"crossed({line}) should be {want}")
    # a shapefile round trip: one square polygon record
    ring = sq(10, 20, 3)
    body = struct.pack("<i4d", 5, 10, 20, 13, 23) + struct.pack("<ii", 1, 5) + struct.pack("<i", 0) + ring.astype("<f8").tobytes()
    shp = b"\0" * 100 + struct.pack(">ii", 1, len(body) // 2) + body
    got = read_polygons(shp)
    if len(got) != 1 or not np.allclose(got[0][0], ring):
        failures.append("shapefile polygon read")
    for f in failures:
        print("FAIL", f)
    print("self-test:", "ok" if not failures else f"{len(failures)} failure(s)")
    return 0 if not failures else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--section")
    ap.add_argument("--zip", help="a local copy of the OS OpenMap Local SH shapefile zip (skips the download)")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        sys.exit(self_test())
    if not a.section:
        ap.error("--section <window> or --self-test")
    main(a.section, a.zip)
