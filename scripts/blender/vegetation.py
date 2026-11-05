"""Vegetation for a dressed section: CC0 trees and grass instanced on the package's points (Phase 3).

Every instance sits exactly on an exported point at its exported scale and yaw; only the model differs. Each tree's
level of detail comes from its distance to the section's cameras: full Poly Haven meshes within 45 m, lighter ones to
320 m (leaf cards thinned whole, never decimated), and a few-hundred-triangle crown beyond, as ADR 60's "what no
frame sees costs nothing" asks. Aerial scenes use the crowns throughout.
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

from landscape import VENDOR, Nodes, _cache, register

NEAR_M, MID_M = 45.0, 320.0  # level-of-detail bands, by distance to the nearest camera position of the section


WIND = {"tree": math.radians(0.6), "grass": math.radians(4.0)}  # how far plants lean in the breeze (radians)


def _library_objects(asset_id, names):
    """Append named objects from a Poly Haven model file once per Blender file; their textures stay in the vendor dir."""
    path = VENDOR / register()[asset_id]["files"]["blend"]["path"]
    missing = [n for n in names if n not in bpy.data.objects]
    if missing:
        with bpy.data.libraries.load(str(path), link=False) as (src, dst):
            dst.objects = [n for n in src.objects if n in missing]
    return [bpy.data.objects[n] for n in names]


def _variant_collection(name, objs, unit_height=True):
    """A collection of variants, each moved to the origin, standing on it, and (trees) scaled to 1 m tall so the
    instances' scale is their height in metres; grass keeps its own size."""
    coll = bpy.data.collections.get(name)
    if coll:
        return coll
    coll = bpy.data.collections.new(name)
    for o in objs:
        o = o.copy()
        o.name = f"{name}:{len(coll.objects)}"
        coll.objects.link(o)
        bb = [Vector(c) for c in o.bound_box]
        h = max(v.z for v in bb) - min(v.z for v in bb)
        s = 1.0 / h if unit_height else 1.0
        o.location = (0, 0, -min(v.z for v in bb) * s)
        o.rotation_euler = (0, 0, 0)
        o.scale = (s, s, s)
    return coll


# distant crowns' shapes (review 2026-11-03: one shape for every far tree read as rows of identical lollipops from the
# path): (half width, half depth, crown centre, crown base) as shares of the tree's height
BROADLEAF_CROWNS = ((0.24, 0.17, 0.62, 0.30), (0.17, 0.25, 0.63, 0.26), (0.33, 0.13, 0.56, 0.28), (0.22, 0.18, 0.60, 0.24))
CONIFER_CROWNS = (1.0, 0.82, 1.18)  # tier widths' scale: average, slender, broad


def _impostor_mesh(kind, v, rng):
    """One distant tree, a few hundred triangles, 1 unit tall: a lumpy broadleaf crown or a tiered conifer."""
    import bmesh
    bm = bmesh.new()
    if kind == "conifer":  # tiers of drooping branches: star-shaped cones, narrowing to the leader
        w = CONIFER_CROWNS[v]
        for i, (z, r) in enumerate(((0.12, 0.34), (0.26, 0.3), (0.4, 0.25), (0.53, 0.2), (0.66, 0.14), (0.79, 0.08))):
            depth = 0.3 - 0.025 * i
            cone = bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=r * w * (1 + 0.08 * rng.standard_normal()), radius2=0.0, depth=depth,
                                         matrix=Matrix.Translation((0, 0, z + depth / 2)) @ Matrix.Rotation(0.4 * i + v, 4, "Z"))
            rim = [p for p in cone["verts"] if abs(p.co.z - z) < 1e-4 and p.co.xy.length > 1e-4]
            for k, p in enumerate(sorted(rim, key=lambda p: math.atan2(p.co.y, p.co.x))):
                p.co.xy *= (0.62 if k % 2 else 1.0) * (1 + 0.1 * rng.standard_normal())
        bmesh.ops.create_cone(bm, cap_ends=False, segments=6, radius1=0.025, radius2=0.02, depth=0.15,
                              matrix=Matrix.Translation((0, 0, 0.075)))
    else:  # a cauliflower crown of overlapping lobes, its shape from BROADLEAF_CROWNS, lopsided now and then
        wx, wz, cz, base = BROADLEAF_CROWNS[v]
        lean = rng.normal(size=2) * 0.04 if v == 3 else np.zeros(2)
        lobes = [((lean[0], lean[1], cz), wx * 1.25)]
        for _ in range(13):
            d = rng.normal(size=3) * (wx * 0.85, wx * 0.85, wz * 0.9)
            r = rng.uniform(0.55, 0.95) * wx
            z = max(cz + d[2], base + r * 0.7)  # lobes reach down to the crown's base, never below it
            lobes.append(((d[0] + lean[0], d[1] + lean[1], z), r))
        for c, r in lobes:
            sp = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r, matrix=Matrix.Translation(c))
            for p in sp["verts"]:
                p.co = Vector(c) + (p.co - Vector(c)) * (1 + 0.12 * rng.standard_normal())
        bmesh.ops.create_cone(bm, cap_ends=False, segments=6, radius1=0.035, radius2=0.025, depth=base + 0.1,
                              matrix=Matrix.Translation((0, 0, (base + 0.1) / 2)))
        top = max(p.co.z for p in bm.verts)
        for p in bm.verts:  # 1 unit tall, so the instance's scale is its height
            p.co.z /= top
    me = bpy.data.meshes.new(f"impostor-{kind}:{v}")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(bpy.data.materials.get("impostor-foliage") or _impostor_material())
    return me


