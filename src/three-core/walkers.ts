// Walkers on the trail, when a section asks (docs/adr/0059-walkers-on-the-trail.md; spec C9).
import type { Part } from "./cyclistModel";
import { speedKmh } from "./cyclistMotion";
import { mulberry32 } from "./rng";
import type { Trail } from "./trail";
import type { Vec3 } from "./types";
import type { Choreo } from "./choreography";

// A walker is the rider's motion model (ADR 15) at a walking pace: a distance table integrated once from a config
// spec, a pose that is a pure function of the table and the frame, and a figure built from a height. Walkers are
// decorative and conceptual (nobody is known to walk the mothballed line). A spec may say how its person moves: walking,
// running, or walking behind a pram (docs/adr/0061-trail-users-at-random.md); the prototype places its walkers by spec,
// the reel's sections by a seeded draw (people.ts).

/** How a person moves along the trail (ADR 61); the community film adds riding a bicycle or an adult tricycle, and
 * sitting (on a bench, at its spec's place). */
export type Activity = "walk" | "run" | "pram" | "cycle" | "trike" | "sit";
/** Who a person is, for casting (the community film): a pupil in school uniform, a younger child, an older resident,
 * a commuter, a parent, or the adult escorting a group of pupils. */
export type Role = "pupil" | "child" | "older" | "commuter" | "parent" | "escort";
/** A dog on a lead (the community film): a Welsh sheepdog, a labrador or a small terrier. */
export type DogBreed = "collie" | "labrador" | "terrier";

export type WalkerSpec = {
  /** walking (the default), running, or walking behind a pram (ADR 61) */
  activity?: Activity;
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
  /** who they are, for casting; unset, anyone the activity suits */
  role?: Role;
  /** a steady pace instead of the activity's (a group riding together), km/h */
  speedKmh?: number;
  /** eases to a halt here (route distance, metres): a cyclist arriving at the lockers */
  stopAtM?: number;
  /** having stopped, wheels the bicycle into the open locker beside them, locks it and walks on to the bus stop (the
   * Blender build animates it: scripts/blender/lockup.py) */
  locksUp?: boolean;
  /** walks a dog on a short lead, at their left unless `side` says right (choreography.ts) */
  dog?: { breed: DogBreed; side?: "left" | "right" };
  /** walks with the person of this seed, side by side (choreography.ts keeps companions close, not apart) */
  with?: number;
};

export type WalkerPose = {
  position: Vec3;
  /** rotation about +y that turns the figure's +x onto its direction of travel */
  yaw: number;
  /** gait phase, radians; one stride (two steps) per 2π */
  phase: number;
};

export type WalkerMaterial = "top" | "legs" | "skin" | "hair" | "shoe" | "frame" | "fabric" | "tyre" | "blanket";
export type WalkerPart = Omit<Part, "material"> & { material: WalkerMaterial };

/** C9: walking pace 3–6 km/h, slower uphill (gradient in the walker's own direction). */
export function walkerSpeedKmh(gradient: number): number {
  return Math.min(6, Math.max(3, 4.5 - 30 * gradient));
}

/** ADR 61: a person's pace by activity and gradient (in their own direction): walking as C9; running 7.5–12 km/h
 * (a recreational jog, 10 km/h on the flat); pushing a pram 3–5 km/h, a little slower than walking. */
export function paceKmh(activity: Activity, gradient: number): number {
  if (activity === "run") return Math.min(12, Math.max(7.5, 10 - 50 * gradient));
  if (activity === "pram") return Math.min(5, Math.max(3, 4 - 30 * gradient));
  // the camera rider's own pace (about 11 mph on the flat), so a group riding with it stays together; a tricycle 7.5 mph
  if (activity === "cycle") return speedKmh(gradient);
  if (activity === "trike") return Math.min(14, Math.max(8, 12 - 120 * gradient));
  if (activity === "sit") return 0;
  return walkerSpeedKmh(gradient);
}

