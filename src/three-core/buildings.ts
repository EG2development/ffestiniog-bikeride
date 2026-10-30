// Buildings as merged geometry and landmarks as procedural parts (docs/adr/0050-merged-buildings-and-procedural-landmarks.md;
// spec BL5, BL7–BL10, BL14). Pure: arrays only, in world units (10 m); the view turns them into meshes.
import type { HeightAt } from "./camera";
import type { SectionBuilding } from "./registers";
import type { Vec3 } from "./types";

type XZ = { x: number; z: number };
export type BuildingStatus = "existing" | "construction" | "approved" | "demolished";
export type BuildingRecord = { id: string; ring: XZ[]; heightM: number; roof: "flat" | "gabled"; status: BuildingStatus };
export type BuildingGroup = { kind: "existing" | "translucent"; positions: Float32Array; normals: Float32Array; indices: Uint32Array };

const area2 = (r: XZ[]) => r.reduce((a, p, i) => a + p.x * r[(i + 1) % r.length].z - r[(i + 1) % r.length].x * p.z, 0);
const anticlockwise = (r: XZ[]) => (area2(r) > 0 ? r : [...r].reverse());
const centroid = (r: XZ[]) => ({ x: r.reduce((a, p) => a + p.x, 0) / r.length, z: r.reduce((a, p) => a + p.z, 0) / r.length });

/** The lowest ground under the footprint: its centroid and its walls' feet, sampled every 0.2 units (2 m, half the
 * DEM's 4 m spacing) along each edge, so no wall floats over a dip between corners (BL5; t10 L2). */
export function buildingBase(ring: XZ[], heightAt: HeightAt): number {
  const c = centroid(ring);
  let low = heightAt(c.x, c.z);
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2));
    for (let i = 0; i < n; i++) low = Math.min(low, heightAt(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n));
  });
  return low;
}

/** The ring without vertices on a straight line between their neighbours (OSM often has them on long walls). */
function withoutCollinear(r: XZ[]): XZ[] {
  const out = r.filter((p, i) => {
    const [a, b] = [r[(i + r.length - 1) % r.length], r[(i + 1) % r.length]];
    const cross = (p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x);
    return Math.abs(cross) > 1e-3 * Math.hypot(b.x - a.x, b.z - a.z) ** 2;
  });
  return out.length >= 3 ? out : r;
}

