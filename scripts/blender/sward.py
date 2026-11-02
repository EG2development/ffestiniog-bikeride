"""A grass sward near a ground section's cameras (Phase 3): hair-curve blades on the terrain where a frame sees them.

Beyond a few metres a blade is under a pixel and the terrain texture carries the grass, so blades grow only on the
terrain within 14 m of a camera position (fully within 6 m), thinning on steep or wooded ground. Each blade takes the
data colour of the ground it grows from, darker at its root, and the sward is kept clear of the trail, roads, bridges,
walls, buildings and water by the distance to their own meshes. Geometry Nodes scatters the blades at render time.
"""
import math

import bpy
import numpy as np

RADIUS_M, FULL_M = 14.0, 6.0
DENSITY = 450.0  # blades per m² at full density
CLEAR_M = 0.25


def _near_faces(terrain, cameras):
    """The terrain's faces within RADIUS_M of a camera position, and each vertex's density factor."""
    me = terrain.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3).astype(np.float64)
    cams = cameras[:: max(1, len(cameras) // 200)]
    lo, hi = cams.min(axis=0) - RADIUS_M, cams.max(axis=0) + RADIUS_M
    box = np.flatnonzero(np.all((co >= lo) & (co <= hi), axis=1))
    dist = np.full(len(co), np.inf)
    sub = co[box]
    d = np.full(len(box), np.inf)
    for c in cams:
        d = np.minimum(d, np.linalg.norm(sub - c, axis=1))
    dist[box] = d
    factor = np.clip((RADIUS_M - dist) / (RADIUS_M - FULL_M), 0.0, 1.0)
    n = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("normal", n)
    factor *= np.clip((n.reshape(-1, 3)[:, 2] - 0.55) / 0.2, 0.0, 1.0)  # thin on banks steeper than ~50°
    col = np.empty(len(me.vertices) * 4, np.float32)
    me.color_attributes["land"].data.foreach_get("color", col)
    col = col.reshape(-1, 4)[:, :3]
    lum = col @ np.array([0.2126, 0.7152, 0.0722])
    factor *= np.clip((lum - 0.02) / 0.03, 0.15, 1.0)  # little grass on a dark woodland floor
    if "shore" in me.attributes:  # none on a reservoir's stony draw-down band (waterside.py)
        shore = np.empty(len(me.vertices), np.float32)
        me.attributes["shore"].data.foreach_get("value", shore)
        factor *= 1.0 - shore
    tri = np.empty(len(me.polygons) * 3, np.int32)
    me.polygons.foreach_get("vertices", tri)
    tri = tri.reshape(-1, 3)
    keep = factor[tri].max(axis=1) > 0
    return co, col, factor, tri[keep]


def _base_mesh(name, co, col, factor, tri):
    used = np.unique(tri)
    remap = np.full(len(co), -1, np.int64)
    remap[used] = np.arange(len(used))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in co[used]], [], [tuple(t) for t in remap[tri]])
    me.attributes.new("near", "FLOAT", "POINT").data.foreach_set("value", factor[used].astype(np.float32))
    rgba = np.ones((len(used), 4), np.float32)
    rgba[:, :3] = col[used]
    me.attributes.new("land", "FLOAT_COLOR", "POINT").data.foreach_set("color", rgba.ravel())
    return me


