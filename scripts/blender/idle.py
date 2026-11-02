"""Someone sitting on a bench, gently alive (the community film): breathing, settling into the seat now and then, a head
that turns to the view, to their companion and to whoever passes (attention.py), and now and then a hand lifted while
they talk or raised to point something out across the view. Understated: small angles, slow eases, long holds.

Keys go on top of the seated pose trailfolk.sitter builds. Each bone's base rotation is kept and an extra rotation
about the armature's axes is applied after it, so the pose itself never changes.
"""
import math

import numpy as np
from mathutils import Quaternion, Vector

import gait

X, FWD, UP = Vector((1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))  # armature space: left, forward, up
BREATH_S = 4.2  # a breath at rest, seconds
# how a head turn and nod share out down the back and neck
TURN_SHARE = {"spine_02": 0.06, "spine_03": 0.12, "neck_01": 0.34, "head": 0.48}
NOD_SHARE = {"neck_01": 0.4, "head": 0.6}


def _ease(t, t0, t1, rise, fall):
    """0 before t0, easing up to 1 over `rise` s, holding, easing back to 0 by t1."""
    up = gait._smooth(np.clip((t - t0) / rise, 0, 1))
    down = gait._smooth(np.clip((t1 - t) / fall, 0, 1))
    return np.minimum(up, down)


def _segments(rng, n, fps, lo_s, hi_s, values):
    """A slowly changing value: a new target every lo_s to hi_s seconds, eased over a second or two."""
    t = np.arange(n) / fps
    out = np.zeros(n)
    cur, at = values(), 0.0
    while at < t[-1]:
        nxt, dur, ease = values(), rng.uniform(lo_s, hi_s), rng.uniform(1.2, 1.9)
        w = gait._smooth(np.clip((t - at - dur) / ease, 0, 1))
        sel = t >= at
        out[sel] = cur + (nxt - cur) * w[sel]
        cur, at = nxt, at + dur + ease
    return out


def gestures(rng, n, fps, talkative):
    """A seated person's gesture events: (start s, end s, kind, side). Talking hands now and then; a point at the view
    at most once in a scene, early enough to be seen."""
    events, t, end = [], rng.uniform(1.5, 4.0), n / fps
    pointed = False
    while t < end - 2.5:
        if not pointed and talkative and t > 3.0 and rng.random() < 0.35:
            events.append((t, t + rng.uniform(2.0, 2.6), "point", "r"))
            pointed = True
        elif rng.random() < (0.75 if talkative else 0.35):
            events.append((t, t + rng.uniform(1.4, 2.6), "talk", "r" if rng.random() < 0.65 else "l"))
        t = events[-1][1] + rng.uniform(2.5, 7.0) if events and events[-1][1] > t else t + rng.uniform(2.5, 6.0)
    return events