function inRing(x: number, z: number, ring: XZ[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Ear clipping of a simple anticlockwise ring; returns index triples. */
function earClip(ring: XZ[]): [number, number, number][] {
  const idx = ring.map((_, i) => i);
  const out: [number, number, number][] = [];
  const convex = (a: XZ, b: XZ, c: XZ) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x) > 0;
  const inTri = (p: XZ, a: XZ, b: XZ, c: XZ) => {
    const d1 = (p.x - b.x) * (a.z - b.z) - (a.x - b.x) * (p.z - b.z);
    const d2 = (p.x - c.x) * (b.z - c.z) - (b.x - c.x) * (p.z - c.z);
    const d3 = (p.x - a.x) * (c.z - a.z) - (c.x - a.x) * (p.z - a.z);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  let guard = 0;
  while (idx.length > 3 && guard++ < 10_000) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const [i0, i1, i2] = [idx[(k + idx.length - 1) % idx.length], idx[k], idx[(k + 1) % idx.length]];
      const [a, b, c] = [ring[i0], ring[i1], ring[i2]];
      if (!convex(a, b, c)) continue;
      if (idx.some((j) => j !== i0 && j !== i1 && j !== i2 && inTri(ring[j], a, b, c))) continue;
      out.push([i0, i1, i2]);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // degenerate ring: stop rather than loop
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

/** The long axis of a rectangular footprint, for a gabled roof; null unless, after dropping collinear nodes, it has four
 * near-square corners and opposite sides of equal length, so the roof fits the walls (t10 M1). */
function rectangleAxes(ring: XZ[]): { o: XZ; u: XZ; v: XZ; lu: number; lv: number } | null {
  const r = withoutCollinear(ring);
  if (r.length !== 4) return null;
  const edge = (k: number) => ({ x: r[(k + 1) % 4].x - r[k].x, z: r[(k + 1) % 4].z - r[k].z });
  const len = (e: XZ) => Math.hypot(e.x, e.z);
  for (let k = 0; k < 4; k++) {
    const [e, f] = [edge(k), edge((k + 1) % 4)];
    if (Math.abs((e.x * f.x + e.z * f.z) / (len(e) * len(f) || 1)) > 0.05) return null; // a corner more than ~3° from square
  }
  if (Math.abs(len(edge(0)) - len(edge(2))) > 0.05 * len(edge(0)) || Math.abs(len(edge(1)) - len(edge(3))) > 0.05 * len(edge(1))) return null;
  const e0 = edge(0);
  const e1 = edge(1);
  const [l0, l1] = [len(e0), len(e1)];
  return l0 >= l1 ? { o: r[0], u: { x: e0.x / l0, z: e0.z / l0 }, v: { x: e1.x / l1, z: e1.z / l1 }, lu: l0, lv: l1 } : { o: r[1], u: { x: e1.x / l1, z: e1.z / l1 }, v: { x: -e0.x / l0, z: -e0.z / l0 }, lu: l1, lv: l0 };
}

class Builder {
  p: number[] = [];
  n: number[] = [];
  i: number[] = [];
  /** A planar polygon (3+ points), with the normal pointing towards `outward`, a vector it must face along. */
  face(pts: Vec3[], outward: Vec3) {
    const [a, b, c] = pts;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nrm: Vec3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const flip = nrm[0] * outward[0] + nrm[1] * outward[1] + nrm[2] * outward[2] < 0;
    if (flip) nrm = [-nrm[0], -nrm[1], -nrm[2]];
    const l = Math.hypot(...nrm) || 1;
    const base = this.p.length / 3;
    for (const q of pts) {
      this.p.push(...q);
      this.n.push(nrm[0] / l, nrm[1] / l, nrm[2] / l);
    }
    for (let k = 1; k < pts.length - 1; k++) {
      if (flip) this.i.push(base, base + k + 1, base + k);
      else this.i.push(base, base + k, base + k + 1);
    }
  }
}

/** Walls from the lowest ground under each footprint to its top, with a flat or gabled roof, merged into at most one
 * group per look: existing (and under construction), and translucent for approved or demolished (spec BL10, BL14). */
export function buildingArrays(records: BuildingRecord[], heightAt: HeightAt, ve: number, landmarks: LandmarkPlacement[] = []): { groups: BuildingGroup[] } {
  const builders = { existing: new Builder(), translucent: new Builder() };
  const look = (status: BuildingStatus) => builders[status === "approved" || status === "demolished" ? "translucent" : "existing"];
  for (const r of records) {
    const ring = anticlockwise(r.ring);
    const b = look(r.status);
    const base = buildingBase(ring, heightAt);
    const c = centroid(ring);
    const highest = Math.max(heightAt(c.x, c.z), ...ring.map((p) => heightAt(p.x, p.z)));
    const rect = r.roof === "gabled" ? rectangleAxes(ring) : null;
    // the recorded height is the top (a DSM height reaches the ridge): a gabled roof sits inside it, not on it (BL6)
    const hW = (r.heightM / 10) * ve;
    const rise = rect ? Math.min(0.4 * rect.lv, 0.35 * hW) : 0;
    const eaves = Math.max(base + hW - rise, highest + 0.2); // never buried: 2 m above the highest ground (BL5)
    ring.forEach((a, k) => {
      const d = ring[(k + 1) % ring.length];
      const out: Vec3 = [d.z - a.z, 0, -(d.x - a.x)]; // anticlockwise ring: the outward side of edge a→d
      b.face([[a.x, base, a.z], [d.x, base, d.z], [d.x, eaves, d.z], [a.x, eaves, a.z]], out);
    });
    if (!rect) {
      for (const [i0, i1, i2] of earClip(ring)) b.face([[ring[i0].x, eaves, ring[i0].z], [ring[i1].x, eaves, ring[i1].z], [ring[i2].x, eaves, ring[i2].z]], [0, 1, 0]);
      continue;
    }
    const at = (s: number, t: number, y: number): Vec3 => [rect.o.x + rect.u.x * s + rect.v.x * t, y, rect.o.z + rect.u.z * s + rect.v.z * t];
    const ridge = eaves + rise;
    const half = rect.lv / 2;
    b.face([at(0, 0, eaves), at(rect.lu, 0, eaves), at(rect.lu, half, ridge), at(0, half, ridge)], [-rect.v.x, 1, -rect.v.z]);
    b.face([at(0, rect.lv, eaves), at(0, half, ridge), at(rect.lu, half, ridge), at(rect.lu, rect.lv, eaves)], [rect.v.x, 1, rect.v.z]);
    b.face([at(0, 0, eaves), at(0, half, ridge), at(0, rect.lv, eaves)], [-rect.u.x, 0, -rect.u.z]);
    b.face([at(rect.lu, 0, eaves), at(rect.lu, rect.lv, eaves), at(rect.lu, half, ridge)], [rect.u.x, 0, rect.u.z]);
  }
  for (const pl of landmarks) addLandmark(look(pl.status), pl);
  const groups: BuildingGroup[] = [];
  for (const kind of ["existing", "translucent"] as const) {
    const b = builders[kind];
    if (b.i.length > 0) groups.push({ kind, positions: new Float32Array(b.p), normals: new Float32Array(b.n), indices: new Uint32Array(b.i) });
  }
  return { groups };
}

/** A landmark's parts as faces in the merged arrays, so landmarks share the buildings' material and draw call (BL9, BL10). */
function addLandmark(b: Builder, pl: LandmarkPlacement) {
  const [c, s] = [Math.cos(pl.yaw), -Math.sin(pl.yaw)]; // the frame's x axis in the world is (c, s)
  const dir = (x: number, y: number, z: number): Vec3 => [x * c - z * s, y, x * s + z * c];
  const w = (x: number, y: number, z: number): Vec3 => {
    const d = dir(x, y, z);
    return [pl.origin[0] + d[0], pl.origin[1] + d[1], pl.origin[2] + d[2]];
  };
  for (const part of landmarkParts(pl.model).parts) {
    const [cx, cy, cz] = part.centre;
    const [x0, x1, y0, y1, z0, z1] = [cx - part.size[0] / 2, cx + part.size[0] / 2, cy - part.size[1] / 2, cy + part.size[1] / 2, cz - part.size[2] / 2, cz + part.size[2] / 2];
    if (part.shape === "box") {
      b.face([w(x0, y1, z0), w(x1, y1, z0), w(x1, y1, z1), w(x0, y1, z1)], dir(0, 1, 0));
      b.face([w(x0, y0, z0), w(x1, y0, z0), w(x1, y1, z0), w(x0, y1, z0)], dir(0, 0, -1));
      b.face([w(x0, y0, z1), w(x0, y1, z1), w(x1, y1, z1), w(x1, y0, z1)], dir(0, 0, 1));
      b.face([w(x0, y0, z0), w(x0, y1, z0), w(x0, y1, z1), w(x0, y0, z1)], dir(-1, 0, 0));
      b.face([w(x1, y0, z0), w(x1, y0, z1), w(x1, y1, z1), w(x1, y1, z0)], dir(1, 0, 0));
    } else if (part.shape === "roof") {
      b.face([w(x0, y0, z0), w(x1, y0, z0), w(x1, y1, cz), w(x0, y1, cz)], dir(0, 1, -1));
      b.face([w(x0, y0, z1), w(x0, y1, cz), w(x1, y1, cz), w(x1, y0, z1)], dir(0, 1, 1));
      b.face([w(x0, y0, z0), w(x0, y1, cz), w(x0, y0, z1)], dir(-1, 0, 0));
      b.face([w(x1, y0, z0), w(x1, y0, z1), w(x1, y1, cz)], dir(1, 0, 0));
    } else {
      const apex = w(cx, y1, cz);
      b.face([w(x0, y0, z0), w(x1, y0, z0), apex], dir(0, 0.5, -1));
      b.face([w(x1, y0, z0), w(x1, y0, z1), apex], dir(1, 0.5, 0));
      b.face([w(x1, y0, z1), w(x0, y0, z1), apex], dir(0, 0.5, 1));
      b.face([w(x0, y0, z1), w(x0, y0, z0), apex], dir(-1, 0.5, 0));
    }
  }
}

/** Overlap as a share of the smaller footprint, by rasterising both on a 0.05-unit (0.5 m) grid (spec BL8). */
export function footprintOverlap(a: XZ[], b: XZ[]): number {
  const xs = [...a, ...b].map((p) => p.x);
  const zs = [...a, ...b].map((p) => p.z);
  const step = 0.05;
  let ca = 0;
  let cb = 0;
  let both = 0;
  for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) {
    for (let z = Math.min(...zs) + step / 2; z < Math.max(...zs); z += step) {
      const ia = inRing(x, z, a);
      const ib = inRing(x, z, b);
      if (ia) ca++;
      if (ib) cb++;
      if (ia && ib) both++;
    }
  }
  return Math.min(ca, cb) === 0 ? 0 : both / Math.min(ca, cb);
}

const crosses = (p: XZ, q: XZ, a: XZ, b: XZ) => {
  const d = (u: XZ, v: XZ, w: XZ) => (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x);
  return d(p, q, a) * d(p, q, b) < 0 && d(a, b, p) * d(a, b, q) < 0;
};

/** Footprints that a line (trail or road centreline) enters: a vertex inside, or a segment crossing an edge (spec BL7). */
export function segmentsInFootprints(lines: XZ[][], fps: { id: string; ring: XZ[] }[]): string[] {
  const hit = new Set<string>();
  for (const fp of fps) {
    const [x0, x1] = [Math.min(...fp.ring.map((p) => p.x)), Math.max(...fp.ring.map((p) => p.x))];
    const [z0, z1] = [Math.min(...fp.ring.map((p) => p.z)), Math.max(...fp.ring.map((p) => p.z))];
    outer: for (const line of lines) {
      for (let k = 0; k < line.length; k++) {
        const p = line[k];
        if (p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && inRing(p.x, p.z, fp.ring)) {
          hit.add(fp.id);
          break outer;
        }
        const q = line[k + 1];
        if (!q) continue;
        for (let e = 0; e < fp.ring.length; e++) {
          if (crosses(p, q, fp.ring[e], fp.ring[(e + 1) % fp.ring.length])) {
            hit.add(fp.id);
            break outer;
          }
        }
      }
    }
  }
  return [...hit];
}

export type LandmarkModel = { type: "church" | "station" | "block"; lengthM: number; widthM: number; heightM: number; towerHeightM?: number };
export type LandmarkPart = { name: string; shape: "box" | "roof" | "pyramid"; centre: Vec3; size: Vec3 };

/** Procedural parts of a landmark in its own frame (x along its length, metres → world units), with its bounds (spec BL9). */
export function landmarkParts(model: LandmarkModel): { parts: LandmarkPart[]; bounds: { min: Vec3; max: Vec3 } } {
  const L = model.lengthM / 10;
  const W = model.widthM / 10;
  const H = model.heightM / 10;
  const parts: LandmarkPart[] = [];
  if (model.type === "church" && model.towerHeightM) {
    const T = model.towerHeightM / 10;
    const tw = Math.min(W, L * 0.22);
    const eaves = H * 0.62;
    parts.push({ name: "nave", shape: "box", centre: [(L - tw) / 2 + tw, eaves / 2, 0], size: [L - tw, eaves, W] });
    parts.push({ name: "nave-roof", shape: "roof", centre: [(L - tw) / 2 + tw, eaves + (H - eaves) / 2, 0], size: [L - tw, H - eaves, W] });
    parts.push({ name: "tower", shape: "box", centre: [tw / 2, (T * 0.85) / 2, 0], size: [tw, T * 0.85, tw] });
    parts.push({ name: "tower-cap", shape: "pyramid", centre: [tw / 2, T * 0.85 + (T * 0.15) / 2, 0], size: [tw, T * 0.15, tw] });
  } else {
    const eaves = model.type === "block" ? H : H * 0.7;
    parts.push({ name: "body", shape: "box", centre: [L / 2, eaves / 2, 0], size: [L, eaves, W] });
    if (model.type !== "block") parts.push({ name: "roof", shape: "roof", centre: [L / 2, eaves + (H - eaves) / 2, 0], size: [L, H - eaves, W] });
  }
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], p.centre[k] - p.size[k] / 2);
    max[k] = Math.max(max[k], p.centre[k] + p.size[k] / 2);
  }
  return { parts, bounds: { min, max } };
}

