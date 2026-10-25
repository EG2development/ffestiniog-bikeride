import { describe, expect, it } from "vitest";
import { buildTrail, TRAIL_WIDTH_M, type Trail } from "../../src/three-core/trail";
import { lerpProfile, syntheticProfile, syntheticRoute } from "./fixtures";

const SECTION = { startKm: 0.1, endKm: 0.9 };

function build(): { trail: Trail; route: ReturnType<typeof syntheticRoute>; profile: ReturnType<typeof syntheticProfile> } {
  const route = syntheticRoute();
  const profile = syntheticProfile(1200);
  return { route, profile, trail: buildTrail(route, profile, SECTION, { widthM: TRAIL_WIDTH_M, ve: 1 }) };
}

/** Horizontal distance from (x, z) to the trail centreline polyline. */
function distToCentreline(trail: Trail, x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < trail.samples.length; i++) {
    const a = trail.samples[i];
    const b = trail.samples[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz)));
  }
  return best;
}

describe("buildTrail", () => {
  it("G1: centreline equals project() at every route vertex in the section, and between them", () => {
    const { route, trail } = build();
    const inSection = route.routePoints.filter((p) => p.dist >= 100 && p.dist <= 900);
    expect(inSection.length).toBeGreaterThan(10);
    for (const p of inSection) {
      const s = trail.sampleAt(p.dist);
      expect(Math.abs(s.x - p.x), `x at ${p.dist.toFixed(1)} m`).toBeLessThan(1e-6);
      expect(Math.abs(s.z - p.y), `z at ${p.dist.toFixed(1)} m`).toBeLessThan(1e-6);
    }
    for (let i = 0; i + 1 < inSection.length; i++) {
      const a = inSection[i];
      const b = inSection[i + 1];
      const s = trail.sampleAt((a.dist + b.dist) / 2);
      expect(Math.abs(s.x - (a.x + b.x) / 2)).toBeLessThan(1e-6);
      expect(Math.abs(s.z - (a.y + b.y) / 2)).toBeLessThan(1e-6);
    }
  });

  it("G4: surface follows the profile (within 0.1 units), 0.05 m above it", () => {
    const { profile, trail } = build();
    const offsets: number[] = [];
    profile.distanceM.forEach((d, i) => {
      if (d < 100 || d > 900) return;
      const diff = trail.sampleAt(d).y - profile.elevationM[i] / 10;
      expect(Math.abs(diff), `height at ${d} m`).toBeLessThanOrEqual(0.1);
      offsets.push(diff * 10);
    });
    const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    expect(mean).toBeGreaterThan(0.03);
    expect(mean).toBeLessThan(0.07);
  });

  it("TR1: the ribbon is the configured width, inside 2.5–4.0 m", () => {
    expect(TRAIL_WIDTH_M).toBeGreaterThanOrEqual(2.5);
    expect(TRAIL_WIDTH_M).toBeLessThanOrEqual(4.0);
    const { trail } = build();
    const pos = trail.ribbon.positions;
    expect(pos.length).toBeGreaterThan(0);
    for (let i = 0; i < pos.length; i += 3) {
      const halfWidthM = distToCentreline(trail, pos[i], pos[i + 2]) * 10;
      expect(Math.abs(halfWidthM - TRAIL_WIDTH_M / 2), `ribbon vertex ${i / 3}`).toBeLessThan(0.01);
    }
  });

  it("TR2: gradients come from the profile, and the maximum is reported", () => {
    const { profile, trail } = build();
    for (const s of trail.samples) {
      const expected = (lerpProfile(profile, s.distM + 1) - lerpProfile(profile, s.distM - 1)) / 2;
      expect(Math.abs(s.gradient - expected), `gradient at ${s.distM} m`).toBeLessThan(0.005);
    }
    expect(trail.maxGradient).toBeCloseTo(Math.max(...trail.samples.map((s) => Math.abs(s.gradient))), 12);
  });

  it("is deterministic", () => {
    expect(build().trail.samples).toEqual(build().trail.samples);
  });
});
