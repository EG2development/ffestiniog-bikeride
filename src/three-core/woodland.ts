// Woodland character from OSM tags (review of the 2012+ aerial imagery, refs-aerial items 1, 2, 5 and 6): the woods along
// the line are mostly broadleaf, with conifers in the plantation blocks only. Each woodland node of a window takes the
// kind of the smallest OSM woodland polygon that holds it, so the tree placer can draw its mix of kinds from the tags
// instead of one share for every wood.
import { bngToWgs84 } from "./bng";
import type { OsmLine } from "./registers";
import type { DemGrid, LandCover } from "./types";
import { polygonsOf } from "./water";

/** A woodland node's kind, from its polygon's tags; `unknown` is a woodland node no tagged polygon holds. */
export const WOOD = { unknown: 0, broadleaf: 1, conifer: 2, mixed: 3 } as const;
export type WoodKind = keyof typeof WOOD;

/**
 * The share of conifers among a node's trees, by its kind (index = WOOD value). Broadleaf woods keep a few conifers (a
 * natural=wood rarely has none); a plantation is mostly conifer; an untagged wood is 88 % broadleaf, as the imagery is.
 */
export const CONIFER_SHARE = [0.12, 0.04, 0.9, 0.5] as const;

/**
 * The kind a woodland polygon's tags give, or null when the feature is not woodland. leaf_type decides when it is
 * tagged (needleleaved, broadleaved, mixed); otherwise landuse=forest is a plantation (conifer) and natural=wood a
 * semi-natural, broadleaf wood. The windows' osm.geojson keep `natural` and `landuse` only (build_section_data.py
 * KEEP_TAGS): leaf_type is read where a window carries it.
 */
export function woodKindOf(tags: Record<string, string>): WoodKind | null {
  const wood = tags.natural === "wood" || tags.landuse === "forest";
  if (!wood) return null;
  if (tags.leaf_type === "needleleaved") return "conifer";
  if (tags.leaf_type === "broadleaved") return "broadleaf";
  if (tags.leaf_type === "mixed") return "mixed";
  return tags.landuse === "forest" ? "conifer" : "broadleaf";
}

/**
 * Woods whose OSM tags say landuse=forest (read as a plantation) with no leaf_type, where the reference review found a
 * semi-natural broadleaf wood instead (evidence only, in words; no geometry copied): Coed Caersaeson, Capel Utica to
 * the lake's north tip, km 9.3-10.9, closed broadleaf canopy with conifers in a few clumps by the lake (Gwynedd map
 * viewer captures 164531, 164542 and 164558, reviewed 2 Nov 2026). A leaf_type tag, where OSM gains one, wins.
 */
export const WOOD_EVIDENCE: Record<string, WoodKind> = { "relation/6373661": "broadleaf" };

type LonLat = [number, number];
type Poly = { kind: WoodKind; area: number; outer: LonLat[]; holes: LonLat[][]; box: [number, number, number, number] };

function inRing([x, y]: LonLat, ring: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const ringArea = (r: LonLat[]) => Math.abs(r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0)) / 2;

/** The window's woodland polygons with their kinds and bounding boxes (lon/lat). */
export function woodlandPolygons(osm: OsmLine[]): Poly[] {
  const out: Poly[] = [];
  for (const f of osm) {
    const tagged = woodKindOf(f.properties.tags);
    if (!tagged) continue;
    const kind = f.properties.tags.leaf_type ? tagged : (WOOD_EVIDENCE[f.properties.id] ?? tagged);
    const inner = (f.properties as { inner_rings?: LonLat[][] }).inner_rings ?? [];
    for (const p of polygonsOf(f.geometry, inner)) {
      const xs = p.outer.map((v) => v[0]);
      const ys = p.outer.map((v) => v[1]);
      out.push({ kind, area: ringArea(p.outer), outer: p.outer, holes: p.holes, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
    }
  }
  return out.sort((a, b) => a.area - b.area); // smallest first: the most specific mapping wins
}

/**
 * Each DEM node's wood kind (WOOD values): for a node the land cover classes as woodland, the kind of the smallest
 * woodland polygon holding it, else `unknown`; every other node is `unknown` too (the placer reads woodland nodes only).
 */
export function woodKindGrid(dem: DemGrid, land: LandCover, osm: OsmLine[]): Uint8Array {
  const out = new Uint8Array(dem.cols * dem.rows);
  const woodland = land.legend.findIndex((name) => /wood|forest/.test(name));
  const polys = woodlandPolygons(osm);
  if (woodland < 0 || polys.length === 0) return out;
  for (let r = 0; r < dem.rows; r++) {
    for (let c = 0; c < dem.cols; c++) {
      const i = r * dem.cols + c;
      if (land.classes[i] !== woodland) continue;
      const { lon, lat } = bngToWgs84(dem.originE + c * dem.spacingM, dem.originN - r * dem.spacingM);
      const pt: LonLat = [lon, lat];
      const hit = polys.find((p) => lon >= p.box[0] && lon <= p.box[2] && lat >= p.box[1] && lat <= p.box[3] && inRing(pt, p.outer) && !p.holes.some((h) => inRing(pt, h)));
      if (hit) out[i] = WOOD[hit.kind];
    }
  }
  return out;
}