/** A landmark's parts placed in the world: `origin` is its frame's origin on the ground, `yaw` its rotation about y. */
export type LandmarkPlacement = { id: string; model: LandmarkModel; origin: Vec3; yaw: number; status: BuildingStatus };
export type SectionBuildingRecord = BuildingRecord & { kind: "background" | "landmark"; model?: LandmarkModel };
/** `landmarkGroups` holds the landmarks alone, for the landmark mask (spec BL13); `groups` draws everything. */
export type SectionBuildings = { records: SectionBuildingRecord[]; groups: BuildingGroup[]; landmarks: LandmarkPlacement[]; landmarkGroups: BuildingGroup[] };

/** Along the footprint's principal axis, centred on it, with the tower end (local x = 0) to the west (spec BL9). */
function placeLandmark(r: SectionBuildingRecord, model: LandmarkModel, west: XZ, heightAt: HeightAt): LandmarkPlacement {
  const c = centroid(r.ring);
  let [sxx, szz, sxz] = [0, 0, 0];
  for (const p of r.ring) {
    sxx += (p.x - c.x) ** 2;
    szz += (p.z - c.z) ** 2;
    sxz += (p.x - c.x) * (p.z - c.z);
  }
  const t = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const flip = Math.cos(t) * west.x + Math.sin(t) * west.z > 0 ? -1 : 1; // the axis points away from the west
  const ax = { x: flip * Math.cos(t), z: flip * Math.sin(t) };
  const [half, side] = [model.lengthM / 20, model.widthM / 20];
  const o = { x: c.x - ax.x * half, z: c.z - ax.z * half };
  const rect = [0, 2 * half].flatMap((s) => [-side, side].map((t) => ({ x: o.x + ax.x * s - ax.z * t, z: o.z + ax.z * s + ax.x * t })));
  const base = Math.min(buildingBase(r.ring, heightAt), ...rect.map((p) => heightAt(p.x, p.z))); // no part floats (BL5)
  return { id: r.id, model, origin: [o.x, base, o.z], yaw: -Math.atan2(ax.z, ax.x), status: r.status };
}

