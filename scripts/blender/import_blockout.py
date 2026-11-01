"""Builds the plain geographic blockout of a section from a Blender interchange package.

    blender --background --factory-startup --python scripts/blender/import_blockout.py -- <package dir> <out .blend>

Also used by build_reel.py, which builds every scene of the reel into one file: build_section(package_dir, prefix)
makes one Scene per package. The package is made by `npm run blender:export` (src/blender/exportSection.ts); every
position in it is already in Blender metres, Z-up, so this file holds no coordinate logic (docs/blender-build-plan.md,
"Coordinate and frame contract"). Plain materials only: vegetation and people are placeholders sized from the package,
to be replaced in later phases.
"""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))  # dress.py and its modules sit beside this file

COLLECTIONS = [
    "Terrain", "ExistingFeatures", "ProposedTrail", "Vegetation", "People", "Dogs",
    "CommunityAmenities", "ActivityAreas", "Cameras", "Lighting", "Reference",
]
SUB_COLLECTIONS = {"People": ["Cyclists", "Pedestrians"]}
# role -> (base colour, roughness); plain stand-ins until the material phase
PLAIN = {
    "trail": ((0.55, 0.50, 0.42, 1), 0.9), "road": ((0.12, 0.12, 0.13, 1), 0.9), "road-marking": ((0.85, 0.85, 0.82, 1), 0.6),
    "bridge": ((0.45, 0.43, 0.40, 1), 0.8),
    "building-existing": ((0.62, 0.58, 0.52, 1), 0.8), "building-translucent": ((0.80, 0.30, 0.25, 1), 0.8),
    "barrier-wall": ((0.40, 0.38, 0.35, 1), 0.9), "barrier-hedge": ((0.15, 0.30, 0.12, 1), 0.9), "barrier-fence": ((0.45, 0.33, 0.22, 1), 0.9),
    "conifer": ((0.08, 0.20, 0.09, 1), 0.9), "broadleaf": ((0.17, 0.30, 0.10, 1), 0.9), "grass": ((0.30, 0.38, 0.14, 1), 0.9),
    "rider": ((0.9, 0.15, 0.1, 1), 0.6), "walk": ((0.15, 0.35, 0.80, 1), 0.7), "run": ((0.90, 0.60, 0.10, 1), 0.7), "pram": ((0.60, 0.20, 0.70, 1), 0.7),
    "water": ((0.10, 0.25, 0.40, 1), 0.1),
}
# nominal heights (metres) the placeholders are drawn at, times the instance's own scale (src/three-core/trees.ts)
AERIAL_LIFT_M = 0.6
NOMINAL_HEIGHT = {"conifer": 14.25, "broadleaf": 10.6, "grass": 0.4}


def read_array(pkg, ref):
    return np.fromfile(pkg / ref["file"], dtype="<f4" if ref["type"] == "float32" else "<u4")


def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def plain_material(name, rgba, rough, vertex_colors=False):
    """A plain material, shared by name across the scenes of one file."""
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = principled(mat)
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    mat.diffuse_color = rgba  # viewport only
    if vertex_colors:
        attr = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "land"
        mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def mesh_from_arrays(name, positions, indices, colors=None, uvs=None):
    me = bpy.data.meshes.new(name)
    n, t = len(positions) // 3, len(indices) // 3
    me.vertices.add(n)
    me.vertices.foreach_set("co", positions.astype(np.float32))
    me.loops.add(t * 3)
    me.loops.foreach_set("vertex_index", indices.astype(np.int32))
    me.polygons.add(t)
    me.polygons.foreach_set("loop_start", np.arange(0, t * 3, 3, dtype=np.int32))
    me.update(calc_edges=True)
    me.validate()
    if colors is not None:
        rgba = np.ones((n, 4), dtype=np.float32)
        srgb = colors.reshape(n, 3)  # the source's vertex colours are sRGB; Blender's colour attributes are linear
        rgba[:, :3] = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
        layer = me.color_attributes.new("land", "FLOAT_COLOR", "POINT")
        layer.data.foreach_set("color", rgba.ravel())
    if uvs is not None:
        uv = me.uv_layers.new(name="UV")
        uv.data.foreach_set("uv", uvs.reshape(n, 2)[indices].ravel())
    return me


def link(obj, coll):
    coll.objects.link(obj)
    return obj


