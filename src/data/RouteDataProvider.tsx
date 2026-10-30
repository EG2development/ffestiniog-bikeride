// Iteration 2: load gate, where a test shows a fault (docs/adr/0043-load-gate-for-providers.md).
import React, { createContext, useContext } from "react";
import { staticFile } from "remotion";
import { AssetLoadError, useLoadGate } from "./loadGate";
import { buildRouteModel, RouteModel } from "./route";

const RouteDataContext = createContext<RouteModel | null>(null);

/** The route's GIS files; a failure names the asset (spec RD5). The 2D video uses this provider too. */
async function loadRoute(signal: AbortSignal): Promise<RouteModel> {
  const loadJson = (path: string) =>
    fetch(staticFile(path), { signal }).then((r) => {
      if (!r.ok) throw new AssetLoadError("route", path, `HTTP ${r.status}`);
      return r.json().catch(() => Promise.reject(new AssetLoadError("route", path, "invalid JSON")));
    });
  const [routeGeoJson, waypoints, elevationProfile, tilesManifest] = await Promise.all([
    loadJson("data/railway-route.geojson"),
    loadJson("data/waypoints.json"),
    loadJson("data/elevation-profile.json"),
    loadJson("data/tiles-manifest.json"),
  ]);
  return buildRouteModel(routeGeoJson, waypoints, elevationProfile, tilesManifest);
}

export const RouteDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // one hold, released after the children mount (docs/adr/0043-load-gate-for-providers.md)
  const model = useLoadGate(() => "Loading route GIS data", "route", loadRoute);
  if (!model) return null;
  return <RouteDataContext.Provider value={model}>{children}</RouteDataContext.Provider>;
};

export function useRouteData(): RouteModel {
  const ctx = useContext(RouteDataContext);
  if (!ctx) {
    throw new Error("useRouteData() must be used inside <RouteDataProvider>");
  }
  return ctx;
}
