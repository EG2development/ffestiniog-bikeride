import { roadIndex, type RoadLayout } from "./roads";
import type { Trail } from "./trail";

// Where a road meets the trail (docs/design-3d.md D10). The lidar DTM drops a road's deck to the ground beneath, and
// the trail's corridor keeps the road at the bare ground's level across it, so a road crossing the line can come out
// as a slab standing on the path, and a mapped overbridge's deck (laid straight between its way's ends) as low as
// head height over it. Neither is physically possible: the line passed under every overbridge with a railway's
// clearance, and a road meeting it on the level meets it at the line's own formation. So:
//   - over a mapped overbridge (the trail profile's `overbridges`), the deck is raised, never lowered, until its
//     soffit clears the trail by CLEAR_M, the raise eased out along the road's approaches (a hump-backed bridge);
//   - a road crossing the trail on the level (no bridge or overbridge mapped there) is brought to the trail's level
//     where it crosses, within GRADE_M either way, and eased back to its own level either side.
// Metres.
export const OVERBRIDGE_CLEAR_M = 3.7; // headroom under an overbridge's soffit; LTN 1/20 asks 2.4 m, 2.7 m preferred
const DECK_M = 0.9; // the road structure's deck depth (roadStructures.ts)
const GRADE_M = 2.5; // a road further than this above or below the trail where it crosses is left as it is
const CROSS_M = 2.5; // a station within this of the trail's centreline is on the crossing
const PARALLEL_M = 30; // a road within CROSS_M of the line over more trail than this runs along it, not across it
const SPAN_MARGIN_M = 5; // an overbridge's span from the profile, widened by this either end
const EASE_MIN_M = 12; // the shortest easing either side of a crossing
const EASE_PER_M = 10; // and this many metres of easing per metre of change (about 1 in 10, peaking near 1 in 6)
// A road mapped alongside the line so close that its carriageway would overlap the 3 m path (OSM's positions are good to
// a metre or two) is moved off it, its edge at least CLEAR_OF_PATH_M from the trail's centre; no more than NUDGE_M.
const CLEAR_OF_PATH_M = 1.8;
const NUDGE_M = 1.5;

/** The trail's centreline near a point (world units): how far off it, the distance along the route, its level, and
 * the unit vector across from the centreline towards the point. */
export type TrailFoot = { lateral: number; distM: number; level: number; away?: [number, number] };
export type CrossingOptions = {
  /** the nearest point of the trail, or null if none is near */
  trailAt: (x: number, z: number) => TrailFoot | null;
  /** the line's overbridges, metres along the route */
  overbridges: readonly [number, number][];
  /** the line's own bridges, metres along the route: a road under one dips to its ground there already (layRoads) */
  bridges: readonly [number, number][];
};
export type CrossingReport = { highway: string; distM: number; kind: "overbridge" | "level"; changeM: number };

/**
 * The layout with every road that meets the trail brought to a believable level there (see above), and the stations
 * of a level crossing marked `crossing`, so the ground under them may be graded to the road inside the trail's
 * corridor. The change is eased along the road; the trail is never moved. Returns the new layout and what changed.
 */
