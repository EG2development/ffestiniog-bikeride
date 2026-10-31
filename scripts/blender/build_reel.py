"""Builds the reel's Blender master: one Scene per reel scene plus a master Scene that cuts them together in the Video Sequencer.

    blender --background --factory-startup --python scripts/blender/build_reel.py -- <exports dir> <out .blend> [preview percent] [samples] [--dressed]

The exports dir holds the section packages and reel.json written by `npm run blender:export -- reel`. Every scene is the plain
geographic blockout of import_blockout.py; the master takes exactly the master timeline's frame count from each (the Maentwrog
section is 360 frames, the reel uses 300), and carries the reel's captions as text strips: the "not an approved route" badge,
the credits, the scene captions and each section's legend lines (docs/blender-build-plan.md Phase 6; the three.js overlays in
src/three/Overlays.tsx are the layout reference). With --dressed every scene gets dress.py's realistic materials, vegetation,
sky and people instead.
"""
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_blockout as blockout  # noqa: E402

# Overlays.tsx's layout at 1920 x 1080: the 5 % title-safe area, caption width, and the style tokens (sRGB)
W, H = 1920, 1080
SAFE_X, SAFE_Y = 96, 54
CAPTION_W = 820
ATTRIBUTION_H = 62  # the credits wrap to two lines in Blender's font (one in the browser's), so captions clear two
FADE = 15
STYLE = {
    "caption": dict(size=28, color=(0xF6, 0xF1, 0xE4, 255), box=(30, 32, 24, 0.78 * 255)),
    "badge": dict(size=18, color=(0x2C, 0x2A, 0x26, 255), box=(246, 241, 228, 0.92 * 255)),
    "attribution": dict(size=18, color=(0xF6, 0xF1, 0xE4, 255), box=(20, 22, 18, 0.72 * 255)),
    "legend": dict(size=18, color=(0xF6, 0xF1, 0xE4, 255), box=(30, 32, 24, 0.78 * 255)),
}


