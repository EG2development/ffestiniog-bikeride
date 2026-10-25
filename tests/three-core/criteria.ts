import { expect } from "vitest";
import {
  cyclistPose,
  wheelContacts,
  type CyclistDims,
} from "../../src/three-core/cyclistMotion";
import type { HeightAt, Shot } from "../../src/three-core/camera";
import type { Trail } from "../../src/three-core/trail";
import type { Vec3 } from "../../src/three-core/types";

// Spec criteria as reusable checks, so synthetic and real-POC tests apply the same thresholds.

const DEG = Math.PI / 180;
const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function expectCyclistCriteria(trail: Trail, table: Float64Array, fps: number, dims: CyclistDims) {
  const frames = table.length;
  for (let f = 0; f < frames; f++) {
    const pose = cyclistPose(trail, table, f, fps, dims);
    const centre = trail.sampleAt(table[f]);

    // C2: 12–25 km/h at every frame
    if (f + 1 < frames) {
      const kmh = (table[f + 1] - table[f]) * fps * 3.6;
      expect(kmh, `C2 speed at frame ${f}`).toBeGreaterThanOrEqual(12 - 1e-9);
      expect(kmh, `C2 speed at frame ${f}`).toBeLessThanOrEqual(25 + 1e-9);
    }

    // C3: within 1.0 m of the centreline
    const lateralM = Math.hypot(pose.position[0] - centre.x, pose.position[2] - centre.z) * 10;
    expect(lateralM, `C3 lateral offset at frame ${f}`).toBeLessThanOrEqual(1.0);

    // C4: both wheel contacts within 0.05 m of the surface
    const { rear, front } = wheelContacts(pose, dims);
    const rearSurface = trail.sampleAt(table[f] - dims.wheelbaseM / 2).y;
    const frontSurface = trail.sampleAt(table[f] + dims.wheelbaseM / 2).y;
    expect(Math.abs(rear[1] - rearSurface) * 10, `C4 rear contact at frame ${f}`).toBeLessThanOrEqual(0.05);
    expect(Math.abs(front[1] - frontSurface) * 10, `C4 front contact at frame ${f}`).toBeLessThanOrEqual(0.05);

    // C5: yaw within 5° of the tangent, pitch within 1° of the gradient
    const tangentYaw = Math.atan2(-centre.tangent[2], centre.tangent[0]);
    expect(angleDiff(pose.yaw, tangentYaw), `C5 yaw at frame ${f}`).toBeLessThanOrEqual(5 * DEG);
    expect(Math.abs(pose.pitch - Math.atan(centre.gradient)), `C5 pitch at frame ${f}`).toBeLessThanOrEqual(1 * DEG);

    // C6: wheels roll without slipping (within 1 %)
    const travelled = table[f] - table[0];
    const rolled = pose.wheelAngle * (dims.wheelDiameterM / 2);
    expect(Math.abs(rolled - travelled), `C6 wheel rotation at frame ${f}`).toBeLessThanOrEqual(0.01 * travelled + 1e-9);

    // C7: cadence 60–90 rpm, derived from the frame alone
    if (f + 1 < frames) {
      const next = cyclistPose(trail, table, f + 1, fps, dims);
      const rpm = (angleDiff(next.crankAngle, pose.crankAngle) * fps * 60) / (2 * Math.PI);
      expect(rpm, `C7 cadence at frame ${f}`).toBeGreaterThanOrEqual(60);
      expect(rpm, `C7 cadence at frame ${f}`).toBeLessThanOrEqual(90);
    }
    expect(cyclistPose(trail, table, f, fps, dims), `C7/RN2 same pose twice at frame ${f}`).toEqual(pose);
  }
}

export function expectCameraCriteria(
  shot: Shot,
  shotRanges: [number, number][],
  heightAt: HeightAt,
  riderAt: (f: number) => Vec3,
  fps: number,
) {
  const ramp = Math.round(0.5 * fps);
  for (const [start, end] of shotRanges) {
    for (let f = start; f < end; f++) {
      const pose = shot(f);
      // CA1: a pure function of the frame
      expect(shot(f), `CA1 frame ${f}`).toEqual(pose);
      // CA3: ≥ 2 m above the terrain, ≥ 1.5 m from the rider
      const [x, y, z] = pose.position;
      expect(y, `CA3 height above terrain at frame ${f}`).toBeGreaterThanOrEqual(heightAt(x, z) + 0.2 - 1e-9);
      expect(dist3(pose.position, riderAt(f)), `CA3 distance to rider at frame ${f}`).toBeGreaterThanOrEqual(0.15 - 1e-9);
      // CA4: natural lens
      expect(pose.fovDeg, `CA4 fov at frame ${f}`).toBeGreaterThanOrEqual(35);
      expect(pose.fovDeg, `CA4 fov at frame ${f}`).toBeLessThanOrEqual(60);
    }
    // CA2: smooth within a shot, outside the 0.5 s ramps
    for (let f = start + ramp; f < end - ramp - 2; f++) {
      const p0 = shot(f).position;
      const p1 = shot(f + 1).position;
      const p2 = shot(f + 2).position;
      const v1 = dist3(p1, p0);
      const v2 = dist3(p2, p1);
      if (v1 > 1e-9) {
        expect(v2 / v1, `CA2 speed change at frame ${f}`).toBeGreaterThanOrEqual(0.9);
        expect(v2 / v1, `CA2 speed change at frame ${f}`).toBeLessThanOrEqual(1.1);
      }
      const dirOf = (k: number) => {
        const s = shot(k);
        const d: Vec3 = [s.target[0] - s.position[0], s.target[1] - s.position[1], s.target[2] - s.position[2]];
        const l = Math.hypot(d[0], d[1], d[2]);
        return [d[0] / l, d[1] / l, d[2] / l] as Vec3;
      };
      const a = dirOf(f);
      const b = dirOf(f + 1);
      const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      expect((Math.acos(dot) * fps) / DEG, `CA2 angular velocity at frame ${f}`).toBeLessThanOrEqual(30);
    }
  }
}
