"""Builds the reel's Blender master: one Scene per reel scene plus a master Scene that cuts them together in the Video Sequencer.

    blender --background --factory-startup --python scripts/blender/build_reel.py -- <exports dir> <out .blend> [preview percent] [samples] [--dressed] [--film community]

The exports dir holds the section packages and reel.json written by `npm run blender:export -- reel`. Every scene is the plain
geographic blockout of import_blockout.py; the master takes exactly the master timeline's frame count from each (the Maentwrog
section is 360 frames, the reel uses 300), and carries the reel's captions as text strips: the "not an approved route" badge,
the credits, the scene captions and each section's legend lines (docs/blender-build-plan.md Phase 6; the three.js overlays in
src/three/Overlays.tsx are the layout reference). With --dressed every scene gets dress.py's realistic materials, vegetation,
sky and people instead.

Typography (review 2026-11-05): every strip is set in Inter, the open font Blender ships, not the sequencer's monospaced
default. A scene caption is a quiet panel with a leaf-green accent bar: its Welsh larger, its English under it in a lighter
ink, each pre-wrapped from the font's own metrics (blf). A scene's legend shows for its first six seconds, small, under the
badge; the credits run throughout in one line per language, as small print. A scene marked `dissolve` cross-fades in over
the end of the one before it (the film's "then and now" cut).
"""
import json
import math
import sys
from pathlib import Path

import blf
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_blockout as blockout  # noqa: E402

# Overlays.tsx's layout at 1920 x 1080: the 5 % title-safe area, caption width, and the style tokens (sRGB)
W, H = 1920, 1080
SAFE_X, SAFE_Y = 96, 54
CAPTION_W = 820
FADE = 15
LEGEND_FRAMES = 180  # a scene's legend reads for its first six seconds, then clears the frame
LINE = 1.15  # a text strip's line pitch, in ems
STYLE = {
    "caption": dict(cy=36, en=27, cy_color=(0xF8, 0xF4, 0xE8, 255), en_color=(0xDC, 0xD7, 0xC9, 255), panel=(14, 16, 13, 0.58 * 255),
                    accent=(0x8F, 0xBF, 0x6A, 255), pad=(24, 18), gap=8, bar=6),
    "badge": dict(size=16, color=(0x2C, 0x2A, 0x26, 255), box=(246, 241, 228, 0.92 * 255)),
    "attribution": dict(size=13, color=(0xC9, 0xC4, 0xB6, 255), box=(10, 12, 10, 0.55 * 255)),
    "legend": dict(size=15, color=(0xDC, 0xD7, 0xC9, 255), box=(14, 16, 13, 0.5 * 255)),
}
_cache = {}


