// Shared-use movement for a scene's people (the community film): everyone on the path moves at once, aware of everyone
// else, instead of each keeping a fixed line. Each person has a preferred line (their spec's sideM, with a slight
// seeded drift so no two walk ruler-straight) and a pace; every frame each looks ahead and picks the line that keeps
// clear of everyone they will meet, keeping left (UK practice: people pass oncoming users on their right and overtake
// on the right), and slows behind someone they cannot pass. The camera rider, when it rides through the scene, keeps
// its line and pace (its camera follows it), and everyone else gives it room. Lines change at walking or riding
// speeds, never in a jump. A dog on a lead walks at its person's side and widens their room.
import { mulberry32 } from "./rng";
import type { Trail } from "./trail";
import { CYCLES, cyclePace } from "./cycles";
import { paceKmh, type Activity, type WalkerSpec } from "./walkers";

/** Across the path, half the width a person (with whatever they push or ride) takes, metres (people.ts's HALF). */
export const BODY_HALF_M: Record<Activity, number> = { walk: 0.28, run: 0.28, pram: 0.33, cycle: 0.35, trike: 0.45, sit: 0.3 };
/** Along the path, how far a person reaches behind and ahead of their position, metres (a pram ahead of its pusher). */
export const BODY_REACH_M: Record<Activity, [number, number]> = { walk: [0.3, 0.3], run: [0.4, 0.4], pram: [0.3, 1.3], cycle: [1.0, 1.0], trike: [1.0, 1.2], sit: [0.3, 0.3] };
/** A dog at heel on a short lead: this far to its person's side and ahead of them, give or take its wander, metres. */
export const DOG = { sideM: 0.55, aheadM: 0.7, wanderSideM: 0.18, wanderAheadM: 0.25, halfM: 0.15, lengthM: 0.85 };
/** The furthest a person's centre goes from the centreline: the 3 m path less a body; someone on foot may step onto
 * the verge to let a bicycle by (a dog may walk on it). */
export const EDGE_M = 1.2;
const VERGE_STEP_M = 0.15;
/** The clearance kept between two people's outlines, metres: pedestrians, anyone passing a pedestrian on wheels, two
 * people on wheels, and two companions walking together. */
export const CLEAR_M = { foot: 0.25, wheelsByFoot: 0.5, wheels: 0.4, companions: 0.04 };
const HORIZON_S = 8; // how far ahead each person looks (a rider deciding to overtake must see the way clear)
const EARLY_M = 0.5; // and they treat others as this much longer, to be clear in good time
const STEP_M = 0.05; // the lines they choose between
const LATERAL = { walk: 0.5, run: 0.7, pram: 0.4, cycle: 0.8, trike: 0.6, sit: 0 } as Record<Activity, number>; // m/s
const ACCEL = { walk: 0.6, run: 0.8, pram: 0.5, cycle: 0.8, trike: 0.7, sit: 0 } as Record<Activity, number>; // m/s²
const BRAKE_M = 10; // a rider stopping slows over its last metres (walkers.ts)

const wheeled = (a: Activity) => a === "cycle" || a === "trike";
/** Who moves first each frame: those on foot keep their line most, people on wheels make the room (Highway Code H2). */
const rank = (a: Activity) => (wheeled(a) ? 2 : 1);

export type Choreo = {
  /** route distance, metres, per frame */
  dist: Float64Array;
  /** metres left of the route's direction, per frame */
  side: Float64Array;
  /** the dog's route distance and side per frame, if the person walks one */
  dog?: { dist: Float64Array; side: Float64Array };
};
export type ChoreoOptions = {
  /** the camera rider: its distance per frame and its line (metres left of the centreline); omit when it is not drawn */
  rider?: { table: Float64Array; lateralM: number };
};

type Mover = {
  spec: WalkerSpec;
  activity: Activity;
  dir: 1 | -1;
  pace: number; // a person's own pace factor
  partner: number; // index of the companion they walk with, or -1
  d: number;
  s: number;
  v: number; // m/s along their own direction
  u: number; // m/s across, left positive
  target: number;
  drift: (t: number) => number;
};

