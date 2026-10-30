# Photoreal layer (docs/adr/0058-walls-and-hedges-from-osm.md): field boundaries from OSM barrier ways, in their own file.
"""Fetch the OSM field boundaries of one ground window: drystone walls, hedges, fences and tree rows.

  python3 scripts/fetch_barriers.py --section <id>   network: api.openstreetmap.org (the window's bbox, as the pipeline fetches it)
  python3 scripts/fetch_barriers.py --self-test      no network

Writes public/data/sections/<id>/barriers.geojson (LineStrings with only the tags the renderer reads: barrier, wall,
height, natural, leaf_type) and adds one "approximate" register entry per way to data/features-<id>.json (kind
"barrier"), which build_section_data.py keeps on a rebuild. The window's osm.geojson is not touched (spec CL7).
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
from build_poc_data import ROOT, along, load_route, write_json  # noqa: E402
from build_section_data import MARGIN_M, SECTIONS  # noqa: E402
from osm.fetch_bbox import fetch_bbox, to_features  # noqa: E402

TODAY = datetime.date.today().isoformat()
BARRIERS = {"wall", "hedge", "fence", "retaining_wall", "city_wall"}
KEEP_TAGS = ("barrier", "wall", "height", "natural", "leaf_type")


def is_boundary(tags):
    return tags.get("barrier") in BARRIERS or tags.get("natural") == "tree_row"


def boundary_features(feats):
    """The LineString features that are field boundaries, with their tags cut to KEEP_TAGS (data minimisation, ADR 38)."""
    out = []
    for f in feats:
        tags = f["properties"].get("tags", {})
        if not is_boundary(tags):
            continue
        coords = f["geometry"]["coordinates"]
        if f["geometry"]["type"] == "Polygon":  # a closed wall round a field or a garden
            coords = coords[0]
        elif f["geometry"]["type"] != "LineString":
            continue
        out.append({"type": "Feature", "properties": {"id": f["properties"]["id"], "tags": {k: v for k, v in tags.items() if k in KEEP_TAGS}},
                    "geometry": {"type": "LineString", "coordinates": coords}})
    return out


def register_entries(section, feats, scenes):
    kinds = {}
    entries = []
    for f in feats:
        t = f["properties"]["tags"]
        what = t.get("barrier") or t.get("natural")
        kinds[what] = kinds.get(what, 0) + 1
        entries.append({"id": f"barrier-{section}-{f['properties']['id'].split('/')[1]}", "kind": "barrier", "category": "approximate",
                        "source": {"type": "osm", "ref": f["properties"]["id"]}, "scenes": scenes,
                        "note": f"{what} from OSM; height {t['height']} m tagged" if t.get("height") else f"{what} from OSM; generic height, not surveyed"})
    return entries, kinds


def merge_register(path, entries):
    existing = json.load(open(path)) if os.path.exists(path) else []
    kept = [e for e in existing if e.get("kind") != "barrier"]
    return kept + entries


def main(section):
    S = SECTIONS[section]
    if S["kind"] != "ground":
        raise SystemExit(f"{section} is an aerial window; barriers are drawn in ground windows only")
    s0, s1 = S["km"]
    lons, lats, dist = load_route()
    sec = (dist >= s0) & (dist <= s1)
    sl = np.concatenate([[along(lons, lats, dist, s0)[0]], lons[sec], [along(lons, lats, dist, s1)[0]]])
    sa = np.concatenate([[along(lons, lats, dist, s0)[1]], lats[sec], [along(lons, lats, dist, s1)[1]]])
    lat_c = float(sa.mean())
    dlat, dlon = MARGIN_M / 111320, MARGIN_M / (111320 * math.cos(math.radians(lat_c)))
    lon0, lon1, lat0, lat1 = sl.min() - dlon, sl.max() + dlon, sa.min() - dlat, sa.max() + dlat
    splits = 2 if (s1 - s0) <= 2200 else 3
    feats = boundary_features(to_features(*fetch_bbox(lon0, lat0, lon1, lat1, splits=splits)))
    rel = f"public/data/sections/{section}"
    write_json(f"{rel}/barriers.geojson", {"type": "FeatureCollection", "retrieved": TODAY, "section": section,
                                           "source": "OpenStreetMap contributors (ODbL), api.openstreetmap.org/api/0.6/map", "features": feats})
    entries, kinds = register_entries(section, feats, S["scenes"] + [f"Poc3D{section.capitalize()}Photo"])
    path = os.path.join(ROOT, f"data/features-{section}.json")
    write_json(f"data/features-{section}.json", merge_register(path, entries), indent=2)
    print(f"{section}: {len(feats)} boundaries {kinds}; register entries written to data/features-{section}.json (run npm run data:sync)")


def self_test():
    feats = [
        {"type": "Feature", "properties": {"id": "way/1", "tags": {"barrier": "wall", "wall": "dry_stone", "name": "x", "height": "1.2"}}, "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 1]]}},
        {"type": "Feature", "properties": {"id": "way/2", "tags": {"natural": "tree_row"}}, "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 1]]}},
        {"type": "Feature", "properties": {"id": "way/3", "tags": {"barrier": "wall"}}, "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}},
        {"type": "Feature", "properties": {"id": "way/4", "tags": {"highway": "track"}}, "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 1]]}},
    ]
    out = boundary_features(feats)
    failures = []
    if [f["properties"]["id"] for f in out] != ["way/1", "way/2", "way/3"]:
        failures.append(f"kept {[f['properties']['id'] for f in out]}")
    if "name" in out[0]["properties"]["tags"]:
        failures.append("a name tag leaked")
    if out[2]["geometry"]["type"] != "LineString":
        failures.append("a closed wall was not flattened to a line")
    entries, kinds = register_entries("t", out, ["Section-t"])
    if kinds != {"wall": 2, "tree_row": 1} or entries[0]["id"] != "barrier-t-1" or "1.2 m" not in entries[0]["note"]:
        failures.append(f"register entries {entries[0]} {kinds}")
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump([{"id": "road-t-9", "kind": "road"}, {"id": "barrier-t-old", "kind": "barrier"}], fh)
    merged = merge_register(fh.name, entries)
    os.unlink(fh.name)
    if [e["id"] for e in merged] != ["road-t-9", "barrier-t-1", "barrier-t-2", "barrier-t-3"]:
        failures.append(f"merge keeps other kinds and replaces old barriers: {[e['id'] for e in merged]}")
    for f in failures:
        print("FAIL", f)
    print("self-test:", "ok" if not failures else f"{len(failures)} failure(s)")
    return 0 if not failures else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--section", choices=sorted(SECTIONS))
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        sys.exit(self_test())
    if not args.section:
        ap.error("--section <id> or --self-test")
    main(args.section)
