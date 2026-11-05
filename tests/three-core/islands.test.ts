import { describe, expect, it } from "vitest";
import { ISLAND_TREES, islandTrees } from "../../src/three-core/islands";
import type { WaterBody } from "../../src/three-core/water";

// world units are 10 m
const square = (cx: number, cz: number, halfM: number) => {
  const h = halfM / 10;
  return [
    { x: cx - h, z: cz - h },
    { x: cx - h, z: cz + h },
    { x: cx + h, z: cz + h },
    { x: cx + h, z: cz - h },
  ];
};
const lake = (holes: { x: number; z: number }[][], reservoir = true): WaterBody => ({
  id: "relation/1",
  polygons: [{ outer: square(0, 0, 500), holes }],
  surfaceY: 19.7,
  areaM2: 1e6,
  ...(reservoir && { reservoir: true as const }),
});
const flat = () => 19.5; // islands the DEM filled below the water's level

describe("island trees (aerial review 2026-11-02: the reservoir's islands are wooded)", () => {
  it("woods an island, kept back from its shore and standing at least at the water's level", () => {
    const trees = islandTrees([lake([square(10, 10, 20)])], flat, { conifer: [], broadleaf: [] });
    expect(trees.length).toBeGreaterThan(10);
    for (const t of trees) {
      expect(Math.abs(t.x - 10) * 10).toBeLessThanOrEqual(20 - ISLAND_TREES.insetM + 1e-6);
      expect(Math.abs(t.z - 10) * 10).toBeLessThanOrEqual(20 - ISLAND_TREES.insetM + 1e-6);
      expect(t.y).toBe(19.7);
      expect(t.scale).toBeGreaterThan(0.6);
      expect(t.scale).toBeLessThan(1.2);
    }
  });

  it("gives an island smaller than the grid one tree, and fills only the gaps of one that has trees", () => {
    expect(islandTrees([lake([square(10, 10, 2)])], flat, { conifer: [], broadleaf: [] })).toHaveLength(1);
    const before = islandTrees([lake([square(10, 10, 20)])], flat, { conifer: [], broadleaf: [] });
    const after = islandTrees([lake([square(10, 10, 20)])], flat, { conifer: [], broadleaf: before });
    expect(after).toHaveLength(0);
  });

  it("leaves water that is not a reservoir alone", () => {
    expect(islandTrees([lake([square(10, 10, 20)], false)], flat, { conifer: [], broadleaf: [] })).toHaveLength(0);
  });
});
