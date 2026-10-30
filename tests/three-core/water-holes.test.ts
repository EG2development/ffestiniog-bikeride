import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { OsmLine } from "../../src/three-core/registers";
import { readJson, realRoute, ROOT, syntheticRoute } from "./fixtures";
import { load, loadExports } from "./pending";

// Water polygons keep their holes, and one lake has one level (spec WA3, WA5; ADRs 41, 42; pseudocode-reel-v2 §1.1, §2.1).
type LonLat = [number, number];
type XZ = { x: number; z: number };
type LonLatPolygon = { outer: LonLat[]; holes: LonLat[][] };
type Body = { id: string; polygons: { outer: XZ[]; holes: XZ[][] }[]; surfaceY: number; areaM2: number };
type Mod = {
  polygonsOf: (geometry: { type: string; coordinates: unknown }, innerRings?: LonLat[][]) => LonLatPolygon[];
  waterBodies: (osm: OsmLine[], project: (lon: number, lat: number) => { x: number; y: number }, heightAt: (x: number, z: number) => number, minAreaM2: number, levels?: Record<string, number>, ve?: number) => Body[];
};

const square = (x0: number, y0: number, s: number): LonLat[] => [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s], [x0, y0]];
const signedArea = (r: LonLat[]) => r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2;

describe("polygonsOf: one normaliser for holes (WA3)", () => {
  it("reads holes from the geometry and from properties.inner_rings alike", async () => {
    const { polygonsOf } = await loadExports<Mod>("src/three-core/water.ts", ["polygonsOf"]);
    const fromGeometry = polygonsOf({ type: "Polygon", coordinates: [square(0, 0, 10), square(4, 4, 2)] });
    const fromProps = polygonsOf({ type: "Polygon", coordinates: [square(0, 0, 10)] }, [square(4, 4, 2)]);
    expect(fromGeometry).toHaveLength(1);
    expect(fromGeometry[0].holes).toHaveLength(1);
    expect(fromProps).toEqual(fromGeometry);
  });

  it("gives a Polygon and a one-part MultiPolygon the same result, without closing duplicates", async () => {
    const { polygonsOf } = await loadExports<Mod>("src/three-core/water.ts", ["polygonsOf"]);
    const poly = polygonsOf({ type: "Polygon", coordinates: [square(0, 0, 10), square(4, 4, 2)] });
    const multi = polygonsOf({ type: "MultiPolygon", coordinates: [[square(0, 0, 10), square(4, 4, 2)]] });
    expect(multi).toEqual(poly);
    expect(poly[0].outer).toHaveLength(4);
  });

  it("orients outer rings anticlockwise and holes clockwise", async () => {
    const { polygonsOf } = await loadExports<Mod>("src/three-core/water.ts", ["polygonsOf"]);
    const cw = [...square(0, 0, 10)].reverse();
    const [p] = polygonsOf({ type: "Polygon", coordinates: [cw] }, [square(4, 4, 2)]);
    expect(signedArea(p.outer)).toBeGreaterThan(0);
    expect(signedArea(p.holes[0])).toBeLessThan(0);
  });

  it("gives each inner ring to the MultiPolygon part that contains it, and to no other part", async () => {
    const { polygonsOf } = await loadExports<Mod>("src/three-core/water.ts", ["polygonsOf"]);
    const parts = polygonsOf({ type: "MultiPolygon", coordinates: [[square(0, 0, 10)], [square(20, 0, 10)]] }, [square(24, 4, 2)]);
    expect(parts.map((p) => p.holes.length)).toEqual([0, 1]);
  });
});

describe("waterBodies keeps holes and uses shared levels (WA3, WA5)", () => {
  const lakeWithIsland = (): OsmLine => {
    const route = syntheticRoute();
    const ll = (x: number, z: number): LonLat => {
      const { lon, lat } = route.unproject(x, z);
      return [lon, lat];
    };
    const ring = (x0: number, z0: number, s: number) => [ll(x0, z0), ll(x0 + s, z0), ll(x0 + s, z0 + s), ll(x0, z0 + s), ll(x0, z0)];
    return { properties: { id: "relation/9", tags: { natural: "water" }, inner_rings: [ring(4, 4, 2)] }, geometry: { type: "Polygon", coordinates: [ring(0, 0, 10)] } } as unknown as OsmLine;
  };

  it("keeps the island as a hole and counts its area out", async () => {
    const { waterBodies } = await load<Mod>("src/three-core/water.ts");
    const [b] = waterBodies([lakeWithIsland()], syntheticRoute().project, () => 0, 5_000);
    expect(b?.polygons?.[0]?.holes, "the body keeps its polygons with holes").toHaveLength(1);
    expect(b.areaM2).toBeCloseTo(10_000 - 400, -2); // 100 m square minus a 20 m island
  });

  it("takes the surface from a shared level when one is given", async () => {
    const { waterBodies } = await load<Mod>("src/three-core/water.ts");
    const [b] = waterBodies([lakeWithIsland()], syntheticRoute().project, () => 0, 5_000, { "relation/9": 197.2 }, 1);
    expect(b.surfaceY).toBeCloseTo(19.72, 6);
  });

  it("gives Llyn Trawsfynydd one level and the same islands in both windows that show it (real data)", async () => {
    const { waterBodies } = await load<Mod>("src/three-core/water.ts");
    expect(existsSync(resolve(ROOT, "data/water-levels.json")), "data/water-levels.json is not built yet (pipeline, ADR 42)").toBe(true);
    const levels = Object.fromEntries(Object.entries(readJson<Record<string, { levelM: number }>>("data/water-levels.json")).map(([k, v]) => [k, v.levelM]));
    const lake = (w: string) => {
      const osm = readJson<{ features: OsmLine[] }>(`public/data/sections/${w}/osm.geojson`).features;
      return waterBodies(osm, realRoute().project, () => 0, 10_000, levels, 1).find((b) => b.id === "relation/3084421");
    };
    const a = lake("trawsfynydd");
    const b = lake("maentwrog");
    expect(a && b, "the lake is in both windows").toBeTruthy();
    expect(Math.abs(a!.surfaceY - b!.surfaceY)).toBeLessThanOrEqual(0.01); // 0.1 m
    // and it is the shared level, not a fallback (heightAt is 0 here, so a missing or mis-keyed level would give 0; t10 H3)
    expect(levels["relation/3084421"], "the lake's level in data/water-levels.json").toBeGreaterThan(190);
    expect(a!.surfaceY).toBeCloseTo(levels["relation/3084421"] / 10, 6);
    expect(b!.surfaceY).toBeCloseTo(levels["relation/3084421"] / 10, 6);
    const holes = (x: Body) => x.polygons.reduce((n, p) => n + p.holes.length, 0);
    expect(holes(a!)).toBeGreaterThanOrEqual(15);
    expect(holes(b!)).toBe(holes(a!));
  });
});
