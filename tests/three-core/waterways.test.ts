import { describe, expect, it } from "vitest";
import { loadSection } from "../../src/blender/loadSection";
import { centrelineIndex } from "../../src/three-core/trail";
import type { OsmLine } from "../../src/three-core/registers";
import { buildSectionScene, configById } from "../../src/three-core/sections";
import { roadWidthM } from "../../src/three-core/roads";
import { BANK_CLEAR_M, clearOfChannels, sectionChannels, SURFACE_BELOW_M, WATERWAY_WIDTH_M, type Channel, type ChannelOptions } from "../../src/three-core/waterways";
import { CLEAR_OF_WATER_M } from "../../src/three-core/dressing";
import { analyticTrail, ROOT, syntheticProfile } from "./fixtures";

// Rivers and streams for the Blender build (the council map reviews of 2026-11-02): OSM's watercourses at default
// widths, their surface just below the ground across the channel, left out where the water goes under the trail's
// formation (an implied culvert), a road, a building or a tagged culvert or tunnel, and passing under the line's bridges.

// a synthetic window in world units (1 = 10 m): the identity projection, a trail along +x, ground tilted across it
const trail = analyticTrail(1000, syntheticProfile(1000));
const ground = (x: number, z: number) => 2 + 0.05 * z + 0.02 * Math.sin(x * 3);
const base: ChannelOptions = { project: (lon, lat) => ({ x: lon, y: lat }), surfaceAt: ground, trail, spans: [], roads: [], water: [], footprints: [], spacingM: 4, ve: 1 };
const stream = (id: string, tags: Record<string, string>, x = 50): OsmLine => ({ properties: { id, tags: { waterway: "stream", ...tags } }, geometry: { type: "LineString", coordinates: [[x, -10], [x, 10]] } });
const foot = centrelineIndex(trail, 10);
const lateralM = (p: { x: number; z: number }) => (foot(p.x, p.z)?.lateral ?? Infinity) * 10;

describe("watercourse channels (synthetic)", () => {
  it("draws a stream at its default width, or at a tagged one, and says which", () => {
    const [a] = sectionChannels([stream("way/1", {})], base);
    expect(a).toMatchObject({ id: "way/1", kind: "stream", widthM: WATERWAY_WIDTH_M.stream, widthSource: "default" });
    const [b] = sectionChannels([stream("way/2", { width: "3" })], base);
    expect(b).toMatchObject({ widthM: 3, widthSource: "osm" });
    expect(WATERWAY_WIDTH_M).toMatchObject({ river: 5, stream: 1.8, drain: 0.8, ditch: 0.8 });
  });

  it("keeps the surface just below the lowest ground across the channel, never above it", () => {
    const [c] = sectionChannels([stream("way/1", {}, 20)], base);
    const half = WATERWAY_WIDTH_M.stream / 2 / 10;
    for (const p of c.runs.flat()) {
      // the channel runs along z here, so across it is along x
      const lowest = Math.min(...[-half, -half / 2, 0, half / 2, half].map((dx) => ground(p.x + dx, p.z)));
      // at most SURFACE_BELOW_M under the lowest sample across, less any lower ground round the channel's edge
      expect(p.y).toBeLessThanOrEqual(lowest - SURFACE_BELOW_M / 10 + 1e-12);
      expect(p.y).toBeGreaterThan(lowest - SURFACE_BELOW_M / 10 - 0.01);
      for (const dx of [-half, 0, half]) expect(p.y).toBeLessThan(ground(p.x + dx, p.z));
    }
  });

  it("leaves out tagged culverts and tunnels", () => {
    expect(sectionChannels([stream("way/1", { tunnel: "culvert" }), stream("way/2", { culvert: "yes" }), stream("way/3", { tunnel: "yes" })], base)).toEqual([]);
  });

  it("goes under the trail's formation only at a bridge: elsewhere the embankment implies a culvert", () => {
    const [culverted] = sectionChannels([stream("way/1", {})], base);
    expect(culverted.runs.length).toBe(2);
    const formationM = 3 / 2 + 1 + 4 * Math.SQRT2 + 1;
    for (const p of culverted.runs.flat()) expect(lateralM(p)).toBeGreaterThan(formationM - 1e-6);
    const [bridged] = sectionChannels([stream("way/1", {})], { ...base, spans: [[490, 510]] });
    expect(bridged.runs.length).toBe(1);
    expect(Math.min(...bridged.runs[0].map(lateralM))).toBeLessThan(1);
  });

  it("leaves out the water under a road's carriageway or a building, with room for its bank, and inside a mapped water area", () => {
    const road = { coords: [[20, -10], [80, -10]] as [number, number][], highway: "unclassified" };
    // the stream at x = 20 ends on the road (z = -10): its last points are under the carriageway
    const [c] = sectionChannels([stream("way/1", {}, 20)], { ...base, roads: [road] });
    const clearM = roadWidthM("unclassified") / 2 + WATERWAY_WIDTH_M.stream / 2 + BANK_CLEAR_M;
    for (const p of c.runs.flat()) expect(Math.abs(p.z + 10) * 10).toBeGreaterThanOrEqual(clearM - 1e-9);
    const box = [{ x: 19, z: 4 }, { x: 21, z: 4 }, { x: 21, z: 6 }, { x: 19, z: 6 }];
    const [d] = sectionChannels([stream("way/1", {}, 20)], { ...base, footprints: [box] });
    const bank = (WATERWAY_WIDTH_M.stream / 2 + BANK_CLEAR_M) / 10 - 1e-9; // the half-width and the bank, in world units
    expect(d.runs.flat().some((p) => p.z > 4 - bank && p.z < 6 + bank)).toBe(false);
    const [e] = sectionChannels([stream("way/1", {}, 20)], { ...base, water: [{ id: "way/9", polygons: [{ outer: box, holes: [] }], surfaceY: 0, areaM2: 400 }] });
    expect(e.runs.flat().some((p) => p.z > 4 && p.z < 6)).toBe(false);
  });

  it("keeps instances clear of the water by a margin beyond its half-width", () => {
    const ch = sectionChannels([stream("way/1", {}, 20)], base);
    const pts = [0.05, 0.12, 0.2, 0.3].map((dx) => ({ x: 20 + dx, z: 5 }));
    // half-width 0.9 m and a 1.2 m margin: within 2.1 m (0.21 units) goes
    expect(clearOfChannels(pts, ch, 1.2).map((p) => p.x)).toEqual([20.3]);
  });
});

