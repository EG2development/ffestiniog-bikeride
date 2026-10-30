import { describe, expect, it } from "vitest";
import { FIRST_PERSON_FOV_DEG, firstPersonShot, withClearance } from "../../src/three-core/camera";
import type { CyclistPose } from "../../src/three-core/cyclistMotion";
import type { Feature } from "../../src/three-core/registers";
import { configById, earthworksInRange, PROTOTYPES, SECTIONS, shotKindAt, shotSpecAt, shotsOf } from "../../src/three-core/sections";
import type { Vec3 } from "../../src/three-core/types";
import { expectCameraCriteria } from "./criteria";
import { analyticRider, analyticTrail, profileHeight, syntheticProfile } from "./fixtures";

// The rider's own view (docs/adr/0056-first-person-shot.md): CA1, CA2 and CA4 as for every shot; CA3 as amended for a
// camera that is the rider (1 m over the rendered ground, no rider distance). The prototype config lives outside the reel.

const FPS = 30;
const DEG = Math.PI / 180;
const valley = (x: number, z: number) => profileHeight(Math.min(1000, Math.max(0, x * 10))) / 10 + 0.02 * (z - 3 * Math.sin(x / 20)) ** 2;

/** The analytic rider with a turning crank (75 rpm), so the bob is exercised. */
function pedallingRider(trail: ReturnType<typeof analyticTrail>, d0: number) {
  const rider = analyticRider(trail, d0, FPS);
  const poseAt = (f: number): CyclistPose => ({ ...rider.poseAt(f), crankAngle: (2 * Math.PI * (75 / 60) * f) / FPS });
  return { ...rider, poseAt };
}

describe("firstPersonShot (CA1–CA4 as amended)", () => {
  const trail = analyticTrail(1000, syntheticProfile(1000));
  const rider = pedallingRider(trail, 100);
  const shot = withClearance(firstPersonShot({ trail, poseAt: rider.poseAt, distAt: rider.distAt, eyeHeightM: 1.2, lookAheadM: 15 }), valley, () => [1e6, 1e6, 1e6], 1, 0);

  it("sits at handlebar height over the trail, a little ahead of the rider, and looks along the trail", () => {
    for (const f of [0, 37, 120, 299]) {
      const p = shot(f);
      const here = trail.sampleAt(rider.distAt(f));
      const eyeM = (p.position[1] - here.y) * 10;
      expect(eyeM).toBeGreaterThanOrEqual(1.2 - 0.012 - 1e-9);
      expect(eyeM).toBeLessThanOrEqual(1.2 + 0.012 + 1e-9);
      const aheadM = Math.hypot(p.position[0] - here.x, p.position[2] - here.z) * 10;
      expect(aheadM).toBeGreaterThan(0.3);
      expect(aheadM).toBeLessThan(0.5);
      const look = trail.sampleAt(rider.distAt(f) + 15);
      expect(Math.hypot(p.target[0] - look.x, p.target[2] - look.z)).toBeLessThan(1e-9);
      expect(p.fovDeg).toBe(FIRST_PERSON_FOV_DEG);
    }
  });

  it("CA1, CA2 and CA4 hold at every frame; CA3 holds as amended (≥ 1 m over the ground, the rider not drawn)", () => {
    // the shared criteria check CA1, CA2 (smoothness) and CA4; CA3's 2 m and 1.5 m thresholds are the drone's and the
    // follow shot's, so the amended clearance is checked here instead
    const ramp = Math.round(0.5 * FPS);
    for (let f = 0; f < 300; f++) {
      const p = shot(f);
      expect(shot(f), `CA1 frame ${f}`).toEqual(p);
      expect(p.position[1], `CA3 (amended) at frame ${f}`).toBeGreaterThanOrEqual(valley(p.position[0], p.position[2]) + 0.1 - 1e-9);
      expect(p.fovDeg).toBeGreaterThanOrEqual(35);
      expect(p.fovDeg).toBeLessThanOrEqual(60);
    }
    for (let f = ramp; f < 300 - ramp - 2; f++) {
      const [p0, p1, p2] = [shot(f).position, shot(f + 1).position, shot(f + 2).position];
      const v1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      const v2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
      expect(v2 / v1, `CA2 speed change at frame ${f}`).toBeGreaterThanOrEqual(0.9);
      expect(v2 / v1, `CA2 speed change at frame ${f}`).toBeLessThanOrEqual(1.1);
      const dir = (k: number): Vec3 => {
        const s = shot(k);
        const d: Vec3 = [s.target[0] - s.position[0], s.target[1] - s.position[1], s.target[2] - s.position[2]];
        const l = Math.hypot(...d);
        return [d[0] / l, d[1] / l, d[2] / l];
      };
      const [a, b] = [dir(f), dir(f + 1)];
      const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      expect((Math.acos(dot) * FPS) / DEG, `CA2 angular velocity at frame ${f}`).toBeLessThanOrEqual(30);
    }
  });

  it("bobs with the cadence: the eye height varies with the crank angle and only with it", () => {
    const raw = firstPersonShot({ trail, poseAt: rider.poseAt, distAt: rider.distAt, eyeHeightM: 1.2, lookAheadM: 15, bobM: 0.02 });
    const heights = Array.from({ length: 60 }, (_, f) => (raw(f).position[1] - trail.sampleAt(rider.distAt(f)).y) * 10);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.03);
    const still = firstPersonShot({ trail, poseAt: (f) => ({ ...rider.poseAt(f), crankAngle: 0 }), distAt: rider.distAt, eyeHeightM: 1.2, lookAheadM: 15, bobM: 0.02 });
    for (let f = 0; f < 60; f++) expect((still(f).position[1] - trail.sampleAt(rider.distAt(f)).y) * 10).toBeCloseTo(1.2, 9);
  });
});

