"""Catalogue openly licensed, geolocated photographs along the route (data/source-register.md "Visual references").

  python scripts/fetch_photo_refs.py              network: commons.wikimedia.org (geosearch + imageinfo, no images downloaded)
  python scripts/fetch_photo_refs.py --self-test  no network

Writes data/photo-references.json: one record per Wikimedia Commons file whose camera stands within CORRIDOR_M of the
trackbed (Geograph Britain and Ireland's photos reach Commons with their camera and subject positions and taken dates).
Each record carries location, capture date and its confidence, source page, photographer, licence, heading (camera to
subject), lens, subject, route section and use: "reconstruction" for photos taken in 2012 or later, "history" for older
ones and "undated" when Commons holds no capture date. Only links are kept; nothing is downloaded or redistributed.
A per-section matrix summarises coverage, gaps and the best candidates for matched Blender cameras.
"""
import argparse
import datetime
import html
import json
import math
import os
import re
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "ffestiniog-bikeride-concept-video/1.0 (+https://github.com/EG2development/ffestiniog-bikeride)"
TODAY = datetime.date.today().isoformat()
OUT = "data/photo-references.json"

CORRIDOR_M = 600  # the ground windows' margin either side of the line (build_section_data.MARGIN_M)
SEARCH_STEP_M = 400
SEARCH_RADIUS_M = 700
FROM_YEAR = 2012
# the ground windows by route distance (build_section_data.SECTIONS), Blaenau end first
SECTIONS = [("blaenau", 0, 1500), ("vale-north", 1500, 4800), ("vale-south", 4800, 7700),
            ("maentwrog", 7700, 9700), ("trawsfynydd", 9700, 13240)]
FREE_LICENCES = ("cc0", "cc by", "cc-by", "public domain", "pd")
# first match wins; keywords are checked against the title and Commons categories
SUBJECTS = [
    ("bridge", r"bridge|viaduct|pont\b|overbridge|underbridge|culvert"),
    ("station", r"station|halt|platform|gorsaf"),
    ("railway", r"railway|trackbed|track bed|rail line|branch line|level crossing|sleepers|cutting|embankment|tunnel"),
    ("power station", r"power station|nuclear|magnox"),
    ("quarry", r"quarr|slate|tip\b|tips\b|incline|mine\b|chwarel"),
    ("water", r"llyn|lake|reservoir|river|afon|stream|waterfall|rhaeadr|dam\b"),
    ("road", r"\broad\b|a470|a496|b4391|lane|junction|roundabout|street|stryd|ffordd"),
    ("building", r"chapel|church|capel|eglwys|house|cottage|terrace|farm|barn|school|hall|inn|hotel|shop|pub|building|bwthyn|fferm"),
]


def get_json(params):
    q = urllib.parse.urlencode({**params, "format": "json", "maxlag": 5})
    req = urllib.request.Request(API + "?" + q, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read())
            if data.get("error", {}).get("code") == "maxlag":
                time.sleep(5 * (attempt + 1))
                continue
            return data
        except OSError:
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("Commons API unavailable: " + q[:120])


def haversine(lon1, lat1, lon2, lat2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(a))


