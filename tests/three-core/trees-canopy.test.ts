import { describe, expect, it } from "vitest";
import { wgs84ToBng } from "../../src/three-core/bng";
import { validateCanopyHeader, validateFeatures } from "../../src/three-core/registers";
import type { Trail } from "../../src/three-core/trail";
import { NOMINAL_TREE_HEIGHT_M, placeTrees } from "../../src/three-core/trees";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { syntheticRoute } from "./fixtures";

// Tree heights and field trees from the lidar canopy (docs/adr/0057-canopy-heights-from-lidar.md).

const route = syntheticRoute();
const { e: e0, n: n0 } = wgs84ToBng(route.routePoints[0].lon, route.routePoints[0].lat);
const cols = 40;
const rows = 40;
const dem: DemGrid = { cols, rows, spacingM: 4, originE: e0 - 80, originN: n0 + 80, heights: new Float32Array(cols * rows).fill(150), sourceIndex: new Uint8Array(cols * rows), nodata: -9999 };
// west half woodland, east half grass
const classes = new Uint8Array(cols * rows);
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) classes[r * cols + c] = c < cols / 2 ? 0 : 1;
const land: LandCover = { legend: ["woodland", "grass/farmland"], classes };
const noTrail = { samples: [] } as unknown as Trail;
const nodeOf = (t: { x: number; z: number }) => {
  const { lon, lat } = route.unproject(t.x, t.z);
  const { e, n } = wgs84ToBng(lon, lat);
  return { r: Math.round((n0 + 80 - n) / 4), c: Math.round((e - (e0 - 80)) / 4) };
};

describe("placeTrees with a canopy", () => {
  it("keeps the woodland placements where it is, drops nodes the lidar saw no tree on, and scales the rest to the measured height", () => {
    const without = placeTrees(dem, land, route.project, noTrail, { probability: 1, nearZoneM: Infinity });
    const canopy = new Float32Array(cols * rows).map((_, i) => (classes[i] === 0 ? 18 : 0)); // 18 m over the wood, nothing over the grass
    for (let r = 0; r < rows; r++) for (let c = 0; c < 5; c++) canopy[r * cols + c] = 0.5; // the five western columns were felled
    const withC = placeTrees(dem, land, route.project, noTrail, { probability: 1, nearZoneM: Infinity, canopy });
    const all = (o: ReturnType<typeof placeTrees>) => [...o.conifer, ...o.broadleaf];
    expect(all(without).length).toBeGreaterThan(600);
    expect(all(withC).length).toBeLessThan(all(without).length);
    for (const t of all(withC)) expect(nodeOf(t).c, "no tree on a felled node").toBeGreaterThanOrEqual(5);
    // every kept tree stands where the no-canopy run put one, at the canopy's height
    const key = (t: { x: number; z: number }) => `${t.x.toFixed(6)},${t.z.toFixed(6)}`;
    const before = new Set(all(without).map(key));
    for (const t of withC.conifer) {
      expect(before.has(key(t))).toBe(true);
      expect(t.scale).toBeCloseTo(18 / NOMINAL_TREE_HEIGHT_M.conifer, 6);
    }
    for (const t of withC.broadleaf) expect(t.scale).toBeCloseTo(18 / NOMINAL_TREE_HEIGHT_M.broadleaf, 6);
    expect(all(withC).every((t) => t.tint !== undefined && t.tint >= 0.85 && t.tint <= 1.15 && [0, 1, 2].includes(t.variant!))).toBe(true);
  });

  it("grows a field tree outside OSM woodland where the canopy peaks above the field-tree height, and nowhere else", () => {
    const canopy = new Float32Array(cols * rows).fill(0);
    // one 9 m tree in the grass at node (10, 30) with a 2 m skirt around it, a 4 m bush at (30, 30)
    const at = (r: number, c: number, h: number) => (canopy[r * cols + c] = h);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) at(10 + dr, 30 + dc, 2);
    at(10, 30, 9);
    at(30, 30, 4);
    const out = placeTrees(dem, land, route.project, noTrail, { probability: 0, nearZoneM: Infinity, canopy });
    expect(out.conifer).toEqual([]);
    expect(out.broadleaf.length).toBe(1);
    const t = out.broadleaf[0];
    expect(nodeOf(t)).toEqual({ r: 10, c: 30 });
    expect(t.scale).toBeCloseTo(9 / NOMINAL_TREE_HEIGHT_M.broadleaf, 6);
    // the field tree's draws do not shift the woodland's: with probability 1 the woodland placements match the run without a canopy
    const wood = placeTrees(dem, land, route.project, noTrail, { probability: 1, nearZoneM: Infinity });
    const both = placeTrees(dem, land, route.project, noTrail, { probability: 1, nearZoneM: Infinity, canopy: new Float32Array(cols * rows).fill(12).map((v, i) => (classes[i] === 0 ? v : canopy[i])) });
    expect(both.conifer.map((t) => [t.x, t.z])).toEqual(wood.conifer.map((t) => [t.x, t.z]));
    expect(both.broadleaf.length).toBe(wood.broadleaf.length + 1);
  });

  it("refuses a canopy that is not on the DEM's grid", () => {
    expect(() => placeTrees(dem, land, route.project, noTrail, { canopy: new Float32Array(10) })).toThrow(/canopy has 10 values/);
    const demHeader = { cols, rows, spacingM: 4, originE: dem.originE, originN: dem.originN };
    expect(validateCanopyHeader({ ...demHeader, file: "canopy.f32" }, "canopy.json", demHeader).file).toBe("canopy.f32");
    expect(() => validateCanopyHeader({ ...demHeader, cols: 41, file: "canopy.f32" }, "canopy.json", demHeader)).toThrow(/canopy.json.cols: canopy grid differs/);
    expect(() => validateCanopyHeader({ ...demHeader, file: "../x.f32" }, "canopy.json", demHeader)).toThrow(/plain file name/);
  });

  it("a barrier is a register kind (ADR 58)", () => {
    const [f] = validateFeatures([{ id: "barrier-t-1", kind: "barrier", category: "approximate", source: { type: "osm", ref: "way/1" }, scenes: ["Section-t"] }]);
    expect(f.kind).toBe("barrier");
  });
});
