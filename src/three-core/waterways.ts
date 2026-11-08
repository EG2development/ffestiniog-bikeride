// Rivers and streams as water channels for the photo look's Blender build (the council map reviews of 2026-11-02): OSM's
// watercourse centrelines (osmExtras.ts) at a default width per kind, their surface just below the rendered ground, and
// left out wherever the water goes under something: a culvert or tunnel OSM tags, the trail's formation away from its
// bridges (an embankment implies a culvert), a road's carriageway or a building (with room for its bank beside them),
// or a mapped water area (drawn already).
import type { HeightAt } from "./camera";
import { waterwayLines, type WaterwayKind } from "./osmExtras";
import type { OsmLine } from "./registers";
import { inRingXZ } from "./plane";
import { roadWidthM, type RoadLine } from "./roads";
import { centrelineIndex, TRAIL_WIDTH_M, type Trail } from "./trail";
import type { Projector } from "./types";
import type { WaterBody } from "./water";

/** OSM carries no width on the windows' watercourses: these defaults stand in, and the export says so. */
export const WATERWAY_WIDTH_M: Record<WaterwayKind, number> = { river: 5, stream: 1.8, canal: 6, drain: 0.8, ditch: 0.8 };
/** how far the surface sits below the lowest of the rendered ground's samples across the channel (m) */
export const SURFACE_BELOW_M = 0.03;
/** the samples across a channel, as fractions of its width from its centreline */
const ACROSS = [-0.5, -0.25, 0, 0.25, 0.5];
/** the most a channel's points are apart along it (m) */
const STEP_M = 2;
/** the Blender build lowers the ground under the water and a little beyond it (waterside.py: 0.3 m past the edge on the
 * ground it refines near the cameras, up to 3 m from the centreline on the 4 m ground farther off): the water stops this
 * far (m) beyond its half-width from a road's carriageway or a building's walls, so that never reaches under them */
export const BANK_CLEAR_M = 3;

export type ChannelPoint = { x: number; y: number; z: number };
export type Channel = { id: string; kind: WaterwayKind; name?: string; widthM: number; widthSource: "osm" | "default"; runs: ChannelPoint[][] };

type XZ = { x: number; z: number };

const inRing = (p: XZ, ring: XZ[]) => inRingXZ(p.x, p.z, ring);

const segDistance = (p: XZ, a: XZ, b: XZ) => {
  const [vx, vz] = [b.x - a.x, b.z - a.z];
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(p.x - a.x - u * vx, p.z - a.z - u * vz);
};

/** Segments with a reach, hashed by cell: `within(p, extra)` is true when p is inside any segment's reach plus `extra`
 * (at most `pad`). */
function segmentHash(segs: { a: XZ; b: XZ; reach: number }[], cell: number, pad = 0) {
  const cells = new Map<string, typeof segs>();
  for (const s of segs) {
    const r = s.reach + pad;
    for (let cx = Math.floor((Math.min(s.a.x, s.b.x) - r) / cell); cx <= Math.floor((Math.max(s.a.x, s.b.x) + r) / cell); cx++) {
      for (let cz = Math.floor((Math.min(s.a.z, s.b.z) - r) / cell); cz <= Math.floor((Math.max(s.a.z, s.b.z) + r) / cell); cz++) {
        const key = `${cx},${cz}`;
        const list = cells.get(key);
        if (list) list.push(s);
        else cells.set(key, [s]);
      }
    }
  }
  return (p: XZ, extra = 0) => (cells.get(`${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`) ?? []).some((s) => segDistance(p, s.a, s.b) < s.reach + extra);
}

export type ChannelOptions = {
  project: Projector;
  /** the rendered ground on the mesh's own triangles, world units (-Infinity outside the window) */
  surfaceAt: HeightAt;
  trail: Trail;
  /** the trail's bridge spans (route metres): a watercourse crosses the line here, under the deck */
  spans: [number, number][];
  roads: RoadLine[];
  water: WaterBody[];
  /** building footprints, world units */
  footprints: XZ[][];
  /** the DEM's spacing (m): the trail's flattened formation reaches a cell's diagonal beyond its shoulder */
  spacingM: number;
  ve: number;
};

