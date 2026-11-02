"""Overhead power lines for a dressed section: the package's OSM supports and lines (src/three-core/power.ts).

Existing features. A power=pole is a creosoted timber pole with a crossarm (pin insulators on the arm and the pole top;
a low-voltage pole carries one bundled cable); a power=tower is a slender galvanised lattice tower, light (two short
arm levels) up to 66 kV and heavy (three arm levels each side, an earth wire on the peak) above. Each support stands on
the package's ground point at its exported height, its arms across the line. Conductors hang as catenaries (a parabola
at this sag) between consecutive supports, kept clear of the ground. Everything is a few hundred triangles a support:
one mesh per support type, shared by every support of that type.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

from bike import _mat

STEEL = ((0.30, 0.31, 0.31, 1), 0.55, 0.7)  # weathered galvanised steel (linear), roughness, metallic
TIMBER = ((0.07, 0.045, 0.028, 1), 0.85, 0.0)  # creosoted pole
WIRE = ((0.33, 0.33, 0.32, 1), 0.4, 0.9)  # aluminium conductor
SAG = {"pole": 0.02, "light": 0.025, "heavy": 0.03}  # mid-span sag over the span's length
CLEARANCE_M = {"pole": 4.0, "light": 5.5, "heavy": 7.0}  # the lowest a conductor hangs above the ground
WIRE_RADIUS_M = {"pole": 0.008, "light": 0.010, "heavy": 0.014}
SAMPLES = 10  # segments per span


def _class(s):
    if s["kind"] == "pole":
        return "pole"
    return "light" if s.get("voltageV", 33000) <= 66000 and s["heightM"] < 20 else "heavy"


def _arms(cls, h, voltage):
    """(arm levels as (z, reach)), conductor attachment slots (x, y, z) in the support's frame (x along the line), and
    the earth wire's slot or None."""
    if cls == "pole":
        if voltage is not None and voltage <= 1000:
            return [], [(0.0, 0.15, h - 0.4)], None
        z = h - 0.35
        return [(z, 1.1)], [(0.0, -0.95, z + 0.15), (0.0, 0.95, z + 0.15), (0.0, 0.0, h + 0.12)], None
    if cls == "light":
        levels = [(h - 1.2, 2.0), (h - 0.25, 1.4)]
        drop = 0.6
        slots = [(0.0, s * r, z - drop) for z, r in levels for s in (-1, 1)]
        return levels, slots, None
    levels = [(0.62 * h, 0.17 * h), (0.76 * h, 0.20 * h), (0.90 * h, 0.17 * h)]
    drop = 0.06 * h
    # one circuit down each side: three cables hang on one side, six on both
    slots = [(0.0, s * r, z - drop) for s in (-1, 1) for z, r in levels]
    return levels, slots, (0.0, 0.0, h)


def _beam(bm, a, b, t):
    """An open square prism of side t from a to b (four faces, no caps)."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u = d.cross(Vector((0, 0, 1)))
    if u.length < 1e-3:
        u = d.cross(Vector((1, 0, 0)))
    u.normalize()
    v = d.cross(u)
    off = [(u + v) * t / 2, (u - v) * t / 2, (-u - v) * t / 2, (-u + v) * t / 2]
    ring_a = [bm.verts.new(a + o) for o in off]
    ring_b = [bm.verts.new(b + o) for o in off]
    for k in range(4):
        bm.faces.new((ring_a[k], ring_a[(k + 1) % 4], ring_b[(k + 1) % 4], ring_b[k]))


def _tower_mesh(name, cls, h, voltage):
    """A lattice tower: four tapering legs in panels with X bracing on each face, arm levels across the line, a peak."""
    bm = bmesh.new()
    levels, _, earth = _arms(cls, h, voltage)
    base, waist = (max(0.9, 0.09 * h), 0.35) if cls == "light" else (0.1 * h, 0.035 * h)
    body_top = h - 0.25 if cls == "light" else 0.92 * h
    panels = max(3, int(round(body_top / (4.0 if cls == "light" else 6.0))))
    t = 0.07 if cls == "light" else 0.16

    def half(z):  # the body's half-width at height z
        return base + (waist - base) * min(1.0, max(0.0, z / body_top))

    zs = [-0.5] + [body_top * (k + 1) / panels for k in range(panels)]
    corners = lambda z: [(sx * half(z), sy * half(z), z) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]  # noqa: E731
    for z0, z1 in zip(zs, zs[1:]):
        c0, c1 = corners(z0), corners(z1)
        for k in range(4):
            _beam(bm, c0[k], c1[k], t)  # leg
            _beam(bm, c0[k], c1[(k + 1) % 4], t * 0.6)  # the face's X bracing
            _beam(bm, c0[(k + 1) % 4], c1[k], t * 0.6)
            _beam(bm, c1[k], c1[(k + 1) % 4], t * 0.6)  # the panel's ring
    for z, reach in levels:  # each arm: a bottom chord out to the tip and a tie back up to the body
        for s in (-1, 1):
            w = half(z)
            _beam(bm, (0, s * w, z), (0, s * reach, z), t)
            _beam(bm, (0, s * reach, z), (0, s * w, z + 0.12 * reach + 0.4), t * 0.6)
    top = corners(body_top)
    peak = (0.0, 0.0, earth[2] if earth else h)
    for c in top:
        _beam(bm, c, peak, t * 0.8)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def _pole_mesh(name, h, voltage):
    """A timber pole (eight sides, 0.26 m at the foot) with a crossarm across the line."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.13, radius2=0.10, depth=h + 0.5,
                          matrix=Matrix.Translation((0, 0, (h + 0.5) / 2 - 0.5)))
    levels, slots, _ = _arms("pole", h, voltage)
    for z, reach in levels:
        _beam(bm, (0, -reach, z), (0, reach, z), 0.1)
    for x, y, z in slots:  # pin insulators: short posts under each conductor
        _beam(bm, (x, y, z - 0.15), (x, y, z), 0.06)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def _support_mesh(s, n, cache):
    cls = _class(s)
    h = round(float(s["heightM"]), 1)
    v = s.get("voltageV")
    low = cls == "pole" and v is not None and v <= 1000
    key = (cls, h, low)
    if key not in cache:
        name = n(f"power-{cls}-{h:g}{'-lv' if low else ''}")
        me = _pole_mesh(name, h, v) if cls == "pole" else _tower_mesh(name, cls, h, v)
        me.materials.append(_mat("power-timber", *TIMBER) if cls == "pole" else _mat("power-steel", *STEEL))
        cache[key] = me
    return cache[key]


