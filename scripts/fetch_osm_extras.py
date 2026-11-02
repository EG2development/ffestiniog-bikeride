"""Add a window's watercourses, power lines and pylons, and its ruins' condition, to its osm.geojson (osm/extras.py).

  python scripts/fetch_osm_extras.py --section <ground window>   network: api.openstreetmap.org (the window's bbox and splits)
  python scripts/fetch_osm_extras.py --section <id> --offline   no network: re-register the extras already in its osm.geojson
  python scripts/fetch_osm_extras.py --section corridor          no network: the ground windows' extras and ruins
  python scripts/fetch_osm_extras.py --self-test                 no network

The windows' osm.geojson kept roads, the line's structures and areas, so the rivers under the line's bridges, the
power line over it and the ruins' condition were lost. This fetches the window's box again (the same box and splits as
build_section_data.py), drops any extras an earlier run appended and appends the window's waterway lines (river,
stream, canal, drain, ditch: name, width, tunnel, culvert tags), power=line|minor_line ways and power=tower|pole nodes
(Point features). The only change to an existing feature is a building's `building` value, "ruins" or "abandoned" where
OSM records one (no roof is drawn on a ruin); every other feature keeps its bytes (spec CL7), which the run checks.
It registers each extra in data/features-<window>.json ("approximate", source osm, with the km where it crosses the
line), marks the ruins in buildings.json ("ruin": true) and in their register entries (condition "ruin").
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
from build_poc_data import ROOT, along, load_route  # noqa: E402
from build_section_data import MARGIN_M, SECTIONS  # noqa: E402
from osm.extras import building_value, extra_kind, extras_of, owned_by_extras, point_features  # noqa: E402
from osm.fetch_bbox import _fetch, to_features  # noqa: E402

TODAY = datetime.date.today().isoformat()
SOURCE = "OpenStreetMap contributors (ODbL), api.openstreetmap.org/api/0.6/map"
GROUND = [w for w, s in SECTIONS.items() if s["kind"] == "ground"]


def write_json(rel, obj, indent=None):
    """build_poc_data.write_json with LF line ends on every platform, so a run on Windows changes no line endings."""
    with open(os.path.join(ROOT, rel), "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, indent=indent, allow_nan=False)
        f.write("\n")


def window_box(section, lons, lats, dist):
    """The window's OSM box and splits, as build_section_data.py fetches it."""
    s0, s1 = SECTIONS[section]["km"]
    sec = (dist >= s0) & (dist <= s1)
    sl = np.concatenate([[along(lons, lats, dist, s0)[0]], lons[sec], [along(lons, lats, dist, s1)[0]]])
    sa = np.concatenate([[along(lons, lats, dist, s0)[1]], lats[sec], [along(lons, lats, dist, s1)[1]]])
    dlat, dlon = MARGIN_M / 111320, MARGIN_M / (111320 * math.cos(math.radians(float(sa.mean()))))
    return (sl.min() - dlon, sa.min() - dlat, sl.max() + dlon, sa.max() + dlat), SECTIONS[section].get("splits") or (2 if (s1 - s0) <= 2200 else 3)


def fetch_tagged(box, splits):
    """fetch_bbox with the nodes' tags kept (power towers and poles are nodes)."""
    lon0, lat0, lon1, lat1 = box
    nodes, node_tags, ways, rels = {}, {}, {}, {}
    dlon, dlat = (lon1 - lon0) / splits, (lat1 - lat0) / splits
    for i in range(splits):
        for j in range(splits):
            root = _fetch(lon0 + i * dlon, lat0 + j * dlat, lon0 + (i + 1) * dlon, lat0 + (j + 1) * dlat)
            for n in root.findall("node"):
                nodes[n.get("id")] = (float(n.get("lon")), float(n.get("lat")))
                if n.findall("tag"):
                    node_tags[n.get("id")] = {t.get("k"): t.get("v") for t in n.findall("tag")}
            for w in root.findall("way"):
                ways[w.get("id")] = ({t.get("k"): t.get("v") for t in w.findall("tag")}, [nd.get("ref") for nd in w.findall("nd")])
            for r in root.findall("relation"):
                rels[r.get("id")] = ({t.get("k"): t.get("v") for t in r.findall("tag")}, [(m.get("type"), m.get("ref"), m.get("role")) for m in r.findall("member")])
    return nodes, node_tags, ways, rels


