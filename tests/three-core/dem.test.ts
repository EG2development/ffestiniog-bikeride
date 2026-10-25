import { describe, expect, it } from "vitest";
import { bngToWgs84 } from "../../src/three-core/bng";
import { buildTerrainMesh, heightAtBng } from "../../src/three-core/dem";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { syntheticRoute } from "./fixtures";

// 5 × 4 nodes, 4 m apart, near Maentwrog Road; heights = 100 + col + 10·row
function grid(): DemGrid {
  const cols = 5;
  const rows = 4;
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights[r * cols + c] = 100 + c + 10 * r;
  heights[3 * cols + 4] = -9999;
  return { cols, rows, spacingM: 4, originE: 269400, originN: 339800, heights, sourceIndex: new Uint8Array(cols * rows), nodata: -9999 };
}

describe("heightAtBng (pseudocode §2.2)", () => {
  it("returns node heights exactly at nodes", () => {
    expect(heightAtBng(grid(), 269400 + 8, 339800 - 4)).toBeCloseTo(100 + 2 + 10, 9);
  });

  it("interpolates bilinearly between nodes", () => {
    // centre of the cell between cols 0–1 and rows 0–1
    expect(heightAtBng(grid(), 269402, 339798)).toBeCloseTo((100 + 101 + 110 + 111) / 4, 9);
  });

  it("returns null outside the grid and next to nodata", () => {
    expect(heightAtBng(grid(), 269000, 339800)).toBeNull();
    expect(heightAtBng(grid(), 269400 + 15, 339800 - 11)).toBeNull();
  });
});

describe("buildTerrainMesh (G1, G3, D8)", () => {
  const land: LandCover = { classes: new Uint8Array(20).map((_, i) => (i < 10 ? 0 : 1)), legend: ["woodland", "grassland"] };

  it("has one vertex per node and two triangles per cell", () => {
    const mesh = buildTerrainMesh(grid(), land, syntheticRoute().project, 1);
    expect(mesh.positions.length).toBe(5 * 4 * 3);
    expect(mesh.indices.length).toBe(4 * 3 * 6);
  });

  it("places every node through the shared projection, at elevation / 10", () => {
    const g = grid();
    const { project } = syntheticRoute();
    const mesh = buildTerrainMesh(g, land, project, 1);
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const i = r * g.cols + c;
        if (g.heights[i] === g.nodata) continue;
        const { lon, lat } = bngToWgs84(g.originE + c * g.spacingM, g.originN - r * g.spacingM);
        const p = project(lon, lat);
        expect(mesh.positions[i * 3]).toBeCloseTo(p.x, 4);
        expect(mesh.positions[i * 3 + 1]).toBeCloseTo(g.heights[i] / 10, 6);
        expect(mesh.positions[i * 3 + 2]).toBeCloseTo(p.y, 4);
      }
    }
  });

  it("colours vertices by land-cover class", () => {
    const mesh = buildTerrainMesh(grid(), land, syntheticRoute().project, 1);
    expect(mesh.colors).toBeDefined();
    const rgb = (i: number) => Array.from(mesh.colors!.slice(i * 3, i * 3 + 3));
    expect(rgb(0)).toEqual(rgb(9));
    expect(rgb(0)).not.toEqual(rgb(10));
  });
});
