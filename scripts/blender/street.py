"""Procedural street furniture for the dressed scenes: bench, cycle lockers, fingerpost, bus shelter, bus stop flag,
midi bus and viewpoint board.

No asset library carries Welsh bilingual street furniture, so it is built here to common UK dimensions: a 1.8 m bench
with a 0.45 m seat and arm rests (BS 8300-1 asks for seats 0.45-0.48 m high with arms to push up from, and a 1.0 x 1.4 m
level space beside it for a wheelchair or pushchair), 0.8 x 2.0 x 1.3 m cycle lockers, a 2.4 m fingerpost, a 3 m
glass shelter, a 2.8 m bus stop pole and a 10.5 m single-deck midi bus. Signs read Welsh first, then English, as the
Welsh Language Standards require. Nothing carries an operator's name or livery.

Prop space: origin on the ground (Z = 0), +X is the prop's front (the way a sitter, a locker door, a shelter's open side,
a bus and a reader at a board face), Z up, metres. Every builder returns a dict with "root", an Empty that parents all
the parts and carries a custom property "status": PROPOSED for the trail's new infrastructure, EXISTING for what is there
today, so the film can tell them apart.
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

import bike
from bike import _mat, _object, _tube

PROPOSED, EXISTING = "proposed", "existing"
# Inter (OFL) from Blender's own datafiles, as the captions use (build_reel.py), so signs render the same on every
# machine; Arial, where a machine has it, is the fallback. Both have ½ and ŵ ŷ â.
FONT_FALLBACK = "C:/Windows/Fonts/arial.ttf"
FRACTIONS = {0.25: "¼", 0.5: "½", 0.75: "¾"}
MATS = {  # key: (linear rgba, roughness, metallic, coat); "green" is RAL 6009 fir green, the usual locker finish
    "steel": ((0.045, 0.05, 0.055, 1), 0.5, 0.6), "grey": ((0.38, 0.40, 0.42, 1), 0.4, 0.8),
    "green": ((0.035, 0.11, 0.065, 1), 0.45, 0.0, 0.3), "signgreen": ((0.02, 0.07, 0.04, 1), 0.5),
    "cream": ((0.80, 0.76, 0.62, 1), 0.6), "white": ((0.88, 0.88, 0.88, 1), 0.5), "ink": ((0.02, 0.02, 0.02, 1), 0.6),
    "red": ((0.55, 0.02, 0.02, 1), 0.5), "black": ((0.015, 0.015, 0.016, 1), 0.8),
    "tint": ((0.05, 0.065, 0.08, 1), 0.08, 0.0, 1.0), "lamp": ((0.9, 0.9, 0.85, 1), 0.1),  # tinted glass that still shows the sky, not black panels
    "tail": ((0.5, 0.02, 0.01, 1), 0.15), "gravel": ((0.30, 0.28, 0.25, 1), 0.95),
    "asphalt": ((0.055, 0.055, 0.058, 1), 0.85), "paving": ((0.33, 0.32, 0.30, 1), 0.8), "kerb": ((0.42, 0.41, 0.39, 1), 0.7),
}


def mark_proposed(root):
    root["status"] = PROPOSED
    return root


def mark_existing(root):
    root["status"] = EXISTING
    return root


def _root(prefix, name, coll, status):
    root = bpy.data.objects.new(prefix + name, None)
    root.empty_display_size = 0.5
    coll.objects.link(root)
    root["status"] = status
    return root


def _box(bm, c, size, ry=0.0, bevel=0.0):
    """A box of `size` (x, y, z) centred at c, turned ry about Y."""
    m = Matrix.Translation(c) @ Matrix.Rotation(ry, 4, "Y") @ Matrix.Diagonal((*size, 1))
    verts = bmesh.ops.create_cube(bm, size=1.0, matrix=m)["verts"]
    if bevel:
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=verts + edges, offset=bevel, segments=1, affect="EDGES", profile=0.5)


def _boxes(name, mat, coll, parent, *boxes):
    """One flat-shaded object of boxes, each (centre, size[, ry])."""
    bm = bmesh.new()
    for b in boxes:
        _box(bm, *b)
    return _object(name, bm, [mat], coll, parent, smooth=False)


def _member(bm, a, b, w, t):
    """A rectangular bar from a to b in an XZ plane: w across Y, t thick; lengthened by t so joints close."""
    a, b = Vector(a), Vector(b)
    d = b - a
    _box(bm, (a + b) / 2, (d.length + t, w, t), ry=math.atan2(-d.z, d.x))


def _prism(bm, pts, z0, z1, m=None):
    """The polygon pts (XY) extruded from z0 to z1, then transformed by m."""
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]
    hi = [bm.verts.new((x, y, z1)) for x, y in pts]
    faces = [bm.faces.new(lo[::-1]), bm.faces.new(hi)]
    n = len(pts)
    faces += [bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i])) for i in range(n)]
    if m is not None:
        bmesh.ops.transform(bm, matrix=m, verts=lo + hi)
    bmesh.ops.recalc_face_normals(bm, faces=faces)


def _rrect(x0, x1, w, rf, rr, seg=6):
    """A plan rectangle x0..x1 by w (centred on Y) with front (+X) corners of radius rf and rear corners rr."""
    pts = []
    for cx, cy, r, a0 in ((x1, w / 2, rf, 0), (x0, w / 2, rr, 90), (x0, -w / 2, rr, 180), (x1, -w / 2, rf, 270)):
        sx, sy = (-1 if cx == x1 else 1), (-1 if cy > 0 else 1)
        steps = seg if r > 0 else 0
        for i in range(steps + 1):
            a = math.radians(a0 + 90 * i / max(steps, 1))
            pts.append((cx + sx * r + r * math.cos(a), cy + sy * r + r * math.sin(a)))
    return pts


def _place(origin, right, up):
    """The matrix putting a text object's +X along `right`, +Y along `up`; it then faces right x up."""
    r, u = Vector(right).normalized(), Vector(up).normalized()
    n = r.cross(u)
    o = Vector(origin)
    return Matrix(((r.x, u.x, n.x, o.x), (r.y, u.y, n.y, o.y), (r.z, u.z, n.z, o.z), (0, 0, 0, 1)))


