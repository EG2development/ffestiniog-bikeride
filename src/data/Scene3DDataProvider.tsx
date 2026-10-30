// Iteration 2: readiness through one load gate, where a test shows a fault (docs/adr/0043-load-gate-for-providers.md).
// Reel: per-section windows (docs/adr/0029-terrain-windows-per-section.md); aerial tiles come from a sibling provider (docs/adr/0033-aerial-map-tile-drape.md).
import React, { createContext, useContext } from "react";
import { staticFile } from "remotion";
import { AssetLoadError, useLoadGate } from "./loadGate";
import {
  expectGridBytes,
  mergeRegisters,
  validateAssets,
  validateCanopyHeader,
  validateDemHeader,
  validateImageryHeader,
  validateLandCoverHeader,
  validateOsmLines,
  validateTrailProfile,
  validateBuildings,
  type Asset,
  type Feature,
  type OsmLine,
  type SectionBuilding,
} from "../three-core/registers";
import type { GroundImage } from "../three-core/shading";
import type { TrailProfile } from "../three-core/trail";
import type { DemGrid, LandCover } from "../three-core/types";

// Loads the 3D-only data (docs/design-3d.md "Runtime data"); used by 3D compositions only,
// so the 2D video never fetches the DEM. Read outside <ThreeCanvas> (docs/adr/0004-props-into-canvas.md).
// Every file is validated here, at the boundary, before a scene uses it.

export type Scene3DData = {
  dem: DemGrid;
  land: LandCover;
  profile: TrailProfile;
  osm: OsmLine[];
  features: Feature[];
  assets: Asset[];
  /** shared water levels by OSM id, in metres (ADR 42) */
  waterLevels: Record<string, number>;
  /** the section's own buildings (spec BL11); none for the proof of concept */
  buildings: SectionBuilding[];
  /** the photoreal layer's optional files, loaded only when the composition asks (docs/adr/0054-photoreal-layer.md):
   * lidar canopy heights per DEM node (ADR 57) and the OSM field boundaries (ADR 58) */
  canopy?: Float32Array;
  barriers?: OsmLine[];
  /** a satellite image on the DEM's grid (docs/adr/0060-reel-in-the-photo-look.md) */
  imagery?: GroundImage;
};

/** Which optional files a composition wants; a wanted file that is missing or invalid fails the render (spec RD5). */
export type Scene3DWants = { canopy?: boolean; barriers?: boolean; imagery?: boolean };

const Scene3DDataContext = createContext<Scene3DData | null>(null);

/** The files a composition loads: the proof of concept's `-poc` set, or a section window under data/sections/<id>/. */
export function dataPaths(section?: string): { dem: string; land: string; profile: string; osm: string; features: string[]; buildings?: string; waterLevels: string; canopy?: string; barriers?: string; imagery?: string } {
  if (!section) return { dem: "data/dem-poc.json", land: "data/landcover-poc.json", profile: "data/trail-profile-poc.json", osm: "data/osm-poc.geojson", features: ["data/features-3d.json"], waterLevels: "data/water-levels.json" };
  const dir = `data/sections/${section}`;
  return { dem: `${dir}/dem.json`, land: `${dir}/landcover.json`, profile: `${dir}/trail-profile.json`, osm: `${dir}/osm.geojson`, features: ["data/features-3d.json", `data/features-${section}.json`], buildings: `${dir}/buildings.json`, waterLevels: "data/water-levels.json", canopy: `${dir}/canopy.json`, barriers: `${dir}/barriers.geojson`, imagery: `${dir}/imagery.json` };
}

