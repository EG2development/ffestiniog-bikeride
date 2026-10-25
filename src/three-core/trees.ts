import { bngToWgs84 } from "./bng";
import { heightAtBng } from "./dem";
import { mulberry32 } from "./rng";
import { roadWidthM, type RoadLine } from "./roads";
import type { Trail } from "./trail";
import type { DemGrid, LandCover, Projector } from "./types";

// Trees placed by a seeded PRNG at land-cover nodes classed as woodland (from OSM), kept off the
// trail corridor and road carriageways. Woodland extent is OSM; individual trees are decorative
// (docs/adr/0011-seeded-trees-in-woodland.md).

export type TreeInstance = { x: number; y: number; z: number; scale: number; yaw: number };
export type TreePlacement = { conifer: TreeInstance[]; broadleaf: TreeInstance[] };

export type TreeOptions = {
  seed: number;
  probability: number;
  maxTrees: number;
  clearOfTrailM: number;
  /** roads to keep trees off: no trunk within the carriageway plus clearOfRoadM */
  roads: RoadLine[];
  clearOfRoadM: number;
  /** vertical exaggeration, the same as the terrain's */
  ve: number;
};

const DEFAULTS: TreeOptions = { seed: 20261025, probability: 0.12, maxTrees: 6000, clearOfTrailM: 10, roads: [], clearOfRoadM: 2, ve: 1 };

/** Segments hashed by grid cell; `near(x, z)` lists the segments within `reach` of any point in that cell. */
function segmentIndex(segments: { ax: number; az: number; bx: number; bz: number; clear: number }[], cell: number) {
  const cells = new Map<string, typeof segments>();
  for (const s of segments) {
    const [x0, x1] = [Math.min(s.ax, s.bx) - s.clear, Math.max(s.ax, s.bx) + s.clear];
    const [z0, z1] = [Math.min(s.az, s.bz) - s.clear, Math.max(s.az, s.bz) + s.clear];
    for (let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++) {
      for (let cz = Math.floor(z0 / cell); cz <= Math.floor(z1 / cell); cz++) {
        const key = `${cx},${cz}`;
        const list = cells.get(key);
        if (list) list.push(s);
        else cells.set(key, [s]);
      }
    }
  }
  return (x: number, z: number) => cells.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? [];
}

export function placeTrees(
  dem: DemGrid,
  land: LandCover,
  project: Projector,
  trail: Trail,
  options: Partial<TreeOptions> = {},
): TreePlacement {
  const opts = { ...DEFAULTS, ...options };
  const woodland = land.legend.findIndex((name) => /wood|forest/.test(name));
  const out: TreePlacement = { conifer: [], broadleaf: [] };
  if (woodland < 0) return out;

  // coarse hash of trail samples for the "clear of the trail" test
  const cell = 2;
  const near = new Map<string, { x: number; z: number }[]>();
  for (const s of trail.samples) {
    const key = `${Math.floor(s.x / cell)},${Math.floor(s.z / cell)}`;
    const list = near.get(key);
    if (list) list.push(s);
    else near.set(key, [s]);
  }
  const clear = opts.clearOfTrailM / 10;
  const clearOfTrail = (x: number, z: number) => {
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const s of near.get(`${cx + i},${cz + j}`) ?? []) {
          if (Math.hypot(s.x - x, s.z - z) < clear) return false;
        }
      }
    }
    return true;
  };

  const segments = opts.roads.flatMap((road) => {
    const pts = road.coords.map(([lon, lat]) => project(lon, lat));
    const reach = (roadWidthM(road.highway) / 2 + opts.clearOfRoadM) / 10;
    return pts.slice(1).map((b, k) => ({ ax: pts[k].x, az: pts[k].y, bx: b.x, bz: b.y, clear: reach }));
  });
  const roadsNear = segmentIndex(segments, cell);
  const clearOfRoads = (x: number, z: number) =>
    roadsNear(x, z).every((s) => {
      const vx = s.bx - s.ax;
      const vz = s.bz - s.az;
      const u = Math.max(0, Math.min(1, ((x - s.ax) * vx + (z - s.az) * vz) / (vx * vx + vz * vz || 1)));
      return Math.hypot(x - (s.ax + u * vx), z - (s.az + u * vz)) >= s.clear;
    });

  const rand = mulberry32(opts.seed);
  let placed = 0;
  for (let r = 0; r < dem.rows && placed < opts.maxTrees; r++) {
    for (let c = 0; c < dem.cols && placed < opts.maxTrees; c++) {
      const i = r * dem.cols + c;
      if (land.classes[i] !== woodland) continue;
      // draw all five numbers for every woodland node, so one node's tree doesn't depend on whether earlier ones were kept
      const pick = rand();
      const jx = (rand() - 0.5) * dem.spacingM;
      const jy = (rand() - 0.5) * dem.spacingM;
      const kind = rand();
      const scale = 0.75 + 0.5 * rand();
      const yaw = 2 * Math.PI * rand();
      if (pick > opts.probability) continue;
      const e = dem.originE + c * dem.spacingM + jx;
      const n = dem.originN - r * dem.spacingM + jy;
      const h = heightAtBng(dem, e, n);
      if (h === null) continue;
      const { lon, lat } = bngToWgs84(e, n);
      const p = project(lon, lat);
      if (!clearOfTrail(p.x, p.y) || !clearOfRoads(p.x, p.y)) continue;
      (kind < 0.55 ? out.conifer : out.broadleaf).push({ x: p.x, y: (h / 10) * opts.ve, z: p.y, scale, yaw });
      placed++;
    }
  }
  return out;
}
