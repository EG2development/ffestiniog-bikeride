import { describe, expect, it } from "vitest";
import type { OsmLine } from "../src/three-core/registers";
import { readJson, realRoute } from "./three-core/fixtures";
import { load } from "./three-core/pending";

// The water mesh faces up and keeps its holes (spec WA1, WA2; ADR 41; pseudocode-reel-v2 §2.2).
type XZ = { x: number; z: number };
type Polygon = { outer: XZ[]; holes: XZ[][] };
type Geo = { waterArrays: (polygons: Polygon[], y: number) => { positions: Float32Array; indices: Uint32Array } };
type Water = { waterBodies: (osm: OsmLine[], project: (lon: number, lat: number) => { x: number; y: number }, heightAt: (x: number, z: number) => number, minAreaM2: number) => { id: string; polygons: Polygon[]; surfaceY: number }[] };

const sq = (x0: number, z0: number, s: number): XZ[] => [{ x: x0, z: z0 }, { x: x0 + s, z: z0 }, { x: x0 + s, z: z0 + s }, { x: x0, z: z0 + s }];

function triangles(a: { positions: Float32Array; indices: Uint32Array }) {
  const p = (i: number) => ({ x: a.positions[3 * i], y: a.positions[3 * i + 1], z: a.positions[3 * i + 2] });
  const out: { ny: number; cx: number; cz: number; area: number }[] = [];
  for (let t = 0; t < a.indices.length; t += 3) {
    const [p0, p1, p2] = [p(a.indices[t]), p(a.indices[t + 1]), p(a.indices[t + 2])];
    const u = { x: p1.x - p0.x, z: p1.z - p0.z };
    const v = { x: p2.x - p0.x, z: p2.z - p0.z };
    const ny = u.z * v.x - u.x * v.z; // y of u × v
    out.push({ ny, cx: (p0.x + p1.x + p2.x) / 3, cz: (p0.z + p1.z + p2.z) / 3, area: Math.abs(ny) / 2 });
  }
  return out;
}

describe("waterArrays (WA1, WA2)", () => {
  it("faces every triangle up, whichever way the ring is wound", async () => {
    const { waterArrays } = await load<Geo>("src/three/waterGeometry.ts");
    for (const ring of [sq(0, 0, 10), [...sq(0, 0, 10)].reverse()]) {
      const tris = triangles(waterArrays([{ outer: ring, holes: [] }], 19.7));
      expect(tris.length).toBe(2);
      expect(tris.every((t) => t.ny > 0), "every normal has y > 0").toBe(true);
    }
  });

  it("leaves the island open: no triangle inside it, area = lake minus island", async () => {
    const { waterArrays } = await load<Geo>("src/three/waterGeometry.ts");
    const tris = triangles(waterArrays([{ outer: sq(0, 0, 10), holes: [sq(4, 4, 2)] }], 0));
    expect(tris.some((t) => t.cx > 4 && t.cx < 6 && t.cz > 4 && t.cz < 6)).toBe(false);
    const area = tris.reduce((a, t) => a + t.area, 0);
    expect(Math.abs(area - 96) / 96).toBeLessThanOrEqual(0.01);
    expect(tris.every((t) => t.ny > 0)).toBe(true);
  });

  it("faces Llyn Trawsfynydd up with its islands open (real data)", async () => {
    const { waterArrays } = await load<Geo>("src/three/waterGeometry.ts");
    const { waterBodies } = await load<Water>("src/three-core/water.ts");
    const osm = readJson<{ features: OsmLine[] }>("public/data/sections/trawsfynydd/osm.geojson").features;
    const lake = waterBodies(osm, realRoute().project, () => 0, 10_000).find((b) => b.id === "relation/3084421");
    expect(lake?.polygons, "the lake keeps its polygons").toBeDefined();
    expect(lake!.polygons.reduce((n, p) => n + p.holes.length, 0)).toBeGreaterThanOrEqual(15);
    const tris = triangles(waterArrays(lake!.polygons, lake!.surfaceY));
    expect(tris.length).toBeGreaterThan(100);
    expect(tris.filter((t) => t.ny <= 0)).toEqual([]);
  });
});

describe("every lake drawn in the real ground windows faces up (WA1; t13)", () => {
  for (const w of ["blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"]) {
    it(`${w}: every water body's triangles face up`, async () => {
      const { waterArrays } = await load<Geo>("src/three/waterGeometry.ts");
      const { waterBodies } = await load<Water>("src/three-core/water.ts");
      const osm = readJson<{ features: OsmLine[] }>(`public/data/sections/${w}/osm.geojson`).features;
      for (const b of waterBodies(osm, realRoute().project, () => 0, 10_000)) {
        const tris = triangles(waterArrays(b.polygons, b.surfaceY));
        expect(tris.length, b.id).toBeGreaterThan(0);
        expect(tris.filter((t) => t.ny <= 0).length, `${w} ${b.id}: triangles facing down`).toBe(0);
      }
    });
  }
});

describe("closed rings (t10 L1)", () => {
  it("triangulates a ring that repeats its first point exactly as an open one", async () => {
    const { waterArrays } = await load<Geo>("src/three/waterGeometry.ts");
    const close = (r: XZ[]) => [...r, r[0]];
    const open = triangles(waterArrays([{ outer: sq(0, 0, 10), holes: [sq(4, 4, 2)] }], 0)).reduce((a, t) => a + t.area, 0);
    const closed = triangles(waterArrays([{ outer: close(sq(0, 0, 10)), holes: [close(sq(4, 4, 2))] }], 0));
    expect(closed.reduce((a, t) => a + t.area, 0)).toBeCloseTo(open, 6);
    expect(closed.some((t) => t.cx > 4 && t.cx < 6 && t.cz > 4 && t.cz < 6), "no triangle on the island").toBe(false);
  });
});
