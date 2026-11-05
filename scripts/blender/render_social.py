"""Renders the social cuts' plates (src/data/social-cuts.ts, via out/social/plan.json) from the community film's dressed
master, clean (the captions are Remotion's), at each format's own aspect ratio and resolution:

    blender --background out/blender/master/community-dressed-v8-render.blend --python scripts/blender/render_social.py -- <plan.json> <out dir> [--format vertical] [--plate id] [--preview]

The master is opened and changed only in memory, never saved, so the 3-minute film stays exactly as it is. Each plate is
the film's own scene and camera move, reframed natively rather than cropped: the camera keeps the share of the master's
horizontal view the plan gives (a vertical frame keeps half, so people read larger and the view runs tall), turns by
the plan's pan about the vertical, and shifts its lens to place the horizon. The finish is the film's, sharpened for
phones: twice the anti-aliasing samples, a narrower pixel filter, a 126-degree shutter instead of 180 so the near verges
smear less while legs and wheels still move smoothly, and f/5.6 instead of f/4. The grade is the film's own (finish.py),
so a cut matches the film shot for shot.

Frames are written as PNG, numbered by the scene's Blender frame, to <out dir>/<format>/<plate>/; frames already on
disk are skipped, so an interrupted render resumes. --preview writes the first, middle and last frame of each plate at
40 % and 8 samples to <out dir>/preview/<format>/ instead, for checking the framing.
"""
import json
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Quaternion

QUALITY = {"samples": 48, "filter_px": 1.25, "shutter": 0.35, "fstop": 5.6}
MASTER_W, MASTER_H = 1920, 1080


def frame_cameras(scene, w, h, framing):
    """Reframe every camera of the scene for a w x h frame: the plan's share of the master's horizontal view, its pan
    about the world's vertical, and its lens shift."""
    for o in scene.objects:
        if o.type != "CAMERA":
            continue
        cd = o.data
        if "social_angle0" not in cd:
            cd["social_angle0"] = cd.angle  # the master's vertical field of view (sensor fit VERTICAL)
        tan_h = math.tan(cd["social_angle0"] / 2) * MASTER_W / MASTER_H * framing["share"]
        cd.sensor_fit = "VERTICAL"
        cd.angle = 2 * math.atan(tan_h * h / w)
        cd.shift_x, cd.shift_y = framing["shiftX"], framing["shiftY"]
        if cd.dof.use_dof:
            cd.dof.aperture_fstop = QUALITY["fstop"]
        o.rotation_mode = "QUATERNION"
        # a delta rotation applies in the parent's (here the world's) frame: about Z it pans, keeping the horizon level
        o.delta_rotation_quaternion = Quaternion((0, 0, 1), math.radians(framing["pan"]))


def setup(scene, w, h, preview):
    r = scene.render
    r.resolution_x, r.resolution_y = w, h
    r.resolution_percentage = 40 if preview else 100
    scene.eevee.taa_render_samples = 8 if preview else QUALITY["samples"]
    r.filter_size = QUALITY["filter_px"]
    r.motion_blur_shutter = QUALITY["shutter"]
    s = r.image_settings
    if hasattr(s, "media_type"):
        s.media_type = "IMAGE"
    s.file_format = "PNG"
    s.color_mode = "RGB"
    s.color_depth = "8"
    s.compression = 15
    r.use_file_extension = True
    r.use_overwrite = False  # resume: frames already rendered are kept
    r.use_placeholder = True


def render_plate(fmt, w, h, p, out, preview):
    scene = bpy.data.scenes[f"{p['config']}:{p['config']}"]
    setup(scene, w, h, preview)
    frame_cameras(scene, w, h, p["framing"])
    lo, hi = p["from"] + 1, p["to"]  # Blender frames, inclusive
    if preview:
        for f in sorted({lo, (lo + hi) // 2, hi}):
            scene.frame_start = scene.frame_end = f
            scene.render.filepath = str(out / "preview" / fmt / f"{p['id']}-####")
            bpy.ops.render.render(animation=True, scene=scene.name)
        return
    d = out / fmt / p["id"]
    d.mkdir(parents=True, exist_ok=True)
    scene.frame_start, scene.frame_end = lo, hi
    scene.render.filepath = str(d) + "/####"
    t = time.time()
    bpy.ops.render.render(animation=True, scene=scene.name)
    print(f"PLATE {fmt} {p['id']} {hi - lo + 1} frames {time.time() - t:.0f} s", flush=True)


def main(argv):
    plan, out = json.loads(Path(argv[0]).read_text(encoding="utf8")), Path(argv[1])
    opt = lambda name: argv[argv.index(name) + 1] if name in argv else None  # noqa: E731
    only_fmt, only_plate, preview = opt("--format"), opt("--plate"), "--preview" in argv
    for fmt, spec in plan["formats"].items():
        if only_fmt and fmt != only_fmt:
            continue
        for p in spec["plates"]:
            if only_plate and p["id"] != only_plate:
                continue
            render_plate(fmt, spec["w"], spec["h"], p, out, preview)
    print("SOCIAL PLATES DONE", flush=True)


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:])