export function meetTrail(layout: RoadLayout, opts: CrossingOptions): { layout: RoadLayout; crossings: CrossingReport[] } {
  const v = layout.ve / 10; // metres to world units, vertically
  const crossings: CrossingReport[] = [];
  const within = (spans: readonly [number, number][], d: number, margin: number) => spans.some(([a, b]) => d >= a - margin && d <= b + margin);
  const runs = layout.runs.map((run) => {
    const feet = run.stations.map((s) => opts.trailAt(s.x, s.z));
    const delta = run.stations.map(() => 0);
    const marked = run.stations.map(() => false);
    for (let a = 0; a < feet.length; ) {
      const on = (i: number) => feet[i] !== null && feet[i]!.lateral * 10 <= CROSS_M;
      if (!on(a)) {
        a++;
        continue;
      }
      let b = a;
      let k = a;
      for (; b < feet.length && on(b); b++) if (feet[b]!.lateral < feet[k]!.lateral) k = b;
      const group = { first: a, last: b - 1 };
      a = b;
      const foot = feet[k]!;
      const spread = Math.abs(feet[group.last]!.distM - feet[group.first]!.distM);
      if (within(opts.bridges, foot.distM, 2) || spread > PARALLEL_M) continue;
      const stations = run.stations.slice(group.first, group.last + 1);
      // the change at each station of the crossing: over an overbridge, one raise for the whole deck (it keeps its
      // line); on the level, each station to the trail's own level at its foot, so the road is flush across the path
      let at: number[];
      let kind: CrossingReport["kind"];
      if (within(opts.overbridges, foot.distM, SPAN_MARGIN_M)) {
        const want = foot.level + (OVERBRIDGE_CLEAR_M + DECK_M) * v;
        const raise = Math.max(0, ...stations.map((s) => want - s.y));
        at = stations.map(() => raise);
        kind = "overbridge";
      } else {
        // the crown at the trail's surface (the road's LIFT_M over its own bed is under 0.06 m)
        at = stations.map((s, i) => feet[group.first + i]!.level - s.y);
        if (Math.abs(at[k - group.first]) > GRADE_M * v) continue;
        kind = "level";
        for (let i = group.first; i <= group.last; i++) marked[i] = true;
      }
      const change = at[k - group.first];
      const most = Math.max(...at.map(Math.abs));
      if (most < 0.02 * v) continue;
      crossings.push({ highway: run.highway, distM: Math.round(foot.distM * 10) / 10, kind, changeM: Math.round((change / v) * 100) / 100 });
      // full over the crossing, eased out from each end's change (a smootherstep, so the grade has no kink where it starts)
      const ease = Math.max(EASE_MIN_M, EASE_PER_M * (most / v));
      const [from, to] = [run.stations[group.first].alongM, run.stations[group.last].alongM];
      run.stations.forEach((s, i) => {
        const inside = i >= group.first && i <= group.last;
        const out = inside ? 0 : Math.max(0, from - s.alongM, s.alongM - to) / ease;
        if (out >= 1) return;
        const w = 1 - out * out * out * (out * (out * 6 - 15) + 10);
        const c = inside ? at[i - group.first] : s.alongM < from ? at[0] : at[at.length - 1];
        // where two crossings' easings overlap, the larger change holds
        if (Math.abs(c * w) > Math.abs(delta[i])) delta[i] = c * w;
      });
    }
    // alongside the path (not crossing it, not on a bridge): off it, if its carriageway would overlap the path
    const shift = run.stations.map((_, i) => {
      const f = feet[i];
      if (!f?.away || marked[i] || within(opts.bridges, f.distM, 2) || f.lateral * 10 <= CROSS_M) return 0;
      const need = CLEAR_OF_PATH_M - (f.lateral - run.half) * 10;
      return need > 0 && need <= NUDGE_M ? need / 10 : 0;
    });
    // eased along the road over a few stations, so it bends off the path, never kinks
    const eased = shift.map((_, i) => {
      let most = 0;
      for (let j = Math.max(0, i - 3); j <= Math.min(shift.length - 1, i + 3); j++) most = Math.max(most, shift[j] * (1 - Math.abs(i - j) / 4));
      return most;
    });
    if (!delta.some((d) => d !== 0) && !marked.some(Boolean) && !eased.some((e) => e > 0)) return run;
    return {
      ...run,
      stations: run.stations.map((s, i) => ({
        ...s,
        ...(eased[i] > 0 && feet[i]?.away && { x: s.x + feet[i]!.away![0] * eased[i], z: s.z + feet[i]!.away![1] * eased[i] }),
        y: s.y + delta[i],
        ...(s.edges && { edges: [s.edges[0] + delta[i], s.edges[1] + delta[i]] as [number, number] }),
        ...(marked[i] && { crossing: true }),
      })),
    };
  });
  return { layout: { runs, ve: layout.ve }, crossings };
}

/** True under the carriageway (and its verge) of a level crossing: the ground there is graded to the road, inside the
 * trail's corridor too, as the crossing's road sits at the trail's own level. */
export function crossingGround(layout: RoadLayout, vergeM: number): (x: number, z: number) => boolean {
  const near = roadIndex(layout, vergeM / 10);
  return (x, z) => near(x, z).some((r) => r.s.crossing === true && r.beyond * 10 <= vergeM);
}

/** meetTrail for a section's trail: `nearTrail` is its centreline index, `profile` its spans. */
export function meetsTrail(trail: Trail, nearTrail: (x: number, z: number) => { lateral: number; distM: number; interior: boolean } | null, profile: { bridges?: [number, number][]; overbridges?: [number, number][] }) {
  const trailAt = (x: number, z: number): TrailFoot | null => {
    const f = nearTrail(x, z);
    if (!f?.interior) return null;
    const s = trail.sampleAt(f.distM);
    const l = Math.hypot(x - s.x, z - s.z);
    return { lateral: f.lateral, distM: f.distM, level: s.y, ...(l > 1e-6 && { away: [(x - s.x) / l, (z - s.z) / l] as [number, number] }) };
  };
  return (layout: RoadLayout) => meetTrail(layout, { trailAt, overbridges: profile.overbridges ?? [], bridges: profile.bridges ?? [] }).layout;
}
