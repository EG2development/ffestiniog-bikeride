"""Walking, running and pram pushing (plan Phase 4 step 3), keyed per frame from the distance travelled: time follows
distance, so a planted foot never slides. The stance foot's ankle moves back at exactly the root's speed, rolling heel to
toe, and the swing foot leaves and lands at the ground's speed.

The body is a chain of coupled oscillators read off the gait phase. The pelvis carries the weight over the stance foot,
surges and eases within each step, drops on the swing side and turns with the forward leg; each segment of the spine
answers it a little later than the one below (overlapping action), the shoulders counter-rotate and the neck and head
take out what is left so the gaze stays level. Arms swing from the shoulders a beat behind the opposite leg, the elbows
bending as they come forward and the hands trailing the forearms. The hip height is a soft minimum of what both legs
reach, so the rise and fall has no creases; its accelerations drive damped springs for the soft tissue (a shape key on
the body and what it wears) and the head's nod, secondary motion that follows the footfalls. Each person moves in their
own way (`style`). Keys are Bezier with auto-clamped handles.
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree

import cast

GAIT = {  # stride per gait cycle (body heights), stance fraction, foot lift (m at 1.7 m), arm swing (m), lean, pelvis turn
    # and drop (deg), weight shift and surge (m), the running stance's knee bend (m of hip height), soft tissue's bounce
    "walk": dict(stride=0.75, duty=0.6, lift=0.07, arm=0.15, lean=3.0, twist=5.0, list=4.5, sway=0.022, surge=0.010, drop=0.0, bounce=1.0),
    "pram": dict(stride=0.68, duty=0.62, lift=0.06, arm=0.0, lean=8.0, twist=2.0, list=3.0, sway=0.015, surge=0.006, drop=0.0, bounce=0.8),
    "run": dict(stride=1.15, duty=0.36, lift=0.22, arm=0.2, lean=10.0, twist=8.0, list=6.0, sway=0.010, surge=0.015, drop=0.07, bounce=1.6),
}
LEG_REACH = 0.985  # of the rest leg length: the IK never straightens fully (no knee snap)
# each spine segment's lag behind the pelvis (gait cycles) and its share of the counter-turn, the lean and the counter-tilt
SPINE = (("spine_01", 0.03, 0.3, 0.25, -0.40), ("spine_02", 0.06, 0.5, 0.45, -0.35), ("spine_03", 0.09, 0.8, 0.30, -0.15))
FLESH_HZ, FLESH_DAMP = 6.0, 0.3  # soft tissue's wobble (a little slower than measured, so it reads at 30 fps)
HEAD_HZ, HEAD_DAMP, NOD = 3.0, 0.6, 0.7  # the head on its neck; NOD is radians of pitch per metre the spring lags
# how fleshy each bone's flesh is, scaled by how far the skin lies from the bone (none at the joints, hands, feet, head)
FLESH = {"thigh": 1.6, "calf": 0.8, "pelvis": 1.0, "spine_01": 0.9, "spine_02": 0.5, "spine_03": 0.7, "upperarm": 0.6}
X, FWD, UP = Vector((1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))  # armature space: left, forward, up


def style(pid):
    """A person's own way of moving, from their casting: women's pelvises turn and drop a little more, older people swing
    their arms less, lean further and lift their feet lower, and everyone varies a little (fixed per person)."""
    _, sex, years, _, weight = cast.profile(pid)[:5]
    rnd = np.random.default_rng(sum(map(ord, pid)))
    vary = lambda: 1 + rnd.uniform(-0.12, 0.12)  # noqa: E731
    old = min(1.0, max(0.0, (years - 55) / 25))
    return {"pelvis": (1.25 - 0.25 * sex) * vary(), "arm": (1 - 0.35 * old) * vary(), "lean": 4 * old + rnd.uniform(-1, 1),
            "lift": (1 - 0.25 * old) * vary(), "flesh": (0.5 + weight) * (1.3 - 0.3 * sex)}


def _smooth(s):
    """0 to 1 with no velocity or acceleration at either end."""
    return s * s * s * (s * (6 * s - 15) + 10)


def _softmin(values, r):
    """A minimum with its corners rounded over about `r`, never above the true one (so no leg is ever overstretched)."""
    m = min(values)
    return m - r * math.log(sum(math.exp(-(v - m) / r) for v in values))


def _pivot(x, z, off, pitch):
    """The ankle when the foot pitches about a contact point `off` (forward, up) from the flat foot's ankle at (x, z):
    the contact stays where it is on the ground, so nothing slides while the foot rolls."""
    c, sn = math.cos(-pitch), math.sin(-pitch)
    rx, rz = off[0] * c + off[1] * sn, -off[0] * sn + off[1] * c
    return x + off[0] - rx, z + off[1] - rz


def _foot(u, g, S, info, k, run, lift):
    """Ankle position (x forward, z up; root space, metres) and toe pitch (rad, + toes up) at gait fraction u."""
    duty, ankle_z = g["duty"], info["ankle_z"] * k
    ball = (info["ball"][0] * k, info["ball"][1] * k)
    heel = (info["heel"][0] * k, info["heel"][1] * k)
    half = S * duty / 2
    strike, toe_off = math.radians(12), math.radians(-35 if run else -30)
    front = _pivot(half, ankle_z, heel, strike)
    back = _pivot(-half, ankle_z, ball, toe_off)
    if u < duty:
        s = u / duty
        x = half - S * duty * s
        if s < 0.12:  # loading: the forefoot lowers onto the ground, slowing as it lands
            p = strike * (1 - s / 0.12) ** 2
            return (*_pivot(x, ankle_z, heel, p), p)
        if s < 0.6:
            return x, ankle_z, 0.0
        p = toe_off * ((s - 0.6) / 0.4) ** 2  # heel off: pivoting on the ball
        return (*_pivot(x, ankle_z, ball, p), p)
    # swing: over the ground the foot starts and stops at rest (eased), so against the body it leaves and lands at the
    # stance foot's speed; it lifts highest early in the swing, as the knee folds
    s = (u - duty) / (1 - duty)
    e, w = _smooth(s), s + 0.25 * s * (1 - s)
    body = S * (1 - duty)
    x = back[0] + (front[0] - back[0] + body) * e - body * s
    z = back[1] + (front[1] - back[1]) * e + g["lift"] * k * lift * math.sin(math.pi * w)
    return x, z, toe_off + (strike - toe_off) * _smooth(min(1.0, s / 0.75))


def _quat(arm, name, *rots):
    """A bone's local rotation from rotations about armature-space axes (applied in order) about its head."""
    m = arm.data.bones[name].matrix_local.to_3x3()
    r = Matrix.Identity(3)
    for axis, angle in rots:
        r = Matrix.Rotation(angle, 3, axis) @ r
    return (m.inverted() @ r @ m).to_quaternion()


