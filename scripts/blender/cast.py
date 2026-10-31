"""The cast: MPFB people, their IK controls, and foot-locked walking, running, pram pushing and riding (Phase 4).

People are MakeHuman meshes (MPFB 2.0.18, CC0 system assets) with the `game_engine` skeleton. Gait is procedural and
keyed per frame from distance travelled (plan Phase 4 step 3: time follows distance), so a planted foot never slides:
the stance foot's ankle moves back at exactly the root's speed, rolling heel to toe; the hip height each frame is the
highest both legs reach (which gives the body its rise and fall). Riders sit on the procedural bicycle with feet on
the pedals and hands on the grips by IK (R02/R03). PROFILES is the casting sheet (plan Phase 4: varied ages, genders,
ethnic backgrounds and builds; never one model recoloured).
"""
import math

import addon_utils
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

import kit

MPFB = "bl_ext.blender_org.mpfb"
AGE_YEARS = [(1, 0.0), (11, 0.1875), (25, 0.5), (90, 1.0)]  # MPFB's age macro is piecewise linear in years

# id, sex (0 female, 1 male), age, ancestry (african, asian, caucasian), weight, height macro, skin, hair, eyebrows,
# outfit, shoes, garment hue shift (0 keeps the asset's colour), hair tint (None keeps it)
PROFILES = [
    ("amara", 0, 34, (0.9, 0.0, 0.1), 0.55, 0.5, "middleage_african_female", "afro01", "eyebrow006", "male_casualsuit05", "shoes02", -0.05, None),
    ("dylan", 1, 28, (0.0, 0.0, 1.0), 0.5, 0.6, "young_caucasian_male", "short02", "eyebrow001", "male_casualsuit03", "shoes05", 0.0, None),
    ("mei", 0, 41, (0.0, 1.0, 0.0), 0.45, 0.35, "middleage_asian_female", "bob01", "eyebrow002", "female_casualsuit01", "shoes06", -0.08, None),
    ("gwyn", 1, 68, (0.0, 0.0, 1.0), 0.6, 0.5, "old_caucasian_male", "short04", "eyebrow003", "male_casualsuit05", "shoes03", 0.0, (0.55, 0.55, 0.55)),
    ("rhiannon", 0, 72, (0.0, 0.0, 1.0), 0.55, 0.4, "old_caucasian_female", "bob02", "eyebrow004", "male_casualsuit01", "shoes01", -0.1, None),
    ("kwame", 1, 46, (1.0, 0.0, 0.0), 0.6, 0.6, "middleage_african_male", "short01", "eyebrow005", "male_casualsuit05", "shoes04", -0.12, None),
    ("priya", 0, 26, (0.0, 0.7, 0.3), 0.4, 0.45, "young_asian_female", "ponytail01", "eyebrow007", "female_sportsuit01", "shoes05", 0.0, (0.05, 0.035, 0.03)),
    ("tomos", 1, 16, (0.0, 0.0, 1.0), 0.4, 0.55, "young_caucasian_male2", "short03", "eyebrow008", "male_casualsuit06", "shoes06", 0.0, None),
    ("aisha", 0, 19, (0.75, 0.0, 0.25), 0.45, 0.5, "young_african_female", "braid01", "eyebrow009", "female_sportsuit01", "shoes06", 0.45, None),
    ("hiro", 1, 53, (0.0, 1.0, 0.0), 0.5, 0.45, "middleage_asian_male", "short02", "eyebrow010", "male_casualsuit01", "shoes02", 0.0, (0.03, 0.03, 0.03)),
    ("elin", 0, 38, (0.0, 0.0, 1.0), 0.6, 0.5, "middleage_caucasian_female", "long01", "eyebrow011", "male_casualsuit05", "shoes03", -0.14, None),
    ("samuel", 1, 74, (1.0, 0.0, 0.0), 0.5, 0.5, "old_african_male", "short04", "eyebrow012", "male_casualsuit03", "shoes01", -0.06, (0.45, 0.45, 0.45)),
    ("lin", 0, 63, (0.0, 1.0, 0.0), 0.5, 0.3, "old_asian_female", "bob01", "eyebrow002", "male_casualsuit05", "shoes04", -0.18, (0.35, 0.34, 0.33)),
    ("owen", 1, 31, (0.0, 0.0, 1.0), 0.7, 0.65, "young_caucasian_male", "short01", "eyebrow001", "male_casualsuit06", "shoes05", 0.0, (0.18, 0.11, 0.06)),
    ("zara", 0, 30, (0.5, 0.0, 0.5), 0.5, 0.55, "young_african_female", "ponytail01", "eyebrow006", "female_sportsuit01", "shoes02", -0.1, (0.04, 0.03, 0.025)),
    ("jamal", 1, 23, (1.0, 0.0, 0.0), 0.45, 0.6, "young_african_male", "short01", "eyebrow005", "male_casualsuit02", "shoes05", -0.04, None),
]
RIDER = "dylan"
GAIT = {  # stride per gait cycle (in body heights), stance fraction, foot lift (m at 1.7 m), arm swing (m), lean (deg)
    "walk": dict(stride=0.75, duty=0.6, lift=0.07, arm=0.15, lean=3.0, twist=5.0),
    "pram": dict(stride=0.68, duty=0.62, lift=0.06, arm=0.0, lean=8.0, twist=2.0),
    "run": dict(stride=1.15, duty=0.36, lift=0.22, arm=0.2, lean=10.0, twist=8.0),
}
LEG_REACH = 0.985  # of the rest leg length: the IK never straightens fully (no knee snap)


