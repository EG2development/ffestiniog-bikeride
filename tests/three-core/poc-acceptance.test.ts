import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { wgs84ToBng } from "../../src/three-core/bng";
import { heightAtBng, meshHeightAtBng } from "../../src/three-core/dem";
import { buildPocExtras, buildPocScene, POC, type OsmLine, type PocInputs } from "../../src/three-core/poc";
import { validateAssets, validateFeatures, type Feature } from "../../src/three-core/registers";
import { roadWidthM } from "../../src/three-core/roads";
import type { TrailProfile } from "../../src/three-core/trail";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { FEATURE_IDS } from "../../src/scenes3d/PocMaentwrog";
import { expectCameraCriteria, expectCyclistCriteria } from "./criteria";
import { readJson, readProjectFile, realRoute, ROOT } from "./fixtures";

// Acceptance on the real POC data. These need the pipeline output in public/data/
// (python3 scripts/build_poc_data.py, then npm run data:sync) and fail until it exists.

type DemHeader = {
  cols: number;
  rows: number;
  spacingM: number;
  originE: number;
  originN: number;
  crs: string;
  source: string;
  licence: string;
  nodata: number;
  fallbackCells: number;
};

function demGrid(): { header: DemHeader; grid: DemGrid } {
  const header = readJson<DemHeader>("public/data/dem-poc.json");
  const buf = readProjectFile("public/data/dem-poc.f32");
  const heights = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const src = readProjectFile("public/data/dem-poc-source.u8");
  return {
    header,
    grid: { ...header, heights, sourceIndex: new Uint8Array(src), nodata: header.nodata },
  };
}

function inputs(): PocInputs {
  const legend = readJson<{ legend: string[] }>("public/data/landcover-poc.json").legend;
  const land: LandCover = { legend, classes: new Uint8Array(readProjectFile("public/data/landcover-poc.u8")) };
  return {
    route: realRoute(),
    dem: demGrid().grid,
    land,
    profile: readJson<TrailProfile>("public/data/trail-profile-poc.json"),
  };
}

type OsmFeature = { properties: { id: string; tags: Record<string, string> } };
const osmById = () =>
  new Map(readJson<{ features: OsmFeature[] }>("public/data/osm-poc.geojson").features.map((f) => [f.properties.id, f.properties.tags]));

const features = () => validateFeatures(readJson<unknown>("data/features-3d.json"));

describe("POC terrain data (G2)", () => {
  it("G2a/b: the DEM header names its source, licence and CRS, with spacing ≤ 30 m", () => {
    const { header, grid } = demGrid();
    expect(header.source).toMatch(/lidar/i);
    expect(header.licence.length).toBeGreaterThan(0);
    expect(header.crs).toBe("EPSG:27700");
    expect(header.spacingM).toBeLessThanOrEqual(30);
    expect(grid.heights.length).toBe(header.cols * header.rows);
    expect(grid.sourceIndex.filter((s) => s === 1).length).toBe(header.fallbackCells);
  });

  it("G2c: terrain agrees with the route's Copernicus elevations (median ≤ 5 m, max ≤ 30 m)", () => {
    const route = realRoute();
    const { grid } = demGrid();
    const diffs = route.routePoints
      .filter((p) => p.dist >= POC.section.startKm * 1000 && p.dist <= POC.section.endKm * 1000)
      .map((p) => {
        const { e, n } = wgs84ToBng(p.lon, p.lat);
        const h = heightAtBng(grid, e, n);
        expect(h, `DEM height at ${p.dist.toFixed(0)} m`).not.toBeNull();
        return Math.abs(h! - p.ele);
      })
      .sort((a, b) => a - b);
    expect(diffs.length).toBeGreaterThan(20);
    expect(diffs[Math.floor(diffs.length / 2)]).toBeLessThanOrEqual(5);
    expect(diffs[diffs.length - 1]).toBeLessThanOrEqual(30);
  });
});

