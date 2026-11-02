"""Procedural dogs on leads for the community film: a Welsh sheepdog (border collie), a labrador and a small terrier.

No licence-clean rigged dog is downloadable without an account, so each is built here from metaball forms (trunk, chest,
haunches, neck, skull and muzzle blended into one smooth body) and four two-part legs that
turn at the shoulder or hip and at the elbow or hock. Dog space: origin on the ground under the middle of the dog, +X
forward, +Z up, metres. Sizes are typical adult sizes at the withers: collie 0.52 m, labrador 0.57 m, terrier 0.30 m.

The importer keys the dog's root from the package (its own path at its person's side, src/three-core/choreography.ts)
and animate() keys a trot from the package's phase: diagonal legs together (left fore with right hind), the lower legs
folding as each swings forward, and the tail swinging. The lead is a thin cord from
the walker's lead hand to the collar, held there by constraints, so it follows both without baking.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

from bike import _mat, _object

BREEDS = {
    # withers height, trunk length (shoulder to hip), trunk radius, head radius, muzzle length, colours (linear rgb),
    # whether the ears stand, tail droop (radians below level), and a white blaze, chest and socks
    "collie": {"h": 0.52, "l": 0.50, "r": 0.115, "head": 0.085, "muzzle": 0.10, "main": (0.012, 0.011, 0.011), "second": (0.80, 0.78, 0.74), "prick": True, "tail": 1.0, "white": True, "rough": 0.62, "stride": 0.9},
    "labrador": {"h": 0.57, "l": 0.52, "r": 0.14, "head": 0.095, "muzzle": 0.10, "main": (0.55, 0.36, 0.17), "second": (0.55, 0.36, 0.17), "prick": False, "tail": 0.5, "white": False, "rough": 0.5, "stride": 1.0},
    "terrier": {"h": 0.30, "l": 0.30, "r": 0.075, "head": 0.06, "muzzle": 0.05, "main": (0.70, 0.66, 0.58), "second": (0.70, 0.66, 0.58), "prick": True, "tail": -0.6, "white": False, "rough": 0.7, "stride": 0.55},
}
SURFACE = 1.45  # an element's size over the radius its surface shows
TROT_LIFT = {"upper": 0.42, "lower": 0.75}  # radians: the upper leg's swing either way, the lower leg's fold


def _fur(name, rgb, rough):
    mat = _mat(name, (*rgb, 1), rough)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    if "Sheen Weight" in bsdf.inputs:  # a coat's soft sheen at grazing angles
        bsdf.inputs["Sheen Weight"].default_value = 0.25
        bsdf.inputs["Sheen Roughness"].default_value = 0.5
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    if not any(n.type == "BUMP" for n in nodes):  # a fine, directional coat texture, not a plastic finish
        coord = nodes.new("ShaderNodeTexCoord")
        mapping = nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (60.0, 160.0, 160.0)
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 4.0
        noise.inputs["Detail"].default_value = 6.0
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.35
        bump.inputs["Distance"].default_value = 0.002
        links.new(coord.outputs["Object"], mapping.inputs["Vector"])
        links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def _metaball_mesh(name, elements, mat, coll, parent):
    """A metaball of ellipsoids (centre, radii, rotation about Y): one smooth surface, evaluated at render (a background
    build has no depsgraph for the section's scene to convert it with). Its name is its own family, so it blends only
    with itself."""
    mb = bpy.data.metaballs.new(name + "-mb")
    mb.resolution = 0.03
    mb.render_resolution = 0.012
    mb.threshold = 0.6
    for centre, radii, pitch in elements:
        e = mb.elements.new(type="ELLIPSOID")
        e.co = centre
        e.radius = 1.0
        # the surface (threshold 0.6, stiffness 2) lies at about two thirds of an element's size: sized up to the radii
        e.size_x, e.size_y, e.size_z = (q * SURFACE for q in radii)
        e.rotation = Matrix.Rotation(pitch, 3, "Y").to_quaternion()
        e.stiffness = 2.0
    mb.materials.append(mat)
    obj = bpy.data.objects.new(name.replace(".", "-"), mb)
    coll.objects.link(obj)
    obj.parent = parent
    return obj


def _limb(name, length, r_top, r_bottom, mat, coll, parent, foot=None):
    """A tapered capsule hanging from its own origin (the joint) down -Z; a paw at its foot if given."""
    bm = bmesh.new()
    seg = 10
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r_bottom, radius2=r_top, depth=length,
                          matrix=Matrix.Translation((0, 0, -length / 2)))
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=6, radius=r_top)
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=6, radius=r_bottom, matrix=Matrix.Translation((0, 0, -length)))
    if foot:
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=6, radius=1.0,
                                  matrix=Matrix.Translation((foot * 0.35, 0, -length - r_bottom * 0.2)) @ Matrix.Diagonal((foot, r_bottom * 1.05, r_bottom * 0.75, 1)))
    obj = _object(name, bm, [mat], coll, parent)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def build_dog(prefix, coll, breed="collie", collar=(0.55, 0.05, 0.04)):
    """A dog in dog space under a root Empty; returns its parts for animate() and the collar Empty for the lead."""
    b = BREEDS[breed]
    h, l, r = b["h"], b["l"], b["r"]
    main = _fur(f"dog-{breed}-coat", b["main"], b["rough"])
    second = _fur(f"dog-{breed}-white", b["second"], b["rough"])
    nose = _mat("dog-nose", (0.01, 0.01, 0.01, 1), 0.3)
    band = _mat(f"dog-collar-{collar[0]:.2f}", (*collar, 1), 0.5)
    root = bpy.data.objects.new(prefix + "root", None)
    root.empty_display_size = 0.2
    coll.objects.link(root)
    # the trunk's top line a little under the withers, the chest deeper than the loin, haunches over the hind legs
    top = h - r * 0.55
    head_at = Vector((l / 2 + 0.07 + b["head"] * 0.6, 0, h + b["head"] * 1.25))
    elements = [
        ((l * 0.05, 0, top), (l * 0.62, r * 0.95, r), 0.0),
        ((l * 0.36, 0, top - r * 0.25), (r * 1.35, r * 1.0, r * 1.35), 0.0),
        ((-l * 0.36, 0, top + r * 0.05), (r * 1.2, r * 0.95, r * 1.1), 0.0),
        ((l / 2 + 0.05, 0, h + b["head"] * 0.4), (r * 0.55, r * 0.6, b["head"] * 1.25), -0.6),
        (tuple(head_at), (b["head"] * 1.15, b["head"] * 0.95, b["head"] * 0.95), 0.0),
        (tuple(head_at + Vector((b["head"] * 0.7 + b["muzzle"] * 0.4, 0, -b["head"] * 0.3))), (b["muzzle"] * 0.75, b["head"] * 0.5, b["head"] * 0.45), 0.15),
    ]
    body = _metaball_mesh(prefix + "body", elements, main, coll, root)
    parts = {"root": root, "body": body, "legs": []}
    # muzzle and chest blaze in the second colour for a collie: a white ruff, a white muzzle
    if b["white"]:
        _metaball_mesh(prefix + "blaze", [
            (tuple(head_at + Vector((b["head"] * 0.75 + b["muzzle"] * 0.45, 0, -b["head"] * 0.38))), (b["muzzle"] * 0.72, b["head"] * 0.48, b["head"] * 0.4), 0.15),
            ((l / 2 + 0.02, 0, h - r * 0.7), (r * 0.55, r * 0.7, r * 0.85), -0.3),
        ], second, coll, root)
    # nose and eyes
    tip = head_at + Vector((b["head"] * 0.7 + b["muzzle"] * 1.1, 0, -b["head"] * 0.18))
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=b["head"] * 0.22, matrix=Matrix.Translation(tip))
    for s in (1, -1):
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=b["head"] * 0.13, matrix=Matrix.Translation(head_at + Vector((b["head"] * 0.72, s * b["head"] * 0.42, b["head"] * 0.25))))
    _object(prefix + "nose", bm, [nose], coll, root)
    # ears: pricked (collie, terrier) or soft and hanging (labrador)
    bm = bmesh.new()
    for s in (1, -1):
        base = head_at + Vector((-b["head"] * 0.2, s * b["head"] * 0.6, b["head"] * 0.7))
        if b["prick"]:
            m = Matrix.Translation(base) @ Matrix.Rotation(s * 0.35, 4, "X") @ Matrix.Diagonal((0.4, 1.0, 1.0, 1))
            bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=b["head"] * 0.45, radius2=0.004, depth=b["head"] * 1.1, matrix=m @ Matrix.Translation((0, 0, b["head"] * 0.55)))
        else:
            m = Matrix.Translation(base + Vector((0, s * b["head"] * 0.2, -b["head"] * 0.6))) @ Matrix.Rotation(-s * 0.25, 4, "X") @ Matrix.Diagonal((b["head"] * 0.55, b["head"] * 0.12, b["head"] * 0.8, 1))
            bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=1.0, matrix=m)
    _object(prefix + "ears", bm, [main], coll, root)
    # collar round the neck, and the lead's ring on top of it
    neck = Vector((l / 2 + 0.07, 0, h + b["head"] * 0.2))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=16, radius1=r * 0.68, radius2=r * 0.68, depth=0.025,
                          matrix=Matrix.Translation(neck) @ Matrix.Rotation(-0.7, 4, "Y"))
    _object(prefix + "collar", bm, [band], coll, root)
    ring = bpy.data.objects.new(prefix + "collar-ring", None)
    ring.empty_display_size = 0.03
    ring.parent = root
    ring.location = neck + Vector((-0.02, 0, r * 0.62))
    coll.objects.link(ring)
    parts["collar"] = ring
    # tail: three segments from the croup, carried by breed, a little curl
    tail = bpy.data.objects.new(prefix + "tail", None)
    tail.parent = root
    tail.location = (-l / 2 - r * 0.6, 0, top + r * 0.35)
    coll.objects.link(tail)
    bm = bmesh.new()
    length = h * 0.62 if breed != "terrier" else h * 0.45
    for k in range(4):
        a = Vector((-math.cos(b["tail"] + 0.25 * k) * length * k / 4, 0, -math.sin(b["tail"] + 0.25 * k) * length * k / 4))
        c = Vector((-math.cos(b["tail"] + 0.25 * (k + 1)) * length * (k + 1) / 4, 0, -math.sin(b["tail"] + 0.25 * (k + 1)) * length * (k + 1) / 4))
        rr = r * (0.32 - 0.06 * k) * (1.3 if breed == "collie" else 1.0)
        axis = c - a
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=rr, radius2=rr * 0.8, depth=axis.length,
                              matrix=Matrix.Translation((a + c) / 2) @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4())
    tip_obj = _object(prefix + "tail-mesh", bm, [second if b["white"] else main], coll, tail)
    for p in tip_obj.data.polygons:
        p.use_smooth = True
    parts["tail"] = tail
    # legs: fore under the chest, hind under the haunches; upper and lower parts, socks in the second colour
    hip_z, sh_z = top - r * 0.2, top - r * 0.35
    for name, x, z, front in (("fl", l * 0.40, sh_z, True), ("fr", l * 0.40, sh_z, True), ("hl", -l * 0.40, hip_z, False), ("hr", -l * 0.40, hip_z, False)):
        y = (r * 0.55) * (1 if name.endswith("l") else -1)
        joint = bpy.data.objects.new(f"{prefix}{name}-upper", None)
        joint.parent = root
        joint.location = (x, y, z)
        coll.objects.link(joint)
        up_len = z * (0.5 if front else 0.48)
        low_len = z - up_len - r * 0.08
        _limb(f"{prefix}{name}-thigh", up_len, r * (0.42 if front else 0.55), r * 0.26, main, coll, joint)
        knee = bpy.data.objects.new(f"{prefix}{name}-lower", None)
        knee.parent = joint
        knee.location = (0, 0, -up_len)
        coll.objects.link(knee)
        _limb(f"{prefix}{name}-shin", low_len, r * 0.24, r * 0.2, second if b["white"] else main, coll, knee, foot=r * 0.32)
        parts["legs"].append({"upper": joint, "lower": knee, "front": front, "left": name.endswith("l")})
    return parts


def animate(parts, frames, phase, distance, breed="collie"):
    """Key a trot from the package's phase (radians, one cycle per stride): left fore with right hind, then right fore
    with left hind; the lower leg folds as its leg swings forward; the tail swings. A dog
    standing still (its phase unchanging) stands square, its tail still swinging slowly."""
    from gait import key_array
    fr = np.asarray(frames, dtype=np.float64)
    # the package's phase is one cycle per 0.9 m (walkers.ts DOG_STRIDE_M); a smaller dog takes more, shorter strides
    phase = np.asarray(phase, dtype=np.float64) * 0.9 / BREEDS[breed]["stride"]
    speed = np.abs(np.gradient(np.asarray(distance, dtype=np.float64)))  # metres per frame
    move = np.clip(speed / 0.03, 0.0, 1.0)  # a trot from about 0.9 m/s; less, the legs swing less
    for leg in parts["legs"]:
        off = 0.0 if leg["front"] == leg["left"] else math.pi  # diagonal pairs
        p = phase + off
        swing = -TROT_LIFT["upper"] * np.sin(p) * move  # + forward: about +Y turns the foot back, so negate
        fold = TROT_LIFT["lower"] * np.clip(np.sin(p + math.pi / 2), 0, None) * move  # folding while it swings forward
        for obj, vals in ((leg["upper"], swing), (leg["lower"], fold if leg["front"] else -fold * 0.8)):
            obj.rotation_mode = "XYZ"
            key_array(obj, "rotation_euler", 1, fr, vals)
    # the body bobs twice a stride (lifted off its feet, never sunk into the ground), pitches as the diagonals swap and
    # rolls a little from side to side, all fading as it slows; on top, a slow wander of the head and shoulders
    h = BREEDS[breed]["h"]
    root = parts["root"]
    root.rotation_mode = "XYZ"
    t = fr / 30.0
    key_array(root, "location", 2, fr, 0.035 * h * (0.5 - 0.5 * np.cos(2 * phase)) * move)
    key_array(root, "rotation_euler", 1, fr, math.radians(1.6) * np.sin(2 * phase + 0.6) * move + math.radians(1.5) * np.sin(2 * math.pi * 0.21 * t + 1.3))
    key_array(root, "rotation_euler", 0, fr, math.radians(1.2) * np.sin(phase) * move)
    key_array(root, "rotation_euler", 2, fr, math.radians(2.5) * np.sin(2 * math.pi * 0.13 * t + 0.4) + math.radians(1.0) * np.sin(phase) * move)
    wag = (0.35 if breed != "collie" else 0.15) * np.sin(2 * math.pi * fr / 30 * (2.2 if breed == "terrier" else 1.4))
    parts["tail"].rotation_mode = "XYZ"
    key_array(parts["tail"], "rotation_euler", 2, fr, wag)


def lead(prefix, coll, hand, ring, colour=(0.05, 0.12, 0.35)):
    """The lead: a 1 m cord along +Y, copied to the walker's hand and stretched to the collar's ring by constraints."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.006, radius2=0.006, depth=1.0,
                          matrix=Matrix.Rotation(-math.pi / 2, 4, "X") @ Matrix.Translation((0, 0, 0.5)))
    cord = _object(prefix + "lead", bm, [_mat(f"dog-lead-{colour[0]:.2f}", (*colour, 1), 0.6)], coll, None)
    c = cord.constraints.new("COPY_LOCATION")
    c.target = hand
    s = cord.constraints.new("STRETCH_TO")
    s.target = ring
    s.rest_length = 1.0
    s.volume = "NO_VOLUME"
    return cord
