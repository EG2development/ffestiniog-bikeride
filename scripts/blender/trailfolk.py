"""The community film's trail users beyond walking: people riding bicycles or an adult tricycle, people sitting on a
bench, and the street furniture they use (street.py), placed where the package says and marked existing or proposed.

Riders are the camera rider's model (cast.seat_rider) on their own bicycle, a smaller one for a child; wheels turn by
the distance the root travels and cranks by the package's phase (one turn per CRANK_TURN_M, src/three-core/walkers.ts).
A sitter is seated on the nearest bench seat facing the bench's front, thighs level and shins down, hands on the knees.
"""
import math

import numpy as np
from mathutils import Matrix, Vector

import bike
import cast
import gait
import idle

PAINTS = [(0.08, 0.22, 0.36), (0.45, 0.05, 0.05), (0.05, 0.25, 0.12), (0.55, 0.55, 0.58), (0.02, 0.02, 0.02), (0.60, 0.32, 0.05)]
CHILD_BIKE = 0.86  # a 24-inch wheel's share of the 0.68 m reference, for the pupils
SMALL_BIKE = 0.72  # a 20-inch wheel, for a younger child


def cyclist(scene, root, w, arr, pid, coll, prefix, gaze=None, out=None):
    """A person riding along the keyed root: bicycle (or tricycle), seated rider, wheels and cranks keyed; the head
    looking about by `gaze` (attention.py), if given. `out` (a dict) receives the bicycle's parts and the person."""
    trike = w["activity"] == "trike"
    paint = PAINTS[int(w["seed"]) % len(PAINTS)]
    parts = bike.build_trike(prefix, coll) if trike else bike.build_bicycle(prefix, coll, paint, step_through=pid in cast.CHILDREN)
    if pid in cast.PUPILS or pid in cast.CHILDREN:
        bike.scale_bicycle(parts, SMALL_BIKE if pid in cast.CHILDREN else CHILD_BIKE)
    parts["root"].parent = root
    arm = cast.make_person(pid, prefix + "body", coll)
    info = cast.rig_info(arm)
    person = {"arm": arm, "info": info, "k": float(w["heightM"]) / info["height"]}
    fit = cast.seat_rider(person, parts, scene.view_layers[0], lean_deg=22.0 if trike else 30.0)
    frames = np.arange(1, len(arr) + 1, dtype=np.float64)
    wheel = cast.distances(arr[:, 0:2].astype(np.float64)) / parts.get("wheel_r", bike.WHEEL_R)
    crank = arr[:, 4].astype(np.float64)
    wheels = [parts["rear_wheel"], parts["front_wheel"]] + ([parts["rear_wheel_2"]] if trike else [])
    for obj, a in [(o, wheel) for o in wheels] + [(parts["crank"], crank), (parts["pedal_l"], -crank), (parts["pedal_r"], -crank)]:
        obj.rotation_mode = "XYZ"
        gait.key_array(obj, "rotation_euler", 1, frames, a)
    if gaze is not None:
        idle.bake_head(person["arm"], frames, gaze)
    if out is not None:
        out.update(parts=parts, person=person)
    return {"walker": w["index"], "activity": w["activity"], "person": pid, "heightM": w["heightM"], "scale": round(person["k"], 3), **fit}


def sitter(scene, w, pid, coll, prefix, seat, gaze, talking=True):
    """A person sitting on a bench seat: `seat` is (seat surface centre, unit vector the bench faces), world space; they
    breathe, settle, look about by `gaze` (attention.py) and talk with their hands (idle.py)."""
    centre, front = seat
    arm = cast.make_person(pid, prefix + "body", coll)
    info = cast.rig_info(arm)
    k = float(w["heightM"]) / info["height"]
    face = math.atan2(front.y, front.x)
    arm.rotation_euler = (0, 0, face + math.pi / 2)  # the armature faces -Y: a quarter turn faces it along +X, then `front`
    arm.scale = (k, k, k)
    # hips over the seat, a little back from its front edge, the hip joints a hand's width above the surface
    hips_rest = (info["hip_l"] + info["hip_r"]) / 2
    hip = Vector(centre) - Vector(front) * 0.04 + Vector((0, 0, 0.09 * k))
    arm.location = hip - Matrix.Rotation(face + math.pi / 2, 3, "Z") @ (hips_rest * k)
    x = Vector((1, 0, 0))
    for side in "lr":
        cast.rotate_bone(arm, f"thigh_{side}", (x, -math.radians(88)))  # forward: the thigh's tail swings to -Y
        cast.rotate_bone(arm, f"calf_{side}", (x, math.radians(84)))
        cast.rotate_bone(arm, f"foot_{side}", (x, -math.radians(6)))
        cast.rotate_bone(arm, f"upperarm_{side}", (Vector((0, 1, 0)), math.radians(62 if side == "l" else -62)))
        cast.rotate_bone(arm, f"lowerarm_{side}", (x, -math.radians(55)))
    cast.rotate_bone(arm, "spine_02", (x, math.radians(4)))
    cast.relax_hands(arm, 0.45)
    arm.parent = None
    fps = scene.render.fps / scene.render.fps_base
    events = idle.bake_seated(arm, np.arange(1, len(gaze) + 1, dtype=np.float64), fps, int(w["seed"]), gaze, talking)
    return {"walker": w["index"], "activity": "sit", "person": pid, "heightM": w["heightM"], "scale": round(k, 3), "gestures": events}


def props(man, coll, prefix):
    """Every prop of the package, built by street.py at its position and heading; returns the bench seats (world)."""
    import street
    seats = []
    builders = {
        "bench": lambda p, o: street.build_bench(p, coll, arms=bool(o.get("arms", True))),
        "lockers": lambda p, o: street.build_lockers(p, coll, units=int(o.get("units", 4)), open_unit=int(o.get("open_unit", 1)), bicycle=bool(o.get("bicycle", True))),
        "fingerpost": lambda p, o: street.build_fingerpost(p, coll, arms=[tuple(a) for a in o.get("arms", [])]),
        "bus-shelter": lambda p, o: street.build_bus_shelter(p, coll),
        "bus-stop-flag": lambda p, o: street.build_bus_stop_flag(p, coll, name=o.get("name")),
        "bus": lambda p, o: street.build_bus(p, coll),
        "viewpoint-board": lambda p, o: street.build_viewpoint_board(p, coll, o.get("title_cy", ""), o.get("title_en", "")),
    }
    for i, p in enumerate(man.get("props", [])):
        built = builders[p["kind"]](f"{prefix}{p['kind']}-{i}:", p.get("opts", {}))
        root = built["root"]
        # the builder's front onto the package's yaw (builders face +X unless they say otherwise)
        f = built.get("front", Vector((1, 0, 0)))
        yaw = p["yaw"] - math.atan2(f[1], f[0])
        root.location = Vector(p["position"])
        root.rotation_euler = (0, 0, yaw)
        root["status"] = p["status"]
        if p.get("source"):
            root["source"] = p["source"]
        if p["kind"] == "bench":
            turn = Matrix.Rotation(yaw, 3, "Z")
            for s in built["seats"]:
                seats.append((root.location + turn @ Vector(s), (turn @ Vector(f)).normalized()))
    return seats
