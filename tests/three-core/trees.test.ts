import { describe, expect, it } from "vitest";
import { bngToWgs84, wgs84ToBng } from "../../src/three-core/bng";
import type { Trail } from "../../src/three-core/trail";
import { placeTrees } from "../../src/three-core/trees";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { syntheticRoute } from "./fixtures";

// A 240 m square of woodland on a gentle slope, with an east-west tertiary road through the middle.
const route = syntheticRoute();
const { e: e0, n: n0 } = wgs84ToBng(route.routePoints[0].lon, route.routePoints[0].lat);
const cols = 60;
const rows = 60;
const dem: DemGrid = {
  cols,
  rows,
  spacingM: 4,
  originE: e0 - 120,
  originN: n0 + 120,
  heights: Float32Array.from({ length: cols * rows }, (_, i) => 150 + 0.5 * (i % cols)),
  sourceIndex: new Uint8Array(cols * rows),
  nodata: -9999,
};
const land: LandCover = { legend: ["woodland"], classes: new Uint8Array(cols * rows) };
const noTrail = { samples: [] } as unknown as Trail;
const ends = [bngToWgs84(e0 - 100, n0), bngToWgs84(e0 + 100, n0)];
const road = { coords: ends.map(({ lon, lat }) => [lon, lat] as [number, number]), highway: "tertiary" };

/** Distance in metres from a tree to the road's centreline. */
function fromRoadM(t: { x: number; z: number }): number {
  const [a, b] = ends.map(({ lon, lat }) => route.project(lon, lat));
  const vx = b.x - a.x;
  const vz = b.y - a.y;
  const u = Math.max(0, Math.min(1, ((t.x - a.x) * vx + (t.z - a.y) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(t.x - (a.x + u * vx), t.z - (a.y + u * vz)) * 10;
}

describe("placeTrees", () => {
  it("keeps every tree at least 2 m off a road carriageway (review R4)", () => {
    const all = (o: ReturnType<typeof placeTrees>) => [...o.conifer, ...o.broadleaf];
    const without = all(placeTrees(dem, land, route.project, noTrail, { probability: 1 }));
    expect(without.some((t) => fromRoadM(t) < 3 + 2), "the fixture puts trees on the road when roads are ignored").toBe(true);
    const trees = all(placeTrees(dem, land, route.project, noTrail, { probability: 1, roads: [road] }));
    expect(trees.length).toBeGreaterThan(1000);
    for (const t of trees) expect(fromRoadM(t)).toBeGreaterThanOrEqual(3 + 2);
  });

  it("stands trees on the terrain at the scene's vertical exaggeration (review R3)", () => {
    const one = placeTrees(dem, land, route.project, noTrail, { probability: 0.2 });
    const two = placeTrees(dem, land, route.project, noTrail, { probability: 0.2, ve: 2 });
    const a = [...one.conifer, ...one.broadleaf];
    const b = [...two.conifer, ...two.broadleaf];
    expect(a.length).toBeGreaterThan(100);
    expect(b.length).toBe(a.length);
    a.forEach((t, i) => {
      expect(b[i].x).toBe(t.x);
      expect(b[i].y).toBeCloseTo(2 * t.y, 6);
    });
  });
});
