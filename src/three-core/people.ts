// Trail users at random (docs/adr/0061-trail-users-at-random.md): walkers, runners and people behind prams, placed by a
// seeded draw and kept only where they keep the rider's rules.
import type { Shot } from "./camera";
import { mulberry32 } from "./rng";
import type { Trail } from "./trail";
import type { Vec3 } from "./types";
import { walkerTable, type Activity, type WalkerSpec } from "./walkers";

// A section asks for a number of people and a seed. Each person's activity, direction, side of the path, height and
// start come from the draw; a candidate is kept only if, at every frame of the section, it stays inside the section,
// clears the rider and every person already kept by the margins below whenever their spans along the path overlap,
// stays 3 m from the camera, and is on screen within 40 m at some frame (so each reads as a walker, a runner or a pram,
// not a speck). Someone the rider meets passes the follow camera, which rides 8 m behind and 3 m up, about a third of
// a second later, sweeping past the frame's lower edge as in any chase footage: keeping them out of the view near the
// camera would leave the rider meeting nobody (tried at 4.5 and 6 m). A walker may bring a companion 0.55 m to
// their side, the one pair the person margin does not apply to. The draw is seeded, so every render places the same people (RN1); nothing about them is evidence of use.

export type PeopleOptions = { count: number; seed: number };
export type PeopleInputs = {
  trail: Trail;
  frames: number;
  fps: number;
  kmRange: [number, number];
  /** the stretch of route a person may start on, metres: the stretch the section's shots see */
  alongM: [number, number];
  /** the rider's distance at each frame, and its line, metres left of the centreline */
  rider: { table: Float64Array; lateralM: number };
  shot: Shot;
};

/** Along the path, the span a person (and a pram ahead of its pusher) takes, metres behind and ahead of their position. */
const SPAN: Record<Activity, [number, number]> = { walk: [0.3, 0.3], run: [0.4, 0.4], pram: [0.3, 1.3], cycle: [1.0, 1.0], trike: [1.0, 1.2], sit: [0.3, 0.3] };
/** Across the path, half the width a person or a pram takes, metres. */
const HALF: Record<Activity, number> = { walk: 0.28, run: 0.28, pram: 0.33, cycle: 0.35, trike: 0.45, sit: 0.3 };
/** The rider: 1.75 m long, 0.35 m from the line to the outer end of the bars and an elbow. */
const RIDER = { span: [1.0, 1.0] as [number, number], half: 0.35 };
/** Clearance between the rider and a person, and between two people, beyond their half-widths, metres. */
const CLEAR = { rider: 0.27, person: 0.05 };
const CAMERA_M = 3;
const SEEN_M = 40;
/** The share of each activity after the first runner and the first pram (ADR 61). */
const MIX: [Activity, number][] = [["walk", 0.6], ["run", 0.2], ["pram", 0.2]];

type Placed = { spec: WalkerSpec & { activity: Activity }; table: Float64Array };

function span(activity: Activity, direction: 1 | -1, d: number): [number, number] {
  const [back, ahead] = SPAN[activity];
  return direction === 1 ? [d - back, d + ahead] : [d - ahead, d + back];
}
const overlap = (a: [number, number], b: [number, number]) => a[0] <= b[1] && b[0] <= a[1];

/** A point on the path at a distance and an offset left of the route's direction, 1 m up (world units). */
function at(trail: Trail, d: number, sideM: number): Vec3 {
  const s = trail.sampleAt(d);
  const l = Math.hypot(s.tangent[0], s.tangent[2]) || 1;
  const off = sideM / 10;
  return [s.x + (s.tangent[2] / l) * off, s.y + 0.1, s.z - (s.tangent[0] / l) * off];
}

/** Is the point in front of the camera, inside its 16:9 view, and within SEEN_M? */
function inView(shot: Shot, f: number, q: Vec3): boolean {
  const p = shot(f);
  const fwd = [p.target[0] - p.position[0], p.target[1] - p.position[1], p.target[2] - p.position[2]];
  const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
  const v = [q[0] - p.position[0], q[1] - p.position[1], q[2] - p.position[2]];
  const dist = Math.hypot(v[0], v[1], v[2]);
  if (dist * 10 > SEEN_M) return false;
  const depth = (v[0] * fwd[0] + v[1] * fwd[1] + v[2] * fwd[2]) / fl;
  if (depth <= 0.05) return false;
  const tv = Math.tan((p.fovDeg * Math.PI) / 360);
  const rl = Math.hypot(fwd[0], fwd[2]) || 1;
  const x = Math.abs((v[0] * -fwd[2] + v[2] * fwd[0]) / rl);
  const y = Math.sqrt(Math.max(0, dist * dist - depth * depth - x * x));
  return x <= tv * (16 / 9) * depth && y <= tv * depth;
}

