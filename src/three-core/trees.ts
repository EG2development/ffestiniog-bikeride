// Iteration 2: TREE_COLOURS (docs/adr/0046-clarity-tuned-as-data.md); keep-out corridor around follow cameras (docs/adr/0047-trees-clear-of-camera-corridor.md).
// Reel: near zone and density band (docs/adr/0037-vegetation-near-zone.md).
import { bngToWgs84 } from "./bng";
import { heightAtBng } from "./dem";
import type { Vec3 } from "./types";
import { inRingXZ as inRing, withinReach } from "./plane";
import { mulberry32 } from "./rng";
import { roadWidthM, type RoadLine } from "./roads";
import type { Trail } from "./trail";
import type { DemGrid, LandCover, Projector } from "./types";
import { CONIFER_SHARE } from "./woodland";

// Trees placed by a seeded PRNG at land-cover nodes classed as woodland (from OSM), kept off the
// trail corridor and road carriageways. Woodland extent is OSM; individual trees are decorative
// (docs/adr/0011-seeded-trees-in-woodland.md).

/** `tint` and `variant` (ADR 57) are read by the photoreal view only; the concept view draws every tree alike. */
export type TreeInstance = { x: number; y: number; z: number; scale: number; yaw: number; tint?: number; variant?: number };
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
  /** trees are placed only within this distance of the trail; Infinity places them everywhere (ADR 37) */
  nearZoneM: number;
  /** target trees per 100 m² of near-zone woodland; `density` as a [min, max] band clamps the target into it */
  densityPer100m2: number;
  density?: [number, number];
  /** plan corridors to keep clear: no trunk within rM of the segment (docs/adr/0047-trees-clear-of-camera-corridor.md) */
  keepOut?: { a: { x: number; z: number }; b: { x: number; z: number }; rM: number }[];
  /** camera-to-rider lines of sight, world units: no crown (CROWN_SPHERES) may cross one (spec CL5) */
  sightLines?: { a: Vec3; b: Vec3 }[];
  /** building footprints, world units: no trunk inside one and no crown over its walls (spec BL13) */
  footprints?: { x: number; z: number }[][];
  /** lidar canopy height per DEM node, metres (docs/adr/0057-canopy-heights-from-lidar.md). With it, a woodland node
   * grows a tree only where the lidar saw one (≥ `minCanopyM`), at the measured height; a node outside OSM woodland
   * with a local canopy maximum ≥ `fieldTreeM` grows a field tree. Tints and variants come from a second seeded stream,
   * so the placements without a canopy are unchanged (the reel's trees do not move). */
  canopy?: Float32Array;
  minCanopyM: number;
  fieldTreeM: number;
  /** trees drawn per woodland node, each with its own five draws: 1 for the 4 m windows; the corridor's 16 m nodes hold
   * several crowns, or its woodland reads as parkland from the air (docs/adr/0060-reel-in-the-photo-look.md) */
  treesPerNode: number;
  /** with a canopy: every node where the lidar stands ≥ `minCanopyM`, mapped as woodland or not, grows trees as a woodland
   * node does (broadleaf outside OSM woodland); built-up, quarry and water nodes never do, as their DSM is roofs and
   * spoil. For a coarse grid, whose single field-tree peaks read as parkland from the air (ADR 60). */
  canopyCover: boolean;
  /** each DEM node's wood kind (woodland.ts WOOD, from the OSM polygon's tags): with it a woodland node's trees are
   * conifer at its kind's CONIFER_SHARE instead of 55 % everywhere, and the two kinds share one budget of twice
   * `maxTrees` (the instance budget the per-kind cap allowed), spread evenly over the nodes that can grow a tree */
  woodKinds?: Uint8Array;
};

/** The heights the drawn crowns reach per unit of scale, metres: a canopy height divided by these gives the scale. */
export const NOMINAL_TREE_HEIGHT_M = { conifer: 14.25, broadleaf: 10.6 } as const;
const SCALE_RANGE: [number, number] = [0.4, 2.4];

