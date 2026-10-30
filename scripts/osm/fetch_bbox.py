# Iteration 2: water relations cut by the box are completed with relation/<id>/full (docs/adr/0042-one-level-per-water-body.md).
"""Fetch OSM data for a bounding box from the OSM API (api/0.6/map) and return GeoJSON-like features.

Overpass mirrors proved unreliable from this environment; the core API works for small boxes
(docs/design-3d.md "Data pipeline"). Each feature: {"type": "Feature", "properties": {"id", "tags"},
"geometry": LineString | Polygon | MultiPolygon} with lon/lat coordinates.
"""
import urllib.request
import xml.etree.ElementTree as ET

USER_AGENT = "ffestiniog-bikeride-concept-video/1.0 (contact: eray4793@gmail.com)"


def _fetch(lon0, lat0, lon1, lat1):
    url = f"https://api.openstreetmap.org/api/0.6/map?bbox={lon0},{lat0},{lon1},{lat1}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        return ET.fromstring(r.read())


def fetch_bbox(lon0, lat0, lon1, lat1, splits=2):
    nodes, ways, rels = {}, {}, {}
    dlon, dlat = (lon1 - lon0) / splits, (lat1 - lat0) / splits
    for i in range(splits):
        for j in range(splits):
            root = _fetch(lon0 + i * dlon, lat0 + j * dlat, lon0 + (i + 1) * dlon, lat0 + (j + 1) * dlat)
            for n in root.findall("node"):
                nodes[n.get("id")] = (float(n.get("lon")), float(n.get("lat")))
            for w in root.findall("way"):
                ways[w.get("id")] = ({t.get("k"): t.get("v") for t in w.findall("tag")}, [nd.get("ref") for nd in w.findall("nd")])
            for r in root.findall("relation"):
                rels[r.get("id")] = ({t.get("k"): t.get("v") for t in r.findall("tag")},
                                     [(m.get("type"), m.get("ref"), m.get("role")) for m in r.findall("member")])
    return nodes, ways, rels


WATER_KEYS = (("natural", "water"), ("waterway", "riverbank"), ("landuse", "reservoir"))


def is_water(tags):
    return any(tags.get(k) == v for k, v in WATER_KEYS)


def fetch_relation_full(rid):
    """The whole relation with every member way and node (api/0.6/relation/<id>/full), so rings cut by a box close."""
    url = f"https://api.openstreetmap.org/api/0.6/relation/{rid}/full"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        root = ET.fromstring(r.read())
    nodes = {n.get("id"): (float(n.get("lon")), float(n.get("lat"))) for n in root.findall("node")}
    ways = {w.get("id"): ({t.get("k"): t.get("v") for t in w.findall("tag")}, [nd.get("ref") for nd in w.findall("nd")]) for w in root.findall("way")}
    rels = {r.get("id"): ({t.get("k"): t.get("v") for t in r.findall("tag")}, [(m.get("type"), m.get("ref"), m.get("role")) for m in r.findall("member")])
            for r in root.findall("relation") if r.get("id") == str(rid)}
    return [f for f in _relation_features(nodes, ways, rels) if f["properties"]["id"] == f"relation/{rid}"] or [None]


def fetch_way_full(wid):
    """One way with its nodes (api/0.6/way/<id>/full), as a feature; for a reused window that lacks it (t10 P-M3)."""
    url = f"https://api.openstreetmap.org/api/0.6/way/{int(wid)}/full"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        root = ET.fromstring(r.read())
    nodes = {n.get("id"): (float(n.get("lon")), float(n.get("lat"))) for n in root.findall("node")}
    ways = {w.get("id"): ({t.get("k"): t.get("v") for t in w.findall("tag")}, [nd.get("ref") for nd in w.findall("nd")]) for w in root.findall("way")}
    return next((f for f in to_features(nodes, ways, {}) if f["properties"]["id"] == f"way/{int(wid)}"), None)


def complete_water_relations(feats):
    """Replaces each water multipolygon relation with its full geometry, islands included (ADR 42)."""
    out = []
    for f in feats:
        pid = f["properties"]["id"]
        if pid.startswith("relation/") and is_water(f["properties"].get("tags", {})):
            full = fetch_relation_full(pid.split("/")[1])[0]
            if full is not None:
                full["properties"]["tags"] = f["properties"]["tags"]
                full["properties"]["completed"] = True
                f = full
        out.append(f)
    return out


def _coords(nodes, refs):
    return [nodes[r] for r in refs if r in nodes]


def _rings(nodes, ways, member_ids):
    """Join member ways end to end into closed rings; drop rings that can't be closed (members outside the box)."""
    segments = [list(_coords(nodes, ways[w][1])) for w in member_ids if w in ways]
    segments = [s for s in segments if len(s) >= 2]
    rings = []
    while segments:
        ring = segments.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for k, s in enumerate(segments):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += s[::-1][1:]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = s[::-1][:-1] + ring
                else:
                    continue
                segments.pop(k)
                changed = True
                break
        if len(ring) >= 4 and ring[0] == ring[-1]:
            rings.append(ring)
    return rings


def to_features(nodes, ways, rels):
    feats = []
    for wid, (tags, refs) in ways.items():
        if not tags:
            continue
        coords = _coords(nodes, refs)
        if len(coords) < 2:
            continue
        closed = refs[0] == refs[-1] and len(coords) >= 4 and len(coords) == len(refs)
        area = closed and "highway" not in tags and "railway" not in tags and "barrier" not in tags
        geom = {"type": "Polygon", "coordinates": [coords]} if area else {"type": "LineString", "coordinates": coords}
        feats.append({"type": "Feature", "properties": {"id": f"way/{wid}", "tags": tags}, "geometry": geom})
    return feats + _relation_features(nodes, ways, rels)


def _relation_features(nodes, ways, rels):
    feats = []
    for rid, (tags, members) in rels.items():
        if tags.get("type") != "multipolygon":
            continue
        outers = _rings(nodes, ways, [ref for t, ref, role in members if t == "way" and role in ("outer", "")])
        inners = _rings(nodes, ways, [ref for t, ref, role in members if t == "way" and role == "inner"])
        if not outers:
            # a water relation whose outer ring the box cuts: kept as a placeholder, so completion fetches it whole (t10 P-M2)
            if is_water(tags):
                feats.append({"type": "Feature", "properties": {"id": f"relation/{rid}", "tags": tags, "inner_rings": [], "incomplete": True},
                              "geometry": {"type": "MultiPolygon", "coordinates": []}})
            continue
        # outer rings as polygons; inner rings (holes) kept beside them so a point test can subtract them
        geom = {"type": "MultiPolygon", "coordinates": [[o] for o in outers]}
        feats.append({"type": "Feature", "properties": {"id": f"relation/{rid}", "tags": tags, "inner_rings": inners},
                      "geometry": geom})
    return feats
