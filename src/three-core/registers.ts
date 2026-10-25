// docs/adr/0020-registers-as-json.md
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
] as const;
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