def _spring(signal, fps, hz, damp, sub=8):
    """How far a damped mass hung on a body moving as `signal` (m, one value per frame) lags it, per frame."""
    a = np.gradient(np.gradient(np.asarray(signal, dtype=np.float64))) * fps * fps
    w, dt = 2 * math.pi * hz, 1.0 / (fps * sub)
    x = v = 0.0
    out = np.empty(len(a))
    for i in range(len(a)):
        out[i] = x
        a0, a1 = a[i], a[min(i + 1, len(a) - 1)]
        for j in range(sub):
            v += (-(a0 + (a1 - a0) * j / sub) - w * w * x - 2 * damp * w * v) * dt
            x += v * dt
    return out


def _to_segment(p, a, b):
    ab = b - a
    t = min(1.0, max(0.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def add_flesh(arm, info):
    """A shape key ("flesh") on the body and everything it wears that lifts the soft parts 1 cm per unit: fleshier the
    further the skin lies from the bone (belly, buttocks, thighs, chest, the backs of the upper arms), nothing at the
    joints, hands, feet or head. Clothes take their nearest skin's value, so nothing pokes through. Returns the Keys."""
    from bl_ext.blender_org.mpfb.services import ObjectService
    unit, bones = info["height"] / 1.7, arm.data.bones
    meshes = [c for c in arm.children if c.type == "MESH" and ObjectService.get_object_type(c) not in ("Eyes", "Eyebrows", "Eyelashes", "Hair", "Teeth")]
    body = next(m for m in meshes if m.name.endswith(".body"))
    to_arm = lambda o: o.matrix_parent_inverse @ o.matrix_basis  # noqa: E731
    skip = {g.index for g in body.vertex_groups if g.name in ("HelperGeometry", "JointCubes")}
    groups = {}
    for g in body.vertex_groups:
        f = FLESH.get(g.name, FLESH.get(g.name[:-2]))
        if f and g.name in bones:
            groups[g.index] = (f, bones[g.name].head_local, bones[g.name].tail_local)
    mb, soft, tree = to_arm(body), np.zeros(len(body.data.vertices)), KDTree(len(body.data.vertices))
    for v in body.data.vertices:
        p = mb @ v.co
        if any(ge.group in skip and ge.weight > 0.5 for ge in v.groups):
            continue
        tree.insert(p, v.index)
        for ge in v.groups:
            if ge.group in groups:
                f, a, b = groups[ge.group]
                soft[v.index] += ge.weight * f * min(1.0, _to_segment(p, a, b) / (0.15 * unit)) ** 2
    tree.balance()
    keys = []
    for obj in meshes:
        m = to_arm(obj)
        s = soft if obj is body else np.array([soft[tree.find(m @ v.co)[1]] for v in obj.data.vertices])
        if s.max() < 0.05:
            continue
        up = (m.to_3x3().inverted() @ UP).normalized() * 0.01 * unit
        if not obj.data.shape_keys:
            obj.shape_key_add(name="Basis", from_mix=False)
        kb = obj.shape_key_add(name="flesh", from_mix=False)
        kb.slider_min, kb.slider_max = -10.0, 10.0
        co = np.empty(3 * len(kb.data), dtype=np.float32)
        kb.data.foreach_get("co", co)
        kb.data.foreach_set("co", (co.reshape(-1, 3) + np.outer(s, up)).astype(np.float32).ravel())
        keys.append(obj.data.shape_keys)
    return keys


def key_array(obj, path, index, frames, values):
    """Keys for one channel from arrays, written straight into the F-curve (thousands of frames at once): Bezier with
    auto-clamped handles, so the motion is smooth between frames (motion blur) and never overshoots a key."""
    ad = obj.animation_data_create()
    if ad.action is None:
        ad.action = bpy.data.actions.new(obj.name + "-motion")
    act = ad.action
    if hasattr(act, "fcurve_ensure_for_datablock"):
        fc = act.fcurve_ensure_for_datablock(obj, path, index=index)
    else:
        fc = act.fcurves.find(path, index=index) or act.fcurves.new(path, index=index)
    n = len(frames)
    co = np.empty(2 * n, dtype=np.float32)
    co[0::2], co[1::2] = frames, values
    fc.keyframe_points.clear()
    fc.keyframe_points.add(n)
    fc.keyframe_points.foreach_set("co", co)
    fc.keyframe_points.foreach_set("interpolation", np.full(n, 2, dtype=np.int32))  # BEZIER
    for side in ("handle_left_type", "handle_right_type"):
        fc.keyframe_points.foreach_set(side, np.full(n, 4, dtype=np.int32))  # AUTO_CLAMPED
    fc.update()


def key_vectors(obj, path, frames, rows):
    rows = np.asarray(rows, dtype=np.float64)
    for i in range(rows.shape[1]):
        key_array(obj, path, i, frames, rows[:, i])


def bake_gait(person, frames, distance, phase0, activity, view_layer, prams=None):
    """Key a person's body, spine, head, feet, hands and flesh for every frame from the distance it has travelled."""
    arm, ctl, info, k = person["arm"], person["ctl"], person["info"], person["k"]
    g, st, run = GAIT[activity], style(person["pid"]), activity == "run"
    scene = view_layer.id_data
    fps = scene.render.fps / scene.render.fps_base
    S = g["stride"] * info["height"] * k
    to_root = Matrix.Rotation(math.pi / 2, 3, "Z")  # armature space (forward -Y) to root space (forward +X)
    foot_rest = {s: to_root @ arm.data.bones[f"foot_{s}"].matrix_local.to_3x3() for s in ("l", "r")}
    hip_w = (info["hip_l"].x - info["hip_r"].x) / 2 * k
    L = info["leg"] * k * LEG_REACH
    rest_hip = info["hip_z"] * k
    lean = math.radians(g["lean"] + st["lean"])
    tw_a, ls_a = math.radians(g["twist"]) * st["pelvis"], math.radians(g["list"]) * st["pelvis"]
    twist = lambda u: tw_a * math.cos(2 * math.pi * u)  # noqa: E731  (the forward leg's hip leads)
    tilt = lambda u: ls_a * math.cos(2 * math.pi * (u - 0.3 * g["duty"]))  # noqa: E731  (+ lifts the left hip, the right swinging)
    lag = 0.04 if run else 0.06  # the arms' beat behind the legs (gait cycles)
    ch = {key: [] for key in ("body", "foot_l", "rot_l", "foot_r", "rot_r", "hand_l", "hand_r")}
    beat = []  # the left foot's fraction of its cycle and each arm's swing angle, per frame
    for i in range(len(frames)):
        ul = ((phase0 / (2 * math.pi) + distance[i] / S)) % 1.0
        feet = {}
        for side, off in (("l", 0.0), ("r", 0.5)):
            u = (ul + off) % 1.0
            x, z, pitch = _foot(u, g, S, info, k, run, st["lift"])
            feet[side] = (Vector((x, hip_w * 0.85 * (1 if side == "l" else -1), z)), pitch, u)
        # the pelvis: over the stance foot, slowest as it passes over it; the hip height is the highest both legs reach
        # with the pelvis turned and tilted (and, running, the knee bent under the load), rounded so it never creases
        sway = g["sway"] * k * math.cos(2 * math.pi * (ul - g["duty"] / 2))
        surge = -g["surge"] * k * math.sin(4 * math.pi * (ul - g["duty"] / 2))
        tw, ls = twist(ul), tilt(ul)
        reach = [rest_hip * 0.99 - g["drop"] * k * (0.5 - 0.5 * math.cos(4 * math.pi * (ul - g["duty"] / 2)))]
        for side, s in (("l", 1), ("r", -1)):
            a = feet[side][0]
            hx, hy = surge + s * hip_w * math.cos(ls) * math.sin(tw), sway + s * hip_w * math.cos(ls) * math.cos(tw)
            reach.append(a.z - s * hip_w * math.sin(ls) + math.sqrt(max(L * L - (a.x - hx) ** 2 - (a.y - hy) ** 2, 0.0)))
        ch["body"].append((surge, sway, _softmin(reach, 0.012 * k) - rest_hip))
        for side, (a, pitch, _) in feet.items():
            ch[f"foot_{side}"].append(tuple(a))
            q = (Matrix.Rotation(-pitch, 3, "Y") @ foot_rest[side]).to_quaternion()
            if ch[f"rot_{side}"] and Quaternion(ch[f"rot_{side}"][-1]).dot(q) < 0:
                q.negate()
            ch[f"rot_{side}"].append(tuple(q))
        swing = {}
        for side, s in (("l", 1), ("r", -1)):
            a = 2 * math.pi * (feet["r" if side == "l" else "l"][2] - lag)  # the hand swings with the opposite leg
            c, sh, amp = math.cos(a), info[f"shoulder_{side}"], g["arm"] * st["arm"]
            swing[side] = a
            if run:  # elbows bent near a right angle, hands passing the hips; armature space, forward -Y
                ch[f"hand_{side}"].append((sh.x - s * 0.02 * max(0.0, c), sh.y - 0.10 - amp * c, sh.z - 0.36 + 0.06 * max(0.0, c)))
            else:  # the elbow bends and the hand comes in as the arm comes forward
                ch[f"hand_{side}"].append((sh.x + s * (0.05 - 0.025 * max(0.0, c)), sh.y - amp * c,
                                           sh.z - info["arm"] * 0.93 + 0.02 * abs(c) + 0.05 * max(0.0, c) ** 2))
        beat.append((ul, swing))
    bob = np.array([b[2] for b in ch["body"]])
    nod = _spring(bob, fps, HEAD_HZ, HEAD_DAMP)
    bones = {b: [] for b in ("pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head", "clavicle_l", "clavicle_r", "hand_l", "hand_r")}
    for i, (ul, swing) in enumerate(beat):
        tw, ls = twist(ul), tilt(ul)
        pitch = math.radians(2.0 if run else 1.2) * math.cos(4 * math.pi * (ul - 0.08))  # the trunk nods into each footfall
        bones["pelvis"].append(_quat(arm, "pelvis", (FWD, ls), (UP, -tw), (X, math.radians(1.2) * math.cos(4 * math.pi * (ul - g["duty"] + 0.1)))))
        yaw, roll = -tw, ls
        for name, late, t_share, l_share, r_share in SPINE:
            t, r = twist(ul - late) * t_share, tilt(ul - late) * r_share
            yaw, roll = yaw + t, roll + r
            bones[name].append(_quat(arm, name, (FWD, r), (UP, t), (X, lean * l_share + (pitch if name == "spine_02" else 0.0))))
        bones["neck_01"].append(_quat(arm, "neck_01", (FWD, -0.5 * roll), (UP, -0.4 * yaw), (X, -0.4 * lean)))
        bones["head"].append(_quat(arm, "head", (FWD, -0.3 * roll), (UP, -0.3 * yaw), (X, -0.35 * lean - NOD * nod[i])))
        for side, s in (("l", 1), ("r", -1)):
            a = swing[side] if activity != "pram" else 0.0
            amp = st["arm"] if activity != "pram" else 0.0
            bones[f"clavicle_{side}"].append(_quat(arm, f"clavicle_{side}", (UP, -s * math.radians(3) * amp * math.cos(a))))
            bones[f"hand_{side}"].append(_quat(arm, f"hand_{side}", (X, -math.radians(10) * amp * math.sin(a - 0.3))))
    for q in bones.values():  # one hemisphere per channel, so the keys never flip
        for j in range(1, len(q)):
            if q[j].dot(q[j - 1]) < 0:
                q[j].negate()
    # calibrate the knees and elbows on the first pose, before anything is keyed
    arm.location = ch["body"][0]
    for side in ("l", "r"):
        ctl[f"foot_{side}"].location = ch[f"foot_{side}"][0]
        ctl[f"foot_{side}"].rotation_mode = "QUATERNION"
        ctl[f"foot_{side}"].rotation_quaternion = ch[f"rot_{side}"][0]
        if activity != "pram":
            ctl[f"hand_{side}"].location = ch[f"hand_{side}"][0]
    for name, q in bones.items():
        arm.pose.bones[name].rotation_mode = "QUATERNION"
        arm.pose.bones[name].rotation_quaternion = q[0]
    cast.calibrate_poles(arm, view_layer)
    fr = np.asarray(frames, dtype=np.float64)
    key_vectors(arm, "location", fr, ch["body"])
    for side in ("l", "r"):
        key_vectors(ctl[f"foot_{side}"], "location", fr, ch[f"foot_{side}"])
        key_vectors(ctl[f"foot_{side}"], "rotation_quaternion", fr, ch[f"rot_{side}"])
        if activity != "pram":
            key_vectors(ctl[f"hand_{side}"], "location", fr, ch[f"hand_{side}"])
    for name, q in bones.items():
        key_vectors(arm, f'pose.bones["{name}"].rotation_quaternion', fr, [tuple(v) for v in q])
    flesh = _spring(bob, fps, FLESH_HZ, FLESH_DAMP) / 0.01 * g["bounce"] * st["flesh"]
    for key in add_flesh(arm, info):
        key_array(key, 'key_blocks["flesh"].value', 0, fr, flesh)
    for w in prams or []:
        w.rotation_mode = "XYZ"
        key_array(w, "rotation_euler", 1, fr, np.asarray(distance) / 0.118)