/** The distance a rider covers per turn of the cranks, metres (a 0.68 m wheel at a gear of about 2.1). */
export const CRANK_TURN_M = 4.5;
const BRAKE_M = 10; // a rider stopping slows over its last metres

/** Stride (two steps) in metres for a height: about 0.8 of the height walking, 1.15 running (about 2 m at 10 km/h and
 * 165 steps a minute), 0.7 behind a pram. */
export const strideM = (heightM: number, activity: Activity = "walk"): number =>
  activity === "cycle" || activity === "trike" ? CRANK_TURN_M : (activity === "run" ? 1.15 : activity === "pram" ? 0.7 : 0.8) * heightM;

/** Distance along the route (m) for every frame, integrated once, in the walker's direction. */
export function walkerTable(trail: Trail, spec: WalkerSpec, frames: number, fps: number): Float64Array {
  const table = new Float64Array(frames);
  table[0] = spec.startDistM;
  const activity = spec.activity ?? "walk";
  for (let f = 1; f < frames; f++) {
    const g = trail.sampleAt(table[f - 1]).gradient * spec.direction;
    const pace = activity === "sit" ? 0 : (spec.speedKmh ?? paceKmh(activity, g));
    // stopping: the pace falls with the square root of the distance left, so it comes to rest at the stop
    const left = spec.stopAtM === undefined ? Infinity : (spec.stopAtM - table[f - 1]) * spec.direction;
    table[f] = table[f - 1] + (spec.direction * pace * Math.min(1, Math.sqrt(Math.max(0, left) / BRAKE_M))) / 3.6 / fps;
  }
  return table;
}

