import type { Trail } from "./trail";
import type { Vec3 } from "./types";

// docs/pseudocode-3d.md §2.4, §2.6, docs/adr/0015-distance-table-motion.md

export type CyclistDims = {
  wheelDiameterM: number;
  wheelbaseM: number;
  /** height of bike + rider in the riding pose */
  ridingHeightM: number;
  lengthM: number;
  /** distance left of the centreline */
  lateralOffsetM: number;
};

export type CyclistPose = {
  position: Vec3;
  /** rotation about +y that turns the model's +x onto the direction of travel */
  yaw: number;
  pitch: number;
  wheelAngle: number;
  crankAngle: number;
};

const CADENCE_RPM = 75;

export function defaultCyclistDims(): CyclistDims {
  return { wheelDiameterM: 0.68, wheelbaseM: 1.05, ridingHeightM: 1.7, lengthM: 1.75, lateralOffsetM: 0.5 };
}

export function speedKmh(gradient: number): number {
  return Math.min(25, Math.max(12, 18 - 150 * gradient));
}

/** Distance along the route (m) for every frame, integrated once. */
export function distanceTable(trail: Trail, startDistM: number, frames: number, fps: number): Float64Array {
  const table = new Float64Array(frames);
  table[0] = startDistM;
  for (let f = 1; f < frames; f++) {
    const kmh = speedKmh(trail.sampleAt(table[f - 1]).gradient);
    table[f] = table[f - 1] + kmh / 3.6 / fps;
  }
  return table;
}

export function cyclistPose(trail: Trail, table: Float64Array, frame: number, fps: number, dims: CyclistDims): CyclistPose {
  const f = Math.min(table.length - 1, Math.max(0, frame));
  const d = table[f];
  const s = trail.sampleAt(d);
  const l = Math.hypot(s.tangent[0], s.tangent[2]) || 1;
  const fx = s.tangent[0] / l;
  const fz = s.tangent[2] / l;
  const off = dims.lateralOffsetM / 10;
  const rearY = trail.sampleAt(d - dims.wheelbaseM / 2).y;
  const frontY = trail.sampleAt(d + dims.wheelbaseM / 2).y;
  return {
    // left of travel is (fz, -fx) in the XZ plane
    position: [s.x + fz * off, (rearY + frontY) / 2, s.z - fx * off],
    yaw: Math.atan2(-fz, fx),
    pitch: Math.atan2(frontY - rearY, dims.wheelbaseM / 10),
    wheelAngle: (d - table[0]) / (dims.wheelDiameterM / 2),
    crankAngle: (2 * Math.PI * (CADENCE_RPM / 60) * f) / fps,
  };
}

/** Direction of travel and the bike's up vector for a pose, in world space. */
export function poseAxes(pose: CyclistPose): { forward: Vec3; up: Vec3 } {
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const cy = Math.cos(pose.yaw);
  const sy = Math.sin(pose.yaw);
  return { forward: [cp * cy, sp, -cp * sy], up: [-sp * cy, cp, sp * sy] };
}

/** World positions of the lowest point of each wheel for a pose. */
export function wheelContacts(pose: CyclistPose, dims: CyclistDims): { rear: Vec3; front: Vec3 } {
  const { forward, up } = poseAxes(pose);
  const half = dims.wheelbaseM / 2 / 10;
  const r = dims.wheelDiameterM / 2 / 10;
  const contact = (sign: 1 | -1): Vec3 => [
    pose.position[0] + sign * forward[0] * half + up[0] * r,
    pose.position[1] + sign * forward[1] * half + up[1] * r - r,
    pose.position[2] + sign * forward[2] * half + up[2] * r,
  ];
  return { rear: contact(-1), front: contact(1) };
}
