// Iteration 2: status and provenance for buildings (docs/adr/0051-register-status-and-provenance.md).
// docs/adr/0020-registers-as-json.md
import type { LandmarkModel } from "./buildings";
import type { TrailProfile } from "./trail";

export type FeatureCategory = "verified" | "approximate" | "proposed" | "decorative";

const KINDS = [
  "terrain",
  "alignment",
  "trail",
  "structure",
  "road",
  "water",
  "landcover",
  "vegetation",
  "place",
  "cyclist",
  "label",
  "earthwork",
  "building",
  "barrier",
  "walker",
  "imagery",
] as const;
/** A building's state on its latest dated observation; a planning approval is "approved", never "existing" (ADR 51). */
export type FeatureStatus = "existing" | "construction" | "approved" | "demolished";
const STATUSES = ["existing", "construction", "approved", "demolished"] as const;
/** What a source is: a dated observation (map, imagery, record, photo, lidar) or a planning decision. */
const EVIDENCE = ["map", "imagery", "record", "photo", "lidar", "planning"] as const;
const OBSERVATIONS: readonly string[] = ["map", "imagery", "record", "photo", "lidar"];
export type FeatureProvenance = { urls: string[]; evidence: (typeof EVIDENCE)[number][]; observedAt: string; retrievedAt: string; licence: string; confidence: "high" | "medium" | "low" };
const BUILDING_SOURCES: readonly string[] = ["osm", "coflein", "lidar-dtm"];
const CATEGORIES = ["verified", "approximate", "proposed", "decorative"] as const;
const SOURCE_TYPES = ["osm", "lidar-dtm", "copernicus", "waypoints", "tiles", "original", "coflein"] as const;
const ASSET_KINDS = ["model", "texture", "data"] as const;

export type Feature = {
  id: string;
  kind: (typeof KINDS)[number];
  category: FeatureCategory;
  source: { type: (typeof SOURCE_TYPES)[number]; ref: string };
  scenes: string[];
  gapRefs?: string[];
  note?: string;
  /** for earthworks: the distance range they cover, in km along the route */
  fromKm?: number;
  toKm?: number;
  /** required for buildings (docs/adr/0051-register-status-and-provenance.md) */
  status?: FeatureStatus;
  provenance?: FeatureProvenance;
};

export type Asset = {
  path: string;
  kind: (typeof ASSET_KINDS)[number];
  source: string;
  licence: string;
  attribution: string;
};

type Item = Record<string, unknown>;
const isObject = (x: unknown): x is Item => typeof x === "object" && x !== null && !Array.isArray(x);
const nonEmptyString = (x: unknown): x is string => typeof x === "string" && x.trim() !== "";

function fail(path: string, problem: string): never {
  throw new Error(`${path}: ${problem}`);
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    fail(path, `expected one of ${allowed.join(", ")}, got ${JSON.stringify(value)}`);
  }
  return value as T[number];
}

