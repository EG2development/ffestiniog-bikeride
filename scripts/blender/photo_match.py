"""Matched cameras: renders the dressed reel from where real photographs were taken, beside each photograph.

    blender --background out/blender/master/reel-dressed.blend --python scripts/blender/photo_match.py -- <out dir> [photo id ...]

With no ids it takes the camera-match candidates of data/photo-references.json (scripts/fetch_photo_refs.py) for every
ground section the reel has. Each camera stands at the photo's camera position, EYE_M above the terrain mesh, facing the
photo's heading (camera to subject) with a level horizon, and uses the photo's 35 mm-equivalent lens when its EXIF gives
one (else ASSUMED_35MM). The photograph's Commons thumbnail is fetched into <out dir>/ref/ for this comparison only; it
keeps its licence (CC BY-SA mostly) and credit, which <out dir>/matches.json records beside each side-by-side.
"""
import json
import math
import sys
import urllib.request
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
USER_AGENT = "ffestiniog-bikeride-concept-video/1.0 (contact: eray4793@gmail.com)"
EYE_M = 1.6
ASSUMED_35MM = 35
HEIGHT_PX = 540
PER_SECTION = 4
BRIDGE_SNAP_M = 25
STANDABLE = ("trail", "roads", "bridge")  # a section's meshes (manifest "meshes") a camera may stand on


def projection():
    """lon/lat -> route-projection world units, as src/data/route.ts buildProjection (ADR 5)."""
    coords = json.loads((ROOT / "data/railway-route.geojson").read_text())["features"][0]["geometry"]["coordinates"]
    lon_c = sum(c[0] for c in coords) / len(coords)
    lat_c = sum(c[1] for c in coords) / len(coords)
    k_lon, k_lat = 111320 * math.cos(math.radians(lat_c)), 111320
    first = ((coords[0][0] - lon_c) * k_lon, (coords[0][1] - lat_c) * k_lat)
    last = ((coords[-1][0] - lon_c) * k_lon, (coords[-1][1] - lat_c) * k_lat)
    a = -math.atan2(last[1] - first[1], last[0] - first[0])
    cos_a, sin_a = math.cos(a), math.sin(a)

    def project(lon, lat):
        mx, my = (lon - lon_c) * k_lon, (lat - lat_c) * k_lat
        return (mx * cos_a - my * sin_a) / 10, -(mx * sin_a + my * cos_a) / 10
    return project


def to_blender(project, origin, lon, lat):
    """Plan position in a section scene (the manifest's forward transform: bx = 10 (x - x0), by = -10 (z - z0))."""
    x, z = project(lon, lat)
    return 10 * (x - origin["x0"]), -10 * (z - origin["z0"])


def offset(lon, lat, heading_deg, metres):
    h = math.radians(heading_deg)
    return (lon + metres * math.sin(h) / (111320 * math.cos(math.radians(lat))), lat + metres * math.cos(h) / 111320)


def ground_z(scene, terrain, x, y):
    """Height of what a photographer can stand on at (x, y): the first terrain, trail, road or bridge hit, passing
    through trees, roofs, walls and people. Many Geograph views of the trackbed are taken from its overbridges."""
    bpy.context.window.scene = scene  # the depsgraph must be the section's own, not the open (master) scene's
    dg = bpy.context.evaluated_depsgraph_get()
    z = 5000.0
    for _ in range(50):
        hit, loc, _n, _i, obj, _m = scene.ray_cast(dg, Vector((x, y, z)), Vector((0, 0, -1)))
        if not hit:
            return None, None
        if obj.name == terrain.name or obj.name.split(":")[-1].startswith(STANDABLE):
            return loc.z, obj.name.split(":")[-1]
        z = loc.z - 0.01
    return None, None


def onto_bridge(scene, terrain, x, y, ux, uy):
    """A bridge deck within BRIDGE_SNAP_M along the line of sight (either way), nearest first, or None.
    Geograph camera positions come from grid references, often good to 10-100 m only, and a photo looking along the
    trackbed from above was nearly always taken from the overbridge the plotted point falls short of."""
    for k in range(0, 2 * BRIDGE_SNAP_M + 1):
        s = (k + 1) // 2 * (1 if k % 2 else -1)
        z, name = ground_z(scene, terrain, x + ux * s, y + uy * s)
        if name and name.startswith("bridge"):
            return x + ux * s, y + uy * s, z, abs(s)
    return None


def fetch(url, path):
    if not path.exists():
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as r:
            path.write_bytes(r.read())
    return path