def _impostor(kind):
    """Distant trees: a few crown shapes per kind (the instance's variant picks one), in the instance's tint."""
    name = f"impostor-{kind}"
    coll = bpy.data.collections.get(name)
    if coll:
        return coll
    rng = np.random.default_rng(7)
    coll = bpy.data.collections.new(name)
    for v in range(len(CONIFER_CROWNS if kind == "conifer" else BROADLEAF_CROWNS)):
        coll.objects.link(bpy.data.objects.new(f"{name}:{v}", _impostor_mesh(kind, v, rng)))
    return coll


def _impostor_material():
    mat = bpy.data.materials.new("impostor-foliage")
    mat.use_nodes = True
    nd = Nodes(mat)
    tint = nd.new("ShaderNodeAttribute", -900, 200, attribute_type="INSTANCER", attribute_name="tint")
    kind = nd.new("ShaderNodeAttribute", -900, 0, attribute_type="INSTANCER", attribute_name="broadleaf")
    # each tree its own green, from blue-green conifers to yellow-green broadleaves, by kind and a per-instance random
    info = nd.new("ShaderNodeObjectInfo", -1100, 400)
    hue = nd.mix(info.outputs["Random"], (0.02, 0.05, 0.03, 1), (0.05, 0.085, 0.02, 1), x=-700, y=500)
    base = nd.mix(kind.outputs["Fac"], (0.014, 0.034, 0.022, 1), hue)
    shade = nd.mix(tint.outputs["Fac"], (0.75, 0.75, 0.75, 1.0), (1.25, 1.25, 1.25, 1.0), x=-500)
    col = nd.mix(1.0, base, shade, blend="MULTIPLY")
    tc = nd.new("ShaderNodeTexCoord", -900, -300)
    vor = nd.new("ShaderNodeTexVoronoi", -700, -300)
    vor.inputs["Scale"].default_value = 26.0
    nd.link(tc.outputs["Object"], vor.inputs["Vector"])
    leafy = nd.new("ShaderNodeMapRange", -450, -300)
    leafy.inputs["To Min"].default_value, leafy.inputs["To Max"].default_value = 0.45, 1.25
    nd.link(vor.outputs["Distance"], leafy.inputs["Value"])
    # the crown's underside and inner lobes in their own shade, its top catching the light
    sep = nd.new("ShaderNodeSeparateXYZ", -700, -600)
    nd.link(tc.outputs["Object"], sep.inputs[0])
    depth = nd.new("ShaderNodeMapRange", -450, -600)
    depth.inputs["From Min"].default_value, depth.inputs["From Max"].default_value = 0.3, 0.95
    depth.inputs["To Min"].default_value, depth.inputs["To Max"].default_value = 0.55, 1.2
    nd.link(sep.outputs["Z"], depth.inputs["Value"])
    lit = nd.math("MULTIPLY", leafy.outputs[0], depth.outputs[0], -250, -400)
    nd.link(nd.mix(1.0, col, lit, blend="MULTIPLY"), nd.bsdf.inputs["Base Color"])
    bump = nd.new("ShaderNodeBump", 200, -400)
    bump.inputs["Strength"].default_value = 1.0
    nd.link(vor.outputs["Distance"], bump.inputs["Height"])
    nd.link(bump.outputs["Normal"], nd.bsdf.inputs["Normal"])
    nd.bsdf.inputs["Roughness"].default_value = 0.85
    nd.bsdf.inputs["Specular IOR Level"].default_value = 0.3
    return mat


