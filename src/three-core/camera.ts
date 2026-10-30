// Reel: shots per section from a spec, with aerial shots (docs/adr/0035-shot-specs.md).
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

/**
 * A first-person shot at handlebar height (docs/adr/0056-first-person-shot.md). The camera rides with the rider,
 * `eyeHeightM` above the trail surface and `forwardM` ahead of the rider's centre, and looks at the trail `lookAheadM`
 * ahead: bends turn the view as a rider's head turns, and the profile pitches it. The cadence adds a small bob and
 * sway, pure functions of the pose's crank angle. The rider model is not drawn in these frames: the camera is the rider,
 * so CA3's rider distance does not apply and the terrain clearance is 1 m (spec CA3 as amended by ADR 56).
 */
export function firstPersonShot(p: {
  trail: Trail;
  poseAt: (frame: number) => CyclistPose;
  distAt: (frame: number) => number;
  eyeHeightM: number;
  lookAheadM: number;
  forwardM?: number;
  bobM?: number;
  fovDeg?: number;
}): Shot {
  const forwardM = p.forwardM ?? 0.4;
  const bobM = p.bobM ?? 0.012;
  const fovDeg = p.fovDeg ?? FIRST_PERSON_FOV_DEG;
  return (frame) => {
    const pose = p.poseAt(frame);
    const d = p.distAt(frame);
    const [hx, hz] = headingXZ(p.trail, d);
    // two pedal strokes per crank turn lift the body; one turn sways it
    const bobUp = bobM * Math.sin(2 * pose.crankAngle);
    const sway = 0.6 * bobM * Math.sin(pose.crankAngle);
    // left of travel is (hz, -hx) in the XZ plane
    const position: Vec3 = [
      pose.position[0] + hx * (forwardM / 10) + hz * (sway / 10),
      pose.position[1] + (p.eyeHeightM + bobUp) / 10,
      pose.position[2] + hz * (forwardM / 10) - hx * (sway / 10),
    ];
    const ahead = p.trail.sampleAt(d + p.lookAheadM);
    // the eye looks a little down at the surface ahead, as a rider's does
    return { position, target: [ahead.x, ahead.y + (p.eyeHeightM - 0.45) / 10, ahead.z], fovDeg };
  };
}
/** A wider lens for the rider's view: a head-mounted camera's field, inside CA4's 35–60°. */
export const FIRST_PERSON_FOV_DEG = 52;

/** An orbit around a point: the camera circles at a radius and height, looking at the centre (docs/adr/0035-shot-specs.md). */
export function aerialOrbit(p: { centre: Vec3; radiusM: number; heightM: number; fromDeg: number; toDeg: number; frames: number }): Shot {
  const progress = easedProgress(p.frames);
  return (frame) => {
    const u = progress[clampFrame(frame, p.frames)];
    const a = (lerp(p.fromDeg, p.toDeg, u) * Math.PI) / 180;
    return {
      position: [p.centre[0] + Math.cos(a) * (p.radiusM / 10), p.centre[1] + p.heightM / 10, p.centre[2] + Math.sin(a) * (p.radiusM / 10)],
      target: p.centre,
      fovDeg: FOV_DEG,
    };
  };
}

/**
 * A pull-back: the camera rises and backs away from a point along a fixed direction, keeping it in view. It starts as far back as it
 * is high (a 45° look-down), never straight above the target, so the view direction turns slowly (CA2).
 */
export function pullBack(p: { from: Vec3; target: Vec3; startHeightM: number; endHeightM: number; backM: number; frames: number; back?: [number, number] }): Shot {
  const progress = easedProgress(p.frames);
  const [bx, bz] = p.back ?? [0, 1];
  return (frame) => {
    const u = progress[clampFrame(frame, p.frames)];
    const back = lerp(p.startHeightM, p.backM, u) / 10;
    return {
      position: [p.from[0] + bx * back, p.from[1] + lerp(p.startHeightM, p.endHeightM, u) / 10, p.from[2] + bz * back],
      target: p.target,
      fovDeg: FOV_DEG,
    };
  };
}

/**
 * Lifts a whole shot by one constant so it clears the terrain by minAboveM at every frame: a smooth path stays smooth (CA2),
 * where a per-frame lift would follow every bump. Returns the shot unchanged when it already clears.
 */
export function liftClear(shot: Shot, heightAt: HeightAt, frames: number, minAboveM: number): Shot {
  let lift = 0;
  for (let f = 0; f < frames; f++) {
    const p = shot(f).position;
    lift = Math.max(lift, groundUnder(heightAt, p[0], p[2], f) + minAboveM / 10 - p[1]);
  }
  if (lift === 0) return shot;
  return (f) => {
    const pose = shot(f);
    return { ...pose, position: [pose.position[0], pose.position[1] + lift, pose.position[2]] };
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
