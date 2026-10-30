import { describe, expect, it } from "vitest";
import { load } from "./pending";
import { readJson, realRoute } from "./fixtures";

// Tile coordinates and UVs for the aerial map drape (spec RL6; ADR 33).
type Range = { x0: number; x1: number; y0: number; y1: number };
type Mod = {
  tileRange: (bbox: { west: number; south: number; east: number; north: number }, z: number) => Range;
  tileUvs: (positions: Float32Array, unproject: (x: number, z: number) => { lon: number; lat: number }, range: Range, z: number) => Float32Array;
};
type Layer = { name: string; zoom: number; tiles: { x: number; y: number; lonNW: number; latNW: number; lonSE: number; latSE: number }[] };

describe("tile UVs (RL6)", () => {
  it("tileRange covers exactly the cached wide layer's tiles for its bounding box", async () => {
    const { tileRange } = await load<Mod>("src/three-core/tileUv.ts");
    const wide = readJson<{ layers: Layer[] }>("public/data/tiles-manifest.json").layers.find((l) => l.name === "wide")!;
    const xs = wide.tiles.map((t) => t.x);
    const ys = wide.tiles.map((t) => t.y);
    const bbox = { west: Math.min(...wide.tiles.map((t) => t.lonNW)), east: Math.max(...wide.tiles.map((t) => t.lonSE)), south: Math.min(...wide.tiles.map((t) => t.latSE)), north: Math.max(...wide.tiles.map((t) => t.latNW)) };
    const inset = { west: bbox.west + 1e-6, east: bbox.east - 1e-6, south: bbox.south + 1e-6, north: bbox.north - 1e-6 };
    expect(tileRange(inset, wide.zoom)).toEqual({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
  });

  it("maps the range's north-west corner to (0, 1) and its south-east corner to (1, 0)", async () => {
    const { tileRange, tileUvs } = await load<Mod>("src/three-core/tileUv.ts");
    const route = realRoute();
    const wide = readJson<{ layers: Layer[] }>("public/data/tiles-manifest.json").layers.find((l) => l.name === "wide")!;
    const nw = wide.tiles.reduce((a, t) => (t.x <= a.x && t.y <= a.y ? t : a));
    const se = wide.tiles.reduce((a, t) => (t.x >= a.x && t.y >= a.y ? t : a));
    const range = tileRange({ west: nw.lonNW + 1e-6, north: nw.latNW - 1e-6, east: se.lonSE - 1e-6, south: se.latSE + 1e-6 }, wide.zoom);
    const p1 = route.project(nw.lonNW, nw.latNW);
    const p2 = route.project(se.lonSE, se.latSE);
    const uv = tileUvs(Float32Array.from([p1.x, 0, p1.y, p2.x, 0, p2.y]), (x, z) => route.unproject(x, z), range, wide.zoom);
    expect(uv[0]).toBeCloseTo(0, 5);
    expect(uv[1]).toBeCloseTo(1, 5);
    expect(uv[2]).toBeCloseTo(1, 5);
    expect(uv[3]).toBeCloseTo(0, 5);
  });
});
