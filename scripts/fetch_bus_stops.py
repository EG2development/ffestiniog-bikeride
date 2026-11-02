"""The real bus stops near the line, from OpenStreetMap: where the community film shows cycling meeting the bus.

  python scripts/fetch_bus_stops.py              network: api.openstreetmap.org (the corridor's bbox, in tiles)
  python scripts/fetch_bus_stops.py --self-test  no network

Writes data/bus-stops.json: every node tagged highway=bus_stop within MARGIN_M of the trackbed, with its OSM id, name,
position, route distance and offset, and only the tags the film reads (name, shelter, bench). Stops are existing
infrastructure (ODbL); any cycle parking drawn beside one is a proposal, recorded with the film's props, not here.
"""
import argparse
import datetime
import json
import math
import os
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fetch_photo_refs import load_route, snap  # noqa: E402
from osm.fetch_bbox import _fetch  # noqa: E402

ROOT = os.path.dirname(HERE)
MARGIN_M = 600
KEEP = ("name", "shelter", "bench")
OUT = "data/bus-stops.json"


def stops_in(root):
    """Bus-stop nodes of an OSM API map response, as (id, lon, lat, tags)."""
    for n in root.findall("node"):
        tags = {t.get("k"): t.get("v") for t in n.findall("tag")}
        if tags.get("highway") == "bus_stop":
            yield f"node/{n.get('id')}", float(n.get("lon")), float(n.get("lat")), tags


def main():
    route = load_route()
    lons, lats, _ = route
    pad_lat = MARGIN_M / 111320
    pad_lon = MARGIN_M / (111320 * math.cos(math.radians(sum(lats) / len(lats))))
    lon0, lon1, lat0, lat1 = min(lons) - pad_lon, max(lons) + pad_lon, min(lats) - pad_lat, max(lats) + pad_lat
    found = {}
    n = 6
    for i in range(n):
        for j in range(n):
            a, b = lon0 + (lon1 - lon0) * i / n, lat0 + (lat1 - lat0) * j / n
            for sid, lon, lat, tags in stops_in(_fetch(a, b, a + (lon1 - lon0) / n, b + (lat1 - lat0) / n)):
                found[sid] = (lon, lat, tags)
    stops = []
    for sid, (lon, lat, tags) in found.items():
        d, off, _ = snap(route, lon, lat)
        if off <= MARGIN_M:
            stops.append({"id": sid, "name": tags.get("name"), "lon": round(lon, 7), "lat": round(lat, 7), "routeM": round(d), "offsetM": round(off),
                          "tags": {k: tags[k] for k in KEEP if k in tags}})
    stops.sort(key=lambda s: s["routeM"])
    out = {"description": f"OpenStreetMap bus stops (highway=bus_stop) within {MARGIN_M} m of the trackbed: existing infrastructure.",
           "source": "© OpenStreetMap contributors, ODbL 1.0, via api.openstreetmap.org/api/0.6/map", "fetched": datetime.date.today().isoformat(), "stops": stops}
    with open(os.path.join(ROOT, OUT), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {OUT}: {len(stops)} stops")


def self_test():
    xml = ('<osm><node id="1" lon="-3.9" lat="52.9"><tag k="highway" v="bus_stop"/><tag k="name" v="Sgwâr"/></node>'
           '<node id="2" lon="-3.9" lat="52.9"><tag k="amenity" v="bench"/></node></osm>')
    got = list(stops_in(ET.fromstring(xml)))
    assert got == [("node/1", -3.9, 52.9, {"highway": "bus_stop", "name": "Sgwâr"})], got
    print("self-test ok")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--self-test", action="store_true")
    if ap.parse_args().self_test:
        self_test()
    else:
        main()