def _font():
    v = bpy.app.version
    inter = os.path.join(os.path.dirname(bpy.app.binary_path), f"{v[0]}.{v[1]}", "datafiles", "fonts", "Inter.woff2")
    for path in (inter, FONT_FALLBACK):
        if os.path.exists(path):
            try:
                return bpy.data.fonts.load(path, check_existing=True)
            except RuntimeError:
                continue
    return None


def _fit(body, size, width):
    """Shrink a text size so its longest line fits `width` (about 0.55 em per character in Inter or Arial)."""
    longest = max(len(line) for line in body.split("\n"))
    return min(size, width / (0.55 * max(longest, 1)))


def _text(name, body, size, mat, coll, parent, m):
    cu = bpy.data.curves.new(name, type="FONT")
    cu.body = body
    cu.size = size
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    cu.resolution_u = 4  # glyph curves: 4 steps is smooth at sign distances and a quarter of the default triangles
    cu.font = _font() or cu.font
    cu.materials.append(mat)
    obj = bpy.data.objects.new(name, cu)
    coll.objects.link(obj)
    obj.parent = parent
    obj.matrix_basis = m
    return obj


def _wood(name="street-timber", light=(0.40, 0.28, 0.17, 1), dark=(0.22, 0.15, 0.10, 1)):
    """Weathered timber: wavy grain bands between two browns and a fine noise bump, in object space."""
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = _mat(name, light, 0.78)
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 6.0
    wave.inputs["Distortion"].default_value = 8.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color, ramp.color_ramp.elements[1].color = dark, light
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 60.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.15
    for a, b in ((coord.outputs["Object"], wave.inputs["Vector"]), (coord.outputs["Object"], noise.inputs["Vector"]),
                 (wave.outputs["Fac"], ramp.inputs["Fac"]), (ramp.outputs["Color"], bsdf.inputs["Base Color"]),
                 (noise.outputs["Fac"], bump.inputs["Height"]), (bump.outputs["Normal"], bsdf.inputs["Normal"])):
        nt.links.new(a, b)
    return mat


