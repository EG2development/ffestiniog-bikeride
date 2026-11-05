"""Renders the film's master (the Reel scene of a build_reel.py file) to PNG frames, resumably (review 2026-11-05):

    blender --background <master.blend> --python-exit-code 1 --python scripts/blender/render_film.py -- <frames dir> [--from 1 --to 5400]

Frames go to <frames dir>/f_####.png at the master's full size; frames already there are kept (use_overwrite off, with
placeholders), so a stopped render resumes and a changed scene can be re-rendered over its own range alone. The film is
then encoded from the frames with its soundtrack by scripts/film/encode.mjs, which checks every frame is present.
"""
import sys
import time
from pathlib import Path

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
out = Path(args[0]).resolve()  # absolute: Blender resolves a bare relative path against the drive root, not the cwd
opt = lambda name, fallback: args[args.index(name) + 1] if name in args else fallback  # noqa: E731
master = bpy.data.scenes["Reel"]
lo, hi = int(opt("--from", master.frame_start)), int(opt("--to", master.frame_end))
out.mkdir(parents=True, exist_ok=True)
for sc in bpy.data.scenes:
    sc.render.resolution_percentage = 100
r = master.render
r.resolution_x, r.resolution_y = 1920, 1080
s = r.image_settings
if hasattr(s, "media_type"):
    s.media_type = "IMAGE"
s.file_format = "PNG"
s.color_mode = "RGB"
s.color_depth = "8"
s.compression = 15
r.use_file_extension = True
r.use_overwrite = False
r.use_placeholder = True
r.filepath = str(out / "f_")
master.frame_start, master.frame_end = lo, hi
print(f"RENDER {lo}-{hi} -> {r.filepath}####.png", flush=True)
t = time.time()
bpy.ops.render.render(animation=True, scene="Reel")
print(f"RENDER DONE {hi - lo + 1} frames in {time.time() - t:.0f} s", flush=True)
