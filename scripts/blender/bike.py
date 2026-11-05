"""Procedural bicycle and pram for the dressed scenes (docs/blender-build-plan.md, Phase 4, R02/R06).

No licence-clean rigged bicycle is downloadable without an account (research §4), so the reference bicycle is built here,
to the prototype's dimensions (src/three-core/cyclistMotion.ts): 0.68 m wheels, 1.05 m wheelbase. Bicycle space is the
rider package's: origin on the ground midway between the wheel contacts, +X forward, +Z up. The wheels and the crank are
separate objects that turn about their own axles, so the importer keys them from the package's wheel and crank angles.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

WHEEL_D, WHEELBASE = 0.68, 1.05
WHEEL_R = WHEEL_D / 2
BB = Vector((-0.08, 0.0, 0.285))  # bottom bracket: a little behind mid-wheelbase, as on a hybrid
CRANK = 0.17
TYRE_R = 0.019


def _mat(name, rgba, rough, metal=0.0, coat=0.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    mat.diffuse_color = rgba
    return mat


def bike_materials(paint):
    return {
        "paint": _mat(f"bike-paint-{paint[0]:.2f}-{paint[1]:.2f}-{paint[2]:.2f}", (*paint, 1), 0.3, 0.0, 0.6),
        "rubber": _mat("bike-rubber", (0.015, 0.015, 0.016, 1), 0.75),
        "alloy": _mat("bike-alloy", (0.72, 0.72, 0.74, 1), 0.28, 1.0),
        "steel": _mat("bike-steel", (0.55, 0.56, 0.58, 1), 0.22, 1.0),
        "black": _mat("bike-black-plastic", (0.03, 0.03, 0.03, 1), 0.45),
        "saddle": _mat("bike-saddle", (0.05, 0.04, 0.035, 1), 0.55),
    }


def _tube(bm, a, b, r, seg=12):
    """A closed cylinder from a to b, radius r, into bm."""
    a, b = Vector(a), Vector(b)
    axis = b - a
    rot = axis.to_track_quat("Z", "Y").to_matrix().to_4x4()
    m = Matrix.Translation(a) @ rot
    ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=axis.length,
                                matrix=m @ Matrix.Translation((0, 0, axis.length / 2)))
    return ret["verts"]


def _torus(bm, centre, major, minor, seg=48, ring=10, axis="Y"):
    verts = []
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        row = []
        for j in range(ring):
            b = 2 * math.pi * j / ring
            rr = major + minor * math.cos(b)
            p = Vector((rr * math.cos(a), minor * math.sin(b), rr * math.sin(a))) if axis == "Y" else Vector((rr * math.cos(a), rr * math.sin(a), minor * math.sin(b)))
            row.append(bm.verts.new(Vector(centre) + p))
        rings.append(row)
        verts += row
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((rings[i][j], rings[(i + 1) % seg][j], rings[(i + 1) % seg][(j + 1) % ring], rings[i][(j + 1) % ring]))
    return verts


def _object(name, bm, mats, coll, parent=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = smooth
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new(name, me)
    coll.objects.link(obj)
    obj.parent = parent
    return obj


def _wheel(name, mats, coll, parent, x, r=WHEEL_R, tyre=TYRE_R):
    """Tyre, rim, hub and 32 spokes about a local Y axle, radius `r`; the object's origin is the axle."""
    bm = bmesh.new()
    _torus(bm, (0, 0, 0), r - tyre, tyre, seg=64, ring=12)
    n_tyre = len(bm.faces)
    _torus(bm, (0, 0, 0), r - 2 * tyre - 0.004, 0.009, seg=64, ring=6)
    n_rim = len(bm.faces)
    _tube(bm, (0, -0.05, 0), (0, 0.05, 0), 0.018, seg=16)
    hub_r = r - 2 * tyre - 0.012
    for i in range(32):
        a = 2 * math.pi * i / 32
        side = 0.035 if i % 2 else -0.035
        _tube(bm, (0.02 * math.cos(a + 0.3), side, 0.02 * math.sin(a + 0.3)), (hub_r * math.cos(a), 0, hub_r * math.sin(a)), 0.0012, seg=4)
    for k, f in enumerate(bm.faces):
        f.material_index = 0 if k < n_tyre else (1 if k < n_rim else 2)
    obj = _object(name, bm, [mats["rubber"], mats["alloy"], mats["steel"]], coll, parent)
    obj.location = (x, 0, r)
    return obj


