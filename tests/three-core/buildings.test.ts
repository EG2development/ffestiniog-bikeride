import { describe, expect, it } from "vitest";
import { load, loadExports } from "./pending";

// Buildings sit on the ground, stay off roads, don't overlap, and draw cheaply (spec BL5, BL7–BL11, BL14;
// ADRs 49, 50; pseudocode-reel-v2 §5.4, §5.5).
type XZ = { x: number; z: number };
type Rec = { id: string; ring: XZ[]; heightM: number; roof: "flat" | "gabled"; status: "existing" | "construction" | "approved" | "demolished" };
type Group = { kind: "existing" | "translucent"; positions: Float32Array; indices: Uint32Array };
type Mod = {
  buildingBase: (ring: XZ[], heightAt: (x: number, z: number) => number) => number;
  buildingArrays: (records: Rec[], heightAt: (x: number, z: number) => number, ve: number) => { groups: Group[] };
  footprintOverlap: (a: XZ[], b: XZ[]) => number;
  segmentsInFootprints: (lines: XZ[][], fps: { id: string; ring: XZ[] }[]) => string[];
  landmarkParts: (model: { type: "church"; lengthM: number; widthM: number; heightM: number; towerHeightM: number }) => { bounds: { min: [number, number, number]; max: [number, number, number] } };
};
const NAMES: (keyof Mod & string)[] = ["buildingBase", "buildingArrays", "footprintOverlap", "segmentsInFootprints", "landmarkParts"];
const sq = (x0: number, z0: number, s: number): XZ[] => [{ x: x0, z: z0 }, { x: x0 + s, z: z0 }, { x: x0 + s, z: z0 + s }, { x: x0, z: z0 + s }];
const slope = (x: number) => 0.1 * x; // rises 1 m every 10 m

describe("buildings on the ground (BL5)", () => {
  it("bases a building at the lowest ground under its footprint", async () => {
    const { buildingBase } = await loadExports<Mod>("src/three-core/buildings.ts", NAMES);
    expect(buildingBase(sq(0, 0, 2), slope)).toBeCloseTo(0, 6);
  });

  it("has no floating wall and rises clear of the highest ground under it", async () => {
    const { buildingArrays } = await loadExports<Mod>("src/three-core/buildings.ts", NAMES);
    const { groups } = buildingArrays([{ id: "b", ring: sq(0, 0, 2), heightM: 6, roof: "flat", status: "existing" }], slope, 1);
    const p = groups.flatMap((g) => Array.from({ length: g.positions.length / 3 }, (_, i) => ({ x: g.positions[3 * i], y: g.positions[3 * i + 1], z: g.positions[3 * i + 2] })));
    const corners = sq(0, 0, 2);
    for (const c of corners) {
      const lowest = Math.min(...p.filter((q) => Math.abs(q.x - c.x) < 1e-6 && Math.abs(q.z - c.z) < 1e-6).map((q) => q.y));
      expect(lowest, `wall foot at (${c.x}, ${c.z})`).toBeLessThanOrEqual(slope(c.x) + 1e-6);
    }
    expect(Math.max(...p.map((q) => q.y))).toBeGreaterThanOrEqual(Math.max(...corners.map((c) => slope(c.x))) + 0.2);
  });

  it("BL6: draws a building at its recorded height, the ridge of a gabled roof included", async () => {
    const { buildingArrays } = await loadExports<Mod>("src/three-core/buildings.ts", NAMES);
    const house: XZ[] = [{ x: 0, z: 0 }, { x: 1.2, z: 0 }, { x: 1.2, z: 0.8 }, { x: 0, z: 0.8 }]; // 12 m × 8 m
    for (const roof of ["flat", "gabled"] as const) {
      const { groups } = buildingArrays([{ id: "b", ring: house, heightM: 6, roof, status: "existing" }], () => 0, 1);
      const ys = Array.from(groups[0].positions).filter((_, i) => i % 3 === 1);
      expect(Math.max(...ys) * 10, `${roof} roof: top in metres`).toBeCloseTo(6, 1);
    }
  });
});

