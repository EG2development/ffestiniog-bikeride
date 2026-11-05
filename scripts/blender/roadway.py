"""The carriageways' asphalt and their painted lines, and the proposed path's compacted surface (the road,
road-marking and trail roles; landscape.material_for).

The road mesh carries metre UVs (across from the centreline, along), so the CC0 asphalt runs with the road and the wheel
paths fall where traffic wears them: polished and darker in two bands per lane, about 0.9 m either side of each lane's
centre. The lines are their own thin mesh (src/three-core/roads.ts: buildRoadMarkings), painted a worn white.
"""
import bpy

from landscape import TILE_M, Nodes, _data_tinted, _finish, _untiled

WHEEL_PATHS_M = (0.9, 2.7)  # out from the centreline: a lane's two wheel paths on a 7.3 m road, one lane's on a narrow one
PATH_WIDTH_M = 0.35
# the shared path (review 2026-11-03: the gravel texture's 4.3 m second sample read as cobbles from the saddle): fine
# aggregate at a 0.9 m tile, a gentler relief, and the verge's soil and grass creeping 0.1-0.3 m in at either edge
TRAIL = {"tile_m": 0.9, "relief": 0.7, "width_m": 3.0, "edge_m": 0.4, "creep": 0.75, "colour": (0.20, 0.19, 0.17), "verge": (0.85, 0.85, 0.8)}


def road_material():
    mat = bpy.data.materials.get("road-asphalt-uv")
    if mat:
        return mat
    mat = bpy.data.materials.new("road-asphalt-uv")
    mat.use_nodes = True
    nd = Nodes(mat)
    col, nor, rough = _untiled(nd, "road", TILE_M["road"], box=True)
    col = _data_tinted(nd, col, "road", (0.055, 0.055, 0.058, 1.0), keep=0.0)  # weathered asphalt
    # the wheel paths: |across| near each path's offset, broken up along the road so they read as wear, not stripes
    uv = nd.new("ShaderNodeUVMap", -1400, 1400)
    uv.uv_map = "metres"
    sep = nd.new("ShaderNodeSeparateXYZ", -1200, 1400)
    nd.link(uv.outputs["UV"], sep.inputs[0])
    across = nd.math("ABSOLUTE", sep.outputs["X"], None, -1000, 1400)
    wear = None
    for k, off in enumerate(WHEEL_PATHS_M):
        d = nd.math("ABSOLUTE", nd.math("SUBTRACT", across, off, -800, 1400 - 200 * k), None, -600, 1400 - 200 * k)
        band = nd.new("ShaderNodeMapRange", -400, 1400 - 200 * k)
        band.inputs["From Min"].default_value, band.inputs["From Max"].default_value = 0.0, PATH_WIDTH_M
        band.inputs["To Min"].default_value, band.inputs["To Max"].default_value = 1.0, 0.0
        nd.link(d, band.inputs["Value"])
        wear = band.outputs[0] if wear is None else nd.math("MAXIMUM", wear, band.outputs[0], -200, 1400)
    tc = nd.new("ShaderNodeTexCoord", -800, 1800)
    breakup = nd.new("ShaderNodeTexNoise", -600, 1800)
    breakup.inputs["Scale"].default_value, breakup.inputs["Detail"].default_value = 0.4, 4.0
    nd.link(tc.outputs["Object"], breakup.inputs["Vector"])
    wear = nd.math("MULTIPLY", wear, breakup.outputs["Fac"], 0, 1400)
    col = nd.mix(nd.math("MULTIPLY", wear, 0.6, 100, 1300), col, (0.022, 0.022, 0.024, 1.0), blend="MIX")
    rough = nd.mix(nd.math("MULTIPLY", wear, 0.5, 100, 1100), rough, (0.45, 0.45, 0.45, 1.0), blend="MIX")
    _finish(nd, col, nor, rough, 1.0)
    return mat


def marking_material():
    """Road paint: a worn white, a little glossier than the asphalt, the grey of the road showing through in patches."""
    mat = bpy.data.materials.get("road-marking")
    if mat:
        return mat
    mat = bpy.data.materials.new("road-marking")
    mat.use_nodes = True
    nd = Nodes(mat)
    tc = nd.new("ShaderNodeTexCoord", -800, 0)
    noise = nd.new("ShaderNodeTexNoise", -600, 0)
    noise.inputs["Scale"].default_value, noise.inputs["Detail"].default_value = 3.0, 6.0
    nd.link(tc.outputs["Object"], noise.inputs["Vector"])
    worn = nd.new("ShaderNodeMapRange", -400, 0)
    worn.inputs["From Min"].default_value, worn.inputs["From Max"].default_value = 0.55, 0.7
    nd.link(noise.outputs["Fac"], worn.inputs["Value"])
    nd.link(nd.mix(worn.outputs[0], (0.72, 0.72, 0.68, 1.0), (0.08, 0.08, 0.08, 1.0)), nd.bsdf.inputs["Base Color"])
    nd.bsdf.inputs["Roughness"].default_value = 0.55
    return mat


def path_material():
    """The proposed path: compacted grey stone dust on the trail ribbon's UVs (U across, 0-1; V along, per 3 m)."""
    mat = bpy.data.materials.get("trail-stone-dust")
    if mat:
        return mat
    mat = bpy.data.materials.new("trail-stone-dust")
    mat.use_nodes = True
    nd = Nodes(mat)
    col, nor, rough = _untiled(nd, "trail", TRAIL["tile_m"])
    col = _data_tinted(nd, col, "trail", (*TRAIL["colour"], 1.0), keep=0.0)
    uv = nd.new("ShaderNodeUVMap", -1400, 1400)
    uv.uv_map = "UV"
    sep = nd.new("ShaderNodeSeparateXYZ", -1200, 1400)
    nd.link(uv.outputs["UV"], sep.inputs[0])
    # metres in from the nearer edge, against a noise threshold: the verge reaches 0.1-0.3 m in, raggedly
    inside = nd.math("MINIMUM", sep.outputs["X"], nd.math("SUBTRACT", 1.0, sep.outputs["X"], -1000, 1250), -800, 1400)
    reach = nd.math("DIVIDE", nd.math("MULTIPLY", inside, TRAIL["width_m"], -600, 1400), TRAIL["edge_m"], -400, 1400)
    tc = nd.new("ShaderNodeTexCoord", -800, 1800)
    ragged = nd.new("ShaderNodeTexNoise", -600, 1800)
    ragged.inputs["Scale"].default_value, ragged.inputs["Detail"].default_value = 2.2, 6.0
    nd.link(tc.outputs["Object"], ragged.inputs["Vector"])
    creep = nd.new("ShaderNodeMapRange", -200, 1600)
    creep.inputs["From Min"].default_value, creep.inputs["From Max"].default_value = -0.08, 0.08
    creep.inputs["To Max"].default_value = TRAIL["creep"]
    nd.link(nd.math("SUBTRACT", ragged.outputs["Fac"], reach, -200, 1800), creep.inputs["Value"])
    # the creeping verge is the sward's own ground texture, darkened a little where it is trodden
    verge = nd.mix(1.0, _untiled(nd, "terrain-grass", TILE_M["terrain-grass"], y=-2400)[0], (*TRAIL["verge"], 1.0), blend="MULTIPLY")
    col = nd.mix(creep.outputs[0], col, verge, blend="MIX")
    rough = nd.mix(creep.outputs[0], rough, (0.95, 0.95, 0.95, 1.0), blend="MIX")
    _finish(nd, col, nor, rough, TRAIL["relief"], 1.1)
    return mat
