"""Read a window of a remote Cloud-Optimised GeoTIFF by HTTP range requests.

Supports exactly what the Welsh lidar DTM uses (docs/adr/0007-range-read-dtm.md):
BigTIFF, 256x256 tiles, Deflate, no predictor, float32. Anything else fails loudly.
Python stdlib + numpy only (no GDAL).
"""
import struct
import urllib.request
import zlib

import numpy as np

TAGS = {256: "width", 257: "height", 259: "compression", 317: "predictor", 322: "tile_w", 323: "tile_h",
        324: "tile_offsets", 325: "tile_counts", 339: "sample_format", 258: "bits",
        33550: "pixel_scale", 33922: "tiepoint", 42113: "nodata"}
TYPE_SIZE = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8, 17: 8, 18: 8}
TYPE_FMT = {1: "B", 3: "H", 4: "I", 11: "f", 12: "d", 16: "Q", 17: "q", 18: "Q"}
USER_AGENT = "ffestiniog-bikeride-concept-video/1.0 (+https://github.com/EG2development/ffestiniog-bikeride)"


def fetch(url, start, length):
    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{start + length - 1}", "User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    if len(data) != length:
        raise IOError(f"range read of {length} bytes at {start} returned {len(data)}")
    return data


class Cog:
    def __init__(self, url, header_bytes=65536):
        self.url = url
        head = fetch(url, 0, header_bytes)
        if head[:2] != b"II" or struct.unpack("<H", head[2:4])[0] != 43:
            raise ValueError("not a little-endian BigTIFF")
        self.levels = []
        off = struct.unpack("<Q", head[8:16])[0]
        while off:
            if off + 8 > len(head):
                raise ValueError("IFDs extend past the header read; increase header_bytes")
            count = struct.unpack("<Q", head[off:off + 8])[0]
            ifd = {}
            for i in range(count):
                e = head[off + 8 + i * 20: off + 8 + (i + 1) * 20]
                tag, typ, n = struct.unpack("<HHQ", e[:12])
                if tag not in TAGS:
                    continue
                size = TYPE_SIZE[typ] * n
                if tag in (324, 325):  # large arrays: keep their location, read entries on demand
                    ifd[TAGS[tag]] = (typ, n, struct.unpack("<Q", e[12:20])[0] if size > 8 else None, e[12:20])
                    continue
                raw = e[12:12 + size] if size <= 8 else head[struct.unpack("<Q", e[12:20])[0]:][:size]
                if typ == 2:
                    ifd[TAGS[tag]] = raw.rstrip(b"\0").decode()
                else:
                    vals = struct.unpack("<" + TYPE_FMT[typ] * n, raw)
                    ifd[TAGS[tag]] = vals[0] if n == 1 else vals
            off = struct.unpack("<Q", head[off + 8 + count * 20: off + 16 + count * 20])[0]
            self.levels.append(ifd)
        base = self.levels[0]
        for lvl in self.levels:
            if lvl.get("compression") != 8 or lvl.get("predictor", 1) != 1 or lvl.get("sample_format") != 3 or lvl.get("bits") != 32:
                raise ValueError(f"unsupported COG layout: {lvl}")
        self.origin_e, self.origin_n = base["tiepoint"][3], base["tiepoint"][4]
        self.pixel = base["pixel_scale"][0]
        self.nodata = float(base.get("nodata", "nan"))

    def _tile_entry(self, level, key, index):
        typ, n, off, inline = self.levels[level][key]
        if index >= n:
            raise IndexError(index)
        size = TYPE_SIZE[typ]
        raw = fetch(self.url, off + index * size, size)
        return struct.unpack("<" + TYPE_FMT[typ], raw)[0]

    def pixel_size(self, level):
        """(x, y) pixel size in metres; overviews cover the full extent, so they are not exact powers of 2."""
        base = self.levels[0]
        lvl = self.levels[level]
        return self.pixel * base["width"] / lvl["width"], self.pixel * base["height"] / lvl["height"]

    def read_window(self, level, col0, row0, cols, rows):
        """Pixels [row0, row0+rows) x [col0, col0+cols) of a level as float32 (nodata kept as-is)."""
        lvl = self.levels[level]
        tw, th = lvl["tile_w"], lvl["tile_h"]
        across = -(-lvl["width"] // tw)
        out = np.full((rows, cols), self.nodata, dtype=np.float32)
        for tr in range(row0 // th, (row0 + rows - 1) // th + 1):
            for tc in range(col0 // tw, (col0 + cols - 1) // tw + 1):
                i = tr * across + tc
                off = self._tile_entry(level, "tile_offsets", i)
                cnt = self._tile_entry(level, "tile_counts", i)
                if cnt == 0:
                    continue  # sparse tile: all nodata
                tile = np.frombuffer(zlib.decompress(fetch(self.url, off, cnt)), dtype="<f4").reshape(th, tw)
                r0, c0 = tr * th, tc * tw
                rs, re_ = max(row0, r0), min(row0 + rows, r0 + th)
                cs, ce = max(col0, c0), min(col0 + cols, c0 + tw)
                out[rs - row0:re_ - row0, cs - col0:ce - col0] = tile[rs - r0:re_ - r0, cs - c0:ce - c0]
        return out