describe("buildings stay clear of roads and of each other (BL7, BL8)", () => {
  it("reports a line that runs through a footprint and none that runs around it", async () => {
    const { segmentsInFootprints } = await loadExports<Mod>("src/three-core/buildings.ts", NAMES);
    const fp = [{ id: "fp", ring: sq(0, 0, 2) }];
    expect(segmentsInFootprints([[{ x: -1, z: 1 }, { x: 3, z: 1 }]], fp)).toEqual(["fp"]);
    expect(segmentsInFootprints([[{ x: -1, z: -1 }, { x: 3, z: -1 }, { x: 3, z: 3 }]], fp)).toEqual([]);
  });

  it("measures overlap as a share of the smaller footprint", async () => {
    const { footprintOverlap } = await loadExports<Mod>("src/three-core/buildings.ts", NAMES);
    expect(footprintOverlap(sq(0, 0, 2), sq(0, 0, 2))).toBeCloseTo(1, 1);
    expect(footprintOverlap(sq(0, 0, 2), sq(5, 5, 2))).toBe(0);
    expect(footprintOverlap(sq(0, 0, 2), sq(1, 0, 2))).toBeCloseTo(0.5, 1);
  });
});

describe("drawing (BL10, BL14)", () => {
  it("merges every building into at most 3 groups and draws approved or demolished ones apart", async () => {
    const { buildingArrays } = await loadExports<Mod>("src/three-core/buildings.ts", NAMES);
    const recs: Rec[] = [
      ...Array.from({ length: 50 }, (_, i): Rec => ({ id: `b${i}`, ring: sq(i * 3, 0, 2), heightM: 6, roof: i % 2 ? "gabled" : "flat", status: "existing" })),
      { id: "planned", ring: sq(0, 10, 2), heightM: 9, roof: "flat", status: "approved" },
      { id: "gone", ring: sq(5, 10, 2), heightM: 9, roof: "flat", status: "demolished" },
    ];
    const { groups } = buildingArrays(recs, () => 0, 1);
    expect(groups.length).toBeLessThanOrEqual(3);
    expect(groups.map((g) => g.kind).sort()).toEqual(["existing", "translucent"]);
  });
});

describe("landmarks (BL9)", () => {
  it("builds a church from its recorded dimensions, within 10 %", async () => {
    const { landmarkParts } = await loadExports<Mod>("src/three-core/buildings.ts", NAMES);
    const { bounds } = landmarkParts({ type: "church", lengthM: 20, widthM: 8, heightM: 9, towerHeightM: 15 });
    const len = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]) * 10;
    expect(Math.abs(len - 20) / 20).toBeLessThanOrEqual(0.1);
    expect(Math.abs((bounds.max[1] - bounds.min[1]) * 10 - 15) / 15).toBeLessThanOrEqual(0.1);
  });
});

describe("loading per section (BL11)", () => {
  it("a section loads only its own buildings file", async () => {
    const { dataPaths } = await load<{ dataPaths: (s?: string) => Record<string, unknown> }>("src/data/Scene3DDataProvider.tsx");
    expect(dataPaths("trawsfynydd").buildings).toBe("data/sections/trawsfynydd/buildings.json");
    expect(JSON.stringify(dataPaths("trawsfynydd"))).not.toMatch(/maentwrog|blaenau|vale-/);
  });
});