def route_crossings(coords, lons, lats, dist):
    """Route distances (m, ascending) where a polyline crosses the route's centreline, in local metres; a crossing at a
    node both ways share (OSM joins a track to the railway there) is counted once."""
    lat_c = float(lats.mean())
    k = 111320 * math.cos(math.radians(lat_c))
    ax, ay = (lons[:-1] - lons[0]) * k, (lats[:-1] - lats[0]) * 111320
    bx, by = (lons[1:] - lons[0]) * k, (lats[1:] - lats[0]) * 111320
    out = []
    for (p0, p1), (q0, q1) in zip(coords, coords[1:]):
        px, py = (p0 - lons[0]) * k, (p1 - lats[0]) * 111320
        qx, qy = (q0 - lons[0]) * k, (q1 - lats[0]) * 111320
        rx, ry, sx, sy = bx - ax, by - ay, qx - px, qy - py
        den = rx * sy - ry * sx
        with np.errstate(divide="ignore", invalid="ignore"):
            t = ((px - ax) * sy - (py - ay) * sx) / den
            u = ((px - ax) * ry - (py - ay) * rx) / den
        hit = (den != 0) & (t >= 0) & (t <= 1) & (u >= 0) & (u <= 1)
        out += [float(dist[i] + t[i] * (dist[i + 1] - dist[i])) for i in np.nonzero(hit)[0]]
    return [d for k, d in enumerate(sorted(out)) if k == 0 or d - sorted(out)[k - 1] > 0.5]


def register_entries(section, extras, lons, lats, dist):
    scenes = SECTIONS[section]["scenes"]
    entries = []
    for f in extras:
        kind, pid, t = extra_kind(f), f["properties"]["id"], f["properties"]["tags"]
        num = pid.split("/")[1]
        crossings = [round(d / 1000, 3) for d in route_crossings(f["geometry"]["coordinates"], lons, lats, dist)] if kind != "power-support" else []
        where = f"; crosses the line at km {', '.join(f'{c:.3f}' for c in crossings)}" if crossings else ""
        if kind == "waterway":
            what = f"waterway={t['waterway']}" + (f" ({t['name']})" if t.get("name") else "") + (" in a culvert" if t.get("tunnel") == "culvert" or t.get("culvert") == "yes" else "")
            width = f"; width {t['width']} m tagged" if t.get("width") else "; width not tagged"
            entries.append({"id": f"waterway-{section}-{num}", "kind": "water", "category": "approximate", "source": {"type": "osm", "ref": pid}, "scenes": scenes,
                            **({"crossingsKm": crossings} if crossings else {}), "note": f"{what}; centreline from OSM{width}{where}"})
        elif kind == "power-line":
            entries.append({"id": f"power-line-{section}-{num}", "kind": "structure", "category": "approximate", "source": {"type": "osm", "ref": pid}, "scenes": scenes,
                            **({"crossingsKm": crossings} if crossings else {}),
                            "note": f"power={t['power']} overhead line from OSM" + (f", {t['voltage']} V" if t.get("voltage") else "") + f"; supports from its tower and pole nodes{where}"})
        else:
            entries.append({"id": f"power-{t['power']}-{section}-{num}", "kind": "structure", "category": "approximate", "source": {"type": "osm", "ref": pid}, "scenes": scenes,
                            "note": f"power={t['power']} from OSM; position only, generic " + ("lattice pylon" if t["power"] == "tower" else "pole")})
    return entries


def apply_ruins(doc_features, values):
    """Sets each building's `building` value from `values` {id: value}, in place; returns the ids changed."""
    changed = []
    for f in doc_features:
        tags = f["properties"].get("tags", {})
        pid = f["properties"]["id"]
        if "building" in tags and pid in values and tags["building"] != values[pid]:
            tags["building"] = values[pid]
            changed.append(pid)
    return changed