describe("the photoreal prototype config (ADR 54)", () => {
  it("is not a reel section, has three shots that fill its 20 s, and names the shot owning each frame", () => {
    const cfg = PROTOTYPES["maentwrog-photo"];
    expect(SECTIONS["maentwrog-photo"]).toBeUndefined();
    expect(configById("maentwrog-photo")).toBe(cfg);
    expect(configById("maentwrog")).toBe(SECTIONS.maentwrog);
    expect(() => configById("nowhere")).toThrow(/unknown section/);
    expect(cfg.window).toBe("maentwrog");
    expect(cfg.frames).toBe(600);
    expect(cfg.shots.map((s) => s.kind)).toEqual(["drone-side", "first-person", "follow"]);
    expect(cfg.shots.reduce((n, s) => n + s.frames, 0)).toBe(cfg.frames);
    expect(shotKindAt(cfg, 0)).toBe("drone-side");
    expect(shotKindAt(cfg, 119)).toBe("drone-side");
    expect(shotKindAt(cfg, 120)).toBe("first-person");
    expect(shotKindAt(cfg, 359)).toBe("first-person");
    expect(shotKindAt(cfg, 360)).toBe("follow");
    expect(shotKindAt(cfg, 999)).toBe("follow");
    expect(shotSpecAt(cfg, 60)).toBe(cfg.shots[0]);
    expect(shotSpecAt(cfg, 400)).toBe(cfg.shots[2]);
  });

  it("names the registered earthworks a drone shot flies over, as one km range, and nothing when none is in range (G8)", () => {
    const earthwork = (id: string, fromKm: number, toKm: number): Feature => ({ id, kind: "earthwork", category: "approximate", source: { type: "lidar-dtm", ref: "profile" }, scenes: ["Poc3DMaentwrogPhoto"], fromKm, toKm });
    const features = [earthwork("earthwork-fill-9.009", 9.009, 9.02), earthwork("earthwork-cut-9.3", 9.3, 9.32), { ...earthwork("bridge-x", 9.0, 9.1), kind: "structure" as const }];
    expect(earthworksInRange(features, [8960, 9101])).toEqual([9.009, 9.02]);
    expect(earthworksInRange(features, [8960, 9310])).toEqual([9.009, 9.32]);
    expect(earthworksInRange(features, [9100, 9200])).toBeNull();
    expect(earthworksInRange([], [0, 1e6])).toBeNull();
  });

  it("shotsOf plays a first-person shot at the section frame with the rider's own distance, and refuses to without it", () => {
    const trail = analyticTrail(1000, syntheticProfile(1000));
    const rider = pedallingRider(trail, 100);
    const cfg = { ...PROTOTYPES["maentwrog-photo"], frames: 60, shots: [{ kind: "drone-side" as const, fromDistM: 80, toDistM: 120, startHeightM: 50, endHeightM: 30, sideM: 40, frames: 30 }, { kind: "first-person" as const, eyeHeightM: 1.2, lookAheadM: 15, frames: 30 }] };
    const shot = shotsOf(cfg, { trail, riderAt: rider.riderAt, heightAt: valley, poseAt: rider.poseAt, distAt: rider.distAt });
    const p = shot(45); // local frame 15 of the first-person shot = section frame 45
    const here = trail.sampleAt(rider.distAt(45));
    expect(Math.hypot(p.position[0] - here.x, p.position[2] - here.z) * 10).toBeLessThan(0.5);
    expect(p.fovDeg).toBe(FIRST_PERSON_FOV_DEG);
    expect(() => shotsOf(cfg, { trail, riderAt: rider.riderAt, heightAt: valley, poseAt: rider.poseAt })).toThrow(/distance table/);
    // the drone shot keeps the full criteria
    expectCameraCriteria(shot, [[0, 30]], valley, rider.riderAt, FPS);
  });
});
