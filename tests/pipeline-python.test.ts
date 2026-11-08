import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { wgs84ToBng } from "../src/three-core/bng";
import { inRingXY as inRing } from "../src/three-core/plane";
import { readJson, readProjectFile, ROOT } from "./three-core/fixtures";

// The Python pipeline's own checks run in the suite (spec WA3, WA4, WA6, WA7, CL4, BL6, BL17; ADRs 41, 42, 44, 49;
// pseudocode-reel-v2 §1.4, §1.5, §4.3, §5.3). They need python3 with numpy and Pillow, as CI provides.
const python = (script: string, ...args: string[]) => {
  expect(existsSync(resolve(ROOT, script)), `${script} is not implemented yet`).toBe(true);
  const r = spawnSync("python3", ["-I", script, ...args], { cwd: ROOT, encoding: "utf8", timeout: 120_000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}`.trim() };
};

describe("pipeline self-tests", () => {
  it("WA3, WA4: build_section_data.py --self-test (holes per part, islands kept, Polygon = one-part MultiPolygon)", () => {
    const r = python("scripts/build_section_data.py", "--self-test");
    expect(r.status, r.out.split("\n").slice(-3).join("\n")).toBe(0);
  });

  it("WA6, WA7, CL4: still_metrics.py --self-test (water coverage and specks, trail contrast, dilation)", () => {
    const r = python("scripts/still_metrics.py", "--self-test");
    expect(r.status, r.out.split("\n").slice(-3).join("\n")).toBe(0);
  });

  it("BL6, BL17: build_buildings.py --self-test (DSM − DTM heights, tag allowlist)", () => {
    const r = python("scripts/build_buildings.py", "--self-test");
    expect(r.status, r.out.split("\n").slice(-3).join("\n")).toBe(0);
  });

  it("ADRs 57, 58, 60: build_canopy.py, fetch_barriers.py and build_imagery.py --self-test (canopy, boundaries, UTM and the TIFF predictor)", () => {
    for (const script of ["scripts/build_canopy.py", "scripts/fetch_barriers.py", "scripts/build_imagery.py"]) {
      const r = python(script, "--self-test");
      expect(r.status, `${script}: ${r.out.split("\n").slice(-3).join("\n")}`).toBe(0);
    }
  });

  it("fetch_osm_extras.py and lidar_underbridges.py --self-test (watercourse, power and ruin tags, route crossings, underbridge spans)", () => {
    for (const script of ["scripts/fetch_osm_extras.py", "scripts/lidar_underbridges.py"]) {
      const r = python(script, "--self-test");
      expect(r.status, `${script}: ${r.out.split("\n").slice(-3).join("\n")}`).toBe(0);
    }
  });

  it("fetch_photo_refs.py --self-test (taken dates, headings, licences, route snapping)", () => {
    const r = python("scripts/fetch_photo_refs.py", "--self-test");
    expect(r.status, r.out.split("\n").slice(-3).join("\n")).toBe(0);
  });
});

type Photo = { id: string; date: string | null; use: string; licence: string; location: { offset_m: number }; source: string; photographer: string | null };

describe("the photographic reference catalogue (data/photo-references.json)", () => {
  it("only photos taken in 2012 or later are for reconstruction; every one is openly licensed, sourced, credited and in the corridor", () => {
    const { photos } = readJson<{ photos: Photo[] }>("data/photo-references.json");
    expect(photos.length).toBeGreaterThan(100);
    const bad = photos.filter((p) =>
      (p.use === "reconstruction") !== (p.date !== null && Number(p.date.slice(0, 4)) >= 2012) ||
      !/^(CC0|CC BY|Public domain)/i.test(p.licence) || !p.source?.startsWith("https://commons.wikimedia.org/") || p.location.offset_m > 600);
    expect(bad.map((p) => p.id)).toEqual([]);
    expect(photos.filter((p) => p.use === "reconstruction" && !p.photographer).map((p) => p.id)).toEqual([]);
  });
});

type Header = { cols: number; rows: number; spacingM: number; originE: number; originN: number; nodata: number; file: string; sourceFile: string };
type Feature = { properties: { id: string; inner_rings?: [number, number][][] }; geometry: { type: string; coordinates: unknown } };


describe("Llyn Trawsfynydd's islands keep their terrain (WA4, real data)", () => {
  it("no island cell is filled, and every island of 1,000 m² or more rises above the lake level", () => {
    const w = "public/data/sections/trawsfynydd";
    const h = readJson<Header>(`${w}/dem.json`);
    const buf = readProjectFile(`${w}/${h.file}`);
    const z = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const src = new Uint8Array(readProjectFile(`${w}/${h.sourceFile}`));
    const lake = readJson<{ features: Feature[] }>(`${w}/osm.geojson`).features.find((f) => f.properties.id === "relation/3084421")!;
    const g = lake.geometry;
    const parts = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as [number, number][][][];
    const toBng = (r: [number, number][]) => r.map(([lon, lat]) => { const p = wgs84ToBng(lon, lat); return [p.e, p.n] as [number, number]; });
    const islands = [...parts.flatMap((p) => p.slice(1)), ...(lake.properties.inner_rings ?? [])].map(toBng);
    const outer = toBng(parts[0][0]);
    const cellsIn = (ring: [number, number][]) => {
      const es = ring.map((p) => p[0]);
      const ns = ring.map((p) => p[1]);
      const c0 = Math.max(0, Math.floor((Math.min(...es) - h.originE) / h.spacingM));
      const c1 = Math.min(h.cols - 1, Math.ceil((Math.max(...es) - h.originE) / h.spacingM));
      const r0 = Math.max(0, Math.floor((h.originN - Math.max(...ns)) / h.spacingM));
      const r1 = Math.min(h.rows - 1, Math.ceil((h.originN - Math.min(...ns)) / h.spacingM));
      const out: number[] = [];
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (inRing(h.originE + c * h.spacingM, h.originN - r * h.spacingM, ring)) out.push(r * h.cols + c);
      return out;
    };
    let level: number;
    if (existsSync(resolve(ROOT, "data/water-levels.json"))) level = readJson<Record<string, { levelM: number }>>("data/water-levels.json")["relation/3084421"].levelM;
    else {
      const filled = cellsIn(outer).filter((i) => src[i] === 1).map((i) => z[i]).sort((a, b) => a - b);
      level = filled[Math.floor(filled.length / 2)]; // the level the current fill wrote
    }
    const areaM2 = (r: [number, number][]) => Math.abs(r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0)) / 2;
    const checked = islands.map((ring, k) => ({ k, area: areaM2(ring), cells: cellsIn(ring).filter((i) => z[i] !== h.nodata) })).filter((x) => x.cells.length > 0);
    expect(checked.length, "islands large enough to hold a DTM cell").toBeGreaterThanOrEqual(5);
    // the fill must leave every island cell as the lidar has it
    const touched = checked.filter((x) => x.cells.some((i) => src[i] === 1)).map((x) => `island ${x.k}: ${x.cells.filter((i) => src[i] === 1).length} cells filled`);
    expect(touched, "island cells changed by the water fill").toEqual([]);
    // small islets can be awash at the survey's water level; the substantial islands must stand clear of it
    const big = checked.filter((x) => x.area >= 1000);
    expect(big.length).toBeGreaterThanOrEqual(3);
    const flattened = big.filter((x) => Math.max(...x.cells.map((i) => z[i])) <= level + 0.5).map((x) => `island ${x.k} (${Math.round(x.area)} m²)`);
    expect(flattened, `islands of 1,000 m² or more at or below the lake level ${level.toFixed(2)} m + 0.5 m`).toEqual([]);
  });
});
