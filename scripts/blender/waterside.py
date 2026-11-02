"""Watercourses and a reservoir's shore for a dressed section (the council map reviews of 2026-11-02).

Rivers and streams are the package's channels (src/three-core/waterways.ts): ribbons at the exported water level, level
across, just below the ground there. The 4 m ground smooths a channel away, so near the cameras the terrain by each is
refined to 1 m and lowered a little below the water within the channel's half-width and CARVE_MARGIN_M beyond (farther
off, the 4 m vertices within 3 m; the package keeps channels clear of roads and walls by more than that), and each
ribbon's edges dip under the banks so it never shows a floating edge. Their water is a shallow upland river's: dark, a
little peaty brown, rippled.

A reservoir (Llyn Trawsfynydd) is near-black with a low, wind-rippled reflection, and the terrain along its shores and
round its islands takes a pale grey-buff stony draw-down band a few metres wide instead of grass to the waterline. The
band is a terrain attribute ("shore") the terrain material mixes in; the sward and the grass clumps keep off it.
"""
import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

from landscape import Nodes

CARVE_MARGIN_M = 0.3  # terrain vertices within the half-width and this are lowered to the bed (waterways.ts BANK_CLEAR_M)
REFINE_NEAR_M, REFINE_CUTS = 600.0, 3  # within this of a camera the ground by a channel is refined from 4 m to 1 m
LIP_M, LIP_DROP_M = 0.3, 0.4  # each ribbon edge's lip: outwards and down, under the bank
BAND_M = 5.0  # the draw-down band's width from the mapped shore (at least 0.6 of a grid cell)
RISE_M, RISE_FADE_M = 0.6, 1.0  # fully pale to this height above the water, fading out over the next metre
STONE = (0.30, 0.28, 0.24, 1.0)  # pale grey-buff shore stone (linear)


def bed_depth(half):
    """The bed below the water (m): about 0.12 under a drain, 0.16 under a stream, 0.3 under a 5 m river."""
    return min(0.3, 0.08 + 0.09 * half)


def _ripples(nd, layers, x=-600):
    """Bump layers of noise (scale, strength) on object coordinates, chained into the BSDF's normal."""
    tc = nd.new("ShaderNodeTexCoord", x - 200, -300)
    prev = None
    for i, (scale, strength) in enumerate(layers):
        wave = nd.new("ShaderNodeTexNoise", x, -300 - 250 * i)
        wave.inputs["Scale"].default_value = scale
        wave.inputs["Detail"].default_value = 4
        nd.link(tc.outputs["Object"], wave.inputs["Vector"])
        bump = nd.new("ShaderNodeBump", x + 300 + 150 * i, -300)
        bump.inputs["Strength"].default_value = strength
        bump.inputs["Distance"].default_value = 0.02
        nd.link(wave.outputs["Fac"], bump.inputs["Height"])
        if prev:
            nd.link(prev.outputs["Normal"], bump.inputs["Normal"])
        prev = bump
    nd.link(prev.outputs["Normal"], nd.bsdf.inputs["Normal"])


def river_material():
    """A shallow upland river's water: darker than the lakes' and a little peaty brown, with a livelier ripple."""
    mat = bpy.data.materials.get("water-river")
    if mat:
        return mat
    mat = bpy.data.materials.new("water-river")
    mat.use_nodes = True
    nd = Nodes(mat)
    b = nd.bsdf
    b.inputs["Base Color"].default_value = (0.016, 0.012, 0.007, 1)
    b.inputs["Roughness"].default_value = 0.07
    b.inputs["IOR"].default_value = 1.333
    _ripples(nd, ((1.2, 0.3), (5.0, 0.12), (14.0, 0.05)))
    return mat


def lake_material():
    """A reservoir's water: near-black, low reflectance, a fine wind ripple over long swells."""
    mat = bpy.data.materials.get("water-reservoir")
    if mat:
        return mat
    mat = bpy.data.materials.new("water-reservoir")
    mat.use_nodes = True
    nd = Nodes(mat)
    b = nd.bsdf
    b.inputs["Base Color"].default_value = (0.004, 0.005, 0.005, 1)
    b.inputs["Roughness"].default_value = 0.12
    b.inputs["IOR"].default_value = 1.333
    b.inputs["Specular IOR Level"].default_value = 0.3
    _ripples(nd, ((0.12, 0.2), (1.1, 0.1), (4.5, 0.05)))
    return mat


