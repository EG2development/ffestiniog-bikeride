"""Running kit for the runners (Phase 4): shorts or tights and a fitted top, cut from each runner's own body.

The MakeHuman system assets hold one sports outfit and no shorts, so a runner's kit is made from their skin: the
region a garment covers (chosen by each vertex's strongest bone and how far along that bone it lies) is copied, pushed
out along its normals (flared towards a shorts hem) and given a thin solidify. The copy keeps the body's weights, so it
moves exactly with the runner, and the skin under it is masked as MPFB masks skin under its own clothes.
"""
import bmesh
import bpy
import numpy as np

# runner -> bottom (shorts: hem as a share of the thigh from the hip; tights: of the calf from the knee), its colour,
# top (a tee), its colour, shoes (linear colours; technical fabrics in the colours runners wear)
KITS = {
    "owen": ("shorts", 0.42, (0.010, 0.013, 0.035), "tee", (0.75, 0.15, 0.02), "shoes05"),
    "jamal": ("tights", 0.92, (0.007, 0.007, 0.008), "tee", (0.42, 0.02, 0.03), "shoes06"),
    "tomos": ("shorts", 0.48, (0.008, 0.008, 0.010), "tee", (0.06, 0.25, 0.65), "shoes05"),
    "aisha": ("shorts", 0.30, (0.025, 0.025, 0.030), "tee", (0.0, 0.30, 0.32), "shoes06"),
    "zara": ("tights", 0.50, (0.006, 0.006, 0.008), "tee", (0.60, 0.05, 0.18), "shoes05"),
    "priya": ("tights", 0.92, (0.015, 0.015, 0.05), "tee", (0.32, 0.55, 0.04), "shoes05"),
}
SLEEVE = 0.36  # a tee's sleeve, as a share of the upper arm from the shoulder


def kit_for(pid, activity):
    return KITS.get(pid) if activity == "run" else None


def _weights(obj, names):
    """Each vertex's strongest group among `names` (index into names, -1 for none) and its 'body' membership."""
    idx = {obj.vertex_groups[n].index: i for i, n in enumerate(names) if n in obj.vertex_groups}
    body_g = obj.vertex_groups["body"].index if "body" in obj.vertex_groups else None
    best = np.full(len(obj.data.vertices), -1, np.int32)
    in_body = np.zeros(len(obj.data.vertices), bool) if body_g is not None else np.ones(len(obj.data.vertices), bool)
    for v in obj.data.vertices:
        w_best = 0.0
        for g in v.groups:
            if g.group == body_g and g.weight > 0.5:
                in_body[v.index] = True
            elif g.group in idx and g.weight > w_best:
                w_best, best[v.index] = g.weight, idx[g.group]
    return best, in_body


def rest_co(me):
    """The vertices with the phenotype's shape keys mixed in (the shape the bones were fitted to), (V, 3)."""
    def get(data):
        a = np.empty(len(me.vertices) * 3, np.float32)
        data.foreach_get("co", a)
        return a.reshape(-1, 3).astype(np.float64)
    co = get(me.vertices)
    if me.shape_keys:
        keys = me.shape_keys.key_blocks
        base = {kb.name: get(kb.data) for kb in keys}
        co = base[keys[0].name].copy()
        for kb in keys[1:]:
            if kb.value and not kb.mute:
                co += kb.value * (base[kb.name] - base[kb.relative_key.name])
    return co


def _along(co, bone):
    """How far along a bone (0 at its head, 1 at its tail) each vertex lies, in rest space."""
    h, t = np.array(bone.head_local), np.array(bone.tail_local)
    d = t - h
    return (co - h) @ d / (d @ d)


def regions(body, arm, kit):
    """Boolean masks of the body's vertices under the kit's bottom and top."""
    bottom, hem = kit[0], kit[1]
    bones = arm.data.bones
    names = ["pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r", "thigh_l", "thigh_r", "calf_l", "calf_r",
             "upperarm_l", "upperarm_r"]
    best, in_body = _weights(body, names)
    co = rest_co(body.data)
    z = co[:, 2]
    waist = bones["spine_01"].head_local.z + 0.01
    lower = in_body & (z <= waist) & np.isin(best, [0, 1, 6, 7, 8, 9])
    for side in "lr":
        thigh, calf = names.index(f"thigh_{side}"), names.index(f"calf_{side}")
        if bottom == "shorts":
            lower &= ~((best == thigh) & (_along(co, bones[f"thigh_{side}"]) > hem)) & (best != calf)
        else:
            lower &= ~((best == calf) & (_along(co, bones[f"calf_{side}"]) > hem))
    hem_z = bones["pelvis"].head_local.z - 0.01
    neck = bones["neck_01"].head_local
    front = np.clip(-(co[:, 1] - neck.y) / 0.08, 0, 1) * (np.abs(co[:, 0]) < 0.075)  # the neckline dips at the front
    upper = in_body & (z >= hem_z) & (z <= neck.z - 0.03 - 0.05 * front) & np.isin(best, [0, 1, 2, 3, 4, 5])
    for side in "lr":
        ua = names.index(f"upperarm_{side}")
        upper |= in_body & (best == ua) & (_along(co, bones[f"upperarm_{side}"]) <= SLEEVE)
    return lower, upper, co


