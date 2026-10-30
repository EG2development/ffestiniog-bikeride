# The reel in the photo look (docs/adr/0060-reel-in-the-photo-look.md): the aerial scenes' ground colour from a satellite photograph.
"""Sample one Sentinel-2 true-colour scene onto a section window's DEM nodes, as the ground colour of the photo look.

  python3 scripts/build_imagery.py --section corridor   network: the Earth Search STAC API and the scene's TCI COG
                                                         (earth-search.aws.element84.com, sentinel-cogs.s3.us-west-2.amazonaws.com)
  python3 scripts/build_imagery.py --self-test          no network

The scene is pinned (SCENE), so a rebuild reads the same pixels: a cloud-free summer pass over the whole route. The
output is a raster on the DEM's own grid at SCALE pixels per node spacing (8 m for the corridor's 16 m nodes, finer
than the scene's 10 m), its pixel (0, 0) on node (0, 0), so the terrain maps it by node index. Each pixel (BNG) goes to
WGS84 (OS Helmert, as the rest of the pipeline) and on to UTM zone 30N, the scene's grid, where the TCI is sampled
bilinearly. Writes public/data/sections/<id>/imagery.u8 (height x width x RGB, north row first) and imagery.json. Licence: the Sentinel Data Legal Notice (free, full and open use, with the notice below).
Python stdlib + numpy only, like dem/cog.py, whose float lidar tiles this reader's 8-bit RGB tiles differ from.
"""
import argparse
import datetime
import json
import math
import os
import struct
import sys
import urllib.request
import zlib

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_poc_data import ROOT, write_json  # noqa: E402
from dem.bng import bng_to_wgs84  # noqa: E402
from dem.cog import USER_AGENT  # noqa: E402

SCENE = "S2C_30UVD_20250712_0_L2A"  # 12 July 2025, 0.06 % cloud (docs/research-photoreal.md §2)
STAC = "https://earth-search.aws.element84.com/v1/search"
NOTICE = "Contains modified Copernicus Sentinel data 2025"
SCALE = 2  # image pixels per DEM node spacing
TODAY = datetime.date.today().isoformat()
WGS84 = (6378137.0, 6356752.314245)
UTM30 = dict(f0=0.9996, phi0=0.0, lambda0=math.radians(-3.0), e0=500000.0, n0=0.0)


def utm30(lat_deg, lon_deg):
    """WGS84 latitude/longitude to UTM zone 30N metres: the Transverse Mercator series of the OS guide (C.1), as
    dem/bng.py uses for the National Grid, with the WGS84 ellipsoid and the UTM constants."""
    a, b = WGS84
    f0, phi0, lam0, e0, n0 = UTM30["f0"], UTM30["phi0"], UTM30["lambda0"], UTM30["e0"], UTM30["n0"]
    e2 = (a * a - b * b) / (a * a)
    n = (a - b) / (a + b)
    phi = np.radians(np.asarray(lat_deg, dtype=float))
    dl = np.radians(np.asarray(lon_deg, dtype=float)) - lam0
    s, c, t2 = np.sin(phi), np.cos(phi), np.tan(phi) ** 2
    nu = a * f0 / np.sqrt(1 - e2 * s * s)
    rho = a * f0 * (1 - e2) / (1 - e2 * s * s) ** 1.5
    eta2 = nu / rho - 1
    dp, sp = phi - phi0, phi + phi0
    m = b * f0 * ((1 + n + 1.25 * n * n + 1.25 * n ** 3) * dp - (3 * n + 3 * n * n + 21 / 8 * n ** 3) * np.sin(dp) * np.cos(sp)
                  + (15 / 8 * n * n + 15 / 8 * n ** 3) * np.sin(2 * dp) * np.cos(2 * sp) - 35 / 24 * n ** 3 * np.sin(3 * dp) * np.cos(3 * sp))
    north = (m + n0 + nu / 2 * s * c * dl ** 2 + nu / 24 * s * c ** 3 * (5 - t2 + 9 * eta2) * dl ** 4
             + nu / 720 * s * c ** 5 * (61 - 58 * t2 + t2 * t2) * dl ** 6)
    east = e0 + nu * c * dl + nu / 6 * c ** 3 * (nu / rho - t2) * dl ** 3 + nu / 120 * c ** 5 * (5 - 18 * t2 + t2 * t2 + 14 * eta2 - 58 * t2 * eta2) * dl ** 5
    return east, north


def fetch(url, start, length):
    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{start + length - 1}", "User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    if len(data) != length:
        raise IOError(f"range read of {length} bytes at {start} returned {len(data)}")
    return data


def unpredict(raw, th, tw, spp):
    """A Deflate tile with the horizontal predictor (TIFF tag 317 = 2): each sample is stored as the difference from the
    one to its left in the same channel, modulo 256."""
    d = np.frombuffer(raw, dtype=np.uint8).reshape(th, tw, spp).astype(np.uint32)
    return (np.cumsum(d, axis=1) % 256).astype(np.uint8)


