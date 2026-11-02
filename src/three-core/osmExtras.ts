// Watercourses and power lines in a window's osm.geojson (scripts/fetch_osm_extras.py; scripts/osm/extras.py). Read only:
// the roads, land cover and water polygons ignore them (roads come from the register's road refs, water from areas).
import type { OsmLine } from "./registers";

type LonLat = [number, number];
const WATERWAYS = ["river", "stream", "canal", "drain", "ditch"] as const;
export type WaterwayKind = (typeof WATERWAYS)[number];
/** A watercourse's centreline; `culvert` where OSM puts it in one (tunnel=culvert or culvert=yes), `tunnel` where it
 * runs underground otherwise (tunnel=yes and the like). */
export type WaterwayLine = { id: string; kind: WaterwayKind; name?: string; widthM?: number; culvert: boolean; tunnel: boolean; coords: LonLat[] };
export type PowerLine = { id: string; kind: "line" | "minor_line"; voltageV?: number; coords: LonLat[] };
export type PowerSupport = { id: string; kind: "tower" | "pole"; at: LonLat };

const positive = (v: string | undefined): number | undefined => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** The watercourse lines (waterway=river|stream|canal|drain|ditch), with a tagged width when it is a plausible number. */
export function waterwayLines(osm: OsmLine[]): WaterwayLine[] {
  return osm
    .filter((f) => f.geometry.type === "LineString" && (WATERWAYS as readonly string[]).includes(f.properties.tags.waterway))
    .map((f) => {
      const t = f.properties.tags;
      const widthM = positive(t.width);
      return {
        id: f.properties.id,
        kind: t.waterway as WaterwayKind,
        ...(t.name && { name: t.name }),
        ...(widthM !== undefined && widthM <= 100 && { widthM }),
        culvert: t.tunnel === "culvert" || t.culvert === "yes",
        tunnel: t.tunnel !== undefined && t.tunnel !== "no" && t.tunnel !== "culvert",
        coords: f.geometry.coordinates as LonLat[],
      };
    });
}

/** The overhead power lines (power=line|minor_line). */
export function powerLines(osm: OsmLine[]): PowerLine[] {
  return osm
    .filter((f) => f.geometry.type === "LineString" && (f.properties.tags.power === "line" || f.properties.tags.power === "minor_line"))
    .map((f) => {
      const voltageV = positive(f.properties.tags.voltage?.split(";")[0]);
      return { id: f.properties.id, kind: f.properties.tags.power as PowerLine["kind"], ...(voltageV !== undefined && { voltageV }), coords: f.geometry.coordinates as LonLat[] };
    });
}

/** The power towers and poles (Point features). */
export function powerSupports(osm: OsmLine[]): PowerSupport[] {
  return osm
    .filter((f) => f.geometry.type === "Point" && (f.properties.tags.power === "tower" || f.properties.tags.power === "pole"))
    .map((f) => ({ id: f.properties.id, kind: f.properties.tags.power as PowerSupport["kind"], at: f.geometry.coordinates as LonLat }));
}

/** Route distances (m, ascending) where a lon/lat polyline crosses the route's centreline. The projection is affine, so
 * a crossing's place along each segment is the same in lon/lat and in world units. */
export function routeCrossingsM(
  coords: LonLat[],
  route: { routePoints: { lon: number; lat: number; dist: number }[]; project: (lon: number, lat: number) => { x: number; y: number } },
): number[] {
  const rp = route.routePoints.map((p) => ({ ...route.project(p.lon, p.lat), dist: p.dist }));
  const line = coords.map(([lon, lat]) => route.project(lon, lat));
  const out: number[] = [];
  for (let k = 0; k + 1 < line.length; k++) {
    const [p, q] = [line[k], line[k + 1]];
    const [x0, x1, y0, y1] = [Math.min(p.x, q.x), Math.max(p.x, q.x), Math.min(p.y, q.y), Math.max(p.y, q.y)];
    for (let i = 0; i + 1 < rp.length; i++) {
      const [a, b] = [rp[i], rp[i + 1]];
      if (Math.max(a.x, b.x) < x0 || Math.min(a.x, b.x) > x1 || Math.max(a.y, b.y) < y0 || Math.min(a.y, b.y) > y1) continue;
      const [rx, ry, sx, sy] = [b.x - a.x, b.y - a.y, q.x - p.x, q.y - p.y];
      const den = rx * sy - ry * sx;
      if (den === 0) continue;
      const t = ((p.x - a.x) * sy - (p.y - a.y) * sx) / den;
      const u = ((p.x - a.x) * ry - (p.y - a.y) * rx) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push(a.dist + t * (b.dist - a.dist));
    }
  }
  return out.sort((m, n) => m - n);
}
