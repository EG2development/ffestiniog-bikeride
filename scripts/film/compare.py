"""Before-and-after sheets of two cuts of the film at the same moments (review 2026-11-05, ADR 45's rule: one
environment, matching frames), for inspecting a change on the actual renders.

    python scripts/film/compare.py <before.mp4> <after.mp4> <out dir> [--times 5,24,40,...] [--width 960]

Writes compare-<mm-ss>.png per moment (before above, after below, labelled) and contact-<name>.png (one frame every
two seconds) for each file, so a whole cut can be scanned side by side.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

DEFAULT_TIMES = "3,12,17,24,31,40,50,62,75,87,94,104,111,120,140,150,160,175"


def frame(video, t, width, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(video), "-frames:v", "1", "-vf", f"scale={width}:-1", str(out)], check=True)
    return Image.open(out).convert("RGB")


def contact(video, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf", "fps=0.5,scale=320:-1,tile=10x9:padding=2:color=black", "-frames:v", "1", str(out)], check=True)


def main(before, after, out_dir, times=DEFAULT_TIMES, width=960):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    width = int(width)
    with tempfile.TemporaryDirectory() as tmp:
        for t in (float(x) for x in times.split(",")):
            a = frame(before, t, width, Path(tmp) / "a.png")
            b = frame(after, t, width, Path(tmp) / "b.png")
            sheet = Image.new("RGB", (width, a.height + b.height + 4), (0, 0, 0))
            sheet.paste(a, (0, 0))
            sheet.paste(b, (0, a.height + 4))
            d = ImageDraw.Draw(sheet)
            for y, label in ((0, f"before  {Path(before).name}  {t:.0f} s"), (a.height + 4, f"after  {Path(after).name}  {t:.0f} s")):
                d.rectangle([0, y, 7 * len(label) + 12, y + 18], fill=(0, 0, 0))
                d.text((6, y + 3), label, fill=(255, 255, 255))
            name = f"compare-{int(t) // 60:02d}-{int(t) % 60:02d}.png"
            sheet.save(out / name)
            print("wrote", name)
    for video in (before, after):
        contact(video, out / f"contact-{Path(video).stem}.png")
        print("wrote", f"contact-{Path(video).stem}.png")


if __name__ == "__main__":
    args = sys.argv[1:]
    opts = {}
    for key in ("--times", "--width"):
        if key in args:
            i = args.index(key)
            opts[key[2:]] = args[i + 1]
            del args[i:i + 2]
    main(*args, **opts)
