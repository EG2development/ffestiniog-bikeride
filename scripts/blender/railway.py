"""The mothballed railway as it stands today, for the community film's "then" shot (review 2026-11-05): standard-gauge
track laid along the trail's line, rusted and grown over, in place of the proposed path.

The line's track is in place but out of use; the film shows it before the path so the audience sees what is there
today. The rails and sleepers follow the trail ribbon's centreline (the mapped alignment, not a survey: the legend says
so) and are built only within reach of the scene's cameras. The trackbed is the ribbon itself in a ballast finish, with
the verge's grass and moss reaching well across it, and the sward is left free to grow through it (import_blockout).
"""
import bpy
import numpy as np

from landscape import TILE_M, Nodes, _data_tinted, _finish, _untiled

GAUGE_M = 1.435
RAIL = {"width": 0.07, "height": 0.15}
SLEEPER = {"length": 2.5, "width": 0.25, "height": 0.14, "pitch": 0.72, "sunk": 0.06}  # bedded this far into the ballast
REACH_M = 350.0  # track is built this far from any camera position; beyond that it is under a pixel
BALLAST = {"colour": (0.11, 0.10, 0.09), "edge_m": 1.3, "creep": 0.85, "verge": (0.7, 0.72, 0.6)}


def centreline(trail_obj):
    """The ribbon's centreline (its vertices come in pairs across the path) and unit tangents, in world metres."""
    me = trail_obj.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3).astype(np.float64)
    c = (co[0::2] + co[1::2]) / 2
    c += np.array(trail_obj.location, dtype=np.float64)
    t = np.gradient(c, axis=0)
    t[:, 2] = 0.0
    t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-9)
    return c, t


