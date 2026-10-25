import { describe, expect, it } from "vitest";
import { defaultCyclistDims, distanceTable, speedKmh } from "../../src/three-core/cyclistMotion";
import { expectCyclistCriteria } from "./criteria";
import { analyticTrail, syntheticProfile } from "./fixtures";

const FPS = 30;

describe("cyclist (C1–C7)", () => {
  it("C1: proportions of the procedural bike and rider", () => {
    const d = defaultCyclistDims();
    expect(d.ridingHeightM).toBeGreaterThanOrEqual(1.5);
    expect(d.ridingHeightM).toBeLessThanOrEqual(1.9);
    expect(d.lengthM).toBeGreaterThanOrEqual(1.6);
    expect(d.lengthM).toBeLessThanOrEqual(1.9);
    expect(d.wheelDiameterM).toBeGreaterThanOrEqual(0.62);
    expect(d.wheelDiameterM).toBeLessThanOrEqual(0.72);
    expect(d.lateralOffsetM).toBeLessThanOrEqual(1.0);
  });

  it("C2: speed is 12–25 km/h and lower uphill than downhill", () => {
    for (let g = -0.15; g <= 0.15; g += 0.005) {
      expect(speedKmh(g)).toBeGreaterThanOrEqual(12);
      expect(speedKmh(g)).toBeLessThanOrEqual(25);
    }
    expect(speedKmh(0.021)).toBeLessThan(speedKmh(-0.021));
  });

  it("C2–C7 hold at every frame of a 12 s ride over gradients of −4 % to +6 % and a curve", () => {
    const trail = analyticTrail(1000, syntheticProfile(1000));
    const table = distanceTable(trail, 100, 360, FPS);
    expect(table.length).toBe(360);
    expectCyclistCriteria(trail, table, FPS, defaultCyclistDims());
  });

  it("the distance table is deterministic", () => {
    const trail = analyticTrail(1000, syntheticProfile(1000));
    expect(distanceTable(trail, 100, 360, FPS)).toEqual(distanceTable(trail, 100, 360, FPS));
  });
});
