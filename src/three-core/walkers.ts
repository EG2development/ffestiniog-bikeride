// Walkers on the trail, when a section asks (docs/adr/0059-walkers-on-the-trail.md; spec C9).
import type { Part } from "./cyclistModel";
import { mulberry32 } from "./rng";
import type { Trail } from "./trail";
import type { Vec3 } from "./types";

// A walker is the rider's motion model (ADR 15) at a walking pace: a distance table integrated once from a config
// spec, a pose that is a pure function of the table and the frame, and a figure built from a height. Walkers are
// decorative and conceptual (nobody is known to walk the mothballed line); a section places them explicitly by spec,
// never by a random draw, so each one is a choreographed moment the shots can count on.

export type WalkerSpec = {
  /** distance along the route at frame 0, metres */
  startDistM: number;
  /** +1 walks with the rider's direction of travel, -1 towards the rider */
  direction: 1 | -1;
  /** distance left of the centreline, metres (negative = right); |sideM| ≤ 1.0 keeps C3 */
  sideM: number;
  /** standing height, metres; 1.5–1.95 (C9) */
  heightM: number;
  /** picks clothing and skin tones and the gait phase; two walkers never share one */
  seed: number;
};

export type WalkerPose = {
  position: Vec3;
  /** rotation about +y that turns the figure's +x onto its direction of travel */
  yaw: number;
  /** gait phase, radians; one stride (two steps) per 2π */
  phase: number;
};

export type WalkerMaterial = "top" | "legs" | "skin" | "hair" | "shoe";
export type WalkerPart = Omit<Part, "material"> & { material: WalkerMaterial };

/** C9: walking pace 3–6 km/h, slower uphill (gradient in the walker's own direction). */
export function walkerSpeedKmh(gradient: number): number {
  return Math.min(6, Math.max(3, 4.5 - 30 * gradient));
}

/** stride (two steps) in metres for a height: about 0.8 of the height at a walking pace */
export const strideM = (heightM: number): number => 0.8 * heightM;

/** Distance along the route (m) for every frame, integrated once, in the walker's direction. */
export function walkerTable(trail: Trail, spec: WalkerSpec, frames: number, fps: number): Float64Array {
  const table = new Float64Array(frames);
  table[0] = spec.startDistM;
  for (let f = 1; f < frames; f++) {
    const g = trail.sampleAt(table[f - 1]).gradient * spec.direction;
    table[f] = table[f - 1] + (spec.direction * walkerSpeedKmh(g)) / 3.6 / fps;
  }
  return table;
}

export function walkerPose(trail: Trail, table: Float64Array, frame: number, spec: WalkerSpec): WalkerPose {
  const f = Math.min(table.length - 1, Math.max(0, frame));
  const d = table[f];
  const s = trail.sampleAt(d);
  const l = Math.hypot(s.tangent[0], s.tangent[2]) || 1;
  const fx = (s.tangent[0] / l) * spec.direction;
  const fz = (s.tangent[2] / l) * spec.direction;
  const off = (spec.sideM * spec.direction) / 10;
  // left of travel is (fz, -fx) in the XZ plane; sideM is left of the route's direction, whichever way the walker faces
  const phase0 = 2 * Math.PI * mulberry32(spec.seed)();
  return {
    position: [s.x + fz * off, s.y, s.z - fx * off],
    yaw: Math.atan2(-fz, fx),
    phase: phase0 + (2 * Math.PI * Math.abs(d - table[0])) / strideM(spec.heightM),
  };
}

// Proportions as fractions of the standing height H (Drillis & Contini's segment lengths, rounded): hip joint 0.53 H,
// shoulder 0.82 H, head top 1.00 H; thigh and shin 0.245 H each, upper arm 0.17 H, forearm 0.15 H.
const T = { hip: 0.53, shoulder: 0.82, neck: 0.86, head: 0.93, headR: 0.07, thigh: 0.245, shin: 0.245, ankle: 0.035, foot: 0.11, upperArm: 0.17, forearm: 0.15, hipHalf: 0.06, shoulderHalf: 0.11 };
const HIP_WALK = 0.5; // the hip rides a little lower than standing: the stance leg is never straight
const SWING = 0.12; // half the foot's forward travel, in H
const LIFT = 0.04; // the swinging foot's lift, in H

/** Two-bone knee from hip to ankle, bending forward (+x), in the leg's plane. */
function knee(hip: Vec3, ankle: Vec3, thigh: number, shin: number): Vec3 {
  const dx = ankle[0] - hip[0];
  const dy = ankle[1] - hip[1];
  const d = Math.min(thigh + shin - 1e-6, Math.hypot(dx, dy));
  const toAnkle = Math.atan2(dy, dx);
  const atHip = Math.acos((thigh * thigh + d * d - shin * shin) / (2 * thigh * d));
  const a = toAnkle + atHip;
  return [hip[0] + thigh * Math.cos(a), hip[1] + thigh * Math.sin(a), ankle[2]];
}

const seg = (name: string, a: Vec3, b: Vec3, r: number, material: WalkerMaterial): WalkerPart => ({ kind: "capsule", a, b, r, material, name });

/**
 * The figure at a gait phase, in walker space (+x forward, +y up, +z right; world units, 1 = 10 m), feet on y = 0.
 * Each foot travels ±SWING·H fore and aft of the hip with the phase and lifts while it swings forward, so one foot is
 * always planted; the knees follow by two-bone geometry and the arms swing against the legs.
 */