describe("placing a section's buildings (BL3, BL5, BL9, BL10, BL16)", () => {
  type SB = { id: string; footprint: [number, number][]; heightM: number; roof: "flat" | "gabled"; kind: "background" | "landmark"; status: Rec["status"]; model?: { type: "church"; lengthM: number; widthM: number; heightM: number; towerHeightM: number } };
  type Placed = { records: { id: string; status: string }[]; groups: Group[]; landmarks: { id: string; origin: [number, number, number]; yaw: number }[] };
  type S = { sectionBuildings: (l: SB[], s: Map<string, Rec["status"]>, p: (lon: number, lat: number) => { x: number; y: number }, h: (x: number, z: number) => number, ve: number) => Placed };
  // lon → x and lat → −z, 1 degree = 100 units: west is −x
  const project = (lon: number, lat: number) => ({ x: lon * 100, y: -lat * 100 });
  const church: SB = {
    id: "building-x-1", kind: "landmark", status: "existing", heightM: 9, roof: "gabled",
    footprint: [[0, 0], [0.02, 0], [0.02, 0.008], [0, 0.008], [0, 0]], // 20 m east–west, 8 m north–south, closed as OSM gives it
    model: { type: "church", lengthM: 20, widthM: 8, heightM: 9, towerHeightM: 15 },
  };
  const house: SB = { id: "building-x-2", kind: "background", status: "existing", heightM: 6, roof: "flat", footprint: [[0.05, 0], [0.06, 0], [0.06, 0.01], [0.05, 0.01]] };

  it("draws only registered ids, with the register's status, and merges landmarks with the rest", async () => {
    const { sectionBuildings } = await loadExports<S>("src/three-core/buildings.ts", ["sectionBuildings"] as never);
    const out = sectionBuildings([church, house, { ...house, id: "building-x-9" }], new Map([["building-x-1", "existing"], ["building-x-2", "demolished"]]), project, () => 0, 1);
    expect(out.records.map((r) => [r.id, r.status])).toEqual([["building-x-1", "existing"], ["building-x-2", "demolished"]]);
    expect(out.groups.map((g) => g.kind).sort()).toEqual(["existing", "translucent"]);
  });

  it("puts a church's tower at the west end of its footprint, on the ground, at its recorded size", async () => {
    const { sectionBuildings } = await loadExports<S>("src/three-core/buildings.ts", ["sectionBuildings"] as never);
    const slope = (x: number) => 0.5 * x;
    const out = sectionBuildings([church], new Map([["building-x-1", "existing"]]), project, slope, 1);
    const [lm] = out.landmarks;
    expect(lm.origin[0], "the frame starts at the west end").toBeCloseTo(0, 1);
    expect(Math.abs(Math.cos(lm.yaw)), "and runs east–west").toBeCloseTo(1, 3);
    const p = out.groups[0].positions;
    const xs = Array.from(p).filter((_, i) => i % 3 === 0);
    const ys = Array.from(p).filter((_, i) => i % 3 === 1);
    expect((Math.max(...xs) - Math.min(...xs)) * 10, "length in metres").toBeCloseTo(20, 0);
    expect(Math.min(...ys), "lowest point at or below the lowest ground under it").toBeLessThanOrEqual(slope(0) + 1e-6);
    const towerX = xs.filter((_, i) => ys[i] > lm.origin[1] + 1.0); // only the tower rises above 10 m
    expect(Math.max(...towerX), "the tower stands at the west end").toBeLessThan(0.5);
  });
});

describe("roofs and walls fit the footprint (t10 M1, L2)", () => {
  type B = { buildingArrays: (r: Rec[], h: (x: number, z: number) => number, ve: number) => { groups: Group[] } };
  const ys = (g: Group) => Array.from(g.positions).filter((_, i) => i % 3 === 1);
  it("M1: draws a skewed quad flat, and a rectangle with a collinear extra node gabled", async () => {
    const { buildingArrays } = await loadExports<B>("src/three-core/buildings.ts", ["buildingArrays"] as never);
    const skew: XZ[] = [{ x: 0, z: 0 }, { x: 1.2, z: 0 }, { x: 1.5, z: 0.8 }, { x: 0.3, z: 0.8 }]; // a parallelogram, not a rectangle
    const flatTop = ys(buildingArrays([{ id: "s", ring: skew, heightM: 6, roof: "gabled", status: "existing" }], () => 0, 1).groups[0]);
    expect(new Set(flatTop.filter((y) => y > 0.01).map((y) => y.toFixed(4))).size, "one roof height: flat").toBe(1);
    const rect5: XZ[] = [{ x: 0, z: 0 }, { x: 0.6, z: 0 }, { x: 1.2, z: 0 }, { x: 1.2, z: 0.8 }, { x: 0, z: 0.8 }];
    const gabled = ys(buildingArrays([{ id: "r", ring: rect5, heightM: 6, roof: "gabled", status: "existing" }], () => 0, 1).groups[0]);
    expect(new Set(gabled.filter((y) => y > 0.01).map((y) => y.toFixed(4))).size, "eaves and ridge: gabled").toBe(2);
  });

  it("L2: every wall reaches the ground where it dips between corners", async () => {
    const { buildingArrays } = await loadExports<B>("src/three-core/buildings.ts", ["buildingArrays"] as never);
    const dip = (x: number, z: number) => -0.5 * Math.exp(-((x - 0.6) ** 2) / 0.01) * (z < 0.05 ? 1 : 0); // a 5 m dip under the south wall's middle
    const ring: XZ[] = [{ x: 0, z: 0 }, { x: 1.2, z: 0 }, { x: 1.2, z: 0.8 }, { x: 0, z: 0.8 }];
    const lowest = Math.min(...ys(buildingArrays([{ id: "d", ring, heightM: 6, roof: "flat", status: "existing" }], dip, 1).groups[0]));
    expect(lowest).toBeLessThanOrEqual(dip(0.6, 0) + 1e-6);
  });
});
