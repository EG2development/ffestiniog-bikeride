"""Where a person looks (pure maths, no Blender): a head that turns to what is going on around them, as people on a
shared path do, instead of staring ahead like a mannequin.

Every few seconds a person picks something to look at:
- the way ahead;
- the open view to one side;
- the companion they walk or sit with;
- someone coming past (most of all a bicycle closing on them, which everyone checks);
- their dog.

They hold it for a while, following it if it moves. The head turns there in about half a second, eased like a real head
turn, never past what a neck and a little of the chest can manage. Seeded per person, so a build is repeatable.
"""
import math

import numpy as np

MAX_TURN = math.radians(70)  # head, neck and chest together
MAX_NOD = math.radians(25)
PASS_M = 9.0  # someone this close and coming nearer draws a look


def _smooth(s):
    s = np.clip(s, 0.0, 1.0)
    return s * s * s * (s * (6 * s - 15) + 10)


def _bearing(here, heading, there):
    """The turn (radians, + left) from a heading to a point, and the drop to it from eye height (+ up)."""
    d = there[:, :2] - here[:, :2]
    turn = np.arctan2(d[:, 1], d[:, 0]) - heading
    turn = (turn + np.pi) % (2 * np.pi) - np.pi
    dist = np.maximum(np.hypot(d[:, 0], d[:, 1]), 0.3)
    return turn, dist


def gaze(fps, here, heading, eye_m, seed, companions=(), passers=(), dog=None, view=None, seated=False, ahead=0.0):
    """Head turn and nod per frame, (frames, 2) radians.

    here: (F, 3) the person's position; heading: (F,) the way their body faces (radians, Blender, about +Z); eye_m: eye
    height above `here`; companions, passers: lists of (F, 3) positions; dog: (F, 3) or None; view: the open view's
    bearing relative to the body (radians, + left), if one side is open; seated: no way ahead to watch, a calmer rhythm;
    ahead: the nod (radians) of a look ahead (a little down for someone walking, watching the path)."""
    rng = np.random.default_rng(seed)
    n = len(here)
    here = np.asarray(here, dtype=np.float64)
    heading = np.unwrap(np.asarray(heading, dtype=np.float64))
    options = {"ahead": (np.zeros(n), np.full(n, ahead))}
    if seated and view is None:
        view = 0.0  # a bench faces its view
    if view is not None:
        options["view"] = (np.full(n, view), np.full(n, math.radians(-3)))
    for i, c in enumerate(companions):
        t, d = _bearing(here, heading, np.asarray(c, dtype=np.float64))
        # side by side, the head turns part way and the eyes do the rest
        options[f"companion{i}"] = (t * 0.6, np.arctan2(-0.05, d))
    if dog is not None:
        t, d = _bearing(here, heading, np.asarray(dog, dtype=np.float64))
        options["dog"] = (t, np.arctan2(0.35 - eye_m, d))
    near = []
    for i, p in enumerate(passers):
        p = np.asarray(p, dtype=np.float64)
        t, d = _bearing(here, heading, p)
        closing = np.gradient(d) < -0.005  # metres per frame: coming nearer
        options[f"pass{i}"] = (t, np.arctan2(-0.15, d))
        near.append((f"pass{i}", (d < PASS_M) & closing & (np.abs(t) < math.radians(100))))
    weights = {"ahead": 3.0 if not seated else 0.0, "view": 3.0 if seated else 1.0, "dog": 0.8}
    weights.update({k: (1.6 if seated else 1.0) for k in options if k.startswith("companion")})
    # a timeline of looks: (start frame, option); someone passing interrupts whatever they were looking at, once
    looks, f, seen = [], 0, set()
    while f < n:
        pending = [k for k, m in near if k not in seen and m[f:].any()]
        first = min(pending, key=lambda k: int(np.argmax(dict(near)[k][f:]))) if pending else None
        if first is not None and int(np.argmax(dict(near)[first][f:])) == 0:
            pick, hold = first, rng.uniform(1.2, 2.2)
            seen.add(first)
        else:
            keys = [k for k in options if not k.startswith("pass")]
            p = np.array([weights.get(k, 1.0) for k in keys])
            pick = keys[rng.choice(len(keys), p=p / p.sum())]
            hold = rng.uniform(2.5, 6.0) if seated else rng.uniform(1.5, 4.5)
            if pick == "ahead" and not seated:
                hold *= 1.5
            if first is not None:  # break off to catch the one coming
                hold = min(hold, max(0.6, int(np.argmax(dict(near)[first][f:])) / fps))
        looks.append((f, pick))
        f += max(1, int(hold * fps))
    out = np.zeros((n, 2))
    out[0] = np.array([0.0, ahead])
    for j, (start, pick) in enumerate(looks):
        end = looks[j + 1][0] if j + 1 < len(looks) else n
        t, nod = options[pick]
        cur = np.column_stack([np.clip(t[start:end], -MAX_TURN, MAX_TURN), np.clip(nod[start:end], -MAX_NOD, MAX_NOD)])
        # a head turn takes about half a second, longer for a big one, from wherever the head was
        span = (rng.uniform(0.3, 0.45) + 0.55 * abs(float(cur[0, 0] - out[max(0, start - 1), 0]))) * fps
        ramp = _smooth(np.arange(end - start) / span)[:, None] if start > 0 else np.ones((end - start, 1))
        out[start:end] = out[max(0, start - 1)] * (1 - ramp) + cur * ramp
    # a head follows a quick target (a bicycle sweeping past) with a little lag, never whipping round
    a = 1 - math.exp(-1 / (0.1 * fps))
    for rev in (False, True):
        seq = out[::-1] if rev else out
        for i in range(1, n):
            seq[i] = seq[i - 1] + a * (seq[i] - seq[i - 1])
    # a little drift on top, so even a held look is never frozen
    k = np.arange(n) / fps
    out[:, 0] += math.radians(1.5) * np.sin(2 * np.pi * 0.13 * k + rng.uniform(0, 6)) + math.radians(0.8) * np.sin(2 * np.pi * 0.31 * k + rng.uniform(0, 6))
    out[:, 1] += math.radians(1.0) * np.sin(2 * np.pi * 0.17 * k + rng.uniform(0, 6))
    return out
