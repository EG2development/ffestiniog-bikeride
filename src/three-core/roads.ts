import type { HeightAt } from "./camera";
import type { MeshArrays, Projector } from "./types";

// OSM roads as ribbons draped on the terrain (docs/design-3d.md D10). Widths are typical
// carriageway widths by highway class, not surveyed.

export type RoadLine = {
  coords: [number, number][];
  highway: string;
  /** OSM bridge=*: the lidar DTM drops most decks to the ground beneath, so the deck runs straight between the way's ends */
  bridge?: boolean;
};

/** What a road stands on: the rendered ground, and where it passes over the trail. */
export type RoadGround = {
  /** the rendered ground (the terrain mesh's own surface) */
  groundAt: HeightAt;
  /** true over the trail's clearance, which a road's structure spans instead of walling off */
  openAt: (x: number, z: number) => boolean;
  ve: number;
};

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

// A road clear of the rendered ground keeps its real level (the DTM's) and stands on a generic masonry structure, like
// the railway's bridges (ADR 12): walls down to the ground beside the trail's cut, a deck over the trail or a bridge
// way's gap, and parapets where the drop is high. Metres.
const MIN_GAP_M = 0.6; // LIFT included: higher than this above the ground, a road gets its structure
const PARAPET_FROM_M = 2;
const PARAPET_M = 1.0;
const KERB_M = 0.1;
const WALL_M = 0.4;
const DECK_M = 0.9;
const FOOT_M = 0.3; // walls run this far into the ground
const ABUTMENT_M = 2; // a bridge way is walled this far in from each end, and open between

export const roadWidthM = (highway: string) => WIDTH_M[highway] ?? 3;

type Station = {
  x: number;
  z: number;
  lx: number;
  lz: number;
  /** left edge, centre, right edge */
  y: [number, number, number];
  alongM: number;
  /** on a bridge way (its far end included) */
  bridge: boolean;
  /** on a bridge way, more than ABUTMENT_M from either end of it */
  interior: boolean;
};
type Run = { half: number; stations: Station[] };
/** A road of one class through every way that continues it end to end, with each segment's OSM bridge tag. */
type Chain = { coords: [number, number][]; highway: string; bridge: boolean[] };

/** OSM splits a road into ways at each bridge; joined where exactly two ways of one class meet end to end, the road
 * bends through the joint instead of leaving a wedge open on the outside of the bend (a hole, on a raised deck). */
function chainRoads(roads: RoadLine[]): Chain[] {
  const key = (c: [number, number]) => `${c[0]},${c[1]}`;
  const ends = new Map<string, number[]>();
  roads.forEach((r, i) => {
    for (const c of [r.coords[0], r.coords[r.coords.length - 1]]) ends.set(key(c), [...(ends.get(key(c)) ?? []), i]);
  });
  const used = roads.map(() => false);
  const next = (i: number, node: [number, number]) => {
    const at = ends.get(key(node)) ?? [];
    const j = at.length === 2 ? (at[0] === i ? at[1] : at[0]) : -1;
    return j >= 0 && j !== i && !used[j] && roads[j].highway === roads[i].highway ? j : -1;
  };
  const chains: Chain[] = [];
  roads.forEach((road, i) => {
    if (used[i]) return;
    used[i] = true;
    const flags = (r: RoadLine) => r.coords.slice(1).map(() => !!r.bridge);
    const chain: Chain = { coords: [...road.coords], highway: road.highway, bridge: flags(road) };
    for (const forward of [true, false]) {
      let tail = i;
      for (;;) {
        const node = forward ? chain.coords[chain.coords.length - 1] : chain.coords[0];
        const j = next(tail, node);
        if (j < 0) break;
        used[j] = true;
        tail = j;
        // orient the next way to leave the shared node
        const starts = key(roads[j].coords[0]) === key(node);
        const coords = forward === starts ? roads[j].coords : [...roads[j].coords].reverse();
        if (forward) {
          chain.coords.push(...coords.slice(1));
          chain.bridge.push(...flags(roads[j]));
        } else {
          chain.coords.unshift(...coords.slice(0, -1));
          chain.bridge.unshift(...flags(roads[j]));
        }
      }
    }
    chains.push(chain);
  });
  return chains;
}