def bearing(lon1, lat1, lon2, lat2):
    """Initial bearing from point 1 to point 2, degrees clockwise from north."""
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def compass(deg):
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][int((deg + 22.5) // 45) % 8]


def load_route():
    with open(os.path.join(ROOT, "data/railway-route.geojson")) as f:
        coords = json.load(f)["features"][0]["geometry"]["coordinates"]
    dist = [0.0]
    for a, b in zip(coords, coords[1:]):
        dist.append(dist[-1] + haversine(a[0], a[1], b[0], b[1]))
    return [c[0] for c in coords], [c[1] for c in coords], dist


def along(route, d):
    lons, lats, dist = route
    for i in range(len(dist) - 1):
        if dist[i + 1] >= d:
            t = (d - dist[i]) / ((dist[i + 1] - dist[i]) or 1)
            return lons[i] + t * (lons[i + 1] - lons[i]), lats[i] + t * (lats[i + 1] - lats[i])
    return lons[-1], lats[-1]


def snap(route, lon, lat):
    """(route distance, offset m, track bearing there) of the nearest point on the centreline."""
    lons, lats, dist = route
    k = 111320 * math.cos(math.radians(lat))
    best = (float("inf"), 0.0, 0.0)
    for i in range(len(lons) - 1):
        ax, ay = (lons[i] - lon) * k, (lats[i] - lat) * 111320
        bx, by = (lons[i + 1] - lon) * k, (lats[i + 1] - lat) * 111320
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy or 1)))
        off = math.hypot(ax + t * dx, ay + t * dy)
        if off < best[0]:
            best = (off, dist[i] + t * (dist[i + 1] - dist[i]), (math.degrees(math.atan2(dx, dy)) + 360) % 360)
    return best[1], best[0], best[2]


