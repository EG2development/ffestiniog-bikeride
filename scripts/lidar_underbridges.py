"""Railway underbridges the lidar shows and OSM lacks (data/lidar-underbridges.json): the line's deck over a farm track.

  python scripts/lidar_underbridges.py --measure     network: the lidar DTM and DSM COGs; prints each entry's notch
  python scripts/lidar_underbridges.py --register    no network; writes the adopted ones into data/features-<window>.json
  python scripts/lidar_underbridges.py --self-test   no network

A bare-earth DTM drops a bridge's deck to the ground beneath, so where the line crossed a track on a bridge the lidar
shows a notch through the embankment, while the DSM (first returns) keeps the deck at the crest. Without the bridge in
the data the trail sagged into the notch and the corridor reported a fill. build_section_data.py adds each adopted span
to the window's profile bridges, so the trail keeps its level across it and the ground under it is left alone (the
track beneath); --register adds a "bridge-<window>-lidar-<km>" structure, drawn as a generic deck like the OSM bridges.
The Gwynedd Council map captures (docs/new-images/, Crown copyright) corroborate them; they are evidence only and
nothing is taken from them (data/source-register.md).
"""
import argparse
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_poc_data import ROOT  # noqa: E402

PATH = os.path.join(ROOT, "data/lidar-underbridges.json")
# the ground windows of build_section_data.SECTIONS (which imports this module, so they are not imported from it)
WINDOWS ={"blaenau": (0, 1500), "vale-north": (1500, 4800), "vale-south": (4800, 7700), "maentwrog": (7700, 9700), "trawsfynydd": (9700, 13240)}
SCENES = {w: ["Reel3D", f"Section-{w}"] for w in WINDOWS}


