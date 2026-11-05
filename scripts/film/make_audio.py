"""The community film's soundtrack (review 2026-11-05): the social cuts' original score and countryside bed
(scripts/social/make_audio.py), shaped to the film's chapters, at the film's exact length.

    python scripts/film/make_audio.py [out/blender/exports/community.json] [out/blender/reel/community-v9.wav]

The music sits low under the opening (the landscape and the railway as they are), rises with the school run, rests
almost to silence at the bench above the lake, where the birds carry the scene, fills under the ride, and resolves
under the closing line. The bed is a breeze and scattered birdsong throughout, and the hush of tyres on the path
through the ride scenes. Mixed to -14 LUFS integrated and -1.5 dBTP, as the social cuts are, so the film plays at
the same level online. No narration: the film reads without sound.
"""
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "social"))
import make_audio as sa  # noqa: E402

SR, FPS = sa.SR, sa.FPS
# the music's level by chapter (seconds, gain), interpolated: quiet for the landscape and the railway, a rest at the
# bench, full under the ride, held under the closing line
MUSIC_LEVEL = [(0, 0.45), (14, 0.45), (22, 0.85), (45, 0.9), (70, 0.95), (88, 0.9), (94, 0.4), (112, 0.4), (118, 0.95),
               (155, 1.0), (165, 0.85), (170, 0.9), (180, 0.9)]
BIRDS_LEVEL = [(0, 1.0), (88, 1.0), (94, 1.8), (114, 1.8), (120, 1.0), (180, 1.0)]


def level(points, seconds):
    t = np.arange(int(seconds * SR)) / SR
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)[:, None]


def ride_frames(film):
    """The frames of the first-person and wheel-height ride scenes, where tyres on the path are heard."""
    return [(s["from"], s["from"] + s["frames"]) for s in film["scenes"] if s["config"].startswith("community-ride-")]


def bed(seconds, rides):
    n = int(seconds * SR)
    rng = sa.rng
    lp = butter(2, 500, "low", fs=SR, output="sos")
    hp = butter(1, 40, "high", fs=SR, output="sos")
    wind = np.stack([sosfilt(lp, sosfilt(hp, np.cumsum(rng.standard_normal(n)) * 0.01)) for _ in range(2)], 1)
    wind *= (0.75 + 0.25 * np.sin(2 * np.pi * 0.07 * np.arange(n) / SR))[:, None]
    wind *= 0.05 / (np.sqrt(np.mean(wind ** 2)) + 1e-9) * 0.25
    out = wind + sa.birds(seconds) * level(BIRDS_LEVEL, seconds)
    bp = butter(2, [180, 1400], "band", fs=SR, output="sos")
    for lo, hi in rides:
        m = int((hi - lo) / FPS * SR)
        hush = sosfilt(bp, rng.standard_normal(m)) * sa.env(m, 0.4, 0.4)
        hush *= 0.012 / (np.sqrt(np.mean(hush ** 2)) + 1e-9)
        sa.add(out, lo / FPS, hush)
    return out


def main(film_path="out/blender/exports/community.json", out_path="out/blender/reel/community-v9.wav"):
    import json
    film = json.loads(Path(film_path).read_text(encoding="utf8"))
    seconds = film["frames"] / film["fps"]
    mix = 0.8 * sa.music(seconds) * level(MUSIC_LEVEL, seconds) + bed(seconds, ride_frames(film))
    n = len(mix)
    fade_in, fade_out = int(0.5 * SR), int(2.5 * SR)
    mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    mix[n - fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.5
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    raw = out.with_suffix(".raw.wav")
    wavfile.write(raw, SR, (mix / max(1e-9, np.abs(mix).max()) * 0.5).astype(np.float32))
    sa.normalise(raw, out)
    raw.unlink()
    print(f"AUDIO {out} {seconds:.1f} s", flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:])
