// The community film's cycle types beyond the hybrid bicycle and the adult tricycle: a two-wheeled cargo bike with a
// box ahead of the rider (a "long john"), a long-tail with a stretched rear deck, and a Christiania-style box tricycle,
// so the path reads as a place for family travel, shopping and everyday trips, not only leisure riding. Their sizes are
// typical of the bikes sold in the UK (a long john about 2.5 m long and 0.6 m wide at its box; a long-tail about 2.1 m;
// a box tricycle about 2.0 m long and 0.9 m wide at its box rim): the footprints choreography.ts keeps clear of others, and the
// Blender build's models (scripts/blender/cargobikes.py) are made to them. A loaded long john or box tricycle is ridden more gently than a hybrid.
import type { Activity, WalkerSpec } from "./walkers";

export type CycleKind = "cargo" | "longtail" | "christiania";
/** What a cycle carries: younger children (their standing heights, metres) and shopping. */
export type Load = { children?: number[]; shopping?: boolean };

type CycleType = {
  /** the activity it is ridden as: two wheels or three */
  activity: Extract<Activity, "cycle" | "trike">;
  /** half its width across the path, metres */
  halfM: number;
  /** how far it reaches behind and ahead of the rider's position (the bottom bracket), metres */
  reachM: [number, number];
  /** its pace as a share of the activity's (a loaded cargo bike is ridden gently) */
  pace: number;
  /** children it seats at most */
  seats: number;
};

export const CYCLES: Record<CycleKind, CycleType> = {
  cargo: { activity: "cycle", halfM: 0.36, reachM: [1.0, 1.75], pace: 0.82, seats: 2 },
  longtail: { activity: "cycle", halfM: 0.35, reachM: [1.35, 1.0], pace: 1, seats: 2 }, // its load over the rear wheel, ridden as a hybrid
  christiania: { activity: "trike", halfM: 0.45, reachM: [1.0, 1.45], pace: 0.9, seats: 2 },
};

/** A passenger's standing height, metres: a toddler to an infant-school child. */
const PASSENGER_HEIGHT_M: [number, number] = [0.85, 1.3];

/** The cycle's pace factor for a person (1 for anyone not riding one of these). */
export const cyclePace = (spec: WalkerSpec): number => (spec.cycle ? CYCLES[spec.cycle].pace : 1);

/** Throws if a person's cycle and load do not make sense: the cycle's activity, its seats, the passengers' heights. */
export function checkCycle(spec: WalkerSpec, i: number): void {
  if (!spec.cycle) {
    if (spec.carries) throw new Error(`walker ${i}: carries a load without a cargo cycle`);
    return;
  }
  const t = CYCLES[spec.cycle];
  if (!t) throw new Error(`walker ${i}: unknown cycle ${String(spec.cycle)}`);
  if ((spec.activity ?? "walk") !== t.activity) throw new Error(`walker ${i}: a ${spec.cycle} is ridden as ${t.activity}, not ${spec.activity ?? "walk"}`);
  if (spec.role === "pupil" || spec.role === "child") throw new Error(`walker ${i}: an adult rides a ${spec.cycle}`);
  const kids = spec.carries?.children ?? [];
  if (kids.length > t.seats) throw new Error(`walker ${i}: a ${spec.cycle} seats ${t.seats} children, not ${kids.length}`);
  for (const h of kids) if (h < PASSENGER_HEIGHT_M[0] || h > PASSENGER_HEIGHT_M[1]) throw new Error(`walker ${i}: a passenger of ${h} m is outside ${PASSENGER_HEIGHT_M.join("–")} m`);
}
