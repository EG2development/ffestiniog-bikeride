"""The community film's cargo cycles (src/three-core/cycles.ts): a long-tail, a two-wheeled cargo bike with its box
ahead of the rider (a "long john") and a Christiania-style box tricycle, built on bike.py's hybrid and carrying younger
children or shopping.

Sizes are those of the cycles sold in the UK: the long-tail's rear axle 0.40 m further back than the hybrid's, under a
0.85 m deck with footboards and wheel guards; the long john 2.5 m long, a 20-inch front wheel 1.0 m ahead of the head
tube that a rod steers, its plywood box 0.70 m long and 0.58 m wide; the box tricycle's box 0.85 m long and 0.82 m wide
at the rim between two 20-inch wheels, its bar on posts at the box's back, so the box is fitted to the rider's hands
(`finish`) once the rider is seated. Passengers sit on a bench in the box or astride the long-tail's seat, facing
forward with their hands in their laps or on the rail, and look about (`seat_children`).
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import bike
import cast
import idle
from bike import _mat, _object, _tube, _wheel

SMALL_R = 0.254  # a 20-inch wheel
LEAN_DEG = {"longtail": 26.0, "cargo": 24.0, "christiania": 14.0}  # riders sit up on a loaded cycle
LONGTAIL = {"rear_extra": 0.40, "deck_z": 0.74, "deck_x": (-1.17, -0.33), "seat_x": (-0.62, -0.92), "board_z": 0.33}
CARGO = {"axle_x": 1.50, "box_x": (0.52, 1.20), "floor_z": 0.32, "wall_m": 0.36, "half_w": 0.29}
CHRISTIANIA = {"length": 0.85, "floor_z": 0.30, "top_z": 0.80, "half_floor": 0.35, "half_top": 0.41, "wheel_y": 0.48}
BAG_COLOURS = [(0.10, 0.22, 0.12), (0.55, 0.42, 0.20), (0.06, 0.10, 0.25), (0.40, 0.08, 0.10)]


def _materials():
    return {
        "ply": _mat("cargo-plywood", (0.50, 0.36, 0.22, 1), 0.6),
        "ply-edge": _mat("cargo-plywood-edge", (0.30, 0.20, 0.12, 1), 0.7),
        "cushion": _mat("cargo-cushion", (0.04, 0.05, 0.06, 1), 0.85),
        "crate": _mat("cargo-crate", (0.10, 0.12, 0.10, 1), 0.6),
        "greens": _mat("cargo-greens", (0.10, 0.28, 0.06, 1), 0.8),
    }


def _cube(bm, centre, size):
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(centre) @ Matrix.Diagonal((*size, 1)))


def _open_box(bm, x0, x1, half_floor, half_top, floor_z, top_z, front_top_x=None, t=0.012):
    """An open-topped box from panels `t` thick: floor, two (splayed) sides, back, and a front that may slope out."""
    fx = x1 if front_top_x is None else front_top_x
    quads = [
        ((x0, -half_floor, floor_z), (x1, -half_floor, floor_z), (x1, half_floor, floor_z), (x0, half_floor, floor_z)),
        ((x0, -half_floor, floor_z), (x0, half_floor, floor_z), (x0, half_top, top_z), (x0, -half_top, top_z)),
        ((x1, half_floor, floor_z), (x1, -half_floor, floor_z), (fx, -half_top, top_z), (fx, half_top, top_z)),
        ((x0, -half_top, top_z), (fx, -half_top, top_z), (x1, -half_floor, floor_z), (x0, -half_floor, floor_z)),
        ((x0, half_floor, floor_z), (x1, half_floor, floor_z), (fx, half_top, top_z), (x0, half_top, top_z)),
    ]
    for q in quads:
        bm.faces.new([bm.verts.new(Vector(p)) for p in q])
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=t)


def _rim(bm, pts, r=0.012):
    for a, b in zip(pts, pts[1:] + pts[:1]):
        _tube(bm, a, b, r, seg=8)


def _shopping(prefix, coll, parent, spots, seed):
    """Reusable bags and a crate of vegetables at `spots` [(centre, size)], bicycle space."""
    m = _materials()
    for i, (c, size) in enumerate(spots):
        bm = bmesh.new()
        _cube(bm, c, size)
        if i == 0:  # a crate, with greens showing over its rim
            ob = _object(prefix + f"load-{i}", bm, [m["crate"]], coll, parent, smooth=False)
            bm = bmesh.new()
            s = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=1.0)
            for v in s["verts"]:
                v.co = Vector((c[0] + v.co.x * size[0] * 0.42, c[1] + v.co.y * size[1] * 0.42, c[2] + size[2] * 0.5 + max(v.co.z, 0) * 0.06))
            _object(prefix + "load-greens", bm, [m["greens"]], coll, parent)
        else:
            colour = BAG_COLOURS[(seed + i) % len(BAG_COLOURS)]
            ob = _object(prefix + f"load-{i}", bm, [_mat(f"cargo-bag-{colour[0]:.2f}", (*colour, 1), 0.85)], coll, parent, smooth=False)
            bev = ob.modifiers.new("soft", "BEVEL")
            bev.width, bev.segments = 0.02, 2


def build_longtail(prefix, coll, paint, load):
    lt = LONGTAIL
    parts = bike.build_bicycle(prefix, coll, paint, step_through=True, rear_extra=lt["rear_extra"])
    root, mats, m = parts["root"], parts["mats"], _materials()
    rear = parts["rear_axle"]
    z, (xa, xb) = lt["deck_z"], lt["deck_x"]
    bm = bmesh.new()
    for side in (-0.13, 0.13):  # the rack's rails, its struts to the rear axle, and the footboard hangers
        _tube(bm, (xa, side, z - 0.03), (xb, side, z - 0.03), 0.011)
        _tube(bm, (rear.x, side * 0.5, rear.z), (xa + 0.06, side, z - 0.03), 0.010)
        _tube(bm, (rear.x, side * 0.5, rear.z), (xb - 0.05, side, z - 0.03), 0.010)
        _tube(bm, (xb - 0.08, side, z - 0.03), (xb - 0.08, side * 1.7, lt["board_z"]), 0.009)
        _tube(bm, (xa + 0.25, side, z - 0.03), (xa + 0.25, side * 1.7, lt["board_z"]), 0.009)
    _object(prefix + "longtail-rack", bm, [mats["paint"]], coll, root)
    bm = bmesh.new()
    _cube(bm, ((xa + xb) / 2, 0, z), (xb - xa, 0.30, 0.025))
    for side in (-1, 1):
        _cube(bm, (xa + 0.45, side * 0.235, lt["board_z"]), (0.55, 0.13, 0.018))  # footboards
    _object(prefix + "longtail-deck", bm, [m["ply-edge"]], coll, root, smooth=False)
    bm = bmesh.new()
    for side in (-1, 1):  # wheel guards keep feet out of the spokes
        bm_side = [(xa + 0.08, side * 0.15, 0.42), (xb - 0.08, side * 0.15, 0.42), (xb - 0.08, side * 0.15, z - 0.05), (xa + 0.08, side * 0.15, z - 0.05)]
        bm.faces.new([bm.verts.new(Vector(p)) for p in bm_side])
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.006)
    _object(prefix + "longtail-guards", bm, [mats["black"]], coll, root, smooth=False)
    kids = (load.get("children") or [])
    parts["seats"] = []
    for i, _h in enumerate(kids):
        x = lt["seat_x"][i]
        bm = bmesh.new()
        _cube(bm, (x, 0, z + 0.035), (0.26, 0.24, 0.045))  # a padded seat
        _cube(bm, (x - 0.15, 0, z + 0.20), (0.04, 0.26, 0.30))  # its back
        _object(prefix + f"longtail-seat-{i}", bm, [m["cushion"]], coll, root, smooth=False)
        bm = bmesh.new()  # the hoop rail round the seat, which the child holds
        _rim(bm, [Vector((x + 0.15, -0.17, z + 0.24)), Vector((x + 0.15, 0.17, z + 0.24)), Vector((x - 0.12, 0.17, z + 0.24)), Vector((x - 0.12, -0.17, z + 0.24))], 0.010)
        for side in (-0.17, 0.17):
            _tube(bm, (x + 0.15, side, z), (x + 0.15, side, z + 0.24), 0.010)
        _object(prefix + f"longtail-hoop-{i}", bm, [mats["paint"]], coll, root)
        parts["seats"].append({"hip": Vector((x, 0, z + 0.06)), "pose": "astride", "feet_z": lt["board_z"]})
    if load.get("shopping"):  # panniers either side of the rear wheel and a bag on the deck
        _shopping(prefix, coll, root, [((-0.75, 0, z + 0.14), (0.36, 0.26, 0.22)), ((-0.80, 0.25, z - 0.16), (0.36, 0.12, 0.30)), ((-0.80, -0.25, z - 0.16), (0.36, 0.12, 0.30))], len(prefix))
    return parts


def build_cargo(prefix, coll, paint, load):
    c = CARGO
    parts = bike.build_bicycle(prefix, coll, paint, front="head")
    root, mats, m = parts["root"], parts["mats"], _materials()
    hb = parts["head_bot"]
    (x0, x1), fz = c["box_x"], c["floor_z"]
    axle = Vector((c["axle_x"], 0, SMALL_R))
    fhead_bot = axle + Vector((-math.cos(math.radians(71)), 0, math.sin(math.radians(71)))) * 0.40
    fhead_top = fhead_bot + Vector((-math.cos(math.radians(71)), 0, math.sin(math.radians(71)))) * 0.13
    bm = bmesh.new()
    _tube(bm, hb, (x0 + 0.02, 0, fz - 0.03), 0.024)  # the main tube, down from the head tube under the box
    for side in (-0.2, 0.2):
        _tube(bm, (x0, side, fz - 0.03), (x1, side, fz - 0.03), 0.014)
        _tube(bm, (x1, side, fz - 0.03), fhead_bot + Vector((0, side * 0.2, 0)), 0.014)
        _tube(bm, fhead_bot + Vector((0, side * 0.3, 0)), axle + Vector((0, side * 0.3, 0)), 0.011)  # front fork
    _tube(bm, fhead_bot, fhead_top, 0.02)
    _tube(bm, hb + Vector((0.02, 0, -0.06)), (x1 + 0.05, 0, fz - 0.06), 0.007)  # the steering rod
    _object(prefix + "cargo-frame", bm, [mats["paint"]], coll, root)
    bm = bmesh.new()
    _open_box(bm, x0, x1, c["half_w"], c["half_w"], fz, fz + c["wall_m"])
    _object(prefix + "cargo-box", bm, [m["ply"]], coll, root, smooth=False)
    bm = bmesh.new()
    top = fz + c["wall_m"]
    _rim(bm, [Vector((x0, -c["half_w"], top)), Vector((x1, -c["half_w"], top)), Vector((x1, c["half_w"], top)), Vector((x0, c["half_w"], top))], 0.010)
    _object(prefix + "cargo-rim", bm, [mats["alloy"]], coll, root)
    parts["front_wheel"] = _wheel(prefix + "wheel-front", mats, coll, root, axle.x, r=SMALL_R, tyre=0.024)
    parts["wheels"].append((parts["front_wheel"], SMALL_R))
    parts["seats"] = _box_bench(prefix, coll, root, m, x0, fz, c["half_w"], load)
    if load.get("shopping"):
        _shopping(prefix, coll, root, [((x0 + 0.45, -0.10, fz + 0.10), (0.30, 0.24, 0.18)), ((x0 + 0.40, 0.14, fz + 0.15), (0.24, 0.16, 0.28)), ((x0 + 0.18, 0.0, fz + 0.15), (0.16, 0.30, 0.28))], len(prefix))
    return parts


def _box_bench(prefix, coll, root, m, x0, floor_z, half_w, load, up=0.14):
    """A bench `up` above the floor across the back of a box for the children, facing forward, their shoulders over the
    rim; returns their seats."""
    kids = load.get("children") or []
    if not kids:
        return []
    bm = bmesh.new()
    _cube(bm, (x0 + 0.11, 0, floor_z + up - 0.03), (0.19, 2 * half_w - 0.04, 0.05))
    _cube(bm, (x0 + 0.11, 0, floor_z + (up - 0.05) / 2), (0.17, 2 * half_w - 0.08, up - 0.05))
    _cube(bm, (x0 + 0.03, 0, floor_z + up + 0.16), (0.03, 2 * half_w - 0.04, 0.30))
    _object(prefix + "box-bench", bm, [m["cushion"]], coll, root, smooth=False)
    ys = [0.0] if len(kids) == 1 else [0.14, -0.14]
    return [{"hip": Vector((x0 + 0.12, y, floor_z + up)), "pose": "box", "feet_z": floor_z} for y in ys]


def build_christiania(prefix, coll, paint, load):
    """The rear half: the box goes on in `finish`, once the rider's hands are on the bar."""
    parts = bike.build_bicycle(prefix, coll, paint, step_through=True, front="none")
    parts["load"] = load
    return parts