def ensure_mpfb():
    addon_utils.enable(MPFB, default_set=True)
    from bl_ext.blender_org.mpfb.services import HumanService  # noqa: F401  (import check)


def age_macro(years):
    for (y0, v0), (y1, v1) in zip(AGE_YEARS, AGE_YEARS[1:]):
        if years <= y1:
            return v0 + (v1 - v0) * (years - y0) / (y1 - y0)
    return 1.0


def profile(pid):
    return next(p for p in PROFILES if p[0] == pid)


def _recolour(obj, hue_shift, tint=None):
    """Shift a garment's hue (outfits never repeat as the same colours) or tint hair, keeping its texture's detail."""
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf or not bsdf.inputs["Base Color"].links:
            continue
        link = bsdf.inputs["Base Color"].links[0]
        if tint is not None:
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
            mix.inputs[0].default_value = 1.0
            nt.links.new(link.from_socket, mix.inputs[6])
            mix.inputs[7].default_value = (*[c * 2.2 for c in tint], 1)
            nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        elif hue_shift:
            hsv = nt.nodes.new("ShaderNodeHueSaturation")
            hsv.inputs["Hue"].default_value = (0.5 + hue_shift) % 1.0
            nt.links.new(link.from_socket, hsv.inputs["Color"])
            # denim stays denim: texels whose hue is jeans blue (~0.6) keep their colour, the rest of the outfit shifts
            sep = nt.nodes.new("ShaderNodeSeparateColor")
            sep.mode = "HSV"
            nt.links.new(link.from_socket, sep.inputs["Color"])
            off = nt.nodes.new("ShaderNodeMath")
            off.operation = "ABSOLUTE"
            centre = nt.nodes.new("ShaderNodeMath")
            centre.operation, centre.inputs[1].default_value = "SUBTRACT", 0.6
            nt.links.new(sep.outputs[0], centre.inputs[0])
            nt.links.new(centre.outputs[0], off.inputs[0])
            blue = nt.nodes.new("ShaderNodeMapRange")
            blue.inputs["From Min"].default_value, blue.inputs["From Max"].default_value = 0.05, 0.1
            blue.inputs["To Min"].default_value, blue.inputs["To Max"].default_value = 0.0, 1.0
            nt.links.new(off.outputs[0], blue.inputs["Value"])
            keep = nt.nodes.new("ShaderNodeMix")
            keep.data_type = "RGBA"
            nt.links.new(blue.outputs[0], keep.inputs[0])
            nt.links.new(link.from_socket, keep.inputs[6])
            nt.links.new(hsv.outputs["Color"], keep.inputs[7])
            nt.links.new(keep.outputs[2], bsdf.inputs["Base Color"])


