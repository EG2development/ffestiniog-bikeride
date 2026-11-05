"""The dressed film's photographic finish (review 2026-11-03): aerial perspective that spares the sky, a light vignette,
a shadow budget large enough for the aerial woods, and a gentle depth of field on the ground shots.

- Haze: the mist pass, now linear in distance through an exponential curve (aerial perspective builds quickly in the
  middle distance and saturates), mixes the land towards the horizon colour. The film is rendered with a transparent
  background and the sky laid back from the environment pass, so the sky itself is no longer veiled with grey; before,
  every sky pixel took the full 35 % of the haze colour, which washed the frames out.
- Vignette: corners 10 % darker, easing in from 70 % of the way out, as a lens does.
- Look: AgX Punchy, ground and air alike (review 2026-11-05: under the 48° sky the medium-high look left the greens
  grey and the frame flat; Punchy gives the sward and the slate their colour without clipping the skies).
- Grade, before the view transform: a 4 % warmer slope with a touch of blue in the shadows (ASC-CDL), a little more
  saturation and exposure on the ground, less from the air, where the imagery is already graded.
- Shadows: the pool raised from 512 MB, so the aerials' 40 000-odd trees keep their shadow tiles.
- Depth of field: the ground shots' cameras focus on the shot's aim point at f/4. A planning film wants everything
  readable, so the blur stays within what a real camera at that lens would give, mostly on near verges and far hills.
"""
import math

import bpy

HORIZON = {"ground": (0.765, 0.827, 0.863), "aerial": (0.78, 0.84, 0.87)}  # src/three-core/atmosphere.ts, sRGB
# from the air the land fills the frame to the horizon, so the same curve would veil it all: a lighter strength there
# the review of 2026-11-05 found 0.25 and 0.16 veiling the middle distance: aerial perspective now shows past 1 km
HAZE = {"strength": {"ground": 0.14, "aerial": 0.10}, "k": 1.2, "depth_m": {"ground": 3500.0, "aerial": 6000.0}}
GRADE = {"ground": {"exposure": 0.12, "saturation": 1.05}, "aerial": {"exposure": 0.08, "saturation": 1.08},
         "slope": (1.04, 1.0, 0.95), "offset": (-0.004, 0.0, 0.006)}
LOOK = "AgX - Punchy"
VIGNETTE = {"amount": 0.10, "from": 0.7, "to": 1.45}
SHADOW_POOL_MB = "1536"
DOF_FSTOP = 4.0


def _linear(srgb):
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def shadows(scene):
    e = scene.eevee
    if SHADOW_POOL_MB in [i.identifier for i in e.bl_rna.properties["shadow_pool_size"].enum_items]:
        e.shadow_pool_size = SHADOW_POOL_MB


def look(scene, aerial):
    """AgX Punchy for every scene (the aerials' 10 m imagery and the ground's sward both read pale through the
    medium-high look under the brighter sky)."""
    try:
        scene.view_settings.look = LOOK
    except TypeError:
        pass


def grade(ng, src, kind):
    """The grade nodes after `src`, in scene-linear before the view transform: ASC-CDL slope and offset, saturation,
    exposure; returns the graded socket."""
    N, L = ng.nodes, ng.links.new
    cb = N.new("CompositorNodeColorBalance")
    try:
        cb.inputs["Type"].default_value = "Offset/Power/Slope (ASC-CDL)"
    except (KeyError, TypeError):
        cb.correction_method = "OFFSET_POWER_SLOPE"
    for name, val in (("Slope", GRADE["slope"]), ("Offset", GRADE["offset"])):
        sock = next((i for i in cb.inputs if i.name == name and i.type == "RGBA"), None)
        if sock is not None:
            sock.default_value = (*val, 1.0)
        else:
            setattr(cb, name.lower(), val)
    L(src, cb.inputs["Image"])
    hs = N.new("CompositorNodeHueSat")
    hs.inputs["Saturation"].default_value = GRADE[kind]["saturation"]
    L(cb.outputs[0], hs.inputs["Image"])
    ex = N.new("CompositorNodeExposure")
    ex.inputs["Exposure"].default_value = GRADE[kind]["exposure"]
    L(hs.outputs[0], ex.inputs["Image"])
    return ex.outputs[0]


