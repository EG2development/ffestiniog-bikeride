import { describe, expect, it } from "vitest";
import { bngToWgs84, wgs84ToBng } from "../../src/three-core/bng";
import type { Trail } from "../../src/three-core/trail";
import { CROWN_SHAPES, CROWN_SPHERES, placeTrees } from "../../src/three-core/trees";
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

  it("RL13: keeps near-zone woodland between 1 and 15 trees per 100 m² and plants none beyond 300 m (ADR 37)", () => {
    // a 240 m × 1000 m grid with the trail along its centre row: woodland within 400 m of the trail, so part of it is beyond the near zone
    const wCols = 60;
    const wRows = 250;
    const wide: DemGrid = { ...dem, cols: wCols, rows: wRows, originE: e0 - 120, originN: n0 + 500, heights: new Float32Array(wCols * wRows).fill(150), sourceIndex: new Uint8Array(wCols * wRows) };
    const classes = new Uint8Array(wCols * wRows).fill(1);
    for (let r = 0; r < wRows; r++) if (Math.abs(n0 + 500 - r * 4 - n0) <= 400) for (let c = 0; c < wCols; c++) classes[r * wCols + c] = 0;
    const wood: LandCover = { legend: ["woodland", "grassland"], classes };
    const samples = Array.from({ length: 121 }, (_, i) => {
      const { lon, lat } = bngToWgs84(e0 - 120 + i * 2, n0);
      const p = route.project(lon, lat);
      return { x: p.x, z: p.y };
    });
    const trail = { samples } as unknown as Trail;
    const out = placeTrees(wide, wood, route.project, trail, { nearZoneM: 300, density: [1, 15] } as unknown as Parameters<typeof placeTrees>[4]);
    const trees = [...out.conifer, ...out.broadleaf];
    // perpendicular distance (m) to the trail line, which the rotated projection doesn't align with an axis
    const a = samples[0];
    const b = samples[samples.length - 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const offTrailM = (t: { x: number; z: number }) => (Math.abs((b.x - a.x) * (a.z - t.z) - (a.x - t.x) * (b.z - a.z)) / len) * 10;
    const near = trees.filter((t) => offTrailM(t) <= 300);
    const far = trees.filter((t) => offTrailM(t) > 300);
    expect(far.length, "trees beyond the 300 m near zone").toBe(0);
    const nearWoodM2 = 240 * 600; // the woodland strip inside the near zone
    const per100 = near.length / (nearWoodM2 / 100);
    expect(per100).toBeGreaterThanOrEqual(1);
    expect(per100).toBeLessThanOrEqual(15);
  });

  it("R2 (t10): caps trees per kind and spreads them over the whole woodland instead of filling the first rows", () => {
    const wCols = 60;
    const wRows = 250;
    const wide: DemGrid = { ...dem, cols: wCols, rows: wRows, originE: e0 - 120, originN: n0 + 500, heights: new Float32Array(wCols * wRows).fill(150), sourceIndex: new Uint8Array(wCols * wRows) };
    const wood: LandCover = { legend: ["woodland"], classes: new Uint8Array(wCols * wRows) };
    const out = placeTrees(wide, wood, route.project, noTrail, { maxTrees: 500, nearZoneM: Infinity } as unknown as Parameters<typeof placeTrees>[4]);
    expect(out.conifer.length).toBeLessThanOrEqual(500);
    expect(out.broadleaf.length).toBeLessThanOrEqual(500);
    expect(out.conifer.length + out.broadleaf.length, "the cap is per kind, so both kinds are placed").toBeGreaterThan(600);
    // spread: trees reach at least the last tenth of the rows (north-west node row 0 to the south end)
    const trees = [...out.conifer, ...out.broadleaf];
    const rowOf = (t: { x: number; z: number }) => {
      // the grid's rows run north to south; recover the row from the tree's BNG northing
      const { lon, lat } = route.unproject(t.x, t.z);
      return (n0 + 500 - wgs84ToBng(lon, lat).n) / 4;
    };
    const rows = trees.map(rowOf);
    expect(Math.max(...rows)).toBeGreaterThan(wRows * 0.9);
    expect(Math.min(...rows)).toBeLessThan(wRows * 0.1);
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

// Trees stay out of the follow-camera corridor (spec CL5; ADR 47; pseudocode-reel-v2 §4.5).
describe("placeTrees keep-out corridor", () => {
  it("places no tree within rM of a keep-out segment", () => {
    const [a, b] = ends.map(({ lon, lat }) => route.project(lon, lat));
    const seg = { a: { x: a.x, z: a.y }, b: { x: b.x, z: b.y }, rM: 20 };
    const all = (o: ReturnType<typeof placeTrees>) => [...o.conifer, ...o.broadleaf];
    const before = all(placeTrees(dem, land, route.project, noTrail, { probability: 1 }));
    expect(before.some((t) => fromRoadM(t) < 20), "the fixture has trees inside the corridor without keep-out").toBe(true);
    const after = all(placeTrees(dem, land, route.project, noTrail, { probability: 1, keepOut: [seg] } as Parameters<typeof placeTrees>[4]));
    expect(after.length).toBeGreaterThan(500);
    expect(after.filter((t) => fromRoadM(t) < 20)).toEqual([]);
  });
});

describe("crown spheres enclose the crowns as drawn (CL5; t10 H1)", () => {
  const inside = (p: [number, number, number], spheres: { y: number; r: number }[]) => spheres.some((c) => Math.hypot(p[0], p[1] - c.y, p[2]) <= c.r + 1e-9);
  it("covers every point of the conifer cone, apex included", () => {
    const { baseY, apexY, radius } = CROWN_SHAPES.conifer;
    for (let y = baseY; y <= apexY + 1e-9; y += 0.005) {
      const r = (radius * (apexY - y)) / (apexY - baseY);
      for (let a = 0; a < 2 * Math.PI; a += Math.PI / 12) expect(inside([r * Math.cos(a), y, r * Math.sin(a)], CROWN_SPHERES.conifer), `cone at y ${y.toFixed(3)}`).toBe(true);
    }
  });
  it("covers the broadleaf crown's circumscribed ellipsoid", () => {
    const { centreY, radius, yScale } = CROWN_SHAPES.broadleaf;
    for (let t = 0; t <= Math.PI; t += Math.PI / 24)
      for (let a = 0; a < 2 * Math.PI; a += Math.PI / 12)
        expect(inside([radius * Math.sin(t) * Math.cos(a), centreY + radius * yScale * Math.cos(t), radius * Math.sin(t) * Math.sin(a)], CROWN_SPHERES.broadleaf)).toBe(true);
  });
});
