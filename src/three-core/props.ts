// Street furniture for the community film: benches, cycle lockers, signs, the bus and its stop. Each prop is either
// existing infrastructure placed where OpenStreetMap maps it (data/bus-stops.json) or a proposal placed beside the trail,
// and says which: the film must never show a proposal as built (docs/community-reel-research.md).
import type { HeightAt } from "./camera";
import type { Trail } from "./trail";
import type { Projector, Vec3 } from "./types";

export type PropKind = "bench" | "lockers" | "fingerpost" | "bus-shelter" | "bus-stop-flag" | "bus" | "viewpoint-board";
export type PropStatus = "proposed" | "existing";

export type PropSpec = {
  kind: PropKind;
  status: PropStatus;
  /** beside the trail (route distance; metres left of the route's direction, negative right), or at a mapped stop
   * (its OSM id in data/bus-stops.json) and metres east and north of it */
  at: { distM: number; sideM: number } | { stop: string; eastM?: number; northM?: number };
  /** which way the prop's front faces: degrees anticlockwise from the route's direction (beside the trail), or a
   * compass bearing (clockwise from north) where it is placed by position */
  headingDeg: number;
  /** what the Blender builder needs beyond its kind (a fingerpost's arms, a stop's name), passed through as data */
  opts?: Record<string, unknown>;
  /** where an existing prop's position comes from (an OSM id) */
  source?: string;
};

export type PlacedProp = { kind: PropKind; status: PropStatus; position: Vec3; yaw: number; opts: Record<string, unknown>; source?: string };

export type MappedPoint = { lon: number; lat: number };

/** Each prop on the rendered ground, in world units, with its yaw about +y (the walkers' convention: +x onto its front).
 * A prop at a stop is placed through the shared projection (ADR 5): its east and north are the projection's own
 * directions there, its metres world units of 10 m. */
export function placeProps(props: readonly PropSpec[], trail: Trail, project: Projector, groundAt: HeightAt, stops: ReadonlyMap<string, MappedPoint> = new Map()): PlacedProp[] {
  return props.map((p) => {
    let x: number;
    let z: number;
    let dx: number;
    let dz: number;
    if ("distM" in p.at) {
      const s = trail.sampleAt(p.at.distM);
      const l = Math.hypot(s.tangent[0], s.tangent[2]) || 1;
      const [fx, fz] = [s.tangent[0] / l, s.tangent[2] / l];
      // left of the route's direction is (fz, -fx) in the XZ plane, as for the walkers
      [x, z] = [s.x + (fz * p.at.sideM) / 10, s.z - (fx * p.at.sideM) / 10];
      // anticlockwise seen from above (+y): from +x towards -z
      const a = (p.headingDeg * Math.PI) / 180;
      [dx, dz] = [fx * Math.cos(a) + fz * Math.sin(a), fz * Math.cos(a) - fx * Math.sin(a)];
    } else {
      const stop = stops.get(p.at.stop);
      if (!stop) throw new Error(`a ${p.kind} prop names stop ${p.at.stop}, which data/bus-stops.json does not hold`);
      const here = project(stop.lon, stop.lat);
      const unit = (q: { x: number; y: number }) => {
        const l = Math.hypot(q.x - here.x, q.y - here.y);
        return [(q.x - here.x) / l, (q.y - here.y) / l];
      };
      const [ex, ez] = unit(project(stop.lon + 1e-4, stop.lat));
      const [nx, nz] = unit(project(stop.lon, stop.lat + 1e-4));
      const [e, n] = [(p.at.eastM ?? 0) / 10, (p.at.northM ?? 0) / 10];
      const b = (p.headingDeg * Math.PI) / 180;
      [x, z, dx, dz] = [here.x + ex * e + nx * n, here.y + ez * e + nz * n, nx * Math.cos(b) + ex * Math.sin(b), nz * Math.cos(b) + ez * Math.sin(b)];
    }
    const y = groundAt(x, z);
    if (!Number.isFinite(y)) throw new Error(`a ${p.kind} prop stands off the terrain window`);
    return { kind: p.kind, status: p.status, position: [x, y, z] as Vec3, yaw: Math.atan2(-dz, dx), opts: p.opts ?? {}, ...(p.source && { source: p.source }) };
  });
}

/** The legend line naming a scene's proposals, so a viewer never reads them as built; null when it has none. */
export function proposedLine(props: readonly PropSpec[]): string | null {
  const names: Record<PropKind, string> = { bench: "benches", lockers: "cycle lockers", fingerpost: "signs", "viewpoint-board": "viewpoint", "bus-shelter": "shelter", "bus-stop-flag": "stop", bus: "bus" };
  const kinds = [...new Set(props.filter((p) => p.status === "proposed").map((p) => names[p.kind]))];
  return kinds.length > 0 ? `Proposed (concept only): ${kinds.join(", ")}` : null;
}
/** The same line in Welsh, for a bilingual film. */
export function proposedLineCy(props: readonly PropSpec[]): string | null {
  const names: Record<PropKind, string> = { bench: "meinciau", lockers: "loceri beiciau", fingerpost: "arwyddion", "viewpoint-board": "man gwylio", "bus-shelter": "cysgodfan", "bus-stop-flag": "safle bws", bus: "bws" };
  const kinds = [...new Set(props.filter((p) => p.status === "proposed").map((p) => names[p.kind]))];
  return kinds.length > 0 ? `Arfaethedig (cysyniad yn unig): ${kinds.join(", ")}` : null;
}