def _christiania_front(parts, prefix, coll):
    ch, root, mats, m = CHRISTIANIA, parts["root"], parts["mats"], _materials()
    stem = bpy.data.objects.get(root.name + "-stem")
    if stem:
        bpy.data.objects.remove(stem)
    bar = Vector(parts["bars"].location) + Vector((0.09, 0, 0.09))
    x0 = max(bar.x - 0.02, 0.30)
    x1 = x0 + ch["length"] - 0.12
    fz, tz = ch["floor_z"], ch["top_z"]
    bm = bmesh.new()
    _open_box(bm, x0, x1, ch["half_floor"], ch["half_top"], fz, tz, front_top_x=x0 + ch["length"])
    _object(prefix + "christiania-box", bm, [m["ply"]], coll, root, smooth=False)
    bm = bmesh.new()
    _rim(bm, [Vector((x0, -ch["half_top"], tz)), Vector((x0 + ch["length"], -ch["half_top"], tz)), Vector((x0 + ch["length"], ch["half_top"], tz)), Vector((x0, ch["half_top"], tz))], 0.012)
    for side in (-0.30, 0.30):  # the bar's posts, from the box's back corners
        _tube(bm, (x0, side, tz), (bar.x, side, bar.z), 0.013)
    axle_x = x0 + 0.48
    _tube(bm, (axle_x, -ch["wheel_y"], SMALL_R), (axle_x, ch["wheel_y"], SMALL_R), 0.02)  # the front axle under the box
    for side in (-1, 1):
        _tube(bm, (axle_x, side * ch["wheel_y"], SMALL_R), (axle_x, side * (ch["half_floor"] - 0.02), fz), 0.014)
    _tube(bm, parts["bb"] + Vector((0, 0, 0.02)), (x0, 0, fz + 0.03), 0.022)  # the frame to the box's pivot
    seat_mid = parts["bb"] + (parts["seat_top"] - parts["bb"]) * 0.55
    _tube(bm, seat_mid, (x0, 0, fz + 0.30), 0.018)
    _object(prefix + "christiania-frame", bm, [mats["paint"]], coll, root)
    for side in (-1, 1):
        wh = _wheel(prefix + f"wheel-front-{'lr'[side > 0]}", mats, coll, root, axle_x, r=SMALL_R, tyre=0.024)
        wh.location.y = side * ch["wheel_y"]
        parts["wheels"].append((wh, SMALL_R))
    load = parts.get("load") or {}
    parts["seats"] = _box_bench(prefix, coll, root, m, x0, fz, ch["half_floor"], load, up=0.24)
    if load.get("shopping"):
        _shopping(prefix, coll, root, [((x0 + 0.50, -0.12, fz + 0.10), (0.30, 0.26, 0.18)), ((x0 + 0.45, 0.16, fz + 0.15), (0.24, 0.16, 0.28))], len(prefix))


