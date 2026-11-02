import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { barrierLines } from "../../src/three-core/barriers";
import { buildingArrays, sectionBuildings, type BuildingStatus } from "../../src/three-core/buildings";
import { powerLines, powerSupports, routeCrossingsM, waterwayLines } from "../../src/three-core/osmExtras";
import { validateBuildings, validateFeatures, validateOsmLines, type Feature, type OsmLine } from "../../src/three-core/registers";
import { buildSectionScene, SECTIONS } from "../../src/three-core/sections";
import type { TrailProfile } from "../../src/three-core/trail";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { waterBodies } from "../../src/three-core/water";
import { readJson, readProjectFile, realRoute, ROOT } from "./fixtures";

// The council map reviews' gaps (2026-11-02): OSM watercourses, power lines and ruins in the windows' osm.geojson
// (scripts/fetch_osm_extras.py), the underbridges the lidar shows (data/lidar-underbridges.json), and the
// evidence-only level crossings (data/evidence-crossings.json).
const route = realRoute();
const osmOf = (w: string) => validateOsmLines(readJson<unknown>(`public/data/sections/${w}/osm.geojson`), `${w}/osm.geojson`);
const registerOf = (w: string) => validateFeatures(readJson<unknown>(`data/features-${w}.json`));
const span = (reg: Feature[], id: string): [number, number] => {
  const f = reg.find((e) => e.id === id);
  if (!f || f.fromKm === undefined || f.toKm === undefined) throw new Error(`${id} not registered with a km range`);
  return [f.fromKm * 1000, f.toKm * 1000];
};
const within = (d: number, [a, b]: [number, number]) => d >= a && d <= b;

describe("watercourses under the line's bridges", () => {
  const cases = [
    { window: "blaenau", name: "Afon Du-Bâch", bridge: "bridge-blaenau-270497589" },
    { window: "vale-north", name: "Afon Teigl", bridge: "bridge-vale-north-159027365" },
    { window: "vale-north", name: "Nant Llyn-morwynion", bridge: "bridge-vale-north-271936916" },
    { window: "vale-south", name: "Afon Cynfal", bridge: "bridge-vale-south-159029792" },
  ];
  for (const c of cases) {
    it(`${c.name} crosses the line under ${c.bridge}`, () => {
      const rivers = waterwayLines(osmOf(c.window)).filter((w) => w.name === c.name);
      expect(rivers.length, `${c.name} in ${c.window}/osm.geojson`).toBeGreaterThan(0);
      const crossings = rivers.flatMap((r) => routeCrossingsM(r.coords, route));
      expect(crossings.length).toBeGreaterThan(0);
      for (const d of crossings) expect(within(d, span(registerOf(c.window), c.bridge)), `${c.name} at ${d.toFixed(1)} m`).toBe(true);
      // the way that crosses is registered as water, with the km where it crosses
      const crossing = rivers.filter((r) => routeCrossingsM(r.coords, route).length > 0);
      const entries = registerOf(c.window).filter((e) => crossing.some((r) => e.source.ref === r.id));
      expect(entries.length).toBe(crossing.length);
      expect(entries.every((e) => e.kind === "water" && e.id.startsWith("waterway-") && (e.crossingsKm ?? []).length > 0)).toBe(true);
    });
  }

  it("the 33 kV line crosses at km 8.31 with lattice towers within 35 m either side (the map's pylons at 8.29)", () => {
    const osm = osmOf("vale-south");
    const line = powerLines(osm).find((l) => routeCrossingsM(l.coords, route).some((d) => Math.abs(d - 8306) < 30));
    expect(line?.kind).toBe("line");
    const towers = powerSupports(osm).filter((s) => s.kind === "tower" && line!.coords.some(([lon, lat]) => lon === s.at[0] && lat === s.at[1]));
    const at = (p: [number, number]) => route.project(p[0], p[1]);
    const near = towers.map((t) => {
      const p = at(t.at);
      return Math.min(...route.routePoints.map((r) => Math.hypot(r.x - p.x, r.y - p.y))) * 10; // world units are 10 m
    });
    expect(near.filter((m) => m < 35).length).toBeGreaterThanOrEqual(2);
  });
});