/** A section's buildings: only ids the register lists as buildings, with the register's status (spec BL3, BL16);
 * footprints projected (BL5); background buildings merged (BL10); landmarks as placed parts (BL9). */
export function sectionBuildings(
  list: SectionBuilding[],
  status: Map<string, BuildingStatus>,
  project: (lon: number, lat: number) => { x: number; y: number },
  heightAt: HeightAt,
  ve: number,
): SectionBuildings {
  const records: SectionBuildingRecord[] = list
    .filter((b) => status.has(b.id))
    .map((b) => {
      const ring = b.footprint.map(([lon, lat]) => {
        const p = project(lon, lat);
        return { x: p.x, z: p.y };
      });
      const [a, z] = [ring[0], ring[ring.length - 1]];
      if (ring.length > 3 && Math.abs(a.x - z.x) < 1e-9 && Math.abs(a.z - z.z) < 1e-9) ring.pop(); // OSM rings repeat the first point
      return { id: b.id, ring, heightM: b.heightM, roof: b.roof, status: status.get(b.id)!, kind: b.kind, ...(b.model && { model: b.model }) };
    })
    // a footprint that runs off the terrain window has no ground to stand on there: walls would reach -Infinity (t10 H2)
    .filter((r) => [...r.ring, centroid(r.ring)].every((p) => Number.isFinite(heightAt(p.x, p.z))));
  let west: XZ = { x: -1, z: 0 };
  if (list.length > 0) {
    const [lon, lat] = list[0].footprint[0];
    const [p, q] = [project(lon, lat), project(lon - 0.001, lat)];
    west = { x: q.x - p.x, z: q.y - p.y };
  }
  const isLandmark = (r: SectionBuildingRecord) => r.kind === "landmark" && r.model !== undefined;
  const landmarks = records.filter(isLandmark).map((r) => placeLandmark(r, r.model!, west, heightAt));
  return { records, groups: buildingArrays(records.filter((r) => !isLandmark(r)), heightAt, ve, landmarks).groups, landmarks, landmarkGroups: buildingArrays([], heightAt, ve, landmarks).groups };
}
