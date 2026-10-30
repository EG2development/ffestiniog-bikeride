import { describe, expect, it } from "vitest";
import { defaultCyclistDims, type CyclistDims } from "../../src/three-core/cyclistMotion";
import type { Vec3 } from "../../src/three-core/types";
import { load } from "./pending";

// The cyclist is built from its dimensions and measured as built (spec RL16, C1; ADR 34).
type Part = { kind: "capsule" | "sphere" | "torus" | "box"; a: Vec3; b?: Vec3; r: number; material: string; name?: string };
type Mod = { cyclistParts: (dims: CyclistDims, crankAngle: number, wheelAngle: number) => Part[]; partsBounds: (parts: Part[]) => { min: Vec3; max: Vec3 } };
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("cyclistParts (RL16, C1)", () => {
  it("builds a model inside C1's ranges from the default dimensions", async () => {
    const { cyclistParts, partsBounds } = await load<Mod>("src/three-core/cyclistModel.ts");
    const parts = cyclistParts(defaultCyclistDims(), 0, 0);
    expect(parts.length).toBeGreaterThan(10);
    for (const p of parts) {
      expect([...p.a, ...(p.b ?? []), p.r].every(Number.isFinite), p.name ?? p.kind).toBe(true);
      expect(["frame", "tyre", "rim", "rider", "helmet", "skin"]).toContain(p.material);
    }
    const { min, max } = partsBounds(parts);
    const height = (max[1] - min[1]) * 10; // bike space is in world units (1 = 10 m)
    const length = (max[0] - min[0]) * 10;
    expect(height).toBeGreaterThanOrEqual(1.5);
    expect(height).toBeLessThanOrEqual(1.9);
    expect(length).toBeGreaterThanOrEqual(1.6);
    expect(length).toBeLessThanOrEqual(1.9);
    const tyres = parts.filter((p) => p.material === "tyre");
    expect(tyres.length).toBe(2);
    for (const t of tyres) expect((t.r * 2 * 10) / 1).toBeGreaterThanOrEqual(0.62), expect(t.r * 2 * 10).toBeLessThanOrEqual(0.72);
  });

  it("keeps each leg's thigh and shin at their lengths for every crank angle (feet on the pedals)", async () => {
    const { cyclistParts } = await load<Mod>("src/three-core/cyclistModel.ts");
    const lengths = new Map<string, number[]>();
    for (const crank of [0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6]) {
      for (const p of cyclistParts(defaultCyclistDims(), crank, crank * 3)) {
        if (!p.name || !/^(thigh|shin)-(left|right)$/.test(p.name)) continue;
        expect(p.b, p.name).toBeDefined();
        (lengths.get(p.name) ?? lengths.set(p.name, []).get(p.name)!).push(dist(p.a, p.b!));
      }
    }
    expect([...lengths.keys()].sort()).toEqual(["shin-left", "shin-right", "thigh-left", "thigh-right"]);
    for (const [name, ls] of lengths) {
      expect(ls.length, name).toBe(9);
      for (const l of ls) expect(l).toBeCloseTo(ls[0], 6);
    }
  });
});