def _glass(name="street-glass", tint=(0.80, 0.86, 0.86, 1)):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = _mat(name, tint, 0.06)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = 1.0
    mat.diffuse_color = (*tint[:3], 0.25)
    return mat


def _mats():
    mats = {k: _mat("street-" + k, *v) for k, v in MATS.items()}
    mats["timber"] = _wood()
    return mats


def build_bench(prefix, coll, arms=True, pad=True):
    """A 1.8 m slatted bench on three cast frames; the sitter faces +X ("front"). "seats" are seat-surface centres;
    "wheelchair_space" is the centre (x, y) of a level 1.4 (X) x 1.0 (Y) m space ("wheelchair_size") beside the +Y end.
    With `pad`, a 20 mm compacted gravel slab is under both and the bench stands on it."""
    mats = _mats()
    root = _root(prefix, "bench", coll, PROPOSED)
    z0 = 0.02 if pad else 0.0
    space = (0.2, 1.48)
    if pad:
        _boxes(prefix + "bench-pad", mats["gravel"], coll, root, ((0.2, 0.45, -0.03), (1.6, 3.3, 0.10)))
    bm = bmesh.new()
    back_lo, back_hi = Vector((-0.22, 0, z0 + 0.42)), Vector((-0.32, 0, z0 + 0.86))
    for y in (-0.85, 0.0, 0.85):
        end = arms and y != 0.0
        o = Vector((0, y, 0))
        _member(bm, o + Vector((0.20, 0, 0)), o + Vector((0.20, 0, z0 + (0.64 if end else 0.41))), 0.05, 0.05)
        _member(bm, o + Vector((-0.20, 0, 0)), o + back_lo, 0.05, 0.05)
        _member(bm, o + back_lo, o + back_hi, 0.05, 0.05)
        _member(bm, o + Vector((-0.24, 0, z0 + 0.40)), o + Vector((0.22, 0, z0 + 0.40)), 0.05, 0.04)
        _member(bm, o + Vector((-0.20, 0, z0 + 0.10)), o + Vector((0.20, 0, z0 + 0.10)), 0.04, 0.03)
        if end:
            _member(bm, o + Vector((-0.27, 0, z0 + 0.66)), o + Vector((0.24, 0, z0 + 0.66)), 0.07, 0.035)
    _object(prefix + "bench-frames", bm, [mats["steel"]], coll, root, smooth=False)
    bm = bmesh.new()
    for x in (-0.18, -0.06, 0.06, 0.18):
        _box(bm, (x, 0, z0 + 0.4325), (0.095, 1.86, 0.035), bevel=0.006)
    d = (back_hi - back_lo).normalized()
    for t in (0.14, 0.27, 0.40):
        _box(bm, back_lo + d * t + Vector((0.045, 0, 0)), (0.03, 1.86, 0.11), ry=math.atan2(d.x, d.z), bevel=0.006)
    _object(prefix + "bench-slats", bm, [mats["timber"]], coll, root, smooth=False)
    seats = [Vector((0.0, y, z0 + 0.45)) for y in (-0.55, 0.0, 0.55)]
    return {"root": root, "seats": seats, "front": Vector((1, 0, 0)), "sit_height": z0 + 0.45,
            "wheelchair_space": space, "wheelchair_size": (1.4, 1.0)}