// the rivers under the line's bridges (registered spans; tests/three-core/osm-extras.test.ts finds the crossings)
const CASES = [
  { config: "blaenau", name: "Afon Du-Bâch", span: [745.7, 755.9] },
  { config: "vale-north", name: "Afon Teigl", span: [3766.6, 3800.3] },
  { config: "vale-south", name: "Afon Cynfal", span: [6604.5, 6669.9] },
] as const;

describe("watercourses in the windows' photo look", () => {
  for (const c of CASES) {
    describe(c.config, () => {
      const cfg = configById(c.config);
      const { inputs } = loadSection(ROOT, cfg, { canopy: true, barriers: true });
      const scene = buildSectionScene(cfg, inputs, "photo");
      const near = centrelineIndex(scene.trail, 2);

      it(`runs ${c.name} under its bridge, metres below the deck`, () => {
        const named = scene.waterways.filter((w) => w.name === c.name);
        expect(named.length, c.name).toBeGreaterThan(0);
        const under = named.flatMap((w) => w.runs.flat()).filter((p) => {
          const f = near(p.x, p.z);
          return f !== null && f.lateral * 10 <= 3 && f.distM >= c.span[0] && f.distM <= c.span[1];
        });
        expect(under.length, `${c.name} under the span`).toBeGreaterThan(0);
        for (const p of under) expect((scene.trail.sampleAt(near(p.x, p.z)!.distM).y - p.y) * 10, c.name).toBeGreaterThan(2);
      });

      it("keeps every channel's surface below the rendered ground across it", () => {
        const all: Channel[] = scene.waterways;
        expect(all.length).toBeGreaterThan(5);
        for (const w of all) {
          for (const r of w.runs) {
            for (let k = 0; k < r.length; k++) {
              const [a, b] = [r[Math.max(0, k - 1)], r[Math.min(r.length - 1, k + 1)]];
              const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
              const [nx, nz] = [-(b.z - a.z) / len, (b.x - a.x) / len];
              for (const f of [-0.5, 0, 0.5]) {
                const g = scene.surfaceAt(r[k].x + (nx * f * w.widthM) / 10, r[k].z + (nz * f * w.widthM) / 10);
                if (Number.isFinite(g)) expect(r[k].y, `${w.id} point ${k}`).toBeLessThan(g); // (no ground beyond the window's edge)
              }
            }
          }
        }
      });

      it("keeps trees and grass out of the channels", () => {
        const water = scene.waterways.flatMap((w) => w.runs.flat().map((p) => ({ ...p, half: w.widthM / 2 })));
        const nearest = (t: { x: number; z: number }, margin: number) => water.some((p) => Math.hypot(p.x - t.x, p.z - t.z) * 10 < p.half + margin - 1.05); // points are 2 m apart: 1 m slack
        const trees = [...scene.trees.conifer, ...scene.trees.broadleaf];
        expect(trees.filter((t) => nearest(t, CLEAR_OF_WATER_M.tree)).length).toBe(0);
        expect(scene.grass.filter((_, i) => i % 7 === 0).filter((g) => nearest(g, CLEAR_OF_WATER_M.grass)).length).toBe(0);
      });
    });
  }
});