export function walkerParts(heightM: number, phase: number): WalkerPart[] {
  const H = heightM / 10;
  const u = (k: number) => k * H;
  const parts: WalkerPart[] = [];
  const hipY = u(HIP_WALK);
  const bob = u(0.012) * (0.5 + 0.5 * Math.cos(2 * phase)); // the body rises as the legs pass, twice a stride
  const torsoBase: Vec3 = [0, hipY + bob, 0];
  const shoulder: Vec3 = [u(0.01), u(T.shoulder) - u(T.hip) + hipY + bob, 0];
  parts.push(seg("hips", [0, hipY + bob, -u(T.hipHalf)], [0, hipY + bob, u(T.hipHalf)], u(0.07), "legs"));
  parts.push(seg("torso", torsoBase, shoulder, u(0.085), "top"));
  parts.push(seg("shoulders", [shoulder[0], shoulder[1], -u(T.shoulderHalf)], [shoulder[0], shoulder[1], u(T.shoulderHalf)], u(0.055), "top"));
  parts.push(seg("neck", shoulder, [u(0.012), u(T.neck) - u(T.hip) + hipY + bob, 0], u(0.03), "skin"));
  const headY = u(T.head) - u(T.hip) + hipY + bob;
  parts.push({ kind: "sphere", a: [u(0.014), headY, 0], r: u(T.headR), material: "skin", name: "head" });
  // a cap of hair: a little wider than the head, flattened, covering the crown and the back (the bounds grow by its full radius)
  parts.push({ kind: "sphere", a: [u(0.004), headY + u(0.012), 0], r: u(0.072), material: "hair", name: "hair", scale: [1, 0.9, 1] });
  for (const [side, p, z] of [["left", phase, -u(T.hipHalf)], ["right", phase + Math.PI, u(T.hipHalf)]] as const) {
    const hip: Vec3 = [0, hipY + bob, z];
    const forward = u(SWING) * Math.sin(p);
    const lift = u(LIFT) * Math.max(0, Math.cos(p));
    const ankle: Vec3 = [forward, u(T.ankle) + lift, z];
    const k = knee(hip, ankle, u(T.thigh), u(T.shin));
    // the shin is no thicker than the ankle is high, so nothing of the leg reaches under the sole
    parts.push(seg(`thigh-${side}`, hip, k, u(0.055), "legs"), seg(`shin-${side}`, k, ankle, u(0.033), "legs"));
    parts.push(seg(`foot-${side}`, ankle, [ankle[0] + u(T.foot), ankle[1], z], u(T.ankle), "shoe"));
    // the arm on this side swings against the leg
    const swing = -0.55 * Math.sin(p);
    const sz = Math.sign(z) * u(T.shoulderHalf + 0.02);
    const sh: Vec3 = [shoulder[0], shoulder[1], sz];
    const elbow: Vec3 = [sh[0] + u(T.upperArm) * Math.sin(swing), sh[1] - u(T.upperArm) * Math.cos(swing), sz];
    const bend = swing + 0.35;
    const wrist: Vec3 = [elbow[0] + u(T.forearm) * Math.sin(bend), elbow[1] - u(T.forearm) * Math.cos(bend), sz];
    parts.push(seg(`upper-arm-${side}`, sh, elbow, u(0.04), "top"), seg(`forearm-${side}`, elbow, wrist, u(0.032), "skin"));
  }
  return parts;
}

/** Clothing, skin and hair colours for a walker from its seed: the same palette every time, never the same two walkers. */
export function walkerColours(seed: number): Record<WalkerMaterial, string> {
  const rand = mulberry32(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  return {
    top: pick(WALKER_PALETTE.top),
    legs: pick(WALKER_PALETTE.legs),
    skin: pick(WALKER_PALETTE.skin),
    hair: pick(WALKER_PALETTE.hair),
    shoe: pick(WALKER_PALETTE.shoe),
  };
}

/** Outdoor clothing and a range of skin and hair tones (sRGB). */
export const WALKER_PALETTE = {
  top: ["#2b4a7a", "#a83a2e", "#56643c", "#6e6e74", "#d9a441", "#3f8a8c"],
  legs: ["#2a2f3a", "#4a4a4a", "#6b5b45", "#3d4a63"],
  skin: ["#f1d2b5", "#d9ae92", "#c48c63", "#a3683f", "#7b4a2a", "#4a2e1b"],
  hair: ["#1f1a17", "#3b2a1e", "#6e4b2a", "#a8865e", "#8c8c8c"],
  shoe: ["#2a2a2a", "#4a3b2a", "#5a5a60"],
} as const;

export type WalkerTrack = { spec: WalkerSpec; table: Float64Array; poseAt: (frame: number) => WalkerPose };

/** Every walker a section asks for, with its table over the section's frames. */
export function walkerTracks(trail: Trail, specs: readonly WalkerSpec[], frames: number, fps: number): WalkerTrack[] {
  const seeds = new Set<number>();
  return specs.map((spec, i) => {
    if (seeds.has(spec.seed)) throw new Error(`walker ${i}: seed ${spec.seed} is used twice`);
    seeds.add(spec.seed);
    if (Math.abs(spec.sideM) > 1) throw new Error(`walker ${i}: sideM ${spec.sideM} is more than 1 m off the centreline (C3)`);
    if (spec.heightM < 1.5 || spec.heightM > 1.95) throw new Error(`walker ${i}: heightM ${spec.heightM} is outside 1.5–1.95 m (C9)`);
    const table = walkerTable(trail, spec, frames, fps);
    return { spec, table, poseAt: (f: number) => walkerPose(trail, table, f, spec) };
  });
}
