import type { HeightAt } from "./camera";
import type { MeshArrays, Projector } from "./types";

// OSM roads as smooth carriageways on graded ground (docs/design-3d.md D10). Widths are typical carriageway widths by
// highway class, not surveyed. The line is a centripetal Catmull-Rom curve through the OSM nodes (the mapped
// positions are kept, the corners between them rounded); the long profile is the ground's, smoothed along the road;
// the cross-section is a crowned carriageway, level across. The ground is then graded to the road (gradeToRoads), so
// the road is never draped over the 4 m grid's bumps and needs no walls to stand on, except at its bridges.

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
const STEP_M = 2;
const SMOOTH_M = 6; // the long profile's smoothing (a Gaussian's sigma): the DTM's 4 m grid noise, not the road's hills
const CROSSFALL = 0.025; // the crown: each half falls 1 in 40 to its edge
const JOIN_M = 20; // a side road eases into the level of the road it joins over this length
const LIFT_M = 0.05; // the surface over the ground graded under it
const DRAPE_LIFT_M = 0.3; // a road on ungraded ground: each edge this far over the ground under it, so the 4 m mesh never hides it
const BED_M = 0.1; // the ground is graded this far under the surface
const VERGE_M = 1.5; // level ground beyond each edge
const BATTER = 0.5; // the cuttings' and embankments' side slopes (1 in 2)
const BATTER_REACH_M = 20; // past the verge, no grading (a higher cut or fill than 10 m is a bridge's or a wall's)
const SEAT_M = 6; // a road raised onto ground the grading could not level eases up and down over this length
const UNDER_M = 3; // the grid reads the gap under a span up to this much high; a lower ground there is a stream's or a field's
const UNDER_REACH_M = 16; // and the approaches high for about two of its 4 m cells' diagonals either side

// A road clear of the rendered ground keeps its level and stands on a generic masonry structure, like the railway's
// bridges (ADR 12): a deck over the trail or a bridge way's gap, walls into the ground where the trail's grading leaves
// it short, and parapets where the drop is high. Metres.
const MIN_GAP_M = 0.6; // higher than this above the ground, a road gets its structure
const PARAPET_FROM_M = 2;
const PARAPET_M = 1.0;
const KERB_M = 0.1;
const WALL_M = 0.4;
const DECK_M = 0.9;
const FOOT_M = 0.3; // walls run this far into the ground
const ABUTMENT_M = 2; // a bridge way is walled this far in from each end, and open between

// Typical UK markings (Traffic Signs Manual ch. 5): a 100 mm centre line, 4 m marks with 8 m gaps, where the carriageway
// is at least 5.5 m wide; 100 mm edge lines on the main roads, set in from the edge.
const LINE_M = 0.1;
const MARK_M = 4;
const GAP_M = 8;
const CENTRE_LINE_FROM_M = 5.5;
const EDGE_LINES = new Set(["motorway", "trunk", "trunk_link", "primary", "primary_link"]);
const EDGE_INSET_M = 0.25;
const PAINT_M = 0.015; // over the surface

export const roadWidthM = (highway: string) => WIDTH_M[highway] ?? 3;

type Station = {
  x: number;
  z: number;
  lx: number;
  lz: number;
  /** the centreline's level (the crown) */
  y: number;
  /** a draped road's edge levels (left, right), where the ground is not graded to it */
  edges?: [number, number];
  alongM: number;
  /** on a bridge way (its far end included) */
  bridge: boolean;
  /** on a bridge way, more than ABUTMENT_M from either end of it */
  interior: boolean;
};
type Run = { highway: string; half: number; stations: Station[] };
/** Every road laid out: its runs of cross-sections, and the vertical exaggeration they were laid at. */
export type RoadLayout = { runs: Run[]; ve: number };
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

type P = { x: number; y: number };

/** The centripetal Catmull-Rom curve from b to c (a and d the nodes either side) at u in [0, 1]: it passes through
 * every node and never loops or overshoots on a tight corner. */
