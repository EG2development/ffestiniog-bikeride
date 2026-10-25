import React, { createContext, useContext, useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import {
  expectGridBytes,
  validateAssets,
  validateDemHeader,
  validateFeatures,
  validateLandCoverHeader,
  validateOsmLines,
  validateTrailProfile,
  type Asset,
  type Feature,
  type OsmLine,
} from "../three-core/registers";
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
};

const Scene3DDataContext = createContext<Scene3DData | null>(null);

const load = (path: string): Promise<Response> =>
  fetch(staticFile(path)).then((r) => {
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r;
  });
const json = (path: string): Promise<unknown> => load(path).then((r) => r.json());
const bytes = (path: string): Promise<ArrayBuffer> => load(path).then((r) => r.arrayBuffer());

export const Scene3DDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender("Loading 3D terrain, land cover and registers"));
  const [data, setData] = useState<Scene3DData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [demJson, landJson] = await Promise.all([json("data/dem-poc.json"), json("data/landcover-poc.json")]);
      const header = validateDemHeader(demJson, "dem-poc.json");
      const landMeta = validateLandCoverHeader(landJson, "landcover-poc.json");
      const [heights, sources, classes, profile, osm, features, assets] = await Promise.all([
        bytes(`data/${header.file}`).then((b) => expectGridBytes(b, header, 4, header.file)),
        bytes(`data/${header.sourceFile}`).then((b) => expectGridBytes(b, header, 1, header.sourceFile)),
        bytes(`data/${landMeta.file}`).then((b) => expectGridBytes(b, header, 1, landMeta.file)),
        json("data/trail-profile-poc.json"),
        json("data/osm-poc.geojson"),
        json("data/features-3d.json"),
        json("data/assets-3d.json"),
      ]);
      if (cancelled) return;
      setData({
        dem: { ...header, heights: new Float32Array(heights), sourceIndex: new Uint8Array(sources) },
        land: { legend: landMeta.legend, classes: new Uint8Array(classes) },
        profile: validateTrailProfile(profile, "trail-profile-poc.json"),
        osm: validateOsmLines(osm, "osm-poc.geojson"),
        features: validateFeatures(features),
        assets: validateAssets(assets),
      });
    })().catch((err) => cancelRender(err));
    return () => {
      cancelled = true;
    };
  }, [handle]);

  // Release the hold only after the children have mounted, so <ThreeCanvas> already holds
  // the frame: releasing it straight after setData let a tab's first frame be captured
  // before the canvas had drawn (blank frame found by the t8 benchmark).
  useEffect(() => {
    if (data) continueRender(handle);
  }, [data, handle]);

  if (!data) return null;
  return <Scene3DDataContext.Provider value={data}>{children}</Scene3DDataContext.Provider>;
};

export function useScene3DData(): Scene3DData {
  const ctx = useContext(Scene3DDataContext);
  if (!ctx) throw new Error("useScene3DData() must be used inside <Scene3DDataProvider>");
  return ctx;
}