/** The tree palette, one source for the view (docs/adr/0046-clarity-tuned-as-data.md). */
export const TREE_COLOURS = { trunk: "#4a3a2a", conifer: "#2b482b", broadleaf: "#486733" };
/** Fill on the tree material, as a share of the crown colour added on every side: the sky's light on the shaded side,
 * which the hemisphere alone leaves near black (spec CL2). The crowns are darkened by 1.5 / (1.5 + fill) in linear
 * light (#2c4a2c and #4a6a34 before) so the sunlit side keeps its brightness. The value is the largest that keeps
 * every still within CL3's ±10 % (Maentwrog frame 150 binds: 0.12 measured +10.0 % at t7; after the t10 crown fix cleared
 * more trees from the sight lines, 0.10 measured +10.9 % and 0.08 +9.5 %); tuning in docs/validation-3d.md. */
export const TREE_FILL = 0.08;

/** The crowns TreesView draws, per unit of instance scale: a 7-sided cone inside this circular cone, and an
 * icosahedron of this circumradius squashed in y. One source for the view and for the tests (t10 H1). */
export const CROWN_SHAPES = {
  conifer: { baseY: 0.275, apexY: 1.425, radius: 0.28 },
  broadleaf: { centreY: 0.7, radius: 0.42, yScale: 0.85 },
} as const;

/** Spheres that enclose CROWN_SHAPES (a test checks it), used to keep crowns out of the lines of sight. The first set
 * stopped at y 1.14, below the cone's apex at 1.425, and missed tips crossing the view (t10 H1). */
export const CROWN_SPHERES = {
  conifer: [{ y: 0.4, r: 0.33 }, { y: 0.66, r: 0.26 }, { y: 0.9, r: 0.19 }, { y: 1.1, r: 0.13 }, { y: 1.27, r: 0.085 }, { y: 1.38, r: 0.05 }],
  broadleaf: [{ y: 0.7, r: 0.42 }],
};

/** Does the segment a→b pass within r of c? (world units) */
function segmentNear(a: Vec3, b: Vec3, c: Vec3, r: number): boolean {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
  const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * d[0] + (c[1] - a[1]) * d[1] + (c[2] - a[2]) * d[2]) / len2));
  const p = [a[0] + t * d[0] - c[0], a[1] + t * d[1] - c[1], a[2] + t * d[2] - c[2]];
  return p[0] * p[0] + p[1] * p[1] + p[2] * p[2] < r * r;
}

/** Plan distance from (x, z) to the nearest edge of a ring. */
function edgeDistance(x: number, z: number, ring: { x: number; z: number }[]): number {
  let best = Infinity;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const [vx, vz] = [b.x - a.x, b.z - a.z];
    const u = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz || 1)));
    best = Math.min(best, Math.hypot(x - a.x - u * vx, z - a.z - u * vz));
  });
  return best;
}

const DEFAULTS: TreeOptions = { seed: 20261025, probability: 0.12, maxTrees: 6000, clearOfTrailM: 10, roads: [], clearOfRoadM: 2, ve: 1, nearZoneM: 300, densityPer100m2: 4, minCanopyM: 3, fieldTreeM: 6, treesPerNode: 1, canopyCover: false };

/** True within `reachUnits` of any trail sample (every 5th, 10 m: enough for a 300 m zone); everywhere when the reach is unbounded or there is no trail. */
function nearTrail(samples: { x: number; z: number }[], reachUnits: number): (x: number, z: number) => boolean {
  if (!Number.isFinite(reachUnits) || samples.length === 0) return () => true;
  return withinReach(samples, reachUnits, 5);
}