/** Each road resampled every STEP_M into cross-sections, split into the runs that have terrain under them. */
function roadRuns(roads: RoadLine[], project: Projector, heightAt: HeightAt): Run[] {
  const runs: Run[] = [];
  for (const road of chainRoads(roads)) {
    const pts = road.coords.map(([lon, lat]) => project(lon, lat));
    // resample every STEP_M along the line; each point is on a bridge if the segment it starts is
    const line: { x: number; z: number; bridge: boolean }[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const lenM = Math.hypot(b.x - a.x, b.y - a.y) * 10;
      const n = Math.max(1, Math.ceil(lenM / STEP_M));
      for (let k = 0; k < n; k++) line.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.y + ((b.y - a.y) * k) / n, bridge: road.bridge[i] });
    }
    const last = pts[pts.length - 1];
    line.push({ x: last.x, z: last.y, bridge: false });

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
        const h = heights.slice(start, end);
        const along = [0];
        for (let i = 1; i < run.length; i++) along.push(along[i - 1] + Math.hypot(run[i].x - run[i - 1].x, run[i].z - run[i - 1].z) * 10);
        // a bridge's deck runs straight from end to end (the point after its last segment is its far end), or on the
        // DTM where that is higher (it keeps some decks over the line); its walls stand only near the ends
        const deck = [...h];
        const onBridge = run.map(() => false);
        const interior = run.map(() => false);
        for (let a = 0; a < run.length; ) {
          if (!run[a].bridge) {
            a++;
            continue;
          }
          let b = a;
          while (b < run.length && run[b].bridge) b++;
          const far = Math.min(b, run.length - 1);
          const span = along[far] - along[a] || 1;
          for (let i = a; i <= far; i++) {
            deck[i] = Math.max(h[i], h[a] + ((h[far] - h[a]) * (along[i] - along[a])) / span);
            onBridge[i] = true;
            interior[i] = along[i] - along[a] > ABUTMENT_M && along[far] - along[i] > ABUTMENT_M;
          }
          a = b;
        }
        const stations = run.map((p, i): Station => {
          const a = run[Math.max(0, i - 1)];
          const b = run[Math.min(run.length - 1, i + 1)];
          const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          const lx = (b.z - a.z) / l;
          const lz = -(b.x - a.x) / l;
          // left edge, centreline and right edge each sit on the ground under them, so neither a side
          // slope nor ground that is convex across the road buries part of the carriageway (review R5, R11);
          // a deck is level across, except where an abutment meets a side slope
          const draped = (x: number, z: number) => {
            const g = heightAt(x, z);
            return Math.max((Number.isFinite(g) ? g : deck[i]) + LIFT, onBridge[i] ? deck[i] + LIFT : -Infinity);
          };
          const y: Station["y"] = [draped(p.x + lx * half, p.z + lz * half), deck[i] + LIFT, draped(p.x - lx * half, p.z - lz * half)];
          return { x: p.x, z: p.z, lx, lz, y, alongM: along[i], bridge: onBridge[i], interior: interior[i] };
        });
        runs.push({ half, stations });
      }
      start = end;
    }
  }
  return runs;
}

