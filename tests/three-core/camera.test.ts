import { describe, expect, it } from "vitest";
import { craneShot, droneSideTrack, followShot, sequenceShots, withClearance, type Shot } from "../../src/three-core/camera";
import type { Vec3 } from "../../src/three-core/types";
import { expectCameraCriteria } from "./criteria";
import { loadExports } from "./pending";
import { analyticRider, analyticTrail, profileHeight, syntheticProfile } from "./fixtures";

const FPS = 30;

// A valley along the trail: the floor follows the profile, the sides rise gently.
const valley = (x: number, z: number) =>
  profileHeight(Math.min(1000, Math.max(0, x * 10))) / 10 + 0.02 * (z - 3 * Math.sin(x / 20)) ** 2;

function pocShots() {
  const trail = analyticTrail(1000, syntheticProfile(1000));
  const rider = analyticRider(trail, 100, FPS);
  const riderB = (g: number) => rider.riderAt(g + 180);
  const a = droneSideTrack({
    trail,
    riderAt: rider.riderAt,
    heightAt: valley,
    fromDistM: 80,
    toDistM: 230,
    startHeightM: 120,
    endHeightM: 25,
    sideM: 40,
    frames: 180,
  });
  const b = followShot({ poseAt: (g) => rider.poseAt(g + 180), backM: 8, upM: 3, sideM: 1.5 });
  const shotA = withClearance(a, valley, rider.riderAt, 2, 1.5);
  const shotB = withClearance(b, valley, riderB, 2, 1.5);
  return { rider, shotA, shotB, all: sequenceShots([{ shot: shotA, frames: 180 }, { shot: shotB, frames: 180 }]) };
}

describe("camera (CA1–CA4)", () => {
  it("CA1–CA4 hold at every frame of the two POC shots", () => {
    const { rider, all } = pocShots();
    expectCameraCriteria(all, [[0, 180], [180, 360]], valley, rider.riderAt, FPS);
  });

  it("sequenceShots hands each shot its own local frames", () => {
    const { shotA, shotB, all } = pocShots();
    expect(all(179)).toEqual(shotA(179));
    expect(all(180)).toEqual(shotB(0));
    expect(all(359)).toEqual(shotB(179));
  });

  it("ADR 35: aerialOrbit and pullBack meet CA1–CA4 over a valley", async () => {
    type Shot = (f: number) => { position: Vec3; target: Vec3; fovDeg: number };
    const cam = await loadExports<{
      aerialOrbit: (p: { centre: Vec3; radiusM: number; heightM: number; fromDeg: number; toDeg: number; frames: number }) => Shot;
      pullBack: (p: { from: Vec3; target: Vec3; startHeightM: number; endHeightM: number; backM: number; frames: number; back?: [number, number] }) => Shot;
    }>("src/three-core/camera.ts", ["aerialOrbit", "pullBack"]);
    const trail = analyticTrail(1000, syntheticProfile(1000));
    const rider = analyticRider(trail, 100, FPS);
    const centre = trail.sampleAt(500);
    const orbit = withClearance(cam.aerialOrbit({ centre: [centre.x, centre.y, centre.z], radiusM: 250, heightM: 120, fromDeg: 0, toDeg: 120, frames: 240 }), valley, rider.riderAt, 20, 0);
    // backing along the valley (the -x direction), as the sections do: across it, the clearance would climb the valley wall
    const back = withClearance(cam.pullBack({ from: [centre.x, centre.y, centre.z], target: [centre.x, centre.y, centre.z], startHeightM: 40, endHeightM: 300, backM: 400, frames: 300, back: [-1, 0] }), valley, rider.riderAt, 20, 0);
    expectCameraCriteria(sequenceShots([{ shot: orbit, frames: 240 }, { shot: back, frames: 300 }]), [[0, 240], [240, 540]], valley, rider.riderAt, FPS);
  });

  it("fails loudly when there is no terrain under the camera (review R7)", () => {
    const trail = analyticTrail(1000, syntheticProfile(1000));
    const rider = analyticRider(trail, 100, FPS);
    const nowhere = () => -Infinity;
    const drone = droneSideTrack({ trail, riderAt: rider.riderAt, heightAt: nowhere, fromDistM: 80, toDistM: 230, startHeightM: 120, endHeightM: 25, sideM: 40, frames: 180 });
    expect(() => drone(0)).toThrow(/no terrain/);
    const follow = followShot({ poseAt: rider.poseAt, backM: 8, upM: 3, sideM: 1.5 });
    expect(() => withClearance(follow, nowhere, rider.riderAt, 2, 1.5)(0)).toThrow(/no terrain/);
  });

  it("withClearance lifts a camera out of the ground and away from the rider", () => {
    const rider: Vec3 = [10, 18, 0];
    const buried: Shot = () => ({ position: [10, 18.05, 0.02], target: [12, 18, 0], fovDeg: 45 });
    const fixed = withClearance(buried, () => 18, () => rider, 2, 1.5)(0);
    expect(fixed.position[1]).toBeGreaterThanOrEqual(18 + 0.2 - 1e-9);
    expect(Math.hypot(fixed.position[0] - 10, fixed.position[1] - 18, fixed.position[2])).toBeGreaterThanOrEqual(0.15 - 1e-9);
  });

  it("a crane shot comes down behind the rider looking ahead, and hands over to a follow shot without a jump", () => {
    const trail = analyticTrail(1000, syntheticProfile(1000));
    const rider = analyticRider(trail, 100, FPS);
    const crane = craneShot({ trail, poseAt: rider.poseAt, distAt: rider.distAt, fromBackM: 35, toBackM: 8, fromUpM: 14, toUpM: 3, sideM: 1.5, lookAheadM: 60, frames: 180 });
    const shot = withClearance(crane, valley, rider.riderAt, 2, 1.5);
    expectCameraCriteria(shot, [[0, 180]], valley, rider.riderAt, FPS);
    // it starts high and well back, looking at the route ahead of the rider (not down at them)
    const first = crane(0);
    const r0 = rider.riderAt(0);
    expect(Math.hypot(first.position[0] - r0[0], first.position[2] - r0[2]) * 10).toBeGreaterThan(30);
    const ahead = trail.sampleAt(rider.distAt(0) + 60);
    expect(Math.hypot(first.target[0] - ahead.x, first.target[2] - ahead.z) * 10).toBeLessThan(2);
    const pitch = Math.atan2(first.target[1] - first.position[1], Math.hypot(first.target[0] - first.position[0], first.target[2] - first.position[2]));
    expect((pitch * 180) / Math.PI).toBeGreaterThan(-20);
    // its last frame is where the follow shot that comes after it begins
    const follow = followShot({ poseAt: (g) => rider.poseAt(g + 179), backM: 8, upM: 3, sideM: 1.5 });
    const [a, b] = [crane(179), follow(0)];
    expect(Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]) * 10).toBeLessThan(0.1);
    expect(Math.hypot(a.target[0] - b.target[0], a.target[1] - b.target[1], a.target[2] - b.target[2]) * 10).toBeLessThan(0.1);
  });
});
