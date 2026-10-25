import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../src/three-core/rng";

describe("mulberry32 (RN1, RN2, ADR 11)", () => {
  it("gives the same sequence for the same seed", () => {
    const a = mulberry32(20261025);
    const b = mulberry32(20261025);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("gives different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const same = Array.from({ length: 20 }, () => a() === b()).filter(Boolean).length;
    expect(same).toBeLessThan(20);
  });

  it("stays in [0, 1) with a mean near 0.5", () => {
    const r = mulberry32(42);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10000).toBeGreaterThan(0.48);
    expect(sum / 10000).toBeLessThan(0.52);
  });
});
