"""Buildings for one section window, from sourced data only (docs/adr/0049-buildings-from-sourced-data.md); the corridor's
serve the photo look's aerial scenes (docs/adr/0063-buildings-up-to-date.md).

  python3 scripts/build_buildings.py --section <window>   network: api.openstreetmap.org, the lidar DSM and DTM COGs
  python3 scripts/build_buildings.py --self-test          synthetic checks, no network (spec BL6, BL17)

Only the footprints the shots see (data/building-candidates-<window>.json, written by `npm run data:candidates`) are
built: OSM's, and the OS OpenMap Local outlines OSM lacks (data/os-buildings-<window>.geojson, ids os/<OS id>), each OSM
footprint marked confirmed or absent by that OS release (data/building-currency-<window>.json; both written by
scripts/fetch_os_buildings.py). Every measured height is also kept in data/building-heights-<window>.json, which the
candidate pass reads. Tags are re-fetched for the OSM ways only and cut to an allowlist; heights are the 90th percentile of DSM - DTM
inside the footprint (2 m level), else levels x 3 m or a 6 m default, marked approximate. Curated landmarks in
data/landmarks.json add sources, dates, status, confidence and roof; those marked featured are drawn as landmark models. Writes public/data/sections/<window>/buildings.json
and the window register's building entries (ids building-<window>-<osm id>), with provenance.
"""
import argparse
import datetime
import json
import math
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_poc_data import LIDAR_URL, ROOT, point_in_ring, write_json  # noqa: E402
from build_section_data import SECTIONS  # noqa: E402
from dem.bng import wgs84_to_bng  # noqa: E402
from dem.cog import Cog  # noqa: E402
from fetch_os_buildings import PRODUCT as OS_PRODUCT  # noqa: E402
from osm.extras import building_value  # noqa: E402
from osm.fetch_bbox import USER_AGENT  # noqa: E402

DSM_URL = LIDAR_URL.replace("wales_dtm_32bit_cog.tif", "wales_dsm_32bit_cog.tif")
TODAY = datetime.date.today().isoformat()
LEVEL = 1  # 2 m: enough cells for a house, a quarter of the 1 m download
KEEP = ("building", "building:levels", "height", "roof:shape", "ruins", "historic")  # no names, addresses or contacts (spec BL17); a ruin's condition
HOUSE_TYPES = {"house", "detached", "semidetached_house", "terrace", "farm", "farm_auxiliary", "barn", "cottage", "residential", "church", "chapel"}


def keep_tags(tags):
    """The building tags the renderer uses, and nothing else (spec BL17)."""
    return {k: v for k, v in tags.items() if k in KEEP}


def p90_height(dsm, dtm, inside, nodata):
    """The 90th percentile of DSM - DTM over the cells inside the footprint, or None if too few valid cells."""
    d = (dsm - dtm)[inside & (dsm != nodata) & (dtm != nodata) & np.isfinite(dsm) & np.isfinite(dtm)]
    return float(np.percentile(d, 90)) if d.size >= 4 else None


def height_of(measured, tags):
    """(height m, source, approximate): lidar when plausible, else levels x 3 m, else 6 m (spec BL6)."""
    if measured is not None and 2.0 <= measured <= 60.0:
        return round(measured, 1), "lidar-dsm", False
    try:
        levels = float(tags.get("building:levels"))
    except (TypeError, ValueError):
        levels = None
    if levels is not None and math.isfinite(levels) and 0 < levels <= 30:  # an OSM tag is input: no NaN, no 30 km walls (t9 F1)
        return levels * 3.0, "levels", True
    return 6.0, "default", True


def over_three_years(observed, retrieved):
    """Over 3 years by the calendar, as registers.ts decides it (29 Feb counts as 28 Feb; t10 L4)."""
    y, m, d = (int(v) for v in observed.split("-"))
    return retrieved > f"{y + 3:04d}-{m:02d}-{28 if (m, d) == (2, 29) else d:02d}"


LANDMARK_KEYS = ("id", "osm", "status", "observedAt", "confidence", "licence", "sources", "screened", "model")


