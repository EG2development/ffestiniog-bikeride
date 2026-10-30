// Photoreal layer: grass clumps near the trail (docs/adr/0054-photoreal-layer.md).
import { bngToWgs84 } from "./bng";
import { heightAtBng } from "./dem";
import { mulberry32 } from "./rng";
import type { Trail } from "./trail";
import type { DemGrid, LandCover, Projector } from "./types";

// Grass is decorative, like the trees (ADR 11): it is placed only on land cover that is grass, heath or unclassified
// ground, within a band either side of the trail and along the stretch the shots see, by a seeded draw. Nothing is
// placed on the trail ribbon, on woodland, water, built-up or quarry ground. The view draws one instanced mesh.

export type GrassClump = { x: number; y: number; z: number; yaw: number; scale: number; tint: number };

export type GrassOptions = {
  seed: number;
  /** the stretch of the route, metres along it, the clumps cover */
  alongM: [number, number];
  /** half-width of the band either side of the centreline, metres */
  bandM: number;
  /** clumps per 100 m² of eligible ground */
  per100m2: number;
  /** no clump within this distance of the centreline: the ribbon and its shoulder */
  clearOfTrailM: number;
  maxClumps: number;
  ve: number;
  /** land-cover classes that carry grass (legend names) */
  classes: RegExp;
  /** multiplies every clump's tint: below 1 for the darker growth under trees */
  tintScale: number;
  /** the rendered ground's height in world units at a plan position: the flattened terrain mesh, which differs from the
   * bare DTM by the corridor's cut and fill (up to 2 m here). Without it the clumps stand on the bare DTM, buried under
   * the fill or floating over the cut (review 2026-10-30, RL15). */
  groundAt?: (x: number, z: number) => number;
};

const DEFAULTS: GrassOptions = { seed: 20261029, alongM: [0, Infinity], bandM: 60, per100m2: 70, clearOfTrailM: 2, maxClumps: 80_000, ve: 1, classes: /grass|farm|meadow|pasture|heath|scrub|other/, tintScale: 1 };

export function placeGrass(dem: DemGrid, land: LandCover, project: Projector, trail: Trail, options: Partial<GrassOptions> = {}): GrassClump[] {
  const opts = { ...DEFAULTS, ...options };
  const eligible = new Set(land.legend.map((name, i) => (opts.classes.test(name.toLowerCase()) ? i : -1)).filter((i) => i >= 0));
  const samples = trail.samples.filter((s) => s.distM >= opts.alongM[0] && s.distM <= opts.alongM[1]);
  if (samples.length === 0 || eligible.size === 0) return [];
  // hash the stretch's samples by cell, so each node checks only its neighbourhood
  const band = opts.bandM / 10;
  const cells = new Map<string, { x: number; z: number }[]>();
  for (let i = 0; i < samples.length; i += 2) {
    const s = samples[i];
    const key = `${Math.floor(s.x / band)},${Math.floor(s.z / band)}`;
    const list = cells.get(key);
    if (list) list.push(s);
    else cells.set(key, [s]);
  }
  const clear = opts.clearOfTrailM / 10;
  const nearest = (x: number, z: number): number => {
    let best = Infinity;
    const cx = Math.floor(x / band);
    const cz = Math.floor(z / band);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of cells.get(`${cx + i},${cz + j}`) ?? []) best = Math.min(best, Math.hypot(s.x - x, s.z - z));
    return best;
  };
  const perNode = (opts.per100m2 / 100) * dem.spacingM * dem.spacingM;
  const out: GrassClump[] = [];
  const rand = mulberry32(opts.seed);
  for (let r = 0; r < dem.rows; r++) {
    for (let c = 0; c < dem.cols; c++) {
      const i = r * dem.cols + c;
      if (!eligible.has(land.classes[i])) continue;
      const e0 = dem.originE + c * dem.spacingM;
      const n0 = dem.originN - r * dem.spacingM;
      const centre = project(bngToWgs84(e0, n0).lon, bngToWgs84(e0, n0).lat);
      const dist = nearest(centre.x, centre.y);
      if (dist > band) continue;
      // the band fades out: fewer clumps towards its edge, so the end of the grass is not a line
      const want = perNode * Math.min(1, 1.6 * (1 - dist / band));
      const count = Math.floor(want) + (rand() < want - Math.floor(want) ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const e = e0 + (rand() - 0.5) * dem.spacingM;
        const n = n0 + (rand() - 0.5) * dem.spacingM;
        const yaw = 2 * Math.PI * rand();
        const scale = 0.7 + 0.6 * rand();
        const tint = (0.8 + 0.4 * rand()) * opts.tintScale;
        const h = heightAtBng(dem, e, n);
        if (h === null) continue;
        const { lon, lat } = bngToWgs84(e, n);
        const p = project(lon, lat);
        if (nearest(p.x, p.y) < clear) continue;
        if (out.length >= opts.maxClumps) return out;
        // the clump stands on the rendered ground when the caller gives it, else on the bare DTM
        const y = opts.groundAt ? opts.groundAt(p.x, p.y) : (h / 10) * opts.ve;
        if (!Number.isFinite(y)) continue;
        out.push({ x: p.x, y, z: p.y, yaw, scale, tint });
      }
    }
  }
  return out;
}