describe("POC scene (G1, G4, C1–C7, CA1–CA4)", () => {
  it("G1/G4: the trail follows the real centreline and the lidar profile", () => {
    const { route, profile } = inputs();
    const scene = buildPocScene(inputs());
    for (const p of route.routePoints.filter((q) => q.dist >= 7700 && q.dist <= 9700)) {
      const s = scene.trail.sampleAt(p.dist);
      expect(Math.abs(s.x - p.x)).toBeLessThan(1e-6);
      expect(Math.abs(s.z - p.y)).toBeLessThan(1e-6);
    }
    profile.distanceM.forEach((d, i) => {
      if (d < 7700 || d > 9700) return;
      expect(Math.abs(scene.trail.sampleAt(d).y - (profile.elevationM[i] / 10) * POC.ve)).toBeLessThanOrEqual(0.1);
    });
  });

  it("C2–C7 hold at every POC frame, and the rider crosses the OSM bridge mid-shot", () => {
    const scene = buildPocScene(inputs());
    expect(scene.table.length).toBe(POC.frames);
    expectCyclistCriteria(scene.trail, scene.table, POC.fps, scene.dims);
    const onBridge = Array.from(scene.table).findIndex((d) => d >= POC.bridgeM[0] && d <= POC.bridgeM[1]);
    expect(onBridge).toBeGreaterThanOrEqual(POC.shotSplitFrame - 30);
    expect(onBridge).toBeLessThanOrEqual(POC.frames - 60);
  });

  it("CA1–CA4 hold at every POC frame", () => {
    const scene = buildPocScene(inputs());
    expectCameraCriteria(scene.shot, [[0, POC.shotSplitFrame], [POC.shotSplitFrame, POC.frames]], scene.heightAt, scene.riderAt, POC.fps);
  });
});

describe("POC geometry", () => {
  it("every mesh the POC renders has finite positions and in-range indices", () => {
    const base = inputs();
    const scene = buildPocScene(base);
    const osm = readJson<{ features: OsmLine[] }>("public/data/osm-poc.geojson").features;
    const extras = buildPocExtras({ ...base, osm, features: features(), bridgeIds: FEATURE_IDS }, scene);
    const meshes = { terrain: scene.terrain, trail: scene.trail.ribbon, roads: extras.roads, ...Object.fromEntries(extras.bridges.map((m, i) => [`bridge${i}`, m])) };
    expect(extras.bridges.length).toBeGreaterThan(0);
    for (const [name, m] of Object.entries(meshes)) {
      expect(m.positions.length, name).toBeGreaterThan(0);
      expect(m.positions.every(Number.isFinite), `${name} positions finite`).toBe(true);
      const count = m.positions.length / 3;
      expect(m.indices.every((i) => i < count), `${name} indices in range`).toBe(true);
    }
    const trees = [...extras.trees.conifer, ...extras.trees.broadleaf];
    expect(trees.length).toBeGreaterThan(0);
    expect(trees.every((t) => [t.x, t.y, t.z, t.scale, t.yaw].every(Number.isFinite))).toBe(true);
  });

  it("roads lie on the rendered terrain, the camera's ground is the rendered terrain, and trees stand off the roads (review R4, R5)", () => {
    const base = inputs();
    const scene = buildPocScene(base);
    const osm = readJson<{ features: OsmLine[] }>("public/data/osm-poc.geojson").features;
    const feats = features();
    const extras = buildPocExtras({ ...base, osm, features: feats, bridgeIds: FEATURE_IDS }, scene);
    // the rendered ground: the flattened mesh's heights on the DEM grid (its vertices are the grid nodes, row by row)
    const ground: DemGrid = { ...base.dem, heights: Float32Array.from({ length: base.dem.cols * base.dem.rows }, (_, k) => scene.terrain.positions[k * 3 + 1]) };
    const groundAt = (x: number, z: number, sample = heightAtBng) => {
      const { lon, lat } = base.route.unproject(x, z);
      const { e, n } = wgs84ToBng(lon, lat);
      return sample(ground, e, n);
    };

    // the roads drape on the mesh's own triangles, which is what renders
    const rp = extras.roads.positions;
    const buried: string[] = [];
    for (let i = 0; i < rp.length; i += 3) {
      const g = groundAt(rp[i], rp[i + 2], meshHeightAtBng);
      if (g !== null && rp[i + 1] - g < 0.02) buried.push(`(${rp[i].toFixed(1)}, ${rp[i + 2].toFixed(1)}): ${((rp[i + 1] - g) * 10).toFixed(2)} m`);
    }
    expect(buried.slice(0, 5), `${buried.length} road vertices less than 0.2 m above the rendered terrain`).toEqual([]);

    for (let d = 7700; d <= 9700; d += 50) {
      const s = scene.trail.sampleAt(d);
      expect(scene.heightAt(s.x, s.z), `heightAt at ${d} m`).toBeCloseTo(groundAt(s.x, s.z)!, 4);
    }

    const roadRefs = new Set(feats.filter((f) => f.kind === "road").map((f) => f.source.ref));
    const segs: { ax: number; az: number; bx: number; bz: number; clear: number }[] = [];
    for (const f of osm.filter((o) => roadRefs.has(o.properties.id) && o.geometry.type === "LineString")) {
      const pts = (f.geometry.coordinates as [number, number][]).map(([lon, lat]) => base.route.project(lon, lat));
      for (let k = 0; k + 1 < pts.length; k++) {
        segs.push({ ax: pts[k].x, az: pts[k].y, bx: pts[k + 1].x, bz: pts[k + 1].y, clear: (roadWidthM(f.properties.tags.highway) / 2 + 2) / 10 });
      }
    }
    const onRoad = [...extras.trees.conifer, ...extras.trees.broadleaf].filter((t) =>
      segs.some((s) => {
        const vx = s.bx - s.ax;
        const vz = s.bz - s.az;
        const u = Math.max(0, Math.min(1, ((t.x - s.ax) * vx + (t.z - s.az) * vz) / (vx * vx + vz * vz || 1)));
        return Math.hypot(t.x - (s.ax + u * vx), t.z - (s.az + u * vz)) < s.clear - 1e-6;
      }),
    );
    expect(onRoad.length, "trees within 2 m of a road carriageway").toBe(0);
  });
});