def lin(c):
    """An sRGB 0-255 colour (alpha linear) as the linear RGBA a strip stores."""
    def one(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (one(c[0]), one(c[1]), one(c[2]), c[3] / 255)


def strips_of(se):
    return se.strips if hasattr(se, "strips") else se.sequences


def text_strip(se, name, text, channel, start, length, style, location, anchor, wrap_px=None, fade=False, align="LEFT"):
    """A text strip at `location` (pixels from the top-left of the 1920 x 1080 frame, converted to the strip's 0-1 units)."""
    st = strips_of(se).new_effect(name, "TEXT", channel, start, length=length)
    st.text = text
    st.font_size = style["size"]
    st.color = lin(style["color"])
    st.use_box = True
    st.box_color = lin(style["box"])
    st.box_margin = 0.012 if style["size"] > 20 else 0.008
    st.location = (location[0] / W, 1 - location[1] / H)
    st.anchor_x, st.anchor_y = anchor
    st.alignment_x = align
    if wrap_px:
        st.wrap_width = wrap_px / W
    st.blend_type = "ALPHA_OVER"
    if fade:  # in and out over 15 frames, as Overlays.tsx's CaptionBox
        end = start + length
        for f, a in ((start, 0.0), (start + FADE, 1.0), (end - FADE, 1.0), (end, 0.0)):
            st.blend_alpha = a
            st.keyframe_insert("blend_alpha", frame=f)
    return st


def build(exports_dir, out_blend, percent=100, samples=16, dressed=False):
    exp = Path(exports_dir)
    reel = json.loads((exp / "reel.json").read_text(encoding="utf8"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    default_scenes = list(bpy.data.scenes)

    report = {"blender": bpy.app.version_string, "scenes": [], "frames": reel["frames"]}
    built = {}
    for entry in reel["scenes"]:
        key = entry["package"]
        if key not in built:
            scene, sec_report = blockout.build_section(exp / key, prefix=f"{key}:", samples=samples, dressed=dressed)
            built[key] = scene
            report["scenes"].append({"package": key, "frames": entry["sectionFrames"], "objects": len(sec_report["objects"]),
                                     **{k: sec_report[k] for k in ("vegetation", "cast", "rider") if k in sec_report}})

    master = bpy.data.scenes.new("Reel")
    for sc in default_scenes:
        bpy.data.scenes.remove(sc)
    master.unit_settings.system = "METRIC"
    master.render.fps, master.render.fps_base = reel["fps"], 1.0
    master.frame_start, master.frame_end = 1, reel["frames"]
    master.render.resolution_x, master.render.resolution_y = reel["resolution"]
    master.render.resolution_percentage = percent
    master.render.use_sequencer = True
    master.render.use_compositing = False
    # the scene strips arrive display-referred from their own AgX; the master adds no second creative transform (ADR 62)
    blockout.set_enum(master.view_settings, "view_transform", ["Standard"])
    if hasattr(master.render.image_settings, "media_type"):  # Blender 5 chooses image or video before the format
        blockout.set_enum(master.render.image_settings, "media_type", ["VIDEO"])
    blockout.set_enum(master.render.image_settings, "file_format", ["FFMPEG"])
    blockout.set_enum(master.render.ffmpeg, "format", ["MPEG4"])
    blockout.set_enum(master.render.ffmpeg, "codec", ["H264"])
    blockout.set_enum(master.render.ffmpeg, "constant_rate_factor", ["MEDIUM"])
    master.render.ffmpeg.audio_codec = "NONE"
    master.render.filepath = "//../reel/reel-dressed-preview.mp4" if dressed else "//../reel/reel-blockout-preview.mp4"

    se = master.sequence_editor_create()
    for i, entry in enumerate(reel["scenes"]):
        start = entry["from"] + 1  # source frame f is Blender frame f + 1
        strip = strips_of(se).new_scene(f"{entry['config']}", built[entry["package"]], 1, start)
        strip.duration = entry["frames"]
        if (strip.left_handle, strip.right_handle) != (start, start + entry["frames"]):
            raise RuntimeError(f"{entry['config']}: strip runs {strip.left_handle}-{strip.right_handle}, not {start}-{start + entry['frames']}")

    total = reel["frames"]
    for c in reel["captions"]:
        start, length = c["from"] + 1, c["to"] - c["from"] + (FADE if c["to"] >= total and c["position"] not in ("badge", "attribution") else 0)
        length = min(length, total - c["from"]) if c["position"] in ("badge", "attribution") else length
        pos = c["position"]
        if pos == "badge":
            text_strip(se, c["id"], c["text"], 2, start, length, STYLE["badge"], (W - SAFE_X, SAFE_Y), ("RIGHT", "TOP"), align="RIGHT")
        elif pos == "attribution":
            text_strip(se, c["id"], c["text"], 3, start, length, STYLE["attribution"], (SAFE_X, H - SAFE_Y), ("LEFT", "BOTTOM"), wrap_px=W - 2 * SAFE_X)
        elif pos == "top-left":
            text_strip(se, c["id"], c["text"], 4, start, length, STYLE["caption"], (SAFE_X, SAFE_Y), ("LEFT", "TOP"), wrap_px=CAPTION_W, fade=True)
        elif pos == "bottom-center":
            text_strip(se, c["id"], c["text"], 4, start, length, STYLE["caption"], (W / 2, H - (SAFE_Y + ATTRIBUTION_H + 16)), ("CENTER", "BOTTOM"), wrap_px=CAPTION_W, fade=True, align="CENTER")
        else:  # bottom-left
            text_strip(se, c["id"], c["text"], 4, start, length, STYLE["caption"], (SAFE_X, H - (SAFE_Y + ATTRIBUTION_H + 16)), ("LEFT", "BOTTOM"), wrap_px=CAPTION_W, fade=True)

    # each section's legend lines, under the badge on the right, for the runs of frames the three.js scene draws them
    legend_strips = 0
    for entry in reel["scenes"]:
        manifest = json.loads(built[entry["package"]]["ffest_manifest"])
        for run in manifest.get("legend", []):
            lo, hi = run["from"], min(run["to"], entry["frames"])
            if hi <= lo:
                continue
            text_strip(se, f"legend-{entry['config']}-{lo}", "\n".join(run["lines"]), 5, entry["from"] + lo + 1, hi - lo, STYLE["legend"], (W - SAFE_X, SAFE_Y + 44), ("RIGHT", "TOP"), align="RIGHT")
            legend_strips += 1

    bpy.context.window.scene = master if bpy.context.window else None
    Path(out_blend).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))
    report.update({"saved": str(out_blend), "strips": len(list(strips_of(se))), "legendStrips": legend_strips, "percent": percent, "samples": samples})
    return report


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    dressed = "--dressed" in args
    args = [a for a in args if a != "--dressed"]
    if len(args) < 2:
        raise SystemExit("usage: blender --background --factory-startup --python build_reel.py -- <exports dir> <out .blend> [preview percent] [samples] [--dressed]")
    print("REEL_REPORT " + json.dumps(build(args[0], args[1], *(int(a) for a in args[2:4]), dressed=dressed)))