def make_person(pid, name, coll, subdiv=0, activity=None):
    """One MPFB person into `coll`: returns the armature (named `name`) with its meshes parented to it. Runners wear
    running kit (kit.py) in place of their everyday outfit."""
    from bl_ext.blender_org.mpfb.services import HumanService
    p = profile(pid)
    _, sex, years, (afr, asi, cau), weight, height, skin, hair, brows, outfit, shoes, hue, hair_tint = p
    running = kit.kit_for(pid, activity)
    clothes = [f"{running[5]}.mhclo"] if running else [f"{outfit}.mhclo", f"{shoes}.mhclo"]
    info = HumanService._create_default_human_info_dict()
    info["name"] = name
    info["phenotype"].update({"gender": float(sex), "age": age_macro(years), "weight": weight, "height": height, "muscle": 0.5})
    info["phenotype"]["race"] = {"african": afr, "asian": asi, "caucasian": cau}
    info.update(rig="game_engine", eyes="high-poly.mhclo", eyebrows=f"{brows}.mhclo", eyelashes="eyelashes01.mhclo", hair=f"{hair}.mhclo",
                teeth="teeth_base.mhclo", clothes=clothes, skin_mhmat=f"{skin}.mhmat", skin_material_type="ENHANCED_SSS")
    settings = HumanService.get_default_deserialization_settings()
    settings["subdiv_levels"] = subdiv
    before = set(bpy.data.objects)
    HumanService.deserialize_from_dict(info, settings)
    made = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in made if o.type == "ARMATURE")
    for o in made:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
        if o.type == "MESH" and o.name.endswith(outfit):
            _recolour(o, hue)
        if o.type == "MESH" and o.name.endswith(hair) and hair_tint:
            _recolour(o, 0, hair_tint)
    for o in made:
        if o.type == "MESH":
            o.data.update()
    if running:
        kit.dress(arm, running, pid)
    return arm


# ---------------------------------------------------------------- rig measurements and controls

def rig_info(arm):
    b = arm.data.bones
    hl, hr = b["thigh_l"].head_local, b["thigh_r"].head_local
    leg = (b["thigh_l"].tail_local - hl).length + (b["calf_l"].tail_local - b["calf_l"].head_local).length
    arm_len = (b["upperarm_l"].tail_local - b["upperarm_l"].head_local).length + (b["lowerarm_l"].tail_local - b["lowerarm_l"].head_local).length
    return {
        "hip_l": hl.copy(), "hip_r": hr.copy(), "hip_z": (hl.z + hr.z) / 2, "leg": leg, "ankle_z": b["calf_l"].tail_local.z,
        # the ball of the foot and the heel's ground contact relative to the ankle: (forward, up), forward is -Y here
        "ball": (-(b["ball_l"].head_local - b["foot_l"].head_local).y, (b["ball_l"].head_local - b["foot_l"].head_local).z),
        "heel": (-0.055, -b["calf_l"].tail_local.z),
        "shoulder_l": b["upperarm_l"].head_local.copy(), "shoulder_r": b["upperarm_r"].head_local.copy(), "arm": arm_len,
        "height": max(v.z for v in (b["head"].tail_local,)),
    }


def _off_plane(dg, arm, ik, base, c):
    """How far a chain's middle joint sits out of the plane through its root, its end and the pole (plus 1 when it
    bends away from the pole), read from the evaluated rig."""
    ev = arm.evaluated_get(dg)
    pb = ev.pose.bones[ik]
    joint, root, end = (ev.matrix_world @ v for v in (pb.head, ev.pose.bones[base].head, pb.tail))
    pole = c.pole_target.evaluated_get(dg).matrix_world.translation
    axis = (end - root).normalized()
    n = axis.cross(pole - root).normalized()
    bend = (joint - root) - axis * (joint - root).dot(axis)
    toward = (pole - root) - axis * (pole - root).dot(axis)
    return abs((joint - root).dot(n)) + (0.0 if bend.dot(toward) > 0 else 1.0)


def calibrate_poles(arm, view_layer):
    """Set each IK chain's pole angle so the knee or elbow bends towards its pole, measured on the posed rig (call it
    with the targets in a representative pose): the analytic angle depends on bone roll conventions MPFB's rigs don't share."""
    meshes = [c for c in arm.children if c.type == "MESH"]
    for m in meshes:
        m.hide_viewport = True
    dg = view_layer.depsgraph
    for ik, base in (("calf_l", "thigh_l"), ("calf_r", "thigh_r"), ("lowerarm_l", "upperarm_l"), ("lowerarm_r", "upperarm_r")):
        c = next(c for c in arm.pose.bones[ik].constraints if c.type == "IK")

        def err(deg):
            c.pole_angle = math.radians(deg)
            view_layer.update()
            return _off_plane(dg, arm, ik, base, c)
        best = min((err(d * 10.0), d * 10.0) for d in range(-18, 18))
        best = min([best] + [(err(best[1] + d * 0.5), best[1] + d * 0.5) for d in range(-20, 21)])
        c.pole_angle = math.radians(best[1])
    for m in meshes:
        m.hide_viewport = False


