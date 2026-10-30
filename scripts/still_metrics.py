"""Metrics on stills and their measurement masks (docs/pseudocode-reel-v2.md §4.3; spec WA6, WA7, CL2, CL3, CL4, CL6).

  python3 -I scripts/still_metrics.py <after dir> [<before dir>]    prints one JSON report
  python3 -I scripts/still_metrics.py --self-test                   synthetic checks, no stills needed

Each directory is a `scripts/stills.mjs` output: <id>_<frame>.png, its masks <id>_<frame>_<mask>.png and manifest.json.
Extras that stills.mjs also writes, all without captions: <id>_<frame>_clean.png, <id>_<frame>_nowater.png (water
hidden, WA6) and <id>_<frame+1>.png with its water mask (WA7). The water metrics use the clean frames, so no caption
box over the water counts as a speck; the other metrics use the normal still, as the viewer sees it. A mask pixel counts when its luma is above 127. Thresholds are the spec's; a metric whose
region is too small to measure is reported as null, never as a pass.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

MIN_PX = 2000  # smallest region measured: about 0.1 % of a 1920 x 1080 frame
GROUND = {"blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"}


def rgb(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)


def luma(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


LISTED = set()  # the files the manifest lists: anything else in the folder (an older run's leftovers) is never read (t10)


def exists(path):
    return os.path.abspath(path) in LISTED if LISTED else os.path.exists(path)


def mask(path):
    return luma(rgb(path)) > 127 if exists(path) else None


def lab(a):
    """sRGB (0-255) to CIE Lab (D65)."""
    c = a / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T
    xyz = xyz / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def delta_e(a, b):
    return float(np.sqrt(((np.asarray(a) - np.asarray(b)) ** 2).sum(axis=-1)))


def dilate(m, r):
    """Square dilation by r pixels, separable, with sliding windows."""
    out = m
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (r, r)
        p = np.pad(out, pad)
        out = np.lib.stride_tricks.sliding_window_view(p, 2 * r + 1, axis=axis).max(axis=-1)
    return out


def hue_sat(a):
    hsv = np.asarray(Image.fromarray(a.astype(np.uint8)).convert("HSV"), dtype=np.float64)
    return hsv[..., 0] * 360 / 255, hsv[..., 1] / 255


def circular_mean_deg(h):
    r = np.deg2rad(h)
    return float(np.rad2deg(np.arctan2(np.sin(r).mean(), np.cos(r).mean())) % 360)


def wa6(n, nowater, expected, drawn):
    """Water drawn where expected (islands excluded by the mesh's holes), and it changes the frame there."""
    if expected is None or expected.sum() < MIN_PX:
        return None
    out = {"expectedPx": int(expected.sum()), "coverage": float((expected & drawn).sum() / expected.sum())}
    if nowater is not None:
        out["meanDiff"] = float(np.abs(n - nowater).mean(axis=-1)[expected].mean())
    out["ok"] = out["coverage"] >= 0.95 and out.get("meanDiff") is not None and out["meanDiff"] > 8  # unmeasured is not a pass (t10)
    return out


def wa7(n, water):
    """Terrain-coloured specks inside the water: pixels far (ΔE76 > 25) from the water's median colour."""
    if water is None or water.sum() < MIN_PX:
        return None
    w = lab(n[water])
    med = np.median(w, axis=0)
    share = float((np.sqrt(((w - med) ** 2).sum(axis=-1)) > 25).mean())
    return {"waterPx": int(water.sum()), "specks": share, "ok": share <= 0.01}


def shade_luma(n, trees, sun):
    """Median luma of tree pixels on the side away from the sun: lit by the sun alone, they are black."""
    if trees is None or sun is None:
        return None
    s = trees & (luma(sun) < 10)
    return float(np.median(luma(n)[s])) if s.sum() >= MIN_PX else None


def cl4(n, trail, roads, terrain):
    if trail is None or trail.sum() < MIN_PX:
        return None
    band = dilate(trail, 20) & ~trail
    t = lab(n[trail]).mean(axis=0)
    out = {}
    for name, m in (("roads", roads), ("terrain", terrain)):
        region = band & m if m is not None else None
        out[name] = None if region is None or region.sum() < 200 else delta_e(t, lab(n[region]).mean(axis=0))
    out["ok"] = all(v is None or v >= 20 for v in (out["roads"], out["terrain"])) and out["terrain"] is not None
    return out


def report(after, before=None):
    stills = json.load(open(os.path.join(after, "manifest.json")))["stills"]
    root = os.path.dirname(os.path.dirname(os.path.abspath(after.rstrip("/"))))
    LISTED.clear()
    LISTED.update(os.path.abspath(os.path.join(root, s["file"])) for s in stills)
    if before and os.path.exists(os.path.join(before, "manifest.json")):
        LISTED.update(os.path.abspath(os.path.join(root, s["file"])) for s in json.load(open(os.path.join(before, "manifest.json")))["stills"])
    out = {"stills": {}, "terrain": {"ground": [], "aerial": []}}
    for s in [s for s in stills if s["mask"] is None and not s.get("extra")]:
        key = f"{s['id']}_{s['frame']}"
        p = lambda d, m=None: os.path.join(d, f"{key}{'_' + m if m else ''}.png")  # noqa: E731
        n = rgb(p(after))
        m = {k: mask(p(after, k)) for k in ("trees", "trees-sun", "trail", "roads", "terrain", "water", "water-expected", "buildings")}
        sun = rgb(p(after, "trees-sun")) if exists(p(after, "trees-sun")) else None
        r = {}
        nowater = rgb(p(after, "nowater")) if exists(p(after, "nowater")) else None
        clean = rgb(p(after, "clean")) if exists(p(after, "clean")) else n
        r["WA6"] = wa6(clean, nowater, m["water-expected"], m["water"] if m["water"] is not None else np.zeros(n.shape[:2], bool))
        r["WA7"] = wa7(clean, m["water"])
        nxt = os.path.join(after, f"{s['id']}_{s['frame'] + 1}.png")
        if r["WA7"] and exists(nxt):
            r["WA7next"] = wa7(rgb(nxt), mask(os.path.join(after, f"{s['id']}_{s['frame'] + 1}_water.png")))
        if s["id"] in GROUND:
            r["CL4"] = cl4(n, m["trail"], m["roads"], m["terrain"])
            r["shadeLuma"] = shade_luma(n, m["trees"], sun)
        lum = luma(n)
        r["meanLuma"] = float(lum.mean())
        r["clipped"] = float((lum >= 250).mean())
        if before and exists(p(before)):
            nb = rgb(p(before))
            lb = luma(nb)
            r["CL3"] = {"before": float(lb.mean()), "change": float(abs(lum.mean() - lb.mean()) / lb.mean()), "clipped": r["clipped"]}
            r["CL3"]["ok"] = r["CL3"]["change"] <= 0.10 and r["clipped"] <= 0.01
            if s["id"] in GROUND:
                sb = shade_luma(nb, mask(p(before, "trees")), rgb(p(before, "trees-sun")) if exists(p(before, "trees-sun")) else None)
                if sb and r["shadeLuma"]:
                    r["CL2"] = {"before": sb, "after": r["shadeLuma"], "ratio": r["shadeLuma"] / sb, "ok": r["shadeLuma"] / sb >= 1.2}
        if m["terrain"] is not None and m["terrain"].sum() >= MIN_PX:
            h, sat = hue_sat(n)
            out["terrain"]["ground" if s["id"] in GROUND else "aerial"].append({"still": key, "hue": circular_mean_deg(h[m["terrain"]]), "sat": float(sat[m["terrain"]].mean())})
        out["stills"][key] = r
    g, a = out["terrain"]["ground"], out["terrain"]["aerial"]
    if g and a:
        gh, gs = circular_mean_deg(np.array([x["hue"] for x in g])), float(np.mean([x["sat"] for x in g]))
        ah, as_ = circular_mean_deg(np.array([x["hue"] for x in a])), float(np.mean([x["sat"] for x in a]))
        dh = abs((ah - gh + 180) % 360 - 180)
        out["CL6"] = {"groundHue": gh, "aerialHue": ah, "hueChange": dh / gh, "groundSat": gs, "aerialSat": as_, "satChange": abs(as_ - gs) / gs}
        out["CL6"]["ok"] = out["CL6"]["hueChange"] <= 0.15 and out["CL6"]["satChange"] <= 0.15
    return out


def self_test():
    failures = []
    green = np.zeros((60, 80, 3))
    green[...] = (60, 110, 50)
    water = np.zeros((60, 80), bool)
    water[10:50, 10:70] = True
    n = green.copy()
    n[water] = (44, 86, 114)
    if not wa7(n, water)["ok"] or wa6(n, green, water, water)["coverage"] != 1.0:
        failures.append("clean water should pass WA6 and WA7")
    specked = n.copy()
    specked[12:20, 12:40] = (60, 110, 50)  # 224 px of terrain showing through
    if wa7(specked, water)["ok"]:
        failures.append("WA7 must catch terrain specks")
    half = water.copy()
    half[:, 40:] = False
    if wa6(n, green, water, half)["ok"]:
        failures.append("WA6 must fail when half the expected water is missing")
    if wa6(n, None, water, water)["ok"]:
        failures.append("WA6 must not pass when the no-water still is missing (t10)")
    if wa6(n, n, water, water)["ok"]:
        failures.append("WA6 must fail when hiding the water changes nothing")
    trail = np.zeros((60, 80), bool)
    trail[:, 38:42] = True
    beige = green.copy()
    beige[trail] = (190, 160, 100)
    r = cl4(beige, trail, None, ~trail)
    if not (r and r["ok"] and r["terrain"] >= 20):
        failures.append(f"CL4 should pass a beige trail on green: {r}")
    same = green.copy()
    if cl4(same, trail, None, ~trail)["ok"]:
        failures.append("CL4 must fail a trail the colour of the terrain")
    if not dilate(trail, 2)[:, 36:44].all() or dilate(trail, 2)[:, :35].any():
        failures.append("dilate by 2 px")
    for f in failures:
        print("FAIL", f)
    print("self-test:", "ok" if not failures else f"{len(failures)} failure(s)")
    return 0 if not failures else 1


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        MIN_PX = 100
        sys.exit(self_test())
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit("usage: still_metrics.py <after dir> [<before dir>] | --self-test")
    print(json.dumps(report(args[0], args[1] if len(args) > 1 else None), indent=1))