def blade_material():
    mat = bpy.data.materials.get("grass-blade")
    if mat:
        return mat
    mat = bpy.data.materials.new("grass-blade")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    new, link = nt.nodes.new, nt.links.new
    land = new("ShaderNodeAttribute")
    land.attribute_name = "land"
    rand = new("ShaderNodeAttribute")
    rand.attribute_name = "blade_rand"
    info = new("ShaderNodeHairInfo")
    shade = new("ShaderNodeMapRange")  # root in the sward's shade, tip in the light
    shade.inputs["To Min"].default_value, shade.inputs["To Max"].default_value = 0.65, 1.6
    link(info.outputs["Intercept"], shade.inputs["Value"])
    vary = new("ShaderNodeMapRange")
    vary.inputs["To Min"].default_value, vary.inputs["To Max"].default_value = 0.8, 1.15
    link(rand.outputs["Fac"], vary.inputs["Value"])
    k = new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    link(shade.outputs[0], k.inputs[0])
    link(vary.outputs[0], k.inputs[1])
    green = new("ShaderNodeMix")
    green.data_type, green.blend_type = "RGBA", "MULTIPLY"
    green.inputs[0].default_value = 1.0
    link(land.outputs["Color"], green.inputs[6])
    link(k.outputs[0], green.inputs[7])
    dry = new("ShaderNodeMath")  # a few dead blades, straw coloured
    dry.operation = "GREATER_THAN"
    dry.inputs[1].default_value = 0.93
    link(rand.outputs["Fac"], dry.inputs[0])
    colour = new("ShaderNodeMix")
    colour.data_type = "RGBA"
    link(dry.outputs[0], colour.inputs[0])
    link(green.outputs[2], colour.inputs[6])
    colour.inputs[7].default_value = (0.30, 0.26, 0.13, 1)
    bsdf = new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.6
    bsdf.inputs["Specular IOR Level"].default_value = 0.3
    link(colour.outputs[2], bsdf.inputs["Base Color"])
    back = new("ShaderNodeBsdfTranslucent")
    link(colour.outputs[2], back.inputs["Color"])
    mix = new("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.2
    link(bsdf.outputs[0], mix.inputs[1])
    link(back.outputs[0], mix.inputs[2])
    out = new("ShaderNodeOutputMaterial")
    link(mix.outputs[0], out.inputs["Surface"])
    return mat


def _tree(name, base, exclude):
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nodes, link = ng.nodes, ng.links.new
    out = nodes.new("NodeGroupOutput")
    nodes.new("NodeGroupInput")

    def obj_geo(o):
        info = nodes.new("GeometryNodeObjectInfo")
        info.transform_space = "RELATIVE"
        info.inputs["Object"].default_value = o
        return info.outputs["Geometry"]

    def named(attr, kind="FLOAT"):
        a = nodes.new("GeometryNodeInputNamedAttribute")
        a.data_type = kind
        a.inputs["Name"].default_value = attr
        return a.outputs["Attribute"]

    def rnd(kind, lo, hi, seed):
        r = nodes.new("FunctionNodeRandomValue")
        r.data_type = kind
        r.inputs["Min"].default_value, r.inputs["Max"].default_value = lo, hi
        r.inputs["Seed"].default_value = seed
        return r.outputs["Value"]

    dist = nodes.new("GeometryNodeDistributePointsOnFaces")
    dist.distribute_method = "RANDOM"
    dist.inputs["Density"].default_value = DENSITY
    link(obj_geo(base), dist.inputs["Mesh"])
    link(named("near"), next(i for i in dist.inputs if i.name == "Density Factor"))  # looked up by name: not keyed in 5.2
    pts = dist.outputs["Points"]
    if exclude:
        join = nodes.new("GeometryNodeJoinGeometry")
        for o in exclude:
            link(obj_geo(o), join.inputs["Geometry"])
        prox = nodes.new("GeometryNodeProximity")
        prox.target_element = "FACES"
        link(join.outputs["Geometry"], prox.inputs[0])
        close = nodes.new("FunctionNodeCompare")
        close.data_type, close.operation = "FLOAT", "LESS_THAN"
        close.inputs["B"].default_value = CLEAR_M
        link(prox.outputs["Distance"], close.inputs["A"])
        drop = nodes.new("GeometryNodeDeleteGeometry")
        drop.domain = "POINT"
        link(pts, drop.inputs["Geometry"])
        link(close.outputs["Result"], drop.inputs["Selection"])
        pts = drop.outputs["Geometry"]
    store = nodes.new("GeometryNodeStoreNamedAttribute")
    store.data_type, store.domain = "FLOAT", "POINT"
    store.inputs["Name"].default_value = "blade_rand"
    link(pts, store.inputs["Geometry"])
    link(rnd("FLOAT", 0.0, 1.0, 5), store.inputs["Value"])
    blade = nodes.new("GeometryNodeCurveQuadraticBezier")
    blade.inputs["Resolution"].default_value = 3
    blade.inputs["Start"].default_value = (0, 0, 0)
    blade.inputs["Middle"].default_value = (0.02, 0, 0.55)
    blade.inputs["End"].default_value = (0.22, 0, 1.0)
    inst = nodes.new("GeometryNodeInstanceOnPoints")
    link(store.outputs["Geometry"], inst.inputs["Points"])
    link(blade.outputs["Curve"], inst.inputs["Instance"])
    link(rnd("FLOAT_VECTOR", (-0.3, -0.3, 0.0), (0.3, 0.3, 2 * math.pi), 7), inst.inputs["Rotation"])
    link(rnd("FLOAT", 0.05, 0.2, 9), inst.inputs["Scale"])
    real = nodes.new("GeometryNodeRealizeInstances")
    link(inst.outputs["Instances"], real.inputs["Geometry"])
    param = nodes.new("GeometryNodeSplineParameter")
    taper = nodes.new("ShaderNodeMapRange")
    taper.inputs["To Min"].default_value, taper.inputs["To Max"].default_value = 0.0022, 0.0004
    link(param.outputs["Factor"], taper.inputs["Value"])
    radius = nodes.new("GeometryNodeSetCurveRadius")
    link(real.outputs["Geometry"], radius.inputs["Curve"])
    link(taper.outputs[0], radius.inputs["Radius"])
    setmat = nodes.new("GeometryNodeSetMaterial")
    setmat.inputs["Material"].default_value = blade_material()
    link(radius.outputs["Curve"], setmat.inputs["Geometry"])
    link(setmat.outputs["Geometry"], out.inputs["Geometry"])
    return ng


def sward(terrain, cameras, coll, n, exclude):
    """The sward as a hair-curves object generated from a near-camera copy of the terrain. Returns its size."""
    co, col, factor, tri = _near_faces(terrain, cameras)
    if not len(tri):
        return {"faces": 0}
    base = bpy.data.objects.new(n("sward-ground"), _base_mesh(n("sward-ground"), co, col, factor, tri))
    coll.objects.link(base)
    base.hide_render = base.hide_viewport = True
    curves = bpy.data.hair_curves.new(n("sward"))
    obj = bpy.data.objects.new(n("sward"), curves)
    coll.objects.link(obj)
    mod = obj.modifiers.new("blades", "NODES")
    mod.node_group = _tree(n("ffest-sward"), base, exclude)
    for scene in bpy.data.scenes:
        if obj.name in scene.collection.all_objects:
            scene.render.hair_type, scene.render.hair_subdiv = "STRIP", 0
    me = base.data
    area = sum(p.area * float(np.mean([me.attributes["near"].data[v].value for v in p.vertices])) for p in me.polygons)
    return {"faces": len(tri), "bladesApprox": int(area * DENSITY)}