# ---------------------------------------------------------------- rivers and streams

def _normals(run):
    """Unit XY normals (left of the run's direction) at each point, from its neighbours."""
    p = run[:, :2]
    d = np.empty_like(p)
    d[1:-1] = p[2:] - p[:-2]
    d[0], d[-1] = p[1] - p[0], p[-1] - p[-2]
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    return np.stack([-d[:, 1], d[:, 0]], axis=1)


def _near_runs(co, runs, reach_of):
    """For each run (points, half-width) and chunk of its segments: the vertices in the chunk's box, their distance to
    the chunk and the water level at their foot. Yields (vertex indices, distance, level, half-width)."""
    for run, half in runs:
        reach = reach_of(half)
        for k0 in range(0, len(run) - 1, 32):
            seg = run[k0:min(len(run), k0 + 33)]
            lo, hi = seg[:, :2].min(axis=0) - reach, seg[:, :2].max(axis=0) + reach
            sel = np.flatnonzero(np.all((co[:, :2] >= lo) & (co[:, :2] <= hi), axis=1))
            if not len(sel):
                continue
            xy = co[sel, :2]
            dist, level = np.full(len(sel), np.inf), np.zeros(len(sel))
            for a, b in zip(seg[:-1], seg[1:]):
                v = b[:2] - a[:2]
                t = np.clip(((xy - a[:2]) @ v) / max(float(v @ v), 1e-12), 0.0, 1.0)
                d = np.linalg.norm(xy - (a[:2] + t[:, None] * v), axis=1)
                closer = d < dist
                dist, level = np.where(closer, d, dist), np.where(closer, a[2] + t * (b[2] - a[2]), level)
            yield sel, dist, level, half