def build_lockers(prefix, coll, units=4, open_unit=1, bicycle=True):
    """A bank of `units` cycle lockers side by side along Y, each 0.8 (Y) x 2.0 (X) x 1.3 m high, doors on the +X face,
    hinged on each unit's -Y side; unit `open_unit` (None for none) stands open 100 degrees with a bicycle inside.
    A bilingual sign stands on the roof at the front (its top 1.62 m up)."""
    mats = _mats()
    root = _root(prefix, "lockers", coll, PROPOSED)
    W, D, H = 0.8, 2.0, 1.3
    y0 = -units * W / 2
    bm = bmesh.new()
    _box(bm, (0, 0, H - 0.015), (D + 0.06, units * W + 0.04, 0.03), ry=math.radians(-1.0))
    _box(bm, (-D / 2 + 0.01, 0, H / 2), (0.02, units * W, H - 0.02))
    _box(bm, (0, 0, 0.05), (D, units * W, 0.02))
    for i in range(units + 1):
        _box(bm, (0, y0 + i * W, H / 2), (D, 0.02, H - 0.02))
    _object(prefix + "lockers-shell", bm, [mats["green"]], coll, root, smooth=False)
    _boxes(prefix + "lockers-plinth", mats["black"], coll, root, ((0, 0, 0.02), (D - 0.1, units * W - 0.1, 0.04)))
    doors = []
    for i in range(units):
        bm = bmesh.new()
        w = W - 0.03
        _box(bm, (0.0, w / 2, 0.67), (0.02, w, 1.18))
        for z in (0.32, 0.67, 1.02):  # pressed stiffening ribs: the panel lines
            _box(bm, (0.012, w / 2, z), (0.008, w - 0.12, 0.025))
        _box(bm, (0.03, w - 0.07, 0.72), (0.04, 0.025, 0.14))
        _tube(bm, (0.01, w - 0.07, 0.84), (0.03, w - 0.07, 0.84), 0.015, seg=10)
        door = _object(prefix + f"locker-door-{i}", bm, [mats["green"]], coll, root, smooth=False)
        door.location = (D / 2 + 0.012, y0 + i * W + 0.015, 0)
        if i == open_unit:
            door.rotation_euler = (0, 0, math.radians(-100))
        doors.append(door)
    out = {"root": root, "doors": doors, "unit_size": (D, W, H), "units": units, "front": Vector((1, 0, 0))}
    if bicycle and open_unit is not None and 0 <= open_unit < units:
        parts = bike.build_bicycle(prefix + "locker-", coll)
        bike.fit_bicycle(parts, 0.68, 0.6, -0.03)
        parts["root"].parent = root
        parts["root"].location = (-0.05, y0 + (open_unit + 0.5) * W, 0.06)
        out["bicycle"] = parts
    sw = min(units * W - 0.1, 1.7)
    _boxes(prefix + "lockers-sign-back", mats["signgreen"], coll, root, ((D / 2 - 0.08, 0, H + 0.165), (0.03, sw + 0.04, 0.34)))
    _boxes(prefix + "lockers-sign", mats["cream"], coll, root, ((D / 2 - 0.064, 0, H + 0.165), (0.004, sw, 0.30)))
    line1, line2 = "Loceri beiciau · Cycle lockers", "Arfaethedig · Proposed"
    x = D / 2 - 0.06
    _text(prefix + "lockers-text", line1, _fit(line1, 0.09, sw - 0.1), mats["signgreen"], coll, root,
          _place((x, 0, H + 0.21), (0, 1, 0), (0, 0, 1)))
    _text(prefix + "lockers-text-2", line2, _fit(line2, 0.06, sw - 0.1), mats["ink"], coll, root,
          _place((x, 0, H + 0.09), (0, 1, 0), (0, 0, 1)))
    out["sign_text"] = (line1, line2)
    return out