def build_bicycle(prefix, coll, paint=(0.08, 0.22, 0.36), step_through=False, rear_extra=0.0, front="fork"):
    """A hybrid bicycle under an Empty `<prefix>bike`; returns the parts the rig and the keys need. The cargo cycles
    (cargobikes.py) start from it: `rear_extra` moves the rear axle back (a long-tail), and `front` is "fork" (the
    hybrid's), "head" (the head tube and bars only: a long john steers its far front wheel by a rod) or "none" (the
    rear half alone: a box tricycle's box carries the front)."""
    mats = bike_materials(paint)
    root = bpy.data.objects.new(prefix + "bike", None)
    root.empty_display_size = 0.3
    coll.objects.link(root)
    rear, front_axle = Vector((-WHEELBASE / 2 - rear_extra, 0, WHEEL_R)), Vector((WHEELBASE / 2, 0, WHEEL_R))
    seat_angle, head_angle = math.radians(73), math.radians(71)
    seat_top = BB + Vector((-math.cos(seat_angle), 0, math.sin(seat_angle))) * 0.50
    head_bot = front_axle + Vector((-math.cos(head_angle), 0, math.sin(head_angle))) * 0.40
    head_top = head_bot + Vector((-math.cos(head_angle), 0, math.sin(head_angle))) * 0.15

    bm = bmesh.new()
    top_from = seat_top + (BB - seat_top) * (0.55 if step_through else 0.1)
    tubes = [(BB, seat_top, 0.016)]
    if front != "none":
        tubes += [(BB, head_bot, 0.019), (top_from, head_top + (head_bot - head_top) * 0.2, 0.015), (head_bot, head_top, 0.02)]
    for a, b, r in tubes:
        _tube(bm, a, b, r)
    for side in (-0.06, 0.06):
        _tube(bm, BB + Vector((0, side * 0.5, 0)), rear + Vector((0, side, 0)), 0.009)
        _tube(bm, seat_top + Vector((0, side * 0.3, -0.02)), rear + Vector((0, side, 0)), 0.008)
        if front == "fork":
            _tube(bm, head_bot + Vector((0, side * 0.6, 0)), front_axle + Vector((0, side, 0)), 0.011)  # fork blades
    _object(prefix + "frame", bm, [mats["paint"]], coll, root)

    # seat post and saddle, stem and bars: their heights are fitted to the rider, so they are separate objects
    parts = {"root": root, "bb": BB.copy(), "seat_dir": (seat_top - BB).normalized(), "head_top": head_top, "head_bot": head_bot,
             "head_dir": (head_top - head_bot).normalized(), "seat_top": seat_top, "rear_axle": rear.copy(), "mats": mats}
    bm = bmesh.new()
    _tube(bm, (0, 0, -0.25), (0, 0, 0.0), 0.0135)
    post = _object(prefix + "seatpost", bm, [mats["alloy"]], coll, root)
    bm = bmesh.new()
    s = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1.0)
    for v in s["verts"]:
        x = v.co.x
        w = 0.085 if x < 0 else 0.085 - 0.06 * min(1.0, x)  # broad at the back, a narrow nose
        v.co = Vector((x * 0.14, v.co.y * w, v.co.z * 0.03 + 0.03 * (x * x)))
    saddle = _object(prefix + "saddle", bm, [mats["saddle"]], coll, post)
    saddle.location = (0.0, 0, 0.035)
    parts.update(post=post, saddle=saddle)

    bm = bmesh.new()  # the stem is made when the bars are fitted (cast._stem)
    _tube(bm, (0.09, -0.31, 0.09), (0.09, 0.31, 0.09), 0.011)
    n_bar = len(bm.faces)
    for side in (-1, 1):
        _tube(bm, (0.09, side * 0.20, 0.09), (0.09, side * 0.32, 0.09), 0.017)  # grips
        _tube(bm, (0.115, side * 0.25, 0.095), (0.17, side * 0.27, 0.08), 0.005)  # brake levers
    for k, f in enumerate(bm.faces):
        f.material_index = 0 if k < n_bar else 1
    bars = _object(prefix + "bars", bm, [mats["alloy"], mats["black"]], coll, root)
    bars.location = head_top
    parts.update(bars=bars, grip_offset=Vector((0.09, 0.26, 0.09)))

    parts["rear_wheel"] = _wheel(prefix + "wheel-rear", mats, coll, root, rear.x)
    parts["wheels"] = [(parts["rear_wheel"], WHEEL_R)]
    if front == "fork":
        parts["front_wheel"] = _wheel(prefix + "wheel-front", mats, coll, root, front_axle.x)
        parts["wheels"].append((parts["front_wheel"], WHEEL_R))

    # chain: an elongated loop from the chainring to the sprocket, on the drive side (-Y, the bicycle's right)
    bm = bmesh.new()
    ring_r, cog_r, y = 0.095, 0.04, -0.045
    pts = [Vector((BB.x + ring_r * math.cos(a), y, BB.z + ring_r * math.sin(a))) for a in [math.pi / 2 - i * math.pi / 12 for i in range(13)]]
    pts += [Vector((rear.x + cog_r * math.cos(a), y, rear.z + cog_r * math.sin(a))) for a in [-math.pi / 2 - i * math.pi / 12 for i in range(13)]]
    for a, b in zip(pts, pts[1:] + pts[:1]):
        _tube(bm, a, b, 0.004, seg=5)
    _tube(bm, (rear.x, y - 0.002, rear.z), (rear.x, y + 0.01, rear.z), cog_r, seg=20)
    _object(prefix + "chain", bm, [mats["steel"]], coll, root)

    # crank: chainring, two arms and pedals, about the bottom bracket's Y axis; pedals counter-turned to stay level
    bm = bmesh.new()
    _tube(bm, (0, y - 0.003, 0), (0, y + 0.003, 0), ring_r, seg=40)
    _tube(bm, (0, -0.075, 0), (0, 0.075, 0), 0.02, seg=16)
    _tube(bm, (0, -0.07, 0), (CRANK, -0.07, 0), 0.011, seg=8)
    _tube(bm, (0, 0.07, 0), (-CRANK, 0.07, 0), 0.011, seg=8)
    crank = _object(prefix + "crank", bm, [mats["alloy"]], coll, root)
    crank.location = BB
    pedals = []
    for side, x in (("r", CRANK), ("l", -CRANK)):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((0.10, 0.09, 0.022, 1)))
        pedal = _object(prefix + f"pedal-{side}", bm, [mats["black"]], coll, crank, smooth=False)
        pedal.location = (x, (-0.12 if side == "r" else 0.12), 0)
        pedals.append(pedal)
    parts.update(crank=crank, pedal_r=pedals[0], pedal_l=pedals[1])
    return parts