def _empty(name, parent, coll, size=0.05):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    e.parent = parent
    coll.objects.link(e)
    return e


def add_limb_ik(arm, prefix, coll, foot_parent, hand_parent, foot_pole_pos, hand_pole_pos):
    """IK on both legs (to ankle targets, with feet copying their targets' rotation) and both arms (to wrist targets).
    Pole positions are armature space; targets are created under the given parents. Returns the control empties."""
    ctl = {}
    for side in ("l", "r"):
        s = 1 if side == "l" else -1
        foot_t = _empty(f"{prefix}foot-{side}", foot_parent, coll)
        hand_t = _empty(f"{prefix}hand-{side}", hand_parent, coll)
        knee_p = _empty(f"{prefix}knee-pole-{side}", arm, coll, 0.03)
        elbow_p = _empty(f"{prefix}elbow-pole-{side}", arm, coll, 0.03)
        knee_p.location = Vector((foot_pole_pos.x * s, foot_pole_pos.y, foot_pole_pos.z))
        elbow_p.location = Vector((hand_pole_pos.x * s, hand_pole_pos.y, hand_pole_pos.z))
        for bone, tgt, pole, base in ((f"calf_{side}", foot_t, knee_p, f"thigh_{side}"), (f"lowerarm_{side}", hand_t, elbow_p, f"upperarm_{side}")):
            c = arm.pose.bones[bone].constraints.new("IK")
            c.target, c.pole_target, c.chain_count = tgt, pole, 2
        cr = arm.pose.bones[f"foot_{side}"].constraints.new("COPY_ROTATION")
        cr.target = foot_t
        ctl[f"foot_{side}"], ctl[f"hand_{side}"] = foot_t, hand_t
    return ctl


def rotate_bone(arm, name, axis_angle_arm_space):
    """Pose a bone by a rotation given in armature space (about its head); returns the local quaternion."""
    pb = arm.pose.bones[name]
    m = arm.data.bones[name].matrix_local.to_3x3()
    r = Matrix.Rotation(axis_angle_arm_space[1], 3, axis_angle_arm_space[0])
    q = (m.inverted() @ r @ m).to_quaternion()
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = q
    return q


def relax_hands(arm, curl=0.35):
    """A loose, slightly closed hand rather than the rest pose's flat fingers."""
    for pb in arm.pose.bones:
        if any(pb.name.startswith(f) for f in ("index", "middle", "ring", "pinky")):
            pb.rotation_mode = "XYZ"
            pb.rotation_euler = (curl, 0, 0)
        elif pb.name.startswith("thumb_02") or pb.name.startswith("thumb_03"):
            pb.rotation_mode = "XYZ"
            pb.rotation_euler = (curl * 0.5, 0, 0)


# ---------------------------------------------------------------- gait

def _pivot(x, z, off, pitch):
    """The ankle when the foot pitches about a contact point `off` (forward, up) from the flat foot's ankle at (x, z):
    the contact stays where it is on the ground, so nothing slides while the foot rolls."""
    c, sn = math.cos(-pitch), math.sin(-pitch)
    rx, rz = off[0] * c + off[1] * sn, -off[0] * sn + off[1] * c
    return x + off[0] - rx, z + off[1] - rz


def _foot(u, g, S, info, k):
    """Ankle position (x forward, z up; root space, metres) and toe pitch (rad, + toes up) at gait fraction u."""
    duty, ankle_z = g["duty"], info["ankle_z"] * k
    ball = (info["ball"][0] * k, info["ball"][1] * k)
    heel = (info["heel"][0] * k, info["heel"][1] * k)
    half = S * duty / 2
    strike, toe_off = math.radians(12), math.radians(-35 if g is GAIT["run"] else -30)
    front = _pivot(half, ankle_z, heel, strike)
    back = _pivot(-half, ankle_z, ball, toe_off)
    if u < duty:
        s = u / duty
        x = half - S * duty * s
        if s < 0.12:  # heel strike: rolling forward onto the heel
            p = strike * (1 - s / 0.12)
            return (*_pivot(x, ankle_z, heel, p), p)
        if s < 0.6:
            return x, ankle_z, 0.0
        p = toe_off * ((s - 0.6) / 0.4) ** 2  # heel off: pivoting on the ball
        return (*_pivot(x, ankle_z, ball, p), p)
    s = (u - duty) / (1 - duty)
    e = s * s * (3 - 2 * s)
    x = back[0] + (front[0] - back[0]) * e
    z = back[1] + (front[1] - back[1]) * e + g["lift"] * k * math.sin(math.pi * s) ** (0.8 if g is GAIT["run"] else 1.2)
    p = toe_off + (strike - toe_off) * min(1.0, s * 1.6) if s < 0.75 else strike
    return x, z, p


