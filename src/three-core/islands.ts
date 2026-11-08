// Trees on a reservoir's islands (the aerial review of 2026-11-02: Llyn Trawsfynydd's islands are fully wooded in the
// imagery, inside a pale draw-down band). The corridor's 16 m nodes give a small island one node or none, and the
// landcover calls it water, so placeTrees leaves most of them bare. Here each island (a hole in a reservoir's polygon)
// gets broadleaf crowns on a jittered grid, kept back from its shore, standing at least at the water's level; an
// island that already carries trees only has its gaps filled. The extent is OSM's; the trees are decorative.
import type { HeightAt } from "./camera";
import { inRingXZ } from "./plane";
import { mulberry32 } from "./rng";
import { NOMINAL_TREE_HEIGHT_M, type TreeInstance, type TreePlacement } from "./trees";
import type { WaterBody } from "./water";

type XZ = { x: number; z: number };

export const ISLAND_TREES = {
  /** crown spacing, metres: a closed broadleaf canopy */
  spacingM: 6.5,
  /** trunks no nearer the island's shore than this, metres (the draw-down band shows round the edge) */
  insetM: 2.0,
  /** no new trunk this close to an existing one, metres */
  clearM: 4.0,
  /** the island trees' height range, metres (the corridor's lidar canopy has its median at 9.4 m) */
  heightM: [7, 12] as [number, number],
  seed: 20261102,
} as const;

const inRing = (p: XZ, ring: XZ[]) => inRingXZ(p.x, p.z, ring);

function distToRing(p: XZ, ring: XZ[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz));
  }
  return best;
}

/** Whether a point (world units) stands on an island of one of these reservoirs. */
export function onReservoirIsland(water: WaterBody[], p: XZ): boolean {
  return water.some((w) => w.reservoir && w.polygons.some((poly) => poly.holes.some((h) => inRing(p, h))));
}

/** Broadleaf trees for every island of every reservoir in `water`, in world units (10 m), clear of `existing`. */
export function islandTrees(water: WaterBody[], heightAt: HeightAt, existing: TreePlacement): TreeInstance[] {
  const u = 10; // metres per world unit
  const rand = mulberry32(ISLAND_TREES.seed);
  const have = [...existing.broadleaf, ...existing.conifer];
  const out: TreeInstance[] = [];
  for (const body of water.filter((w) => w.reservoir)) {
    for (const ring of body.polygons.flatMap((p) => p.holes)) {
      const xs = ring.map((q) => q.x);
      const zs = ring.map((q) => q.z);
      const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      const near = have.filter((t) => t.x > x0 - 1 && t.x < x1 + 1 && t.z > z0 - 1 && t.z < z1 + 1);
      const step = ISLAND_TREES.spacingM / u;
      const spots: XZ[] = [];
      for (let x = x0 + step / 2; x < x1; x += step)
        for (let z = z0 + step / 2; z < z1; z += step) spots.push({ x: x + (rand() - 0.5) * step * 0.7, z: z + (rand() - 0.5) * step * 0.7 });
      let kept = spots.filter((p) => inRing(p, ring) && distToRing(p, ring) * u >= ISLAND_TREES.insetM);
      if (kept.length === 0) {
        // an island smaller than the grid: one tree at its middle, if the middle is on it
        const mid = { x: xs.reduce((a, b) => a + b, 0) / xs.length, z: zs.reduce((a, b) => a + b, 0) / zs.length };
        kept = inRing(mid, ring) ? [mid] : [];
      }
      for (const p of kept) {
        if ([...near, ...out].some((t) => Math.hypot(t.x - p.x, t.z - p.z) * u < ISLAND_TREES.clearM)) continue;
        const [lo, hi] = ISLAND_TREES.heightM;
        const h = lo + (hi - lo) * rand();
        const ground = heightAt(p.x, p.z);
        out.push({
          x: p.x,
          y: Math.max(Number.isFinite(ground) ? ground : body.surfaceY, body.surfaceY),
          z: p.z,
          scale: h / NOMINAL_TREE_HEIGHT_M.broadleaf,
          yaw: rand() * Math.PI * 2,
          tint: 0.85 + 0.3 * rand(),
          variant: Math.floor(rand() * 3),
        });
      }
    }
  }
  return out;
}
