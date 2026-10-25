import React, { createContext, useContext, useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { buildRouteModel, RouteModel } from "./route";

const RouteDataContext = createContext<RouteModel | null>(null);

const loadJson = (path: string) =>
  fetch(staticFile(path)).then((r) => {
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  });

export const RouteDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [handle] = useState(() => delayRender("Loading route GIS data"));
  const [model, setModel] = useState<RouteModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [routeGeoJson, waypoints, elevationProfile, tilesManifest] =
        await Promise.all([
          loadJson("data/railway-route.geojson"),
          loadJson("data/waypoints.json"),
          loadJson("data/elevation-profile.json"),
          loadJson("data/tiles-manifest.json"),
        ]);
      if (cancelled) return;
      setModel(
        buildRouteModel(routeGeoJson, waypoints, elevationProfile, tilesManifest),
      );
    })().catch((err) => cancelRender(err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Release the hold only after the children have mounted and registered their own holds
  // (see Scene3DDataProvider).
  useEffect(() => {
    if (model) continueRender(handle);
  }, [model, handle]);

  if (!model) return null;

  return (
    <RouteDataContext.Provider value={model}>
      {children}
    </RouteDataContext.Provider>
  );
};

export function useRouteData(): RouteModel {
  const ctx = useContext(RouteDataContext);
  if (!ctx) {
    throw new Error("useRouteData() must be used inside <RouteDataProvider>");
  }
  return ctx;
}