def pixels(img, height):
    """RGBA float array of an image scaled to `height`, top row first."""
    w = round(img.size[0] * height / img.size[1])
    img.scale(w, height)
    a = np.empty(w * height * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(height, w, 4)


def side_by_side(ref_path, render_path, out_path):
    ref = bpy.data.images.load(str(ref_path))
    ren = bpy.data.images.load(str(render_path))
    ref.colorspace_settings.name = ren.colorspace_settings.name = "sRGB"
    a, b = pixels(ref, HEIGHT_PX), pixels(ren, HEIGHT_PX)
    gap = np.ones((HEIGHT_PX, 8, 4), dtype=np.float32)
    both = np.concatenate([a, gap, b], axis=1)
    out = bpy.data.images.new("side-by-side", both.shape[1], HEIGHT_PX, alpha=False)
    out.pixels.foreach_set(both.ravel())
    out.filepath_raw, out.file_format = str(out_path), "PNG"
    out.save()
    for im in (ref, ren, out):
        bpy.data.images.remove(im)


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    out = Path(args[0]).resolve()
    (out / "ref").mkdir(parents=True, exist_ok=True)
    cat = json.loads((ROOT / "data/photo-references.json").read_text(encoding="utf8"))
    photos = {p["id"]: p for p in cat["photos"]}
    scenes = {s.name.split(":")[0]: s for s in bpy.data.scenes if ":" in s.name}
    ids = args[1:] or [i for sec, m in cat["matrix"].items() if sec in scenes for i in m["camera_match_candidates"][:PER_SECTION]]
    project = projection()
    log = []
    for pid in ids:
        p = photos[pid]
        sec = p["section"]
        scene = scenes.get(sec)
        if scene is None or p["heading_deg"] is None:
            print("SKIP", pid, "no reel scene" if scene is None else "no heading")
            continue
        origin = json.loads((ROOT / "out/blender/exports" / sec / "manifest.json").read_text())["coordinates"]["origin"]
        lon, lat = p["location"]["lon"], p["location"]["lat"]
        x, y = to_blender(project, origin, lon, lat)
        tx, ty = to_blender(project, origin, *offset(lon, lat, p["heading_deg"], 100))
        terrain = bpy.data.objects[f"{sec}:terrain"]
        gz, _on = ground_z(scene, terrain, x, y)
        if gz is None:
            print("SKIP", pid, "outside the terrain window")
            continue
        moved = 0
        if p["along_trackbed"]:
            u = Vector((tx - x, ty - y)).normalized()
            deck = onto_bridge(scene, terrain, x, y, u.x, u.y)
            if deck:
                x, y, gz, moved = deck
        ref = fetch(p["thumbnail"], out / "ref" / f"{pid.replace(':', '-')}.jpg")
        probe = bpy.data.images.load(str(ref))
        aspect = probe.size[0] / probe.size[1]
        bpy.data.images.remove(probe)

        cd = bpy.data.cameras.new("photo-match")
        cd.clip_end, cd.sensor_fit, cd.sensor_width = 8000, "HORIZONTAL", 36
        f35 = (p["lens"] or {}).get("focal_35mm") or ASSUMED_35MM
        # the 35 mm equivalent is defined on the 43.3 mm diagonal; across a 4:3 frame that is 34.6 mm, across 3:2, 36 mm
        cd.lens = f35 * (2 * 21.65 * aspect / math.hypot(aspect, 1)) / 36
        cam = bpy.data.objects.new("photo-match", cd)
        scene.collection.objects.link(cam)
        scene.camera = cam
        for m in list(scene.timeline_markers):
            scene.timeline_markers.remove(m)
        cam.location = Vector((x, y, gz + EYE_M))
        cam.rotation_euler = Vector((tx - x, ty - y, 0)).to_track_quat("-Z", "Y").to_euler()
        scene.render.resolution_x, scene.render.resolution_y = round(HEIGHT_PX * aspect), HEIGHT_PX
        scene.render.resolution_percentage = 100
        scene.render.image_settings.media_type = "IMAGE"
        scene.render.image_settings.file_format = "PNG"
        scene.frame_set(scene.frame_start)
        name = pid.replace(":", "-")
        scene.render.filepath = str(out / f"{name}_render.png")
        bpy.ops.render.render(write_still=True, scene=scene.name)
        side_by_side(ref, out / f"{name}_render.png", out / f"{name}_compare.png")
        bpy.data.objects.remove(cam)
        log.append({"id": pid, "section": sec, "compare": f"{name}_compare.png", "title": p["title"], "date": p["date"],
                    "source": p["source"], "photographer": p["photographer"], "licence": p["licence"],
                    "licence_url": p["licence_url"], "camera": {"x": round(x, 2), "y": round(y, 2), "z": round(gz + EYE_M, 2),
                    "heading_deg": p["heading_deg"], "focal_35mm": f35, "lens_assumed": not p["lens"],
                    "moved_onto_bridge_m": moved}})
        print("MATCH", pid, sec, p["title"][:60])
    (out / "matches.json").write_text(json.dumps(log, indent=1, ensure_ascii=False), encoding="utf8")
    print("MATCHES", len(log))


main()
