"""Renders chosen frames of a .blend's active scene to PNG stills.

    blender --background <file.blend> --python scripts/blender/render_stills.py -- <out dir> <percent> <frame> [frame ...]
"""
import sys
import time
from pathlib import Path

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
out, percent, frames = Path(args[0]).resolve(), int(args[1]), [int(f) for f in args[2:]]
out.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.get("Reel") or bpy.context.scene  # a reel master renders through its sequencer
scene.render.resolution_percentage = percent
if hasattr(scene.render.image_settings, "media_type"):  # Blender 5 chooses image or video before the format
    scene.render.image_settings.media_type = "IMAGE"
scene.render.image_settings.file_format = "PNG"
for f in frames:
    t = time.time()
    scene.frame_set(f)
    scene.render.filepath = str(out / f"{scene.name.split(':')[-1]}_{f:04d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"STILL {scene.render.filepath} {Path(scene.render.filepath).exists()} {time.time() - t:.1f}s")