def compositor(scene, aerial):
    """Haze on the land only, the sky laid back from the environment pass, the vignette, then the grade."""
    kind = "aerial" if aerial else "ground"
    vl = scene.view_layers[0]
    vl.use_pass_mist = True
    vl.use_pass_environment = True
    scene.render.film_transparent = True
    ms = scene.world.mist_settings
    ms.start, ms.depth, ms.falloff = 0.0, HAZE["depth_m"][kind], "LINEAR"
    ng = bpy.data.node_groups.new(f"finish-{scene.name}", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    N, L = ng.nodes, ng.links.new

    def math_node(op, a, b=None):
        m = N.new("ShaderNodeMath")
        m.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                L(v, m.inputs[i])
        return m.outputs[0]

    rl = N.new("CompositorNodeRLayers")
    rl.scene = scene
    # fac = strength (1 - e^(-k mist)) / (1 - e^(-k)), on land only (alpha), so the sky keeps its own colour
    curve = math_node("SUBTRACT", 1.0, math_node("EXPONENT", math_node("MULTIPLY", rl.outputs["Mist"], -HAZE["k"])))
    fac = math_node("MULTIPLY", math_node("MULTIPLY", curve, HAZE["strength"][kind] / (1 - math.exp(-HAZE["k"]))), rl.outputs["Alpha"])
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    L(fac, mix.inputs[0])
    L(rl.outputs["Image"], mix.inputs[6])
    mix.inputs[7].default_value = (*_linear(HORIZON[kind]), 1.0)
    keep = N.new("CompositorNodeSetAlpha")
    L(mix.outputs[2], keep.inputs["Image"])
    L(rl.outputs["Alpha"], keep.inputs["Alpha"])
    keep.inputs["Type"].default_value = "Replace Alpha"  # the render is premultiplied already; Apply Mask would darken edges
    over = N.new("CompositorNodeAlphaOver")
    L(rl.outputs["Environment"], over.inputs["Background"])
    L(keep.outputs["Image"], over.inputs["Foreground"])
    # the vignette: r = 1 at the frame's edge centres, 1.41 at its corners
    coords = N.new("CompositorNodeImageCoordinates")
    L(rl.outputs["Image"], coords.inputs["Image"])
    centred = N.new("ShaderNodeVectorMath")
    centred.operation = "MULTIPLY_ADD"
    L(coords.outputs["Normalized"], centred.inputs[0])
    centred.inputs[1].default_value = (2.0, 2.0, 0.0)
    centred.inputs[2].default_value = (-1.0, -1.0, 0.0)
    radius = N.new("ShaderNodeVectorMath")
    radius.operation = "LENGTH"
    L(centred.outputs[0], radius.inputs[0])
    ramp = N.new("ShaderNodeMapRange")
    ramp.interpolation_type = "SMOOTHSTEP"
    ramp.inputs["From Min"].default_value, ramp.inputs["From Max"].default_value = VIGNETTE["from"], VIGNETTE["to"]
    ramp.inputs["To Min"].default_value, ramp.inputs["To Max"].default_value = 1.0, 1.0 - VIGNETTE["amount"]
    L(radius.outputs["Value"], ramp.inputs["Value"])
    shade = N.new("ShaderNodeMix")
    shade.data_type = "RGBA"
    shade.blend_type = "MULTIPLY"
    shade.inputs[0].default_value = 1.0
    L(over.outputs["Image"], shade.inputs[6])
    comb = N.new("ShaderNodeCombineXYZ")
    for axis in "XYZ":
        L(ramp.outputs["Result"], comb.inputs[axis])
    L(comb.outputs[0], shade.inputs[7])
    out = N.new("NodeGroupOutput")
    L(grade(ng, shade.outputs[2], kind), out.inputs[0])
    scene.compositing_node_group = ng
    scene.render.use_compositing = True


def depth_of_field(cam_data, distances):
    """Key a ground shot's focus on its aim point, frame by frame: `distances` is [(blender frame, metres)]."""
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = DOF_FSTOP
    for frame, d in distances:
        cam_data.dof.focus_distance = max(1.0, d)
        cam_data.dof.keyframe_insert("focus_distance", frame=frame)