def write_json(rel, obj, indent=None):
    """build_poc_data.write_json with LF line ends on every platform."""
    with open(os.path.join(ROOT, rel), "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, indent=indent, allow_nan=False)
        f.write("\n")


def load(path=PATH):
    return json.load(open(path, encoding="utf-8"))["underbridges"] if os.path.exists(path) else []


def underbridge_spans(s0, s1, path=PATH):
    """[[from m, to m, "lidar/<id>"]] for each adopted underbridge overlapping the stretch [s0, s1] m."""
    return [[u["fromKm"] * 1000, u["toKm"] * 1000, f"lidar/{u['id']}"] for u in load(path)
            if u["status"] == "adopted" and u["toKm"] * 1000 >= s0 and u["fromKm"] * 1000 <= s1]


def owns(entry):
    """True for a register entry --register writes (build_section_data.keep_owned keeps them on a rebuild)."""
    return entry.get("kind") == "structure" and entry.get("source", {}).get("type") == "lidar-dtm"


def register_entries(window, items):
    s0, s1 = WINDOWS[window]
    out = []
    for u in items:
        if u["status"] != "adopted" or u["toKm"] * 1000 < s0 or u["fromKm"] * 1000 > s1:
            continue
        out.append({"id": f"bridge-{window}-lidar-{u['centreKm']:.3f}", "kind": "structure", "category": "approximate",
                    "source": {"type": "lidar-dtm", "ref": f"data/lidar-underbridges.json#{u['id']}"}, "scenes": SCENES[window],
                    "fromKm": u["fromKm"], "toKm": u["toKm"],
                    "note": f"underbridge over {u['carries']}; not in OSM; lidar DTM notch {u['dtmDipM']} m with the DSM at the crest over it; "
                            "generic deck and parapets" + (f"; replaces {u['replaces']}" if u.get("replaces") else "")})
    return out


def register(path=PATH):
    items = load(path)
    for w in WINDOWS:
        reg = os.path.join(ROOT, f"data/features-{w}.json")
        existing = json.load(open(reg, encoding="utf-8"))
        entries = register_entries(w, items)
        if not entries and not any(owns(e) for e in existing):
            continue
        write_json(f"data/features-{w}.json", [e for e in existing if not owns(e)] + entries, indent=2)
        print(f"{w}: {len(entries)} lidar underbridge(s): {', '.join(e['id'] for e in entries)}")


def notch(ds, h, threshold_m=1.0, ends_m=10):
    """(extent [a, b] m where the centreline is more than threshold below the chord between the window's ends, deepest
    dip m, floor m, crest m) for heights h at distances ds; extent None without a notch."""
    lo, hi = np.nanmedian(h[:ends_m]), np.nanmedian(h[-ends_m:])
    dip = np.interp(ds, [ds[0], ds[-1]], [lo, hi]) - h
    deep = ds[dip > threshold_m]
    i = int(np.nanargmax(dip))
    return ([float(deep.min()), float(deep.max())] if deep.size else None), float(dip[i]), float(h[i]), float(np.interp(ds[i], [ds[0], ds[-1]], [lo, hi]))


def measure(path=PATH, half_m=60):
    from bridge_ground import centreline_dtm
    from build_poc_data import LIDAR_URL, load_route
    from dem.cog import Cog
    lons, lats, dist = load_route()
    dtm, dsm = Cog(LIDAR_URL), Cog(LIDAR_URL.replace("wales_dtm_32bit_cog.tif", "wales_dsm_32bit_cog.tif"))
    for u in load(path):
        c = u["centreKm"] * 1000
        ds = np.arange(c - half_m, c + half_m + 0.5, 1.0)
        extent, dip, floor, crest = notch(ds, centreline_dtm(dtm, ds, lons, lats, dist))
        if extent is None:
            print(f"{u['id']}: no notch deeper than 1 m within {half_m} m")
            continue
        mid = np.arange(math.floor(extent[0]), math.ceil(extent[1]) + 1, 1.0)
        top = centreline_dtm(dsm, mid, lons, lats, dist)
        print(f"{u['id']} ({u['status']}): notch {extent[0]:.0f}-{extent[1]:.0f} m, dip {dip:.2f} m, floor {floor:.2f} m, crest {crest:.2f} m; "
              f"DSM over the notch median {np.nanmedian(top):.2f} m (min {np.nanmin(top):.2f})")


def self_test():
    failures = []
    ds = np.arange(0.0, 41.0, 1.0)
    h = np.full(ds.shape, 180.0)
    h[18:23] = [179.5, 177.0, 176.0, 177.2, 179.4]
    extent, dip, floor, _crest = notch(ds, h)
    if extent != [19.0, 21.0] or abs(dip - 4.0) > 1e-9 or floor != 176.0:
        failures.append(f"notch {extent} {dip} {floor}")
    import tempfile
    doc = {"underbridges": [
        {"id": "u-1", "status": "adopted", "centreKm": 6.308, "fromKm": 6.3, "toKm": 6.316, "carries": "a track", "dtmDipM": 4.2, "replaces": "earthwork-fill-6.309"},
        {"id": "u-2", "status": "uncertain", "centreKm": 9.0, "fromKm": 8.99, "toKm": 9.01, "carries": "a track", "dtmDipM": 1.0}]}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(doc, fh)
    try:
        if underbridge_spans(4800, 7700, fh.name) != [[6300.0, 6316.0, "lidar/u-1"]] or underbridge_spans(7700, 9700, fh.name) != []:
            failures.append("spans: only adopted ones in the window")
        entries = register_entries("vale-south", load(fh.name))
        if [e["id"] for e in entries] != ["bridge-vale-south-lidar-6.308"] or not owns(entries[0]) or "earthwork-fill-6.309" not in entries[0]["note"]:
            failures.append(f"register entries {entries}")
        if owns({"id": "terrain-x", "kind": "terrain", "source": {"type": "lidar-dtm"}}):
            failures.append("the terrain entry is not an underbridge")
    finally:
        os.unlink(fh.name)
    for f in failures:
        print("FAIL", f)
    print("self-test:", "ok" if not failures else f"{len(failures)} failure(s)")
    return 0 if not failures else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--measure", action="store_true")
    ap.add_argument("--register", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        sys.exit(self_test())
    if a.measure:
        measure()
    if a.register:
        register()
    if not (a.measure or a.register):
        ap.error("--measure, --register or --self-test")
