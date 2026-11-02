// Iteration 2: holes and upward faces (docs/adr/0041-water-polygons-with-holes.md); one level per water body (docs/adr/0042-one-level-per-water-body.md).
import type { HeightAt } from "./camera";
import type { OsmLine } from "./registers";
import type { Projector } from "./types";

// Water bodies from OSM polygons (docs/adr/0032-water-from-osm.md). The surface is the body's shared level from
// data/water-levels.json when there is one, else the median rendered-ground height along its outer rings: a
// statistic, not a surveyed level.

type LonLat = [number, number];
type XZ = { x: number; z: number };
export type WaterPolygon = { outer: XZ[]; holes: XZ[][] };
/** `reservoir` where OSM tags one (water=reservoir or landuse=reservoir): a regulated level, with a draw-down shore */
export type WaterBody = { id: string; polygons: WaterPolygon[]; surfaceY: number; areaM2: number; reservoir?: true };

const isWater = (tags: Record<string, string>) => tags.natural === "water" || tags.waterway === "riverbank" || tags.landuse === "reservoir";

const signedArea = (r: LonLat[]) => r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2;
const dedupe = (r: LonLat[]): LonLat[] => (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r.slice());
const oriented = (r: LonLat[], anticlockwise: boolean) => ((signedArea(r) > 0) === anticlockwise ? r : [...r].reverse());

function inRing([x, y]: LonLat, ring: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** One normaliser for polygons with holes, mirrored by the pipeline's polygon_rings: outer + holes per part, from the
 * geometry's own holes and from `innerRings`, each given to the part that holds most of its vertices; outer rings
 * anticlockwise and holes clockwise in lon/lat, with no closing duplicate. */
export function polygonsOf(geometry: { type: string; coordinates: unknown }, innerRings: LonLat[][] = []): { outer: LonLat[]; holes: LonLat[][] }[] {
  const parts = geometry.type === "Polygon" ? [geometry.coordinates as LonLat[][]] : geometry.type === "MultiPolygon" ? (geometry.coordinates as LonLat[][][]) : [];
  const out = parts.filter((p) => Array.isArray(p[0]) && p[0].length >= 4).map((p) => ({ outer: dedupe(p[0]), holes: p.slice(1).map(dedupe) }));
  // an inner ring goes to the part holding most of its vertices: its first vertex may lie on the shore (t10 P-L6)
  for (const ring of innerRings) {
    const votes = out.map((p) => ring.filter((v) => inRing(v, p.outer)).length);
    const best = votes.indexOf(Math.max(0, ...votes));
    if (best >= 0 && votes[best] > 0) out[best].holes.push(dedupe(ring));
  }
  return out.map((p) => ({ outer: oriented(p.outer, true), holes: p.holes.map((h) => oriented(h, false)) }));
}

const shoelace = (ring: XZ[]) => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
};

export function waterBodies(osm: OsmLine[], project: Projector, heightAt: HeightAt, minAreaM2: number, levels: Record<string, number> = {}, ve = 1): WaterBody[] {
  const out: WaterBody[] = [];
  for (const f of osm) {
    if (!isWater(f.properties.tags)) continue;
    const inner = (f.properties as { inner_rings?: LonLat[][] }).inner_rings ?? [];
    const toXZ = (r: LonLat[]) => r.map(([lon, lat]) => {
      const p = project(lon, lat);
      return { x: p.x, z: p.y };
    });
    const polygons = polygonsOf(f.geometry, inner).map((p) => ({ outer: toXZ(p.outer), holes: p.holes.map(toXZ) }));
    const areaM2 = 100 * polygons.reduce((a, p) => a + shoelace(p.outer) - p.holes.reduce((h, r) => h + shoelace(r), 0), 0); // world units² → m²
    if (areaM2 < minAreaM2) continue;
    const id = f.properties.id;
    let surfaceY: number;
    if (levels[id] !== undefined) surfaceY = (levels[id] / 10) * ve;
    else {
      const hs = polygons.flatMap((p) => p.outer.map((v) => heightAt(v.x, v.z))).filter(Number.isFinite).sort((a, b) => a - b);
      if (hs.length === 0) continue;
      surfaceY = hs.length % 2 ? hs[(hs.length - 1) / 2] : (hs[hs.length / 2 - 1] + hs[hs.length / 2]) / 2;
    }
    const t = f.properties.tags;
    out.push({ id, polygons, surfaceY, areaM2, ...((t.water === "reservoir" || t.landuse === "reservoir") && { reservoir: true as const }) });
  }
  return out;
}