function catmullRom(a: P, b: P, c: P, d: P, u: number): P {
  const knot = (p: P, q: P) => Math.max(Math.sqrt(Math.hypot(q.x - p.x, q.y - p.y)), 1e-6);
  const t1 = knot(a, b);
  const t2 = t1 + knot(b, c);
  const t3 = t2 + knot(c, d);
  const t = t1 + u * (t2 - t1);
  const lerp = (p: P, q: P, t0: number, t1_: number): P => ({ x: ((t1_ - t) * p.x + (t - t0) * q.x) / (t1_ - t0), y: ((t1_ - t) * p.y + (t - t0) * q.y) / (t1_ - t0) });
  const a1 = lerp(a, b, 0, t1);
  const a2 = lerp(b, c, t1, t2);
  const a3 = lerp(c, d, t2, t3);
  const b1 = lerp(a1, a2, 0, t2);
  const b2 = lerp(a2, a3, t1, t3);
  return lerp(b1, b2, t1, t2);
}

/** A profile smoothed along the road: a Gaussian of SMOOTH_M over distance, its ends held. */
function smoothProfile(h: number[], along: number[]): number[] {
  return h.map((_, i) => {
    let sum = 0;
    let weight = 0;
    for (let j = i; j >= 0 && along[i] - along[j] <= 3 * SMOOTH_M; j--) {
      const w = Math.exp(-(((along[i] - along[j]) / SMOOTH_M) ** 2) / 2);
      sum += w * h[j];
      weight += w;
    }
    for (let j = i + 1; j < h.length && along[j] - along[i] <= 3 * SMOOTH_M; j++) {
      const w = Math.exp(-(((along[j] - along[i]) / SMOOTH_M) ** 2) / 2);
      sum += w * h[j];
      weight += w;
    }
    return sum / weight;
  });
}

/**
 * Every road as runs of cross-sections every STEP_M along its curve, where there is terrain under it. `heightAt` is the
 * road's ground (its real level). Where `keep` is true the ground is not graded to the road (the trail's corridor), so
 * the road there never sinks below `heightAt`. Where `under` gives a point the road passes beneath the line's own
 * bridge (`lateral`: how far off the line's centre; `ground`: the lidar's level under the span, if known): the grid
 * blurs the narrow gap under a deck with the embankment either side, so the road dips to the span's ground where it
 * crosses the line (where that is within UNDER_M below the grid's level), easing back to its own level either side.
 */