/** Returns the features, or throws naming the JSON path of the first problem. */
export function validateFeatures(x: unknown): Feature[] {
  if (!Array.isArray(x)) fail("features", "the register must be an array");
  const seen = new Set<string>();
  return x.map((raw: unknown, i: number) => {
    const at = `features[${i}]`;
    if (!isObject(raw)) fail(at, "expected an object");
    if (!nonEmptyString(raw.id)) fail(`${at}.id`, "expected a non-empty string");
    if (seen.has(raw.id)) fail(`${at}.id`, `duplicate id "${raw.id}"`);
    seen.add(raw.id);
    const kind = oneOf(raw.kind, KINDS, `${at}.kind`);
    const category = oneOf(raw.category, CATEGORIES, `${at}.category`);
    if (!isObject(raw.source)) fail(`${at}.source`, "expected an object");
    const type = oneOf(raw.source.type, SOURCE_TYPES, `${at}.source.type`);
    if (!nonEmptyString(raw.source.ref)) fail(`${at}.source.ref`, "expected a non-empty string");
    if (!Array.isArray(raw.scenes) || raw.scenes.length === 0 || !raw.scenes.every(nonEmptyString)) {
      fail(`${at}.scenes`, "expected a non-empty array of scene ids");
    }
    if (raw.gapRefs !== undefined && (!Array.isArray(raw.gapRefs) || !raw.gapRefs.every(nonEmptyString))) {
      fail(`${at}.gapRefs`, "expected an array of strings");
    }
    for (const key of ["fromKm", "toKm"] as const) {
      if (raw[key] !== undefined && typeof raw[key] !== "number") fail(`${at}.${key}`, "expected a number");
    }
    if (kind === "building") validateBuilding(raw, at, type);
    return {
      ...(raw as object),
      id: raw.id,
      kind,
      category,
      source: { type, ref: raw.source.ref },
      scenes: raw.scenes as string[],
    } as Feature;
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Over 3 years by the calendar: the retrieval is after the observation's third anniversary (29 Feb counts as 28 Feb). The
 * same rule as build_buildings.py, at every date (t10 L4). */
function moreThanThreeYears(observedAt: string, retrievedAt: string): boolean {
  const [y, m, d] = observedAt.split("-").map(Number);
  const anniversary = `${String(y + 3).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(m === 2 && d === 29 ? 28 : d).padStart(2, "0")}`;
  return retrievedAt > anniversary;
}

/** YYYY-MM-DD naming a real day: 2015-13-40 matches the pattern but is no date. */
function isCalendarDate(v: unknown): v is string {
  if (typeof v !== "string" || !ISO_DATE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1];
}

/** A building's status and provenance (spec BL2–BL4, BL16). */
function validateBuilding(raw: Item, at: string, sourceType: string): void {
  if (!BUILDING_SOURCES.includes(sourceType)) fail(`${at}.source.type`, `a building needs a real source (${BUILDING_SOURCES.join(", ")}), got "${sourceType}"`);
  const status = oneOf(raw.status, STATUSES, `${at}.status`);
  const p = raw.provenance;
  if (!isObject(p)) fail(`${at}.provenance`, "required for a building: urls, evidence, observedAt, retrievedAt, licence, confidence");
  if (!Array.isArray(p.urls) || p.urls.length === 0 || !p.urls.every(nonEmptyString)) fail(`${at}.provenance.urls`, "expected a non-empty array of source URLs");
  if (!Array.isArray(p.evidence) || p.evidence.length === 0) fail(`${at}.provenance.evidence`, `expected a non-empty array of ${EVIDENCE.join(", ")}`);
  const evidence = (p.evidence as unknown[]).map((e, i) => oneOf(e, EVIDENCE, `${at}.provenance.evidence[${i}]`));
  // a real calendar date (2015-13-40 matches the pattern but is no date), and no observation after the retrieval (t9 F6)
  for (const key of ["observedAt", "retrievedAt"] as const) if (!isCalendarDate(p[key])) fail(`${at}.provenance.${key}`, "expected a calendar date, YYYY-MM-DD");
  if ((p.observedAt as string) > (p.retrievedAt as string)) fail(`${at}.provenance.observedAt`, "is later than retrievedAt"); // ISO dates sort as text
  if (!nonEmptyString(p.licence)) fail(`${at}.provenance.licence`, "expected the licence of the sources");
  const confidence = oneOf(p.confidence, ["high", "medium", "low"] as const, `${at}.provenance.confidence`);
  if ((status === "existing" || status === "construction") && !evidence.some((e) => OBSERVATIONS.includes(e))) {
    fail(`${at}.status`, `"${status}" needs a dated observation; a planning record alone gives "approved"`);
  }
  if (moreThanThreeYears(p.observedAt as string, p.retrievedAt as string) && confidence === "high") fail(`${at}.provenance.confidence`, `the latest observation (${p.observedAt as string}) is over 3 years before ${p.retrievedAt as string}: at most "medium"`);
}

/** Several register files as one validated list, so a duplicate id across files is caught too (review R6). */
export function mergeRegisters(files: unknown[]): Feature[] {
  const all: unknown[] = [];
  files.forEach((raw, i) => {
    if (!Array.isArray(raw)) fail(`register file ${i}`, "the register must be an array");
    all.push(...raw);
  });
  return validateFeatures(all);
}

export function validateAssets(x: unknown): Asset[] {
  if (!Array.isArray(x)) fail("assets", "the register must be an array");
  return x.map((raw: unknown, i: number) => {
    const at = `assets[${i}]`;
    if (!isObject(raw)) fail(at, "expected an object");
    for (const key of ["path", "source", "licence", "attribution"] as const) {
      if (!nonEmptyString(raw[key])) fail(`${at}.${key}`, "expected a non-empty string");
    }
    return {
      path: raw.path as string,
      kind: oneOf(raw.kind, ASSET_KINDS, `${at}.kind`),
      source: raw.source as string,
      licence: raw.licence as string,
      attribution: raw.attribution as string,
    };
  });
}

// Data files read at render time are checked the same way before they reach a scene
// (t9 security review: validate input at the boundary).
const FILE_NAME = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;

/** A file name taken from a data header, before it goes into a fetch path: no directories, no "..". */
export function dataFileName(x: unknown, path: string): string {
  if (typeof x !== "string" || !FILE_NAME.test(x)) fail(path, `expected a plain file name, got ${JSON.stringify(x)}`);
  return x;
}

/** Throws unless a grid file holds exactly one value per cell of its header's grid. */
export function expectGridBytes(buf: ArrayBuffer, grid: { cols: unknown; rows: unknown }, bytesPerCell: number, path: string): ArrayBuffer {
  const { cols, rows } = grid;
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || (cols as number) <= 0 || (rows as number) <= 0) {
    fail(path, `bad grid size ${String(cols)} × ${String(rows)}`);
  }
  const want = (cols as number) * (rows as number) * bytesPerCell;
  if (buf.byteLength !== want) fail(path, `expected ${want} bytes for ${String(cols)} × ${String(rows)} cells, got ${buf.byteLength}`);
  return buf;
}

// The other runtime data: the DEM and land-cover headers, the trail profile and the OSM lines (review R8).

export type DemHeader = { cols: number; rows: number; spacingM: number; originE: number; originN: number; nodata: number; file: string; sourceFile: string };
export type LandCoverHeader = { legend: string[]; file: string };
export type OsmLine = { properties: { id: string; tags: Record<string, string> }; geometry: { type: string; coordinates: unknown } };

const finiteNumber = (x: unknown, path: string): number => {
  if (typeof x !== "number" || !Number.isFinite(x)) fail(path, `expected a finite number, got ${JSON.stringify(x)}`);
  return x;
};
const numberArray = (x: unknown, path: string): number[] => {
  if (!Array.isArray(x) || !x.every((v) => typeof v === "number" && Number.isFinite(v))) fail(path, "expected an array of finite numbers");
  return x as number[];
};

export function validateDemHeader(x: unknown, path: string): DemHeader {
  if (!isObject(x)) fail(path, "expected an object");
  for (const key of ["cols", "rows"] as const) {
    if (!Number.isInteger(x[key]) || (x[key] as number) <= 0) fail(`${path}.${key}`, `expected a positive integer, got ${JSON.stringify(x[key])}`);
  }
  if (finiteNumber(x.spacingM, `${path}.spacingM`) <= 0) fail(`${path}.spacingM`, "expected a positive spacing");
  return {
    cols: x.cols as number,
    rows: x.rows as number,
    spacingM: x.spacingM as number,
    originE: finiteNumber(x.originE, `${path}.originE`),
    originN: finiteNumber(x.originN, `${path}.originN`),
    nodata: finiteNumber(x.nodata, `${path}.nodata`),
    file: dataFileName(x.file, `${path}.file`),
    sourceFile: dataFileName(x.sourceFile, `${path}.sourceFile`),
  };
}

/** A window's canopy-height grid header (docs/adr/0057-canopy-heights-from-lidar.md): the same nodes as its DEM. */
export type CanopyHeader = { cols: number; rows: number; spacingM: number; originE: number; originN: number; file: string };

export function validateCanopyHeader(x: unknown, path: string, dem: Pick<DemHeader, "cols" | "rows" | "spacingM" | "originE" | "originN">): CanopyHeader {
  return validateNodeGridHeader(x, path, dem, "canopy");
}

export type ImageryHeader = CanopyHeader & { scale: number; width: number; height: number };

/** A satellite image on the DEM's grid at `scale` pixels per node spacing, pixel (0, 0) on node (0, 0)
 * (docs/adr/0060-reel-in-the-photo-look.md): the terrain maps it by node index, so the grid must be the DEM's. */
export function validateImageryHeader(x: unknown, path: string, dem: Pick<DemHeader, "cols" | "rows" | "spacingM" | "originE" | "originN">): ImageryHeader {
  const h = validateNodeGridHeader(x, path, dem, "imagery");
  const o = x as Item;
  const scale = finiteNumber(o.scale, `${path}.scale`);
  if (!Number.isInteger(scale) || scale < 1) fail(`${path}.scale`, `expected a whole number of pixels per node spacing, got ${scale}`);
  const width = finiteNumber(o.width, `${path}.width`);
  const height = finiteNumber(o.height, `${path}.height`);
  if (width !== (h.cols - 1) * scale + 1 || height !== (h.rows - 1) * scale + 1) fail(path, `a ${width} × ${height} image is not the ${h.cols} × ${h.rows} grid at scale ${scale}`);
  return { ...h, scale, width, height };
}

function validateNodeGridHeader(x: unknown, path: string, dem: Pick<DemHeader, "cols" | "rows" | "spacingM" | "originE" | "originN">, what: string): CanopyHeader {
  if (!isObject(x)) fail(path, "expected an object");
  const h: CanopyHeader = {
    cols: finiteNumber(x.cols, `${path}.cols`),
    rows: finiteNumber(x.rows, `${path}.rows`),
    spacingM: finiteNumber(x.spacingM, `${path}.spacingM`),
    originE: finiteNumber(x.originE, `${path}.originE`),
    originN: finiteNumber(x.originN, `${path}.originN`),
    file: dataFileName(x.file, `${path}.file`),
  };
  // the tree placer and the terrain index these grids by DEM node, so they must be the DEM's own grid
  for (const k of ["cols", "rows", "spacingM", "originE", "originN"] as const) {
    if (h[k] !== dem[k]) fail(`${path}.${k}`, `${what} grid differs from the DEM (${String(h[k])} vs ${String(dem[k])})`);
  }
  return h;
}

export function validateLandCoverHeader(x: unknown, path: string): LandCoverHeader {
  if (!isObject(x)) fail(path, "expected an object");
  if (!Array.isArray(x.legend) || x.legend.length === 0 || !x.legend.every(nonEmptyString)) fail(`${path}.legend`, "expected a list of class names");
  return { legend: x.legend as string[], file: dataFileName(x.file, `${path}.file`) };
}

export function validateTrailProfile(x: unknown, path: string): TrailProfile {
  if (!isObject(x)) fail(path, "expected an object");
  const distanceM = numberArray(x.distanceM, `${path}.distanceM`);
  const elevationM = numberArray(x.elevationM, `${path}.elevationM`);
  if (distanceM.length < 2) fail(`${path}.distanceM`, "expected at least two points");
  if (elevationM.length !== distanceM.length) fail(`${path}.elevationM`, `expected ${distanceM.length} values, one per distance, got ${elevationM.length}`);
  for (let i = 1; i < distanceM.length; i++) {
    if (!(distanceM[i] > distanceM[i - 1])) fail(`${path}.distanceM`, `not increasing at index ${i}`);
  }
  const spans = (key: "bridges" | "overbridges"): [number, number][] | undefined => {
    const v = x[key];
    if (v === undefined) return undefined;
    if (!Array.isArray(v)) fail(`${path}.${key}`, "expected a list of [start, end] pairs");
    return v.map((s: unknown, i: number) => {
      const pair = numberArray(s, `${path}.${key}[${i}]`);
      if (pair.length !== 2 || pair[0] > pair[1]) fail(`${path}.${key}[${i}]`, "expected [start, end] with start ≤ end");
      return [pair[0], pair[1]] as [number, number];
    });
  };
  return { distanceM, elevationM, smoothingM: finiteNumber(x.smoothingM, `${path}.smoothingM`), bridges: spans("bridges"), overbridges: spans("overbridges") };
}

export function validateOsmLines(x: unknown, path: string): OsmLine[] {
  if (!isObject(x) || !Array.isArray(x.features)) fail(`${path}.features`, "expected a list of features");
  return x.features.map((raw: unknown, i: number) => {
    const at = `${path}.features[${i}]`;
    if (!isObject(raw) || !isObject(raw.properties) || !isObject(raw.geometry)) fail(at, "expected properties and a geometry");
    if (!nonEmptyString(raw.properties.id)) fail(`${at}.properties.id`, "expected a non-empty string");
    if (!isObject(raw.properties.tags)) fail(`${at}.properties.tags`, "expected an object");
    if (!nonEmptyString(raw.geometry.type)) fail(`${at}.geometry.type`, "expected a non-empty string");
    if (!Array.isArray(raw.geometry.coordinates)) fail(`${at}.geometry.coordinates`, "expected an array");
    return raw as OsmLine;
  });
}

/** The tallest structure in the windows is about 54 m (Trawsfynydd's reactor halls): anything above this is a data error. */
const MAX_BUILDING_M = 200;

/** One building of a section's `buildings.json` (docs/adr/0049-buildings-from-sourced-data.md): an OSM footprint in lon/lat. */
export type SectionBuilding = {
  id: string;
  osm?: string;
  footprint: [number, number][];
  heightM: number;
  heightSource?: string;
  roof: "flat" | "gabled";
  kind: "background" | "landmark";
  status: FeatureStatus;
  landmark?: string;
  model?: LandmarkModel;
};

/** A section's buildings file, checked at the boundary; each failure names the file, the index and the field (spec BL11, RD5). */
export function validateBuildings(x: unknown, path: string): SectionBuilding[] {
  if (!Array.isArray(x)) fail(path, "expected a list of buildings");
  const ids = new Set<string>();
  return x.map((raw: unknown, i: number) => {
    const at = `${path}[${i}]`;
    if (!isObject(raw)) fail(at, "expected an object");
    if (!nonEmptyString(raw.id)) fail(`${at}.id`, "expected a non-empty string");
    const ring = raw.footprint;
    if (!Array.isArray(ring) || ring.length < 3 || !ring.every((p) => Array.isArray(p) && p.length >= 2 && p.every((v) => typeof v === "number" && Number.isFinite(v))))
      fail(`${at}.footprint`, "expected a ring of 3 or more [lon, lat] points");
    if (new Set((ring as number[][]).map((p) => `${p[0]},${p[1]}`)).size < 3) fail(`${at}.footprint`, "expected 3 or more distinct points"); // t10 L3
    if (ids.has(raw.id as string)) fail(`${at}.id`, `duplicate id ${raw.id as string}`);
    ids.add(raw.id as string);
    const h = finiteNumber(raw.heightM, `${at}.heightM`);
    if (h <= 0 || h > MAX_BUILDING_M) fail(`${at}.heightM`, `expected a height above 0 and at most ${MAX_BUILDING_M} m, got ${h}`); // t9 F1
    if (raw.roof !== "flat" && raw.roof !== "gabled") fail(`${at}.roof`, `expected flat or gabled, got ${JSON.stringify(raw.roof)}`);
    if (!STATUSES.includes(raw.status as FeatureStatus)) fail(`${at}.status`, `expected one of ${STATUSES.join(", ")}`);
    const kind = raw.kind ?? "background";
    if (kind !== "background" && kind !== "landmark") fail(`${at}.kind`, "expected background or landmark");
    if (kind === "landmark") {
      const m = raw.model;
      if (!isObject(m) || !["church", "station", "block"].includes(m.type as string)) fail(`${at}.model.type`, "expected church, station or block");
      for (const k of ["lengthM", "widthM", "heightM"]) if (finiteNumber(m[k], `${at}.model.${k}`) <= 0) fail(`${at}.model.${k}`, "expected a positive size");
      if (m.towerHeightM !== undefined && finiteNumber(m.towerHeightM, `${at}.model.towerHeightM`) <= 0) fail(`${at}.model.towerHeightM`, "expected a positive height");
    }
    return { ...(raw as object), kind, footprint: (ring as number[][]).map((p) => [p[0], p[1]] as [number, number]) } as SectionBuilding;
  });
}

export type TilesManifest = { layers: { name?: string; zoom: number; tiles: { x: number; y: number; path: string }[] }[] };
const TILE_PATH = /^(?!.*(^|\/)\.\.(\/|$))[A-Za-z0-9_][A-Za-z0-9_./-]*\.(png|jpg|jpeg|webp)$/;

/** `data/tiles-manifest.json` checked at the boundary: layers with a zoom and tiles whose paths are relative image paths
 * under `public/`, never `..` (spec RD5; t9 F2). */
export function validateTilesManifest(x: unknown, path: string): TilesManifest {
  if (!isObject(x) || !Array.isArray(x.layers)) fail(`${path}.layers`, "expected a list of tile layers");
  x.layers.forEach((l: unknown, i: number) => {
    const at = `${path}.layers[${i}]`;
    if (!isObject(l) || !Number.isInteger(l.zoom) || (l.zoom as number) < 0 || !Array.isArray(l.tiles)) fail(`${at}.zoom`, "expected { zoom ≥ 0, tiles }");
    l.tiles.forEach((t: unknown, k: number) => {
      if (!isObject(t) || !Number.isInteger(t.x) || !Number.isInteger(t.y) || (t.x as number) < 0 || (t.y as number) < 0) fail(`${at}.tiles[${k}]`, "expected non-negative integer x and y");
      if (typeof t.path !== "string" || !TILE_PATH.test(t.path)) fail(`${at}.tiles[${k}].path`, `expected a relative image path, got ${JSON.stringify(t.path)}`);
    });
  });
  return x as TilesManifest;
}