def _directions(supports, lines):
    """Each support's line direction (unit XY) in each line through it: (line index, support) -> direction; and the
    first one seen per support, which turns its mesh."""
    per_line, first = {}, {}
    for li, line in enumerate(lines):
        idx = line["supports"]
        for j, i in enumerate(idx):
            a = Vector(supports[idx[max(0, j - 1)]]["position"][:2])
            b = Vector(supports[idx[min(len(idx) - 1, j + 1)]]["position"][:2])
            d = b - a
            d = d.normalized() if d.length > 1e-6 else Vector((1, 0))
            per_line[(li, i)] = d
            first.setdefault(i, d)
    return per_line, first


def _attach(s, slot, d):
    """A slot in the support's frame (x along `d`, y across it) to world coordinates."""
    p = Vector(s["position"])
    x, y, z = slot
    return Vector((p.x + d.x * x - d.y * y, p.y + d.y * x + d.x * y, p.z + z))


def build_power(power, terrain, coll, n):
    """The supports (one object each, sharing a mesh per type) and the conductors (one curve object). Returns counts."""
    supports, lines = power["supports"], power["lines"]
    per_line, first = _directions(supports, lines)
    cache, counts = {}, {"poles": 0, "lightTowers": 0, "heavyTowers": 0, "spans": 0, "conductors": 0}
    for i, s in enumerate(supports):
        obj = bpy.data.objects.new(n(f"power-support-{i}"), _support_mesh(s, n, cache))
        obj.location = s["position"]
        d = first.get(i, Vector((1, 0)))
        obj.rotation_euler = (0, 0, math.atan2(d.y, d.x))
        obj["status"] = power.get("status", "existing")
        obj["osm"] = s["id"]
        coll.objects.link(obj)
        counts[{"pole": "poles", "light": "lightTowers", "heavy": "heavyTowers"}[_class(s)]] += 1
    ground = _ground(terrain)
    curve = bpy.data.curves.new(n("power-conductors"), "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = WIRE_RADIUS_M["light"]
    curve.bevel_resolution = 0
    for li, line in enumerate(lines):
        idx = line["supports"]
        for a, b in zip(idx, idx[1:]):
            sa, sb = supports[a], supports[b]
            ca, cb = _class(sa), _class(sb)
            _, slots_a, earth_a = _arms(ca, sa["heightM"], sa.get("voltageV"))
            _, slots_b, earth_b = _arms(cb, sb["heightM"], sb.get("voltageV"))
            count = max(1, min(int(line["cables"]), len(slots_a), len(slots_b)))
            pairs = [(slots_a[k], slots_b[k]) for k in range(count)]
            if earth_a and earth_b:
                pairs.append((earth_a, earth_b))
            heavier = ca if (ca == "heavy" or cb == "pole") else cb
            for pa, pb in pairs:
                _span(curve, _attach(sa, pa, per_line[(li, a)]), _attach(sb, pb, per_line[(li, b)]), heavier, ground)
                counts["conductors"] += 1
            counts["spans"] += 1
    if curve.splines:
        obj = bpy.data.objects.new(n("power-conductors"), curve)
        obj.data.materials.append(_mat("power-wire", *WIRE))
        obj["status"] = power.get("status", "existing")
        coll.objects.link(obj)
    else:
        bpy.data.curves.remove(curve)
    return counts


def _span(curve, a, b, cls, ground):
    """A conductor from a to b, sagging by SAG of its length at mid-span, raised where it would pass too near the ground."""
    length = (b - a).xy.length
    ts = np.linspace(0.0, 1.0, SAMPLES + 1)
    sag = SAG[cls] * length
    for t in ts[1:-1]:  # the most sag the ground allows
        p = a.lerp(b, float(t))
        g = ground(p)
        if g is not None:
            sag = min(sag, max(0.0, (p.z - g - CLEARANCE_M[cls]) / (4 * t * (1 - t))))
    pts = np.empty((len(ts), 4), np.float32)
    for k, t in enumerate(ts):
        p = a.lerp(b, float(t))
        pts[k] = (p.x, p.y, p.z - sag * 4 * t * (1 - t), 1.0)
    spline = curve.splines.new("POLY")
    spline.points.add(len(ts) - 1)
    spline.points.foreach_set("co", pts.ravel())
    spline.radius_interpolation = "LINEAR"
    spline.points.foreach_set("radius", np.full(len(ts), WIRE_RADIUS_M[cls] / WIRE_RADIUS_M["light"], np.float32))


def _ground(terrain):
    """The terrain's height under a point (ray cast down), or None off it."""
    if terrain is None:
        return lambda p: None
    from buildings import _ground as ground_of
    return ground_of(terrain)
