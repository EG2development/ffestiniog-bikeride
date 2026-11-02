// Overhead power lines for the photo look's Blender build (existing features, OSM): each support where OSM maps a
// power=tower or power=pole node, at a height its tags or its line's voltage suggest, and each line as the run of
// supports its way passes through. A line's vertex OSM leaves untagged stands as an implied support of its line's kind.
import type { HeightAt } from "./camera";
import type { OsmLine } from "./registers";
import type { Projector } from "./types";

type LonLat = [number, number];
export type SupportKind = "tower" | "pole";
export type PlacedSupport = {
  id: string;
  kind: SupportKind;
  /** world units, on the rendered ground */
  x: number;
  y: number;
  z: number;
  heightM: number;
  heightSource: "osm" | "default";
  /** the highest voltage of the lines it carries (V), where tagged */
  voltageV?: number;
  /** not a tagged node: a vertex of its line */
  implied?: true;
};
export type PlacedLine = { id: string; kind: "line" | "minor_line"; voltageV?: number; cables: number; supports: number[] };

/** Volts from an OSM voltage tag: the highest of its `;`-separated values. */
export function voltageOf(tag: string | undefined): number | undefined {
  const vs = (tag ?? "").split(";").map((v) => Number.parseFloat(v)).filter((v) => Number.isFinite(v) && v > 0);
  return vs.length > 0 ? Math.max(...vs) : undefined;
}

/**
 * A support's default height (m) where OSM has none: a wood pole of 8 m at low voltage to 11-12 m at 33 kV; a steel
 * lattice tower about 13 m at 33 kV, 27 m at 132 kV, 40 m at 275 kV and 46 m at 400 kV (typical of the UK's lines,
 * not measured). An untagged voltage is taken as 11 kV on a minor line and 33 kV on a line.
 */
export function supportHeightM(kind: SupportKind, voltageV: number | undefined): number {
  const v = voltageV ?? 11000;
  if (kind === "pole") return v <= 1000 ? 8 : v <= 11000 ? 9.5 : v <= 33000 ? 11 : 12;
  return v <= 33000 ? 13 : v <= 66000 ? 18 : v <= 132000 ? 27 : v <= 275000 ? 40 : 46;
}

const key = (p: LonLat) => `${p[0]},${p[1]}`;
const positive = (v: string | undefined) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** The window's power supports and lines, on the rendered ground; supports outside the ground are left out and a line
 * only joins the supports it keeps. */
export function placePower(osm: OsmLine[], project: Projector, surfaceAt: HeightAt): { supports: PlacedSupport[]; lines: PlacedLine[] } {
  const ways = osm.filter((f) => f.geometry.type === "LineString" && (f.properties.tags.power === "line" || f.properties.tags.power === "minor_line"));
  const tagged = new Map(
    osm.filter((f) => f.geometry.type === "Point" && (f.properties.tags.power === "tower" || f.properties.tags.power === "pole")).map((f) => [key(f.geometry.coordinates as LonLat), f]),
  );
  // the voltage a support carries: the highest of its ways'
  const volts = new Map<string, number>();
  const minorOnly = new Map<string, boolean>();
  for (const w of ways) {
    const v = voltageOf(w.properties.tags.voltage) ?? (w.properties.tags.power === "line" ? 33000 : undefined);
    for (const c of w.geometry.coordinates as LonLat[]) {
      if (v !== undefined) volts.set(key(c), Math.max(volts.get(key(c)) ?? 0, v));
      minorOnly.set(key(c), (minorOnly.get(key(c)) ?? true) && w.properties.tags.power === "minor_line");
    }
  }
  const supports: PlacedSupport[] = [];
  const index = new Map<string, number>();
  const place = (c: LonLat, way: OsmLine): number => {
    const k = key(c);
    const known = index.get(k);
    if (known !== undefined) return known;
    const p = project(c[0], c[1]);
    const y = surfaceAt(p.x, p.y);
    if (!Number.isFinite(y)) return -1;
    const node = tagged.get(k);
    const voltageV = volts.get(k);
    // an implied support is a pole on a minor line or up to 33 kV, else a tower
    const kind: SupportKind = node ? (node.properties.tags.power as SupportKind) : minorOnly.get(k) || (voltageV ?? 0) <= 33000 ? "pole" : "tower";
    const tagHeight = node ? positive(node.properties.tags.height) : undefined;
    supports.push({
      id: node ? node.properties.id : `${way.properties.id}@${c[0]},${c[1]}`,
      kind,
      x: p.x,
      y,
      z: p.y,
      heightM: tagHeight !== undefined && tagHeight <= 80 ? tagHeight : supportHeightM(kind, voltageV),
      heightSource: tagHeight !== undefined && tagHeight <= 80 ? "osm" : "default",
      ...(voltageV !== undefined && { voltageV }),
      ...(!node && { implied: true as const }),
    });
    index.set(k, supports.length - 1);
    return supports.length - 1;
  };
  const lines: PlacedLine[] = [];
  for (const w of ways) {
    const t = w.properties.tags;
    const cables = Math.min(6, Math.max(1, Math.round(positive(t.cables) ?? 3)));
    const voltageV = voltageOf(t.voltage);
    let run: number[] = [];
    const close = () => {
      if (run.length >= 2) lines.push({ id: w.properties.id, kind: t.power as PlacedLine["kind"], ...(voltageV !== undefined && { voltageV }), cables, supports: run });
      run = [];
    };
    for (const c of w.geometry.coordinates as LonLat[]) {
      const i = place(c, w);
      if (i < 0) close();
      else run.push(i);
    }
    close();
  }
  // a tagged support no line in the window reaches still stands
  for (const [k, f] of tagged) if (!index.has(k)) place(f.geometry.coordinates as LonLat, f);
  return { supports, lines };
}
