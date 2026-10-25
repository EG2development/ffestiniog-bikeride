import type { CyclistPose } from "./cyclistMotion";
import type { Trail } from "./trail";
import type { Vec3 } from "./types";

// docs/pseudocode-3d.md §2.7, docs/adr/0016-pure-camera-shots.md

export type CameraPose = { position: Vec3; target: Vec3; fovDeg: number };
export type Shot = (frame: number) => CameraPose;
export type HeightAt = (x: number, z: number) => number;

const FOV_DEG = 45;
const RAMP_FRAMES = 15;
/** half-length of the chord used for a camera's heading, so it doesn't jerk at the centreline's vertices */
const HEADING_CHORD_M = 25;

/** Eased progress 0→1 over n frames: smooth 0.5 s ramps, constant speed between. */
function easedProgress(n: number): Float64Array {
  const speed = new Float64Array(n);
  const smooth = (u: number) => u * u * (3 - 2 * u);
  for (let f = 0; f < n; f++) {
    const fromStart = Math.min(1, (f + 0.5) / RAMP_FRAMES);
    const fromEnd = Math.min(1, (n - 1 - f + 0.5) / RAMP_FRAMES);
    speed[f] = smooth(Math.min(fromStart, fromEnd));
  }
  const out = new Float64Array(n);
  for (let f = 1; f < n; f++) out[f] = out[f - 1] + speed[f];
  const total = out[n - 1] || 1;
  for (let f = 0; f < n; f++) out[f] /= total;
  return out;
}

const clampFrame = (f: number, n: number) => Math.min(n - 1, Math.max(0, Math.round(f)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function headingXZ(trail: Trail, d: number): [number, number] {
  const a = trail.sampleAt(d - HEADING_CHORD_M);
  const b = trail.sampleAt(d + HEADING_CHORD_M);
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return [(b.x - a.x) / l, (b.z - a.z) / l];
}

export function droneSideTrack(p: {
  trail: Trail;
  riderAt: (frame: number) => Vec3;
  heightAt: HeightAt;
  fromDistM: number;
  toDistM: number;
  startHeightM: number;
  endHeightM: number;
  sideM: number;
  frames: number;
}): Shot {
  const progress = easedProgress(p.frames);
  return (frame) => {
    const f = clampFrame(frame, p.frames);
    const u = progress[f];
    const d = lerp(p.fromDistM, p.toDistM, u);
    const s = p.trail.sampleAt(d);
    const [hx, hz] = headingXZ(p.trail, d);
    // right of travel is (-hz, hx) in the XZ plane
    const x = s.x - hz * (p.sideM / 10);
    const z = s.z + hx * (p.sideM / 10);
    const rider = p.riderAt(f);
    return {
      position: [x, groundUnder(p.heightAt, x, z, frame) + lerp(p.startHeightM, p.endHeightM, u) / 10, z],
      target: [rider[0], rider[1] + 0.1, rider[2]],
      fovDeg: FOV_DEG,
    };
  };
}

export function followShot(p: { poseAt: (frame: number) => CyclistPose; backM: number; upM: number; sideM: number }): Shot {
  return (frame) => {
    const here = p.poseAt(frame).position;
    // heading from the rider's last second of travel: smooth through the centreline's vertices
    const past = p.poseAt(frame - 30).position;
    let hx = here[0] - past[0];
    let hz = here[2] - past[2];
    const l = Math.hypot(hx, hz);
    if (l < 1e-9) {
      const yaw = p.poseAt(frame).yaw;
      hx = Math.cos(yaw);
      hz = -Math.sin(yaw);
    } else {
      hx /= l;
      hz /= l;
    }
    // left of travel is (hz, -hx)
    return {
      position: [
        here[0] - hx * (p.backM / 10) + hz * (p.sideM / 10),
        here[1] + p.upM / 10,
        here[2] - hz * (p.backM / 10) - hx * (p.sideM / 10),
      ],
      target: [here[0] + hx * 0.5, here[1] + 0.1, here[2] + hz * 0.5],
      fovDeg: FOV_DEG,
    };
  };
}

/** Terrain height under a camera; throws when there is none, so a camera off the DEM fails loudly instead of rendering NaN. */
function groundUnder(heightAt: HeightAt, x: number, z: number, frame: number): number {
  const h = heightAt(x, z);
  if (!Number.isFinite(h)) throw new Error(`camera at frame ${frame}: no terrain under (${x.toFixed(1)}, ${z.toFixed(1)})`);
  return h;
}

/** Keeps a shot at least minAboveM above the terrain and minFromRiderM from the rider. */
export function withClearance(
  shot: Shot,
  heightAt: HeightAt,
  riderAt: (frame: number) => Vec3,
  minAboveM: number,
  minFromRiderM: number,
): Shot {
  const minAbove = minAboveM / 10;
  const minFrom = minFromRiderM / 10;
  return (frame) => {
    const pose = shot(frame);
    const pos: Vec3 = [...pose.position];
    const rider = riderAt(frame);
    for (let pass = 0; pass < 3; pass++) {
      const dx = pos[0] - rider[0];
      const dy = pos[1] - rider[1];
      const dz = pos[2] - rider[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist < minFrom) {
        const [ux, uy, uz] = dist > 1e-9 ? [dx / dist, dy / dist, dz / dist] : [0, 1, 0];
        pos[0] = rider[0] + ux * minFrom;
        pos[1] = rider[1] + uy * minFrom;
        pos[2] = rider[2] + uz * minFrom;
      }
      const ground = groundUnder(heightAt, pos[0], pos[2], frame) + minAbove;
      if (pos[1] < ground) pos[1] = ground;
    }
    return { ...pose, position: pos };
  };
}

/** Plays shots back to back; each shot sees its own local frame numbers. */
export function sequenceShots(shots: { shot: Shot; frames: number }[]): Shot {
  return (frame) => {
    let start = 0;
    for (let i = 0; i < shots.length; i++) {
      const { shot, frames } = shots[i];
      if (frame < start + frames || i === shots.length - 1) return shot(frame - start);
      start += frames;
    }
    throw new Error("sequenceShots needs at least one shot");
  };
}