/** Segments hashed by grid cell; `near(x, z)` lists the segments within `reach` of any point in that cell. */
function segmentIndex<S extends { ax: number; az: number; bx: number; bz: number; clear: number }>(segments: S[], cell: number): (x: number, z: number) => S[] {
  const cells = new Map<string, S[]>();
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
  const target = opts.density ? Math.min(Math.max(opts.densityPer100m2, opts.density[0]), opts.density[1]) : opts.densityPer100m2;
  // one node per spacing² m²: the keep probability that gives the target density
  const keep = Math.min(1, Math.max(0, (target / 100) * dem.spacingM * dem.spacingM));
  const inNearZone = nearTrail(trail.samples, opts.nearZoneM / 10);
  const woodland = land.legend.findIndex((name) => /wood|forest/.test(name));
  const out: TreePlacement = { conifer: [], broadleaf: [] };
  if (woodland < 0) return out;
  const canopy = opts.canopy;
  if (canopy && canopy.length !== dem.cols * dem.rows) throw new Error(`canopy has ${canopy.length} values for ${dem.cols * dem.rows} DEM nodes`);
  const canopyAt = (r: number, c: number) => canopy![Math.min(dem.rows - 1, Math.max(0, r)) * dem.cols + Math.min(dem.cols - 1, Math.max(0, c))];
  const bare = land.legend.map((name) => /built|resid|urban|industrial|quarry|rock|scree|slate|bare|water|lake|reservoir|river/.test(name.toLowerCase()));
  /** a node the lidar canopy covers, where `canopyCover` lets it grow trees outside OSM woodland */
  const covered = (r: number, c: number) => opts.canopyCover && canopy !== undefined && !bare[land.classes[r * dem.cols + c]] && canopyAt(r, c) >= opts.minCanopyM;

  // Candidate nodes first, so the per-kind cap thins the whole woodland evenly instead of stopping part way
  // through the row-major scan (review R2). Conifers are 55 % of the draws, or their wood kind's share (woodland.ts).
  const candidate = (r: number, c: number): boolean => {
    const i = r * dem.cols + c;
    if (land.classes[i] !== woodland && !covered(r, c)) return false;
    if (!Number.isFinite(opts.nearZoneM) && trail.samples.length === 0) return true;
    const { lon, lat } = bngToWgs84(dem.originE + c * dem.spacingM, dem.originN - r * dem.spacingM);
    const p = project(lon, lat);
    return inNearZone(p.x, p.y);
  };
  const kinds = opts.woodKinds;
  if (kinds && kinds.length !== dem.cols * dem.rows) throw new Error(`woodKinds has ${kinds.length} values for ${dem.cols * dem.rows} DEM nodes`);
  /** a node's conifer share: by its wood kind where the tags are known, 55 % without them; canopy cover is broadleaf */
  const coniferShare = (i: number, mapped: boolean) => (!mapped ? 0 : kinds ? CONIFER_SHARE[kinds[i]] ?? CONIFER_SHARE[0] : 0.55);
  let candidates = 0;
  let growable = 0;
  for (let r = 0; r < dem.rows; r++) {
    for (let c = 0; c < dem.cols; c++) {
      if (!candidate(r, c)) continue;
      candidates++;
      if (!canopy || canopyAt(r, c) >= opts.minCanopyM) growable++;
    }
  }
  // with wood kinds the two kinds share 2 x maxTrees, spread over the nodes that can grow one (the lidar's canopy)
  const evenUnderCap = kinds
    ? growable > 0 ? (0.9 * 2 * opts.maxTrees) / (growable * opts.treesPerNode) : 1
    : candidates > 0 ? (0.9 * opts.maxTrees) / (0.55 * candidates * opts.treesPerNode) : 1;
  const probability = options.probability ?? Math.min(keep, evenUnderCap);

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
  const corridors = (opts.keepOut ?? []).map((k) => ({ ax: k.a.x, az: k.a.z, bx: k.b.x, bz: k.b.z, clear: k.rM / 10 }));
  const keepNear = segmentIndex(corridors, cell);
  const outOfKeepOut = (x: number, z: number) =>
    keepNear(x, z).every((s) => {
      const vx = s.bx - s.ax;
      const vz = s.bz - s.az;
      const u = Math.max(0, Math.min(1, ((x - s.ax) * vx + (z - s.az) * vz) / (vx * vx + vz * vz || 1)));
      return Math.hypot(x - (s.ax + u * vx), z - (s.az + u * vz)) >= s.clear;
    });
  const lines = (opts.sightLines ?? []).map((l) => ({ ax: l.a[0], az: l.a[2], bx: l.b[0], bz: l.b[2], clear: 0.8, line: l }));
  const linesNear = segmentIndex(lines, cell);
  const clearOfSight = (x: number, y: number, z: number, kind: "conifer" | "broadleaf", scale: number) =>
    linesNear(x, z).every((s) => CROWN_SPHERES[kind].every((c) => !segmentNear(s.line.a, s.line.b, [x, y + c.y * scale, z], c.r * scale)));
  const fps = (opts.footprints ?? []).map((ring) => ({ ring, x0: Math.min(...ring.map((p) => p.x)), x1: Math.max(...ring.map((p) => p.x)), z0: Math.min(...ring.map((p) => p.z)), z1: Math.max(...ring.map((p) => p.z)) }));
  const clearOfBuildings = (x: number, z: number, crown: number) =>
    fps.every((f) => x < f.x0 - crown || x > f.x1 + crown || z < f.z0 - crown || z > f.z1 + crown || (!inRing(x, z, f.ring) && edgeDistance(x, z, f.ring) >= crown));
  const clearOfRoads = (x: number, z: number) =>
    roadsNear(x, z).every((s) => {
      const vx = s.bx - s.ax;
      const vz = s.bz - s.az;
      const u = Math.max(0, Math.min(1, ((x - s.ax) * vx + (z - s.az) * vz) / (vx * vx + vz * vz || 1)));
      return Math.hypot(x - (s.ax + u * vx), z - (s.az + u * vz)) >= s.clear;
    });

  /** a field tree stands where the canopy peaks: the node is at least as tall as its eight neighbours */
  const localMax = (r: number, c: number) => {
    const h = canopyAt(r, c);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && canopyAt(r + dr, c + dc) > h) return false;
    return true;
  };
  const scaleFor = (kind: "conifer" | "broadleaf", heightM: number) => Math.min(SCALE_RANGE[1], Math.max(SCALE_RANGE[0], heightM / NOMINAL_TREE_HEIGHT_M[kind]));

  const rand = mulberry32(opts.seed);
  for (let r = 0; r < dem.rows; r++) {
    for (let c = 0; c < dem.cols; c++) {
      const i = r * dem.cols + c;
      const mapped = land.classes[i] === woodland;
      // a canopy-covered node grows as woodland does, from its own node-keyed stream (below)
      const cover = !mapped && covered(r, c);
      const inWood = mapped || cover;
      // a field tree: outside OSM woodland, where the lidar canopy peaks above fieldTreeM (ADR 57); with canopy cover a
      // bare node's peak is a roof or spoil, as the window has no footprints to tell (ADR 60)
      const fieldTree = !inWood && !(opts.canopyCover && bare[land.classes[i]]) && canopy !== undefined && canopyAt(r, c) >= opts.fieldTreeM && localMax(r, c);
      if (!inWood && !fieldTree) continue;
      // draw all five numbers for every woodland node, so one node's tree doesn't depend on whether earlier ones were kept;
      // a field tree draws from its own stream, keyed by node, so it never shifts the woodland draws
      const draw = fieldTree || cover ? mulberry32((opts.seed ^ (i * 2654435761)) >>> 0) : rand;
      for (let t = 0; t < (fieldTree ? 1 : opts.treesPerNode); t++) {
        const pick = draw();
        const jx = (draw() - 0.5) * dem.spacingM;
        const jy = (draw() - 0.5) * dem.spacingM;
        const kind = draw();
        const size = draw();
        let scale = 0.75 + 0.5 * size;
        const yaw = 2 * Math.PI * draw();
        if (inWood && pick > probability) continue;
        if (inWood && canopy !== undefined && canopyAt(r, c) < opts.minCanopyM) continue; // mapped as woodland, but the lidar saw no tree here
        const e = dem.originE + c * dem.spacingM + jx;
        const n = dem.originN - r * dem.spacingM + jy;
        const h = heightAtBng(dem, e, n);
        if (h === null) continue;
        const { lon, lat } = bngToWgs84(e, n);
        const p = project(lon, lat);
        if (!inNearZone(p.x, p.y) || !clearOfTrail(p.x, p.y) || !clearOfRoads(p.x, p.y) || !outOfKeepOut(p.x, p.y)) continue;
        const k = fieldTree || cover ? "broadleaf" : kind < coniferShare(i, mapped) ? "conifer" : "broadleaf";
        // several crowns to a node are not all the node's height: the lidar cell holds the tallest and some below it
        if (canopy !== undefined) scale = scaleFor(k, canopyAt(r, c)) * (t === 0 ? 1 : 0.7 + 0.3 * size);
        const y = (h / 10) * opts.ve;
        if (!clearOfSight(p.x, y, p.y, k, scale)) continue; // decorative trees give way to the view of the rider (ADR 47)
        if (!clearOfBuildings(p.x, p.y, Math.max(...CROWN_SPHERES[k].map((s) => s.r)) * scale)) continue; // and to sourced buildings (BL13)
        const list = out[k];
        if (kinds ? out.conifer.length + out.broadleaf.length >= 2 * opts.maxTrees : list.length >= opts.maxTrees) continue; // the cap is per kind (ADR 37), or shared with wood kinds
        // look variation from a second stream keyed by node (and by tree within it): the photoreal view reads it, the concept view ignores it
        const look = mulberry32((opts.seed + 7919 + i + t * 1_000_003) >>> 0);
        list.push({ x: p.x, y, z: p.y, scale, yaw, tint: 0.85 + 0.3 * look(), variant: Math.floor(look() * 3) });
      }
    }
  }
  return out;
}

