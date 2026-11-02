"""Cycle, lock up, catch the bus (the community film's station scene): a cyclist rides in and stops by the proposed
lockers, gets off, wheels the bicycle into the open locker, closes and locks the door (its lamp turns from green to red)
and walks on towards the station; after the cut they reach the existing bus stop and wait by the bus.

Two rigs of the same person share the work:
- the rider (trailfolk.cyclist) rides in and gets off, its controls moved from the pedals and bars onto the bicycle;
- a walker (cast.person_on_root, gait.bake_gait) takes over, standing beside the bicycle, posed exactly as the rider
  ends, and walks the bicycle in, the door shut and on.
The bicycle leaves the rider's root and is keyed in the world.

Positions are worked out in the locker bank's own frame (+X out of the doors towards the path, +Y along the bank; street.py
build_lockers) and put on the ground by ray casts. Timings are frames at the scene's rate.
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

import bike as bk
import cast
import gait
import stride
import trailfolk

UNIT_W, UNIT_D = 0.8, 2.0  # street.build_lockers
SIDE = 0.45  # the walker's hips this far to the bicycle's left as they wheel it
BONES = ("pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head", "clavicle_l", "clavicle_r", "hand_l", "hand_r", "ball_l", "ball_r")


def _hermite_track(keys, frames):
    """Values through (frame, vector) keys, smooth (Catmull-Rom tangents, still at the ends), at each frame."""
    t = np.array([k[0] for k in keys], dtype=np.float64)
    p = np.array([np.atleast_1d(k[1]) for k in keys], dtype=np.float64)
    m = np.zeros_like(p)
    for i in range(1, len(keys) - 1):
        m[i] = (p[i + 1] - p[i - 1]) / (t[i + 1] - t[i - 1])
    out = np.empty((len(frames), p.shape[1]))
    for j, f in enumerate(frames):
        i = int(np.clip(np.searchsorted(t, f) - 1, 0, len(t) - 2))
        h = t[i + 1] - t[i]
        q = float(np.clip((f - t[i]) / h, 0.0, 1.0))
        out[j] = stride.hermite(p[i], p[i + 1], m[i] * h, m[i + 1] * h, q)
    return out


def _slerp_track(keys, frames):
    """Quaternions through (frame, Quaternion) keys, eased between them."""
    out = []
    for f in frames:
        i = max(0, min(len(keys) - 2, int(np.searchsorted([k[0] for k in keys], f)) - 1))
        (f0, q0), (f1, q1) = keys[i], keys[i + 1]
        q = q0.slerp(q1, float(stride.smooth((f - f0) / max(1e-6, f1 - f0))))
        if out and Quaternion(out[-1]).dot(q) < 0:
            q.negate()
        out.append(tuple(q))
    return out


def _ground(scene, names=("terrain", "trail", "roads")):
    """z of the ground (path, road or terrain) under (x, y), looking down from `above`."""
    dg = scene.view_layers[0].depsgraph
    scene.view_layers[0].update()
    objs = [o.evaluated_get(dg) for o in scene.objects if o.type == "MESH" and any(o.name.endswith(n) for n in names)]

    def at(x, y, above):
        best = None
        for o in objs:
            inv = o.matrix_world.inverted()
            ok, loc, _, _ = o.ray_cast(inv @ Vector((x, y, above)), (inv.to_3x3() @ Vector((0, 0, -1))).normalized())
            if ok:
                z = (o.matrix_world @ loc).z
                best = z if best is None else max(best, z)
        return above - 1.5 if best is None else best
    return at


def _bezier(p0, p1, p2, p3, n=200):
    q = np.linspace(0, 1, n)[:, None]
    return (1 - q) ** 3 * p0 + 3 * (1 - q) ** 2 * q * p1 + 3 * (1 - q) * q * q * p2 + q ** 3 * p3


def _along(path, s):
    """Points and headings at arc lengths s along a polyline (N, 2)."""
    seg = np.hypot(*np.diff(path, axis=0).T)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    x = np.interp(s, cum, path[:, 0])
    y = np.interp(s, cum, path[:, 1])
    tan = np.gradient(path, axis=0)
    h = np.unwrap(np.arctan2(tan[:, 1], tan[:, 0]))
    return np.column_stack([x, y]), np.interp(s, cum, h), cum[-1]


def _profile(length, v, start, fps, accel=0.45, decel=0.7):
    """Arc length per frame from `start`: easing up to v over `accel` s, cruising, easing to a stop over `decel` s."""
    ta, td = accel, decel
    tc = max(0.0, (length - v * (ta + td) / 2) / v)
    total = ta + tc + td
    t = np.arange(int(math.ceil(total * fps)) + 1) / fps
    s = np.where(t < ta, v * t * t / (2 * ta), np.where(t < ta + tc, v * ta / 2 + v * (t - ta),
                 v * ta / 2 + v * tc + v * (t - ta - tc) - v * (t - ta - tc) ** 2 / (2 * td)))
    return start + np.arange(len(t)), np.minimum(s * length / max(s[-1], 1e-6), length)


def _hide(objs, visible_from, visible_to, frames):
    """Key render and viewport visibility so `objs` show only over [visible_from, visible_to]."""
    for o in objs:
        for f, show in ((1, visible_from <= 1), (visible_from, True), (visible_to + 1, False)):
            if 1 <= f <= frames:
                o.hide_render = o.hide_viewport = not show
                o.keyframe_insert("hide_render", frame=f)
                o.keyframe_insert("hide_viewport", frame=f)
        for fc in _fcurves(o):
            if fc.data_path.startswith("hide_"):
                for kp in fc.keyframe_points:
                    kp.interpolation = "CONSTANT"


def _fcurves(obj):
    import dress
    return list(dress.cast_iter_fcurves(obj)) if obj.animation_data and obj.animation_data.action else []


def _eval(obj, path, index, frame, default):
    for fc in _fcurves(obj):
        if fc.data_path == path and fc.array_index == index:
            return fc.evaluate(frame)
    return default


def _lamp(door, w, colour, coll):
    """A small lamp above a locker door's handle: green when free, red when locked; returns its material."""
    import bmesh
    mat = bpy.data.materials.new(door.name + "-lamp")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em, out = nt.nodes.new("ShaderNodeEmission"), nt.nodes.new("ShaderNodeOutputMaterial")
    em.inputs["Color"].default_value = (*colour, 1)
    em.inputs["Strength"].default_value = 4.0
    nt.links.new(em.outputs[0], out.inputs[0])
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0.024, w - 0.07, 0.98)) @ Matrix.Diagonal((0.012, 0.05, 0.028, 1)))
    me = bpy.data.meshes.new(door.name + "-lamp")
    bm.to_mesh(me)
    lamp = bpy.data.objects.new(door.name + "-lamp", me)
    lamp.data.materials.append(mat)
    coll.objects.link(lamp)
    lamp.parent = door
    return em