def mark_buildings(section, values):
    """buildings.json and the register's building entries carry a ruin's condition (osm/extras.py building_value)."""
    rel = f"public/data/sections/{section}/buildings.json"
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        return []
    blds = json.load(open(path, encoding="utf-8"))
    marked = []
    for b in blds:
        v = values.get(b.get("osm"))
        if v is None:
            continue
        if v == "ruins":
            b["type"], b["ruin"] = "ruins", True
            marked.append(b["id"])
        elif b.get("ruin"):
            b.pop("ruin")
            b["type"] = v
    write_json(rel, blds, indent=1)
    reg = os.path.join(ROOT, f"data/features-{section}.json")
    entries = json.load(open(reg, encoding="utf-8"))
    for e in entries:
        if e.get("kind") != "building" or e.get("source", {}).get("type") != "osm":
            continue
        if e["id"] in marked:
            e["condition"] = "ruin"
            e["note"] = "ruins" + e["note"][e["note"].index(";"):] if ";" in e["note"] else "ruins"
        elif e.get("condition") == "ruin" and values.get(e["source"]["ref"]) not in (None, "ruins"):
            e.pop("condition")
    write_json(f"data/features-{section}.json", entries, indent=2)
    return marked


def write_window(section, extras, values, lons, lats, dist, source=None):
    """`source` None: the extras are the window's own, already on disk (--offline), so its retrieval date stands."""
    rel = f"public/data/sections/{section}/osm.geojson"
    doc = json.load(open(os.path.join(ROOT, rel), encoding="utf-8"))
    kept = [f for f in doc["features"] if extra_kind(f) is None]
    before = [json.dumps(f) for f in kept]
    changed = apply_ruins(kept, values)
    # spec CL7: every feature but a re-valued building keeps its bytes
    moved = [f["properties"]["id"] for f, b in zip(kept, before) if json.dumps(f) != b and f["properties"]["id"] not in changed]
    if moved:
        raise SystemExit(f"{section}: features would change beyond the building values: {moved[:5]}")
    out = {k: v for k, v in doc.items() if k != "features"}
    if source is not None or "extras" not in out:
        out["extras"] = {"retrieved": TODAY, "source": source or SOURCE, "kinds": "waterway lines, power lines, power towers and poles (scripts/fetch_osm_extras.py)"}
    out["features"] = kept + extras
    write_json(rel, out)
    reg_rel = f"data/features-{section}.json"
    reg = [e for e in json.load(open(os.path.join(ROOT, reg_rel), encoding="utf-8")) if not owned_by_extras(e)]
    entries = register_entries(section, extras, lons, lats, dist)
    write_json(reg_rel, reg + entries, indent=2)
    marked = mark_buildings(section, values)
    counts = {k: sum(1 for f in extras if extra_kind(f) == k) for k in ("waterway", "power-line", "power-support")}
    print(f"{section}: {counts}; building values changed {changed}; ruins marked {marked}")
    for e in entries:
        if e.get("crossingsKm"):
            print(f"  {e['id']}: {e['note']}")


def main(section, offline=False):
    lons, lats, dist = load_route()
    if offline and section != "corridor":
        doc = json.load(open(os.path.join(ROOT, f"public/data/sections/{section}/osm.geojson"), encoding="utf-8"))
        values = {f["properties"]["id"]: f["properties"]["tags"]["building"] for f in doc["features"] if "building" in f["properties"]["tags"]}
        write_window(section, extras_of(doc["features"]), values, lons, lats, dist)
        return
    if section == "corridor":
        # the ground windows cover the corridor's line; its far corners are left without extras
        extras, values = {}, {}
        for w in GROUND:
            doc = json.load(open(os.path.join(ROOT, f"public/data/sections/{w}/osm.geojson"), encoding="utf-8"))
            extras.update({f["properties"]["id"]: f for f in extras_of(doc["features"])})
            values.update({f["properties"]["id"]: f["properties"]["tags"]["building"] for f in doc["features"] if "building" in f["properties"]["tags"]})
        write_window(section, extras_of(extras.values()), values, lons, lats, dist, SOURCE + " (the ground windows' extras)")
        return
    if SECTIONS[section]["kind"] != "ground":
        raise SystemExit(f"{section} is not a ground window")
    box, splits = window_box(section, lons, lats, dist)
    nodes, node_tags, ways, rels = fetch_tagged(box, splits)
    feats = to_features(nodes, ways, rels) + point_features(nodes, node_tags)
    values = {f["properties"]["id"]: building_value(f["properties"]["tags"]) for f in feats if "building" in f["properties"]["tags"]}
    write_window(section, extras_of(feats), values, lons, lats, dist, SOURCE)


