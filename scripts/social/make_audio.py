"""The social cuts' soundtracks: an original piece, synthesised here, so there is no licence to clear, laid over a quiet
countryside bed, one WAV per cut, at each cut's exact length (out/social/plan.json, from src/data/social-cuts.ts).

    python scripts/social/make_audio.py <out dir>     (npm run social:audio)

The music is gentle and uplifting: D major at 80 bpm, D - A - Bm - G, a warm pad, a plucked arpeggio from the first
frame (a short video has to sound like something at once), a soft bass and a slow bell-like melody from the second bar,
and a light shaker; it resolves on D under the end card and fades. The bed is a breeze, scattered birdsong and, on the
first-person shots only, the hush of tyres on the path, cut with the picture. Each track is loudness-normalised with
ffmpeg's two-pass loudnorm to -14 LUFS integrated and -1.5 dBTP, the level the platforms play at, so nothing is
turned down hard or left too quiet, and the music stays under the picture rather than over it.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR, FPS, BPM = 48000, 30, 80
BEAT = 60 / BPM
BAR = 4 * BEAT
# chord roots and triads as MIDI notes in octave 4: D, A, Bm, G
CHORDS = [(62, 66, 69), (57, 61, 64), (59, 62, 66), (55, 59, 62)]
TARGET = {"I": -14.0, "TP": -1.5, "LRA": 11.0}
rng = np.random.default_rng(2026)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, attack, release, total=None):
    """A linear attack, a sustain and a cosine release over n samples."""
    e = np.ones(n)
    a, r = min(n, int(attack * SR)), min(n, int(release * SR))
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[n - r:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, r)))
    return e


def add(buf, start_s, sig, pan=0.0):
    """Mix a mono signal into the stereo buffer at start_s with an equal-power pan (-1 left, +1 right)."""
    i = max(0, int(start_s * SR))
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    th = (pan + 1) * np.pi / 4
    buf[i:i + len(sig), 0] += sig * np.cos(th)
    buf[i:i + len(sig), 1] += sig * np.sin(th)


def pad_voice(m, dur, detune_cents):
    t = np.arange(int(dur * SR)) / SR
    f = hz(m) * 2 ** (detune_cents / 1200)
    s = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    return s * env(len(t), 0.9, 1.4) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.3 * t + rng.uniform(0, 6)))


def pluck(m, vel, dur=2.2):
    """A harp-like pluck: harmonics that die away faster the higher they are."""
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    s = sum(np.sin(2 * np.pi * k * f * t + rng.uniform(0, 0.3)) * np.exp(-t * (1.6 + 1.3 * k)) / k ** 1.3 for k in range(1, 7))
    return vel * s * env(len(t), 0.004, 0.2)


def bell(m, dur):
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 0.9) + 0.35 * np.sin(2 * np.pi * 2.0 * f * t) * np.exp(-t * 2.2) + 0.12 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 3.5)
    return s * env(len(t), 0.01, 0.4)


def bass(m, dur):
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 0.9) * env(len(t), 0.02, 0.3)


def reverb(x, seconds=2.4, wet=0.24):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    lp = butter(2, 5000, "low", fs=SR, output="sos")
    out = np.empty_like(x)
    for ch in range(2):
        ir = sosfilt(lp, rng.standard_normal(n)) * np.exp(-t / 0.6)
        ir /= np.sqrt(np.sum(ir ** 2))
        out[:, ch] = (1 - wet) * x[:, ch] + wet * fftconvolve(x[:, ch], ir)[: len(x)]
    return out


def music(seconds):
    bars = int(np.ceil(seconds / BAR))
    buf = np.zeros((int(seconds * SR) + SR * 4, 2))
    hp = butter(2, 6000, "high", fs=SR, output="sos")
    for b in range(bars):
        last = b == bars - 1
        root, third, fifth = CHORDS[0] if last else CHORDS[b % 4]
        t0 = b * BAR
        hold = BAR + (2.5 if last else 1.2)
        for m, cents, pan in ((root - 12, -3, -0.2), (third, 4, 0.3), (fifth, -5, -0.35), (root + 12, 3, 0.25)):
            add(buf, t0, 0.055 * pad_voice(m, hold, cents), pan)
        if last:  # the resolve: one spread chord and a long bell
            for i, m in enumerate((root, fifth, third + 12, root + 12)):
                add(buf, t0 + i * 0.09, pluck(m, 0.16, 3.5), -0.3 + 0.2 * i)
            add(buf, t0, 0.09 * bell(root + 24, 4.0), 0.1)
            add(buf, t0, 0.16 * bass(root - 24, 3.5))
            continue
        voicing = [root, third, fifth, root + 12, third + 12, fifth + 12]
        for i, (k, v) in enumerate(zip([0, 2, 4, 3, 5, 3, 4, 2], [1, 0.6, 0.8, 0.6, 0.9, 0.6, 0.8, 0.65])):
            add(buf, t0 + i * BEAT / 2 + rng.uniform(-0.006, 0.006), pluck(voicing[k], 0.11 * v), 0.35 if i % 2 else -0.25)
        if b >= 1:
            add(buf, t0, 0.15 * bass(root - 24, BEAT * 2.2))
            add(buf, t0 + 2 * BEAT, 0.12 * bass(root - 24 + (7 if b % 2 else 0), BEAT * 2.2))
            top = [fifth + 12, third + 12, root + 24, third + 12][b % 4]
            add(buf, t0, 0.07 * bell(top, BEAT * 3.5), 0.15)
            add(buf, t0 + 2.5 * BEAT, 0.05 * bell(top - (3 if b % 2 else 2), BEAT * 2), -0.1)
        if b >= 2:
            for i in range(8):
                n = int(0.05 * SR)
                hit = sosfilt(hp, rng.standard_normal(n)) * np.exp(-np.arange(n) / (0.012 * SR))
                add(buf, t0 + i * BEAT / 2 + BEAT / 4, (0.02 if i % 2 else 0.012) * hit, 0.4)
    return reverb(buf)[: int(seconds * SR)]


def birds(seconds):
    buf = np.zeros((int(seconds * SR), 2))
    t = 0.4 + rng.uniform(0, 1.0)
    while t < seconds - 1:
        pan, base, count = rng.uniform(-0.8, 0.8), rng.uniform(2800, 4800), rng.integers(3, 8)
        for k in range(count):
            d = rng.uniform(0.05, 0.11)
            n = int(d * SR)
            tt = np.arange(n) / SR
            f0, f1 = base * rng.uniform(0.9, 1.15), base * rng.uniform(1.1, 1.5)
            ph = 2 * np.pi * np.cumsum(np.linspace(f0, f1, n)) / SR
            chirp = (np.sin(ph) + 0.18 * np.sin(2 * ph)) * np.sin(np.pi * tt / d) ** 2
            add(buf, t + k * rng.uniform(0.09, 0.14), 0.02 * chirp, pan)
        t += rng.uniform(1.8, 4.5)
    return buf


def bed(seconds, cut):
    n = int(seconds * SR)
    lp = butter(2, 500, "low", fs=SR, output="sos")
    hp = butter(1, 40, "high", fs=SR, output="sos")
    wind = np.stack([sosfilt(lp, sosfilt(hp, np.cumsum(rng.standard_normal(n)) * 0.01)) for _ in range(2)], 1)
    wind *= (0.75 + 0.25 * np.sin(2 * np.pi * 0.07 * np.arange(n) / SR))[:, None]
    wind *= 0.05 / (np.sqrt(np.mean(wind ** 2)) + 1e-9) * 0.25
    out = wind + birds(seconds)
    # tyres on the path, only while the picture is a first-person ride
    bp = butter(2, [180, 1400], "band", fs=SR, output="sos")
    at = 0
    for sh in cut["shots"]:
        frames = sh["frames"]
        if sh["plate"].endswith("-pov"):
            m = int(frames / FPS * SR)
            hush = sosfilt(bp, rng.standard_normal(m)) * env(m, 0.08, 0.08)
            hush *= 0.012 / (np.sqrt(np.mean(hush ** 2)) + 1e-9)
            add(out, at / FPS, hush)
        at += frames
    return out


def ffmpeg():
    exe = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if not exe:
        raise SystemExit("ffmpeg not found: set FFMPEG or put it on PATH")
    return exe


def normalise(raw, out):
    """Two-pass loudnorm to the platforms' playback level, then 48 kHz 24-bit PCM."""
    f = f"loudnorm=I={TARGET['I']}:TP={TARGET['TP']}:LRA={TARGET['LRA']}"
    r = subprocess.run([ffmpeg(), "-hide_banner", "-i", str(raw), "-af", f + ":print_format=json", "-f", "null", "-"], capture_output=True, text=True, check=True)
    m = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    f2 = f + f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    subprocess.run([ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw), "-af", f2, "-ar", str(SR), "-c:a", "pcm_s24le", str(out)], check=True)


def main(out_dir, plan_path="out/social/plan.json"):
    plan = json.loads(Path(plan_path).read_text(encoding="utf8"))
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for cut in plan["cuts"]:
        seconds = cut["frames"] / FPS
        mix = 0.8 * music(seconds) + bed(seconds, cut)
        n = len(mix)
        fade_in, fade_out = int(0.25 * SR), int(2.5 * SR)
        mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
        mix[n - fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.5
        raw = out / f"{cut['id']}.raw.wav"
        wavfile.write(raw, SR, (mix / max(1e-9, np.abs(mix).max()) * 0.5).astype(np.float32))
        normalise(raw, out / f"{cut['id']}.wav")
        raw.unlink()
        print(f"AUDIO {cut['id']} {seconds:.1f} s", flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:])
