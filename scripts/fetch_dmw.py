"""DataMapWales (the Welsh Government's open geoportal) for the buildings' currency (docs/adr/0063-buildings-up-to-date.md).

  python3 scripts/fetch_dmw.py              network: datamap.gov.wales (WFS)          -> data/dmw-layers.json
  python3 scripts/fetch_dmw.py --history    also lle.blob.core.windows.net (the NRW lidar archive, by byte range) and
                                            the 2020-23 lidar DTM COG                  -> data/lidar-history.json
  python3 scripts/fetch_dmw.py --self-test  no network

All four layers are OGL v3. Within 400 m of the line it keeps:
  lidarTiles    the 2020-23 lidar's tiles and the day each was flown (welsh_government_lidar_tile_catalogue_2020_2023)
  archiveTiles  older NRW lidar tiles: day flown, resolution, DSM and DTM download (NRW_LIDAR_ARCHIVE_TILE_CATALOGUE)
  listed        Cadw listed buildings: record number, grade, class, designation date, position (Cadw_ListedBuildings)
  sites         National Monuments Record of Wales sites: NPRN, type, period, evidence (building, ruin, destroyed...),
                position (rcahmw_nmrw_terrestrialsites)
No names or addresses are kept (spec BL17). --history measures, for every footprint the 2022 lidar did not see and every
structure on data/lidar-structures.json, the 90th percentile of the archive DSM minus today's DTM inside it: a building
that stood in 2007 or 2009 and is gone in 2022 was demolished between.
"""
import argparse
import datetime
import io
import json
import math
import os
import sys
import urllib.parse
import urllib.request
import zipfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_poc_data import LIDAR_URL, ROOT, point_in_ring, write_json  # noqa: E402
from dem.bng import wgs84_to_bng  # noqa: E402
from dem.cog import Cog  # noqa: E402
from find_lidar_structures import route_line  # noqa: E402
from osm.fetch_bbox import USER_AGENT  # noqa: E402

WFS = "https://datamap.gov.wales/geoserver/ows"
LAYERS = {"lidarTiles": "geonode:welsh_government_lidar_tile_catalogue_2020_2023", "archiveTiles": "inspire-nrw:NRW_LIDAR_ARCHIVE_TILE_CATALOGUE",
          "listed": "inspire-wg:Cadw_ListedBuildings", "sites": "geonode:rcahmw_nmrw_terrestrialsites_rcahmw_bng"}
ATTRIBUTION = {"lidarTiles": "Welsh Government lidar tile catalogue 2020-2023, OGL v3",
               "archiveTiles": "Contains Natural Resources Wales information © Natural Resources Wales and Database Right, OGL v3",
               "listed": "Designated Historic Asset GIS Data, The Welsh Historic Environment Service (Cadw), {date}, licensed under the Open Government Licence",
               "sites": "This site data is from the National Monuments Record of Wales (NMRW), produced by RCAHMW. © Crown Database Right: RCAHMW, licensed under the Open Government Licence 3.0"}
BUFFER_M = 400
TODAY = datetime.date.today().isoformat()