BUILD = {"longtail": build_longtail, "cargo": build_cargo, "christiania": build_christiania}


def build(kind, prefix, coll, paint, load):
    parts = BUILD[kind](prefix, coll, paint, load or {})
    parts["kind"] = kind
    return parts


def finish(parts, prefix, coll):
    """After the rider is fitted: the box tricycle's box, bar posts and front wheels, set to the rider's hands."""
    if parts["kind"] == "christiania":
        _christiania_front(parts, prefix, coll)


def _pose_child(arm, pose):
    """Seated facing forward: in a box, thighs level and shins down to the floor; astride a long-tail's seat, thighs
    apart and forward, shins down to the footboards. Hands in the lap or on the hoop rail."""
    x, y = Vector((1, 0, 0)), Vector((0, 1, 0))
    for side, s in (("l", 1), ("r", -1)):
        if pose == "astride":
            q = (Matrix.Rotation(-math.radians(60), 3, x) @ Matrix.Rotation(-s * math.radians(24), 3, y)).to_quaternion()
            cast.rotate_bone(arm, f"thigh_{side}", q.to_axis_angle())
            cast.rotate_bone(arm, f"calf_{side}", (x, math.radians(62)))
        else:
            cast.rotate_bone(arm, f"thigh_{side}", (x, -math.radians(86)))
            cast.rotate_bone(arm, f"calf_{side}", (x, math.radians(80)))
        cast.rotate_bone(arm, f"foot_{side}", (x, -math.radians(6)))
        cast.rotate_bone(arm, f"upperarm_{side}", (y, math.radians(60 if side == "l" else -60)))
        cast.rotate_bone(arm, f"lowerarm_{side}", (x, -math.radians(70 if pose == "astride" else 55)))
    cast.rotate_bone(arm, "spine_02", (x, math.radians(3)))
    cast.relax_hands(arm, 0.6 if pose == "astride" else 0.4)


def seat_children(parts, pids, heights, coll, prefix, frames, gaze):
    """The cycle's passengers on its seats, parented to the bicycle, each looking about on their own rhythm."""
    out = []
    for i, (pid, h, seat) in enumerate(zip(pids, heights, parts.get("seats", []))):
        arm = cast.make_person(pid, prefix + f"passenger-{i}:body", coll)
        info = cast.rig_info(arm)
        k = float(h) / info["height"]
        arm.parent = parts["root"]
        arm.rotation_euler = (0, 0, math.pi / 2)  # the armature faces -Y: a quarter turn faces it along +X
        arm.scale = (k, k, k)
        hips_rest = (info["hip_l"] + info["hip_r"]) / 2
        arm.location = seat["hip"] + Vector((0, 0, 0.05 * k)) - Matrix.Rotation(math.pi / 2, 3, "Z") @ (hips_rest * k)
        _pose_child(arm, seat["pose"])
        look = np.roll(np.asarray(gaze, dtype=np.float64), 41 * (i + 1), axis=0) * 1.6
        idle.bake_head(arm, frames, look)
        out.append({"person": pid, "heightM": h, "pose": seat["pose"], "scale": round(k, 3)})
    return out