def check_landmark(lm):
    """A curated landmark entry, refused unless complete: dated sources and the record of its web-text screening (BL18)."""
    missing = [k for k in LANDMARK_KEYS if not lm.get(k)]
    if missing:
        raise ValueError(f"data/landmarks.json {lm.get('id', '?')}: missing {', '.join(missing)}")
    if not all(s.get("url", "").startswith("https://") and s.get("kind") for s in lm["sources"]):
        raise ValueError(f"data/landmarks.json {lm['id']}: every source needs an https url and a kind")
    datetime.date.fromisoformat(lm["observedAt"])
    return lm


def roof_of(tags, ring_lonlat):
    shape = tags.get("roof:shape")
    if shape in ("gabled", "flat"):
        return shape
    return "gabled" if len(ring_lonlat) - 1 <= 6 and tags.get("building") in HOUSE_TYPES else "flat"


def parse_elements(root, kind):
    """{"way/<id>" or "relation/<id>": (allowlisted tags, ISO date of the current version, still visible)} from API XML."""
    return {f"{kind}/{e.get('id')}": (keep_tags({t.get("k"): t.get("v") for t in e.findall("tag")}), e.get("timestamp", "")[:10], e.get("visible", "true") != "false")
            for e in root.findall(kind)}


def fetch_elements(pids):
    """Every footprint's tags, date and visibility via api/0.6/ways and /relations, in batches: relations too, so none is
    dated today by default (t10 P-M4), and a deleted way is known as deleted (t10 P-L10)."""
    out = {}
    for kind in ("way", "relation"):
        ids = [p.split("/")[1] for p in pids if p.startswith(kind + "/")]
        for k in range(0, len(ids), 100):
            url = f"https://api.openstreetmap.org/api/0.6/{kind}s?{kind}s=" + ",".join(ids[k:k + 100])
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as r:
                out.update(parse_elements(ET.fromstring(r.read()), kind))
    return out


def read_both(e0, n0, e1, n1):
    """DSM and DTM over one BNG box at the 2 m level, on the same grid."""
    grids = []
    for url in (DSM_URL, LIDAR_URL):
        cog = Cog(url)
        px, py = cog.pixel_size(LEVEL)
        c0, c1 = math.floor((e0 - cog.origin_e) / px), math.ceil((e1 - cog.origin_e) / px)
        r0, r1 = math.floor((cog.origin_n - n1) / py), math.ceil((cog.origin_n - n0) / py)
        g = cog.read_window(LEVEL, c0, r0, c1 - c0, r1 - r0).astype(np.float64)
        grids.append((g, cog.origin_e + (c0 + 0.5) * px, cog.origin_n - (r0 + 0.5) * py, px, py, cog.nodata))
    return grids