/** Half a person's width across the path: their activity's, or their cargo cycle's (cycles.ts). */
const halfOf = (m: { activity: Activity; spec: WalkerSpec }) => (m.spec.cycle ? CYCLES[m.spec.cycle].halfM : BODY_HALF_M[m.activity]);

/** A person's outline across the path at line s, in route-left metres: [right edge, left edge]. */
function across(m: { activity: Activity; dir: 1 | -1; spec: WalkerSpec }, s: number): [number, number] {
  const h = halfOf(m);
  if (!m.spec.dog) return [s - h, s + h];
  // the dog is at the person's left (their right if the spec says so); left of travel is +dir in route terms
  const out = (m.spec.dog.side === "right" ? -1 : 1) * m.dir * (DOG.sideM + DOG.wanderSideM + DOG.halfM);
  return [Math.min(s - h, s + out), Math.max(s + h, s + out)];
}

/** A person's reach along the route at distance d, in route metres: [behind, ahead] in the route's direction. */
function along(m: { activity: Activity; dir: 1 | -1; spec: WalkerSpec }, d: number): [number, number] {
  const [back, ahead0] = m.spec.cycle ? CYCLES[m.spec.cycle].reachM : BODY_REACH_M[m.activity];
  const ahead = m.spec.dog ? Math.max(ahead0, DOG.aheadM + DOG.wanderAheadM + DOG.lengthM / 2) : ahead0;
  return m.dir === 1 ? [d - back, d + ahead] : [d - ahead, d + back];
}

function clearance(a: Mover | null, b: Mover | null, companions: boolean): number {
  if (companions) return CLEAR_M.companions;
  const wa = a ? wheeled(a.activity) : true;
  const wb = b ? wheeled(b.activity) : true;
  return wa && wb ? CLEAR_M.wheels : wa || wb ? CLEAR_M.wheelsByFoot : CLEAR_M.foot;
}

/** When two reaches along the route overlap within the horizon, given each one's velocity (route m/s): [from, to] s, or null. */
function meeting(a: [number, number], va: number, b: [number, number], vb: number): [number, number] | null {
  // b relative to a: overlap while b's interval and a's intersect
  const lo = a[0] - b[1]; // b's offset must exceed this
  const hi = a[1] - b[0]; // and stay under this
  const rel = vb - va;
  if (Math.abs(rel) < 1e-6) return lo < 0 && hi > 0 ? [0, HORIZON_S] : null;
  // offset(t) = rel * t; within (lo, hi)
  let t0 = lo / rel;
  let t1 = hi / rel;
  if (t0 > t1) [t0, t1] = [t1, t0];
  if (t1 < 0 || t0 > HORIZON_S) return null;
  return [Math.max(0, t0), Math.min(HORIZON_S, t1)];
}

