import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRouteModel, type RouteModel } from "../data/route";
import { expectGridBytes, mergeRegisters, validateCanopyHeader, validateDemHeader, validateImageryHeader, validateLandCoverHeader, validateOsmLines, validateTrailProfile, validateBuildings, type Feature, type OsmLine, type SectionBuilding } from "../three-core/registers";
import type { GroundImage } from "../three-core/shading";
import type { SectionConfig } from "../three-core/sections";
import type { TrailProfile } from "../three-core/trail";
import type { DemGrid, LandCover } from "../three-core/types";

// The Node-side twin of Scene3DDataProvider's loadScene3D: the same files, the same boundary validators, read from disk
// instead of fetched (docs/blender-build-plan.md §3). The React provider is not a Node entry point (it imports remotion).

export type SectionInputs = {
  route: RouteModel;
  dem: DemGrid;
  land: LandCover;
  profile: TrailProfile;
  osm: OsmLine[];
  features: Feature[];
  waterLevels: Record<string, number>;
  buildings: SectionBuilding[];
  canopy?: Float32Array;
  barriers?: OsmLine[];
  /** a satellite image on the DEM's grid, for the aerial windows (ADR 60) */
  imagery?: GroundImage;
};

/** Every input file the scene read, with its SHA-256, for the manifest (the working tree may hold uncommitted inputs). */
export type SourceFile = { path: string; sha256: string; bytes: number };

export type LoadedSection = { inputs: SectionInputs; sources: SourceFile[] };

/** The files a section window reads, relative to public/. Mirrors dataPaths() in Scene3DDataProvider.tsx, which imports remotion and so is not a Node entry point; tests/blender/export.test.ts keeps the two equal. */
export function sectionPaths(window: string) {
  const dir = `data/sections/${window}`;
  return { dem: `${dir}/dem.json`, land: `${dir}/landcover.json`, profile: `${dir}/trail-profile.json`, osm: `${dir}/osm.geojson`, features: ["data/features-3d.json", `data/features-${window}.json`], buildings: `${dir}/buildings.json`, waterLevels: "data/water-levels.json", canopy: `${dir}/canopy.json`, barriers: `${dir}/barriers.geojson`, imagery: `${dir}/imagery.json` };
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** The files `data:sync` copies from data/ to public/data/ (docs/adr/0021-data-sync.md); data/ is the source of truth. */
const SYNCED = ["railway-route.geojson", "waypoints.json", "elevation-profile.json", "features-3d.json", "water-levels.json", "assets-3d.json"];

export function loadSection(root: string, cfg: SectionConfig, wants: { canopy: boolean; barriers: boolean; imagery?: boolean }): LoadedSection {
  const sources = new Map<string, SourceFile>();
  const read = (rel: string): Buffer => {
    const path = resolve(root, rel);
    if (!existsSync(path)) throw new Error(`section ${cfg.id}: missing input ${rel}: run the data pipeline, then npm run data:sync`);
    const buf = readFileSync(path);
    sources.set(rel, { path: rel, sha256: sha256(buf), bytes: buf.length });
    return buf;
  };
  const json = (rel: string): unknown => {
    try {
      return JSON.parse(read(rel).toString("utf8"));
    } catch (e) {
      throw new Error(`section ${cfg.id}: ${rel}: ${(e as Error).message}`);
    }
  };
  const checked = <T>(rel: string, f: () => T): T => {
    try {
      return f();
    } catch (e) {
      throw new Error(`section ${cfg.id}: ${rel}: ${(e as Error).message}`);
    }
  };
  const bytes = (rel: string): ArrayBuffer => {
    const b = read(rel);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  };

  // public/data/ must still equal data/ for the files both hold, or the export would not describe the authoritative inputs
  for (const name of [...SYNCED, `features-${cfg.window}.json`]) {
    const authoritative = resolve(root, "data", name);
    if (existsSync(authoritative) && sha256(readFileSync(authoritative)) !== sha256(read(`public/data/${name}`))) {
      throw new Error(`section ${cfg.id}: public/data/${name} differs from data/${name}: run npm run data:sync`);
    }
  }

  const route = buildRouteModel(json("data/railway-route.geojson") as never, json("data/waypoints.json") as never, json("data/elevation-profile.json") as never, { tileSize: 256, layers: [] });
  const paths = sectionPaths(cfg.window);
  const prefixed = (p: string) => `public/${p}`;
  const dir = prefixed(paths.dem.slice(0, paths.dem.lastIndexOf("/")));
  const header = checked(paths.dem, () => validateDemHeader(json(prefixed(paths.dem)), paths.dem));
  const landMeta = checked(paths.land, () => validateLandCoverHeader(json(prefixed(paths.land)), paths.land));
  const heights = checked(header.file, () => expectGridBytes(bytes(`${dir}/${header.file}`), header, 4, header.file));
  const sourceIndex = checked(header.sourceFile, () => expectGridBytes(bytes(`${dir}/${header.sourceFile}`), header, 1, header.sourceFile));
  const classes = checked(landMeta.file, () => expectGridBytes(bytes(`${dir}/${landMeta.file}`), header, 1, landMeta.file));
  read("public/data/assets-3d.json");

  let canopy: Float32Array | undefined;
  if (wants.canopy) {
    const canopyHeader = checked(paths.canopy, () => validateCanopyHeader(json(prefixed(paths.canopy)), paths.canopy, header));
    canopy = new Float32Array(checked(canopyHeader.file, () => expectGridBytes(bytes(`${dir}/${canopyHeader.file}`), header, 4, canopyHeader.file)));
  }
  let barriers: OsmLine[] | undefined;
  if (wants.barriers) {
    barriers = checked(paths.barriers, () => validateOsmLines(json(prefixed(paths.barriers)), paths.barriers));
  }
  let imagery: GroundImage | undefined;
  if (wants.imagery) {
    const imageryHeader = checked(paths.imagery, () => validateImageryHeader(json(prefixed(paths.imagery)), paths.imagery, header));
    const { width, height, scale } = imageryHeader;
    const rgb = checked(imageryHeader.file, () => expectGridBytes(bytes(`${dir}/${imageryHeader.file}`), { cols: width, rows: height }, 3, imageryHeader.file));
    imagery = { width, height, scale, rgb: new Uint8Array(rgb) };
  }
  const levels = json(prefixed(paths.waterLevels)) as Record<string, { levelM?: unknown }>;
  const waterLevels = Object.fromEntries(
    Object.entries(levels).map(([id, v]) => {
      if (typeof v?.levelM !== "number" || !Number.isFinite(v.levelM)) throw new Error(`section ${cfg.id}: water level ${id}: levelM must be a number`);
      return [id, v.levelM];
    }),
  );

  const inputs: SectionInputs = {
    route,
    dem: { ...header, heights: new Float32Array(heights), sourceIndex: new Uint8Array(sourceIndex) },
    land: { legend: landMeta.legend, classes: new Uint8Array(classes) },
    profile: checked(paths.profile, () => validateTrailProfile(json(prefixed(paths.profile)), paths.profile)),
    osm: checked(paths.osm, () => validateOsmLines(json(prefixed(paths.osm)), paths.osm)),
    features: checked(paths.features.join(" + "), () => mergeRegisters(paths.features.map((f) => json(prefixed(f))))),
    waterLevels,
    buildings: checked(paths.buildings, () => validateBuildings(json(prefixed(paths.buildings)), paths.buildings)),
    ...(canopy && { canopy }),
    ...(barriers && { barriers }),
    ...(imagery && { imagery }),
  };
  return { inputs, sources: [...sources.values()].sort((a, b) => a.path.localeCompare(b.path)) };
}