describe("POC registers (H1, G5b, G6, G7, L1, C8)", () => {
  it("H1: the feature register validates and lists every id a 3D scene declares", () => {
    const ids = new Set(features().map((f) => f.id));
    const sceneDir = resolve(ROOT, "src/scenes3d");
    expect(existsSync(sceneDir), "src/scenes3d").toBe(true);
    for (const name of readdirSync(sceneDir)) {
      const src = readFileSync(join(sceneDir, name), "utf8");
      const block = /FEATURE_IDS\s*=\s*\[([^\]]*)\]/.exec(src);
      expect(block, `${name} declares FEATURE_IDS`).not.toBeNull();
      for (const [, id] of block![1].matchAll(/["']([^"']+)["']/g)) expect(ids.has(id), `${name}: ${id}`).toBe(true);
    }
  });

  it("G5b: every implied cut or fill deeper than 2 m is registered as an approximate earthwork", () => {
    const { cutFill } = buildPocScene(inputs());
    const earthworks = features().filter((f) => f.kind === "earthwork");
    for (const run of cutFill) {
      const covered = earthworks.some(
        (f) => f.category === "approximate" && (f.fromKm ?? Infinity) <= run.fromKm + 0.001 && (f.toKm ?? -Infinity) >= run.toKm - 0.001,
      );
      expect(covered, `${run.kind} ${run.fromKm}–${run.toKm} km`).toBe(true);
    }
  });

  it("G6: every structure is backed by an OSM structure tag or a Coflein record", () => {
    const osm = osmById();
    const structures = features().filter((f) => f.kind === "structure");
    expect(structures.map((f) => f.source.ref)).toContain("way/159029124");
    for (const f of structures) {
      expect(["osm", "coflein"]).toContain(f.source.type);
      if (f.source.type === "osm") {
        const tags = osm.get(f.source.ref);
        expect(tags, f.source.ref).toBeDefined();
        expect(Object.keys(tags!).some((k) => /^(bridge|cutting|embankment|tunnel)$/.test(k)), f.source.ref).toBe(true);
      }
    }
  });

  it("G7: places, roads and water come from waypoints, OSM or the map tiles", () => {
    const osm = osmById();
    const stations = new Set(readJson<{ stations: { id: string }[] }>("data/waypoints.json").stations.map((s) => s.id));
    for (const f of features().filter((x: Feature) => ["place", "road", "water"].includes(x.kind))) {
      if (f.source.type === "osm") expect(osm.has(f.source.ref), f.id).toBe(true);
      else if (f.source.type === "waypoints") expect(stations.has(f.source.ref), f.id).toBe(true);
      else expect(f.source.type, f.id).toBe("tiles");
    }
  });

  it("L1/C8: every 3D asset file is registered with a licence; the cyclist is an original", () => {
    const assets = validateAssets(readJson<unknown>("data/assets-3d.json"));
    const registered = new Set(assets.map((a) => a.path));
    const dir = resolve(ROOT, "public/3d");
    const walk = (d: string): string[] =>
      existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [relative(ROOT, join(d, e.name))])) : [];
    for (const file of walk(dir)) expect(registered.has(file), file).toBe(true);
    const cyclist = features().find((f) => f.kind === "cyclist");
    expect(cyclist?.source.type).toBe("original");
    // C8 asks for the model's source, licence and attribution in the asset register (ADR 14; t14 validation D3)
    const model = assets.find((a) => a.path === "src/three/CyclistView.tsx");
    expect(model, "C8: the cyclist model in data/assets-3d.json").toBeDefined();
    expect(model!.kind).toBe("model");
    expect(model!.source).toMatch(/original/i);
  });
});