/** The scene's people moved together, frame by frame (see above). Sitters stay put. */
export function choreograph(trail: Trail, specs: readonly WalkerSpec[], frames: number, fps: number, opts: ChoreoOptions = {}): Choreo[] {
  const dt = 1 / fps;
  const bySeed = new Map(specs.map((s, i) => [s.seed, i]));
  const movers: Mover[] = specs.map((spec) => {
    const activity = spec.activity ?? "walk";
    const rand = mulberry32((spec.seed * 2654435761) >>> 0);
    const [amp, period, phase] = [0.04 + 0.05 * rand(), 7 + 5 * rand(), 2 * Math.PI * rand()];
    const own = 0.92 + 0.16 * rand();
    const partner = spec.with !== undefined ? (bySeed.get(spec.with) ?? -1) : -1;
    return {
      spec,
      activity,
      dir: spec.direction,
      pace: spec.speedKmh !== undefined || wheeled(activity) ? 1 : own,
      partner,
      d: spec.startDistM,
      s: spec.sideM,
      v: 0,
      u: 0,
      target: spec.sideM,
      drift: activity === "sit" ? () => 0 : (t: number) => amp * Math.sin((2 * Math.PI * t) / period + phase),
    };
  });
  // companions walk at one pace: the slower of the two
  for (const m of movers) if (m.partner >= 0) m.pace = Math.min(m.pace, movers[m.partner].pace);
  const wanted = (m: Mover) => {
    if (m.activity === "sit") return 0;
    const g = trail.sampleAt(m.d).gradient * m.dir;
    const pace = (m.spec.speedKmh ?? paceKmh(m.activity, g) * cyclePace(m.spec)) * m.pace;
    const left = m.spec.stopAtM === undefined ? Infinity : (m.spec.stopAtM - m.d) * m.dir;
    return (pace / 3.6) * Math.min(1, Math.sqrt(Math.max(0, left) / BRAKE_M));
  };
  for (const m of movers) m.v = wanted(m);
  const rider = opts.rider;
  const riderBody = { activity: "cycle" as Activity, dir: 1 as const, spec: { startDistM: 0, direction: 1, sideM: 0, heightM: 1.7, seed: -1 } as WalkerSpec };
  const out: Choreo[] = movers.map(() => ({ dist: new Float64Array(frames), side: new Float64Array(frames) }));
  const record = (f: number) => movers.forEach((m, i) => ((out[i].dist[f] = m.d), (out[i].side[f] = m.s)));
  record(0);
  const order = movers.map((_, i) => i).filter((i) => movers[i].activity !== "sit").sort((a, b) => rank(movers[a].activity) - rank(movers[b].activity));
  const decided = new Set<number>();

  for (let f = 1; f < frames; f++) {
    const t = f * dt;
    decided.clear();
    const goal = movers.map((m) => wanted(m));
    // companions walk at one speed: the slower one's
    movers.forEach((m, i) => m.partner >= 0 && (goal[i] = Math.min(goal[i], wanted(movers[m.partner]))));
    for (const i of order) {
      const me = movers[i];
      const pref = me.spec.sideM + me.drift(t);
      const others: { lo: number; hi: number; now: number; meet: [number, number]; need: number; oncoming: boolean; ahead: boolean; v: number; weight: number; companions: boolean; gap: number }[] = [];
      const [b0, b1] = along(me, me.d);
      const mine: [number, number] = [b0 - EARLY_M, b1 + EARLY_M];
      const vme = me.dir * me.v;
      const consider = (o: Mover | null, d: number, s: number, now: number, vRoute: number, oBody: typeof riderBody | Mover, companions: boolean) => {
        const theirs = along(oBody as Mover, d);
        const meet = meeting(mine, vme, theirs, vRoute);
        if (!meet) return;
        let [lo, hi] = across(oBody as Mover, s);
        // companions walking level are one party: nobody passes between them
        const mate = o && o.partner >= 0 && o.partner !== i ? movers[o.partner] : null;
        if (mate && Math.abs(mate.d - o!.d) < 2) {
          const [ml, mh] = across(mate, mate.s);
          [lo, hi] = [Math.min(lo, ml), Math.max(hi, mh)];
        }
        const oncoming = Math.sign(vRoute) !== 0 && Math.sign(vRoute) !== me.dir;
        const ahead = (d - me.d) * me.dir > 0;
        // someone on foot keeps their line and trusts people on wheels to make the room (they decide later this frame)
        // (stepping aside themselves only when the meeting is close)
        const weight = !wheeled(me.activity) && o !== null && wheeled(o.activity) ? (meet[0] > 2 ? 0.02 : 0.25) : 1;
        // the room between my front and their back, along the route, if they are ahead
        const gap = me.dir === 1 ? theirs[0] - b1 : b0 - theirs[1];
        others.push({ lo, hi, now, meet, need: clearance(me, o, companions), oncoming, ahead, v: vRoute * me.dir, weight, companions, gap });
      };
      movers.forEach((o, j) => {
        if (j === i) return;
        const s = decided.has(j) ? o.target : o.s;
        consider(o, o.d, s, o.s, o.dir * o.v, o, me.partner === j || o.partner === i);
      });
      if (rider) {
        const [r0, r1] = [rider.table[Math.min(f - 1, rider.table.length - 1)], rider.table[Math.min(f, rider.table.length - 1)]];
        consider(null, r0, rider.lateralM, rider.lateralM, (r1 - r0) / dt, riderBody, false);
      }
      // the line that costs least: near their own, near where they are, clear of everyone they will meet, kept left
      const edge = EDGE_M - Math.max(0, halfOf(me) - 0.28) + (wheeled(me.activity) ? 0 : VERGE_STEP_M);
      let best = me.s;
      let bestCost = Infinity;
      let blocked = false;
      for (let c = -edge; c <= edge + 1e-9; c += STEP_M) {
        const [lo, hi] = across(me, c);
        let cost = 2 * (c - pref) ** 2 + 0.5 * (c - me.s) ** 2 + 20 * Math.max(0, Math.abs(c) - EDGE_M);
        // and side by side with a companion, as they set out
        if (me.partner >= 0) cost += 12 * (c - movers[me.partner].s - (me.spec.sideM - movers[me.partner].spec.sideM)) ** 2;
        // a dog keeps to the path and its verge
        if (lo < -1.6 || hi > 1.6) cost += 50 * (Math.max(0, -1.6 - lo) + Math.max(0, hi - 1.6));
        let hard = false;
        for (const o of others) {
          const gap = Math.max(o.lo - hi, lo - o.hi);
          const soon = 1 + (HORIZON_S - o.meet[0]) / HORIZON_S; // 1 far off, 2 now
          if (gap < o.need) {
            // behind someone going their way no faster: the cost of slowing to their pace; anyone else, of a collision
            if (!o.oncoming && o.ahead && o.v <= me.v + 0.05) cost += 5 + 25 * Math.max(0, me.v - o.v);
            else {
              cost += 400 * o.weight * (o.need - gap) * soon;
              if (o.meet[0] < 1.5 && o.weight === 1) hard = true;
            }
          }
          // never through someone level with them, and not across the line of someone about to meet them
          if ((c - o.now) * (me.s - o.now) < 0) cost += o.meet[0] < 0.25 ? 2000 : 300 * soon;
          // keep left: an oncoming person passes on the right; overtake on their right
          const centre = (o.lo + o.hi) / 2;
          if (o.oncoming && (c - centre) * me.dir < 0) cost += 3 * soon;
          if (!o.oncoming && o.ahead && !o.companions && o.v < vme * me.dir - 0.2 && (c - centre) * me.dir > 0) cost += 1.5 * soon;
        }
        if (cost < bestCost) [best, bestCost, blocked] = [c, cost, hard];
      }
      me.target = best;
      decided.add(i);
      // behind someone going their way, on their line (now or chosen): no faster than them, closing no nearer than a
      // second's riding; with no clear line past someone coming, stop for them
      for (const o of others) {
        const [l1, h1] = across(me, best);
        const [l0, h0] = across(me, me.s);
        const inLine = Math.max(o.lo - h1, l1 - o.hi) < o.need || Math.max(o.lo - h0, l0 - o.hi) < o.need;
        if (!inLine) continue;
        if (!o.oncoming && o.ahead && o.gap < Math.max(0.8, me.v * 1.2)) goal[i] = Math.min(goal[i], Math.max(0, o.v) * (o.gap < 0.4 ? 0.7 : 1));
        else if (blocked && o.meet[0] <= 1.5) goal[i] = 0;
      }
    }
    // companions keep together: whichever had to slow, both do
    movers.forEach((m, i) => m.partner >= 0 && (goal[i] = Math.min(goal[i], goal[m.partner])));
    // move: across towards the chosen line at walking or riding speeds, along at the pace allowed, both eased
    for (const i of order) {
      const m = movers[i];
      const umax = LATERAL[m.activity];
      const want = Math.max(-umax, Math.min(umax, (m.target - m.s) * 1.6));
      const du = Math.max(-1.2 * dt, Math.min(1.2 * dt, want - m.u));
      m.u += du;
      m.s += m.u * dt;
      const a = ACCEL[m.activity] * (goal[i] < m.v ? 2 : 1);
      m.v += Math.max(-a * dt, Math.min(a * dt, goal[i] - m.v));
      m.d += m.dir * m.v * dt;
    }
    record(f);
  }
  // each dog: at its person's side and a little ahead, wandering on its lead (seeded), within the path and its verge
  return out.map((o, i) => {
    const m = movers[i];
    if (!m.spec.dog) return o;
    const rand = mulberry32((m.spec.seed * 40503 + 17) >>> 0);
    const w = [0, 1, 2, 3].map(() => [0.5 + rand(), 2 * Math.PI * rand()]);
    const sideSign = (m.spec.dog.side === "right" ? -1 : 1) * m.dir;
    const dog = { dist: new Float64Array(frames), side: new Float64Array(frames) };
    for (let f = 0; f < frames; f++) {
      const t = f * dt;
      // a dog stopped with its person wanders less
      const moving = f > 0 ? Math.min(1, Math.abs(o.dist[f] - o.dist[f - 1]) / dt / 0.8) : 1;
      const wa = DOG.wanderAheadM * (0.6 * Math.sin(w[0][0] * 0.9 * t + w[0][1]) + 0.4 * Math.sin(w[1][0] * 2.1 * t + w[1][1]));
      const ws = DOG.wanderSideM * (0.6 * Math.sin(w[2][0] * 0.7 * t + w[2][1]) + 0.4 * Math.sin(w[3][0] * 1.7 * t + w[3][1]));
      dog.dist[f] = o.dist[f] + m.dir * (DOG.aheadM + wa) * (0.5 + 0.5 * moving);
      dog.side[f] = Math.max(-1.75, Math.min(1.75, o.side[f] + sideSign * (DOG.sideM + ws)));
    }
    return { ...o, dog };
  });
}