class RgbTiff:
    """The full-resolution image of a classic little-endian GeoTIFF: 8-bit RGB, chunky, tiled, Deflate, predictor 2.
    Anything else fails loudly."""

    def __init__(self, url):
        self.url = url
        head = fetch(url, 0, 65536)
        if head[:4] != b"II*\0":
            raise ValueError("not a little-endian classic TIFF")
        off = struct.unpack("<I", head[4:8])[0]
        count = struct.unpack("<H", head[off:off + 2])[0]
        tags = {}
        for i in range(count):
            e = head[off + 2 + i * 12: off + 14 + i * 12]
            tag, typ, n = struct.unpack("<HHI", e[:8])
            size = {1: 1, 2: 1, 3: 2, 4: 4, 12: 8}.get(typ, 0) * n
            fmt = {1: "B", 3: "H", 4: "I", 12: "d"}.get(typ)
            if size <= 4:
                raw = e[8:8 + size]
            else:
                where = struct.unpack("<I", e[8:12])[0]
                raw = head[where:where + size] if where + size <= len(head) else fetch(url, where, size)
            tags[tag] = raw.rstrip(b"\0").decode() if typ == 2 else struct.unpack("<" + fmt * n, raw) if fmt else None
        one = lambda t: tags[t][0]  # noqa: E731
        if (one(259), one(317), one(277), one(284), tags[258]) != (8, 2, 3, 1, (8, 8, 8)):
            raise ValueError(f"unsupported TIFF layout: compression {one(259)}, predictor {one(317)}, samples {one(277)}, planar {one(284)}, bits {tags[258]}")
        self.width, self.height, self.tw, self.th = one(256), one(257), one(322), one(323)
        self.offsets, self.counts = tags[324], tags[325]
        sx, sy = tags[33550][:2]
        _, _, _, x0, y0, _ = tags[33922]
        self.pixel, self.x0, self.y0 = (sx, sy), x0, y0
        self.tiles = {}

    def tile(self, tr, tc):
        k = (tr, tc)
        if k not in self.tiles:
            i = tr * math.ceil(self.width / self.tw) + tc
            self.tiles[k] = unpredict(zlib.decompress(fetch(self.url, self.offsets[i], self.counts[i])), self.th, self.tw, 3)
        return self.tiles[k]

    def window(self, c0, r0, c1, r1):
        """Pixels [r0, r1) x [c0, c1) as a (rows, cols, 3) uint8 array."""
        out = np.zeros((r1 - r0, c1 - c0, 3), dtype=np.uint8)
        for tr in range(r0 // self.th, (r1 - 1) // self.th + 1):
            for tc in range(c0 // self.tw, (c1 - 1) // self.tw + 1):
                t = self.tile(tr, tc)
                ra, rb = max(r0, tr * self.th), min(r1, (tr + 1) * self.th)
                ca, cb = max(c0, tc * self.tw), min(c1, (tc + 1) * self.tw)
                out[ra - r0:rb - r0, ca - c0:cb - c0] = t[ra - tr * self.th:rb - tr * self.th, ca - tc * self.tw:cb - tc * self.tw]
        return out


def bilinear(img, fx, fy):
    """Sample an (h, w, 3) image at fractional pixel-centre coordinates."""
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    u, v = (fx - ix)[..., None], (fy - iy)[..., None]
    g = img.astype(np.float64)
    return g[iy, ix] * (1 - u) * (1 - v) + g[iy, ix + 1] * u * (1 - v) + g[iy + 1, ix] * (1 - u) * v + g[iy + 1, ix + 1] * u * v


def scene_item():
    body = json.dumps({"collections": ["sentinel-2-l2a"], "ids": [SCENE]}).encode()
    req = urllib.request.Request(STAC, data=body, headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        feats = json.load(r)["features"]
    if len(feats) != 1:
        raise SystemExit(f"the STAC API returned {len(feats)} items for {SCENE}")
    return feats[0]


def main(section):
    rel = f"public/data/sections/{section}"
    header = json.load(open(os.path.join(ROOT, rel, "dem.json")))
    item = scene_item()
    props = item["properties"]
    if (props.get("proj:epsg") or props.get("proj:code")) not in (32630, "EPSG:32630"):
        raise SystemExit(f"{SCENE} is not on UTM zone 30N")
    url = item["assets"]["visual"]["href"]
    tif = RgbTiff(url)
    cols, rows, sp = header["cols"], header["rows"], header["spacingM"]
    width, height = (cols - 1) * SCALE + 1, (rows - 1) * SCALE + 1
    cc, rr = np.meshgrid(np.arange(width), np.arange(height))
    lon, lat = bng_to_wgs84(header["originE"] + cc * sp / SCALE, header["originN"] - rr * sp / SCALE)
    ue, un = utm30(lat, lon)
    # pixel-centre coordinates: the tiepoint is the outer corner of pixel (0, 0)
    fx = (ue - tif.x0) / tif.pixel[0] - 0.5
    fy = (tif.y0 - un) / tif.pixel[1] - 0.5
    c0, c1 = int(np.floor(fx.min())), int(np.floor(fx.max())) + 2
    r0, r1 = int(np.floor(fy.min())), int(np.floor(fy.max())) + 2
    if c0 < 0 or r0 < 0 or c1 > tif.width or r1 > tif.height:
        raise SystemExit(f"the {section} window runs off the scene: pixels {c0}-{c1} x {r0}-{r1} of {tif.width} x {tif.height}")
    img = tif.window(c0, r0, c1, r1)
    rgb = np.clip(np.rint(bilinear(img, fx - c0, fy - r0)), 0, 255).astype(np.uint8)
    nodata = int((rgb.sum(axis=2) == 0).sum())
    if nodata > 0.001 * width * height:
        raise SystemExit(f"{nodata} nodes fall on the scene's no-data border")
    with open(os.path.join(ROOT, rel, "imagery.u8"), "wb") as f:
        f.write(rgb.tobytes())
    mean = [round(float(x), 1) for x in rgb.reshape(-1, 3).mean(axis=0)]
    write_json(f"{rel}/imagery.json", {
        "cols": cols, "rows": rows, "spacingM": sp, "originE": header["originE"], "originN": header["originN"], "crs": "EPSG:27700",
        "scale": SCALE, "width": width, "height": height, "file": "imagery.u8",
        "bands": "R, G, B: Sentinel-2 L2A true-colour image (TCI), 8-bit values linear in reflectance, bilinear on the DEM grid at `scale` pixels per node spacing",
        "scene": SCENE, "acquired": props["datetime"], "cloudCover": props.get("eo:cloud_cover"), "resolutionM": tif.pixel[0],
        "urls": [f"{STAC} (id {SCENE})", url], "licence": "Sentinel Data Legal Notice: free, full and open use, including adaptation and distribution",
        "notice": NOTICE, "retrieved": TODAY, "stats": {"meanRgb": mean, "tilesRead": len(tif.tiles)},
    }, indent=2)
    print(f"{section}: imagery {width}x{height} @ {sp / SCALE} m from {SCENE} ({props['datetime'][:10]}, {props.get('eo:cloud_cover')} % cloud); {len(tif.tiles)} tiles; mean RGB {mean}")


def self_test():
    failures = []
    # the central meridian maps to the false easting, and the northing there is the scaled meridian arc
    a, b = WGS84
    e2 = (a * a - b * b) / (a * a)
    phis = np.linspace(0, math.radians(52.9), 20001)
    arc = float(np.trapezoid(a * (1 - e2) / (1 - e2 * np.sin(phis) ** 2) ** 1.5, phis))
    e, n = utm30(52.9, -3.0)
    if abs(float(e) - 500000) > 1e-6 or abs(float(n) - 0.9996 * arc) > 0.01:
        failures.append(f"central meridian: {float(e):.3f}, {float(n):.3f} vs 500000, {0.9996 * arc:.3f}")
    # symmetric about the central meridian, and a degree off it at 52.9° N is about 67 km at the scale factor
    ew, _ = utm30(52.9, -4.0)
    ee, _ = utm30(52.9, -2.0)
    if abs((500000 - float(ew)) - (float(ee) - 500000)) > 1e-6 or not 67000 < 500000 - float(ew) < 67400:
        failures.append(f"off the meridian: {float(ew):.1f}, {float(ee):.1f}")
    # predictor 2: a row of differences sums back to the samples, modulo 256, per channel
    samples = np.array([[[10, 200, 5], [12, 190, 250], [9, 210, 3]]], dtype=np.uint8)
    diffs = samples.astype(np.int16).copy()
    diffs[:, 1:] = (samples[:, 1:].astype(np.int16) - samples[:, :-1].astype(np.int16)) % 256
    if not np.array_equal(unpredict(diffs.astype(np.uint8).tobytes(), 1, 3, 3), samples):
        failures.append("predictor decode")
    # bilinear at a pixel centre returns the pixel, and halfway between two the mean
    img = np.arange(4 * 4 * 3, dtype=np.uint8).reshape(4, 4, 3)
    got = bilinear(img, np.array([1.0, 1.5]), np.array([2.0, 2.0]))
    if not np.allclose(got[0], img[2, 1]) or not np.allclose(got[1], (img[2, 1].astype(float) + img[2, 2]) / 2):
        failures.append(f"bilinear {got}")
    for f in failures:
        print("FAIL", f)
    print("self-test:", "ok" if not failures else f"{len(failures)} failure(s)")
    return 0 if not failures else 1


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