def iso(day):
    """'11-01-2022', '4 February 2007' or '16 Mar 2009' as YYYY-MM-DD."""
    day = " ".join(str(day).split())
    for fmt in ("%d-%m-%Y", "%d %B %Y", "%d %b %Y", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(day, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError(f"unrecognised date {day!r}")


def get_features(layer, box):
    q = {"service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": layer, "outputFormat": "application/json",
         "srsName": "EPSG:27700", "bbox": ",".join(str(round(v)) for v in box) + ",EPSG:27700", "count": "10000"}
    req = urllib.request.Request(WFS + "?" + urllib.parse.urlencode(q), headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read().decode("utf-8-sig"))["features"]


def box_of(geom):
    pts = np.array([p for ring in (geom["coordinates"] if geom["type"] == "Polygon" else [r for poly in geom["coordinates"] for r in poly]) for p in ring])
    return [round(float(v)) for v in (*pts.min(axis=0), *pts.max(axis=0))]


def near_line(line, e, n):
    return float(np.hypot(line[:, 0] - e, line[:, 1] - n).min()) <= BUFFER_M


def layers(line):
    box = (*(line.min(axis=0) - BUFFER_M), *(line.max(axis=0) + BUFFER_M))
    raw = {k: get_features(v, box) for k, v in LAYERS.items()}
    out = {"lidarTiles": sorted(({"tile": f["properties"]["british_gr"], "flown": iso(f["properties"]["date"]), "delivery": f["properties"]["delivery"],
                                  "box": box_of(f["geometry"])} for f in raw["lidarTiles"]), key=lambda t: t["tile"]),
           "archiveTiles": sorted(({"id": f["properties"]["LIDAR_NAME"].strip(), "tile": f["properties"]["TILENAME"].strip(), "flown": iso(f["properties"]["DATE_FLOWN"]),
                                    "resolutionM": float(f["properties"]["RESOLUTION"]), "coverPercent": float(f["properties"]["PERCENT_CO"]),
                                    "dsm": f["properties"]["DSM_URL"], "dtm": f["properties"]["DTM_URL"], "box": box_of(f["geometry"])} for f in raw["archiveTiles"]),
                                  key=lambda t: (t["flown"], t["tile"])),
           "listed": sorted(({"record": int(p["RecordNumber"]), "grade": p["Grade"], "class": p["BroadClass"], "designated": str(p["DesignationDate"])[:10],
                              "e": float(p["Easting"]), "n": float(p["Northing"]), "url": p["Report"].replace("http://", "https://", 1)}
                             for p in (f["properties"] for f in raw["listed"]) if near_line(line, float(p["Easting"]), float(p["Northing"]))), key=lambda x: x["record"]),
           "sites": sorted(({"nprn": int(p["nprn"]), "type": p["site_type"], "period": p["period"], "evidence": p["evidence"], "e": float(p["osgb36east"]),
                             "n": float(p["osgb36notr"]), "url": p["url"]}
                            for p in (f["properties"] for f in raw["sites"]) if near_line(line, float(p["osgb36east"]), float(p["osgb36notr"]))), key=lambda x: x["nprn"])}
    out.update({"retrievedAt": TODAY, "source": WFS, "layers": LAYERS, "licence": "OGL v3 (all four layers)",
                "attribution": {k: v.format(date=TODAY) for k, v in ATTRIBUTION.items()}, "bufferM": BUFFER_M})
    return out


class RangeFile(io.RawIOBase):
    """A remote file read by HTTP byte ranges, so zipfile can take one member of a large archive without the rest."""

    def __init__(self, url):
        self.url, self.pos = url, 0
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT}), timeout=60) as r:
            self.size = int(r.headers["Content-Length"])

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def readinto(self, b):
        if self.pos >= self.size or len(b) == 0:
            return 0
        end = min(self.size, self.pos + len(b)) - 1
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{end}", "User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=300) as r:
            data = r.read()
        b[:len(data)] = data
        self.pos += len(data)
        return len(data)


def read_asc(text):
    """An ESRI ASCII grid: (values in metres with NaN for nodata, west edge, north edge, cell size). The archive stores mm."""
    head, rest = {}, text
    for _ in range(6):
        line, rest = rest.split("\n", 1)
        k, v = line.split()
        head[k.lower()] = float(v)
    vals = np.array(rest.split(), dtype=np.float64).reshape(int(head["nrows"]), int(head["ncols"]))
    vals[vals == head.get("nodata_value", -9999)] = np.nan
    cell = head["cellsize"]
    west = head.get("xllcorner", head.get("xllcenter", 0) - cell / 2)
    south = head.get("yllcorner", head.get("yllcenter", 0) - cell / 2)
    return vals / 1000.0, west, south + head["nrows"] * cell, cell


def archive_grid(tile, cache):
    """The archive DSM tile (metres) from its zip, fetched once per tile."""
    if tile["id"] not in cache:
        z = zipfile.ZipFile(io.BufferedReader(RangeFile(tile["dsm"]), buffer_size=1 << 20))
        name = next(n for n in z.namelist() if tile["id"] in n and n.endswith(".asc"))
        cache[tile["id"]] = read_asc(z.read(name).decode("ascii"))
    return cache[tile["id"]]


