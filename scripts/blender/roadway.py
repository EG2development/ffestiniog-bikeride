"""The carriageways' asphalt and their painted lines (the road and road-marking roles; landscape.material_for).

The road mesh carries metre UVs (across from the centreline, along), so the CC0 asphalt runs with the road and the wheel
paths fall where traffic wears them: polished and darker in two bands per lane, about 0.9 m either side of each lane's
centre. The lines are their own thin mesh (src/three-core/roads.ts: buildRoadMarkings), painted a worn white.
"""
import bpy

from landscape import TILE_M, Nodes, _data_tinted, _finish, _untiled

WHEEL_PATHS_M = (0.9, 2.7)  # out from the centreline: a lane's two wheel paths on a 7.3 m road, one lane's on a narrow one
PATH_WIDTH_M = 0.35


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