/** Every file of a section, validated at the boundary; any failure names the section and the asset (spec RD5). */
async function loadScene3D(section: string | undefined, signal: AbortSignal, label?: string, wants: Scene3DWants = {}): Promise<Scene3DData> {
  const name = label ?? section ?? "poc"; // errors name the section (its id), not the data window it shares (RD5; t10)
  const load = (path: string): Promise<Response> =>
    fetch(staticFile(path), { signal }).then((r) => {
      if (!r.ok) throw new AssetLoadError(name, path, `HTTP ${r.status}`);
      return r;
    });
  const json = (path: string): Promise<unknown> => load(path).then((r) => r.json().catch(() => Promise.reject(new AssetLoadError(name, path, "invalid JSON"))));
  const bytes = (path: string): Promise<ArrayBuffer> => load(path).then((r) => r.arrayBuffer());
  const checked = <T,>(path: string, f: () => T): T => {
    try {
      return f();
    } catch (e) {
      throw new AssetLoadError(name, path, (e as Error).message);
    }
  };
  const paths = dataPaths(section);
  const dir = paths.dem.slice(0, paths.dem.lastIndexOf("/"));
  const [demJson, landJson] = await Promise.all([json(paths.dem), json(paths.land)]);
  const header = checked(paths.dem, () => validateDemHeader(demJson, paths.dem));
  const landMeta = checked(paths.land, () => validateLandCoverHeader(landJson, paths.land));
  const [heights, sources, classes, profile, osm, assets, levels, buildings, ...registers] = await Promise.all([
    bytes(`${dir}/${header.file}`).then((b) => checked(`${dir}/${header.file}`, () => expectGridBytes(b, header, 4, header.file))),
    bytes(`${dir}/${header.sourceFile}`).then((b) => checked(`${dir}/${header.sourceFile}`, () => expectGridBytes(b, header, 1, header.sourceFile))),
    bytes(`${dir}/${landMeta.file}`).then((b) => checked(`${dir}/${landMeta.file}`, () => expectGridBytes(b, header, 1, landMeta.file))),
    json(paths.profile),
    json(paths.osm),
    json("data/assets-3d.json"),
    json(paths.waterLevels),
    paths.buildings ? json(paths.buildings) : Promise.resolve([]),
    ...paths.features.map((f) => json(f)),
  ]);
  // the photoreal layer's optional files: wanted means required (RD5), and the canopy must share the DEM's grid
  let canopy: Float32Array | undefined;
  if (wants.canopy) {
    if (!paths.canopy) throw new AssetLoadError(name, "canopy.json", "the proof-of-concept data set has no canopy");
    const rawHeader = await json(paths.canopy);
    const canopyHeader = checked(paths.canopy, () => validateCanopyHeader(rawHeader, paths.canopy!, header));
    const buf = await bytes(`${dir}/${canopyHeader.file}`);
    canopy = new Float32Array(checked(`${dir}/${canopyHeader.file}`, () => expectGridBytes(buf, header, 4, canopyHeader.file)));
  }
  let barriers: OsmLine[] | undefined;
  if (wants.barriers) {
    if (!paths.barriers) throw new AssetLoadError(name, "barriers.geojson", "the proof-of-concept data set has no barriers");
    const raw = await json(paths.barriers);
    barriers = checked(paths.barriers, () => validateOsmLines(raw, paths.barriers!));
  }
  let imagery: GroundImage | undefined;
  if (wants.imagery) {
    if (!paths.imagery) throw new AssetLoadError(name, "imagery.json", "the proof-of-concept data set has no imagery");
    const rawHeader = await json(paths.imagery);
    const imageryHeader = checked(paths.imagery, () => validateImageryHeader(rawHeader, paths.imagery!, header));
    const buf = await bytes(`${dir}/${imageryHeader.file}`);
    const { width, height, scale } = imageryHeader;
    imagery = { width, height, scale, rgb: new Uint8Array(checked(`${dir}/${imageryHeader.file}`, () => expectGridBytes(buf, { cols: width, rows: height }, 3, imageryHeader.file))) };
  }
  return {
    dem: { ...header, heights: new Float32Array(heights), sourceIndex: new Uint8Array(sources) },
    land: { legend: landMeta.legend, classes: new Uint8Array(classes) },
    profile: checked(paths.profile, () => validateTrailProfile(profile, paths.profile)),
    osm: checked(paths.osm, () => validateOsmLines(osm, paths.osm)),
    features: checked(paths.features.join(" + "), () => mergeRegisters(registers)),
    assets: checked("data/assets-3d.json", () => validateAssets(assets)),
    waterLevels: checked(paths.waterLevels, () => validateWaterLevels(levels)),
    buildings: paths.buildings ? checked(paths.buildings, () => validateBuildings(buildings, paths.buildings!)) : [],
    ...(canopy && { canopy }),
    ...(barriers && { barriers }),
    ...(imagery && { imagery }),
  };
}

/** `data/water-levels.json` as { id: metres } (ADR 42). */
function validateWaterLevels(x: unknown): Record<string, number> {
  if (typeof x !== "object" || x === null || Array.isArray(x)) throw new Error("expected an object of water levels");
  return Object.fromEntries(
    Object.entries(x as Record<string, { levelM?: unknown }>).map(([id, v]) => {
      if (typeof v?.levelM !== "number" || !Number.isFinite(v.levelM)) throw new Error(`${id}: levelM must be a number`);
      return [id, v.levelM];
    }),
  );
}

export const Scene3DDataProvider: React.FC<{ section?: string; label?: string; wants?: Scene3DWants; children: React.ReactNode }> = ({ section, label, wants, children }) => {
  // one hold per section, released after the children mount; a stale load never lands (docs/adr/0043-load-gate-for-providers.md)
  // the key names the optional files too, so a composition that wants them never receives a load made without them
  const key = `${section ?? "poc"}${wants?.canopy ? "+canopy" : ""}${wants?.barriers ? "+barriers" : ""}${wants?.imagery ? "+imagery" : ""}`;
  const data = useLoadGate((k) => `Loading 3D terrain, land cover and registers for ${k}`, key, (signal) => loadScene3D(section, signal, label, wants));
  if (!data) return null;
  return <Scene3DDataContext.Provider value={data}>{children}</Scene3DDataContext.Provider>;
};

export function useScene3DData(): Scene3DData {
  const ctx = useContext(Scene3DDataContext);
  if (!ctx) throw new Error("useScene3DData() must be used inside <Scene3DDataProvider>");
  return ctx;
}
