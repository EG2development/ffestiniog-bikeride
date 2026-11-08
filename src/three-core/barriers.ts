// Photoreal layer: field boundaries from OSM barrier ways (docs/adr/0058-walls-and-hedges-from-osm.md).
import type { HeightAt } from "./camera";
import { withinReach } from "./plane";
import type { OsmLine } from "./registers";
import type { Trail } from "./trail";
import type { MeshArrays, Projector } from "./types";

// Drystone walls, hedges and fences as lofted boxes on the rendered ground. Only the line and the tagged height come
// from OSM; the section and the material are generic, so every barrier is registered as approximate. A boundary that
// crosses the proposed trail is left open for `gapM` either side of the centreline: the concept assumes a gate or a gap,
// which is itself a proposal and is noted in the register.

export type BarrierKind = "wall" | "hedge" | "fence";
export type BarrierLine = { id: string; coords: [number, number][]; kind: BarrierKind; heightM?: number };

/** The size each kind is drawn at, metres, unless OSM tags a height. */
export const BARRIER_SIZES: Record<BarrierKind, { widthM: number; heightM: number }> = {
  wall: { widthM: 0.6, heightM: 1.2 },
  hedge: { widthM: 1.6, heightM: 1.8 },
  fence: { widthM: 0.08, heightM: 1.1 },
};
const STEP_M = 2;
const EMBED_M = 0.3; // the base sits this far into the ground, so a wall never floats between its samples
const MAX_TAGGED_M = 4; // an OSM height above this is a typo or a different thing

export function barrierKind(tags: Record<string, string>): BarrierKind | null {
  const b = tags.barrier;
  if (b === "wall" || b === "city_wall" || b === "retaining_wall") return "wall";
  if (b === "hedge" || tags.natural === "tree_row") return "hedge";
  if (b === "fence") return "fence";
  return null;
}

/** The barrier ways of a window's barriers.geojson, with the tagged height when it is a plausible number. */
export function barrierLines(osm: OsmLine[]): BarrierLine[] {
  const out: BarrierLine[] = [];
  for (const f of osm) {
    const kind = barrierKind(f.properties.tags);
    if (!kind || f.geometry.type !== "LineString") continue;
    const coords = f.geometry.coordinates as [number, number][];
    if (coords.length < 2) continue;
    const h = Number.parseFloat(f.properties.tags.height ?? "");
    out.push({ id: f.properties.id, coords, kind, ...(Number.isFinite(h) && h > 0 && h <= MAX_TAGGED_M ? { heightM: h } : {}) });
  }
  return out;
}

export type BarrierMeshes = Record<BarrierKind, MeshArrays>;

/** True within `reachUnits` of any trail sample (the same test the tree placer uses); nowhere when there is no trail. */
function nearTrail(trail: Trail | undefined, reachUnits: number): (x: number, z: number) => boolean {
  if (!trail || trail.samples.length === 0) return () => false;
  return withinReach(trail.samples, reachUnits);
}

/**
 * Lofts each line into a box of its kind's section (or the tagged height) along the rendered ground, sampled every 2 m.
 * Faces are not shared between sides, so the edges stay crisp. UVs: u along the line in units of 2 m, v up the face in
 * units of its height, so one texture tile covers 2 m × the height. Stations off the terrain and the gap round the trail
 * break the loft. Fences are posts with a rail rather than a solid box.
 */
export function buildBarrierMeshes(lines: BarrierLine[], project: Projector, heightAt: HeightAt, opts: { ve: number; trail?: Trail; gapM?: number }): BarrierMeshes {
  const gap = nearTrail(opts.trail, (opts.gapM ?? 3) / 10);
  const builders: Record<BarrierKind, Loft> = { wall: new Loft(), hedge: new Loft(), fence: new Loft() };
  for (const line of lines) {
    const size = BARRIER_SIZES[line.kind];
    const heightM = line.heightM ?? size.heightM;
    const pts = line.coords.map(([lon, lat]) => project(lon, lat));
    // resample every STEP_M along the line, keeping the vertices
    const stations: { x: number; z: number; d: number }[] = [];
    let d = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const lenM = Math.hypot(b.x - a.x, b.y - a.y) * 10;
      const n = Math.max(1, Math.ceil(lenM / STEP_M));
      for (let k = 0; k < n; k++) stations.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.y + ((b.y - a.y) * k) / n, d: d + (lenM * k) / n });
      d += lenM;
    }
    const last = pts[pts.length - 1];
    stations.push({ x: last.x, z: last.y, d });
    // runs of stations with ground under them and clear of the trail gap
    let start = 0;
    const ok = stations.map((s) => Number.isFinite(heightAt(s.x, s.z)) && !gap(s.x, s.z));
    while (start < stations.length) {
      while (start < stations.length && !ok[start]) start++;
      let end = start;
      while (end < stations.length && ok[end]) end++;
      if (end - start >= 2) {
        const run = stations.slice(start, end);
        if (line.kind === "fence") builders.fence.fence(run, heightAt, opts.ve, size.widthM, heightM);
        else builders[line.kind].solid(run, heightAt, opts.ve, size.widthM, heightM);
      }
      start = end;
    }
  }
  return { wall: builders.wall.arrays(), hedge: builders.hedge.arrays(), fence: builders.fence.arrays() };
}

