import { describe, expect, it } from "vitest";
import type { OsmLine } from "../../src/three-core/registers";
import { load } from "./pending";
import { syntheticRoute } from "./fixtures";

// Water bodies from OSM polygons at the shore height (spec RL14; ADR 32).
type WaterBody = { id: string; polygons: { outer: { x: number; z: number }[]; holes: { x: number; z: number }[][] }[]; surfaceY: number; areaM2: number };
type Mod = { waterBodies: (osm: OsmLine[], project: (lon: number, lat: number) => { x: number; y: number }, heightAt: (x: number, z: number) => number, minAreaM2: number) => WaterBody[] };

/** An OSM water polygon that is `wM` × `hM` metres in world space, as lon/lat. */
function lake(id: string, wM: number, hM: number): OsmLine {
  const route = syntheticRoute();
  const corners = [[0, 0], [wM / 10, 0], [wM / 10, hM / 10], [0, hM / 10], [0, 0]].map(([x, z]) => {
    const { lon, lat } = route.unproject(x, z);
    return [lon, lat];
  });
  return { properties: { id, tags: { natural: "water" } }, geometry: { type: "Polygon", coordinates: [corners] } };
}

describe("waterBodies (RL14)", () => {
  it("keeps a 1 ha lake at the median height of its shore and skips a 0.5 ha pond", async () => {
    const { waterBodies } = await load<Mod>("src/three-core/water.ts");
    const route = syntheticRoute();
    const heightAt = (x: number, z: number) => 18 + x + 2 * z; // corners: 18, 28, 48, 38 → median 33 (world units)
    const bodies = waterBodies([lake("way/1", 100, 100), lake("way/2", 50, 100)], route.project, heightAt, 10_000);
    expect(bodies.map((b) => b.id)).toEqual(["way/1"]);
    const [b] = bodies;
    expect(b.areaM2).toBeCloseTo(10_000, -1);
    expect(b.surfaceY).toBeCloseTo(33, 6);
    expect(b.polygons[0].outer.length).toBeGreaterThanOrEqual(4);
    for (const p of b.polygons[0].outer) expect([p.x, p.z].every(Number.isFinite)).toBe(true);
  });

  it("ignores features that are not water polygons", async () => {
    const { waterBodies } = await load<Mod>("src/three-core/water.ts");
    const road: OsmLine = { properties: { id: "way/3", tags: { highway: "track" } }, geometry: { type: "LineString", coordinates: [[-3.9, 52.9], [-3.89, 52.9]] } };
    expect(waterBodies([road], syntheticRoute().project, () => 1, 0)).toEqual([]);
  });
});

describe("polygonsOf keeps a shore-touching island (t10 P-L6, mirroring the pipeline)", () => {
  it("assigns an inner ring by most of its vertices, so a first vertex on the shore does not drop it", async () => {
    const { polygonsOf } = await import("../../src/three-core/water");
    const outer: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const island: [number, number][] = [[10, 5], [8, 4], [8, 6], [10, 5]];
    expect(polygonsOf({ type: "Polygon", coordinates: [outer] }, [island])[0].holes.length).toBe(1);
  });
});