def vegetation_library():
    """Variant collections per kind and level of detail (built once per file)."""
    if "vegetation" in _cache and all(c.name in bpy.data.collections for c in _cache["vegetation"].values() if c):
        return _cache["vegetation"]
    names = {lod: [f"fir_tree_01_{v}_{lod}" for v in "abc"] for lod in ("LOD1", "LOD2")}
    fir = _library_objects("fir_tree_01", names["LOD1"] + names["LOD2"])  # one load: the LODs share their textures
    small = _library_objects("tree_small_02", ["tree_small_02_LOD1"])[0]
    near_broad = [_thin_foliage(small, f"broadleaf-near-{k}", keep=0.45, seed=k) for k in (3, 11)]
    mid_broad = [_thin_foliage(small, f"broadleaf-mid-{k}", keep=0.1, drop="branches", seed=k) for k in (3, 11)]
    grass = _library_objects("grass_medium_01", [f"grass_medium_01_{v}_LOD1" for v in ("large_a", "large_b", "large_c", "mid_a", "mid_b", "mid_c")])
    lib = {
        ("conifer", "near"): _variant_collection("veg-conifer-near", fir[:3]),
        ("conifer", "mid"): _variant_collection("veg-conifer-mid", fir[3:]),
        ("conifer", "far"): _impostor("conifer"),
        ("broadleaf", "near"): _variant_collection("veg-broadleaf-near", near_broad),
        ("broadleaf", "mid"): _variant_collection("veg-broadleaf-mid", mid_broad),
        ("broadleaf", "far"): _impostor("broadleaf"),
        ("grass", "near"): _variant_collection("veg-grass", grass, unit_height=False),
    }
    _cache["vegetation"] = lib
    return lib


def _thin_foliage(src, name, keep, drop=None, seed=3):
    """A lighter tree: a random `keep` share of whole leaf clusters, each enlarged about its centre by 1/sqrt(keep) so
    the crown keeps its cover (decimation would tear the alpha-mapped cards). `drop` removes a material's faces too
    (fine twigs, invisible at mid distance)."""
    import bmesh
    if name in bpy.data.objects:
        return bpy.data.objects[name]
    me = src.data.copy()
    me.name = name
    n_p, n_v = len(me.polygons), len(me.vertices)
    mi = np.empty(n_p, np.int32)
    lt = np.empty(n_p, np.int32)
    me.polygons.foreach_get("material_index", mi)
    me.polygons.foreach_get("loop_total", lt)
    lv = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get("vertex_index", lv)
    mats = [m.name.lower() if m else "" for m in me.materials]
    leaf = np.isin(mi, [i for i, m in enumerate(mats) if "leaves" in m or "leaf" in m])
    poly_of_loop = np.repeat(np.arange(n_p), lt)
    sel = leaf[poly_of_loop]
    loops_v, loops_p = lv[sel], poly_of_loop[sel]
    starts = np.flatnonzero(np.r_[True, loops_p[1:] != loops_p[:-1]])
    labels = np.arange(n_v)
    for _ in range(200):  # connected leaf clusters by label propagation over shared vertices
        face_min = np.minimum.reduceat(labels[loops_v], starts)
        before = labels.copy()
        np.minimum.at(labels, loops_v, np.repeat(face_min, np.diff(np.r_[starts, len(loops_v)])))
        labels = labels[labels]
        if np.array_equal(before, labels):
            break
    comp_of_poly = np.full(n_p, -1)
    comp_of_poly[np.unique(loops_p)] = labels[loops_v[starts]]
    comps = np.unique(comp_of_poly[leaf])
    rng = np.random.default_rng(seed)
    kept = comps[rng.random(len(comps)) < keep]
    kill = leaf & ~np.isin(comp_of_poly, kept)
    if drop:
        kill |= np.isin(mi, [i for i, m in enumerate(mats) if drop in m])
    # enlarge the kept clusters about their centres
    co = np.empty(n_v * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    kept_v = np.zeros(n_v, bool)
    kept_v[loops_v[np.isin(comp_of_poly[loops_p], kept)]] = True
    idx = np.flatnonzero(kept_v)
    lab = labels[idx]
    uniq, inv = np.unique(lab, return_inverse=True)
    centre = np.zeros((len(uniq), 3))
    np.add.at(centre, inv, co[idx])
    centre /= np.bincount(inv)[:, None]
    co[idx] = centre[inv] + (co[idx] - centre[inv]) / math.sqrt(keep)
    me.vertices.foreach_set("co", co.ravel())
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in np.flatnonzero(kill)], context="FACES")
    bm.to_mesh(me)
    bm.free()
    return bpy.data.objects.new(name, me)


