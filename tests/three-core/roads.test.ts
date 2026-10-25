import { describe, expect, it } from "vitest";
import { buildRoadMesh } from "../../src/three-core/roads";

// A road running off the edge of the terrain: the height lookup has no answer there.
const project = (lon: number, lat: number) => ({ x: lon * 1000, y: lat * 1000 });
const heightAt = (x: number) => (x > 5 ? -Infinity : 18);

describe("buildRoadMesh", () => {
  it("drops the parts of a road outside the terrain, leaving only finite vertices", () => {
    const mesh = buildRoadMesh([{ coords: [[0, 0], [0.01, 0]], highway: "unclassified" }], project, heightAt);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < mesh.positions.length; i += 3) expect(mesh.positions[i]).toBeLessThanOrEqual(5.001);
    for (const i of mesh.indices) expect(i).toBeLessThan(mesh.positions.length / 3);
  });

  it("drops a road entirely outside the terrain", () => {
    const mesh = buildRoadMesh([{ coords: [[0.01, 0], [0.02, 0]], highway: "track" }], project, heightAt);
    expect(mesh.positions.length).toBe(0);
    expect(mesh.indices.length).toBe(0);
  });
});