def merged_placeholders(name, kind, data, coll):
    """One merged mesh of simple placeholder solids at the instance points (x, y, z, scale, yaw, tint, variant)."""
    pts = data.reshape(-1, 7)
    height = NOMINAL_HEIGHT[kind]
    if kind == "grass":
        base = np.array([[-0.5, -0.5, 0], [0.5, -0.5, 0], [0, 0.6, 0], [0, 0, 1.0]], dtype=np.float32)
        faces = np.array([[0, 1, 3], [1, 2, 3], [2, 0, 3]])
        unit = np.array([0.15, 0.15, height], dtype=np.float32)
    else:  # a cone with a trunk-less six-sided base; width a third of the height
        ring = np.array([[math.cos(a), math.sin(a), 0] for a in np.linspace(0, 2 * math.pi, 6, endpoint=False)], dtype=np.float32)
        base = np.vstack([ring, [[0, 0, 1.0]]]).astype(np.float32)
        faces = np.array([[i, (i + 1) % 6, 6] for i in range(6)])
        unit = np.array([height / 6, height / 6, height], dtype=np.float32)
    k = len(base)
    s, yaw = pts[:, 3], pts[:, 4]
    cos, sin = np.cos(yaw), np.sin(yaw)
    local = base[None, :, :] * unit[None, None, :] * s[:, None, None]
    x = local[:, :, 0] * cos[:, None] - local[:, :, 1] * sin[:, None] + pts[:, 0:1]
    y = local[:, :, 0] * sin[:, None] + local[:, :, 1] * cos[:, None] + pts[:, 1:2]
    z = local[:, :, 2] + pts[:, 2:3]
    positions = np.stack([x, y, z], axis=-1).reshape(-1, 3).astype(np.float32)
    idx = (faces[None, :, :] + (np.arange(len(pts)) * k)[:, None, None]).reshape(-1, 3)
    obj = bpy.data.objects.new(name, mesh_from_arrays(name, positions.ravel(), idx.ravel().astype(np.uint32)))
    obj.data.materials.append(plain_material(f"plain-{kind}", *PLAIN[kind]))
    return link(obj, coll)


def box_mesh(name, size, origin_bottom=True):
    sx, sy, sz = size
    z0 = 0 if origin_bottom else -sz / 2
    v = [(-sx / 2, -sy / 2, z0), (sx / 2, -sy / 2, z0), (sx / 2, sy / 2, z0), (-sx / 2, sy / 2, z0),
         (-sx / 2, -sy / 2, z0 + sz), (sx / 2, -sy / 2, z0 + sz), (sx / 2, sy / 2, z0 + sz), (-sx / 2, sy / 2, z0 + sz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], f)
    me.update()
    return me


def key_transforms(obj, frames, locations, quats=None, yaws=None):
    """Keyframes every frame, linear, so interpolation never smooths a hard cut: a camera is keyed only over its own shot."""
    obj.rotation_mode = "QUATERNION" if quats is not None else "XYZ"
    for i in range(len(frames)):
        obj.location = locations[i]
        obj.keyframe_insert("location", frame=int(frames[i]))
        if quats is not None:
            obj.rotation_quaternion = quats[i]
            obj.keyframe_insert("rotation_quaternion", frame=int(frames[i]))
        else:
            obj.rotation_euler = (0, 0, yaws[i])
            obj.keyframe_insert("rotation_euler", frame=int(frames[i]))
    for fc in iter_fcurves(obj.animation_data.action, obj):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"


def iter_fcurves(action, obj):
    if hasattr(action, "fcurves"):  # before layered actions
        yield from action.fcurves
        return
    slot = obj.animation_data.action_slot
    for layer in action.layers:
        for strip in layer.strips:
            channelbag = strip.channelbag(slot)
            if channelbag:
                yield from channelbag.fcurves


def continuous(quats):
    """Quaternion sign continuity across frames."""
    out = [quats[0]]
    for q in quats[1:]:
        out.append(q if out[-1].dot(q) >= 0 else -q)
    return out


def set_enum(owner, prop, wanted):
    """Assign the first accepted identifier; enum identifiers are read, never assumed (Blender versions rename them)."""
    for w in wanted:
        try:
            setattr(owner, prop, w)
            return w
        except (TypeError, ValueError):
            continue
    options = [i.identifier for i in owner.bl_rna.properties[prop].enum_items]
    raise RuntimeError(f"none of {wanted} is a valid {prop}: {options}")