NOMINAL = {"conifer": 14.25, "broadleaf": 10.6}  # src/three-core/trees.ts: metres at instance scale 1
GRASS_SCALE = 2.2  # the grass clumps are 0.14-0.33 m tall as modelled; the source's clumps stand about 0.4 m


def _instancer_tree(collection):
    """Geometry Nodes: one instance of the collection's `variant` child per point, yawed and scaled by `height`. Instance
    on Points carries the points' attributes (tint, broadleaf) to the instances, where the shaders read them."""
    name = f"ffest-instancer:{collection.name}"
    ng = bpy.data.node_groups.get(name)
    if ng:
        return ng
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n, link = ng.nodes, ng.links.new
    gin, gout = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    pts = n.new("GeometryNodeMeshToPoints")
    ci = n.new("GeometryNodeCollectionInfo")
    ci.transform_space = "ORIGINAL"
    ci.inputs["Separate Children"].default_value = True
    ci.inputs["Reset Children"].default_value = False
    ci.inputs["Collection"].default_value = collection
    inst = n.new("GeometryNodeInstanceOnPoints")
    inst.inputs["Pick Instance"].default_value = True

    def attr(name, kind="FLOAT"):
        a = n.new("GeometryNodeInputNamedAttribute")
        a.data_type = kind
        a.inputs["Name"].default_value = name
        return a.outputs["Attribute"]
    rot = n.new("ShaderNodeCombineXYZ")
    link(attr("yaw"), rot.inputs["Z"])
    # a breeze: each plant leans a little about its base and back, slowly, out of step with its neighbours (its phase
    # from where it stands); grass more than trees
    sway = WIND["grass" if "grass" in collection.name else "tree"]
    clock = n.new("GeometryNodeInputSceneTime")
    where = n.new("ShaderNodeSeparateXYZ")
    link(n.new("GeometryNodeInputPosition").outputs["Position"], where.inputs[0])

    def op(kind, a, b=None, value=None):
        m = n.new("ShaderNodeMath")
        m.operation = kind
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                link(v, m.inputs[i])
        return m.outputs[0]
    phase = op("ADD", op("MULTIPLY", where.outputs["X"], 0.37), op("MULTIPLY", where.outputs["Y"], 0.23))
    for axis, (hz, amp, k) in (("X", (0.23, 1.0, 1.0)), ("Y", (0.17, 0.6, 1.3))):
        wave = op("SINE", op("ADD", op("MULTIPLY", clock.outputs["Seconds"], 2 * math.pi * hz), op("MULTIPLY", phase, k)))
        gust = op("SINE", op("ADD", op("MULTIPLY", clock.outputs["Seconds"], 2 * math.pi * hz * 2.7), op("MULTIPLY", phase, 1.9 * k)))
        link(op("MULTIPLY", op("ADD", wave, op("MULTIPLY", gust, 0.35)), sway * amp), rot.inputs[axis])
    link(gin.outputs["Geometry"], pts.inputs["Mesh"])
    link(pts.outputs["Points"], inst.inputs["Points"])
    link(ci.outputs["Instances"], inst.inputs["Instance"])
    link(attr("variant", "INT"), inst.inputs["Instance Index"])
    link(rot.outputs["Vector"], inst.inputs["Rotation"])
    # height from the package; crown width varies +-20 % per point (seeded by the point's index, so it is repeatable)
    width = n.new("FunctionNodeRandomValue")
    width.data_type = "FLOAT"
    width.inputs["Min"].default_value, width.inputs["Max"].default_value = 0.8, 1.2
    wide = n.new("ShaderNodeMath")
    wide.operation = "MULTIPLY"
    link(attr("height"), wide.inputs[0])
    link(width.outputs["Value"], wide.inputs[1])
    scale = n.new("ShaderNodeCombineXYZ")
    link(wide.outputs[0], scale.inputs["X"])
    link(wide.outputs[0], scale.inputs["Y"])
    link(attr("height"), scale.inputs["Z"])
    link(scale.outputs["Vector"], inst.inputs["Scale"])
    link(inst.outputs["Instances"], gout.inputs["Geometry"])
    return ng


