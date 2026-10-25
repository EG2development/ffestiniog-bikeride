import type { HeightAt } from "./camera";
import type { MeshArrays, Projector } from "./types";

// OSM roads as ribbons draped on the terrain (docs/design-3d.md D10). Widths are typical
// carriageway widths by highway class, not surveyed.

export type RoadLine = { coords: [number, number][]; highway: string };

const WIDTH_M: Record<string, number> = {
  motorway: 11,
  trunk: 7.3,
  trunk_link: 6,
  primary: 7,
  primary_link: 6,
  secondary: 6.5,
  tertiary: 6,
  unclassified: 4.5,
  residential: 5,
  service: 3.5,
  track: 2.5,
};
const STEP_M = 4;
const LIFT = 0.03; // 0.3 m above the terrain, so the 4 m mesh never hides the road

export const roadWidthM = (highway: string) => WIDTH_M[highway] ?? 3;

export function buildRoadMesh(roads: RoadLine[], project: Projector, heightAt: HeightAt): MeshArrays {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const road of roads) {
    const pts = road.coords.map(([lon, lat]) => project(lon, lat));
    // resample every STEP_M along the line
    const line: { x: number; z: number }[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const lenM = Math.hypot(b.x - a.x, b.y - a.y) * 10;
      const n = Math.max(1, Math.ceil(lenM / STEP_M));
      for (let k = 0; k < n; k++) line.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.y + ((b.y - a.y) * k) / n });
    }
    const last = pts[pts.length - 1];
    line.push({ x: last.x, z: last.y });

    // OSM returns whole ways, which can run past the terrain window: keep only runs with terrain under them.
    const half = roadWidthM(road.highway) / 2 / 10;
    const heights = line.map((p) => heightAt(p.x, p.z));
    let start = 0;
    while (start < line.length) {
      while (start < line.length && !Number.isFinite(heights[start])) start++;
      let end = start;
      while (end < line.length && Number.isFinite(heights[end])) end++;
      if (end - start >= 2) {
        const run = line.slice(start, end);
        const base = positions.length / 3;
        run.forEach((p, i) => {
          const a = run[Math.max(0, i - 1)];
          const b = run[Math.min(run.length - 1, i + 1)];
          const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          const lx = (b.z - a.z) / l;
          const lz = -(b.x - a.x) / l;
          // left edge, centreline and right edge each sit on the ground under them, so neither a side
          // slope nor ground that is convex across the road buries part of the carriageway (review R5, R11)
          const draped = (x: number, z: number) => {
            const h = heightAt(x, z);
            return (Number.isFinite(h) ? h : heights[start + i]) + LIFT;
          };
          for (const side of [1, 0, -1]) {
            const x = p.x + side * lx * half;
            const z = p.z + side * lz * half;
            positions.push(x, side === 0 ? heights[start + i] + LIFT : draped(x, z), z);
          }
        });
        // per cross-section: left (l), centre (c), right (r); two quads per step
        for (let i = 0; i + 1 < run.length; i++) {
          const l0 = base + 3 * i;
          const l1 = l0 + 3;
          indices.push(l0, l0 + 1, l1, l0 + 1, l1 + 1, l1, l0 + 1, l0 + 2, l1 + 1, l0 + 2, l1 + 2, l1 + 1);
        }
      }
      start = end;
    }
  }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}