def strip_html(s):
    s = re.sub(r"<span[^>]*noprint.*?</span>", "", s or "", flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def capture_date(meta):
    """(ISO date or partial date, confidence). Commons' DateTimeOriginal is the taken date (EXIF or the uploader's)."""
    raw = strip_html(meta.get("DateTimeOriginal", {}).get("value", ""))
    m = re.search(r"((?:19|20)\d\d)(?:[-:/](\d\d)(?:[-:/](\d\d))?)?", raw)
    if not m:
        return None, "uncertain"
    y, mo, d = m.groups()
    if re.search(r"circa|\bca\.?|about|approx|before|after|\?", raw, re.I):
        return "-".join(p for p in (y, mo, d) if p), "approximate"
    if d:
        return f"{y}-{mo}-{d}", "verified"
    return "-".join(p for p in (y, mo) if p), "approximate"


def subject_of(title, cats):
    text = (title + " " + cats).lower()
    for name, pattern in SUBJECTS:
        if re.search(pattern, text):
            return name
    return "landscape"


def lens(metadata):
    """35 mm-equivalent focal length and horizontal field of view, when the EXIF holds one."""
    exif = {m["name"]: m["value"] for m in metadata or [] if isinstance(m, dict) and "name" in m}
    f35 = exif.get("FocalLengthIn35mmFilm")
    try:
        f35 = float(f35) if f35 else None
    except (TypeError, ValueError):
        f35 = None
    if not f35:
        return None
    return {"focal_35mm": round(f35), "hfov_deg": round(math.degrees(2 * math.atan(18 / f35)), 1)}


def section_of(d):
    for name, a, b in SECTIONS:
        if a <= d < b:
            return name
    return SECTIONS[-1][0]


def record(page, route):
    info = (page.get("imageinfo") or [{}])[0]
    meta = info.get("extmetadata", {})
    licence = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
    if not licence.lower().startswith(FREE_LICENCES):
        return None
    coords = page.get("coordinates") or []
    cam = next((c for c in coords if c.get("type") == "camera"), None) or next((c for c in coords if "primary" in c), None)
    if not cam:
        return None
    d, off, track = snap(route, cam["lon"], cam["lat"])
    if off > CORRIDOR_M:
        return None
    obj = next((c for c in coords if c.get("type") == "object" and c is not cam), None)
    heading = None
    if obj and haversine(cam["lon"], cam["lat"], obj["lon"], obj["lat"]) > 5:
        heading = round(bearing(cam["lon"], cam["lat"], obj["lon"], obj["lat"]))
    date, confidence = capture_date(meta)
    year = int(date[:4]) if date else None
    use = "undated" if year is None else ("reconstruction" if year >= FROM_YEAR else "history")
    title = page["title"].removeprefix("File:")
    cats = meta.get("Categories", {}).get("value", "")
    # looking along the trackbed: standing on it and facing within 35 degrees of its line, either way
    along_line = heading is not None and off <= 40 and min(abs((heading - track + 180) % 360 - 180),
                                                             abs((heading - track) % 360 - 180)) <= 35
    return {
        "id": f"commons:{page['pageid']}",
        "title": re.sub(r"\.(jpe?g|png|tiff?)$", "", title, flags=re.I),
        "location": {"lon": round(cam["lon"], 6), "lat": round(cam["lat"], 6),
                     "position": "camera" if cam.get("type") == "camera" else "unspecified",
                     "route_m": round(d), "offset_m": round(off)},
        "date": date, "date_confidence": confidence, "use": use,
        "source": info.get("descriptionurl"), "thumbnail": info.get("thumburl"),
        "photographer": strip_html(meta.get("Artist", {}).get("value", "")) or None,
        "credit": strip_html(meta.get("Credit", {}).get("value", "")) or None,
        "licence": licence, "licence_url": meta.get("LicenseUrl", {}).get("value"),
        "heading_deg": heading, "direction": compass(heading) if heading is not None else None,
        "lens": lens(info.get("metadata")),
        "subject": subject_of(title, cats), "categories": [c for c in cats.split("|") if c][:8],
        "section": section_of(d), "along_trackbed": along_line,
        "confidence": "verified" if heading is not None and cam.get("type") == "camera" and confidence == "verified"
        else ("approximate" if confidence != "uncertain" else "uncertain"),
    }


def search(route):
    """Commons file page ids whose coordinates fall near the line, searched every SEARCH_STEP_M."""
    ids = set()
    total = route[2][-1]
    d = 0.0
    while d <= total + SEARCH_STEP_M / 2:
        lon, lat = along(route, min(d, total))
        res = get_json({"action": "query", "list": "geosearch", "gscoord": f"{lat:.6f}|{lon:.6f}",
                        "gsradius": SEARCH_RADIUS_M, "gsnamespace": 6, "gslimit": 500})
        ids.update(g["pageid"] for g in res.get("query", {}).get("geosearch", []))
        d += SEARCH_STEP_M
        time.sleep(0.2)
    return sorted(ids)


def details(ids):
    pages = []
    for i in range(0, len(ids), 50):
        res = get_json({"action": "query", "pageids": "|".join(map(str, ids[i:i + 50])),
                        "prop": "imageinfo|coordinates", "iiprop": "extmetadata|url|metadata", "iiurlwidth": 640,
                        "iimetadataversion": "latest", "coprop": "type|dim", "coprimary": "all", "colimit": "max"})
        pages.extend(res.get("query", {}).get("pages", {}).values())
        time.sleep(0.2)
    return pages


def matrix(records):
    """Per section: coverage by subject and use, headings known, and the best camera-matching candidates."""
    out = {}
    for name, a, b in SECTIONS:
        rs = [r for r in records if r["section"] == name]
        recon = [r for r in rs if r["use"] == "reconstruction"]
        by_subject = {}
        for r in recon:
            by_subject[r["subject"]] = by_subject.get(r["subject"], 0) + 1
        # candidates: post-2012, heading known, close to the line; along the trackbed and a known lens rank first
        cands = sorted((r for r in recon if r["heading_deg"] is not None and r["location"]["offset_m"] <= 150),
                       key=lambda r: (not r["along_trackbed"], r["lens"] is None, r["location"]["offset_m"]))
        stretch = {(r["location"]["route_m"] - a) // 250 for r in recon if r["location"]["offset_m"] <= 150}
        gaps = [f"{(a + 250 * k) / 1000:.2f}-{min(b, a + 250 * (k + 1)) / 1000:.2f} km"
                for k in range(math.ceil((b - a) / 250)) if k not in stretch]
        out[name] = {
            "route_km": [a / 1000, b / 1000],
            "photos": len(rs), "from_2012": len(recon),
            "history": sum(r["use"] == "history" for r in rs), "undated": sum(r["use"] == "undated" for r in rs),
            "with_heading": sum(r["heading_deg"] is not None for r in recon),
            "along_trackbed": sum(r["along_trackbed"] for r in recon),
            "by_subject": dict(sorted(by_subject.items(), key=lambda kv: -kv[1])),
            "camera_match_candidates": [r["id"] for r in cands[:8]],
            "gaps_near_line": gaps,
        }
    return out


def main():
    route = load_route()
    ids = search(route)
    print(f"{len(ids)} Commons files near the line")
    records = [r for r in (record(p, route) for p in details(ids)) if r]
    records.sort(key=lambda r: (r["location"]["route_m"], r["date"] or ""))
    out = {
        "description": f"Openly licensed, geolocated photographs within {CORRIDOR_M} m of the trackbed (Wikimedia Commons, including "
                       f"Geograph Britain and Ireland imports). use='reconstruction' only for photos taken in {FROM_YEAR} or later; "
                       "older photos are for history only. Links only: no image is copied into this project.",
        "fetched": TODAY,
        "source": f"commons.wikimedia.org API (list=geosearch every {SEARCH_STEP_M} m, radius {SEARCH_RADIUS_M} m; prop=imageinfo|coordinates)",
        "fields": {"date_confidence": "verified = full taken date; approximate = year/month or qualified; uncertain = none",
                   "heading_deg": "camera to subject position, both from the file page; null when no subject position",
                   "confidence": "verified = camera position, heading and full date all present",
                   "along_trackbed": "camera within 40 m of the line, looking within 35 degrees of it"},
        "matrix": matrix(records),
        "photos": records,
    }
    with open(os.path.join(ROOT, OUT), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    n = sum(r["use"] == "reconstruction" for r in records)
    print(f"wrote {OUT}: {len(records)} photos in the corridor, {n} from {FROM_YEAR} on")


def self_test():
    assert compass(0) == "N" and compass(44) == "NE" and compass(350) == "N" and compass(181) == "S"
    assert abs(bearing(0, 0, 0, 1) - 0) < 1e-6 and abs(bearing(0, 0, 1, 0) - 90) < 1e-6
    assert capture_date({"DateTimeOriginal": {"value": "2016-05-14 12:01:02"}}) == ("2016-05-14", "verified")
    assert capture_date({"DateTimeOriginal": {"value": "circa 2013"}}) == ("2013", "approximate")
    assert capture_date({"DateTimeOriginal": {"value": "May 2014"}}) == ("2014", "approximate")
    assert capture_date({}) == (None, "uncertain")
    assert subject_of("Pont y Felin", "") == "bridge" and subject_of("Llyn Trawsfynydd", "") == "water"
    assert subject_of("Former station, Maentwrog Road", "") == "station" and subject_of("Moel", "") == "landscape"
    assert lens([{"name": "FocalLengthIn35mmFilm", "value": 36}]) == {"focal_35mm": 36, "hfov_deg": 53.1}
    assert lens([]) is None
    route = ([0.0, 0.0], [0.0, 0.01], [0.0, haversine(0, 0, 0, 0.01)])
    d, off, track = snap(route, 0.001, 0.005)
    assert abs(d - route[2][1] / 2) < 1 and abs(off - 111.3) < 1 and abs(track) < 1e-6
    page = {"pageid": 1, "title": "File:Old bridge.jpg",
            "imageinfo": [{"descriptionurl": "u", "extmetadata": {"LicenseShortName": {"value": "CC BY-SA 2.0"},
                                                                  "DateTimeOriginal": {"value": "2019-07-01"}}}],
            "coordinates": [{"lat": 0.005, "lon": 0.0001, "type": "camera"}, {"lat": 0.006, "lon": 0.0001, "type": "object"}]}
    r = record(page, route)
    assert r["use"] == "reconstruction" and r["heading_deg"] == 0 and r["along_trackbed"] and r["subject"] == "bridge"
    page["imageinfo"][0]["extmetadata"]["LicenseShortName"]["value"] = "All rights reserved"
    assert record(page, route) is None
    print("self-test ok")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--self-test", action="store_true")
    if ap.parse_args().self_test:
        self_test()
    else:
        main()