def _refine(terrain, runs, cameras, spacing):
    """Subdivide the terrain's triangles near the channels and near the cameras into REFINE_CUTS + 1 per side (4 m to
    1 m), so a stream narrower than a grid cell has vertices to lower under it; the new vertices lie on the old
    triangles, so the ground's shape is unchanged until the carve. Returns the new triangle count."""
    import bmesh
    me = terrain.data
    co = np.empty(len(me.vertices) * 3, np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    cams = cameras[:: max(1, len(cameras) // 120)]
    hit = np.zeros(len(co), bool)
    for sel, dist, _, half in _near_runs(co, runs, lambda h: h + CARVE_MARGIN_M + spacing):
        sel = sel[dist <= half + CARVE_MARGIN_M + spacing]
        near = np.full(len(sel), np.inf)
        for c in cams:
            near = np.minimum(near, np.linalg.norm(co[sel, :2] - c[:2], axis=1))
        hit[sel[near <= REFINE_NEAR_M]] = True
    if not hit.any():
        return 0
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    bm.verts.ensure_lookup_table()
    faces = {f for i in np.flatnonzero(hit) for f in bm.verts[int(i)].link_faces}
    edges = list({e for f in faces for e in f.edges})
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=REFINE_CUTS, use_grid_fill=True)
    # the faces beside the refined patch now have extra vertices on a shared edge: triangles again (the sward reads triangles)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.to_mesh(me)
    bm.free()
    me.update()
    return len(me.polygons)


def _carve(terrain, runs, cameras, spacing):
    """Lower the terrain under each channel to its bed (the water level less bed_depth): every vertex within the half-width
    and CARVE_MARGIN_M near the cameras (refined to 1 m), or within 0.75 of a grid cell farther off, where the ground is
    still 4 m (a trench a little wider than the water, unseen at that distance). Returns how many it lowered."""
    me = terrain.data
    co = np.empty(len(me.vertices) * 3, np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    cams = cameras[:: max(1, len(cameras) // 120)]
    bed = np.full(len(co), np.inf)
    for sel, dist, level, half in _near_runs(co, runs, lambda h: max(h + CARVE_MARGIN_M, 0.75 * spacing)):
        near = np.full(len(sel), np.inf)
        for c in cams:
            near = np.minimum(near, np.linalg.norm(co[sel, :2] - c[:2], axis=1))
        reach = np.where(near <= REFINE_NEAR_M, half + CARVE_MARGIN_M, max(half + CARVE_MARGIN_M, 0.75 * spacing))
        inside = dist <= reach
        depth = bed_depth(half)
        bed[sel[inside]] = np.minimum(bed[sel[inside]], level[inside] - depth)
    lower = bed < co[:, 2]
    co[lower, 2] = bed[lower]
    me.vertices.foreach_set("co", co.astype(np.float32).ravel())
    me.update()
    return int(lower.sum())


def channels(waterways, terrain, coll, n, cameras):
    """The channels as one ribbon mesh in the river water, with the terrain refined near the cameras and lowered under
    the water. `cameras`: (F, 3) camera positions. Returns counts."""
    me = terrain.data
    v0, v1 = me.vertices[0].co, me.vertices[1].co
    spacing = float((v1 - v0).xy.length) or 4.0  # the DEM's nodes, row by row
    runs = [(np.asarray(pts, np.float64), float(w["widthM"]) / 2) for w in waterways for pts in w["runs"] if len(pts) >= 2]
    if not runs:
        return {"runs": 0}
    triangles = _refine(terrain, runs, cameras, spacing)
    lowered = _carve(terrain, runs, cameras, spacing)
    verts, faces = [], []
    for run, half in runs:
        nrm = _normals(run)
        base = len(verts)
        for p, q in zip(run, nrm):
            for off, dz in ((-(half + LIP_M), -LIP_DROP_M), (-half, 0.0), (half, 0.0), (half + LIP_M, -LIP_DROP_M)):
                verts.append((p[0] + q[0] * off, p[1] + q[1] * off, p[2] + dz))
        for k in range(len(run) - 1):
            a, b = base + 4 * k, base + 4 * (k + 1)
            # right lip, water, left lip: each wound to face up (the normal points left of the direction)
            faces += [(a, b, b + 1, a + 1), (a + 1, b + 1, b + 2, a + 2), (a + 2, b + 2, b + 3, a + 3)]
    water = bpy.data.meshes.new(n("waterways"))
    water.from_pydata(verts, [], faces)
    water.update()
    for poly in water.polygons:
        poly.use_smooth = True
    water.materials.append(river_material())
    obj = bpy.data.objects.new(n("waterways"), water)
    obj["status"] = "existing"
    coll.objects.link(obj)
    return {"channels": len(waterways), "runs": len(runs), "triangles": 2 * len(faces), "terrainTriangles": triangles, "terrainLowered": lowered}


# ---------------------------------------------------------------- a reservoir's draw-down shore

def _ring_points(ring, step=2.0):
    pts = [Vector((x, y, 0)) for x, y in ring]
    out = []
    for a, b in zip(pts, pts[1:] + pts[:1]):
        k = max(1, int((b - a).length / step))
        out += [a.lerp(b, i / k) for i in range(k)]
    return out


def shore_band(terrain, reservoirs):
    """A "shore" weight on the terrain's vertices (1 on the draw-down band, 0 elsewhere): within BAND_M of a reservoir's
    mapped shore or an island's, and up to RISE_M above its water, fading out over a grid cell and a metre; the terrain
    material mixes pale stone in by it. Returns the band's vertex count."""
    me = terrain.data
    co = np.empty(len(me.vertices) * 3, np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    spacing = float(np.linalg.norm(co[1, :2] - co[0, :2])) if len(co) > 1 else 4.0  # the DEM's nodes, row by row
    band = max(BAND_M, 0.6 * spacing)
    weight = np.zeros(len(co), np.float32)
    for w in reservoirs:
        level = float(w["surfaceZ"])
        shore = [p for poly in w["polygons"] for ring in [poly["outer"], *poly["holes"]] for p in _ring_points(ring)]
        if not shore:
            continue
        kd = KDTree(len(shore))
        for i, p in enumerate(shore):
            kd.insert(p, i)
        kd.balance()
        xy = np.array([(p.x, p.y) for p in shore])
        lo, hi = xy.min(axis=0) - band - spacing, xy.max(axis=0) + band + spacing
        # (the ground well under the water is hidden by it: only the shore's height range is weighed)
        z = co[:, 2]
        near = np.flatnonzero(np.all((co[:, :2] >= lo) & (co[:, :2] <= hi), axis=1) & (z < level + RISE_M + RISE_FADE_M) & (z > level - 1.0))
        for i in near:
            d = kd.find((co[i, 0], co[i, 1], 0.0))[2]
            w_d = 1.0 if d <= band else max(0.0, 1.0 - (d - band) / (0.5 * spacing))
            w_h = min(1.0, max(0.0, (level + RISE_M + RISE_FADE_M - co[i, 2]) / RISE_FADE_M))
            weight[i] = max(weight[i], w_d * w_h)
    attr = me.attributes.get("shore") or me.attributes.new("shore", "FLOAT", "POINT")
    attr.data.foreach_set("value", weight)
    for slot in terrain.material_slots:
        if slot.material:
            _shore_in_material(slot.material)
    return {"bandVertices": int((weight > 0.5).sum()), "bandM": round(band, 1)}


def _shore_in_material(mat):
    """Mix pale shore stone, with a pebbly grain, into the terrain material's colour by the "shore" attribute (no
    effect where a terrain has none). Once per material."""
    if mat.get("shore_band") or not mat.use_nodes:
        return
    nt = mat.node_tree
    bsdf = next((nd for nd in nt.nodes if nd.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None or not bsdf.inputs["Base Color"].links:
        return
    src = bsdf.inputs["Base Color"].links[0].from_socket
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "shore"
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 5.0  # stones of about 0.2 m
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    grain = nt.nodes.new("ShaderNodeMapRange")
    grain.inputs["From Min"].default_value, grain.inputs["From Max"].default_value = 0.0, 0.9
    grain.inputs["To Min"].default_value, grain.inputs["To Max"].default_value = 0.7, 1.15
    nt.links.new(vor.outputs["Distance"], grain.inputs["Value"])
    stone = nt.nodes.new("ShaderNodeMix")
    stone.data_type, stone.blend_type = "RGBA", "MULTIPLY"
    stone.inputs[0].default_value = 1.0
    stone.inputs[6].default_value = STONE
    nt.links.new(grain.outputs[0], stone.inputs[7])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    nt.links.new(attr.outputs["Fac"], mix.inputs[0])
    nt.links.new(src, mix.inputs[6])
    nt.links.new(stone.outputs[2], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    mat["shore_band"] = True


def off_shore(rows, terrain, spacing_frac=0.5):
    """Grass rows (x, y, z, ...) not on the draw-down band: none within half a grid cell of a pale shore vertex."""
    attr = terrain.data.attributes.get("shore")
    if attr is None or not len(rows):
        return rows
    me = terrain.data
    w = np.empty(len(me.vertices), np.float32)
    attr.data.foreach_get("value", w)
    pale = np.flatnonzero(w > 0.3)
    if not len(pale):
        return rows
    co = np.empty(len(me.vertices) * 3, np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    spacing = float(np.linalg.norm(co[1, :2] - co[0, :2]))
    kd = KDTree(len(pale))
    for k, i in enumerate(pale):
        kd.insert((co[i, 0], co[i, 1], 0.0), k)
    kd.balance()
    lo, hi = co[pale, :2].min(axis=0) - spacing, co[pale, :2].max(axis=0) + spacing
    keep = np.ones(len(rows), bool)
    for r in np.flatnonzero(np.all((rows[:, :2] >= lo) & (rows[:, :2] <= hi), axis=1)):
        keep[r] = kd.find((rows[r, 0], rows[r, 1], 0.0))[2] > spacing_frac * spacing
    return rows[keep]