def _points_object(name, rows, coll, collection, broadleaf, ground=None):
    """A vertex-only mesh at the instance points carrying yaw, height, tint and variant attributes (and the ground
    colour under each, for grass)."""
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(rows))
    me.vertices.foreach_set("co", rows[:, 0:3].astype(np.float32).ravel())
    for attr, kind, values in (("yaw", "FLOAT", rows[:, 4]), ("height", "FLOAT", rows[:, 7]), ("tint", "FLOAT", rows[:, 5]),
                               ("variant", "INT", rows[:, 8]), ("broadleaf", "FLOAT", np.full(len(rows), float(broadleaf)))):
        a = me.attributes.new(attr, kind, "POINT")
        a.data.foreach_set("value", values.astype(np.int32 if kind == "INT" else np.float32))
    if ground is not None:
        me.attributes.new("ground", "FLOAT_VECTOR", "POINT").data.foreach_set("vector", ground.ravel())
    obj = bpy.data.objects.new(name, me)
    coll.objects.link(obj)
    mod = obj.modifiers.new("instances", "NODES")
    mod.node_group = _instancer_tree(collection)
    return obj


def dress_vegetation(pts_by_kind, cameras, coll, n, aerial, terrain=None):
    """Replace placeholder vegetation with instances. `pts_by_kind`: kind -> (N, 7) rows [x, y, z, scale, yaw, tint, variant];
    `cameras`: (F, 3) camera positions, for each tree's level of detail; `terrain` colours the grass. Returns counts
    per kind and band."""
    lib = vegetation_library()
    if terrain is not None:
        for o in lib[("grass", "near")].objects:
            for s in o.material_slots:
                tint_grass(s.material)
    counts = {}
    for kind, rows in pts_by_kind.items():
        if not len(rows):
            continue
        height = rows[:, 3] * (GRASS_SCALE if kind == "grass" else NOMINAL[kind])
        if kind == "grass":
            bands = {"near": np.ones(len(rows), bool)}
        else:
            d = _nearest_distance(rows[:, 0:3], cameras)
            bands = {"far": np.ones(len(rows), bool)} if aerial else {"near": d < NEAR_M, "mid": (d >= NEAR_M) & (d < MID_M), "far": d >= MID_M}
        for band, sel in bands.items():
            if not sel.any():
                continue
            collection = lib[(kind, band)]
            nvar = len(collection.objects)
            sub = rows[sel]
            rng = np.random.default_rng(len(sub))
            variant = (np.abs(sub[:, 6]).astype(np.int64) + rng.integers(0, 997, len(sub))) % nvar
            table = np.column_stack([sub[:, 0:7], height[sel], variant])
            ground = ground_colours(sub[:, 0:3], terrain) if kind == "grass" and terrain is not None else None
            _points_object(n(f"{kind}-{band}"), table, coll, collection, kind == "broadleaf", ground)
            counts[f"{kind}-{band}"] = int(sel.sum())
    return counts


