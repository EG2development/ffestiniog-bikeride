import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { MapTile, TileLayer } from "../data/route";
import { useRouteData } from "../data/RouteDataProvider";

// Real map tiles: OpenTopoMap (opentopomap.org), map data (c) OpenStreetMap
// contributors, SRTM | map style (c) OpenTopoMap (CC-BY-SA). Fetched once
// into public/maps/tiles/ by the pipeline described in
// data/source-register.md — this component only lays out the already-
// downloaded tiles, it does not fetch them live from the tile server.
//
// Two layers: a cheap, large-coverage "wide" layer (so wide establishing
// shots never show gaps around the rotated map) and a "detail" layer with
// much higher resolution over just the route corridor, drawn on top.
//
// Each tile is placed with a 2D affine transform derived from its real
// geographic corners run through the same project() used for the route and
// stations, so the basemap lines up with the route line pixel-for-pixel
// without a separate reprojection step.

function useTileBasis(
  layer: TileLayer,
  tileSize: number,
  project: (lon: number, lat: number) => { x: number; y: number },
) {
  return useMemo(() => {
    const t0 = layer.tiles.find((t) => t.ok);
    if (!t0) return null;
    const nw = project(t0.lonNW, t0.latNW);
    const ne = project(t0.lonSE, t0.latNW);
    const sw = project(t0.lonNW, t0.latSE);
    return {
      a: (ne.x - nw.x) / tileSize,
      b: (ne.y - nw.y) / tileSize,
      c: (sw.x - nw.x) / tileSize,
      d: (sw.y - nw.y) / tileSize,
    };
  }, [layer, tileSize, project]);
}

const TileLayerGroup: React.FC<{
  layer: TileLayer;
  tileSize: number;
  onReady: () => void;
}> = ({ layer, tileSize, onReady }) => {
  const { project } = useRouteData();
  const [loaded, setLoaded] = useState(false);
  const okTiles = useMemo(
    () => layer.tiles.filter((t) => t.ok),
    [layer],
  );
  const basis = useTileBasis(layer, tileSize, project);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      okTiles.map(
        (t: MapTile) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = staticFile(t.path);
          }),
      ),
    ).then(() => {
      if (!cancelled) {
        setLoaded(true);
        onReady();
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [okTiles]);

  if (!loaded || !basis) return null;

  return (
    <g>
      {okTiles.map((t) => {
        const nw = project(t.lonNW, t.latNW);
        const matrix = `matrix(${basis.a},${basis.b},${basis.c},${basis.d},${nw.x},${nw.y})`;
        return (
          <image
            key={`${layer.zoom}_${t.x}_${t.y}`}
            href={staticFile(t.path)}
            width={tileSize}
            height={tileSize}
            transform={matrix}
          />
        );
      })}
    </g>
  );
};

export const MapBasemap: React.FC = () => {
  const { mapTiles } = useRouteData();
  const [handle] = useState(() => delayRender("Loading map basemap tiles"));
  const readyCount = React.useRef(0);

  const onLayerReady = () => {
    readyCount.current += 1;
    if (readyCount.current === mapTiles.layers.length) {
      continueRender(handle);
    }
  };

  return (
    <g>
      {mapTiles.layers.map((layer) => (
        <TileLayerGroup
          key={layer.name}
          layer={layer}
          tileSize={mapTiles.tileSize}
          onReady={onLayerReady}
        />
      ))}
    </g>
  );
};
