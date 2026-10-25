import { describe, expect, it } from "vitest";
import { flattenCorridor } from "../../src/three-core/trail";
import { analyticTrail, leftOf, meshHeightAt, syntheticProfile, worldGridAround } from "./fixtures";

const LENGTH = 1000;
const BRIDGE: [number, number] = [800, 820];

function run() {
  const trail = analyticTrail(LENGTH, syntheticProfile(LENGTH));
  const grid = worldGridAround(LENGTH);
  const original = Float32Array.from(grid.mesh.positions);
  const result = flattenCorridor(grid.mesh, trail, { widthM: 3, shoulderM: 1, spacingM: 4, bridges: [BRIDGE] });
  return { trail, grid, original, result };
}

const trailZ = (x: number) => 3 * Math.sin(x / 20);

describe("flattenCorridor", () => {
  it("G5a: terrain under the 3 m ribbon sits 0.05 m (±0.03 m) below it, outside bridge spans", () => {
    const { trail, grid, result } = run();
    for (let d = 20; d <= 980; d += 4) {
      if (d >= BRIDGE[0] - 5 && d <= BRIDGE[1] + 5) continue;
      const s = trail.sampleAt(d);
      const left = leftOf(s);
      for (let off = -1.5; off <= 1.5; off += 0.25) {
        const x = s.x + (left[0] * off) / 10;
        const z = s.z + (left[2] * off) / 10;
        const gapM = (s.y - meshHeightAt(grid, result.mesh, x, z)) * 10;
        expect(gapM, `d=${d} m, offset ${off} m`).toBeGreaterThanOrEqual(0.02);
        expect(gapM, `d=${d} m, offset ${off} m`).toBeLessThanOrEqual(0.08);
      }
    }
  });

  it("G5b: reports the 5 m hump as a cut and the 4 m hollow as a fill, deeper than 2 m", () => {
    const { result } = run();
    const covers = (km: number) => (r: { fromKm: number; toKm: number }) => r.fromKm <= km && km <= r.toKm;
    const cut = result.cutFill.find(covers(0.3));
    const fill = result.cutFill.find(covers(0.6));
    expect(cut?.kind).toBe("cut");
    expect(cut!.maxDepthM).toBeGreaterThan(4);
    expect(fill?.kind).toBe("fill");
    expect(fill!.maxDepthM).toBeGreaterThan(3);
    for (const r of result.cutFill) expect(r.maxDepthM).toBeGreaterThan(2);
  });

  it("reports cut and fill depths in metres whatever the vertical exaggeration (review R3)", () => {
    const base = run().result.cutFill;
    const ve = 2;
    const trail = analyticTrail(LENGTH, syntheticProfile(LENGTH));
    const scaled = {
      ...trail,
      samples: trail.samples.map((s) => ({ ...s, y: s.y * ve })),
      sampleAt: (d: number) => ({ ...trail.sampleAt(d), y: trail.sampleAt(d).y * ve }),
    };
    const grid = worldGridAround(LENGTH);
    const mesh = { ...grid.mesh, positions: grid.mesh.positions.map((v, i) => (i % 3 === 1 ? v * ve : v)) };
    const result = flattenCorridor(mesh, scaled, { widthM: 3, shoulderM: 1, spacingM: 4, bridges: [BRIDGE], ve }).cutFill;
    expect(result.map((r) => r.kind)).toEqual(base.map((r) => r.kind));
    result.forEach((r, i) => expect(r.maxDepthM).toBeCloseTo(base[i].maxDepthM, 1));
  });

  it("leaves terrain under the bridge span alone (the road passes beneath)", () => {
    const { original, result } = run();
    const p = result.mesh.positions;
    let checked = 0;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i];
      if (x * 10 > BRIDGE[0] + 2 && x * 10 < BRIDGE[1] - 2 && Math.abs(p[i + 2] - trailZ(x)) < 0.3) {
        expect(p[i + 1], `vertex ${i / 3}`).toBe(original[i + 1]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(result.cutFill.some((r) => r.fromKm < BRIDGE[1] / 1000 && r.toKm > BRIDGE[0] / 1000)).toBe(false);
  });

  it("leaves terrain more than 15 m from the centreline alone", () => {
    const { original, result } = run();
    const p = result.mesh.positions;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i + 2] - trailZ(p[i])) > 1.5) expect(p[i + 1]).toBe(original[i + 1]);
    }
  });
});
