"""Buildings for a dressed section: the package's footprints as slate-roofed houses and sheds (Phase 3).

The walls stand on the footprint from its base to its eaves exactly as the blockout's do; the recorded height is the
top (a DSM height reaches the ridge), so a pitched roof sits inside it (BL6). OSM rarely tags a roof shape and the
valley's buildings are pitched slate, so rectangles get a gable along their long side (shallow on wide sheds), other
outlines a hipped roof, and only very large footprints stay flat. Houses get sash windows, a door on the wall whose
ground is nearest the floor, a chimney and either slate-stone or painted render walls, varied per building. A ruin (OSM
building=ruins; "ruin" in the package) is its walls only, open to the sky as the three.js scene draws it: thick, dark
weathered stone, their tops uneven and lower where a stretch has fallen.
"""
import math
import zlib

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from landscape import TILE_M, Nodes, _coords, _texture, surface_material

PITCH, SHED_PITCH = math.radians(38), math.radians(15)
OVERHANG, VERGE, ROOF_T = 0.3, 0.2, 0.12  # eaves and gable overhangs, slate roof thickness (m)
FLAT_AREA, HOUSE_AREA = 900.0, 320.0  # m²: flat roofs above; windows, doors and chimneys below
TERRACE_DEPTH, HOUSE_WIDTH = 11.0, 5.5  # m: a rectangle no deeper is a terraced row; one chimney per house's frontage
STOREY, FLOOR_ABOVE_GROUND = 2.7, 0.15
RENDER = [(0.78, 0.76, 0.70), (0.80, 0.80, 0.78), (0.70, 0.66, 0.55), (0.62, 0.64, 0.62)]  # painted render, linear
DOORS = [(0.02, 0.06, 0.03), (0.01, 0.02, 0.06), (0.15, 0.015, 0.012), (0.012, 0.012, 0.012), (0.12, 0.06, 0.025)]
SLOTS = ["wall", "roof", "flat", "window", "door"]
SLATE = (0.042, 0.046, 0.055)  # blue-grey Welsh roofing slate, linear (the texture's own slates are paler and browner)
RUIN_STONE = (0.05, 0.052, 0.046)  # weathered, lichened wall stone, darker than a lived-in wall (linear)
RUIN_WALL_M = 0.55  # a ruin's wall thickness


def _clean(ring):
    """Anticlockwise, without repeated or collinear points."""
    r = [Vector((x, y, 0)) for x, y in ring]
    if sum(a.x * b.y - b.x * a.y for a, b in zip(r, r[1:] + r[:1])) < 0:
        r.reverse()
    out = []
    for i, p in enumerate(r):
        a, b = r[i - 1], r[(i + 1) % len(r)]
        if (p - a).length > 0.05 and abs((p - a).cross(b - a).z) > 1e-3 * (b - a).length_squared:
            out.append(p)
    return out if len(out) >= 3 else r


def _rectangle(r):
    """(origin, long axis, short axis, long length, short length) for a near-rectangular footprint, else None."""
    if len(r) != 4:
        return None
    e = [r[(k + 1) % 4] - r[k] for k in range(4)]
    if any(abs(e[k].normalized().dot(e[(k + 1) % 4].normalized())) > 0.1 for k in range(4)):
        return None
    if abs(e[0].length - e[2].length) > 0.08 * e[0].length or abs(e[1].length - e[3].length) > 0.08 * e[1].length:
        return None
    if e[0].length >= e[1].length:
        return r[0], e[0].normalized(), e[1].normalized(), e[0].length, e[1].length
    return r[1], e[1].normalized(), -e[0].normalized(), e[1].length, e[0].length


def _outset(r, d):
    """The ring moved outwards by d (mitred corners, clamped at sharp ones)."""
    out = []
    for i, p in enumerate(r):
        n0 = (p - r[i - 1]).normalized().cross(Vector((0, 0, 1)))
        n1 = (r[(i + 1) % len(r)] - p).normalized().cross(Vector((0, 0, 1)))
        m = (n0 + n1).normalized()
        out.append(p + m * d / max(0.35, m.dot(n1)))
    return out