describe("the extras change nothing else", () => {
  for (const w of ["blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd", "corridor"]) {
    it(`${w}: the extras follow every earlier feature, and water, barriers and roads ignore them`, () => {
      const osm = osmOf(w);
      const isExtra = (f: OsmLine) => waterwayLines([f]).length + powerLines([f]).length + powerSupports([f]).length > 0;
      const first = osm.findIndex(isExtra);
      expect(first).toBeGreaterThan(0);
      expect(osm.slice(first).every(isExtra)).toBe(true);
      const rest = osm.slice(0, first);
      const ids = (o: OsmLine[]) => waterBodies(o, route.project, () => 0, 0).map((b) => b.id);
      expect(ids(osm)).toEqual(ids(rest));
      expect(barrierLines(osm)).toEqual(barrierLines(rest));
      // roads are drawn from the register's road refs: no extra is one
      const roads = new Set(registerOf(w).filter((f) => f.kind === "road").map((f) => f.source.ref));
      expect(osm.slice(first).filter((f) => roads.has(f.properties.id))).toEqual([]);
    });
  }
});

describe("ruins are walls without a roof", () => {
  const sq = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }, { x: 0, z: 1 }];
  const faces = (ruin: boolean) => {
    const g = buildingArrays([{ id: "r", ring: sq, heightM: 4, roof: "gabled", status: "existing", ...(ruin && { ruin }) }], () => 0, 1).groups[0];
    const up = Array.from({ length: g.normals.length / 3 }, (_, i) => g.normals[3 * i + 1]).filter((ny) => ny > 0.5).length;
    return { up, triangles: g.indices.length / 3 };
  };

  it("draws no roof on a ruin, and its walls faced inside and out", () => {
    expect(faces(false).up).toBeGreaterThan(0);
    expect(faces(true).up).toBe(0);
    expect(faces(true).triangles).toBe(16); // four walls, two triangles a side, two sides
  });

  it("the OSM ruins near the line are drawn as ruins, with their condition in the register", () => {
    for (const [w, ids] of [["vale-north", ["building-vale-north-462094631", "building-vale-north-6824976"]], ["maentwrog", ["building-maentwrog-373575645"]]] as const) {
      const list = validateBuildings(readJson<unknown>(`public/data/sections/${w}/buildings.json`), `${w}/buildings.json`);
      const reg = registerOf(w);
      const status = new Map(reg.filter((f) => f.kind === "building" && f.status).map((f) => [f.id, f.status as BuildingStatus]));
      const records = sectionBuildings(list, status, route.project, () => 0, 1).records;
      const osmValue = new Map(osmOf(w).map((f) => [f.properties.id, f.properties.tags.building]));
      for (const id of ids) {
        expect(records.find((r) => r.id === id)?.ruin, id).toBe(true);
        expect(reg.find((e) => e.id === id)?.condition).toBe("ruin");
        expect(osmValue.get(list.find((b) => b.id === id)!.osm!)).toBe("ruins");
      }
      // and every ruin the window draws is one OSM records
      for (const b of list.filter((x) => x.ruin)) expect(osmValue.get(b.osm!), b.id).toBe("ruins");
    }
  });
});

type Underbridge = { id: string; window: string; status: "adopted" | "uncertain"; centreKm: number; fromKm: number; toKm: number; replaces: string | null };
const UNDERBRIDGES = readJson<{ underbridges: Underbridge[] }>("data/lidar-underbridges.json").underbridges;
/** The profile's deepest dip below the chord across a span widened by 10 m each end (metres). */
function sag(p: TrailProfile, [a, b]: [number, number]): number {
  const idx = p.distanceM.map((d, i) => (d >= a - 10 && d <= b + 10 ? i : -1)).filter((i) => i >= 0);
  const [i0, i1] = [idx[0], idx[idx.length - 1]];
  const chord = (i: number) => p.elevationM[i0] + ((p.elevationM[i1] - p.elevationM[i0]) * (p.distanceM[i] - p.distanceM[i0])) / (p.distanceM[i1] - p.distanceM[i0]);
  return Math.max(...idx.map((i) => chord(i) - p.elevationM[i]));
}