export function buildRoadMesh(roads: RoadLine[], project: Projector, heightAt: HeightAt): MeshArrays {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const { half, stations } of roadRuns(roads, project, heightAt)) {
    const base = positions.length / 3;
    for (const s of stations) [1, 0, -1].forEach((side, k) => positions.push(s.x + side * s.lx * half, s.y[k], s.z + side * s.lz * half));
    // per cross-section: left (l), centre (c), right (r); two quads per step
    for (let i = 0; i + 1 < stations.length; i++) {
      const l0 = base + 3 * i;
      const l1 = l0 + 3;
      indices.push(l0, l0 + 1, l1, l0 + 1, l1 + 1, l1, l0 + 1, l0 + 2, l1 + 1, l0 + 2, l1 + 2, l1 + 1);
    }
  }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

/** The masonry under every stretch of road that stands clear of the rendered ground; uvs in metres (along, up). */
export function buildRoadStructures(roads: RoadLine[], project: Projector, heightAt: HeightAt, ground: RoadGround): MeshArrays {
  const v = ground.ve / 10; // metres to world units, vertically
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);

  for (const run of roadRuns(roads, project, heightAt)) {
    const out = run.half + WALL_M / 10;
    const info = run.stations.map((s) => {
      const footAt = (sign: number, k: 0 | 2) => {
        const g = ground.groundAt(s.x + sign * s.lx * out, s.z + sign * s.lz * out);
        return Number.isFinite(g) ? g : s.y[k];
      };
      const foot = [footAt(1, 0), footAt(-1, 2)];
      const centre = ground.groundAt(s.x, s.z);
      const gapM = Math.max(s.y[0] - foot[0], s.y[2] - foot[1], Number.isFinite(centre) ? s.y[1] - centre : 0) / v;
      return { gapM, foot, open: s.interior || ground.openAt(s.x, s.z) };
    });

    // each stretch clear of the ground, with one station of ground either side so its ends reach down
    let i = 0;
    while (i < info.length) {
      if (info[i].gapM <= MIN_GAP_M) {
        i++;
        continue;
      }
      let j = i;
      while (j < info.length && info[j].gapM > MIN_GAP_M) j++;
      const from = Math.max(0, i - 1);
      const to = Math.min(info.length, j + 1);
      i = j;
      if (to - from < 2) continue;

      // per station and side: road edge (just under the surface), parapet or kerb top inside and out, foot outside
      const base = positions.length / 3;
      const at = (k: number, side: number, p: number) => base + 8 * (k - from) + 4 * side + p;
      for (let k = from; k < to; k++) {
        const s = run.stations[k];
        const { gapM, foot, open } = info[k];
        [1, -1].forEach((sign, side) => {
          const y = s.y[side === 0 ? 0 : 2];
          const top = y + (open || s.bridge || gapM > PARAPET_FROM_M ? PARAPET_M : KERB_M) * v;
          const bottom = open ? y - DECK_M * v : Math.min(y - DECK_M * v, foot[side] - FOOT_M * v);
          const ring: [number, number][] = [[run.half, y - 0.05 * v], [run.half, top], [out, top], [out, bottom]];
          for (const [off, h] of ring) {
            positions.push(s.x + sign * s.lx * off, h, s.z + sign * s.lz * off);
            uvs.push(s.alongM, h / v);
          }
        });
      }
      for (let k = from; k + 1 < to; k++) {
        for (const side of [0, 1]) for (let p = 0; p < 3; p++) quad(at(k, side, p), at(k, side, p + 1), at(k + 1, side, p + 1), at(k + 1, side, p));
        // the deck's underside, wherever it spans the trail or a bridge's gap
        if (info[k].open || info[k + 1].open) quad(at(k, 0, 3), at(k, 1, 3), at(k + 1, 1, 3), at(k + 1, 0, 3));
      }
      // the ends: the walls' cross-sections, and a face across under the road
      for (const k of [from, to - 1]) {
        for (const side of [0, 1]) quad(at(k, side, 0), at(k, side, 1), at(k, side, 2), at(k, side, 3));
        quad(at(k, 0, 0), at(k, 1, 0), at(k, 1, 3), at(k, 0, 3));
      }
    }
  }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices), uvs: Float32Array.from(uvs) };
}