export function layRoads(
  roads: RoadLine[],
  project: Projector,
  heightAt: HeightAt,
  opts: { ve: number; keep?: (x: number, z: number) => boolean; under?: (x: number, z: number) => { lateral: number; ground?: number } | null; drape?: boolean },
): RoadLayout {
  const runs: Run[] = [];
  const v = opts.ve / 10; // metres to world units, vertically
  for (const road of chainRoads(roads)) {
    const pts = road.coords.map(([lon, lat]) => project(lon, lat));
    // the curve through the nodes, every STEP_M or less; each point is on a bridge if the segment it starts is
    const line: { x: number; z: number; bridge: boolean }[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i - 1] ?? { x: 2 * pts[0].x - pts[1].x, y: 2 * pts[0].y - pts[1].y };
      const d = pts[i + 2] ?? { x: 2 * pts[i + 1].x - pts[i].x, y: 2 * pts[i + 1].y - pts[i].y };
      const n = Math.max(1, Math.ceil((Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) * 10) / STEP_M));
      for (let k = 0; k < n; k++) {
        const p = catmullRom(a, pts[i], pts[i + 1], d, k / n);
        line.push({ x: p.x, z: p.y, bridge: road.bridge[i] });
      }
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
        const smooth = smoothProfile(deck, along);
        // under the line's bridge: down to the lidar's ground under the span where the road crosses the line, eased in
        // and out over UNDER_REACH_M either way (the grid reads the narrow gap and the approaches high)
        const below = run.map((p) => opts.under?.(p.x, p.z) ?? null);
        for (let a = 0; a < run.length; ) {
          if (!below[a]) {
            a++;
            continue;
          }
          let k = a;
          let b = a;
          for (; b < run.length && below[b]; b++) if (below[b]!.lateral < below[k]!.lateral) k = b;
          const ground = below[k]!.ground;
          const drop = ground === undefined ? 0 : smooth[k] - ground;
          if (drop > 0 && drop <= UNDER_M * v)
            for (let i = 0; i < run.length; i++) {
              const t = Math.abs(along[i] - along[k]) / UNDER_REACH_M;
              if (t < 1) smooth[i] -= drop * (1 - t * t) ** 2;
            }
          a = b;
        }
        const stations = run.map((p, i): Station => {
          const a = run[Math.max(0, i - 1)];
          const b = run[Math.min(run.length - 1, i + 1)];
          const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          const [lx, lz] = [(b.z - a.z) / l, -(b.x - a.x) / l];
          // where the ground stays as it is, the carriageway (its edges a crossfall below the crown) must clear it
          let held = -Infinity;
          for (const side of [0, 1, -1]) {
            const [qx, qz] = [p.x + side * lx * half, p.z + side * lz * half];
            if (opts.keep?.(qx, qz)) held = Math.max(held, (side === 0 ? deck[i] : heightAt(qx, qz)) + CROSSFALL * Math.abs(side) * half * 10 * v);
          }
          const station = { x: p.x, z: p.z, lx, lz, y: Math.max(smooth[i], held) + LIFT_M * v, alongM: along[i], bridge: onBridge[i], interior: interior[i] };
          if (!opts.drape) return station;
          // ungraded ground (the browser's proof of concept): each edge on the ground under it, a deck level across
          const draped = (side: number) => {
            const g = heightAt(p.x + side * lx * half, p.z + side * lz * half);
            return Math.max((Number.isFinite(g) ? g : deck[i]) + DRAPE_LIFT_M * v, onBridge[i] ? deck[i] + DRAPE_LIFT_M * v : -Infinity);
          };
          return { ...station, y: deck[i] + DRAPE_LIFT_M * v, edges: [draped(1), draped(-1)] as [number, number] };
        });
        runs.push({ highway: road.highway, half, stations });
      }
      start = end;
    }
  }
  // a road ending on another's carriageway (a junction) meets it at that road's surface, eased in over its last JOIN_M
  const on = roadIndex({ runs, ve: opts.ve }, 0);
  for (const run of opts.drape ? [] : runs) {
    for (const end of [0, run.stations.length - 1]) {
      const s = run.stations[end];
      const hosts = on(s.x, s.z).filter((r) => r.run !== run && r.beyond <= 0 && !r.s.interior);
      if (hosts.length === 0) continue;
      const target = Math.max(...hosts.map((h) => levelAt(h.s, h.run.half, Math.min(1, h.lateral / h.run.half), opts.ve)));
      const lift = target - s.y;
      for (const t of run.stations) {
        const d = Math.abs(t.alongM - s.alongM) / JOIN_M;
        if (d < 1) t.y += lift * (1 - d * d * (3 - 2 * d));
      }
    }
  }
  return { runs, ve: opts.ve };
}

/** The surface's level at `side` (-1 to 1 of the half-width, + left) across a station: the crown, falling to each edge. */
const levelAt = (s: Station, half: number, side: number, ve: number) =>
  s.edges ? s.y + (s.edges[side > 0 ? 0 : 1] - s.y) * Math.abs(side) : s.y - CROSSFALL * Math.abs(side) * half * ve;

/** The carriageways; uvs in metres (across from the centreline, along). */
export function buildRoadMesh(layout: RoadLayout): MeshArrays {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const { half, stations } of layout.runs) {
    const base = positions.length / 3;
    for (const s of stations) {
      for (const side of [1, 0, -1]) {
        positions.push(s.x + side * s.lx * half, levelAt(s, half, side, layout.ve), s.z + side * s.lz * half);
        uvs.push(-side * half * 10, s.alongM);
      }
    }
    // per cross-section: left (l), centre (c), right (r); two quads per step
    for (let i = 0; i + 1 < stations.length; i++) {
      const l0 = base + 3 * i;
      const l1 = l0 + 3;
      indices.push(l0, l0 + 1, l1, l0 + 1, l1 + 1, l1, l0 + 1, l0 + 2, l1 + 1, l0 + 2, l1 + 2, l1 + 1);
    }
  }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices), uvs: Float32Array.from(uvs) };
}