/** Does a candidate keep every rule against the rider, the camera, the section and the people already placed (its
 * walking partner excepted, who is at its side on purpose)? */
function fits(c: Placed, placed: Placed[], inp: PeopleInputs, partner?: Placed): boolean {
  const { activity, direction, sideM } = c.spec;
  const [lo, hi] = [inp.kmRange[0] * 1000 + 2, inp.kmRange[1] * 1000 - 2];
  let seen = false;
  for (let f = 0; f < inp.frames; f++) {
    const d = c.table[f];
    const mine = span(activity, direction, d);
    if (mine[0] < lo || mine[1] > hi) return false;
    const r = inp.rider.table[f];
    if (overlap(mine, [r - RIDER.span[0], r + RIDER.span[1]]) && Math.abs(inp.rider.lateralM - sideM) < RIDER.half + HALF[activity] + CLEAR.rider) return false;
    for (const o of placed) {
      if (o === partner) continue;
      if (overlap(mine, span(o.spec.activity, o.spec.direction, o.table[f])) && Math.abs(o.spec.sideM - sideM) < HALF[activity] + HALF[o.spec.activity] + CLEAR.person) return false;
    }
    const cam = inp.shot(f).position;
    const body = at(inp.trail, d, sideM);
    if (Math.hypot(cam[0] - body[0], cam[1] - body[1], cam[2] - body[2]) * 10 < CAMERA_M) return false;
    const pram = activity === "pram" ? at(inp.trail, d + direction * 0.8, sideM) : null;
    if (pram && Math.hypot(cam[0] - pram[0], cam[1] - pram[1], cam[2] - pram[2]) * 10 < CAMERA_M) return false;
    if (!seen && f % 3 === 0) seen = inView(inp.shot, f, body);
  }
  return seen;
}

/** The section's people: `count` at most, a runner and a pram among the first, the rest by MIX; deterministic by seed. */
export function placePeople(inp: PeopleInputs, opts: PeopleOptions): WalkerSpec[] {
  const rand = mulberry32(opts.seed);
  const pickMix = (): Activity => {
    let x = rand();
    for (const [a, w] of MIX) if ((x -= w) < 0) return a;
    return "walk";
  };
  const wanted: Activity[] = ["run", "pram"];
  while (wanted.length < opts.count) wanted.push(pickMix());
  // shuffled, so the guaranteed runner and pram are not always placed first
  for (let i = wanted.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [wanted[i], wanted[j]] = [wanted[j], wanted[i]];
  }
  const placed: Placed[] = [];
  let nextSeed = opts.seed * 100;
  const make = (activity: Activity, direction: 1 | -1, sideM: number, heightM: number, startDistM: number): Placed => {
    const spec = { activity, direction, sideM: Math.round(sideM * 100) / 100, heightM: Math.round(heightM * 100) / 100, startDistM: Math.round(startDistM * 10) / 10, seed: ++nextSeed };
    return { spec, table: walkerTable(inp.trail, spec, inp.frames, inp.fps) };
  };
  for (const activity of wanted) {
    if (placed.length >= opts.count) break;
    for (let attempt = 0; attempt < 120; attempt++) {
      const direction: 1 | -1 = rand() < 0.5 ? 1 : -1;
      // most keep to the rider's right; a few on the left, kept only where the rider never comes alongside
      const right = rand() < 0.75;
      const sideM = (right ? -1 : 1) * (activity === "pram" ? 0.5 + 0.5 * rand() : 0.45 + 0.55 * rand());
      const c = make(activity, direction, sideM, 1.55 + 0.37 * rand(), inp.alongM[0] + (inp.alongM[1] - inp.alongM[0]) * rand());
      if (!fits(c, placed, inp)) continue;
      placed.push(c);
      // a walker may walk with someone, at their side towards the middle of the path
      if (activity === "walk" && placed.length < opts.count && rand() < 0.4) {
        const side = c.spec.sideM + (c.spec.sideM < 0 ? 0.55 : -0.55);
        const mate = make("walk", direction, side, 1.55 + 0.37 * rand(), c.spec.startDistM + (rand() - 0.5) * 0.6);
        if (Math.abs(side) <= 1 && fits(mate, placed, inp, c)) placed.push(mate);
      }
      break;
    }
  }
  return placed.map((p) => p.spec);
}