def miles_text(miles):
    whole, part = int(miles), round(miles - int(miles), 2)
    if part in FRACTIONS:
        return f"{whole or ''}{FRACTIONS[part]} mi"
    return f"{whole} mi" if part == 0 else f"{miles:.1f} mi"


def build_fingerpost(prefix, coll, arms=(("Llan Ffestiniog", "Llan Ffestiniog", 2.5, 0),)):
    """A 2.4 m oak post with up to three dark green fingers, top down. Each arm is (welsh, english, miles, heading_deg):
    the finger points along heading (0 = +X, 90 = +Y); Welsh above English (once if they match), distance at the tip,
    lettered on both faces."""
    mats = _mats()
    root = _root(prefix, "fingerpost", coll, PROPOSED)
    bm = bmesh.new()
    _box(bm, (0, 0, 1.2), (0.11, 0.11, 2.4), bevel=0.008)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.085, radius2=0.0, depth=0.08,
                          matrix=Matrix.Translation((0, 0, 2.44)) @ Matrix.Rotation(math.pi / 4, 4, "Z"))
    _object(prefix + "fingerpost-post", bm, [mats["timber"]], coll, root, smooth=False)
    L, t = 0.95, 0.035
    out = {"root": root, "arms": []}
    for k, (welsh, english, miles, heading) in enumerate(list(arms)[:3]):
        names = welsh if welsh.strip().lower() == english.strip().lower() else f"{welsh}\n{english}"
        h = 0.22 if "\n" in names else 0.15
        arm = bpy.data.objects.new(prefix + f"fingerpost-arm-{k}", None)
        coll.objects.link(arm)
        arm.parent = root
        arm.location = (0, 0, 2.18 - 0.27 * k)
        arm.rotation_euler = (0, 0, math.radians(heading))
        bm = bmesh.new()
        pts = [(0.0, -h / 2), (L - 0.12, -h / 2), (L, 0.0), (L - 0.12, h / 2), (0.0, h / 2)]
        _prism(bm, pts, -t / 2, t / 2, Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1))))
        _object(prefix + f"fingerpost-finger-{k}", bm, [mats["signgreen"]], coll, arm, smooth=False)
        dist = miles_text(miles)
        name_size = _fit(names, 0.075 if "\n" in names else 0.085, 0.56)
        for side in (-1, 1):  # -Y face reads toward the tip, +Y face toward the post
            y = side * (t / 2 + 0.002)
            r = (-side, 0, 0)
            _text(prefix + f"fingerpost-names-{k}{'ab'[side > 0]}", names, name_size, mats["cream"], coll, arm,
                  _place((0.37, y, 0), r, (0, 0, 1)))
            _text(prefix + f"fingerpost-dist-{k}{'ab'[side > 0]}", dist, 0.065, mats["cream"], coll, arm,
                  _place((L - 0.2, y, 0), r, (0, 0, 1)))
        out["arms"].append({"object": arm, "names": names, "distance": dist, "heading_deg": heading})
    return out