class Geometry:
    """Faces with a material slot, a UV per corner and per-face attributes, gathered before one mesh is made."""

    def __init__(self):
        self.verts, self.faces, self.slots, self.uvs, self.attrs = [], [], [], [], []

    def face(self, pts, slot, uvs, attrs):
        base = len(self.verts)
        self.verts += [tuple(p) for p in pts]
        self.faces.append(tuple(range(base, base + len(pts))))
        self.slots.append(SLOTS.index(slot))
        self.uvs += uvs
        self.attrs.append(attrs)

    def quad(self, a, b, height_a, height_b, slot, u0, attrs, v0=0.0):
        """An upright quad on segment a→b (outward to its right) from its z up by the given heights; metre UVs."""
        L = (b - a).length
        pts = [a, b, b + Vector((0, 0, height_b)), a + Vector((0, 0, height_a))]
        self.face(pts, slot, [(u0, v0 + a.z), (u0 + L, v0 + b.z), (u0 + L, v0 + b.z + height_b), (u0, v0 + a.z + height_a)], attrs)

    def mesh(self, name, materials):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.verts, [], self.faces)
        me.polygons.foreach_set("material_index", np.array(self.slots, np.int32))
        uv = me.uv_layers.new(name="metres")
        uv.data.foreach_set("uv", np.array(self.uvs, np.float32).ravel())
        for key in ("paint", "rand"):
            a = me.attributes.new(key, "FLOAT", "FACE")
            a.data.foreach_set("value", np.array([f.get(key, 0.0) for f in self.attrs], np.float32))
        col = me.attributes.new("tone", "FLOAT_COLOR", "FACE")
        col.data.foreach_set("color", np.array([(*f.get("tone", (0.5, 0.5, 0.5)), 1.0) for f in self.attrs], np.float32).ravel())
        for m in materials:
            me.materials.append(m)
        return me


def _ground(terrain):
    me = terrain.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    tree = BVHTree.FromPolygons([tuple(v) for v in co.reshape(-1, 3)], [tuple(p.vertices) for p in me.polygons])

    def at(p):
        hit = tree.ray_cast(Vector((p.x, p.y, 5000.0)), Vector((0, 0, -1)))
        return hit[0].z if hit[0] else None
    return at