def build_section(pkg_dir, prefix="", samples=64, dressed=False):
    """One section package into a new Scene. `prefix` keeps datablock names unique when several sections share a file.
    `dressed` swaps the placeholders for the realistic materials, vegetation, sky and people of dress.py."""
    if dressed:
        import cast
        import dress
        import landscape
        import vegetation
        cast.ensure_mpfb()
    pkg = Path(pkg_dir)
    man = json.loads((pkg / "manifest.json").read_text(encoding="utf8"))
    sec = man["section"]
    ground = sec.get("kind", "ground") == "ground"
    scene = bpy.data.scenes.new(prefix + sec["id"])

    def n(name):
        return prefix + name

    # units, frame range, output
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.fps = sec["fps"]
    scene.render.fps_base = 1.0
    scene.frame_start, scene.frame_end = 1, sec["frames"]
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1920, 1080, 100
    scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1.0
    engine = set_enum(scene.render, "engine", ["BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"])
    view = set_enum(scene.view_settings, "view_transform", ["AgX", "Filmic", "Standard"])
    scene.eevee.taa_render_samples = samples

    colls = {}
    for name in COLLECTIONS:
        colls[name] = bpy.data.collections.new(n(name))
        scene.collection.children.link(colls[name])
    for parent, subs in SUB_COLLECTIONS.items():
        for sub in subs:
            colls[sub] = bpy.data.collections.new(n(sub))
            colls[parent].children.link(colls[sub])

    report = {"package": str(pkg), "section": sec["id"], "engine": engine, "view_transform": view, "blender": bpy.app.version_string, "objects": {}}

    # meshes (dressed, the existing buildings are modelled from their footprints instead of the merged boxes)
    modelled = dressed and bool(man.get("buildings"))
    for ref in man["meshes"]:
        if modelled and ref["name"] == "buildings-existing":
            continue
        pos = read_array(pkg, ref["positions"])
        idx = read_array(pkg, ref["indices"])
        colors = read_array(pkg, ref["colors"]) if "colors" in ref else None
        uvs = read_array(pkg, ref["uvs"]) if "uvs" in ref else None
        me = mesh_from_arrays(n(ref["name"]), pos, idx, colors, uvs)
        obj = link(bpy.data.objects.new(n(ref["name"]), me), colls[ref["collection"]])
        role = ref["role"]
        if not ground and role == "trail":
            # the aerial windows' terrain is 16 m samples, which pokes through a ribbon laid 5 cm above the profile; from 100-600 m up 0.6 m is invisible
            # (the roads need no lift: they are graded into and seated on that ground, src/three-core/roads.ts seatRoads)
            obj.location.z = AERIAL_LIFT_M
        if dressed and landscape.material_for(role, not ground):
            if role == "road":  # the export's metre UVs, across and along, which the asphalt reads
                me.uv_layers["UV"].name = "metres"
            obj.data.materials.append(landscape.material_for(role, not ground))
            if role.startswith(("bridge", "building", "barrier")):
                landscape.wall_uvs(me)
            if role == "terrain":
                me.polygons.foreach_set("use_smooth", np.ones(len(me.polygons), dtype=bool))
        elif role == "terrain":
            obj.data.materials.append(plain_material("plain-terrain", (0.3, 0.35, 0.2, 1), 1.0, vertex_colors=colors is not None))
        else:
            obj.data.materials.append(plain_material(f"plain-{role}", *PLAIN[role]))
        # readback: the vertices Blender now holds against the sidecar they came from
        back = np.empty(len(pos), dtype=np.float32)
        me.vertices.foreach_get("co", back)
        report["objects"][ref["name"]] = {"vertices": len(me.vertices), "triangles": len(me.polygons), "max_abs_diff_m": float(np.abs(back - pos).max())}
    if modelled:
        import buildings
        report["buildings"] = buildings.dress_buildings(man["buildings"], bpy.data.objects[n("terrain")], colls["ExistingFeatures"], n)

    # water: flat polygons at the body's level, holes included
    from mathutils.geometry import tessellate_polygon
    for w in man["water"]:
        verts, faces = [], []
        for poly in w["polygons"]:
            rings = [poly["outer"]] + poly["holes"]
            vs = [Vector((x, y, 0)) for ring in rings for x, y in ring]
            tess = [[Vector((x, y, 0)) for x, y in ring] for ring in rings]
            base = len(verts)
            verts += [(v.x, v.y, w["surfaceZ"]) for v in vs]
            faces += [(base + a, base + b, base + c) for a, b, c in tessellate_polygon(tess)]
        if faces:
            me = bpy.data.meshes.new(n(f"water-{w['id']}"))
            me.from_pydata(verts, [], faces)
            me.update()
            obj = link(bpy.data.objects.new(n(f"water-{w['id']}"), me), colls["ExistingFeatures"])
            obj.data.materials.append(landscape.water_material() if dressed else plain_material("plain-water", *PLAIN["water"]))

    frames = sec["frames"]
    cam_data = np.fromfile(pkg / man["camera"]["data"]["file"], dtype="<f4").reshape(frames, 7)

    # vegetation: placeholders, or instanced trees and grass with a level of detail per tree
    if dressed:
        rows = {inst["kind"]: read_array(pkg, inst["data"]).reshape(-1, 7).astype(np.float64) for inst in man["instances"]}
        report["vegetation"] = vegetation.dress_vegetation(rows, cam_data[:, 0:3].astype(np.float64), colls["Vegetation"], n, not ground, bpy.data.objects[n("terrain")])
        if not ground and n("barrier-hedge") in bpy.data.objects:
            report["vegetation"]["hedgerow"] = vegetation.hedgerows(bpy.data.objects[n("barrier-hedge")], colls["Vegetation"], n)
        if ground:
            import sward
            report["sward"] = sward.sward(bpy.data.objects[n("terrain")], cam_data[:, 0:3].astype(np.float64), colls["Vegetation"], n,
                                          [o for o in scene.collection.all_objects if o.type == "MESH" and o.name.startswith(tuple(n(k) for k in ("trail", "roads", "bridge", "barrier", "water", "buildings")))])
    else:
        for inst in man["instances"]:
            obj = merged_placeholders(n(f"{inst['kind']}-placeholders"), inst["kind"], read_array(pkg, inst["data"]), colls["Vegetation"])
            report["objects"][obj.name] = {"instances": inst["count"], "vertices": len(obj.data.vertices)}

    shots = man["camera"]["shots"]
    all_frames = np.arange(1, frames + 1)

    # the camera rider (ground scenes only; hidden in first-person shots, as the prototype does) and the walkers
    if ground:
        rider = np.fromfile(pkg / man["rider"]["data"]["file"], dtype="<f4").reshape(frames, 11)
        dims = man["rider"]["dims"]
        if dressed:
            r_obj = link(bpy.data.objects.new(n("Rider"), None), colls["Cyclists"])
        else:
            r_obj = link(bpy.data.objects.new(n("Rider"), box_mesh(n("Rider"), (dims["lengthM"], 0.55, dims["ridingHeightM"]))), colls["Cyclists"])
            r_obj.data.materials.append(plain_material("plain-rider", *PLAIN["rider"]))
        quats = []
        for row in rider:
            fwd, up = Vector(row[3:6]), Vector(row[6:9])
            y = up.cross(fwd).normalized()
            quats.append(Matrix([fwd.normalized(), y, up.normalized()]).transposed().to_quaternion())
        key_transforms(r_obj, all_frames, [tuple(row[0:3]) for row in rider], quats=continuous(quats))
        if dressed:
            report["rider"] = dress.rider(scene, r_obj, rider, dims, colls["Cyclists"], n("rider:"))
            dress.hide_in_shots(r_obj, shots, frames)
        for shot in (s for s in shots if s["kind"] == "first-person" and not dressed):
            lo, hi = shot["firstBlenderFrame"], shot["lastBlenderFrame"]
            for f, value in ((lo - 1, False), (lo, True), (hi, True), (hi + 1, False)):
                if 1 <= f <= frames:
                    r_obj.hide_render = r_obj.hide_viewport = value
                    r_obj.keyframe_insert("hide_render", frame=f)
                    r_obj.keyframe_insert("hide_viewport", frame=f)
            r_obj.hide_render = r_obj.hide_viewport = False
        casting = dress.cast_walkers(sec["id"], man["walkers"]) if dressed else []
        report["cast"] = []
        for w in man["walkers"]:
            arr = np.fromfile(pkg / w["data"]["file"], dtype="<f4").reshape(frames, 5)
            wn = n(f"walker-{w['index']}-{w['activity']}")
            if dressed:
                obj = link(bpy.data.objects.new(wn, None), colls["Pedestrians"])
            else:
                obj = link(bpy.data.objects.new(wn, box_mesh(wn, (0.5, 0.35, w["heightM"]))), colls["Pedestrians"])
                obj.data.materials.append(plain_material(f"plain-{w['activity']}", *PLAIN[w["activity"]]))
            key_transforms(obj, all_frames, [tuple(r[0:3]) for r in arr], yaws=np.unwrap(arr[:, 3].astype(np.float64)))
            if dressed:
                pid = casting[len(report["cast"])]
                report["cast"].append(dress.walker(scene, obj, w, arr, pid, colls["Pedestrians"], n(f"walker-{w['index']}:")))

    # one camera per shot, keyed over its own frames, with a marker bound at each cut
    first_cam = None
    for shot in shots:
        lo, count = shot["firstFrame"], shot["frames"]
        rows = cam_data[lo:lo + count]
        cd = bpy.data.cameras.new(n(f"Cam_{shot['index']}_{shot['kind']}"))
        cd.sensor_fit = "VERTICAL"  # the source's field of view is vertical
        cd.angle = math.radians(float(rows[0][6]))
        cd.clip_start, cd.clip_end = (0.1 if ground else 2.0), 5000.0
        cam = link(bpy.data.objects.new(cd.name, cd), colls["Cameras"])
        qs = continuous([(Vector(r[3:6]) - Vector(r[0:3])).to_track_quat("-Z", "Y") for r in rows])
        key_transforms(cam, np.arange(shot["firstBlenderFrame"], shot["lastBlenderFrame"] + 1), [tuple(r[0:3]) for r in rows], quats=qs)
        marker = scene.timeline_markers.new(cam.name, frame=shot["firstBlenderFrame"])
        marker.camera = cam
        first_cam = first_cam or cam
    scene.camera = first_cam

    if dressed:  # the HDRI sky, turned to the package's sun, which EEVEE extracts to cast the shadows
        report["sky"] = dress.sky(scene, man, samples)
        scene["ffest_manifest"] = json.dumps({"section": sec, "coordinates": man["coordinates"], "counts": man["counts"], "provenance": man["provenance"], "legend": man.get("legend", [])})
        return scene, report

    # light and sky: a plain sun and a flat sky colour
    sun = bpy.data.lights.new(n("Sun"), "SUN")
    sun.energy = 3.0
    sun_obj = link(bpy.data.objects.new(n("Sun"), sun), colls["Lighting"])
    sun_obj.rotation_euler = (math.radians(50), 0, math.radians(120))
    world = bpy.data.worlds.get("Sky")
    if not world:
        world = bpy.data.worlds.new("Sky")
        world.use_nodes = True
        bg = next(nd for nd in world.node_tree.nodes if nd.type == "BACKGROUND")
        bg.inputs["Color"].default_value = (0.55, 0.68, 0.85, 1)
        bg.inputs["Strength"].default_value = 1.0
    scene.world = world

    scene["ffest_manifest"] = json.dumps({"section": sec, "coordinates": man["coordinates"], "counts": man["counts"], "provenance": man["provenance"], "legend": man.get("legend", [])})
    return scene, report


def build(package_dir, out_blend, dressed=False, samples=64):
    """A single section as its own file: the plain blockout (the Maentwrog milestone) or, dressed, the realistic scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene, report = build_section(package_dir, samples=samples, dressed=dressed)
    if bpy.context.window:
        bpy.context.window.scene = scene
    for sc in list(bpy.data.scenes):
        if sc != scene:
            bpy.data.scenes.remove(sc)
    scene.frame_set(1)
    Path(out_blend).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))
    report["saved"] = str(out_blend)
    return report


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    dressed = "--dressed" in args
    args = [a for a in args if a != "--dressed"]
    if len(args) not in (2, 3):
        raise SystemExit("usage: blender --background --factory-startup --python import_blockout.py -- <package dir> <out .blend> [samples] [--dressed]")
    print("BLOCKOUT_REPORT " + json.dumps(build(args[0], args[1], dressed, *(int(a) for a in args[2:3]))))