def build_bus_shelter(prefix, coll):
    """A 3.0 (Y) x 1.4 (X) x 2.4 m steel and glass shelter, open to +X (the kerb), glazed back and ends, perch seat."""
    mats = _mats()
    glass = _glass()
    root = _root(prefix, "bus-shelter", coll, EXISTING)
    bm = bmesh.new()
    for x, y in ((-0.67, -1.47), (-0.67, 0.0), (-0.67, 1.47), (0.67, -1.47), (0.67, 1.47)):
        _box(bm, (x, y, 1.18), (0.06, 0.06, 2.36))
    for z in (0.12, 2.24):
        _box(bm, (-0.67, 0, z), (0.05, 2.94, 0.04))
        for y in (-1.47, 1.47):
            _box(bm, (0, y, z), (1.34, 0.05, 0.04))
    _box(bm, (-0.02, 0, 2.39), (1.52, 3.12, 0.06), ry=math.radians(-2.5))  # roof, falling to the back
    _box(bm, (0.73, 0, 2.39), (0.03, 3.12, 0.14))
    for y in (-0.9, 0.9):  # perch seat brackets
        _member(bm, (-0.64, y, 0.66), (-0.50, y, 0.72), 0.03, 0.03)
    _box(bm, (-0.52, 0, 0.73), (0.13, 2.2, 0.035), ry=math.radians(12))
    _box(bm, (0.67, 1.36, 1.45), (0.05, 0.16, 0.5))  # timetable case on the front post
    _object(prefix + "bus-shelter-frame", bm, [mats["grey"]], coll, root, smooth=False)
    bm = bmesh.new()
    for y0, y1 in ((-1.44, -0.03), (0.03, 1.44)):
        _box(bm, (-0.67, (y0 + y1) / 2, 1.18), (0.01, y1 - y0, 2.08))
    for y in (-1.47, 1.47):
        _box(bm, (0, y, 1.18), (1.28, 0.01, 2.08))
    _object(prefix + "bus-shelter-glass", bm, [glass], coll, root, smooth=False)
    return {"root": root, "front": Vector((1, 0, 0)), "perch": Vector((-0.52, 0, 0.75))}


def build_bus_stop_flag(prefix, coll, name=None):
    """A 2.8 m pole with a flag at the top projecting toward +X (the carriageway), its faces to +-Y, so it is read
    along a road running in Y; a bus pictogram and "Safle bws / Bus stop" on both faces, optional stop name plate below."""
    mats = _mats()
    root = _root(prefix, "bus-stop-flag", coll, EXISTING)
    bm = bmesh.new()
    _tube(bm, (0, 0, 0), (0, 0, 2.8), 0.038, seg=16)
    _box(bm, (0.04, 0, 2.7), (0.08, 0.04, 0.04))
    _box(bm, (0.04, 0, 2.38), (0.08, 0.04, 0.04))
    _object(prefix + "bus-stop-pole", bm, [mats["grey"]], coll, root)
    cx, w = 0.31, 0.46
    bm = bmesh.new()
    _box(bm, (cx, 0, 2.53), (w, 0.012, 0.54))
    if name:
        _box(bm, (cx, 0, 2.17), (w, 0.012, 0.16))
    _object(prefix + "bus-stop-plate", bm, [mats["white"]], coll, root, smooth=False)
    bm = bmesh.new()
    _tube(bm, (cx, -0.008, 2.64), (cx, 0.008, 2.64), 0.125, seg=40)
    _box(bm, (cx + 0.01, 0, 2.665), (0.13, 0.024, 0.025))  # the pictogram's window band
    _object(prefix + "bus-stop-disc", bm, [mats["red"]], coll, root, smooth=False)
    bm = bmesh.new()  # a generic bus pictogram, white on a red disc; not any operator's roundel
    _box(bm, (cx, 0, 2.655), (0.17, 0.02, 0.09))
    for dx in (-0.05, 0.05):
        _tube(bm, (cx + dx, -0.01, 2.61), (cx + dx, 0.01, 2.61), 0.022, seg=12)
    _object(prefix + "bus-stop-pictogram", bm, [mats["white"]], coll, root, smooth=False)
    for side in (-1, 1):
        y = side * 0.007
        _text(prefix + f"bus-stop-text-{'ab'[side > 0]}", "Safle bws\nBus stop", 0.055, mats["ink"], coll, root,
              _place((cx, y, 2.39), (-side, 0, 0), (0, 0, 1)))
        if name:
            _text(prefix + f"bus-stop-name-{'ab'[side > 0]}", name, _fit(name, 0.06, w - 0.04), mats["ink"], coll,
                  root, _place((cx, side * 0.008, 2.17), (-side, 0, 0), (0, 0, 1)))
    return {"root": root, "flag_centre": Vector((cx, 0, 2.53))}


