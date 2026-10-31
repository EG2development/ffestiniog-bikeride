"""Dresses a section scene with realistic materials, vegetation, sky and people (docs/blender-build-plan.md, phases 3-4).

Called from import_blockout.build_section(..., dressed=True), in place of the blockout's placeholders. Positions,
scales, paths, timings and the camera rider's visibility are exactly the package's; only how things look changes.
"""
import numpy as np

import bike
import cast
import landscape

RUNNERS = ["priya", "aisha", "zara", "jamal", "owen", "tomos"]
PRAM = ["amara", "kwame", "elin", "mei", "gwyn", "samuel", "hiro", "rhiannon"]
WALKERS = ["rhiannon", "gwyn", "samuel", "lin", "hiro", "mei", "elin", "kwame", "amara", "tomos", "owen", "jamal"]
PRAM_HANDLE_AHEAD = 0.42  # metres from the walker's root to the pram's handle


def cast_walkers(section_id, walkers):
    """The casting sheet for a section: a distinct person per walker, chosen by activity, deterministic per section."""
    used, out = {cast.RIDER}, []
    offset = sum(map(ord, section_id))
    for w in walkers:
        pool = {"run": RUNNERS, "pram": PRAM}.get(w["activity"], WALKERS)
        start = (offset + int(w["seed"])) % len(pool)
        pid = next((pool[(start + i) % len(pool)] for i in range(len(pool)) if pool[(start + i) % len(pool)] not in used), None)
        pid = pid or next(p[0] for p in cast.PROFILES if p[0] not in used)
        used.add(pid)
        out.append(pid)
    return out


def walker(scene, root, w, arr, pid, coll, prefix):
    """A person on a keyed walker root, with gait keyed from the distance it travels (and a pram, if it pushes one)."""
    frames = np.arange(1, len(arr) + 1, dtype=np.float64)
    person = cast.person_on_root(pid, root, prefix, coll, float(w["heightM"]), w["activity"])
    wheels = None
    if w["activity"] == "pram":
        pram, handle_z, wheels = bike.build_pram(prefix, coll, colour=((0.10, 0.12, 0.16), (0.25, 0.08, 0.08), (0.08, 0.16, 0.10))[int(w["seed"]) % 3])
        pram.parent = root
        pram.location = (PRAM_HANDLE_AHEAD, 0, 0)
        for side, s in (("l", 1), ("r", -1)):
            person["ctl"][f"hand_{side}"].location = (PRAM_HANDLE_AHEAD - 0.02, 0.19 * s, handle_z - 0.02)
    cast.bake_gait(person, frames, cast.distances(arr[:, 0:2]), float(arr[0, 4]), w["activity"], scene.view_layers[0], wheels)
    return {"walker": w["index"], "activity": w["activity"], "person": pid, "heightM": w["heightM"], "scale": round(person["k"], 3)}


def rider(scene, root, rows, dims, coll, prefix):
    """The camera rider: the reference bicycle (0.68 m wheels, 1.05 m wheelbase) fitted to its rider, wheels and cranks
    keyed from the package's angles."""
    parts = bike.build_bicycle(prefix, coll)
    parts["root"].parent = root
    arm = cast.make_person(cast.RIDER, prefix + "body", coll, subdiv=1)
    info = cast.rig_info(arm)
    person = {"arm": arm, "info": info, "k": dims["ridingHeightM"] / info["height"]}
    fit = cast.seat_rider(person, parts, scene.view_layers[0])
    frames = np.arange(1, len(rows) + 1, dtype=np.float64)
    for obj in (parts["rear_wheel"], parts["front_wheel"], parts["crank"], parts["pedal_l"], parts["pedal_r"]):
        obj.rotation_mode = "XYZ"
    wheel, crank = rows[:, 9].astype(np.float64), rows[:, 10].astype(np.float64)
    for obj, a in ((parts["rear_wheel"], wheel), (parts["front_wheel"], wheel), (parts["crank"], crank), (parts["pedal_l"], -crank), (parts["pedal_r"], -crank)):
        cast.key_array(obj, "rotation_euler", 1, frames, a)
    return {"person": cast.RIDER, **fit}


def hide_in_shots(root, shots, frames):
    """Hide everything under the rider's root in the first-person shots (the prototype hides the camera rider's body)."""
    objs = [o for o in root.children_recursive if o.type == "MESH"]
    for shot in (s for s in shots if s["kind"] == "first-person"):
        lo, hi = shot["firstBlenderFrame"], shot["lastBlenderFrame"]
        for o in objs:
            for f, value in ((lo - 1, False), (lo, True), (hi, True), (hi + 1, False)):
                if 1 <= f <= frames:
                    o.hide_render = o.hide_viewport = value
                    o.keyframe_insert("hide_render", frame=f)
                    o.keyframe_insert("hide_viewport", frame=f)
            o.hide_render = o.hide_viewport = False
            if o.animation_data and o.animation_data.action:
                for fc in cast_iter_fcurves(o):
                    if fc.data_path in ("hide_render", "hide_viewport"):
                        for kp in fc.keyframe_points:
                            kp.interpolation = "CONSTANT"


def cast_iter_fcurves(obj):
    act = obj.animation_data.action
    if hasattr(act, "fcurves"):
        yield from act.fcurves
        return
    for layer in act.layers:
        for strip in layer.strips:
            bag = strip.channelbag(obj.animation_data.action_slot)
            if bag:
                yield from bag.fcurves


def sky(scene, man, samples):
    light = man.get("lighting")
    sun = light["sunDirection"] if light else (0.0, -0.57, 0.57)
    scene.world = landscape.sky_world(f"sky-{man['section']['id']}", sun)
    landscape.render_settings(scene, samples)
    landscape.haze(scene, man["section"].get("kind") == "aerial")
    return {"sunDirection": sun, "hdriSunElevationDeg": round(scene.world["hdri_sun_elevation_deg"], 1), "skyTurnDeg": round(scene.world["turn_deg"], 1)}
