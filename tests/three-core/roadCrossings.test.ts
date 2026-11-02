import { describe, expect, it } from "vitest";
import { crossingGround, meetTrail, OVERBRIDGE_CLEAR_M, type TrailFoot } from "../../src/three-core/roadCrossings";
import { layRoads, type RoadLine } from "../../src/three-core/roads";

// Roads meeting the trail (src/three-core/roadCrossings.ts): a road over a mapped overbridge clears the trail with a
// railway's headroom, a road crossing on the level is flush with the trail, and nothing else moves.

// A trail along z = 0 (world units, 1 = 10 m), its surface at y = 18 (180 m), distances in metres along x.
const project = (lon: number, lat: number) => ({ x: lon * 1000, y: lat * 1000 });
const trailAt = (x: number, z: number): TrailFoot | null => (Math.abs(z) < 2 ? { lateral: Math.abs(z), distM: x * 10, level: 18 } : null);
const TRAIL = 18;
// a road crossing the trail square at x = 5 (50 m), its own ground `h` everywhere
const crossing = (h: number): RoadLine => ({ coords: [[0.005, -0.004], [0.005, 0.004]], highway: "unclassified" });
const lay = (h: number) => layRoads([crossing(h)], project, () => h, { ve: 1 });
const at = (stations: { z: number; y: number }[], z: number) => stations.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a));

describe("meetTrail", () => {
  it("brings a road crossing on the level flush with the trail, eased back to its own level", () => {
    const before = lay(TRAIL + 0.06).runs[0].stations; // 0.6 m above the trail: the slab the film showed
    const { layout, crossings } = meetTrail(lay(TRAIL + 0.06), { trailAt, overbridges: [], bridges: [] });
    const after = layout.runs[0].stations;
    expect(crossings).toEqual([expect.objectContaining({ kind: "level", distM: 50 })]);
    // within 2 cm of the trail's surface wherever it crosses the 3 m path
    for (const s of after) if (Math.abs(s.z) * 10 <= 1.5) expect(Math.abs(s.y - TRAIL) * 10).toBeLessThan(0.02);
    // marked, so the ground under it is graded to it in the trail's corridor
    expect(after.filter((s) => s.crossing).length).toBeGreaterThan(0);
    // its own level again beyond the easing, and no step anywhere: under 1 in 6 between stations
    expect(at(after, 3.5).y).toBeCloseTo(at(before, 3.5).y, 6);
    for (let i = 1; i < after.length; i++) expect(Math.abs(after[i].y - after[i - 1].y) / Math.hypot(after[i].x - after[i - 1].x, after[i].z - after[i - 1].z)).toBeLessThan(1 / 6);
  });

  it("raises a mapped overbridge's deck until its soffit clears the trail by the headroom, and never lowers one", () => {
    const low = meetTrail(lay(TRAIL + 0.17), { trailAt, overbridges: [[45, 55]], bridges: [] });
    const deck = at(low.layout.runs[0].stations, 0);
    expect((deck.y - TRAIL) * 10).toBeGreaterThanOrEqual(OVERBRIDGE_CLEAR_M + 0.9 - 1e-6);
    expect(low.crossings[0]).toMatchObject({ kind: "overbridge" });
    // a deck already high enough is left as it is
    const high = meetTrail(lay(TRAIL + 0.7), { trailAt, overbridges: [[45, 55]], bridges: [] });
    expect(high.crossings).toEqual([]);
    expect(at(high.layout.runs[0].stations, 0).y).toBeCloseTo(at(lay(TRAIL + 0.7).runs[0].stations, 0).y, 9);
  });

  it("leaves alone roads under the line's own bridges, roads far above or below it, and roads away from it", () => {
    for (const [h, opts] of [
      [TRAIL + 0.06, { overbridges: [], bridges: [[45, 55]] }],
      [TRAIL + 0.4, { overbridges: [], bridges: [] }],
      [TRAIL - 0.4, { overbridges: [], bridges: [] }],
    ] as [number, { overbridges: [number, number][]; bridges: [number, number][] }][]) {
      const { layout, crossings } = meetTrail(lay(h), { trailAt, ...opts });
      expect(crossings).toEqual([]);
      expect(layout.runs[0].stations.map((s) => s.y)).toEqual(lay(h).runs[0].stations.map((s) => s.y));
    }
    const away = layRoads([{ coords: [[0.005, 0.003], [0.009, 0.003]], highway: "track" }], project, () => TRAIL + 0.06, { ve: 1 });
    expect(meetTrail(away, { trailAt, overbridges: [], bridges: [] }).crossings).toEqual([]);
  });

  it("marks the ground under a level crossing's carriageway, and no other", () => {
    const { layout } = meetTrail(lay(TRAIL + 0.06), { trailAt, overbridges: [], bridges: [] });
    const under = crossingGround(layout, 1.5);
    expect(under(5, 0)).toBe(true);
    // 6 m from its centreline: past its 2.25 m half-width and 1.5 m verge
    expect(under(5.6, 0)).toBe(false);
  });
});