def hedgerows(hedge, coll, n, spacing=2.6, height=2.4):
    """An aerial scene's hedges as continuous lines of bushes on the hedge mesh's own line, so field boundaries read
    from hundreds of metres up as they do in aerial photographs (a 0.6 m box is under a pixel there)."""
    me = hedge.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3).astype(np.float64)
    cell = np.floor(co[:, :2] / spacing).astype(np.int64)
    _, inv = np.unique(cell, axis=0, return_inverse=True)
    inv = inv.ravel()
    k = inv.max() + 1
    xy = np.zeros((k, 2))
    np.add.at(xy, inv, co[:, :2])
    xy /= np.bincount(inv, minlength=k)[:, None]
    z = np.full(k, np.inf)
    np.minimum.at(z, inv, co[:, 2])
    rng = np.random.default_rng(k)
    h = height * rng.uniform(0.8, 1.2, k)
    rows = np.column_stack([xy, z - 0.25 * h, np.ones(k), rng.uniform(0, 2 * math.pi, k), rng.uniform(0, 1, k), np.zeros(k), h, rng.integers(0, len(BROADLEAF_CROWNS), k)])
    _points_object(n("hedgerow-bushes"), rows, coll, _impostor("broadleaf"), True)
    return int(k)


def ground_colours(points, terrain):
    """The terrain's data colour (linear RGB) under each point, from its nearest vertex."""
    from mathutils.kdtree import KDTree
    me = terrain.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    col = np.empty(len(me.vertices) * 4, np.float32)
    me.color_attributes["land"].data.foreach_get("color", col)
    col = col.reshape(-1, 4)[:, :3]
    kd = KDTree(len(co))
    for i, p in enumerate(co):
        kd.insert(p, i)
    kd.balance()
    return np.array([col[kd.find(p)[1]] for p in points], np.float32)


def tint_grass(mat):
    """The clumps' texture re-centred on the ground colour under each instance (its 'ground' attribute), so a clump
    reads as taller growth of the same sward, not a dark tuft on it."""
    if mat.get("ffest_tinted"):
        return
    nt = mat.node_tree
    group = next(nd for nd in nt.nodes if nd.type == "GROUP")
    diff = next(nd for nd in nt.nodes if nd.type == "TEX_IMAGE" and nd.image.name.endswith("_diff.png") and "dry" not in nd.image.name)
    alpha = next(nd for nd in nt.nodes if nd.type == "TEX_IMAGE" and "alpha" in nd.image.name)
    a = np.empty(len(alpha.image.pixels), np.float32)
    alpha.image.pixels.foreach_get(a)
    d = np.empty(len(diff.image.pixels), np.float32)
    diff.image.pixels.foreach_get(d)
    w = a.reshape(-1, 4)[:, 0]
    srgb = d.reshape(-1, 4)[:, :3]
    lin = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    mean = (lin * w[:, None]).sum(axis=0) / max(w.sum(), 1.0)
    ground = nt.nodes.new("ShaderNodeAttribute")
    ground.attribute_type, ground.attribute_name = "INSTANCER", "ground"
    for socket in ("Diffuse", "Diffuse Dead"):
        if not group.inputs[socket].links:
            continue
        src = group.inputs[socket].links[0].from_socket
        ratio = nt.nodes.new("ShaderNodeMix")
        ratio.data_type, ratio.blend_type = "RGBA", "DIVIDE"
        ratio.inputs[0].default_value = 1.0
        ratio.inputs[7].default_value = (*mean, 1.0)
        nt.links.new(src, ratio.inputs[6])
        tinted = nt.nodes.new("ShaderNodeMix")
        tinted.data_type, tinted.blend_type = "RGBA", "MULTIPLY"
        tinted.inputs[0].default_value = 1.0
        nt.links.new(ratio.outputs[2], tinted.inputs[6])
        nt.links.new(ground.outputs["Vector"], tinted.inputs[7])
        keep = nt.nodes.new("ShaderNodeMix")
        keep.data_type = "RGBA"
        keep.inputs[0].default_value = 0.2
        nt.links.new(tinted.outputs[2], keep.inputs[6])
        nt.links.new(src, keep.inputs[7])
        nt.links.new(keep.outputs[2], group.inputs[socket])
    mat["ffest_tinted"] = True


def _nearest_distance(points, cameras):
    """Distance from each point to the nearest of a (decimated) set of camera positions."""
    cams = cameras[:: max(1, len(cameras) // 120)]
    best = np.full(len(points), np.inf)
    for c in cams:
        best = np.minimum(best, np.linalg.norm(points - c, axis=1))
    return best