GREEN, RED = (0.05, 0.9, 0.2), (1.0, 0.06, 0.04)


def lock_up(scene, root, w, arr, pid, coll, prefix, gaze):
    """The whole sequence for the walker `w` (a cyclist with locksUp) on its keyed `root`; returns the report entry."""
    fps = scene.render.fps / scene.render.fps_base
    n = len(arr)
    frames = np.arange(1, n + 1, dtype=np.float64)
    vl = scene.view_layers[0]
    built = {}
    report = trailfolk.cyclist(scene, root, w, arr, pid, coll, prefix, gaze, built)
    parts, rider = built["parts"], built["person"]
    ground = _ground(scene)

    # where the ride ends: the first frame within a few centimetres of where the bicycle comes to rest (it creeps the rest)
    left_m = np.hypot(*(arr[:, 0:2].astype(np.float64) - arr[-1, 0:2]).T)
    s0 = int(np.argmax(left_m < 0.06))
    stop = s0 + 1  # Blender frame
    # the bank of lockers and its open unit
    lroot = next(o for o in scene.objects if o.type == "EMPTY" and o.name.endswith(":lockers"))
    doors = sorted((o for o in lroot.children if "locker-door-" in o.name), key=lambda o: int(o.name.rsplit("-", 1)[1]))
    unit = next(i for i, o in enumerate(doors) if abs(o.rotation_euler.z) > 0.5)
    vl.update()
    L = lroot.matrix_world.copy()
    lo, lx, ly = L.translation.xy, L.col[0].xy.normalized(), L.col[1].xy.normalized()
    y0 = -len(doors) * UNIT_W / 2
    yc = y0 + (unit + 0.5) * UNIT_W
    face = UNIT_D / 2 + 0.012

    def world(p):
        return lo + lx * float(p[0]) + ly * float(p[1])

    def local(v):
        r = Vector(v[:2]) - lo
        return np.array([r.dot(lx), r.dot(ly)])

    def yaw_of(direction):
        v = lx * float(direction[0]) + ly * float(direction[1])
        return math.atan2(v.y, v.x)

    # ---------------------------------------------------------------- the bicycle's way in and the walker beside it
    b_stop = local(arr[s0, 0:2])
    head0 = np.array([Vector((math.cos(arr[s0, 3]), math.sin(arr[s0, 3]))).dot(lx), Vector((math.cos(arr[s0, 3]), math.sin(arr[s0, 3]))).dot(ly)])
    t_mouth = np.array([face + 1.0, yc])
    t_in = np.array([face - 0.97, yc])
    path = np.vstack([_bezier(b_stop, b_stop + head0 * 0.8, t_mouth + np.array([0.8, 0.0]), t_mouth), np.linspace(t_mouth, t_in, 60)[1:]])
    swap = stop + 34
    b_frames, b_s = _profile(float(np.hypot(*np.diff(path, axis=0).T).sum()), 1.25, swap + 3, fps)
    b_xy, b_h, b_len = _along(path, b_s)
    mouth_s = float(np.hypot(*np.diff(path[:200], axis=0).T).sum())
    # the walker: beside the bicycle, falling in behind it as it goes in; never past the doorway
    fwd = np.column_stack([np.cos(b_h), np.sin(b_h)])
    left = np.column_stack([-fwd[:, 1], fwd[:, 0]])
    q = stride.smooth((b_s - mouth_s) / (0.55 * (b_len - mouth_s)))[:, None]
    off_f, off_l = -0.12 * (1 - q) - 0.95 * q, SIDE * (1 - q) + 0.06 * q
    p_xy = b_xy + fwd * off_f + left * off_l
    p_xy[:, 0] = np.maximum(p_xy[:, 0], face + 0.22)
    p_xy = np.column_stack([np.convolve(np.pad(c, 4, mode="edge"), np.ones(9) / 9, mode="valid") for c in p_xy.T])
    clamp = int(np.argmax(p_xy[:, 0] <= face + 0.23)) if (p_xy[:, 0] <= face + 0.23).any() else len(p_xy) - 8
    release = int(b_frames[min(clamp + 4, len(b_frames) - 1)])
    in_end = int(b_frames[-1])

    # ---------------------------------------------------------------- the walker's whole track (locker frame, then world)
    pos = np.zeros((n, 2))
    head = np.zeros(n)
    pos[: swap] = b_xy[0] + fwd[0] * -0.12 + left[0] * SIDE
    head[: swap] = b_h[0]
    i0 = int(b_frames[0]) - 1
    for j, f in enumerate(b_frames):
        if f - 1 < n:
            pos[int(f) - 1], head[int(f) - 1] = p_xy[j], b_h[j]
    pos[swap:i0], head[swap:i0] = pos[swap - 1], head[swap - 1]
    # facing into the locker from where the pushing ends
    into = math.pi
    k = in_end
    head[k - 1:] = into
    pos[k - 1:] = p_xy[-1]
    end_push = p_xy[-1]
    # a step back from the doorway to clear the door's swing, then one forward with it as it closes
    back_to = np.array([face + 1.05, yc + 0.18])
    step_b = (k + 2, k + 22)
    close = (step_b[1] + 4, step_b[1] + 32)
    shut_at = np.array([face + 0.58, yc + 0.18])
    lock = (close[1], close[1] + 26)
    for (a, b), p0, p1 in ((step_b, end_push, back_to), ((close[0] + 8, close[1]), back_to, shut_at)):
        for f in range(a, min(b, n) + 1):
            e = float(stride.smooth((f - a) / (b - a)))
            pos[f - 1] = p0 + (p1 - p0) * e
        pos[min(b, n):] = p1
    # turn away from the locker and walk on along the path towards the station
    go = lock[1] - 4
    line_x = b_stop[0] - 0.7
    away = np.vstack([_bezier(shut_at, shut_at + np.array([0.45, -0.45]), np.array([line_x, shut_at[1] - 1.6]), np.array([line_x, shut_at[1] - 2.4])),
                      np.array([[line_x, shut_at[1] - 2.4 - 40.0]])])
    turn = 14
    a_frames, a_s = _profile(40.0, 1.3, go + turn, fps, decel=0.1)
    a_xy, a_h, _ = _along(np.vstack([away[:-1], np.linspace(away[-2], away[-1], 80)[1:]]), a_s)
    h_from = into
    for f in range(go, go + turn + 1):
        if f <= n:
            e = float(stride.smooth((f - go) / turn))
            head[f - 1] = h_from + ((a_h[0] - h_from + math.pi) % (2 * math.pi) - math.pi) * e
    cut = int(scene["shot_ends"][0]) if "shot_ends" in scene.keys() else n  # the first shot's last frame
    for j, f in enumerate(a_frames):
        if f <= cut:
            pos[int(f) - 1], head[int(f) - 1] = a_xy[j], a_h[j]
    # (the heading in the locker frame becomes a world yaw)
    world_xy = np.array([tuple(world(p)) for p in pos])
    world_h = np.array([yaw_of((math.cos(h), math.sin(h))) for h in head])
    # after the cut: the last few metres to the existing bus stop, and a wait by the bus, facing it
    flag = next(o for o in scene.objects if o.type == "EMPTY" and o.name.endswith(":bus-stop-flag"))
    bus = next(o for o in scene.objects if o.type == "EMPTY" and o.name.endswith(":bus"))
    if cut < n:
        fl, bu = flag.matrix_world.translation.xy, bus.matrix_world.translation.xy
        u = (Vector(tuple(world(b_stop))) - fl).normalized()
        perp = Vector((-u.y, u.x))
        perp = perp if perp.dot(bu - fl) > 0 else -perp
        p_start, p_end = fl + u * 4.8 + perp * 1.3, fl + u * 0.7 + perp * 1.0
        w_path = np.array([tuple(p_start + (p_end - p_start) * t) for t in np.linspace(0, 1, 50)])
        s_frames, s_s = _profile((p_end - p_start).length, 1.25, cut + 1, fps)
        s_xy, s_h, _ = _along(w_path, s_s)
        world_xy[cut:] = s_xy[-1]
        world_h[cut:] = s_h[-1]
        for j, f in enumerate(s_frames):
            if f <= n:
                world_xy[int(f) - 1], world_h[int(f) - 1] = s_xy[j], s_h[j]
        face_bus = math.atan2(*(bu - p_end)[::-1])
        t0 = int(s_frames[-1]) + 4
        for f in range(t0, n + 1):
            e = float(stride.smooth((f - t0) / 22))
            world_h[f - 1] = s_h[-1] + ((face_bus - s_h[-1] + math.pi) % (2 * math.pi) - math.pi) * e
    world_h = np.unwrap(world_h)
    zs = np.array([ground(x, y, float(arr[min(i, s0), 2]) + 1.5) if i < cut else ground(x, y, float(flag.matrix_world.translation.z) + 1.5)
                   for i, (x, y) in enumerate(world_xy)])

    # ---------------------------------------------------------------- the bicycle in the world
    bike_root = parts["root"]
    bike_root.parent = None
    b_world = np.zeros((n, 4))  # x, y, z, yaw
    b_world[:, 0:3], b_world[:, 3] = arr[:, 0:3], np.unwrap(arr[:, 3].astype(np.float64))
    b_world[s0:] = b_world[s0]
    for j, f in enumerate(b_frames):
        if f <= n:
            xy = world(b_xy[j])
            inside = float(stride.smooth((face + 0.25 - b_xy[j][0]) / 0.5)) * 0.06  # up onto the locker's floor
            b_world[int(f) - 1] = (xy.x, xy.y, ground(xy.x, xy.y, float(arr[s0, 2]) + 1.0) + inside, yaw_of((math.cos(b_h[j]), math.sin(b_h[j]))))
    last = min(int(b_frames[-1]), n)
    b_world[last:] = b_world[last - 1]
    b_world[:, 3] = np.unwrap(b_world[:, 3])
    gait.key_vectors(bike_root, "location", frames, b_world[:, 0:3])
    bike_root.rotation_mode = "XYZ"
    gait.key_array(bike_root, "rotation_euler", 2, frames, b_world[:, 3])
    roll = cast.distances(b_world[:, 0:2]) / parts.get("wheel_r", bk.WHEEL_R)
    for wh in (parts["rear_wheel"], parts["front_wheel"]):
        gait.key_array(wh, "rotation_euler", 1, frames, roll)

    def bike_mat(f):
        r = b_world[min(n, max(1, int(f))) - 1]
        return Matrix.Translation(Vector(r[0:3])) @ Matrix.Rotation(r[3], 4, "Z")

    saddle = parts["post"].matrix_basis @ Vector((0.02, 0, 0.09))
    grip_l = parts["bars"].matrix_basis @ (parts["grip_offset"] + Vector((-0.01, 0, 0.02)))

    # ---------------------------------------------------------------- the walker
    wroot = bpy.data.objects.new(prefix + "walk-root", None)
    coll.objects.link(wroot)
    gait.key_vectors(wroot, "location", frames, np.column_stack([world_xy, zs]))
    wroot.rotation_mode = "XYZ"
    gait.key_array(wroot, "rotation_euler", 2, frames, world_h)
    walker = cast.person_on_root(pid, wroot, prefix + "walk:", coll, float(w["heightM"]), "walk")
    # signed distance along the way the body faces (a step back runs the stride backwards); none across the cut
    step = np.zeros(n)
    dxy = np.diff(world_xy, axis=0)
    step[1:] = dxy[:, 0] * np.cos(world_h[1:]) + dxy[:, 1] * np.sin(world_h[1:])
    if cut < n:
        step[cut] = 0.0
    look = np.zeros((n, 2))
    look[swap - 1: lock[1], 1] = math.radians(-22)  # watching the bicycle, the door and the lock
    look[:, 1] = np.convolve(np.pad(look[:, 1], 10, mode="edge"), np.ones(21) / 21, mode="valid")
    gait.bake_gait(walker, frames, np.cumsum(step), 0.0, "walk", vl, gaze=look)
    arm = walker["arm"]

    def arm_world(f):
        r = Matrix.Translation(Vector((world_xy[f - 1][0], world_xy[f - 1][1], zs[f - 1]))) @ Matrix.Rotation(world_h[f - 1], 4, "Z")
        loc = Vector([_eval(arm, "location", i, f, arm.location[i]) for i in range(3)])
        return r @ Matrix.LocRotScale(loc, arm.rotation_euler.to_quaternion(), arm.scale)

    # the hands: on the grip and the saddle, then the door's handle, then the lock (door frame below)
    door = doors[unit]
    hinge = Vector(door.location)
    angle = np.full(n, door.rotation_euler.z)
    for f in range(close[0], n + 1):
        angle[f - 1] = door.rotation_euler.z * (1 - float(stride.smooth((f - close[0]) / (close[1] - close[0]))))
    gait.key_array(door, "rotation_euler", 2, frames, angle)
    w_door = UNIT_W - 0.03

    def door_point(f, p):
        return L @ Matrix.Translation(hinge) @ Matrix.Rotation(angle[f - 1], 4, "Z") @ Vector(p)

    handle = (0.06, w_door - 0.07, 0.74)
    lock_pt = (0.05, w_door - 0.07, 0.86)
    holds = {"l": [], "r": []}  # (from, to, ease, point(f) in the world)
    holds["l"].append((swap - 2, int(b_frames[max(0, np.argmax(b_xy[:, 0] < face + 0.62))]), 8, lambda f: bike_mat(f) @ grip_l))
    holds["r"].append((swap - 2, release, 8, lambda f: bike_mat(f) @ saddle))
    holds["l"].append((close[0] - 8, close[1] + 2, 8, lambda f: door_point(f, handle)))
    holds["l"].append((close[1] + 2, lock[1] - 6, 6, lambda f: door_point(f, lock_pt) + Vector((0, 0, 0.012 * math.sin(max(0, f - close[1] - 8) * 0.5)))))
    for side in "lr":
        t = walker["ctl"][f"hand_{side}"]
        base = np.array([[_eval(t, "location", i, f, t.location[i]) for i in range(3)] for f in range(1, n + 1)])
        new = base.copy()
        for a, b, ease, point in holds[side]:
            for f in range(max(1, a - ease), min(n, b + ease) + 1):
                wgt = float(min(stride.smooth((f - (a - ease)) / ease), stride.smooth((b + ease - f) / ease)))
                p = arm_world(f).inverted() @ point(f)
                new[f - 1] = new[f - 1] * (1 - wgt) + np.array(p) * wgt
        gait.key_vectors(t, "location", frames, new)
    # a grip while holding (relax_hands' curl, keyed)
    grip_keys = [(1, 0.8), (release, 0.8), (release + 10, 0.3), (close[0] - 8, 0.3), (close[0], 0.8), (lock[1], 0.8), (lock[1] + 10, 0.3)]
    for pb in arm.pose.bones:
        if any(pb.name.startswith(f) for f in ("index", "middle", "ring", "pinky")):
            pb.rotation_mode = "XYZ"
            for f, c in grip_keys:
                pb.rotation_euler[0] = c
                pb.keyframe_insert("rotation_euler", index=0, frame=f)
    # the lamp: green while the locker is free, red once it is locked
    lamps = [_lamp(dr, w_door, RED if i % 2 == 0 and i != unit else GREEN, coll) for i, dr in enumerate(doors)]
    sock = lamps[unit].inputs["Color"]
    for f, c in ((1, GREEN), (lock[0] + 16, GREEN), (lock[0] + 17, RED)):
        sock.default_value = (*c, 1)
        sock.keyframe_insert("default_value", frame=f)

    # ---------------------------------------------------------------- the rider gets off, ending as the walker begins
    rarm = rider["arm"]
    rctl = rider["ctl"]
    crank, pedals = parts["crank"], {"l": parts["pedal_l"], "r": parts["pedal_r"]}
    b_inv = bike_mat(swap).inverted()
    # the body: forward off the saddle over the top tube as the bicycle stops (so the left foot reaches the ground),
    # round over the left foot as the right leg comes over, and standing as the walker stands
    aw = b_inv @ arm_world(swap)
    a_loc, a_rot, _ = aw.decompose()
    r0 = Vector(rarm.location)
    r_off = r0 + Vector((0.18, 0.06, -0.15))
    for side in "lr":  # the feet's controls: off the pedals onto the bicycle, the pedals' motion baked in
        t = rctl[f"foot_{side}"]
        basis = t.matrix_basis.copy()
        ped = pedals[side]
        ride = []
        for f in range(1, n + 1):
            a = _eval(crank, "rotation_euler", 1, f, crank.rotation_euler[1])
            m = Matrix.Translation(crank.location) @ Matrix.Rotation(a, 4, "Y") @ Matrix.Translation(ped.location) @ Matrix.Rotation(-a, 4, "Y") @ basis
            ride.append(m.translation)
        rot = basis.to_quaternion()
        t.parent = bike_root
        t.matrix_parent_inverse = Matrix.Identity(4)
        end = b_inv @ (Matrix.Translation(Vector((world_xy[swap - 1][0], world_xy[swap - 1][1], zs[swap - 1]))) @ Matrix.Rotation(world_h[swap - 1], 4, "Z")
                       @ Matrix.LocRotScale(Vector([_eval(walker["ctl"][f"foot_{side}"], "location", i, swap, 0.0) for i in range(3)]),
                                            Quaternion([_eval(walker["ctl"][f"foot_{side}"], "rotation_quaternion", i, swap, 1.0 if i == 0 else 0.0) for i in range(4)]), Vector((1, 1, 1))))
        if side == "l":  # down to the ground as the bicycle stops
            land = Vector((saddle.x + 0.24, 0.24, end.translation.z))
            keys = [(stop - 12, ride[stop - 13]), (stop - 6, (ride[stop - 13] + land) / 2 + Vector((0, 0, 0.08))), (stop, land), (stop + 22, land),
                    (stop + 27, (land + end.translation) / 2 + Vector((0, 0, 0.05))), (stop + 32, end.translation), (swap, end.translation)]
        else:  # back and up over the back wheel, and down beside the other
            on_pedal = ride[stop - 1]
            keys = [(stop + 2, on_pedal), (stop + 9, Vector((-0.45, -0.08, 0.62))), (stop + 15, Vector((-0.55, 0.18, 0.72))), (stop + 19, end.translation + Vector((-0.15, 0.0, 0.18))),
                    (stop + 23, end.translation), (swap, end.translation)]
        first = keys[0][0]
        auth = _hermite_track([(f, tuple(v)) for f, v in keys], np.arange(first, n + 1))
        rows = [tuple(ride[f - 1]) for f in range(1, first)] + [tuple(r) for r in auth]
        gait.key_vectors(t, "location", frames, rows)
        t.rotation_mode = "QUATERNION"
        gait.key_vectors(t, "rotation_quaternion", frames, _slerp_track([(1, rot), (first, rot), (swap, end.to_quaternion())], frames))
    for side in "lr":  # the hands' controls: off the bars onto the bicycle
        t = rctl[f"hand_{side}"]
        grip = parts["bars"].matrix_basis @ t.matrix_basis.translation
        t.parent = bike_root
        t.matrix_parent_inverse = Matrix.Identity(4)
        target = grip_l if side == "l" else saddle
        keys = [(1, tuple(grip)), (stop + 22, tuple(grip)), (swap - 4, tuple(target)), (swap, tuple(target))]
        gait.key_vectors(t, "location", frames, _hermite_track(keys, frames))
    gait.key_vectors(rarm, "location", frames, _hermite_track([(1, tuple(r0)), (stop - 14, tuple(r0)), (stop, tuple(r_off)), (stop + 12, tuple(r_off + (Vector(a_loc) - r_off) * 0.25)),
                                                                     (stop + 23, tuple(r_off + (Vector(a_loc) - r_off) * 0.55 - Vector((0, 0, 0.02)))), (stop + 32, tuple(a_loc)), (swap, tuple(a_loc))], frames))
    rarm.rotation_mode = "QUATERNION"
    q0 = rarm.rotation_euler.to_quaternion()
    gait.key_vectors(rarm, "rotation_quaternion", frames, _slerp_track([(1, q0), (stop, q0), (swap, a_rot)], frames))
    for name in BONES:
        pb = rarm.pose.bones[name]
        pb.rotation_mode = "QUATERNION"
        start = Quaternion([_eval(rarm, f'pose.bones["{name}"].rotation_quaternion', i, stop, pb.rotation_quaternion[i]) for i in range(4)])
        target = Quaternion([_eval(arm, f'pose.bones["{name}"].rotation_quaternion', i, swap, 1.0 if i == 0 else 0.0) for i in range(4)])
        riding = [Quaternion([_eval(rarm, f'pose.bones["{name}"].rotation_quaternion', i, f, pb.rotation_quaternion[i]) for i in range(4)]) for f in range(1, stop + 1)]
        tail = _slerp_track([(stop, start), (stop + 26 if name != "pelvis" else stop + 20, target), (n, target)], np.arange(stop + 1, n + 1))
        gait.key_vectors(rarm, f'pose.bones["{name}"].rotation_quaternion', frames, [tuple(q) for q in riding] + tail)
    # one person on screen at a time: the rider until the swap, the walker after
    _hide([o for o in rarm.children if o.type == "MESH"], 1, swap, n)
    _hide([o for o in arm.children if o.type == "MESH"], swap + 1, n, n)
    report.update({"locksUp": {"stop": stop, "swap": swap, "intoLocker": [int(b_frames[0]), in_end], "release": release, "doorShut": list(close),
                               "locked": lock[0] + 17, "walksOn": go + turn, "unit": unit}})
    return report
