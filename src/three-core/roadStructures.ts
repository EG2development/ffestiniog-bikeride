import type { HeightAt } from "./camera";
import { levelAt, type RoadLayout, type Station } from "./roads";
import type { MeshArrays } from "./types";

/** What a road stands on: the rendered ground, and where it passes over the trail. */
export type RoadGround = {
  /** the rendered ground (the terrain mesh's own surface) */
  groundAt: HeightAt;
  /** true over the trail's clearance, which a road's structure spans instead of walling off */
  openAt: (x: number, z: number) => boolean;
  ve: number;
};

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