def _openings(g, r, eaves, floor, ground_at, door_tone, rng, gable_ends=(), row=False):
    """Windows per storey along each wall, and a door on the long wall whose ground is nearest the floor (on a
    terraced `row`, every other ground-floor opening there, a door per house)."""
    storeys = max(1, int((eaves - 0.3 - floor - 2.1) // STOREY) + 1)
    edges = [(r[k], r[(k + 1) % len(r)]) for k in range(len(r))]
    best, door_k = None, None
    for k, (a, b) in enumerate(edges):
        gz = ground_at((a + b) / 2)
        if gz is None or (b - a).length < 2.5:
            continue
        score = (b - a).length - 4.0 * max(0.0, floor - gz - 0.4)
        if best is None or score > best:
            best, door_k = score, k
    for k, (a, b) in enumerate(edges):
        L = (b - a).length
        if L < 2.2:
            continue
        along = (b - a) / L
        out = along.cross(Vector((0, 0, 1))) * 0.04
        n = 1 if k in gable_ends else max(1, int((L - 0.8) // 2.6))
        for s in range(storeys):
            z0 = floor + s * STOREY
            for i in range(n):
                c = a + along * (L * (i + 0.5) / n) + out
                if k == door_k and s == 0 and (i % 2 == 0 if row else i == n // 2):
                    w, z_lo, z_hi, slot = 0.95, z0, z0 + 2.05, "door"
                else:
                    w, z_lo, z_hi, slot = 0.9, z0 + 0.9, z0 + 2.1, "window"
                p0, p1 = c - along * (w / 2), c + along * (w / 2)
                pts = [Vector((p0.x, p0.y, z_lo)), Vector((p1.x, p1.y, z_lo)), Vector((p1.x, p1.y, z_hi)), Vector((p0.x, p0.y, z_hi))]
                g.face(pts, slot, [(0, 0), (1, 0), (1, 1), (0, 1)], {"rand": float(rng.random()), "tone": door_tone})


def _gable(g, roofs, rect, eaves, rise, wall):
    o, u, v, lu, lv = rect
    run = lv / 2
    slope = rise / run

    def at(s, t, z):
        p = o + u * s + v * t
        return Vector((p.x, p.y, z))
    ridge = eaves + rise
    for k, t_edge in ((0, 0.0), (1, lv)):  # the two slopes, overhanging the eaves and the gables
        t_out = -OVERHANG if k == 0 else lv + OVERHANG
        z_out = eaves - OVERHANG * slope
        pts = [at(-VERGE, t_out, z_out), at(lu + VERGE, t_out, z_out), at(lu + VERGE, run, ridge), at(-VERGE, run, ridge)]
        if k == 1:
            pts = [pts[1], pts[0], pts[3], pts[2]]
        span = math.hypot(run + OVERHANG, rise + OVERHANG * slope)
        roofs.face(pts, "roof", [(0, 0), (lu + 2 * VERGE, 0), (lu + 2 * VERGE, span), (0, span)] if k == 0 else [(lu + 2 * VERGE, 0), (0, 0), (0, span), (lu + 2 * VERGE, span)], {})
    for s, flip in ((0.0, True), (lu, False)):  # the gable walls' triangles
        tri = [at(s, 0, eaves), at(s, lv, eaves), at(s, run, ridge)]
        if flip:
            tri = [tri[1], tri[0], tri[2]]
        g.face(tri, "wall", [(0, eaves), (lv, eaves), (run, ridge)] if not flip else [(lv, eaves), (0, eaves), (run, ridge)], wall)


def _hip(roofs, r, eaves, area, perimeter, rise_cap):
    """A hipped roof by insetting the outline: even inset to 0.9 x area/perimeter (inside any wing's half width)."""
    import bmesh
    inset = min(0.9 * area / perimeter, 6.0)
    rise = min(inset * math.tan(PITCH), rise_cap)
    slope = rise / inset
    low = _outset(r, OVERHANG)
    bm = bmesh.new()
    vs = [bm.verts.new((p.x, p.y, eaves - OVERHANG * slope)) for p in low]
    f = bm.faces.new(vs)
    bmesh.ops.inset_region(bm, faces=[f], thickness=inset + OVERHANG, depth=rise + OVERHANG * slope, use_even_offset=True)
    for face in bm.faces:
        pts = [v.co.copy() for v in face.verts]
        roofs.face(pts, "roof", [(p.x, p.y) for p in pts], {})
    bm.free()
    return rise


def dress_buildings(footprints, terrain, coll, n):
    """Build the footprints into a walls-and-openings object and a roofs object (with thickness). Returns counts."""
    ground_at = _ground(terrain)
    g, roofs, ruins = Geometry(), Geometry(), Geometry()
    counts = {"gabled": 0, "hipped": 0, "flat": 0, "houses": 0, "ruins": 0}
    for b in footprints:
        rng = np.random.default_rng(zlib.crc32(b["id"].encode()))
        r = _clean(b["ring"])
        if b.get("ruin"):
            _ruin(ruins, r, b["baseZ"], b["topZ"], rng)
            counts["ruins"] += 1
            continue
        base, top, min_eaves = b["baseZ"], b["topZ"], b["minEavesZ"]
        area = abs(sum(a.x * c.y - c.x * a.y for a, c in zip(r, r[1:] + r[:1]))) / 2
        perimeter = sum((c - a).length for a, c in zip(r, r[1:] + r[:1]))
        rect = _rectangle(r)
        # a long narrow block is a row of houses, however long: a rectangle no deeper than a terrace, or any outline whose
        # mean width (2 x area / perimeter) is a terrace's
        terrace = (rect is not None and rect[4] <= TERRACE_DEPTH) or 2 * area / perimeter <= 0.85 * TERRACE_DEPTH
        house = area < HOUSE_AREA or terrace
        painted = house and rng.random() < 0.4
        wall = {"paint": 1.0 if painted else 0.0, "tone": RENDER[int(rng.integers(len(RENDER)))], "rand": float(rng.random())}
        height = top - base
        if area > FLAT_AREA and not terrace:
            eaves, rise, kind = max(top, min_eaves), 0.0, "flat"
        elif rect:
            pitch = PITCH if rect[4] <= 12.0 else SHED_PITCH
            rise = min(rect[4] / 2 * math.tan(pitch), 0.45 * height)
            eaves, kind = max(top - rise, min_eaves), "gabled"
        else:
            rise = min(0.9 * area / perimeter, 6.0) * math.tan(PITCH)
            rise = min(rise, 0.45 * height)
            eaves, kind = max(top - rise, min_eaves), "hipped"
        counts[kind] += 1
        u = 0.0
        for a, c in zip(r, r[1:] + r[:1]):
            g.quad(Vector((a.x, a.y, base)), Vector((c.x, c.y, base)), eaves - base, eaves - base, "wall", u, wall)
            u += (c - a).length
        if kind == "flat":
            pts = [Vector((p.x, p.y, eaves)) for p in r]
            g.face(pts, "flat", [(p.x, p.y) for p in pts], {})
        elif kind == "gabled":
            _gable(g, roofs, rect, eaves, rise, wall)
        else:
            _hip(roofs, r, eaves, area, perimeter, 0.45 * height)
        if house and eaves - base > 2.4:
            counts["houses"] += 1
            floor = min_eaves - 2.0 + FLOOR_ABOVE_GROUND  # 0.15 m above the footprint's highest ground
            ends = ()
            if kind == "gabled":
                ends = tuple(k for k in range(4) if abs((r[(k + 1) % 4] - r[k]).normalized().dot(rect[1])) < 0.5)
                # one stack at a gable end, or on a terrace one per house's width along the ridge
                count = max(1, int(round(rect[3] / HOUSE_WIDTH))) if rect[3] > 2 * HOUSE_WIDTH else 1
                first = 0.55 if rng.random() < 0.5 else rect[3] - 0.55
                for k in range(count):
                    _chimney(g, rect, eaves + rise, first if count == 1 else 0.55 + k * (rect[3] - 1.1) / (count - 1))
            _openings(g, r, eaves, floor, ground_at, DOORS[int(rng.integers(len(DOORS)))], rng, ends, row=terrace and area > HOUSE_AREA)
    mats = [wall_material(), surface_material("roof-slate", "roof", TILE_M["roof"], box=True, centre=SLATE),
            surface_material("roof-flat", "road", TILE_M["road"], box=True), window_material(), door_material()]
    walls = bpy.data.objects.new(n("buildings"), g.mesh(n("buildings"), mats))
    coll.objects.link(walls)
    if roofs.faces:
        obj = bpy.data.objects.new(n("roofs"), roofs.mesh(n("roofs"), mats))
        coll.objects.link(obj)
        sol = obj.modifiers.new("slate", "SOLIDIFY")
        sol.thickness, sol.offset = ROOF_T, -1.0
    if ruins.faces:
        stone = surface_material("ruin-stone", "stone-wall", TILE_M["stone-wall"], box=True, rough_scale=1.15, centre=RUIN_STONE)
        obj = bpy.data.objects.new(n("ruins"), ruins.mesh(n("ruins"), [stone]))
        obj["status"] = "existing"
        coll.objects.link(obj)
        sol = obj.modifiers.new("walls", "SOLIDIFY")  # thick walls, inwards from the footprint, with their tops closed
        sol.thickness, sol.offset, sol.use_rim = RUIN_WALL_M, -1.0, True
    return counts


def _ruin(g, r, base, top, rng):
    """A ruin's walls on its footprint, no roof: each corner at its own height (55-100 % of the recorded height), and a
    long wall dipping at a fallen stretch part way along."""
    full = max(1.2, top - base)
    heights = [full * float(rng.uniform(0.55, 1.0)) for _ in r]
    stone = {"paint": 0.0, "rand": float(rng.random())}
    u = 0.0
    for k, a in enumerate(r):
        c = r[(k + 1) % len(r)]
        ha, hc = heights[k], heights[(k + 1) % len(r)]
        pts = [(a, ha), (c, hc)]
        if (c - a).length > 4.0:  # a fallen stretch: a lower point between the corners
            f = float(rng.uniform(0.3, 0.7))
            pts.insert(1, (a.lerp(c, f), full * float(rng.uniform(0.3, 0.75))))
        for (p, hp), (q, hq) in zip(pts, pts[1:]):
            g.quad(Vector((p.x, p.y, base)), Vector((q.x, q.y, base)), hp, hq, "wall", u, stone)
            u += (q - p).length


def _chimney(g, rect, ridge, s):
    """A stone stack astride the ridge, `s` metres along it, standing 0.8 m clear of it."""
    o, u, v, lu, lv = rect
    c = o + u * s + v * (lv / 2)
    hx, hy = u * 0.3, v * 0.45
    ring = [c - hx - hy, c + hx - hy, c + hx + hy, c - hx + hy]
    z0, z1 = ridge - 1.2, ridge + 0.8
    stone = {"paint": 0.0}
    for a, b in zip(ring, ring[1:] + ring[:1]):
        g.quad(Vector((a.x, a.y, z0)), Vector((b.x, b.y, z0)), z1 - z0, z1 - z0, "wall", 0.0, stone)
    g.face([Vector((p.x, p.y, z1)) for p in ring], "wall", [(p.x, p.y) for p in ring], stone)


def wall_material():
    """Slate stone, or painted render over it (the per-face 'paint' and 'tone') keeping a trace of the stone's relief."""
    mat = bpy.data.materials.get("building-walls")
    if mat:
        return mat
    mat = bpy.data.materials.new("building-walls")
    mat.use_nodes = True
    nd = Nodes(mat)
    col, nor, rough = _texture(nd, "stone-wall", _coords(nd, TILE_M["stone-wall"], True))
    paint = nd.new("ShaderNodeAttribute", -600, 600, attribute_name="paint").outputs["Fac"]
    tone = nd.new("ShaderNodeAttribute", -600, 400, attribute_name="tone").outputs["Color"]
    lum = nd.new("ShaderNodeRGBToBW", -400, 300)
    nd.link(col, lum.inputs[0])
    grain = nd.new("ShaderNodeMapRange", -200, 300)
    grain.inputs["From Max"].default_value = 0.4
    grain.inputs["To Min"].default_value, grain.inputs["To Max"].default_value = 0.86, 1.06
    nd.link(lum.outputs[0], grain.inputs["Value"])
    render = nd.mix(1.0, tone, grain.outputs[0], blend="MULTIPLY")
    colour = nd.mix(paint, col, render)
    nm = nd.new("ShaderNodeNormalMap", 300, -400)
    strength = nd.new("ShaderNodeMapRange", 100, -500)
    strength.inputs["To Min"].default_value, strength.inputs["To Max"].default_value = 1.0, 0.15
    nd.link(paint, strength.inputs["Value"])
    nd.link(strength.outputs[0], nm.inputs["Strength"])
    nd.link(nor, nm.inputs["Color"])
    nd.link(nm.outputs["Normal"], nd.bsdf.inputs["Normal"])
    nd.link(colour, nd.bsdf.inputs["Base Color"])
    r = nd.math("MULTIPLY_ADD", rough, 0.3, 300, -200)
    r.node.inputs[2].default_value = 0.6
    nd.link(r, nd.bsdf.inputs["Roughness"])
    return mat


def window_material():
    """A white-framed sash window: two lights, a meeting rail, dark glass reflecting the sky, curtains in some."""
    mat = bpy.data.materials.get("building-window")
    if mat:
        return mat
    mat = bpy.data.materials.new("building-window")
    mat.use_nodes = True
    nd = Nodes(mat)
    uv = nd.new("ShaderNodeUVMap", -1200, 0, uv_map="metres")
    sep = nd.new("ShaderNodeSeparateXYZ", -1000, 0)
    nd.link(uv.outputs["UV"], sep.inputs[0])
    u, v = sep.outputs["X"], sep.outputs["Y"]

    def band(x, lo, hi):  # 1 inside [lo, hi]
        return nd.math("MULTIPLY", nd.math("GREATER_THAN", x, lo), nd.math("LESS_THAN", x, hi))
    glass = nd.math("MULTIPLY", band(u, 0.08, 0.92), band(v, 0.07, 0.93))
    glass = nd.math("MULTIPLY", glass, nd.math("SUBTRACT", 1.0, band(v, 0.48, 0.53)))
    glass = nd.math("MULTIPLY", glass, nd.math("SUBTRACT", 1.0, band(u, 0.485, 0.515)))
    rand = nd.new("ShaderNodeAttribute", -1000, -400, attribute_name="rand").outputs["Fac"]
    curtain = nd.math("MULTIPLY", nd.math("GREATER_THAN", rand, 0.45), nd.math("MAXIMUM", nd.math("LESS_THAN", u, 0.26), nd.math("GREATER_THAN", u, 0.74)))
    pane = nd.mix(curtain, (0.006, 0.008, 0.01, 1), (0.16, 0.13, 0.10, 1))
    nd.link(nd.mix(glass, (0.75, 0.75, 0.72, 1), pane), nd.bsdf.inputs["Base Color"])
    nd.link(nd.math("MULTIPLY_ADD", glass, -0.46)  # painted frame 0.5, glass 0.04
            , nd.bsdf.inputs["Roughness"])
    nd.bsdf.inputs["Roughness"].links[0].from_node.inputs[2].default_value = 0.5
    nd.bsdf.inputs["Specular IOR Level"].default_value = 0.5
    return mat


def door_material():
    """A painted panelled door in the building's colour (the per-face 'tone')."""
    mat = bpy.data.materials.get("building-door")
    if mat:
        return mat
    mat = bpy.data.materials.new("building-door")
    mat.use_nodes = True
    nd = Nodes(mat)
    uv = nd.new("ShaderNodeUVMap", -1200, 0, uv_map="metres")
    sep = nd.new("ShaderNodeSeparateXYZ", -1000, 0)
    nd.link(uv.outputs["UV"], sep.inputs[0])
    tone = nd.new("ShaderNodeAttribute", -600, 400, attribute_name="tone").outputs["Color"]
    frame = nd.math("MAXIMUM", nd.math("LESS_THAN", nd.math("MINIMUM", sep.outputs["X"], nd.math("SUBTRACT", 1.0, sep.outputs["X"])), 0.06),
                    nd.math("GREATER_THAN", sep.outputs["Y"], 0.96))
    panel = nd.math("LESS_THAN", nd.math("ABSOLUTE", nd.math("SUBTRACT", nd.math("FRACT", nd.math("MULTIPLY", sep.outputs["Y"], 3.0)), 0.5)), 0.38)
    shade = nd.mix(panel, (0.8, 0.8, 0.8, 1), (1.0, 1.0, 1.0, 1))
    body = nd.mix(1.0, tone, shade, blend="MULTIPLY")
    nd.link(nd.mix(frame, body, (0.7, 0.7, 0.68, 1)), nd.bsdf.inputs["Base Color"])
    nd.bsdf.inputs["Roughness"].default_value = 0.35
    return mat