def _near(c, cameras):
    cams = cameras[:: max(1, len(cameras) // 120)]
    best = np.full(len(c), np.inf)
    for cam in cams:
        best = np.minimum(best, np.linalg.norm(c - cam, axis=1))
    idx = np.flatnonzero(best < REACH_M)
    return (int(idx.min()), int(idx.max()) + 1) if len(idx) else (0, 0)


def _mesh(name, verts, faces, mat, coll):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    coll.objects.link(obj)
    return obj


def rail_material():
    mat = bpy.data.materials.get("railway-rail")
    if mat:
        return mat
    mat = bpy.data.materials.new("railway-rail")
    mat.use_nodes = True
    nd = Nodes(mat)
    tc = nd.new("ShaderNodeTexCoord", -800, 0)
    noise = nd.new("ShaderNodeTexNoise", -600, 0)
    noise.inputs["Scale"].default_value, noise.inputs["Detail"].default_value = 3.0, 5.0
    nd.link(tc.outputs["Object"], noise.inputs["Vector"])
    # rust, from a dark brown to an orange-brown, with the head of the rail no brighter: nothing has run on it for years
    nd.link(nd.mix(noise.outputs["Fac"], (0.16, 0.07, 0.035, 1.0), (0.36, 0.17, 0.07, 1.0)), nd.bsdf.inputs["Base Color"])
    nd.bsdf.inputs["Roughness"].default_value = 0.8
    bump = nd.new("ShaderNodeBump", 300, -300)
    bump.inputs["Strength"].default_value = 0.3
    nd.link(noise.outputs["Fac"], bump.inputs["Height"])
    nd.link(bump.outputs["Normal"], nd.bsdf.inputs["Normal"])
    return mat


def sleeper_material():
    import street
    # decades of weather: grey-black timber, no fresh grain
    return street._wood("railway-sleeper", light=(0.11, 0.095, 0.08, 1), dark=(0.045, 0.04, 0.035, 1))


def trackbed_material():
    """Ballast on the trail ribbon's UVs (U across, V along per 3 m): dark, weathered stone, the verge reaching over a
    metre in from either side, raggedly, as a line left for decades looks."""
    mat = bpy.data.materials.get("railway-trackbed")
    if mat:
        return mat
    mat = bpy.data.materials.new("railway-trackbed")
    mat.use_nodes = True
    nd = Nodes(mat)
    col, nor, rough = _untiled(nd, "terrain-rock", TILE_M["terrain-rock"] / 4)
    col = _data_tinted(nd, col, "terrain-rock", (*BALLAST["colour"], 1.0), keep=0.0)
    uv = nd.new("ShaderNodeUVMap", -1400, 1400)
    uv.uv_map = "UV"
    sep = nd.new("ShaderNodeSeparateXYZ", -1200, 1400)
    nd.link(uv.outputs["UV"], sep.inputs[0])
    inside = nd.math("MINIMUM", sep.outputs["X"], nd.math("SUBTRACT", 1.0, sep.outputs["X"], -1000, 1250), -800, 1400)
    reach = nd.math("DIVIDE", nd.math("MULTIPLY", inside, 3.0, -600, 1400), BALLAST["edge_m"], -400, 1400)
    tc = nd.new("ShaderNodeTexCoord", -800, 1800)
    ragged = nd.new("ShaderNodeTexNoise", -600, 1800)
    ragged.inputs["Scale"].default_value, ragged.inputs["Detail"].default_value = 1.6, 6.0
    nd.link(tc.outputs["Object"], ragged.inputs["Vector"])
    creep = nd.new("ShaderNodeMapRange", -200, 1600)
    creep.inputs["From Min"].default_value, creep.inputs["From Max"].default_value = -0.12, 0.12
    creep.inputs["To Max"].default_value = BALLAST["creep"]
    nd.link(nd.math("SUBTRACT", ragged.outputs["Fac"], reach, -200, 1800), creep.inputs["Value"])
    verge = nd.mix(1.0, _untiled(nd, "terrain-grass", TILE_M["terrain-grass"], y=-2400)[0], (*BALLAST["verge"], 1.0), blend="MULTIPLY")
    col = nd.mix(creep.outputs[0], col, verge, blend="MIX")
    rough = nd.mix(creep.outputs[0], rough, (0.95, 0.95, 0.95, 1.0), blend="MIX")
    _finish(nd, col, nor, rough, 0.9, 1.1)
    return mat


def build_track(trail_obj, cameras, coll, n):
    """Two rails and their sleepers on the ribbon's centreline within REACH_M of the cameras; returns what was built."""
    c, t = centreline(trail_obj)
    lo, hi = _near(c, np.asarray(cameras, dtype=np.float64))
    if hi - lo < 2:
        return {"rails": 0, "sleepers": 0}
    c, t = c[lo:hi], t[lo:hi]
    right = np.stack([t[:, 1], -t[:, 0], np.zeros(len(t))], axis=1)
    base = c[:, 2] + SLEEPER["height"] - SLEEPER["sunk"]
    verts, faces = [], []
    half = GAUGE_M / 2 + RAIL["width"] / 2
    for side in (-half, half):
        start = len(verts)
        for i in range(len(c)):
            o = c[i] + right[i] * side
            w = right[i] * (RAIL["width"] / 2)
            z0, z1 = base[i], base[i] + RAIL["height"]
            verts += [(o[0] - w[0], o[1] - w[1], z0), (o[0] + w[0], o[1] + w[1], z0), (o[0] + w[0], o[1] + w[1], z1), (o[0] - w[0], o[1] - w[1], z1)]
        for i in range(len(c) - 1):
            a, b = start + 4 * i, start + 4 * (i + 1)
            faces += [(a, b, b + 1, a + 1), (a + 1, b + 1, b + 2, a + 2), (a + 2, b + 2, b + 3, a + 3), (a + 3, b + 3, b, a)]
    rails = _mesh(n("railway-rails"), verts, faces, rail_material(), coll)
    # sleepers at a regular pitch along the arc
    along = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(c, axis=0), axis=1))])
    verts, faces = [], []
    for s in np.arange(SLEEPER["pitch"] / 2, along[-1], SLEEPER["pitch"]):
        i = int(np.searchsorted(along, s))
        i = min(max(i, 1), len(c) - 1)
        f = (s - along[i - 1]) / max(along[i] - along[i - 1], 1e-6)
        o = c[i - 1] + (c[i] - c[i - 1]) * f
        fwd, rgt = t[i], right[i]
        L, Wd, Hh = SLEEPER["length"] / 2, SLEEPER["width"] / 2, SLEEPER["height"]
        k = len(verts)
        for dz in (0.0, Hh):
            for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                p = o + rgt * (sx * L) + fwd * (sy * Wd)
                verts.append((p[0], p[1], o[2] - SLEEPER["sunk"] + dz))
        faces += [(k, k + 1, k + 2, k + 3), (k + 4, k + 7, k + 6, k + 5), (k, k + 4, k + 5, k + 1), (k + 1, k + 5, k + 6, k + 2), (k + 2, k + 6, k + 7, k + 3), (k + 3, k + 7, k + 4, k)]
    sleepers = _mesh(n("railway-sleepers"), verts, faces, sleeper_material(), coll)
    for obj in (rails, sleepers):
        obj["ffest_status"] = "existing"
    return {"rails": 2, "sleepers": len(verts) // 8, "fromSample": lo, "toSample": hi, "lengthM": round(float(along[-1]), 1)}