def scale_bicycle(parts, s):
    """A smaller bicycle for a younger rider (a 24-inch wheel is about 0.88 of the 0.68 m reference): every part's mesh
    and offset scaled about the bicycle's origin, and the points and lengths the rider is fitted to with them."""
    for o in parts["root"].children_recursive:
        if o.type == "MESH":
            o.data.transform(Matrix.Scale(s, 4))
        o.location = o.location * s
    for key in ("bb", "head_top", "grip_offset"):
        parts[key] = parts[key] * s
    parts["crank_len"], parts["wheel_r"] = CRANK * s, WHEEL_R * s
    parts["wheels"] = [(o, r * s) for o, r in parts["wheels"]]
    return parts


def build_trike(prefix, coll, paint=(0.55, 0.12, 0.10)):
    """An adult tricycle: the step-through frame with two rear wheels on an axle 0.72 m wide and a rear basket."""
    parts = build_bicycle(prefix, coll, paint, step_through=True)
    mats = bike_materials(paint)
    rear = parts["rear_wheel"]
    twin = rear.copy()
    twin.data = rear.data.copy()
    twin.name = prefix + "wheel-rear-2"
    coll.objects.link(twin)
    rear.location.y, twin.location.y = 0.36, -0.36
    bm = bmesh.new()
    _tube(bm, Vector((rear.location.x, -0.36, WHEEL_R)), Vector((rear.location.x, 0.36, WHEEL_R)), 0.018)
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((rear.location.x, 0, WHEEL_R + 0.28)) @ Matrix.Diagonal((0.42, 0.55, 0.26, 1)))
    _object(prefix + "trike-axle", bm, [mats["paint"]], coll, parts["root"], smooth=False)
    parts["rear_wheel_2"] = twin
    parts["wheels"].append((twin, WHEEL_R))
    return parts