export function walkerPose(trail: Trail, table: Float64Array, frame: number, spec: WalkerSpec, side?: Float64Array, stride?: number): WalkerPose {
  const f = Math.min(table.length - 1, Math.max(0, frame));
  const d = table[f];
  const s = trail.sampleAt(d);
  const l = Math.hypot(s.tangent[0], s.tangent[2]) || 1;
  const [tx, tz] = [s.tangent[0] / l, s.tangent[2] / l];
  const sideM = side ? side[f] : spec.sideM;
  // left of the route's direction is (tz, -tx) in the XZ plane; sideM is left of it, whichever way the walker faces
  const off = sideM / 10;
  // facing the way they move: along the route in their direction, turned by any drift across it (choreography.ts)
  let [fx, fz] = [tx * spec.direction, tz * spec.direction];
  if (side) {
    const [a, b] = [Math.max(0, f - 1), Math.min(table.length - 1, f + 1)];
    const [dd, ds] = [Math.abs(table[b] - table[a]), side[b] - side[a]];
    if (dd > 1e-4) {
      const [hx, hz] = [fx * dd + tz * ds, fz * dd - tx * ds];
      const hl = Math.hypot(hx, hz);
      [fx, fz] = [hx / hl, hz / hl];
    }
  }
  const phase0 = 2 * Math.PI * mulberry32(spec.seed)();
  return {
    position: [s.x + tz * off, s.y, s.z - tx * off],
    yaw: Math.atan2(-fz, fx),
    phase: phase0 + (2 * Math.PI * Math.abs(d - table[0])) / (stride ?? strideM(spec.heightM, spec.activity)),
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

/** The figure at a gait phase for an activity (ADR 61): a walker, a runner, or a walker behind a pram with the pram. */
export function walkerParts(heightM: number, phase: number, activity: Activity = "walk"): WalkerPart[] {
  if (activity === "run") return runnerParts(heightM, phase);
  if (activity === "pram") return pusherParts(heightM, phase);
  return walkParts(heightM, phase);
}

/**
 * The figure at a gait phase, in walker space (+x forward, +y up, +z right; world units, 1 = 10 m), feet on y = 0.
 * Each foot travels ±SWING·H fore and aft of the hip with the phase and lifts while it swings forward, so one foot is
 * always planted; the knees follow by two-bone geometry and the arms swing against the legs.
 */
function walkParts(heightM: number, phase: number): WalkerPart[] {
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

// A runner (ADR 61): the hips ride lower, the body bobs twice a stride, highest in flight, and leans forward; each foot
// is down for under half its cycle and swings up behind the hip, so there is a moment with both feet off the ground;
// the arms are bent near a right angle and swing against the legs.
const RUN = { hip: 0.48, swing: 0.15, lift: 0.15, bob: 0.02, lean: 0.12, arm: 0.6, elbow: 1.7 };

function runnerParts(heightM: number, phase: number): WalkerPart[] {
  const H = heightM / 10;
  const u = (k: number) => k * H;
  const bob = -u(RUN.bob) * Math.cos(2 * phase);
  const hipY = u(RUN.hip) + bob;
  const torso = u(T.shoulder - T.hip);
  const shoulder: Vec3 = [torso * Math.sin(RUN.lean), hipY + torso * Math.cos(RUN.lean), 0];
  const parts = upperBody(u, hipY, shoulder, RUN.lean);
  for (const [side, p, z] of [["left", phase, -u(T.hipHalf)], ["right", phase + Math.PI, u(T.hipHalf)]] as const) {
    const hip: Vec3 = [0, hipY, z];
    const c = Math.cos(p);
    // down while cos(p) < -0.3 (about 40 % of the cycle), lifting towards the buttock as the leg comes through
    const lift = c > -0.3 ? u(RUN.lift) * ((c + 0.3) / 1.3) ** 0.7 : 0;
    const ankle: Vec3 = [u(RUN.swing) * Math.sin(p), u(T.ankle) + lift, z];
    const k = knee(hip, ankle, u(T.thigh), u(T.shin));
    parts.push(seg(`thigh-${side}`, hip, k, u(0.055), "legs"), seg(`shin-${side}`, k, ankle, u(0.033), "legs"));
    parts.push(seg(`foot-${side}`, ankle, [ankle[0] + u(T.foot), ankle[1], z], u(T.ankle), "shoe"));
    const a = -RUN.arm * Math.sin(p);
    const sz = Math.sign(z) * u(T.shoulderHalf + 0.02);
    const sh: Vec3 = [shoulder[0], shoulder[1], sz];
    const elbow: Vec3 = [sh[0] + u(T.upperArm) * Math.sin(a), sh[1] - u(T.upperArm) * Math.cos(a), sz];
    const b = a + RUN.elbow;
    const wrist: Vec3 = [elbow[0] + u(T.forearm) * Math.sin(b), elbow[1] - u(T.forearm) * Math.cos(b), sz];
    parts.push(seg(`upper-arm-${side}`, sh, elbow, u(0.04), "top"), seg(`forearm-${side}`, elbow, wrist, u(0.032), "skin"));
  }
  return parts;
}

/** Hips, torso, shoulders, neck, head and hair for a body leaning forward by `lean` radians. */
function upperBody(u: (k: number) => number, hipY: number, shoulder: Vec3, lean: number): WalkerPart[] {
  const neckTop: Vec3 = [shoulder[0] + u(T.neck - T.shoulder) * Math.sin(lean) + u(0.012), shoulder[1] + u(T.neck - T.shoulder) * Math.cos(lean), 0];
  const head: Vec3 = [shoulder[0] + u(T.head - T.shoulder) * Math.sin(lean) + u(0.014), shoulder[1] + u(T.head - T.shoulder) * Math.cos(lean), 0];
  return [
    seg("hips", [0, hipY, -u(T.hipHalf)], [0, hipY, u(T.hipHalf)], u(0.07), "legs"),
    seg("torso", [0, hipY, 0], shoulder, u(0.085), "top"),
    seg("shoulders", [shoulder[0], shoulder[1], -u(T.shoulderHalf)], [shoulder[0], shoulder[1], u(T.shoulderHalf)], u(0.055), "top"),
    seg("neck", shoulder, neckTop, u(0.03), "skin"),
    { kind: "sphere", a: head, r: u(T.headR), material: "skin", name: "head" },
    { kind: "sphere", a: [head[0] - u(0.01), head[1] + u(0.012), 0], r: u(0.072), material: "hair", name: "hair", scale: [1, 0.9, 1] },
  ];
}

/** Two-bone elbow from shoulder to wrist, hanging below the line between them. */
function elbowOf(sh: Vec3, wr: Vec3, upper: number, fore: number): Vec3 {
  const v: Vec3 = [wr[0] - sh[0], wr[1] - sh[1], wr[2] - sh[2]];
  const d = Math.min(upper + fore - 1e-6, Math.hypot(v[0], v[1], v[2]));
  const e: Vec3 = [v[0] / d, v[1] / d, v[2] / d];
  const along = (upper * upper - fore * fore + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - along * along));
  // "down" made perpendicular to the arm's line
  const dn = -e[1];
  const pv: Vec3 = [-dn * e[0], -1 - dn * e[1], -dn * e[2]];
  const pl = Math.hypot(pv[0], pv[1], pv[2]) || 1;
  return [sh[0] + e[0] * along + (pv[0] / pl) * h, sh[1] + e[1] * along + (pv[1] / pl) * h, sh[2] + e[2] * along + (pv[2] / pl) * h];
}

// Behind a pram (ADR 61): a walker's legs at a shorter step, the body leaning a little, both hands on the handlebar at
// 0.58 H (handlebars adjust to the pusher) and 0.24 H ahead of the hips; the pram's size is a pram's, in metres: rear
// wheels 0.30 m across, front 0.20 m, a 0.78 × 0.46 m body under a hood, a blanket over the front of it.
const PRAM = { lean: 0.14, swing: 0.1, lift: 0.035, handX: 0.24, handY: 0.58, handZ: 0.22 };
const TYRE_OUTER = 1.18; // the view's tyre torus: radius 1, tube 0.18

function pusherParts(heightM: number, phase: number): WalkerPart[] {
  const H = heightM / 10;
  const u = (k: number) => k * H;
  const m = (x: number) => x / 10; // metres to world units
  const bob = u(0.01) * (0.5 + 0.5 * Math.cos(2 * phase));
  const hipY = u(HIP_WALK) + bob;
  const torso = u(T.shoulder - T.hip);
  const shoulder: Vec3 = [torso * Math.sin(PRAM.lean), hipY + torso * Math.cos(PRAM.lean), 0];
  const parts = upperBody(u, hipY, shoulder, PRAM.lean);
  const hx = u(PRAM.handX);
  const hy = u(PRAM.handY);
  for (const [side, p, z] of [["left", phase, -u(T.hipHalf)], ["right", phase + Math.PI, u(T.hipHalf)]] as const) {
    const hip: Vec3 = [0, hipY, z];
    const ankle: Vec3 = [u(PRAM.swing) * Math.sin(p), u(T.ankle) + u(PRAM.lift) * Math.max(0, Math.cos(p)), z];
    const k = knee(hip, ankle, u(T.thigh), u(T.shin));
    parts.push(seg(`thigh-${side}`, hip, k, u(0.055), "legs"), seg(`shin-${side}`, k, ankle, u(0.033), "legs"));
    parts.push(seg(`foot-${side}`, ankle, [ankle[0] + u(T.foot), ankle[1], z], u(T.ankle), "shoe"));
    const sh: Vec3 = [shoulder[0], shoulder[1], Math.sign(z) * u(T.shoulderHalf + 0.02)];
    const wrist: Vec3 = [hx, hy, Math.sign(z) * m(PRAM.handZ)];
    const elbow = elbowOf(sh, wrist, u(T.upperArm), u(T.forearm));
    parts.push(seg(`upper-arm-${side}`, sh, elbow, u(0.04), "top"), seg(`forearm-${side}`, elbow, wrist, u(0.032), "skin"));
  }
  return [...parts, ...pramParts(hx + m(0.01), hy)];
}

/** The pram ahead of its pusher: the handlebar at (x, y), wheels on y = 0, in walker space. */
function pramParts(x: number, y: number): WalkerPart[] {
  const m = (v: number) => v / 10;
  const rear = x + m(0.2);
  const front = rear + m(0.62);
  const [rR, rF] = [m(0.15), m(0.1)];
  const box = (name: string, c: Vec3, size: Vec3, material: WalkerMaterial): WalkerPart => ({ kind: "box", a: c, r: 1, scale: size, material, name });
  const parts: WalkerPart[] = [seg("handlebar", [x, y, -m(0.25)], [x, y, m(0.25)], m(0.015), "frame")];
  for (const zs of [-1, 1]) {
    const z = zs * m(0.24);
    parts.push(seg(`strut-${zs}`, [x, y, z], [rear, rR, z], m(0.012), "frame"));
    parts.push(seg(`rail-${zs}`, [rear, rR, z], [front, rF, z], m(0.01), "frame"));
    parts.push(seg(`post-rear-${zs}`, [rear + m(0.08), rR, zs * m(0.2)], [rear + m(0.12), m(0.4), zs * m(0.2)], m(0.01), "frame"));
    parts.push(seg(`post-front-${zs}`, [front - m(0.1), rF, zs * m(0.2)], [front - m(0.15), m(0.4), zs * m(0.2)], m(0.01), "frame"));
    // the tyre torus's outer edge is the wheel's radius, so the tyre touches the ground
    parts.push({ kind: "torus", a: [rear, rR, zs * m(0.26)], r: rR / TYRE_OUTER, material: "tyre", name: `tyre-rear-${zs}` });
    parts.push({ kind: "torus", a: [front, rF, zs * m(0.26)], r: rF / TYRE_OUTER, material: "tyre", name: `tyre-front-${zs}` });
  }
  parts.push(seg("axle-rear", [rear, rR, -m(0.26)], [rear, rR, m(0.26)], m(0.008), "frame"), seg("axle-front", [front, rF, -m(0.26)], [front, rF, m(0.26)], m(0.008), "frame"));
  const cx = (rear + front) / 2;
  parts.push(box("body", [cx, m(0.52), 0], [m(0.78), m(0.26), m(0.46)], "fabric"));
  parts.push({ kind: "sphere", a: [rear + m(0.16), m(0.56), 0], r: m(0.26), material: "fabric", name: "hood", scale: [1, 0.95, 0.92] });
  parts.push(box("blanket", [cx + m(0.12), m(0.655), 0], [m(0.42), m(0.03), m(0.42)], "blanket"));
  return parts;
}

/** Clothing, skin and hair colours for a walker from its seed: the same palette every time, never the same two walkers.
 * A runner wears sports colours (ADR 61); the pram's colours come from a second stream, so a walker's never change. */
export function walkerColours(seed: number, activity: Activity = "walk"): Record<WalkerMaterial, string> {
  const rand = mulberry32(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const sport = activity === "run";
  const person = {
    top: pick(sport ? RUNNER_PALETTE.top : WALKER_PALETTE.top),
    legs: pick(sport ? RUNNER_PALETTE.legs : WALKER_PALETTE.legs),
    skin: pick(WALKER_PALETTE.skin),
    hair: pick(WALKER_PALETTE.hair),
    shoe: pick(sport ? RUNNER_PALETTE.shoe : WALKER_PALETTE.shoe),
  };
  const pram = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const pickPram = <T>(xs: readonly T[]): T => xs[Math.floor(pram() * xs.length)];
  return { ...person, frame: pickPram(PRAM_PALETTE.frame), fabric: pickPram(PRAM_PALETTE.fabric), tyre: PRAM_PALETTE.tyre[0], blanket: pickPram(PRAM_PALETTE.blanket) };
}

/** Running kit (sRGB): bright tops, dark leggings or shorts, light trainers. */
export const RUNNER_PALETTE = {
  top: ["#d8342a", "#2f7bd6", "#e8b520", "#1f9e78", "#d9619c", "#ec7a22"],
  legs: ["#1e1f24", "#2a2f3a", "#3a3d45"],
  shoe: ["#e6e6e6", "#c9372c", "#3a6fb8"],
} as const;

/** Prams (sRGB): a dark or silver frame, a fabric body and hood, black tyres, a pale blanket. */
export const PRAM_PALETTE = {
  frame: ["#26282c", "#8a8d92"],
  fabric: ["#2b3a55", "#5a5f66", "#6b3a3f", "#4d5b3a", "#1f2226"],
  tyre: ["#1b1b1b"],
  blanket: ["#efe9dc", "#d8e3ee", "#eedbe0"],
} as const;

/** Outdoor clothing and a range of skin and hair tones (sRGB). */
export const WALKER_PALETTE = {
  top: ["#2b4a7a", "#a83a2e", "#56643c", "#6e6e74", "#d9a441", "#3f8a8c"],
  legs: ["#2a2f3a", "#4a4a4a", "#6b5b45", "#3d4a63"],
  skin: ["#f1d2b5", "#d9ae92", "#c48c63", "#a3683f", "#7b4a2a", "#4a2e1b"],
  hair: ["#1f1a17", "#3b2a1e", "#6e4b2a", "#a8865e", "#8c8c8c"],
  shoe: ["#2a2a2a", "#4a3b2a", "#5a5a60"],
} as const;

export type WalkerTrack = {
  spec: WalkerSpec;
  table: Float64Array;
  /** the line across the path per frame, metres left of the route's direction, when the scene is choreographed */
  side?: Float64Array;
  poseAt: (frame: number) => WalkerPose;
  /** the person's dog, if they walk one: its pose per frame (phase: one trot cycle per DOG_STRIDE_M) */
  dog?: { breed: DogBreed; poseAt: (frame: number) => WalkerPose };
};

/** A dog's trot: one cycle of its legs per this many metres. */
export const DOG_STRIDE_M = 0.9;

/** Every walker a section asks for, with its table over the section's frames; choreographed together (choreography.ts)
 * when `choreo` is given, each on its own fixed line otherwise. */
export function walkerTracks(trail: Trail, specs: readonly WalkerSpec[], frames: number, fps: number, choreo?: Choreo[]): WalkerTrack[] {
  const seeds = new Set<number>();
  for (const [i, spec] of specs.entries()) {
    if (seeds.has(spec.seed)) throw new Error(`walker ${i}: seed ${spec.seed} is used twice`);
    seeds.add(spec.seed);
  }
  return specs.map((spec, i) => {
    // on the path within 1 m of the centreline (C3), but someone sitting is on a bench beside it
    if (Math.abs(spec.sideM) > 1 && spec.activity !== "sit") throw new Error(`walker ${i}: sideM ${spec.sideM} is more than 1 m off the centreline (C3)`);
    // adults 1.5–1.95 m (C9); pupils and younger children 1.0–1.6 m
    const [lo, hi] = spec.role === "pupil" || spec.role === "child" ? [1.0, 1.6] : [1.5, 1.95];
    if (spec.heightM < lo || spec.heightM > hi) throw new Error(`walker ${i}: heightM ${spec.heightM} is outside ${lo}–${hi} m (C9)`);
    if (spec.activity !== undefined && !["walk", "run", "pram", "cycle", "trike", "sit"].includes(spec.activity)) throw new Error(`walker ${i}: unknown activity ${String(spec.activity)}`);
    if (spec.dog && (spec.activity ?? "walk") !== "walk") throw new Error(`walker ${i}: only someone walking walks a dog`);
    if (spec.with !== undefined && !seeds.has(spec.with)) throw new Error(`walker ${i}: walks with seed ${spec.with}, who is not in the scene`);
    const c = choreo?.[i];
    const table = c ? c.dist : walkerTable(trail, spec, frames, fps);
    const side = c?.side;
    const dog = c?.dog && spec.dog ? { breed: spec.dog.breed, poseAt: (f: number) => walkerPose(trail, c.dog!.dist, f, { ...spec, seed: spec.seed + 1 }, c.dog!.side, DOG_STRIDE_M) } : undefined;
    return { spec, table, ...(side && { side }), poseAt: (f: number) => walkerPose(trail, table, f, spec, side), ...(dog && { dog }) };
  });
}