def bake_seated(arm, frames, fps, seed, gaze, talkative=True):
    """Key a seated person's breathing, posture, head and hands over `frames` (1-based), on top of their pose.
    `gaze`: (frames, 2) head turn and nod (attention.gaze). Returns the gesture events, for the report."""
    rng = np.random.default_rng(seed)
    n = len(frames)
    t = np.arange(n) / fps
    breath = np.sin(2 * np.pi * t / (BREATH_S * rng.uniform(0.9, 1.15)) + rng.uniform(0, 6))
    lean = np.radians(_segments(rng, n, fps, 6.0, 12.0, lambda: rng.uniform(-3.0, 5.0)))  # + forward
    side = np.radians(_segments(rng, n, fps, 7.0, 14.0, lambda: rng.uniform(-2.0, 2.0)))
    events = gestures(rng, n, fps, talkative)
    look = np.asarray(gaze, dtype=np.float64).copy()
    arm_x = {s: np.zeros(n) for s in "lr"}  # upper arm forward (+), radians
    fore_x = {s: np.zeros(n) for s in "lr"}  # forearm raised further (+)
    wrist = {s: np.zeros(n) for s in "lr"}
    for t0, t1, kind, s in events:
        w = _ease(t, t0, t1, 0.55, 0.7)
        if kind == "point":  # arm up and out towards the view, the head going with it
            arm_x[s] += math.radians(48) * w
            fore_x[s] -= math.radians(35) * w
            look = look * (1 - w[:, None]) + np.column_stack([np.full(n, math.radians(-6 if s == "r" else 6)), np.full(n, math.radians(4))]) * w[:, None]
        else:  # the hand comes up off the knee and turns as they make a point
            arm_x[s] += math.radians(12) * w
            fore_x[s] += math.radians(28) * w
            wrist[s] += math.radians(14) * w * np.sin(2 * np.pi * 1.3 * (t - t0))
    bones = {}
    base = {}
    for name in ("spine_01", "spine_02", "spine_03", "neck_01", "head", "clavicle_l", "clavicle_r", "upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r", "hand_l", "hand_r"):
        pb = arm.pose.bones[name]
        pb.rotation_mode = "QUATERNION"
        base[name] = Quaternion(pb.rotation_quaternion)
        bones[name] = []
    for i in range(n):
        turn, nod = look[i]
        extra = {
            "spine_01": [(X, -0.4 * lean[i]), (FWD, 0.5 * side[i])],
            "spine_02": [(X, -0.35 * lean[i] - math.radians(0.6) * breath[i]), (FWD, 0.3 * side[i]), (UP, TURN_SHARE["spine_02"] * turn)],
            "spine_03": [(X, -0.25 * lean[i] - math.radians(0.5) * breath[i]), (UP, TURN_SHARE["spine_03"] * turn)],
            # the neck and head keep the eyes level whatever the back does
            "neck_01": [(X, 0.5 * lean[i] - NOD_SHARE["neck_01"] * nod), (FWD, -0.4 * side[i]), (UP, TURN_SHARE["neck_01"] * turn)],
            "head": [(X, 0.4 * lean[i] - NOD_SHARE["head"] * nod), (FWD, -0.3 * side[i]), (UP, TURN_SHARE["head"] * turn)],
        }
        for s, sgn in (("l", 1), ("r", -1)):
            extra[f"clavicle_{s}"] = [(FWD, sgn * math.radians(0.8) * breath[i])]  # the shoulders rise as they breathe in
            extra[f"upperarm_{s}"] = [(X, -arm_x[s][i])]
            extra[f"lowerarm_{s}"] = [(X, -fore_x[s][i])]
            extra[f"hand_{s}"] = [(UP, sgn * wrist[s][i])]
        for name, rots in extra.items():
            q = gait._quat(arm, name, *rots) @ base[name]
            if bones[name] and Quaternion(bones[name][-1]).dot(q) < 0:
                q.negate()
            bones[name].append(tuple(q))
    fr = np.asarray(frames, dtype=np.float64)
    for name, q in bones.items():
        gait.key_vectors(arm, f'pose.bones["{name}"].rotation_quaternion', fr, q)
    return [(round(a, 1), round(b, 1), k, s) for a, b, k, s in events]



def bake_head(arm, frames, gaze):
    """Key only the neck and head turning and nodding by `gaze` on top of their pose (someone riding: the body stays
    on the bicycle, the head checks around)."""
    fr = np.asarray(frames, dtype=np.float64)
    for name, t_share, n_share in (("neck_01", 0.42, 0.4), ("head", 0.58, 0.6)):
        pb = arm.pose.bones[name]
        pb.rotation_mode = "QUATERNION"
        q0, keys = Quaternion(pb.rotation_quaternion), []
        for turn, nod in gaze:
            q = gait._quat(arm, name, (X, -n_share * nod), (UP, t_share * turn)) @ q0
            if keys and Quaternion(keys[-1]).dot(q) < 0:
                q.negate()
            keys.append(tuple(q))
        gait.key_vectors(arm, f'pose.bones["{name}"].rotation_quaternion', fr, keys)