def fit_bicycle(parts, saddle_height, reach, bar_rise):
    """Fit the seat post and the bars to a rider (R02): saddle height from the bottom bracket along the seat tube,
    bars `reach` ahead of the saddle and `bar_rise` above it. Returns (saddle top, left grip, right grip) in bicycle space."""
    top = parts["bb"] + parts["seat_dir"] * saddle_height
    parts["post"].location = top - Vector((0, 0, 0.035))
    saddle_top = top + Vector((0, 0, 0.035))
    head = parts["head_top"]
    stem_up = max(0.0, saddle_top.z + bar_rise - (head.z + 0.09))
    parts["bars"].location = head + Vector((min(0.0, saddle_top.x + reach - (head.x + 0.09)), 0, stem_up))
    g = parts["bars"].location + parts["grip_offset"]
    return saddle_top, Vector((g.x, g.y, g.z)), Vector((g.x, -g.y, g.z))


def key_bicycle(parts, frames, wheel_angles, crank_angles):
    """Wheels turn by travelled distance over their radius; the crank by the package's cadence; pedals stay level."""
    for obj in (parts["rear_wheel"], parts["front_wheel"], parts["crank"], parts["pedal_l"], parts["pedal_r"]):
        obj.rotation_mode = "XYZ"
    for f, w, c in zip(frames, wheel_angles, crank_angles):
        for obj, a in ((parts["rear_wheel"], w), (parts["front_wheel"], w), (parts["crank"], c), (parts["pedal_l"], -c), (parts["pedal_r"], -c)):
            obj.rotation_euler = (0, float(a), 0)
            obj.keyframe_insert("rotation_euler", index=1, frame=int(f))


def build_pram(prefix, coll, colour=(0.12, 0.14, 0.18)):
    """A pushchair under an Empty: chassis, seat with hood, four wheels; handle 1.0 m up and 0.0 m from the origin,
    the body ahead along +X. Returns (root, handle height, wheel objects)."""
    fab = _mat(f"pram-fabric-{colour[0]:.2f}", (*colour, 1), 0.8)
    mats = bike_materials((0.1, 0.1, 0.1))
    root = bpy.data.objects.new(prefix + "pram", None)
    coll.objects.link(root)
    bm = bmesh.new()
    for side in (-0.24, 0.24):
        _tube(bm, (0.0, side, 1.0), (0.55, side, 0.12), 0.012)
        _tube(bm, (0.30, side, 0.55), (0.85, side, 0.12), 0.011)
    _tube(bm, (0.0, -0.25, 1.0), (0.0, 0.25, 1.0), 0.016)
    frame = _object(prefix + "pram-frame", bm, [mats["alloy"]], coll, root)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0.58, 0, 0.52)) @ Matrix.Diagonal((0.42, 0.40, 0.30, 1)))
    s = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=0.24)
    for v in s["verts"]:
        if v.co.x < 0:
            v.co.x *= 0.2
        v.co = Vector((v.co.x * 0.8 + 0.45, v.co.y * 0.85, max(v.co.z, -0.02) + 0.68))
    _object(prefix + "pram-body", bm, [fab], coll, root)
    wheels = []
    for x, y in ((0.55, -0.25), (0.55, 0.25), (0.85, -0.22), (0.85, 0.22)):
        bm = bmesh.new()
        _torus(bm, (0, 0, 0), 0.1, 0.018, seg=32, ring=8)
        _tube(bm, (0, -0.02, 0), (0, 0.02, 0), 0.03)
        w = _object(prefix + f"pram-wheel-{len(wheels)}", bm, [mats["rubber"]], coll, root)
        w.location = (x, y, 0.118)
        wheels.append(w)
    frame.parent = root
    return root, 1.0, wheels