def key_array(obj, path, index, frames, values):
    """Linear keys for one channel from arrays, written straight into the F-curve (thousands of frames at once)."""
    ad = obj.animation_data_create()
    if ad.action is None:
        ad.action = bpy.data.actions.new(obj.name + "-motion")
    act = ad.action
    if hasattr(act, "fcurve_ensure_for_datablock"):
        fc = act.fcurve_ensure_for_datablock(obj, path, index=index)
    else:
        fc = act.fcurves.find(path, index=index) or act.fcurves.new(path, index=index)
    n = len(frames)
    co = np.empty(2 * n, dtype=np.float32)
    co[0::2], co[1::2] = frames, values
    fc.keyframe_points.clear()
    fc.keyframe_points.add(n)
    fc.keyframe_points.foreach_set("co", co)
    fc.keyframe_points.foreach_set("interpolation", np.ones(n, dtype=np.int32))  # LINEAR
    fc.update()


def key_vectors(obj, path, frames, rows):
    rows = np.asarray(rows, dtype=np.float64)
    for i in range(rows.shape[1]):
        key_array(obj, path, i, frames, rows[:, i])


def bake_gait(person, frames, distance, phase0, activity, view_layer, prams=None):
    """Key a person's body bob, pelvis twist, feet and hands for every frame from the distance it has travelled."""
    arm, ctl, info, k = person["arm"], person["ctl"], person["info"], person["k"]
    g = GAIT[activity]
    S = g["stride"] * info["height"] * k
    to_root = Matrix.Rotation(math.pi / 2, 3, "Z")  # armature space (forward -Y) to root space (forward +X)
    foot_rest = {s: to_root @ arm.data.bones[f"foot_{s}"].matrix_local.to_3x3() for s in ("l", "r")}
    hip_w = (info["hip_l"].x - info["hip_r"].x) / 2 * k
    L = info["leg"] * k * LEG_REACH
    rest_hip = info["hip_z"] * k
    lean = math.radians(g["lean"])
    ch = {key: [] for key in ("bob", "foot_l", "rot_l", "foot_r", "rot_r", "pelvis", "spine_02", "spine_03", "hand_l", "hand_r")}
    for i in range(len(frames)):
        ph = phase0 + 2 * math.pi * distance[i] / S
        feet = {}
        for side, off in (("l", 0.0), ("r", math.pi)):
            u = ((ph + off) % (2 * math.pi)) / (2 * math.pi)
            x, z, pitch = _foot(u, g, S, info, k)
            feet[side] = (Vector((x, hip_w * 0.85 * (1 if side == "l" else -1), z)), pitch, u)
        # the highest hip both legs reach, below the standing height: this is the body's rise and fall
        h = rest_hip * 0.99
        for side, (a, _, _) in feet.items():
            dy = a.y - (hip_w if side == "l" else -hip_w)
            h = min(h, a.z + math.sqrt(max(L * L - a.x * a.x - dy * dy, 0.0)))
        if activity == "run":  # flight: the body rises between foot contacts
            h += 0.035 * k * max(0.0, math.cos(2 * ph))
        ch["bob"].append(h - rest_hip)
        for side, (a, pitch, _) in feet.items():
            ch[f"foot_{side}"].append(tuple(a))
            q = (Matrix.Rotation(-pitch, 3, "Y") @ foot_rest[side]).to_quaternion()
            if ch[f"rot_{side}"] and Quaternion(ch[f"rot_{side}"][-1]).dot(q) < 0:
                q.negate()
            ch[f"rot_{side}"].append(tuple(q))
        twist = math.radians(g["twist"]) * math.cos(ph)  # the hip of the forward leg leads
        ch["pelvis"].append(tuple(rotate_bone(arm, "pelvis", (Vector((0, 0, 1)), -twist))))
        ch["spine_02"].append(tuple(rotate_bone(arm, "spine_02", (Vector((1, 0, 0)), lean))))
        ch["spine_03"].append(tuple(rotate_bone(arm, "spine_03", (Vector((0, 0, 1)), twist * 1.6))))
        for side, s in (("l", 1), ("r", -1)):
            opp = feet["r" if side == "l" else "l"][2]
            c = math.cos(2 * math.pi * opp)  # the hand swings with the opposite leg; armature space, forward -Y
            sh = info[f"shoulder_{side}"]
            if activity == "run":  # elbows bent near a right angle, hands passing the hips
                ch[f"hand_{side}"].append((sh.x, sh.y - 0.10 - g["arm"] * c, sh.z - 0.36 + 0.06 * max(0.0, c)))
            else:
                ch[f"hand_{side}"].append((sh.x + s * 0.05, sh.y - g["arm"] * c, sh.z - info["arm"] * 0.93 + 0.05 * abs(c)))
        if i == 0:  # calibrate the knees and elbows on the first pose, before anything is keyed
            arm.location = (0, 0, ch["bob"][0])
            for side in ("l", "r"):
                ctl[f"foot_{side}"].location = ch[f"foot_{side}"][0]
                ctl[f"foot_{side}"].rotation_mode = "QUATERNION"
                ctl[f"foot_{side}"].rotation_quaternion = ch[f"rot_{side}"][0]
                if activity != "pram":
                    ctl[f"hand_{side}"].location = ch[f"hand_{side}"][0]
            calibrate_poles(arm, view_layer)
    fr = np.asarray(frames, dtype=np.float64)
    key_array(arm, "location", 2, fr, ch["bob"])
    for side in ("l", "r"):
        key_vectors(ctl[f"foot_{side}"], "location", fr, ch[f"foot_{side}"])
        key_vectors(ctl[f"foot_{side}"], "rotation_quaternion", fr, ch[f"rot_{side}"])
        if activity != "pram":
            key_vectors(ctl[f"hand_{side}"], "location", fr, ch[f"hand_{side}"])
    for bone in ("pelvis", "spine_02", "spine_03"):
        key_vectors(arm, f'pose.bones["{bone}"].rotation_quaternion', fr, ch[bone])
    for w in prams or []:
        w.rotation_mode = "XYZ"
        key_array(w, "rotation_euler", 1, fr, np.asarray(distance) / 0.118)