/** The painted lines: centre lines (dashed) and edge lines (solid), as thin strips just over the surface. */
export function buildRoadMarkings(layout: RoadLayout): MeshArrays {
  const positions: number[] = [];
  const indices: number[] = [];
  const v = layout.ve / 10;
  for (const { highway, half, stations } of layout.runs) {
    const widthM = half * 20;
    // each line: its offset across (in half-widths) and whether it is dashed
    const lines: [number, boolean][] = [];
    if (widthM >= CENTRE_LINE_FROM_M) lines.push([0, true]);
    if (EDGE_LINES.has(highway)) lines.push([1 - (EDGE_INSET_M * 2) / widthM, false], [-(1 - (EDGE_INSET_M * 2) / widthM), false]);
    const w = LINE_M / 2 / 10 / half; // the line's half-width, in half-widths
    for (const [off, dashed] of lines) {
      // painted along [a, b] metres: a strip of quads through the stations between, cut at its ends
      const paint = (a: number, b: number) => {
        const at = (m: number) => {
          let i = 0;
          while (i + 2 < stations.length && stations[i + 1].alongM < m) i++;
          const s0 = stations[i];
          const s1 = stations[i + 1];
          const t = Math.min(1, Math.max(0, (m - s0.alongM) / (s1.alongM - s0.alongM || 1)));
          const mix = (p: number, q: number) => p + (q - p) * t;
          return { x: mix(s0.x, s1.x), z: mix(s0.z, s1.z), lx: mix(s0.lx, s1.lx), lz: mix(s0.lz, s1.lz), y: mix(s0.y, s1.y), alongM: m, bridge: false, interior: false };
        };
        const cuts = [a, ...stations.filter((s) => s.alongM > a && s.alongM < b).map((s) => s.alongM), b];
        const base = positions.length / 3;
        for (const m of cuts) {
          const s = at(m);
          for (const side of [off + w, off - w]) positions.push(s.x + side * s.lx * half, levelAt(s, half, side, layout.ve) + PAINT_M * v, s.z + side * s.lz * half);
        }
        for (let k = 0; k + 1 < cuts.length; k++) {
          const q = base + 2 * k;
          indices.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
        }
      };
      const length = stations[stations.length - 1].alongM;
      if (!dashed) paint(0, length);
      else for (let m = GAP_M / 2; m < length; m += MARK_M + GAP_M) paint(m, Math.min(length, m + MARK_M));
    }
  }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

/** The station segment nearest each point, with how far across from it, for grading the ground to the roads. */
function roadIndex(layout: RoadLayout, reach: number) {
  const segs: { run: Run; a: Station; b: Station }[] = [];
  for (const run of layout.runs) for (let i = 0; i + 1 < run.stations.length; i++) segs.push({ run, a: run.stations[i], b: run.stations[i + 1] });
  const cell = 1;
  const grid = new Map<string, number[]>();
  segs.forEach(({ run, a, b }, i) => {
    const r = reach + run.half;
    for (let x = Math.floor((Math.min(a.x, b.x) - r) / cell); x <= Math.floor((Math.max(a.x, b.x) + r) / cell); x++) {
      for (let z = Math.floor((Math.min(a.z, b.z) - r) / cell); z <= Math.floor((Math.max(a.z, b.z) + r) / cell); z++) {
        const list = grid.get(`${x},${z}`);
        if (list) list.push(i);
        else grid.set(`${x},${z}`, [i]);
      }
    }
  });
  /** Every carriageway within `reach` of its edge, each at its nearest point: the station there and how far out it lies. */
  return (x: number, z: number) => {
    const found = new Map<Run, { run: Run; s: Station; lateral: number; beyond: number }>();
    for (const i of grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []) {
      const { run, a, b } = segs[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, len2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / len2 : 0));
      const lateral = Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz));
      if (lateral - run.half > reach || (found.get(run)?.lateral ?? Infinity) <= lateral) continue;
      const mix = (p: number, q: number) => p + (q - p) * t;
      found.set(run, { run, s: { ...a, y: mix(a.y, b.y), interior: a.interior && b.interior }, lateral, beyond: lateral - run.half });
    }
    return [...found.values()];
  };
}

/**
 * The ground graded to the roads, as earthworks are: under the carriageway to its surface less a bed, level out to the
 * verge, and beyond it into the band between 1 in 2 batters falling and rising from the verge's edge (a cutting's
 * sides, an embankment's), leaving ground already within that band as it is. The verge is at least the terrain grid's
 * diagonal, so every triangle under a carriageway's edge is level with it (on the aerial windows' 16 m grid too, whose
 * triangles otherwise rise through the road between graded and ungraded nodes); where verges overlap the ground takes
 * the higher road. Not where `keep` is true (the trail's corridor, graded to the trail) nor under a bridge's span.
 * Returns new positions; the input's are not changed.
 */