def p90_above(grid, dtm_cog, ring):
    """The 90th percentile of an archive DSM minus today's DTM inside a BNG ring, or None (outside or no data)."""
    vals, west, north, cell = grid
    e0, n0 = ring.min(axis=0)
    e1, n1 = ring.max(axis=0)
    c0, c1 = int((e0 - west) // cell), int(math.ceil((e1 - west) / cell))
    r0, r1 = int((north - n1) // cell), int(math.ceil((north - n0) / cell))
    if c0 < 0 or r0 < 0 or c1 > vals.shape[1] or r1 > vals.shape[0] or c1 <= c0 or r1 <= r0:
        return None
    ge, gn = np.meshgrid(west + (np.arange(c0, c1) + 0.5) * cell, north - (np.arange(r0, r1) + 0.5) * cell)
    inside = point_in_ring(ge.ravel(), gn.ravel(), [tuple(p) for p in ring]).reshape(ge.shape)
    px, py = dtm_cog.pixel_size(0)
    dc0, dr0 = math.floor((e0 - dtm_cog.origin_e) / px), math.floor((dtm_cog.origin_n - n1) / py)
    dtm = dtm_cog.read_window(0, dc0, dr0, math.ceil((e1 - e0) / px) + 2, math.ceil((n1 - n0) / py) + 2).astype(np.float64)
    ci = np.clip(((ge - dtm_cog.origin_e) / px).astype(int) - dc0, 0, dtm.shape[1] - 1)
    ri = np.clip(((dtm_cog.origin_n - gn) / py).astype(int) - dr0, 0, dtm.shape[0] - 1)
    d = (vals[r0:r1, c0:c1] - dtm[ri, ci])[inside & np.isfinite(vals[r0:r1, c0:c1]) & (dtm[ri, ci] != dtm_cog.nodata)]
    return round(float(np.percentile(d, 90)), 1) if d.size >= 4 else None


def history_targets():
    """{ref: BNG ring} for every footprint the 2022 lidar did not see, in any window, and the lidar finder's structures."""
    out = {}
    sections = os.path.join(ROOT, "public/data/sections")
    for w in sorted(os.listdir(sections)):
        path = os.path.join(sections, w, "buildings.json")
        for b in (json.load(open(path)) if os.path.exists(path) else []):
            if b.get("lidar") == "absent":
                e, n = wgs84_to_bng(np.array([p[0] for p in b["footprint"]]), np.array([p[1] for p in b["footprint"]]))
                out[b.get("osm") or b["os"]] = np.column_stack([e, n])
        removed = os.path.join(ROOT, f"data/buildings-removed-{w}.json")  # recorded as demolished, so no longer in buildings.json
        for r in (json.load(open(removed)) if os.path.exists(removed) else []):
            e, n = wgs84_to_bng(np.array([p[0] for p in r["footprint"]]), np.array([p[1] for p in r["footprint"]]))
            out[r["source"]["ref"]] = np.column_stack([e, n])
    found = os.path.join(ROOT, "data/lidar-structures.json")
    for s in (json.load(open(found))["structures"] if os.path.exists(found) else []):
        h = max(s["lengthM"], s["widthM"]) / 2
        out[f"lidar/{s['e']},{s['n']}"] = np.array([[s["e"] - h, s["n"] - h], [s["e"] + h, s["n"] - h], [s["e"] + h, s["n"] + h], [s["e"] - h, s["n"] + h], [s["e"] - h, s["n"] - h]])
    return out


def history(dmw):
    dtm_cog, cache, out = Cog(LIDAR_URL), {}, {}
    for ref, ring in sorted(history_targets().items()):
        c = ring[:-1].mean(axis=0)
        seen = []
        for t in dmw["archiveTiles"]:
            e0, n0, e1, n1 = t["box"]
            if e0 <= c[0] <= e1 and n0 <= c[1] <= n1:
                h = p90_above(archive_grid(t, cache), dtm_cog, ring)
                if h is not None:
                    seen.append({"flown": t["flown"], "heightM": h, "tile": t["tile"]})
        out[ref] = sorted(seen, key=lambda s: s["flown"])
    with open(os.path.join(ROOT, "data/lidar-history.json"), "w") as fh:
        json.dump({"retrievedAt": TODAY, "note": "90th percentile of the NRW archive DSM minus the 2020-23 DTM inside each footprint (m)", "footprints": out}, fh, indent=1)
        fh.write("\n")
    stood = [k for k, v in out.items() if any(s["heightM"] >= 2.0 for s in v)]
    print(f"history: {len(out)} footprints and structures; {len(stood)} stood in an archive flight: {', '.join(stood) or 'none'}")


def main(with_history):
    line, _km = route_line()
    dmw = layers(line)
    write_json("data/dmw-layers.json", dmw, indent=1)
    flown = sorted({t["flown"] for t in dmw["lidarTiles"]})
    print(f"DataMapWales: {len(dmw['lidarTiles'])} lidar tiles flown {', '.join(flown)}; {len(dmw['archiveTiles'])} archive tiles "
          f"({', '.join(sorted({t['flown'] for t in dmw['archiveTiles']}))}); {len(dmw['listed'])} listed buildings and {len(dmw['sites'])} NMRW sites within {BUFFER_M} m")
    if with_history:
        history(dmw)


def self_test():
    failures = []
    for raw, want in (("11-01-2022", "2022-01-11"), ("4 February 2007", "2007-02-04"), ("16 Mar 2009", "2009-03-16"), (" 4 February  2007 ", "2007-02-04")):
        if iso(raw) != want:
            failures.append(f"iso({raw!r}) = {iso(raw)}")
    vals, west, north, cell = read_asc("ncols 3\nnrows 2\nxllcorner 100\nyllcorner 200\ncellsize 1\nNODATA_value -9999\n1000 2000 -9999\n4000 5000 6000\n")
    if not (np.isnan(vals[0, 2]) and vals[1, 0] == 4.0 and west == 100 and north == 202 and cell == 1):
        failures.append(f"read_asc: {vals.tolist()} {west} {north} {cell}")
    if box_of({"type": "Polygon", "coordinates": [[[0, 0], [2000, 0], [2000, 2000], [0, 2000], [0, 0]]]}) != [0, 0, 2000, 2000]:
        failures.append("box_of")
    for f in failures:
        print("FAIL", f)
    print("self-test:", "ok" if not failures else f"{len(failures)} failure(s)")
    return 0 if not failures else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--history", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    sys.exit(self_test() if a.self_test else main(a.history))