def person_on_root(pid, root, prefix, coll, height_m, activity):
    """A person built and attached to a keyed root (+X forward): armature turned to face +X and scaled to `height_m`."""
    arm = make_person(pid, prefix + "body", coll, activity=activity)
    info = rig_info(arm)
    k = height_m / info["height"]
    arm.parent = root
    arm.rotation_euler = (0, 0, math.pi / 2)
    arm.scale = (k, k, k)
    if activity == "pram":
        hand_parent = root
    else:
        hand_parent = arm
    ctl = add_limb_ik(arm, prefix, coll, root, hand_parent, Vector((0.10, -0.6, 0.5)), Vector((0.25, 0.45, 1.0)))
    relax_hands(arm, 0.25 if activity != "run" else 0.7)
    return {"arm": arm, "ctl": ctl, "info": info, "k": k, "pid": pid}


# ---------------------------------------------------------------- the rider

def seat_rider(person, bike, view_layer, lean_deg=40.0):
    """Fit the bicycle to the rider and pose them on it: hips over the saddle, ankles over the pedals, wrists on the grips.
    The rider's root is the bicycle's root (the package's rider position, +X forward)."""
    import bike as bk
    arm, info, k = person["arm"], person["info"], person["k"]
    leg = info["leg"] * k
    lean = math.radians(lean_deg)
    ankle_above_pedal = 0.075 * k
    # saddle height: at the bottom of the stroke the hip-to-ankle distance is 95 % of the leg (R02)
    bb, sdir = bike["bb"], bike["seat_dir"]
    hip_off = Vector((0.0, 0, 0.085 * k))
    lo, hi = 0.4, 1.1
    for _ in range(40):
        mid = (lo + hi) / 2
        hip = bb + sdir * mid + Vector((0, 0, 0.035)) + hip_off
        ankle = bb + Vector((0.03, 0, -bk.CRANK + ankle_above_pedal))
        lo, hi = (mid, hi) if (hip - ankle).length < 0.95 * leg else (lo, mid)
    saddle_h = (lo + hi) / 2
    saddle_top = bb + sdir * saddle_h + Vector((0, 0, 0.035))
    hip = saddle_top + hip_off
    # shoulders after leaning the torso forward about the hips; grips where the arms reach forward and down
    torso = (info["shoulder_l"].z - info["hip_z"]) * k
    shoulder = hip + Vector((math.sin(lean) * torso, 0, math.cos(lean) * torso))
    reach = info["arm"] * k * 0.86  # elbows a little bent
    drop = math.radians(45)
    grip = shoulder + Vector((math.sin(drop) * reach, 0, -math.cos(drop) * reach))
    bike["post"].location = saddle_top - Vector((0, 0, 0.07))
    bike["bars"].location = (grip.x - bike["grip_offset"].x, 0, grip.z - bike["grip_offset"].z)
    _stem(bike)
    # the body: armature space -> bicycle space is a quarter turn; hips placed over the saddle
    hips_rest = (info["hip_l"] + info["hip_r"]) / 2
    arm.parent = bike["root"]
    arm.rotation_euler = (0, 0, math.pi / 2)
    arm.scale = (k, k, k)
    arm.location = hip - Matrix.Rotation(math.pi / 2, 3, "Z") @ (hips_rest * k)
    rotate_bone(arm, "pelvis", (Vector((1, 0, 0)), lean))
    rotate_bone(arm, "neck_01", (Vector((1, 0, 0)), -lean * 0.45))
    rotate_bone(arm, "head", (Vector((1, 0, 0)), -lean * 0.3))
    coll = bike["root"].users_collection[0]
    prefix = arm.name[: -len("body")]
    ctl = add_limb_ik(arm, prefix, coll, bike["root"], bike["bars"], Vector((0.10, -0.6, 0.6)), Vector((0.35, 0.3, 0.9)))
    foot_rest = {s: Matrix.Rotation(math.pi / 2, 3, "Z") @ arm.data.bones[f"foot_{s}"].matrix_local.to_3x3() for s in ("l", "r")}
    for side, pedal in (("l", bike["pedal_l"]), ("r", bike["pedal_r"])):
        t = ctl[f"foot_{side}"]
        t.parent = pedal  # level, as the pedals are counter-turned
        t.location = (-0.07 * k, (-0.02 if side == "l" else 0.02), ankle_above_pedal)
        t.rotation_mode = "QUATERNION"
        t.rotation_quaternion = (Matrix.Rotation(math.radians(8), 3, "Y") @ foot_rest[side]).to_quaternion()
    for side, s in (("l", 1), ("r", -1)):
        t = ctl[f"hand_{side}"]
        t.location = bike["grip_offset"] + Vector((-0.03, -0.02, 0.025)) if s > 0 else Vector((bike["grip_offset"].x - 0.03, -bike["grip_offset"].y + 0.02, bike["grip_offset"].z + 0.025))
    relax_hands(arm, 0.9)
    calibrate_poles(arm, view_layer)
    person["ctl"] = ctl
    return {"saddle_height_m": round(saddle_h, 3), "leg_m": round(leg, 3), "lean_deg": lean_deg}


def _stem(bike):
    """A stem from the head tube's top to wherever the bars were fitted."""
    import bmesh
    import bike as bk
    old = bpy.data.objects.get(bike["root"].name + "-stem")
    if old:
        bpy.data.objects.remove(old)
    bm = bmesh.new()
    a, b = bike["head_top"], Vector(bike["bars"].location) + Vector((0.09, 0, 0.09))
    bk._tube(bm, a, a + Vector((0, 0, max(0.02, b.z - a.z - 0.02))), 0.014)
    bk._tube(bm, a + Vector((0, 0, max(0.02, b.z - a.z - 0.02))), b, 0.013)
    bk._object(bike["root"].name + "-stem", bm, [bpy.data.materials["bike-alloy"]], bike["root"].users_collection[0], bike["root"])


def distances(xy):
    """Cumulative distance along a per-frame path of (x, y) positions."""
    d = np.zeros(len(xy))
    d[1:] = np.cumsum(np.linalg.norm(np.diff(xy, axis=0), axis=1))
    return d