/** Every moment two outlines on the path come closer across it than `minM` while level along it (people, their dogs and
 * the camera rider; a person and their own dog excepted): the check the film's tests make. One entry per pair, at its
 * closest. */
export function closeCalls(specs: readonly WalkerSpec[], choreo: readonly Choreo[], opts: ChoreoOptions & { minM: (a: Activity | "dog" | "rider", b: Activity | "dog" | "rider", companions: boolean) => number }): { a: string; b: string; frame: number; gapM: number; needM: number }[] {
  type Box = { id: string; owner: number; kind: Activity | "dog" | "rider"; along: [number, number]; across: [number, number] };
  const frames = choreo[0]?.dist.length ?? 0;
  const worst = new Map<string, { a: string; b: string; frame: number; gapM: number; needM: number }>();
  for (let f = 0; f < frames; f++) {
    const boxes: Box[] = [];
    specs.forEach((spec, i) => {
      const activity = spec.activity ?? "walk";
      const body = { activity, dir: spec.direction, spec: { ...spec, dog: undefined } };
      const c = choreo[i];
      boxes.push({ id: `${spec.seed}`, owner: i, kind: activity, along: along(body, c.dist[f]), across: across(body, c.side[f]) });
      if (c.dog) boxes.push({ id: `${spec.seed}-dog`, owner: i, kind: "dog", along: [c.dog.dist[f] - DOG.lengthM / 2, c.dog.dist[f] + DOG.lengthM / 2], across: [c.dog.side[f] - DOG.halfM, c.dog.side[f] + DOG.halfM] });
    });
    if (opts.rider) {
      const d = opts.rider.table[Math.min(f, opts.rider.table.length - 1)];
      boxes.push({ id: "rider", owner: -1, kind: "rider", along: [d - 1, d + 1], across: [opts.rider.lateralM - 0.35, opts.rider.lateralM + 0.35] });
    }
    for (let x = 0; x < boxes.length; x++) {
      for (let y = x + 1; y < boxes.length; y++) {
        const [p, q] = [boxes[x], boxes[y]];
        if (p.owner === q.owner && p.owner >= 0) continue;
        if (p.along[0] >= q.along[1] || q.along[0] >= p.along[1]) continue;
        const gap = Math.max(q.across[0] - p.across[1], p.across[0] - q.across[1]);
        const pa = p.owner >= 0 ? specs[p.owner] : undefined;
        const qa = q.owner >= 0 ? specs[q.owner] : undefined;
        const companions = !!pa && !!qa && (pa.with === qa.seed || qa.with === pa.seed);
        const need = opts.minM(p.kind, q.kind, companions);
        const key = `${p.id}|${q.id}`;
        if (gap < need && gap < (worst.get(key)?.gapM ?? Infinity)) worst.set(key, { a: p.id, b: q.id, frame: f, gapM: Math.round(gap * 100) / 100, needM: need });
      }
    }
  }
  return [...worst.values()];
}
