import { describe, expect, it } from "vitest";
import { bngToWgs84 } from "../../src/three-core/bng";
import { inRingXZ as inRing } from "../../src/three-core/plane";
import { validateDemHeader, type OsmLine } from "../../src/three-core/registers";
import { waterBodies, type WaterBody } from "../../src/three-core/water";
import type { DemGrid } from "../../src/three-core/types";
import { readJson, readProjectFile, realRoute } from "./fixtures";

// No terrain inside a lake rises through its surface (spec WA7; t10 review). The pixel metrics cannot see this: terrain
// above the surface hides the water in the normal mask and in the expected-water mask alike. So it is checked on the
// terrain itself: every DEM node inside a drawn water polygon, outside its islands, lies at or below that body's surface.
const WINDOWS = ["blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"];
const TOLERANCE_M = 0.05;

function grid(w: string): DemGrid {
  const dir = `public/data/sections/${w}`;
  const h = validateDemHeader(readJson<unknown>(`${dir}/dem.json`), `${dir}/dem.json`);
  const b = readProjectFile(`${dir}/${h.file}`);
  return { ...h, heights: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), sourceIndex: new Uint8Array(readProjectFile(`${dir}/${h.sourceFile}`)) };
}

// "Inside" means more than 0.1 m from the shore: the pipeline places nodes by the COG's exact pixel size (3.99998 m) and
// the renderer by the 4 m spacing, so a node lying on the shoreline can fall either side of it by a few millimetres; there
// the terrain meets the water's edge rather than rising through the surface (t10, three such nodes).
const SHORE_UNITS = 0.01;
const edgeDistance = (x: number, z: number, r: { x: number; z: number }[]) =>
  Math.min(...r.map((a, i) => {
    const b = r[(i + 1) % r.length];
    const [vx, vz] = [b.x - a.x, b.z - a.z];
    const u = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz || 1)));
    return Math.hypot(x - a.x - u * vx, z - a.z - u * vz);
  }));

describe.each(WINDOWS)("window %s", (w) => {
  it("WA7: no terrain node inside a lake, outside its islands, is above the water surface", () => {
    const dem = grid(w);
    const route = realRoute();
    const levels = Object.fromEntries(Object.entries(readJson<Record<string, { levelM: number }>>("data/water-levels.json")).map(([k, v]) => [k, v.levelM]));
    const osm = readJson<{ features: OsmLine[] }>(`public/data/sections/${w}/osm.geojson`).features;
    // every lake drawn here (10,000 m² or more) takes its surface from the shared level file (ADR 42), never a fallback
    const drawn: WaterBody[] = waterBodies(osm, route.project, () => 0, 10_000, levels, 1);
    expect(drawn.filter((b) => !(b.id in levels)).map((b) => b.id), "lakes without a shared level").toEqual([]);
    const bodies = drawn;
    const above: string[] = [];
    for (const b of bodies) {
      const surfaceM = b.surfaceY * 10;
      for (let r = 0; r < dem.rows; r++)
        for (let c = 0; c < dem.cols; c++) {
          const h = dem.heights[r * dem.cols + c];
          if (!(h > surfaceM + TOLERANCE_M)) continue;
          const { lon, lat } = bngToWgs84(dem.originE + c * dem.spacingM, dem.originN - r * dem.spacingM);
          const p = route.project(lon, lat);
          const offShore = (poly: { outer: { x: number; z: number }[]; holes: { x: number; z: number }[][] }) => [poly.outer, ...poly.holes].every((ring) => edgeDistance(p.x, p.y, ring) > SHORE_UNITS);
          if (b.polygons.some((poly) => inRing(p.x, p.y, poly.outer) && !poly.holes.some((hole) => inRing(p.x, p.y, hole)) && offShore(poly))) above.push(`${b.id} node ${r},${c}: ${h.toFixed(2)} m over ${surfaceM.toFixed(2)} m`);
        }
    }
    expect(above.length, above.slice(0, 5).join("; ")).toBe(0);
  }, 120_000);
});