/** Accumulates lofted boxes: four unshared faces per segment, each a quad with its own UVs. */
class Loft {
  private positions: number[] = [];
  private uvs: number[] = [];
  private indices: number[] = [];

  /** A quad from two cross-section edges (a0→a1 at station a, b0→b1 at station b), both in world units. */
  private quad(a0: number[], a1: number[], b0: number[], b1: number[], ua: number, ub: number, v0: number, v1: number) {
    const base = this.positions.length / 3;
    this.positions.push(...a0, ...a1, ...b0, ...b1);
    this.uvs.push(ua, v0, ua, v1, ub, v0, ub, v1);
    this.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }

  /** A box of width w (metres) along the run, from `fromM` to `toM` above the ground (negative embeds it). */
  box(run: { x: number; z: number; d: number }[], heightAt: HeightAt, ve: number, widthM: number, fromM: number, toM: number) {
    const w = widthM / 2 / 10;
    const heightM = toM - fromM;
    const corners = run.map((s, i) => {
      const a = run[Math.max(0, i - 1)];
      const b = run[Math.min(run.length - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const lx = (b.z - a.z) / l;
      const lz = -(b.x - a.x) / l;
      const g = heightAt(s.x, s.z);
      const y0 = g + (fromM / 10) * ve;
      const y1 = g + (toM / 10) * ve;
      return { l: [s.x + lx * w, y0, s.z + lz * w], r: [s.x - lx * w, y0, s.z - lz * w], lt: [s.x + lx * w, y1, s.z + lz * w], rt: [s.x - lx * w, y1, s.z - lz * w], u: s.d / 2 };
    });
    for (let i = 0; i + 1 < corners.length; i++) {
      const a = corners[i];
      const b = corners[i + 1];
      this.quad(a.l, a.lt, b.l, b.lt, a.u, b.u, 0, 1); // left face
      this.quad(a.rt, a.r, b.rt, b.r, a.u, b.u, 1, 0); // right face
      this.quad(a.lt, a.rt, b.lt, b.rt, a.u, b.u, 0, widthM / heightM); // top
    }
    // end caps
    const first = corners[0];
    const lastC = corners[corners.length - 1];
    this.quad(first.r, first.rt, first.l, first.lt, 0, widthM / 2, 0, 1);
    this.quad(lastC.l, lastC.lt, lastC.r, lastC.rt, 0, widthM / 2, 0, 1);
  }

  /** A wall or hedge: a box from EMBED_M below the ground to heightM above it. */
  solid(run: { x: number; z: number; d: number }[], heightAt: HeightAt, ve: number, widthM: number, heightM: number) {
    this.box(run, heightAt, ve, widthM, -EMBED_M, heightM);
  }

  /** A fence: square posts every 3 m and two thin rails. */
  fence(run: { x: number; z: number; d: number }[], heightAt: HeightAt, ve: number, widthM: number, heightM: number) {
    const posts: { x: number; z: number; d: number }[] = [];
    let nextPost = Math.ceil(run[0].d / 3) * 3;
    for (let i = 0; i + 1 < run.length; i++) {
      while (nextPost <= run[i + 1].d) {
        const t = (nextPost - run[i].d) / Math.max(1e-9, run[i + 1].d - run[i].d);
        if (t >= 0 && t <= 1) posts.push({ x: run[i].x + (run[i + 1].x - run[i].x) * t, z: run[i].z + (run[i + 1].z - run[i].z) * t, d: nextPost });
        nextPost += 3;
      }
    }
    const s = 0.05 / 10;
    for (const p of posts) {
      const g = heightAt(p.x, p.z);
      if (!Number.isFinite(g)) continue;
      const y0 = g - (EMBED_M / 10) * ve;
      const y1 = g + (heightM / 10) * ve;
      const c = [[p.x - s, p.z - s], [p.x + s, p.z - s], [p.x + s, p.z + s], [p.x - s, p.z + s]];
      for (let k = 0; k < 4; k++) {
        const a = c[k];
        const b = c[(k + 1) % 4];
        this.quad([a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], 0, 0.05, 0, 1);
      }
    }
    for (const railM of [heightM * 0.45, heightM * 0.92]) this.box(run, heightAt, ve, widthM, railM, railM + 0.05);
  }

  arrays(): MeshArrays {
    return { positions: Float32Array.from(this.positions), indices: Uint32Array.from(this.indices), uvs: Float32Array.from(this.uvs) };
  }
}
