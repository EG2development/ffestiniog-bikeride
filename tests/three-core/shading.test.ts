import { describe, expect, it } from "vitest";
import { buildTerrainMesh } from "../../src/three-core/dem";
import type { DemGrid, LandCover, MeshArrays } from "../../src/three-core/types";
import { load } from "./pending";
import { syntheticRoute } from "./fixtures";
import { wgs84ToBng } from "../../src/three-core/bng";

// Relief shading from slope and height, without textures (spec RL10; ADR 31).
type Mod = { shadeTerrain: (mesh: MeshArrays, grid: DemGrid) => MeshArrays };

function grid(heightOf: (r: number, c: number) => number): { grid: DemGrid; land: LandCover } {
  const route = syntheticRoute();
  const { e, n } = wgs84ToBng(route.routePoints[0].lon, route.routePoints[0].lat);
  const cols = 20;
  const rows = 20;
  const heights = Float32Array.from({ length: cols * rows }, (_, i) => heightOf(Math.floor(i / cols), i % cols));
  return {
    grid: { cols, rows, spacingM: 4, originE: e - 40, originN: n + 40, heights, sourceIndex: new Uint8Array(cols * rows), nodata: -9999 },
    land: { legend: ["grassland"], classes: new Uint8Array(cols * rows) },
  };
}

describe("shadeTerrain (RL10)", () => {
  it("leaves positions alone and keeps every colour channel in [0, 1]", async () => {
    const { shadeTerrain } = await load<Mod>("src/three-core/shading.ts");
    const { grid: g, land } = grid((r, c) => 150 + 4 * r + 2 * c);
    const mesh = buildTerrainMesh(g, land, syntheticRoute().project, 1);
    const shaded = shadeTerrain(mesh, g);
    expect(Array.from(shaded.positions)).toEqual(Array.from(mesh.positions));
    expect(shaded.colors).toBeDefined();
    for (const v of shaded.colors!) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(1);
  });

  it("makes a steep node darker than a flat one of the same class, and barely changes a flat grid", async () => {
    const { shadeTerrain } = await load<Mod>("src/three-core/shading.ts");
    const flat = grid(() => 150);
    const flatMesh = buildTerrainMesh(flat.grid, flat.land, syntheticRoute().project, 1);
    const flatShaded = shadeTerrain(flatMesh, flat.grid);
    for (let i = 0; i < flatMesh.colors!.length; i++) expect(Math.abs(flatShaded.colors![i] - flatMesh.colors![i])).toBeLessThanOrEqual(0.08 * flatMesh.colors![i] + 1e-9);
    const slope = grid((r) => 150 + 4 * r); // 45° across the rows
    const slopeMesh = buildTerrainMesh(slope.grid, slope.land, syntheticRoute().project, 1);
    const slopeShaded = shadeTerrain(slopeMesh, slope.grid);
    const mid = 10 * slope.grid.cols + 10;
    const lum = (c: Float32Array, i: number) => c[3 * i] + c[3 * i + 1] + c[3 * i + 2];
    expect(lum(slopeShaded.colors!, mid)).toBeLessThan(lum(flatShaded.colors!, mid));
  });
});