def build_bus(prefix, coll, colour=(0.85, 0.85, 0.83)):
    """An unbranded 10.5 x 2.5 x 3.0 m single-deck midi bus: +X forward, doors on the +Y side (the kerb side, left,
    in the UK). Wheels are separate objects about their own Y axles ("wheels"), radius 0.48 m."""
    mats = _mats()
    paint = _mat(f"street-bus-paint-{colour[0]:.2f}-{colour[1]:.2f}-{colour[2]:.2f}", (*colour, 1), 0.3, 0.0, 0.8)
    root = _root(prefix, "bus", coll, EXISTING)
    L, W, H, R = 10.5, 2.5, 3.0, 0.48
    xf, xr = L / 2 - 2.4, -L / 2 + 2.9
    bm = bmesh.new()
    _prism(bm, _rrect(-L / 2, L / 2, W, 0.35, 0.1), 1.06, H - 0.06)
    _prism(bm, _rrect(-L / 2 + 0.06, L / 2 - 0.06, W - 0.12, 0.29, 0.05), H - 0.06, H)
    for x0, x1, rf, rr in ((xf + 0.62, L / 2, 0.35, 0), (xr + 0.62, xf - 0.62, 0, 0), (-L / 2, xr - 0.62, 0, 0.1)):
        _prism(bm, _rrect(x0, x1, W, rf, rr), 0.32, 1.06)
    _box(bm, (-1.2, 0, H + 0.08), (2.2, 1.6, 0.16), bevel=0.04)  # roof air-conditioning pod
    _object(prefix + "bus-body", bm, [paint], coll, root, smooth=False)
    bm = bmesh.new()
    _box(bm, (0, 0, 0.68), (L - 0.3, 1.9, 0.72))  # chassis, seen through the wheel arches
    _box(bm, (L / 2 + 0.01, 0, 0.42), (0.1, W - 0.12, 0.22))
    _box(bm, (-L / 2 - 0.01, 0, 0.42), (0.1, W - 0.12, 0.22))
    for y in (-1, 1):  # mirror arms and heads
        _member(bm, (L / 2 - 0.15, y * 1.2, 2.5), (L / 2 + 0.28, y * 1.2, 2.34), 0.03, 0.03)
        _box(bm, (L / 2 + 0.28, y * 1.24, 2.15), (0.05, 0.2, 0.4))
    _object(prefix + "bus-trim", bm, [mats["black"]], coll, root, smooth=False)
    # the bay it stands in (OSM maps the station's bus bay): tarmac under it, a kerb on the door side and paving beyond,
    # where the stop's flag and shelter stand; deep enough that uneven ground never shows through
    _boxes(prefix + "bus-bay", mats["asphalt"], coll, root, ((0, 0, -0.2), (17.0, W + 1.4, 0.44)))
    _boxes(prefix + "bus-bay-kerb", mats["kerb"], coll, root, ((0, W / 2 + 0.78, -0.12), (17.0, 0.16, 0.36)))
    _boxes(prefix + "bus-bay-footway", mats["paving"], coll, root, ((0, W / 2 + 3.9, -0.2), (17.0, 6.1, 0.44)))
    bm = bmesh.new()
    for y in (-1, 1):
        x1 = L / 2 - (1.65 if y > 0 else 0.45)
        _box(bm, ((-L / 2 + 0.25 + x1) / 2, y * (W / 2 + 0.006), 1.95), (x1 + L / 2 - 0.25, 0.02, 1.25))
    _box(bm, (L / 2 - 0.95, W / 2 + 0.008, 1.47), (1.1, 0.02, 2.24))  # glazed doors
    _box(bm, (L / 2 + 0.006, 0, 1.85), (0.02, W - 0.7, 1.75))  # windscreen and blank destination display
    _box(bm, (-L / 2 - 0.006, 0, 2.3), (0.02, W - 0.8, 0.8))
    _object(prefix + "bus-glass", bm, [mats["tint"]], coll, root, smooth=False)
    _boxes(prefix + "bus-door-frame", paint, coll, root, ((L / 2 - 0.95, W / 2 + 0.02, 1.47), (0.04, 0.012, 2.24)),
           ((L / 2 - 0.95, W / 2 + 0.02, 1.47), (1.1, 0.012, 0.05)))
    for nm, x, mat in (("lamps", L / 2 + 0.012, mats["lamp"]), ("tail", -L / 2 - 0.012, mats["tail"])):
        bm = bmesh.new()
        for y in (-0.85, 0.85):
            _box(bm, (x, y, 0.72), (0.02, 0.32, 0.14))
        _object(prefix + f"bus-{nm}", bm, [mat], coll, root, smooth=False)
    wheels = []
    for x, wid in ((xf, 0.3), (xr, 0.5)):
        for y in (-1, 1):
            bm = bmesh.new()
            _tube(bm, (0, -wid / 2, 0), (0, wid / 2, 0), R, seg=28)
            n_tyre = len(bm.faces)
            _tube(bm, (0, y * wid / 2, 0), (0, y * (wid / 2 + 0.008), 0), 0.29, seg=20)
            for k, f in enumerate(bm.faces):
                f.material_index = 0 if k < n_tyre else 1
            wheel = _object(prefix + f"bus-wheel-{len(wheels)}", bm, [mats["black"], mats["grey"]], coll, root, smooth=False)
            wheel.location = (x, y * (W / 2 - 0.02 - wid / 2), R)
            wheels.append(wheel)
    return {"root": root, "wheels": wheels, "wheel_radius": R, "door_side": Vector((0, 1, 0)),
            "door_centre": Vector((L / 2 - 0.95, W / 2, 0)), "size": (L, W, H)}