def measure_heights(rings, cluster_m=1000):
    """Each footprint's lidar height (p90 of DSM - DTM inside it, or None), reading the 2 m lidar per 1 km cluster of
    footprints and testing each footprint over its own bounding box only: a window as long as the corridor would
    otherwise be one read of millions of cells, scanned once per building. The COG's pixel grid does not depend on the
    box read, so the heights are the same as from one read over everything."""
    clusters = {}
    for item in rings:
        _f, _ring, e, n = item
        clusters.setdefault((int(e.mean() // cluster_m), int(n.mean() // cluster_m)), []).append(item)
    out = {}
    for key in sorted(clusters):
        group = clusters[key]
        e0 = min(r[2].min() for r in group) - 10
        e1 = max(r[2].max() for r in group) + 10
        n0 = min(r[3].min() for r in group) - 10
        n1 = max(r[3].max() for r in group) + 10
        (dsm, oe, on, px, py, nd), (dtm, *_rest) = read_both(e0, n0, e1, n1)
        rows, cols = dsm.shape
        for f, _ring, e, n in group:
            c0 = max(0, int(math.floor((e.min() - oe) / px)))
            c1 = min(cols, int(math.ceil((e.max() - oe) / px)) + 1)
            r0 = max(0, int(math.floor((on - n.max()) / py)))
            r1 = min(rows, int(math.ceil((on - n.min()) / py)) + 1)
            cc, rr = np.meshgrid(np.arange(c0, c1), np.arange(r0, r1))
            ge, gn = oe + cc * px, on - rr * py
            box = (ge >= e.min()) & (ge <= e.max()) & (gn >= n.min()) & (gn <= n.max())
            inside = np.zeros_like(box)
            inside[box] = point_in_ring(ge[box], gn[box], list(zip(e, n)))
            out[f["properties"]["id"]] = p90_height(dsm[r0:r1, c0:c1], dtm[r0:r1, c0:c1], inside, nd)
    return out


def os_currency(osmap, lidar, release, flown=None, earlier=()):
    """(confidence cap, status or None, note) from the checks of a footprint's currency (ADR 63): the 2020-23 lidar
    (flown on `flown`), the OS release, and the older NRW lidar (`earlier`: [{flown, heightM}] from lidar-history.json).
    osmap is "source" (an OS outline), "confirmed" or "absent" (an OSM footprint OS has or lacks), or "unchecked"."""
    flight = f"the lidar flown {flown}" if flown else "the 2020-23 lidar"
    stood = [s for s in earlier if s["heightM"] >= 2.0]
    if lidar == "absent" and osmap in ("source", "confirmed"):
        return "medium", None, f"; not in {flight} but in OS OpenMap Local {release}: built since the flight"
    if lidar == "absent" and osmap == "absent" and stood:
        return "medium", "demolished", (f"; stood in the lidar flown {stood[-1]['flown']} ({stood[-1]['heightM']} m), gone in {flight} and in OS OpenMap Local "
                                        f"{release}: demolished between")
    if lidar == "absent" and osmap == "absent" and earlier:
        return "low", None, (f"; in no lidar ({', '.join(s['flown'] for s in earlier)}, {flown or '2020-23'}) and not in OS OpenMap Local {release}: "
                             "never seen standing by any source (check)")
    if lidar == "absent" and osmap == "absent":
        return "low", None, f"; in neither {flight} nor OS OpenMap Local {release}: may no longer stand, or be newer than both (check)"
    if lidar == "absent":
        return "low", None, f"; no structure in {flight}: built since the flight, or no longer standing (check)"
    return None, None, f"; not in OS OpenMap Local {release}" if osmap == "absent" else ""


def records_at(e, n, items, dist_m=5.0):
    """The DataMapWales records (Cadw, NMRW: points with e, n) inside an outline or within dist_m of it."""
    ring = list(zip(e, n))
    a = np.column_stack([e[:-1], n[:-1]])
    seg = np.column_stack([e[1:], n[1:]]) - a
    out = []
    for it in items:
        if e.min() - dist_m <= it["e"] <= e.max() + dist_m and n.min() - dist_m <= it["n"] <= n.max() + dist_m:
            p = np.array([it["e"], it["n"]])
            t = np.clip(((p - a) * seg).sum(axis=1) / np.maximum((seg * seg).sum(axis=1), 1e-9), 0, 1)
            if point_in_ring(p[:1], p[1:], ring)[0] or np.hypot(*(a + seg * t[:, None] - p).T).min() <= dist_m:
                out.append(it)
    return out


def flown_at(e, n, tiles):
    """The day the 2020-23 lidar tile under a footprint's centre was flown, or None."""
    c = (float(np.mean(e)), float(np.mean(n)))
    return next((t["flown"] for t in tiles if t["box"][0] <= c[0] <= t["box"][2] and t["box"][1] <= c[1] <= t["box"][3]), None)


def main(section):
    cand = json.load(open(os.path.join(ROOT, f"data/building-candidates-{section}.json")))["candidates"]
    wanted = {c["id"] for c in cand}
    osm = json.load(open(os.path.join(ROOT, f"public/data/sections/{section}/osm.geojson")))["features"]
    os_path, cur_path = (os.path.join(ROOT, f"data/{name}-{section}.{ext}") for name, ext in (("os-buildings", "geojson"), ("building-currency", "json")))
    os_doc = json.load(open(os_path)) if os.path.exists(os_path) else {"features": [], "release": None}
    currency = json.load(open(cur_path)) if os.path.exists(cur_path) else None
    if currency and currency["osRelease"] != os_doc["release"]:
        raise ValueError(f"{cur_path} and {os_path} come from different OS releases: run scripts/fetch_os_buildings.py --section {section}")
    in_os, not_in_os = (set(currency["osmInOs"]), set(currency["osmNotInOs"])) if currency else (set(), set())
    release, os_licence = os_doc["release"], f"OGL (OS OpenMap - Local: {os_doc.get('attribution')})"
    fps = [f for f in osm + os_doc["features"] if f["properties"]["id"] in wanted and f["properties"].get("tags", {}).get("building")]
    landmarks = {lm["osm"]: check_landmark(lm) for lm in (json.load(open(os.path.join(ROOT, "data/landmarks.json"))) if os.path.exists(os.path.join(ROOT, "data/landmarks.json")) else [])}
    # DataMapWales (scripts/fetch_dmw.py): lidar flight days, Cadw listed buildings, NMRW sites; the older lidar's view
    dmw_path, hist_path = os.path.join(ROOT, "data/dmw-layers.json"), os.path.join(ROOT, "data/lidar-history.json")
    dmw = json.load(open(dmw_path)) if os.path.exists(dmw_path) else {"lidarTiles": [], "listed": [], "sites": [], "attribution": {}}
    earlier = json.load(open(hist_path))["footprints"] if os.path.exists(hist_path) else {}
    elements = fetch_elements([f["properties"]["id"] for f in fps if not f["properties"]["id"].startswith("os/")]) if fps else {}
    for f in fps:
        if f["properties"]["id"].startswith("os/"):  # an OS outline: no OSM element; dated by the OS release
            elements[f["properties"]["id"]] = ({"building": "yes"}, release, True)
    gone = [f["properties"]["id"] for f in fps if not elements.get(f["properties"]["id"], ({}, "", True))[2]]
    if gone:
        print(f"skipped, deleted in OSM since the window was fetched: {', '.join(gone)}")
    fps = [f for f in fps if f["properties"]["id"] not in gone]
    rings = []
    for f in fps:
        g = f["geometry"]
        ring = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
        e, n = wgs84_to_bng(np.array([p[0] for p in ring]), np.array([p[1] for p in ring]))
        rings.append((f, ring, e, n))
    out, entries = [], []
    measured = measure_heights(rings)
    scenes = SECTIONS[section]["scenes"]
    if rings:
        for f, ring, e, n in rings:
            pid = f["properties"]["id"]
            t, stamp, _visible = elements.get(pid, ({"building": "yes"}, "", True))
            h, src, approx = height_of(measured[pid], t)
            # currency (ADR 63): the 2020-23 lidar either saw a structure on the footprint or did not, and the latest OS
            # release has the building or lacks it; a building neither shows is never more than low confidence
            lidar = "unmeasured" if measured[pid] is None else ("present" if measured[pid] >= 2.0 else "absent")
            from_os = pid.startswith("os/")
            # unchecked: no OS comparison yet, or a curated demolition the comparison leaves out
            osmap = "source" if from_os else "confirmed" if pid in in_os else "absent" if pid in not_in_os else "unchecked"
            lm = landmarks.get(pid)
            flown = flown_at(e, n, dmw["lidarTiles"])
            cap, auto_status, currency = (None, None, f"; {lm['statusNote']}") if lm and lm.get("statusNote") else os_currency(osmap, lidar, release, flown, earlier.get(pid, ()))
            listed, sites = records_at(e, n, dmw["listed"]), records_at(e, n, dmw["sites"])
            # a curated entry adds sources, status and roof; only a featured one is drawn as a landmark model (spec BL13)
            featured = lm is not None and lm.get("featured", True)
            status = lm["status"] if lm else auto_status or "existing"
            # the latest dated observation: the OSM edit (or the OS release of an OS outline), the lidar flight that saw it,
            # the OS release that has it, or for a demolition the OS release that lacks it
            seen = [stamp] + ([flown] if flown and lidar == "present" else []) + ([release] if osmap == "confirmed" or auto_status == "demolished" else [])
            observed = lm["observedAt"] if lm else max(seen) if stamp else stamp
            if not observed:  # no dated observation: never today by default, and never high confidence (BL4; t10 P-M4)
                raise ValueError(f"{pid}: no OSM timestamp; refusing to date it today")
            confidence = lm["confidence"] if lm else cap or ("high" if src == "lidar-dsm" and not over_three_years(observed, TODAY) else "medium")
            bid = f"building-{section}-{'os-' if from_os else ''}{pid.split('/')[1]}"
            roof = lm["model"].get("roof", roof_of(t, ring)) if lm else roof_of(t, ring)  # a curated landmark's roof is sourced
            ruin = building_value(t) == "ruins"  # drawn as walls open to the sky (fetch_osm_extras.py marks the same)
            out.append({"id": bid, ("os" if from_os else "osm"): pid, "footprint": ring, "heightM": h, "heightSource": src, "roof": roof,
                        "kind": "landmark" if featured else "background", "status": status, "type": "ruins" if ruin else t.get("building", "yes"),
                        "lidar": lidar, **({"lidarFlown": flown} if flown else {}), "osMap": osmap, "mapEditedAt": stamp,
                        **({"listed": [{"record": x["record"], "grade": x["grade"]} for x in listed]} if listed else {}),
                        **({"nmrw": [x["nprn"] for x in sites]} if sites else {}),
                        **({"curated": lm["id"]} if lm else {}), **({"landmark": lm["id"], "model": lm["model"]} if featured else {}),
                        **({"ruin": True} if ruin else {})})
            urls = list(dict.fromkeys(([OS_PRODUCT] if from_os else [f"https://www.openstreetmap.org/{pid}"] + ([OS_PRODUCT] if osmap == "confirmed" else []))
                                      + ([DSM_URL] if src == "lidar-dsm" or flown else []) + [x["url"] for x in listed + sites]
                                      + ([s["url"] for s in lm["sources"]] if lm else [])))
            evidence = ["map"] + (["lidar"] if src == "lidar-dsm" or (flown and lidar != "unmeasured") else []) + (["record"] if listed or sites else []) + ([s["kind"] for s in lm["sources"]] if lm else [])
            licence = (f"{os_licence} (footprint)" if from_os else "ODbL (footprint, OpenStreetMap contributors)" + (f"; {os_licence} (still standing)" if osmap == "confirmed" else ""))
            licence += (f"; OGL ({dmw['attribution']['listed']})" if listed else "") + (f"; OGL ({dmw['attribution']['sites']})" if sites else "")
            if flown and src != "lidar-dsm" and lidar != "unmeasured":
                licence += f"; OGL (lidar flown {flown}, Welsh Government; nothing standing on the footprint)"
            currency += "".join(f"; listed grade {x['grade']} (Cadw {x['record']})" for x in listed) + "".join(f"; NMRW {x['nprn']}: {x['type'].lower()}, {(x['evidence'] or 'not recorded').lower()}" for x in sites)
            entries.append({"id": bid, "kind": "building", "category": "approximate" if approx or from_os or not lm else "verified",
                            "source": {"type": "os" if from_os else "osm", "ref": pid}, "scenes": scenes, "status": status,
                            "provenance": {"urls": urls, "evidence": sorted(set(evidence)), "observedAt": observed, "retrievedAt": TODAY,
                                           "licence": licence + ("; OGL (height, Welsh Government lidar DSM/DTM)" if src == "lidar-dsm" else "") + (f"; {lm['licence']}" if lm else ""),
                                           "confidence": confidence},
                            "note": ("OS outline, generalised; not in OSM; " if from_os else "") + f"{'ruins' if ruin else t.get('building', 'yes')}; height {h} m from {src}"
                            + ("" if src == "lidar-dsm" else " (approximate)") + currency, **({"condition": "ruin"} if ruin else {})})
    # a demolished building is recorded with its evidence, not drawn: the reel shows what stands (ADR 63). The candidate
    # pass reads this list, so the next pass leaves it out (BL1: what is built is what the candidates list)
    # (earlier records stay while their footprint is not rebuilt, as the candidate pass then leaves it out; delete the
    # file to judge them afresh)
    removed_path = os.path.join(ROOT, f"data/buildings-removed-{section}.json")
    done = {f["properties"]["id"] for f, *_ in rings}
    kept = [x for x in (json.load(open(removed_path)) if os.path.exists(removed_path) else []) if x["source"]["ref"] not in done]
    removed = sorted(kept + [{**e, "footprint": b["footprint"]} for b, e in zip(out, entries) if b["status"] == "demolished"], key=lambda x: x["id"])
    write_json(f"data/buildings-removed-{section}.json", removed, indent=1)
    gone_ids = {x["id"] for x in removed}
    out = [b for b in out if b["id"] not in gone_ids]
    entries = [e for e in entries if e["id"] not in gone_ids]
    write_json(f"public/data/sections/{section}/buildings.json", sorted(out, key=lambda b: b["id"]), indent=1)
    # every height measured so far, kept even for footprints a later candidate pass drops, so the list is stable (BL1)
    cache_path = os.path.join(ROOT, f"data/building-heights-{section}.json")
    cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    cache.update({b.get("osm") or b["os"]: {"heightM": b["heightM"], "source": b["heightSource"]} for b in out})
    with open(cache_path, "w") as fh:
        json.dump(dict(sorted(cache.items())), fh, indent=1, allow_nan=False)
        fh.write("\n")
    reg_path = os.path.join(ROOT, f"data/features-{section}.json")
    register = [x for x in json.load(open(reg_path)) if not x["id"].startswith(f"building-{section}-")]
    with open(reg_path, "w") as fh:
        json.dump(register + sorted(entries, key=lambda b: b["id"]), fh, indent=2)
        fh.write("\n")
    lidar = sum(1 for b in out if b["heightSource"] == "lidar-dsm")
    absent = [b.get("osm") or b["os"] for b in out if b["lidar"] == "absent"]
    neither = [b["osm"] for b in out if b["lidar"] == "absent" and b["osMap"] == "absent"]
    osmap = {k: sum(1 for b in out if b["osMap"] == k) for k in ("source", "confirmed", "absent", "unchecked")}
    print(f"{section}: {len(out)} buildings ({lidar} lidar heights, {len(out) - lidar} approximate; {sum(1 for b in out if 'curated' in b)} curated, {sum(1 for b in out if b['kind'] == 'landmark')} landmarks); "
          f"OS {release}: {osmap['source']} OS-only, {osmap['confirmed']} OSM confirmed, {osmap['absent']} OSM not in OS, {osmap['unchecked']} unchecked; "
          f"{len(absent)} not in the 2020-23 lidar; in neither: {', '.join(neither) or 'none'}; demolished, recorded not drawn: {', '.join(x['source']['ref'] for x in removed) or 'none'}")


def self_test():
    failures = []
    t = keep_tags({"building": "church", "name": "St X", "addr:street": "Y", "building:levels": "2", "height": "9", "roof:shape": "gabled", "phone": "1"})
    if set(t) != {"building", "building:levels", "height", "roof:shape"}:
        failures.append(f"BL17: allowlist kept {sorted(t)}")
    dtm = np.full((10, 10), 100.0)
    dsm = dtm.copy()
    inside = np.zeros((10, 10), dtype=bool)
    inside[3:7, 3:7] = True
    dsm[3:7, 3:7] = 108.0
    dsm[3, 3] = 130.0  # one chimney or bird: the 90th percentile ignores it
    if height_of(p90_height(dsm, dtm, inside, -9999.0), {})[:2] != (8.0, "lidar-dsm"):
        failures.append(f"BL6: DSM - DTM height {height_of(p90_height(dsm, dtm, inside, -9999.0), {})}")
    if height_of(None, {"building:levels": "2"}) != (6.0, "levels", True):
        failures.append("BL6: levels fallback")
    if height_of(0.5, {}) != (6.0, "default", True):
        failures.append("BL6: an implausible lidar height must fall back and be approximate")
    # t9 F1: a levels tag that is not a finite count of 1-30 storeys falls back to the default, never NaN or a 30 km wall
    for bad in ("NaN", "inf", "1e4", "-2", "0"):
        if height_of(None, {"building:levels": bad}) != (6.0, "default", True):
            failures.append(f"t9 F1: building:levels={bad} gave {height_of(None, {'building:levels': bad})}")
    try:
        json.dumps({"h": float("nan")}, allow_nan=False)
        failures.append("t9 F1: JSON must refuse NaN")
    except ValueError:
        pass
    # t10 P-M4, P-L10: relations and ways parse alike, keyed by kind, with their date and whether they still exist
    xml = ET.fromstring('<osm><way id="5" timestamp="2014-06-21T11:45:01Z"><tag k="building" v="yes"/><tag k="name" v="X"/></way>'
                        '<way id="6" visible="false" timestamp="2025-01-01T00:00:00Z"/></osm>')
    got = parse_elements(xml, "way")
    if got.get("way/5") != ({"building": "yes"}, "2014-06-21", True) or got.get("way/6", (None, None, True))[2]:
        failures.append(f"t10 P-M4/P-L10: parse_elements gave {got}")
    # t10 L4: the same calendar rule as registers.ts
    for obs, ret, over in (("2021-03-01", "2024-03-01", False), ("2021-01-01", "2024-01-01", False), ("2021-03-01", "2024-03-02", True), ("2020-02-29", "2023-02-28", False)):
        if over_three_years(obs, ret) != over:
            failures.append(f"t10 L4: {obs} -> {ret} over three years should be {over}")
    # ADR 63: a building neither the lidar nor the OS release shows is low confidence; one OS has is built since the flight
    for args, want in ((("absent", "absent", "2026-10-26"), "low"), (("confirmed", "absent", "2026-10-26"), "medium"), (("source", "absent", "2026-10-26"), "medium"),
                       (("unchecked", "absent", None), "low"), (("confirmed", "present", "2026-10-26"), None), (("absent", "present", "2026-10-26"), None)):
        if os_currency(*args)[0] != want:
            failures.append(f"ADR 63: os_currency{args} capped at {os_currency(*args)[0]}, expected {want}")
    # one the 2007 lidar saw standing, gone from the 2022 lidar and from OS, was demolished between; one no lidar saw stays a check
    gone = os_currency("absent", "absent", "2026-10-26", "2022-01-11", [{"flown": "2007-02-04", "heightM": 6.2}])
    never = os_currency("absent", "absent", "2026-10-26", "2022-01-11", [{"flown": "2007-02-04", "heightM": 0.3}])
    if gone[:2] != ("medium", "demolished") or "2007-02-04" not in gone[2] or never[:2] != ("low", None):
        failures.append(f"ADR 63: archive lidar: {gone}, {never}")
    found = records_at(np.array([0.0, 10, 10, 0, 0]), np.array([0.0, 0, 10, 10, 0]), [{"e": 5, "n": 5}, {"e": 13, "n": 5}, {"e": 30, "n": 5}])
    if found != [{"e": 5, "n": 5}, {"e": 13, "n": 5}]:
        failures.append(f"records_at: {found}")
    # t9 F5: a landmark without a screening record, or without dated sources, is refused (spec BL18)
    good = {"id": "x", "osm": "way/1", "status": "existing", "observedAt": "2015-10-03", "confidence": "medium", "licence": "L",
            "sources": [{"url": "https://www.openstreetmap.org/way/1", "kind": "map"}], "screened": "aidefence_scan safe=true", "model": {"type": "church"}}
    if check_landmark(good) is not good:
        failures.append("t9 F5: a complete landmark entry must pass")
    for key in ("screened", "sources", "observedAt"):
        try:
            check_landmark({k: v for k, v in good.items() if k != key})
            failures.append(f"t9 F5: a landmark without {key} must be refused")
        except ValueError:
            pass
    for f in failures:
        print("FAIL", f)
    print("self-test:", "ok" if not failures else f"{len(failures)} failure(s)")
    return 0 if not failures else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--section")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        sys.exit(self_test())
    if not a.section:
        ap.error("--section <window> or --self-test")
    main(a.section)
