import type { RouteModel } from "../data/route";
import type { MeshArrays, Vec3 } from "./types";

// docs/pseudocode-3d.md §2.3–2.5, docs/adr/0013-trail-ribbon-corridor.md

export const TRAIL_WIDTH_M = 3.0;
/** the trail surface sits this far above the profile, so it never z-fights the terrain under it */
const SURFACE_OFFSET = 0.005;
const RESAMPLE_M = 2;

export type TrailProfile = {
  distanceM: number[];
  elevationM: number[];
  smoothingM: number;
  /** [startM, endM] distance ranges carried on bridges */
  bridges?: [number, number][];
  /** per bridge, the lowest 1 m lidar ground under its span (metres; null where it has none): what passes beneath */
  bridgeGroundM?: (number | null)[];
  /** [startM, endM] distance ranges under road bridges (the DTM's deck was removed from the profile) */
  overbridges?: [number, number][];
};

export type TrailSample = {
  x: number;
  y: number;
  z: number;
  distM: number;
  tangent: Vec3;
  /** rise over run, as a fraction */
  gradient: number;
};

export type Trail = {
  samples: TrailSample[];
  sampleAt: (distM: number) => TrailSample;
  ribbon: MeshArrays;
  maxGradient: number;
};

/** Index i such that xs[i] <= v < xs[i+1], clamped to the array. */
function bracket(xs: ArrayLike<number>, v: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  if (v <= xs[0]) return 0;
  if (v >= xs[hi]) return hi - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= v) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function profileHeightAt(profile: TrailProfile, d: number): number {
  const ds = profile.distanceM;
  if (d <= ds[0]) return profile.elevationM[0];
  if (d >= ds[ds.length - 1]) return profile.elevationM[ds.length - 1];
  const i = bracket(ds, d);
  const f = (d - ds[i]) / (ds[i + 1] - ds[i]);
  return profile.elevationM[i] + (profile.elevationM[i + 1] - profile.elevationM[i]) * f;
}

const normalise = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

export function buildTrail(
  route: RouteModel,
  profile: TrailProfile,
  section: { startKm: number; endKm: number },
  opts: { widthM: number; ve: number },
): Trail {
  const startM = section.startKm * 1000;
  const endM = section.endKm * 1000;
  const total = route.totalLengthM;

  // Centreline: the section's end points plus every original vertex between them.
  const atDist = (d: number) => route.pointAtT(d / total);
  const polyD: number[] = [startM];
  const polyX: number[] = [atDist(startM).x];
  const polyZ: number[] = [atDist(startM).y];
  for (const p of route.routePoints) {
    if (p.dist > startM && p.dist < endM) {
      polyD.push(p.dist);
      polyX.push(p.x);
      polyZ.push(p.y);
    }
  }
  polyD.push(endM);
  polyX.push(atDist(endM).x);
  polyZ.push(atDist(endM).y);

  const clampD = (d: number) => Math.min(endM, Math.max(startM, d));
  const xzAt = (dIn: number): [number, number] => {
    const d = clampD(dIn);
    const i = bracket(polyD, d);
    const f = (d - polyD[i]) / (polyD[i + 1] - polyD[i]);
    return [polyX[i] + (polyX[i + 1] - polyX[i]) * f, polyZ[i] + (polyZ[i + 1] - polyZ[i]) * f];
  };
  const yAt = (d: number) => (profileHeightAt(profile, clampD(d)) / 10) * opts.ve + SURFACE_OFFSET;

  const sampleAt = (dIn: number): TrailSample => {
    const d = clampD(dIn);
    const [x, z] = xzAt(d);
    const a = Math.max(startM, d - 0.5);
    const b = Math.min(endM, d + 0.5);
    const [xa, za] = xzAt(a);
    const [xb, zb] = xzAt(b);
    const gradient = (profileHeightAt(profile, d + 1) - profileHeightAt(profile, d - 1)) / 2;
    return {
      x,
      y: yAt(d),
      z,
      distM: d,
      tangent: normalise([xb - xa, yAt(b) - yAt(a), zb - za]),
      gradient,
    };
  };

  // Resample every 2 m, always keeping the original vertices so the polyline is reproduced exactly.
  const dists = new Set<number>(polyD);
  for (let d = startM; d < endM; d += RESAMPLE_M) dists.add(d);
  const samples = [...dists].sort((p, q) => p - q).map(sampleAt);

  const half = opts.widthM / 2 / 10;
  const positions = new Float32Array(samples.length * 6);
  // texture coordinates for a surface material (the photoreal layer): u across the ribbon, v along it in units of 3 m
  const uvs = new Float32Array(samples.length * 4);
  samples.forEach((s, i) => {
    const l = Math.hypot(s.tangent[0], s.tangent[2]) || 1;
    const leftX = s.tangent[2] / l;
    const leftZ = -s.tangent[0] / l;
    positions.set([s.x + leftX * half, s.y, s.z + leftZ * half, s.x - leftX * half, s.y, s.z - leftZ * half], i * 6);
    uvs.set([0, (s.distM - startM) / 3, 1, (s.distM - startM) / 3], i * 4);
  });
  const indices = new Uint32Array((samples.length - 1) * 6);
  for (let i = 0; i < samples.length - 1; i++) {
    const l0 = 2 * i;
    const r0 = l0 + 1;
    const l1 = l0 + 2;
    const r1 = l0 + 3;
    // counter-clockwise seen from above, so the faces point up in three.js
    indices.set([l0, r0, l1, r0, r1, l1], i * 6);
  }

  return {
    samples,
    sampleAt,
    ribbon: { positions, indices, uvs },
    maxGradient: samples.reduce((m, s) => Math.max(m, Math.abs(s.gradient)), 0),
  };
}

