import { describe, expect, it } from "vitest";
import { loadSection } from "../../src/blender/loadSection";
import { placePower, supportHeightM, voltageOf } from "../../src/three-core/power";
import type { OsmLine } from "../../src/three-core/registers";
import { buildSectionScene, configById } from "../../src/three-core/sections";
import { ROOT } from "./fixtures";

// Power lines for the Blender build (existing, OSM): supports from the power=tower|pole nodes, heights from their tags
// or typical for the voltage, and each line as the run of supports its way passes through.

const identity = (lon: number, lat: number) => ({ x: lon, y: lat });
const way = (id: string, coords: [number, number][], tags: Record<string, string>): OsmLine => ({ properties: { id, tags: { power: "line", ...tags } }, geometry: { type: "LineString", coordinates: coords } });
const node = (id: string, at: [number, number], tags: Record<string, string>): OsmLine => ({ properties: { id, tags }, geometry: { type: "Point", coordinates: at } });

describe("power supports and lines (synthetic)", () => {
  it("reads the highest voltage a tag lists, and gives typical heights by kind and voltage", () => {
    expect(voltageOf("400000;132000")).toBe(400000);
    expect(voltageOf("33000")).toBe(33000);
    expect(voltageOf(undefined)).toBeUndefined();
    expect(supportHeightM("pole", 11000)).toBe(9.5);
    expect(supportHeightM("pole", 33000)).toBe(11);
    expect(supportHeightM("tower", 33000)).toBe(13);
    expect(supportHeightM("tower", 132000)).toBe(27);
    expect(supportHeightM("tower", 400000)).toBe(46);
  });

  it("stands tagged towers, an untagged vertex as an implied support, and joins them in the way's order", () => {
    const osm = [
      way("way/1", [[0, 0], [10, 0], [20, 0]], { voltage: "33000", cables: "3" }),
      node("node/1", [0, 0], { power: "tower" }),
      node("node/2", [20, 0], { power: "tower", height: "15" }),
    ];
    const { supports, lines } = placePower(osm, identity, (x) => x / 100);
    expect(supports.map((s) => [s.id, s.kind, s.heightM, s.heightSource])).toEqual([
      ["node/1", "tower", 13, "default"],
      ["way/1@10,0", "pole", 11, "default"],
      ["node/2", "tower", 15, "osm"],
    ]);
    expect(supports[1].implied).toBe(true);
    expect(supports.map((s) => s.y)).toEqual([0, 0.1, 0.2]);
    expect(lines).toEqual([{ id: "way/1", kind: "line", voltageV: 33000, cables: 3, supports: [0, 1, 2] }]);
  });

  it("splits a line where a support stands off the window's ground, and shares a support between lines", () => {
    const osm = [
      way("way/1", [[0, 0], [10, 0], [20, 0], [30, 0]], { voltage: "400000", cables: "6" }),
      way("way/2", [[30, 0], [30, 10]], { power: "minor_line" }),
      node("node/9", [30, 0], { power: "tower" }),
    ];
    const { supports, lines } = placePower(osm, identity, (x) => (x === 10 ? -Infinity : 0));
    expect(lines.map((l) => [l.id, l.supports.length])).toEqual([["way/1", 2], ["way/2", 2]]);
    const shared = supports.findIndex((s) => s.id === "node/9");
    expect(lines[0].supports).toContain(shared);
    expect(lines[1].supports).toContain(shared);
    expect(supports[shared]).toMatchObject({ kind: "tower", voltageV: 400000, heightM: 46 });
    // the 400 kV line's untagged vertex is a tower; the minor line's an 11 kV pole
    expect(supports.find((s) => s.id === "way/1@20,0")?.kind).toBe("tower");
    expect(supports.find((s) => s.id === "way/2@30,10")).toMatchObject({ kind: "pole", heightM: 9.5 });
  });
});

describe("power lines in the Maentwrog window's photo look", () => {
  const cfg = configById("maentwrog");
  const { inputs } = loadSection(ROOT, cfg, { canopy: true, barriers: true });
  const scene = buildSectionScene(cfg, inputs, "photo");
  const { supports, lines } = scene.power;

  it("stands every support on the rendered ground, as existing OSM features", () => {
    expect(supports.length).toBeGreaterThan(50);
    for (const s of supports) expect(s.y, s.id).toBeCloseTo(scene.surfaceAt(s.x, s.z), 9);
    // most supports are mapped nodes, not implied
    expect(supports.filter((s) => !s.implied).length / supports.length).toBeGreaterThan(0.8);
  });

  it("carries the 400 kV line on 46 m towers and the 33 kV line on towers of about 13 m", () => {
    const of = (v: number) => lines.filter((l) => l.voltageV === v).flatMap((l) => l.supports.map((i) => supports[i]));
    const big = of(400000).filter((s) => s.kind === "tower");
    expect(big.length).toBeGreaterThan(5);
    expect(big.every((s) => s.heightM === 46)).toBe(true);
    const small = of(33000).filter((s) => s.kind === "tower" && (s.voltageV ?? 0) <= 33000);
    expect(small.length).toBeGreaterThan(5);
    expect(small.every((s) => s.heightM >= 10 && s.heightM <= 15)).toBe(true);
    for (const l of lines) {
      expect(l.supports.length).toBeGreaterThanOrEqual(2);
      expect(l.cables).toBeGreaterThanOrEqual(1);
      expect(l.cables).toBeLessThanOrEqual(6);
    }
  });

  it("draws nothing in the concept look", () => {
    const concept = buildSectionScene(cfg, inputs, "concept");
    expect(concept.power.supports).toEqual([]);
    expect(concept.waterways).toEqual([]);
  });
});
