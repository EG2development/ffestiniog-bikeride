import { describe, expect, it } from "vitest";
import { bngToWgs84, wgs84ToBng } from "../../src/three-core/bng";
import { placeGrass } from "../../src/three-core/grass";
import type { Trail } from "../../src/three-core/trail";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { syntheticRoute } from "./fixtures";

// Grass clumps near the trail, on grass-like land cover only (docs/adr/0054-photoreal-layer.md).

const route = syntheticRoute();
const { e: e0, n: n0 } = wgs84ToBng(route.routePoints[0].lon, route.routePoints[0].lat);
const cols = 80;
const rows = 80;
const dem: DemGrid = { cols, rows, spacingM: 4, originE: e0 - 160, originN: n0 + 160, heights: new Float32Array(cols * rows).fill(150), sourceIndex: new Uint8Array(cols * rows), nodata: -9999 };
// the west half is grassland, the east half woodland
const classes = new Uint8Array(cols * rows);
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) classes[r * cols + c] = c < cols / 2 ? 0 : 1;
const land: LandCover = { legend: ["grass/farmland", "woodland"], classes };
// a trail running north-south through the middle of the grid, 300 m long
const samples = Array.from({ length: 151 }, (_, i) => {
  const { lon, lat } = bngToWgs84(e0, n0 + 150 - i * 2);
  const p = route.project(lon, lat);
  return { x: p.x, y: 15, z: p.y, distM: 1000 + i * 2, tangent: [0, 0, 1] as [number, number, number], gradient: 0 };
});
const trail = { samples, sampleAt: () => samples[0] } as unknown as Trail;
const offTrailM = (g: { x: number; z: number }) => Math.min(...samples.map((s) => Math.hypot(s.x - g.x, s.z - g.z))) * 10;
const eastingOf = (g: { x: number; z: number }) => wgs84ToBng(route.unproject(g.x, g.z).lon, route.unproject(g.x, g.z).lat).e;

describe("placeGrass", () => {
  it("places clumps only on grass-like cover, inside the band, clear of the ribbon, and never on woodland", () => {
    const out = placeGrass(dem, land, route.project, trail, { bandM: 40, per100m2: 20, clearOfTrailM: 2 });
    expect(out.length).toBeGreaterThan(500);
    for (const g of out) {
      expect(offTrailM(g)).toBeLessThanOrEqual(40 + 4);
      expect(offTrailM(g)).toBeGreaterThanOrEqual(2 - 1e-9);
      expect(eastingOf(g), "west of the woodland boundary").toBeLessThan(e0 + 2.5);
      expect(g.y).toBeCloseTo(15, 6);
      expect(g.scale).toBeGreaterThanOrEqual(0.7);
      expect(g.tint).toBeLessThanOrEqual(1.2);
    }
  });

  it("covers only the stretch asked for, thins towards the band's edge, and is deterministic and capped", () => {
    const whole = placeGrass(dem, land, route.project, trail, { bandM: 40, per100m2: 20 });
    const part = placeGrass(dem, land, route.project, trail, { bandM: 40, per100m2: 20, alongM: [1000, 1100] });
    expect(part.length).toBeLessThan(whole.length * 0.6);
    const near = whole.filter((g) => offTrailM(g) < 15).length;
    const far = whole.filter((g) => offTrailM(g) > 30).length;
    expect(near, "the inner band is denser than the outer").toBeGreaterThan(far);
    expect(placeGrass(dem, land, route.project, trail, { bandM: 40, per100m2: 20 })).toEqual(whole);
    expect(placeGrass(dem, land, route.project, trail, { bandM: 40, per100m2: 20, maxClumps: 100 }).length).toBe(100);
    expect(placeGrass(dem, land, route.project, trail, { bandM: 40, per100m2: 20, classes: /nothing/ })).toEqual([]);
  });

  it("stands every clump on the rendered ground when given it, and drops a clump the ground does not cover (RL15)", () => {
    // the rendered ground is the bare DTM (15 units) plus a fill that grows with x: a clump on the DTM would be buried
    const groundAt = (x: number, z: number) => (x < -1e9 ? -Infinity : 15 + 0.05 * (x + 20) + 0 * z);
    const out = placeGrass(dem, land, route.project, trail, { bandM: 40, per100m2: 20, groundAt });
    const bare = placeGrass(dem, land, route.project, trail, { bandM: 40, per100m2: 20 });
    expect(out.length).toBe(bare.length);
    for (let i = 0; i < out.length; i++) {
      expect(out[i].y).toBeCloseTo(groundAt(out[i].x, out[i].z), 9);
      expect([out[i].x, out[i].z]).toEqual([bare[i].x, bare[i].z]);
    }
    expect(placeGrass(dem, land, route.project, trail, { bandM: 40, per100m2: 20, groundAt: () => -Infinity })).toEqual([]);
  });
});