export function gradeToRoads(positions: Float32Array, layout: RoadLayout, opts: { spacingM: number; keep: (x: number, z: number) => boolean }): Float32Array {
  const v = layout.ve / 10;
  const vergeM = Math.max(VERGE_M, opts.spacingM * Math.SQRT2);
  const near = roadIndex(layout, (vergeM + BATTER_REACH_M) / 10);
  const out = Float32Array.from(positions);
  for (let i = 0; i < out.length; i += 3) {
    const x = out[i];
    const z = out[i + 2];
    const roads = near(x, z);
    if (roads.length === 0 || roads.some((r) => r.s.interior && r.beyond <= 0) || opts.keep(x, z)) continue;
    const level = (r: (typeof roads)[number]) => levelAt(r.s, r.run.half, Math.min(1, r.lateral / r.run.half), layout.ve) - (LIFT_M + BED_M) * v;
    // under a carriageway, its level (the higher, where two cross); on a verge, the nearest road's
    const under = roads.filter((r) => r.beyond <= 0 && !r.s.interior);
    if (under.length > 0) {
      out[i + 1] = Math.max(...under.map(level));
      continue;
    }
    const road = roads.reduce((a, b) => (b.beyond < a.beyond ? b : a));
    if (road.beyond * 10 <= vergeM && !road.s.interior) {
      out[i + 1] = level(road);
      continue;
    }
    if (road.s.interior) continue;
    const batter = BATTER * (road.beyond * 10 - vergeM) * v;
    out[i + 1] = Math.min(level(road) + batter, Math.max(level(road) - batter, out[i + 1]));
  }
  return out;
}

/**
 * Every road seated on the rendered ground, after grading: where the ground still rises above a cross-section (two
 * roads too close for the grid to grade to both, a junction's mouth), the road is raised onto it, LIFT_M clear at its
 * centre and edges. The raise is eased along the road over SEAT_M either way, so it adds no step. Returns a new layout.
 */
export function seatRoads(layout: RoadLayout, groundAt: HeightAt): RoadLayout {
  const v = layout.ve / 10;
  const runs = layout.runs.map((run) => {
    const need = run.stations.map((s) => {
      let lift = 0;
      for (const side of [1, 0, -1]) {
        const g = groundAt(s.x + side * s.lx * run.half, s.z + side * s.lz * run.half);
        if (Number.isFinite(g)) lift = Math.max(lift, g + LIFT_M * v - levelAt(s, run.half, side, layout.ve));
      }
      return lift;
    });
    // the largest raise within SEAT_M either way, then smoothed: never less than a station needs, and no step
    const along = run.stations.map((s) => s.alongM);
    const reach = (i: number, f: (j: number) => void) => {
      for (let j = i; j >= 0 && along[i] - along[j] <= SEAT_M; j--) f(j);
      for (let j = i + 1; j < along.length && along[j] - along[i] <= SEAT_M; j++) f(j);
    };
    const held = need.map((_, i) => {
      let most = 0;
      reach(i, (j) => (most = Math.max(most, need[j])));
      return most;
    });
    const eased = held.map((_, i) => {
      let sum = 0;
      let n = 0;
      reach(i, (j) => ((sum += held[j]), n++));
      return Math.max(need[i], sum / n);
    });
    return { ...run, stations: run.stations.map((s, i) => (eased[i] > 0 ? { ...s, y: s.y + eased[i], ...(s.edges && { edges: [s.edges[0] + eased[i], s.edges[1] + eased[i]] as [number, number] }) } : s)) };
  });
  return { runs, ve: layout.ve };
}

/** The masonry under every stretch of road that stands clear of the rendered ground; uvs in metres (along, up). */
export function buildRoadStructures(layout: RoadLayout, ground: RoadGround): MeshArrays {
  const v = ground.ve / 10; // metres to world units, vertically
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);

  for (const run of layout.runs) {
    const out = run.half + WALL_M / 10;
    const edge = (s: Station, sign: number) => levelAt(s, run.half, sign, ground.ve);
    const info = run.stations.map((s) => {
      const footAt = (sign: number) => {
        const g = ground.groundAt(s.x + sign * s.lx * out, s.z + sign * s.lz * out);
        return Number.isFinite(g) ? g : edge(s, sign);
      };
      const foot = [footAt(1), footAt(-1)];
      const centre = ground.groundAt(s.x, s.z);
      const gapM = Math.max(edge(s, 1) - foot[0], edge(s, -1) - foot[1], Number.isFinite(centre) ? s.y - centre : 0) / v;
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
          const y = edge(s, sign);
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
