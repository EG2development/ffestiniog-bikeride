// Iteration 2: load gate (docs/adr/0043-load-gate-for-providers.md); the drape is graded towards the ground palette (docs/adr/0046-clarity-tuned-as-data.md).
import React, { createContext, useContext } from "react";
import { staticFile } from "remotion";
import type { MapDrape } from "../three/MapDrapeView";
import { DRAPE_GRADE, gradeDrapePixels } from "../three-core/atmosphere";
import { bngToWgs84 } from "../three-core/bng";
import { validateTilesManifest } from "../three-core/registers";
import { tileRange, type Bbox } from "../three-core/tileUv";
import type { DemGrid } from "../three-core/types";
import { AssetLoadError, useLoadGate } from "./loadGate";
import { memoOnSuccess } from "./memoOnSuccess";

// Loads the cached OpenTopoMap tiles that cover a DEM window into one canvas, behind delayRender,
// outside the 3D canvas (docs/adr/0033-aerial-map-tile-drape.md, docs/adr/0004-props-into-canvas.md).
// Tiles the cache lacks are drawn in the horizon colour and counted; the count is logged and reported.

const Ctx = createContext<MapDrape | null>(null);
const TILE = 256;
type Manifest = { layers: { name: string; zoom: number; tiles: { x: number; y: number; path: string }[] }[] };

const bboxOf = (dem: Pick<DemGrid, "cols" | "rows" | "spacingM" | "originE" | "originN">): Bbox => {
  const corners = [
    bngToWgs84(dem.originE, dem.originN),
    bngToWgs84(dem.originE + (dem.cols - 1) * dem.spacingM, dem.originN),
    bngToWgs84(dem.originE, dem.originN - (dem.rows - 1) * dem.spacingM),
    bngToWgs84(dem.originE + (dem.cols - 1) * dem.spacingM, dem.originN - (dem.rows - 1) * dem.spacingM),
  ];
  return { west: Math.min(...corners.map((c) => c.lon)), east: Math.max(...corners.map((c) => c.lon)), south: Math.min(...corners.map((c) => c.lat)), north: Math.max(...corners.map((c) => c.lat)) };
};

/** The cached tiles over a DEM window drawn into one canvas; a listed tile that fails names its section (spec RD5). */
async function loadDrape(window: string, dem: DemGrid, zoom: number, fill: string, signal: AbortSignal, label?: string): Promise<MapDrape> {
  const section = label ?? window; // errors name the section that asked (RD5; t10); the drape itself is the window's
  const manifestPath = "data/tiles-manifest.json";
  const r = await fetch(staticFile(manifestPath), { signal });
  if (!r.ok) throw new AssetLoadError(section, manifestPath, `HTTP ${r.status}`);
  const raw: unknown = await r.json().catch(() => Promise.reject(new AssetLoadError(section, manifestPath, "invalid JSON")));
  let manifest: Manifest;
  try {
    manifest = validateTilesManifest(raw, manifestPath) as Manifest; // a malformed manifest names itself and the section (RD5)
  } catch (e) {
    throw new AssetLoadError(section, manifestPath, (e as Error).message);
  }
  const layer = manifest.layers.find((l) => l.zoom === zoom);
  if (!layer) throw new AssetLoadError(section, manifestPath, `no cached tile layer at zoom ${zoom}`);
  const cached = new Map(layer.tiles.map((t) => [`${t.x}/${t.y}`, t.path]));
  const range = tileRange(bboxOf(dem), zoom);
  const canvas = document.createElement("canvas");
  canvas.width = (range.x1 - range.x0 + 1) * TILE;
  canvas.height = (range.y1 - range.y0 + 1) * TILE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let missing = 0;
  const loads: Promise<void>[] = [];
  for (let x = range.x0; x <= range.x1; x++) {
    for (let y = range.y0; y <= range.y1; y++) {
      const path = cached.get(`${x}/${y}`);
      if (!path) {
        missing++;
        continue;
      }
      loads.push(
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, (x - range.x0) * TILE, (y - range.y0) * TILE, TILE, TILE);
            resolve();
          };
          img.onerror = () => reject(new AssetLoadError(section, path, "failed to load"));
          img.src = staticFile(path);
        }),
      );
    }
  }
  await Promise.all(loads);
  // one look across sections: the map's paper takes the ground palette, its features keep their colours (CL6)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  gradeDrapePixels(pixels.data, DRAPE_GRADE);
  ctx.putImageData(pixels, 0, 0);
  // logged every time, 0 included, so the render checks can tell a clean drape from a missing log line (spec RD6)
  console.log(`MAP_DRAPE missing ${missing} of ${(range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1)} tiles at zoom ${zoom} (section ${section})`);
  return { canvas, range, z: zoom, missing };
}

// The four aerial scenes share one corridor window: a tab builds its drape once, not once per scene (t8 benchmark).
// The canvas is never changed after loading, so every view may read it.
const sharedDrape = memoOnSuccess<MapDrape>((key, signal) => {
  const { section, dem, zoom, fill, label } = drapeInputs.get(key)!;
  return loadDrape(section, dem, zoom, fill, signal, label);
});
const drapeInputs = new Map<string, { section: string; dem: DemGrid; zoom: number; fill: string; label?: string }>();

export const MapDrapeProvider: React.FC<{ section: string; label?: string; dem: DemGrid; zoom: number; fill: string; children: React.ReactNode }> = ({ section, label, dem, zoom, fill, children }) => {
  const key = `${section}|${zoom}|${fill}|${dem.originE},${dem.originN},${dem.cols}x${dem.rows}`;
  drapeInputs.set(key, { section, dem, zoom, fill, label });
  const drape = useLoadGate((k) => `Loading map tiles for the aerial drape (${k.split("|")[0]})`, key, (signal) => sharedDrape(key, signal));
  if (!drape) return null;
  return <Ctx.Provider value={drape}>{children}</Ctx.Provider>;
};

export function useMapDrape(): MapDrape {
  const d = useContext(Ctx);
  if (!d) throw new Error("useMapDrape() must be used inside <MapDrapeProvider>");
  return d;
}