export type CutFill = {
  fromKm: number;
  toKm: number;
  kind: "cut" | "fill";
  maxDepthM: number;
};

type Foot = { distM: number; lateral: number; interior: boolean };

/** Nearest point on the centreline polyline within `reach`, using a uniform hash of the segments. */
export function centrelineIndex(trail: Trail, reach: number) {
  const segs = trail.samples.slice(0, -1).map((a, i) => [a, trail.samples[i + 1]] as const);
  const cell = 1;
  const grid = new Map<string, number[]>();
  segs.forEach(([a, b], i) => {
    const x0 = Math.floor((Math.min(a.x, b.x) - reach) / cell);
    const x1 = Math.floor((Math.max(a.x, b.x) + reach) / cell);
    const z0 = Math.floor((Math.min(a.z, b.z) - reach) / cell);
    const z1 = Math.floor((Math.max(a.z, b.z) + reach) / cell);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const key = `${x},${z}`;
        const list = grid.get(key);
        if (list) list.push(i);
        else grid.set(key, [i]);
      }
    }
  });
  return (x: number, z: number): Foot | null => {
    const candidates = grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`);
    if (!candidates) return null;
    let best: Foot | null = null;
    for (const i of candidates) {
      const [a, b] = segs[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      const raw = len2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / len2 : 0;
      const t = Math.max(0, Math.min(1, raw));
      const lateral = Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz));
      if (best === null || lateral < best.lateral) {
        const beyondStart = i === 0 && raw < 0;
        const beyondEnd = i === segs.length - 1 && raw > 1;
        best = { distM: a.distM + t * (b.distM - a.distM), lateral, interior: !beyondStart && !beyondEnd };
      }
    }
    return best;
  };
}

export function flattenCorridor(
  mesh: MeshArrays,
  trail: Trail,
  opts: {
    widthM: number;
    shoulderM: number;
    spacingM: number;
    bridges: [number, number][];
    /** flattened but not reported as earthworks: under a road deck the "cut" is the deck, not a cutting */
    noReport?: [number, number][];
    /** the mesh's and trail's vertical exaggeration, so depths are reported in real metres (default 1) */
    ve?: number;
  },
): { mesh: MeshArrays; cutFill: CutFill[] } {
  // Every triangle under the ribbon has all three vertices within this reach (docs/pseudocode-3d.md §2.5).
  const reach = (opts.widthM / 2 + opts.shoulderM + opts.spacingM * Math.SQRT2) / 10;
  const depthReach = (opts.widthM / 2 + opts.shoulderM) / 10;
  const onBridge = (d: number) => opts.bridges.some(([a, b]) => d >= a && d <= b);
  const unreported = (d: number) => (opts.noReport ?? []).some(([a, b]) => d >= a && d <= b);
  const footOf = centrelineIndex(trail, reach);

  const positions = Float32Array.from(mesh.positions);
  const depthByMetre = new Map<number, number>();
  for (let i = 0; i < positions.length; i += 3) {
    const foot = footOf(positions[i], positions[i + 2]);
    if (!foot || !foot.interior || foot.lateral > reach || onBridge(foot.distM)) continue;
    const original = positions[i + 1];
    const flattened = trail.sampleAt(foot.distM).y - SURFACE_OFFSET;
    positions[i + 1] = flattened;
    if (foot.lateral <= depthReach && !unreported(foot.distM)) {
      const key = Math.round(foot.distM);
      const depth = ((original - flattened) * 10) / (opts.ve ?? 1);
      const prev = depthByMetre.get(key);
      if (prev === undefined || Math.abs(depth) > Math.abs(prev)) depthByMetre.set(key, depth);
    }
  }

  const MIN_DEPTH = 2;
  const MAX_GAP = opts.spacingM * 1.5 + 1;
  const points = [...depthByMetre.entries()].filter(([, d]) => Math.abs(d) > MIN_DEPTH).sort((a, b) => a[0] - b[0]);
  const cutFill: CutFill[] = [];
  let run: { from: number; to: number; kind: "cut" | "fill"; max: number } | null = null;
  for (const [d, depth] of points) {
    const kind = depth > 0 ? "cut" : "fill";
    if (run && run.kind === kind && d - run.to <= MAX_GAP) {
      run.to = d;
      run.max = Math.max(run.max, Math.abs(depth));
    } else {
      if (run) cutFill.push({ fromKm: run.from / 1000, toKm: run.to / 1000, kind: run.kind, maxDepthM: run.max });
      run = { from: d, to: d, kind, max: Math.abs(depth) };
    }
  }
  if (run) cutFill.push({ fromKm: run.from / 1000, toKm: run.to / 1000, kind: run.kind, maxDepthM: run.max });

  return { mesh: { ...mesh, positions }, cutFill };
}