/**
 * The photo look's draw lists (docs/adr/0060-reel-in-the-photo-look.md): a tree no frame's view holds and no frame's
 * shadow map can reach is never seen, and one outside every shadow map's reach casts no shadow anyone sees, so dropping
 * the first and not casting the second changes no pixel. A crown is a sphere round its middle; a view is the pose's
 * frustum at `aspect`, out to `far`; a shadow map reaches `shadowReach` (world units) from the frame's focus in plan,
 * which the caller sizes from the map's half-width, the relief and the sun's elevation.
 */
export function treesInShots(
  trees: TreePlacement,
  poses: { position: Vec3; target: Vec3; fovDeg: number }[],
  focus: Vec3[],
  opts: { shadowReach: number; aspect?: number; far?: number },
): { casting: TreePlacement; shadowless: TreePlacement } {
  const aspect = opts.aspect ?? 16 / 9;
  const far = opts.far ?? 2600;
  const views = poses.map((p) => {
    const f: Vec3 = [p.target[0] - p.position[0], p.target[1] - p.position[1], p.target[2] - p.position[2]];
    const fl = Math.hypot(f[0], f[1], f[2]) || 1;
    const fwd: Vec3 = [f[0] / fl, f[1] / fl, f[2] / fl];
    const rl = Math.hypot(fwd[0], fwd[2]) || 1;
    const right: Vec3 = [-fwd[2] / rl, 0, fwd[0] / rl];
    const up: Vec3 = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    const tv = Math.tan((p.fovDeg * Math.PI) / 360);
    return { o: p.position, fwd, right, up, tv, th: tv * aspect };
  });
  const seen = (c: Vec3, r: number) =>
    views.some(({ o, fwd, right, up, tv, th }) => {
      const d: Vec3 = [c[0] - o[0], c[1] - o[1], c[2] - o[2]];
      const depth = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2];
      if (depth < -r || depth > far + r) return false;
      const x = Math.abs(d[0] * right[0] + d[1] * right[1] + d[2] * right[2]);
      const y = Math.abs(d[0] * up[0] + d[1] * up[1] + d[2] * up[2]);
      return x <= th * depth + r * Math.hypot(1, th) && y <= tv * depth + r * Math.hypot(1, tv);
    });
  const reach2 = opts.shadowReach * opts.shadowReach;
  const lit = (t: TreeInstance) => focus.some((f) => (f[0] - t.x) ** 2 + (f[2] - t.z) ** 2 <= reach2);
  const out = { casting: { conifer: [], broadleaf: [] } as TreePlacement, shadowless: { conifer: [], broadleaf: [] } as TreePlacement };
  for (const k of ["conifer", "broadleaf"] as const) {
    // the crown's middle and a radius that holds the whole tree (CROWN_SPHERES reach 1.38 × scale up and 0.42 × scale out)
    for (const t of trees[k]) {
      if (lit(t)) out.casting[k].push(t);
      else if (seen([t.x, t.y + 0.7 * t.scale, t.z], 0.8 * t.scale)) out.shadowless[k].push(t);
    }
  }
  return out;
}