def _fabric(name, colour, rough):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*colour, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Sheen Weight"].default_value = 0.35
    bsdf.inputs["Sheen Roughness"].default_value = 0.35
    knit = nt.nodes.new("ShaderNodeTexNoise")
    knit.inputs["Scale"].default_value = 900.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    nt.links.new(knit.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def _garment(body, arm, co, keep, offset, name, mat, hem=None):
    """The body's vertices under `keep` (at their rest shape `co`), pushed out by `offset` (per vertex, metres) and
    skinned like the body. `hem` (z, +1 for a lower edge, -1 for an upper) levels the open edge near z, which the
    mesh's topology would otherwise leave zig-zagged."""
    me = body.data.copy()
    me.name = name
    if me.shape_keys:
        holder = bpy.data.objects.new("kit-holder", me)
        holder.shape_key_clear()
        bpy.data.objects.remove(holder)
    me.vertices.foreach_set("co", co.astype(np.float32).ravel())
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    # cloth bridges the skin's small forms (navel, nipples, collarbones) before it stands off it
    bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    nipples = [body.vertex_groups[n].index for n in ("nipple", "nippleTip") if n in body.vertex_groups]
    deform = bm.verts.layers.deform.active
    if nipples and deform:
        soft = [v for v in bm.verts if any(gi in v[deform] for gi in nipples)]
        soft = list({w for v in soft for e in v.link_edges for w in (e.other_vert(v), v)})
        for _ in range(8):
            bmesh.ops.smooth_vert(bm, verts=soft, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * float(offset[v.index])
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.flatnonzero(~keep)], context="VERTS")
    edge = [v for v in bm.verts if v.is_boundary]
    for _ in range(10):  # every open edge (neck, sleeves, hems) smoothed along itself
        moved = {}
        for v in edge:
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                moved[v] = v.co * 0.5 + (nb[0].co + nb[1].co) * 0.25
        for v, c in moved.items():
            v.co = c
    if hem:
        z, side = hem
        for v in bm.verts:
            if v.is_boundary and 0 <= side * (v.co.z - z) < 0.035:
                v.co.z = z
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    for g in body.vertex_groups:
        obj.vertex_groups.new(name=g.name)
    for c in body.users_collection:
        c.objects.link(obj)
    obj.parent, obj.matrix_parent_inverse, obj.matrix_basis = arm, body.matrix_parent_inverse.copy(), body.matrix_basis.copy()
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    sol = obj.modifiers.new("Thickness", "SOLIDIFY")
    sol.thickness, sol.offset = 0.003, -1.0
    return obj


def dress(arm, kit, pid):
    """Shorts or tights and a tee on a runner built without an outfit; masks the skin they cover."""
    body = next(o for o in arm.children if o.type == "MESH" and o.name.endswith(".body"))
    bottom, hem, b_col, top, t_col, _ = kit
    lower, upper, co = regions(body, arm, kit)
    n = len(co)
    off = np.full(n, 0.004)
    if bottom == "shorts":  # loose legs: the flare grows from the hips to 2 cm at the hem
        thigh_top = arm.data.bones["thigh_l"].head_local.z
        off = np.where(co[:, 2] < thigh_top, 0.006 + 0.016 * np.clip((thigh_top - co[:, 2]) / 0.25, 0, 1), 0.006)
    bones = arm.data.bones
    _garment(body, arm, co, lower, off, f"{arm.name}.{bottom}", _fabric(f"kit-{pid}-{bottom}", b_col, 0.5 if bottom == "tights" else 0.65),
             hem=(co[lower, 2].max(), -1))
    _garment(body, arm, co, upper, np.full(n, 0.011), f"{arm.name}.{top}", _fabric(f"kit-{pid}-{top}", t_col, 0.6),
             hem=(bones["pelvis"].head_local.z - 0.01, 1))
    # mask the skin under the kit, three vertex rings in from its edges (smoothed inwards) so no gap opens at a hem
    covered = lower | upper
    me = body.data
    edges = np.empty(len(me.edges) * 2, np.int32)
    me.edges.foreach_get("vertices", edges)
    edges = edges.reshape(-1, 2)
    inner = covered.copy()
    for _ in range(3):
        ring = inner.copy()
        for a, b in ((0, 1), (1, 0)):
            ring[edges[~inner[edges[:, b]], a]] = False
        inner = ring
    g = body.vertex_groups.new(name="Delete.kit")
    g.add([int(i) for i in np.flatnonzero(inner)], 1.0, "REPLACE")
    mask = body.modifiers.new("Delete.kit", "MASK")
    mask.vertex_group, mask.invert_vertex_group = "Delete.kit", True