def self_test():
    failures = []
    line = lambda pid, tags, coords: {"type": "Feature", "properties": {"id": pid, "tags": tags}, "geometry": {"type": "LineString", "coordinates": coords}}  # noqa: E731
    feats = [
        line("way/3", {"waterway": "stream", "name": "Afon X", "source": "survey"}, [[0, 0], [1, 1]]),
        line("way/2", {"power": "line", "operator": "Y", "voltage": "132000"}, [[0, 0], [1, 0]]),
        line("way/1", {"waterway": "riverbank"}, [[0, 0], [1, 0]]),
        {"type": "Feature", "properties": {"id": "way/4", "tags": {"waterway": "ditch"}}, "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}},
        line("way/5", {"highway": "track"}, [[0, 0], [1, 0]]),
    ] + point_features({"7": (0.5, 0.5), "8": (0.1, 0.1)}, {"7": {"power": "tower", "ref": "Z1"}, "8": {"natural": "tree"}})
    ex = extras_of(feats)
    if [f["properties"]["id"] for f in ex] != ["way/3", "way/4", "way/2", "node/7"]:
        failures.append(f"extras {[f['properties']['id'] for f in ex]}")
    if ex[0]["properties"]["tags"] != {"waterway": "stream", "name": "Afon X"} or "operator" in ex[2]["properties"]["tags"] or ex[3]["properties"]["tags"] != {"power": "tower"}:
        failures.append("tags not minimised")
    if ex[1]["geometry"]["type"] != "LineString" or ex[3]["geometry"] != {"type": "Point", "coordinates": [0.5, 0.5]}:
        failures.append("geometry: a closed ditch is a line, a tower a point")
    for tags, want in (({"building": "yes", "ruins": "yes"}, "ruins"), ({"building": "ruins"}, "ruins"), ({"building": "house", "abandoned": "yes"}, "abandoned"), ({"building": "house"}, "yes")):
        if building_value(tags) != want:
            failures.append(f"building_value {tags}")
    lons, lats, dist = np.array([0.0, 0.0]), np.array([0.0, 0.001]), np.array([0.0, 111.32])
    got = route_crossings([[-0.001, 0.0005], [0.001, 0.0005]], lons, lats, dist)
    if len(got) != 1 or abs(got[0] - 55.66) > 0.01:
        failures.append(f"crossing at {got}")
    # a track that shares a node with the line: one crossing, not one per segment pair
    if len(route_crossings([[-0.001, 0.0], [0.0, 0.0005], [0.001, 0.0]], np.array([0.0, 0.0, 0.0]), np.array([0.0, 0.0005, 0.001]), np.array([0.0, 55.66, 111.32]))) != 1:
        failures.append("a shared node counted twice")
    docs = [{"properties": {"id": "way/9", "tags": {"building": "yes"}}}, {"properties": {"id": "way/10", "tags": {"building": "yes"}}}]
    if apply_ruins(docs, {"way/9": "ruins", "way/10": "yes"}) != ["way/9"] or docs[0]["properties"]["tags"]["building"] != "ruins":
        failures.append("apply_ruins")
    from build_section_data import minimise_tags
    m = minimise_tags([{"type": "Feature", "properties": {"id": "way/9", "tags": {"building": "yes", "ruins": "yes", "name": "x"}}, "geometry": {"type": "Polygon", "coordinates": []}}, ex[0]])
    if m[0]["properties"]["tags"] != {"building": "ruins"} or m[1]["properties"]["tags"] != ex[0]["properties"]["tags"]:
        failures.append(f"minimise_tags keeps ruins and the extras' tags: {[x['properties']['tags'] for x in m]}")
    for f in failures:
        print("FAIL", f)
    print("self-test:", "ok" if not failures else f"{len(failures)} failure(s)")
    return 0 if not failures else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--section", choices=GROUND + ["corridor"])
    ap.add_argument("--offline", action="store_true", help="re-register the extras already in the window's osm.geojson")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        sys.exit(self_test())
    if not a.section:
        ap.error("--section <id> or --self-test")
    main(a.section, offline=a.offline)