/** The watercourses of a window's osm.geojson as channels on the rendered ground (world units). */
export function sectionChannels(osm: OsmLine[], o: ChannelOptions): Channel[] {
  // the trail's formation: flattenCorridor's reach (ribbon, 1 m shoulder, a cell's diagonal) and a metre more
  const formation = (TRAIL_WIDTH_M / 2 + 1 + o.spacingM * Math.SQRT2 + 1) / 10;
  const foot = centrelineIndex(o.trail, formation);
  const onBridge = (d: number) => o.spans.some(([a, b]) => d >= a - 2 && d <= b + 2);
  const underTrail = (p: XZ) => {
    const f = foot(p.x, p.z);
    return f !== null && f.lateral <= formation && !onBridge(f.distM);
  };
  // a road's carriageway and a building's walls, with room for the widest channel's bank beside them
  const pad = (Math.max(...Object.values(WATERWAY_WIDTH_M), 10) / 2 + BANK_CLEAR_M) / 10;
  const nearRoad = segmentHash(
    o.roads.flatMap((r) => {
      const pts = r.coords.map(([lon, lat]) => o.project(lon, lat));
      const reach = roadWidthM(r.highway) / 2 / 10;
      return pts.slice(1).map((b, k) => ({ a: { x: pts[k].x, z: pts[k].y }, b: { x: b.x, z: b.y }, reach }));
    }),
    2,
    pad,
  );
  const nearWall = segmentHash(o.footprints.flatMap((ring) => ring.map((a, k) => ({ a, b: ring[(k + 1) % ring.length], reach: 0 }))), 2, pad);
  const inWater = (p: XZ) => o.water.some((w) => w.polygons.some((poly) => inRing(p, poly.outer) && !poly.holes.some((h) => inRing(p, h))));
  const inBuilding = (p: XZ) => o.footprints.some((ring) => inRing(p, ring));
  const out: Channel[] = [];
  for (const line of waterwayLines(osm)) {
    if (line.culvert || line.tunnel) continue;
    const widthM = line.widthM ?? WATERWAY_WIDTH_M[line.kind];
    const bank = Math.min(widthM / 2 + BANK_CLEAR_M, pad * 10) / 10;
    const pts = line.coords.map(([lon, lat]) => o.project(lon, lat)).map((p) => ({ x: p.x, z: p.y }));
    // densify to STEP_M, so the surface follows the ground along the channel
    const dense: XZ[] = [];
    pts.forEach((p, k) => {
      if (k === 0) return void dense.push(p);
      const a = pts[k - 1];
      const n = Math.max(1, Math.ceil((Math.hypot(p.x - a.x, p.z - a.z) * 10) / STEP_M));
      for (let j = 1; j <= n; j++) dense.push({ x: a.x + ((p.x - a.x) * j) / n, z: a.z + ((p.z - a.z) * j) / n });
    });
    // runs of points the water is drawn at: not under the formation, a road, a building or a water area, and on the ground
    const runs: XZ[][] = [];
    let run: XZ[] = [];
    for (const p of dense) {
      if (!Number.isFinite(o.surfaceAt(p.x, p.z)) || underTrail(p) || nearRoad(p, bank) || nearWall(p, bank) || inWater(p) || inBuilding(p)) {
        if (run.length >= 2) runs.push(run);
        run = [];
      } else run.push(p);
    }
    if (run.length >= 2) runs.push(run);
    // the surface: below the lowest ground across the run (its own direction, as the Blender ribbon is built) and round
    // the channel's edge in eight directions, so a bend's mitre stays under the banks too
    const half = widthM / 2 / 10;
    const ring = Array.from({ length: 8 }, (_, k) => [half * Math.cos((k * Math.PI) / 4), half * Math.sin((k * Math.PI) / 4)]);
    const levelled = runs.map((r) =>
      r.map((p, k) => {
        const [a, b] = [r[Math.max(0, k - 1)], r[Math.min(r.length - 1, k + 1)]];
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const [nx, nz] = [-(b.z - a.z) / len, (b.x - a.x) / len];
        const across = ACROSS.map((f) => [nx * f * 2 * half, nz * f * 2 * half]);
        const ys = [...across, ...ring].map(([dx, dz]) => o.surfaceAt(p.x + dx, p.z + dz)).filter(Number.isFinite);
        return { x: p.x, y: Math.min(...ys) - (SURFACE_BELOW_M / 10) * o.ve, z: p.z };
      }),
    );
    if (levelled.length > 0) out.push({ id: line.id, kind: line.kind, ...(line.name && { name: line.name }), widthM, widthSource: line.widthM !== undefined ? "osm" : "default", runs: levelled });
  }
  return out;
}

/** Instances (trees, grass) at least `marginM` beyond every channel's water (its half-width), world units in plan. */
export function clearOfChannels<T extends { x: number; z: number }>(items: T[], channels: Channel[], marginM: number): T[] {
  if (channels.length === 0) return items;
  const within = segmentHash(
    channels.flatMap((c) => c.runs.flatMap((r) => r.slice(1).map((b, k) => ({ a: r[k], b, reach: (c.widthM / 2 + marginM) / 10 })))),
    2,
  );
  return items.filter((t) => !within(t));
}