def lin(c):
    """An sRGB 0-255 colour (alpha linear) as the linear RGBA a strip stores."""
    def one(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (one(c[0]), one(c[1]), one(c[2]), c[3] / 255)


def strips_of(se):
    return se.strips if hasattr(se, "strips") else se.sequences


def font():
    """Inter (OFL), from Blender's own datafiles: the strips' VFont and blf's id for measuring; (None, -1) without it."""
    if "font" not in _cache:
        v = bpy.app.version
        path = Path(bpy.app.binary_path).resolve().parent / f"{v[0]}.{v[1]}" / "datafiles" / "fonts" / "Inter.woff2"
        try:
            _cache["font"] = (bpy.data.fonts.load(str(path), check_existing=True), blf.load(str(path)))
        except RuntimeError:
            print(f"WARNING: {path} not loadable; strips keep Blender's default font")
            _cache["font"] = (None, -1)
    return _cache["font"]


def measure(text, size):
    """A single line's width in pixels at `size` px (blf's metrics, or 0.55 em a character without the font)."""
    fid = font()[1]
    if fid < 0:
        return 0.55 * size * len(text)
    blf.size(fid, size)
    return blf.dimensions(fid, text)[0]


def wrap(text, size, width_px):
    """The text's lines at `size` within `width_px`, breaking at spaces and keeping its own line breaks."""
    out = []
    for par in text.split("\n"):
        line = ""
        for word in par.split(" "):
            trial = f"{line} {word}" if line else word
            if line and measure(trial, size) > width_px:
                out.append(line)
                line = word
            else:
                line = trial
        out.append(line)
    return out


def lines_in(text, size, width_px):
    """How many lines a text wraps to."""
    return len(wrap(text, size, width_px))


def body(c):
    """A caption's text: a bilingual caption's Welsh above its English."""
    return f"{c['cy']}\n{c['text']}" if c.get("cy") else c["text"]


def fade_in_out(st, start, length, peak=1.0, fade=FADE):
    """In and out over `fade` frames, as Overlays.tsx's CaptionBox."""
    end = start + length
    for f, a in ((start, 0.0), (start + fade, peak), (end - fade, peak), (end, 0.0)):
        st.blend_alpha = a
        st.keyframe_insert("blend_alpha", frame=f)


def text_strip(se, name, text, channel, start, length, style, location, anchor, wrap_px=None, fade=False, align="LEFT", size=None, color=None, box=True):
    """A text strip at `location` (pixels from the top-left of the 1920 x 1080 frame, converted to the strip's 0-1 units)."""
    st = strips_of(se).new_effect(name, "TEXT", channel, start, length=length)
    st.text = text
    st.font_size = size or style["size"]
    if font()[0] is not None:
        st.font = font()[0]
    st.color = lin(color or style["color"])
    st.use_box = box and "box" in style
    if st.use_box:
        st.box_color = lin(style["box"])
        st.box_margin = 0.012 if st.font_size > 20 else 0.007
    st.location = (location[0] / W, 1 - location[1] / H)
    st.anchor_x, st.anchor_y = anchor
    st.alignment_x = align
    if wrap_px:
        st.wrap_width = wrap_px / W
    st.blend_type = "ALPHA_OVER"
    if fade:
        fade_in_out(st, start, length)
    return st


def panel_strip(se, name, channel, start, length, rect, rgba, fade=False):
    """A translucent rectangle (a COLOR strip scaled and offset to `rect` = (left, top, width, height) in pixels)."""
    st = strips_of(se).new_effect(name, "COLOR", channel, start, length=length)
    left, top, w, h = rect
    st.color = lin(rgba)[:3]
    st.transform.scale_x, st.transform.scale_y = w / W, h / H
    st.transform.offset_x, st.transform.offset_y = left + w / 2 - W / 2, H / 2 - (top + h / 2)
    st.transform.filter = "NEAREST"
    st.blend_type = "ALPHA_OVER"
    st.blend_alpha = rgba[3] / 255
    if fade:
        fade_in_out(st, start, length, peak=rgba[3] / 255)
    return st


def caption_panel(se, c, start, length, cap_w, anchor_x, y, bottom=False, channel=6):
    """A scene caption: its Welsh over its English on a translucent panel with an accent bar, pre-wrapped to `cap_w`.
    `anchor_x` is the panel's left edge, or its centre when `centre`; `y` its top, or its bottom when `bottom`."""
    s = STYLE["caption"]
    cy = wrap(c["cy"], s["cy"], cap_w) if c.get("cy") else []
    en = wrap(c["text"], s["en"], cap_w)
    # the strip draws a shade wider than blf measures (review 2026-11-05: a 38-character line overran by one), so 8 % over
    text_w = 1.08 * max([measure(t, s["cy"]) for t in cy] + [measure(t, s["en"]) for t in en])
    cy_h, en_h = len(cy) * s["cy"] * LINE, len(en) * s["en"] * LINE
    w = math.ceil(text_w + 2 * s["pad"][0] + s["bar"])
    h = math.ceil(cy_h + (s["gap"] if cy else 0) + en_h + 2 * s["pad"][1])
    centre = anchor_x == "centre"
    left = (W - w) / 2 if centre else anchor_x
    top = y - h if bottom else y
    panel_strip(se, f"{c['id']}-panel", channel, start, length, (left, top, w, h), s["panel"], fade=True)
    panel_strip(se, f"{c['id']}-bar", channel + 1, start, length, (left, top, s["bar"], h), s["accent"], fade=True)
    x = left + s["bar"] + s["pad"][0]
    ty = top + s["pad"][1]
    if cy:
        text_strip(se, f"{c['id']}-cy", "\n".join(cy), channel + 2, start, length, s, (x, ty), ("LEFT", "TOP"), fade=True, size=s["cy"], color=s["cy_color"], box=False)
        ty += cy_h + s["gap"]
    text_strip(se, f"{c['id']}-en", "\n".join(en), channel + 3, start, length, s, (x, ty), ("LEFT", "TOP"), fade=True, size=s["en"], color=s["en_color"], box=False)


def credits_text(c, width_px):
    """The credits, each language on one line where the font allows it (down to 11 px), as small print."""
    base = STYLE["attribution"]["size"]
    for size in range(base, 10, -1):
        if all(measure(t, size) <= width_px for t in (c.get("cy"), c["text"]) if t):
            return body(c), size
    return body(c), 11


def captions(se, reel):
    """The film's captions as strips (badge, credits, scene captions; Welsh above English where a caption is bilingual),
    laid out by the film's `layout`; returns where the legend starts, under the badge."""
    total = reel["frames"]
    layout = reel.get("layout", {})
    cap_w = layout.get("captionW", CAPTION_W)
    # the credits' height and the badge's set where the captions and the legend clear them
    credit = next((c for c in reel["captions"] if c["position"] == "attribution"), None)
    credit_h = 0
    if credit is not None:
        text, size = credits_text(credit, W - 2 * SAFE_X)
        credit_h = round(len(text.split("\n")) * size * LINE + 2 * 0.007 * W)
    badge = next((c for c in reel["captions"] if c["position"] == "badge"), None)
    badge_h = 0 if badge is None else round(len(body(badge).split("\n")) * STYLE["badge"]["size"] * LINE + 2 * 0.007 * W)
    legend_y = SAFE_Y + badge_h + 10
    for c in reel["captions"]:
        start, length = c["from"] + 1, c["to"] - c["from"] + (FADE if c["to"] >= total and c["position"] not in ("badge", "attribution") else 0)
        length = min(length, total - c["from"]) if c["position"] in ("badge", "attribution") else length
        pos = c["position"]
        if pos == "badge":
            text_strip(se, c["id"], body(c), 3, start, length, STYLE["badge"], (W - SAFE_X, SAFE_Y), ("RIGHT", "TOP"), align="RIGHT")
        elif pos == "attribution":
            text, size = credits_text(c, W - 2 * SAFE_X)
            text_strip(se, c["id"], text, 4, start, length, STYLE["attribution"], (SAFE_X, H - SAFE_Y), ("LEFT", "BOTTOM"), wrap_px=W - 2 * SAFE_X, size=size)
        elif pos == "top-left":
            caption_panel(se, c, start, length, cap_w, SAFE_X, SAFE_Y, channel=6)
        elif pos == "bottom-center":
            caption_panel(se, c, start, length, cap_w, "centre", H - (SAFE_Y + credit_h + 16), bottom=True, channel=10)
        else:  # bottom-left
            caption_panel(se, c, start, length, cap_w, SAFE_X, H - (SAFE_Y + credit_h + 16), bottom=True, channel=10)
    return legend_y


def legend(se, reel, built, legend_y):
    """Each section's legend lines, under the badge on the right, for the first LEGEND_FRAMES of each run the three.js
    scene draws them (the labels state what is proposed or illustrative; six seconds reads them without crowding
    every frame); returns how many strips were made."""
    count = 0
    for entry in reel["scenes"]:
        manifest = json.loads(built[entry["package"]]["ffest_manifest"])
        for run in manifest.get("legend", []):
            lo, hi = run["from"], min(run["to"], entry["frames"])
            if hi <= lo:
                continue
            length = min(hi - lo, LEGEND_FRAMES)
            st = text_strip(se, f"legend-{entry['config']}-{lo}", "\n".join(run["lines"]), 5, entry["from"] + lo + 1, length, STYLE["legend"], (W - SAFE_X, legend_y), ("RIGHT", "TOP"), align="RIGHT")
            fade_in_out(st, entry["from"] + lo + 1, length)
            count += 1
    return count


def build(exports_dir, out_blend, percent=100, samples=16, dressed=False, film="reel"):
    exp = Path(exports_dir)
    reel = json.loads((exp / f"{film}.json").read_text(encoding="utf8"))  # reel.json, or community.json
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
        dissolve = int(entry.get("dissolve", 0))
        # a dissolving scene sits over the end of the one before it (channel 2) and fades in across the overlap
        strip = strips_of(se).new_scene(f"{entry['config']}", built[entry["package"]], 2 if dissolve else 1, start)
        strip.duration = entry["frames"]
        if (strip.left_handle, strip.right_handle) != (start, start + entry["frames"]):
            raise RuntimeError(f"{entry['config']}: strip runs {strip.left_handle}-{strip.right_handle}, not {start}-{start + entry['frames']}")
        if dissolve:
            strip.blend_type = "ALPHA_OVER"
            for f, a in ((start, 0.0), (start + dissolve, 1.0)):
                strip.blend_alpha = a
                strip.keyframe_insert("blend_alpha", frame=f)

    legend_y = captions(se, reel)
    legend_strips = legend(se, reel, built, legend_y)

    bpy.context.window.scene = master if bpy.context.window else None
    Path(out_blend).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))
    report.update({"saved": str(out_blend), "strips": len(list(strips_of(se))), "legendStrips": legend_strips, "percent": percent, "samples": samples, "font": "Inter" if font()[0] else "default"})
    return report


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    dressed = "--dressed" in args
    film = args[args.index("--film") + 1] if "--film" in args else "reel"
    args = [a for i, a in enumerate(args) if a != "--dressed" and a != "--film" and (i == 0 or args[i - 1] != "--film")]
    if len(args) < 2:
        raise SystemExit("usage: blender --background --factory-startup --python build_reel.py -- <exports dir> <out .blend> [preview percent] [samples] [--dressed]")
    print("REEL_REPORT " + json.dumps(build(args[0], args[1], *(int(a) for a in args[2:4]), dressed=dressed, film=film)))