describe("the lidar's underbridges keep the trail level", () => {
  const profileOf = (w: string) => readJson<TrailProfile>(`public/data/sections/${w}/trail-profile.json`);
  const osmBridgeSag = Math.max(...["blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"].flatMap((w) => profileOf(w).bridges!.map((s) => sag(profileOf(w), s))));

  it("every adopted one is a profile span, a registered deck and no sag beyond the OSM bridges'", () => {
    const adopted = UNDERBRIDGES.filter((u) => u.status === "adopted");
    expect(adopted.map((u) => u.id)).toEqual(expect.arrayContaining(["underbridge-6.308", "underbridge-7.356"]));
    for (const u of adopted) {
      const s: [number, number] = [u.fromKm * 1000, u.toKm * 1000];
      expect(profileOf(u.window).bridges, u.id).toContainEqual(s);
      expect(span(registerOf(u.window), `bridge-${u.window}-lidar-${u.centreKm.toFixed(3)}`)).toEqual(s);
      expect(sag(profileOf(u.window), s), u.id).toBeLessThanOrEqual(Math.max(osmBridgeSag, 0.05));
      if (u.replaces) expect(registerOf(u.window).find((e) => e.id === u.replaces), `${u.replaces} gone`).toBeUndefined();
    }
  });

  it("the vale-south corridor reports no fill at either opening and leaves the ground under them alone", () => {
    const w = "public/data/sections/vale-south";
    const header = readJson<DemGrid & { file: string; sourceFile: string }>(`${w}/dem.json`);
    const buf = readProjectFile(`${w}/${header.file}`);
    const dem: DemGrid = { ...header, heights: new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), sourceIndex: new Uint8Array(readProjectFile(`${w}/${header.sourceFile}`)) };
    const meta = readJson<{ legend: string[]; file: string }>(`${w}/landcover.json`);
    const land: LandCover = { legend: meta.legend, classes: new Uint8Array(readProjectFile(`${w}/${meta.file}`)) };
    const cfg = Object.values(SECTIONS).find((c) => c.window === "vale-south" && c.kind === "ground")!;
    const scene = buildSectionScene(cfg, { route, dem, land, profile: profileOf("vale-south"), osm: [], features: [] });
    for (const u of UNDERBRIDGES.filter((x) => x.window === "vale-south" && x.status === "adopted")) {
      const fills = scene.cutFill.filter((r) => r.kind === "fill" && r.toKm >= u.fromKm - 0.005 && r.fromKm <= u.toKm + 0.005);
      expect(fills, u.id).toEqual([]);
      // the opening: the ground on the centreline stays metres below the deck
      const s = scene.trail.sampleAt(u.centreKm * 1000);
      expect((s.y - scene.heightAt(s.x, s.z)) * 10, u.id).toBeGreaterThan(2);
    }
  });
});

// the ground windows' km ranges (scripts/build_section_data.py SECTIONS)
const WINDOW_KM: Record<string, [number, number]> = { blaenau: [0, 1.5], "vale-north": [1.5, 4.8], "vale-south": [4.8, 7.7], maentwrog: [7.7, 9.7], trawsfynydd: [9.7, 13.24] };
type Crossing = { id: string; km: number; uncertaintyM: number; window: string; side: string; confidence: string; source: string; image: string; conflict?: string };
describe("evidence-only level crossings", () => {
  const doc = readJson<{ source: string; crossings: Crossing[] }>("data/evidence-crossings.json");

  it("are points with a chainage, side, confidence and source, and no geometry", () => {
    expect(doc.crossings.map((c) => c.km)).toEqual([3.7, 6.17, 8.21, 10.0, 12.15]);
    for (const c of doc.crossings) {
      expect(c.source).toBe("Gwynedd Council map capture, position only, Crown copyright — evidence, not reproduced");
      expect(["high", "medium", "low"]).toContain(c.confidence);
      expect(c.side.length).toBeGreaterThan(0);
      const [k0, k1] = WINDOW_KM[c.window];
      expect(c.km >= k0 && c.km <= k1, `${c.id} in ${c.window}`).toBe(true);
      expect(existsSync(resolve(ROOT, c.image)), c.image).toBe(true);
      expect(JSON.stringify(c)).not.toMatch(/coordinates|lon|lat/);
    }
    const lc = doc.crossings.find((c) => c.km === 10.0)!;
    expect(lc.conflict).toMatch(/way\/1231939367/);
  });

  it("are not where OSM already has a road across the line (that is why they are recorded)", () => {
    for (const c of doc.crossings) {
      const roads = new Set(registerOf(c.window).filter((f) => f.kind === "road").map((f) => f.source.ref));
      const near = osmOf(c.window)
        .filter((f) => roads.has(f.properties.id) && f.geometry.type === "LineString")
        .flatMap((f) => routeCrossingsM(f.geometry.coordinates as [number, number][], route))
        .filter((d) => Math.abs(d - c.km * 1000) <= c.uncertaintyM);
      expect(near, c.id).toEqual([]);
    }
  });
});