def build_viewpoint_board(prefix, coll, title_cy, title_en):
    """A lectern interpretation board: a 1.0 (Y) x 0.6 m panel tilted 35 degrees from level, centre 0.9 m up, on two
    oak legs; its face looks up and toward +X, where the reader stands ("reader"), looking out over -X."""
    mats = _mats()
    root = _root(prefix, "viewpoint-board", coll, PROPOSED)
    a = math.radians(35)
    c, n, u = Vector((0, 0, 0.9)), Vector((math.sin(a), 0, math.cos(a))), Vector((-math.cos(a), 0, math.sin(a)))
    bm = bmesh.new()
    for y in (-0.42, 0.42):
        _box(bm, (0.0, y, 0.44), (0.09, 0.09, 0.88), bevel=0.006)
    _object(prefix + "viewpoint-legs", bm, [mats["timber"]], coll, root, smooth=False)
    _boxes(prefix + "viewpoint-frame", mats["signgreen"], coll, root, (c, (0.64, 1.04, 0.04), a))
    _boxes(prefix + "viewpoint-panel", mats["cream"], coll, root, (c + n * 0.004, (0.56, 0.96, 0.04), a))
    _boxes(prefix + "viewpoint-panorama", _mat("street-panorama", (0.25, 0.36, 0.38, 1), 0.6), coll, root,
           (c + n * 0.008 - u * 0.09, (0.28, 0.88, 0.04), a))  # where the panorama drawing goes
    face = c + n * 0.03
    _text(prefix + "viewpoint-title-cy", title_cy, _fit(title_cy, 0.065, 0.86), mats["signgreen"], coll, root,
          _place(face + u * 0.2, (0, 1, 0), u))
    _text(prefix + "viewpoint-title-en", title_en, _fit(title_en, 0.045, 0.86), mats["ink"], coll, root,
          _place(face + u * 0.12, (0, 1, 0), u))
    return {"root": root, "front": Vector((1, 0, 0)), "reader": Vector((0.75, 0, 0)), "panel_centre": c,
            "panel_normal": n}
