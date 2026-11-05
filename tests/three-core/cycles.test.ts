import { describe, expect, it } from "vitest";
import { choreograph, closeCalls } from "../../src/three-core/choreography";
import { checkCycle, CYCLES, cyclePace } from "../../src/three-core/cycles";
import { walkerTable, type WalkerSpec } from "../../src/three-core/walkers";
import { analyticTrail, syntheticProfile } from "./fixtures";

// The community film's cargo cycles (src/three-core/cycles.ts): what they may carry and who rides them, their gentler
// pace, and their full length kept clear of the people they meet on the path.

const FPS = 30;
const trail = analyticTrail(1000, syntheticProfile(1000));
const rider = (extra: Partial<WalkerSpec>): WalkerSpec => ({ startDistM: 200, direction: 1, sideM: -0.5, heightM: 1.72, seed: 31, activity: "cycle", ...extra });

describe("cargo cycles", () => {
  it("carry children or shopping only as a cargo cycle, ridden as its own kind of cycle by an adult, two children at most", () => {
    expect(() => checkCycle(rider({ cycle: "cargo", carries: { children: [0.95, 1.0] } }), 0)).not.toThrow();
    expect(() => checkCycle(rider({ cycle: "longtail", carries: { shopping: true } }), 0)).not.toThrow();
    expect(() => checkCycle(rider({ activity: "trike", cycle: "christiania", carries: { children: [1.0, 1.1] } }), 0)).not.toThrow();
    expect(() => checkCycle(rider({ carries: { shopping: true } }), 0)).toThrow(/without a cargo cycle/);
    expect(() => checkCycle(rider({ cycle: "christiania" }), 0)).toThrow(/ridden as trike/);
    expect(() => checkCycle(rider({ activity: "walk", cycle: "cargo" }), 0)).toThrow(/ridden as cycle/);
    expect(() => checkCycle(rider({ cycle: "cargo", role: "pupil" }), 0)).toThrow(/an adult rides/);
    expect(() => checkCycle(rider({ cycle: "cargo", carries: { children: [1, 1, 1] } }), 0)).toThrow(/seats 2/);
    expect(() => checkCycle(rider({ cycle: "longtail", carries: { children: [1.5] } }), 0)).toThrow(/outside/);
  });

  it("ride more gently than a hybrid, loaded at the front, and a long-tail at a hybrid's pace", () => {
    expect(cyclePace(rider({ cycle: "longtail" }))).toBe(1);
    // a long john against a hybrid, a box tricycle against an adult tricycle
    for (const [kind, activity] of [["cargo", "cycle"], ["christiania", "trike"]] as const) {
      const plain = walkerTable(trail, rider({ activity }), 300, FPS);
      const loaded = walkerTable(trail, rider({ activity, cycle: kind }), 300, FPS);
      expect(cyclePace(rider({ activity, cycle: kind })), kind).toBeLessThan(1);
      expect(loaded[299] - loaded[0], kind).toBeLessThan(plain[299] - plain[0]);
      expect(loaded[299] - loaded[0], kind).toBeGreaterThan(0.75 * (plain[299] - plain[0]));
    }
    expect(cyclePace(rider({}))).toBe(1);
  });

  it("are kept clear along their whole length: a long john's box ahead of its rider, a long-tail's deck behind", () => {
    expect(CYCLES.cargo.reachM[1]).toBeGreaterThan(1.5);
    expect(CYCLES.longtail.reachM[0]).toBeGreaterThan(1.2);
    expect(CYCLES.christiania.halfM).toBeGreaterThanOrEqual(0.45);
    const specs: WalkerSpec[] = [
      rider({ cycle: "cargo", carries: { children: [1.0] } }),
      { startDistM: 260, direction: -1, sideM: -0.5, heightM: 1.66, seed: 32 },
      { startDistM: 265, direction: -1, sideM: 0.3, heightM: 1.7, seed: 33 },
    ];
    const choreo = choreograph(trail, specs, 900, FPS);
    const minM = (a: string, b: string) => (a === "walk" || b === "walk" ? 0.3 : 0.25);
    expect(closeCalls(specs, choreo, { minM })).toEqual([]);
  });
});
