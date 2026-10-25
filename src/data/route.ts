// Real, verified data only — see data/source-register.md for provenance.
// Geometry: OpenStreetMap contributors (ODbL). Elevation: Copernicus DEM
// GLO-90 via Open-Meteo. Station facts: Wikipedia, cross-checked.
//
// The source files live in data/ (where the GIS pipeline in
// data/source-register.md writes them) and are copied to public/data/ for
// the running video to fetch at render/preview time — see
// RouteDataProvider.tsx. After editing anything in data/, re-copy it into
// public/data/ before re-rendering (docs/adr/0021-data-sync.md, docs/sop-3d.md).

type RawCoord = [number, number, number]; // [lon, lat, elevationMeters]

type RouteGeoJson = {
  features: Array<{ geometry: { coordinates: RawCoord[] } }>;
};

type RawStation = {
  id: string;
  name: string;
  name_cy: string;
  lon: number;
  lat: number;
  opened: string;
  closed_to_passengers: string;
  status_2026: string;
  source: string;
  distance_km_from_blaenau: number;
  elevation_m: number;
};

type WaypointsJson = { stations: RawStation[] };

export type ElevationProfilePoint = { distance_km: number; elevation_m: number };
type ElevationProfileJson = {
  profile: ElevationProfilePoint[];
  min_elevation_m: number;
  max_elevation_m: number;
};

export type MapTile = {
  x: number;
  y: number;
  /** public/ path, e.g. "maps/tiles/15/16023/10671.png" */
  path: string;
  lonNW: number;
  latNW: number;
  lonSE: number;
  latSE: number;
  ok: boolean;
};

export type TileLayer = {
  name: string;
  zoom: number;
  tiles: MapTile[];
};

export type TilesManifest = {
  tileSize: number;
  /** rendered in order: a cheap, large-coverage layer first, detail layers on top */
  layers: TileLayer[];
};

export type RoutePoint = {
  lon: number;
  lat: number;
  ele: number;
  /** metres from the start of the route (Blaenau Ffestiniog) */
  dist: number;
  /** 0 at Blaenau Ffestiniog, 1 at Trawsfynydd */
  t: number;
  /** stylised 2.5D world-space position, route-aligned */
  x: number;
  y: number;
};

export type Station = {
  id: string;
  name: string;
  nameCy: string;
  openedNote: string;
  closedNote: string;
  statusNote: string;
  source: string;
  distanceKm: number;
  elevationM: number;
  t: number;
  x: number;
  y: number;
};

export type RouteModel = {
  routePoints: RoutePoint[];
  stations: Station[];
  totalLengthM: number;
  worldBounds: { minX: number; maxX: number; minY: number; maxY: number };
  worldCenter: { x: number; y: number };
  fullViewHeight: number;
  closeViewHeight: number;
  elevationProfile: ElevationProfilePoint[];
  elevationRange: { min: number; max: number };
  pointAtT: (t: number) => RoutePoint;
  pathUpToT: (t: number) => string;
  /** project an arbitrary lon/lat into the same world-space as routePoints/stations */
  project: (lon: number, lat: number) => { x: number; y: number };
  /** exact inverse of project (it is affine); used by the 3D scenes */
  unproject: (x: number, y: number) => { lon: number; lat: number };
  mapTiles: TilesManifest;
};

const EARTH_RADIUS_M = 6371000;
const CAMERA_ASPECT = 1920 / 1080;
const CLOSE_VIEW_HEIGHT = 150;

function haversineMeters(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Local equirectangular projection, then rotated so the Blaenau Ffestiniog
 * -> Trawsfynydd direction of travel lies along +x. There is no cross-track
 * terrain data (only along-track elevation), so this is a schematic 2.5D
 * route map, not a true topographic projection.
 * The 3D scenes reuse this projection, so changing it moves them too
 * (docs/adr/0005-shared-projection-true-scale.md).
 */
function buildProjection(rawCoords: RawCoord[]) {
  const lats = rawCoords.map((c) => c[1]);
  const lonCenter =
    rawCoords.reduce((sum, c) => sum + c[0], 0) / rawCoords.length;
  const latCenter = lats.reduce((sum, v) => sum + v, 0) / lats.length;
  const latCenterRad = (latCenter * Math.PI) / 180;

  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(latCenterRad);

  const toLocalMeters = (lon: number, lat: number) => ({
    mx: (lon - lonCenter) * metersPerDegLon,
    my: (lat - latCenter) * metersPerDegLat,
  });

  const first = toLocalMeters(rawCoords[0][0], rawCoords[0][1]);
  const last = toLocalMeters(
    rawCoords[rawCoords.length - 1][0],
    rawCoords[rawCoords.length - 1][1],
  );
  const bearing = Math.atan2(last.my - first.my, last.mx - first.mx);
  const cosA = Math.cos(-bearing);
  const sinA = Math.sin(-bearing);

  const WORLD_SCALE = 10; // 1 world unit = 10 metres

  const project = (lon: number, lat: number) => {
    const { mx, my } = toLocalMeters(lon, lat);
    const rx = mx * cosA - my * sinA;
    const ry = mx * sinA + my * cosA;
    return { x: rx / WORLD_SCALE, y: -ry / WORLD_SCALE };
  };

  const unproject = (x: number, y: number) => {
    const rx = x * WORLD_SCALE;
    const ry = -y * WORLD_SCALE;
    const mx = rx * cosA + ry * sinA;
    const my = -rx * sinA + ry * cosA;
    return { lon: mx / metersPerDegLon + lonCenter, lat: my / metersPerDegLat + latCenter };
  };

  return { project, unproject };
}

function pointAtTFactory(routePoints: RoutePoint[]) {
  return (t: number): RoutePoint => {
    const clamped = Math.min(1, Math.max(0, t));
    if (clamped <= 0) return routePoints[0];
    if (clamped >= 1) return routePoints[routePoints.length - 1];
    let lo = 0;
    let hi = routePoints.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (routePoints[mid].t < clamped) lo = mid;
      else hi = mid;
    }
    const a = routePoints[lo];
    const b = routePoints[hi];
    const span = b.t - a.t;
    const f = span > 0 ? (clamped - a.t) / span : 0;
    return {
      lon: a.lon + (b.lon - a.lon) * f,
      lat: a.lat + (b.lat - a.lat) * f,
      ele: a.ele + (b.ele - a.ele) * f,
      dist: a.dist + (b.dist - a.dist) * f,
      t: clamped,
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
    };
  };
}

export function buildRouteModel(
  routeGeoJson: RouteGeoJson,
  waypointsJson: WaypointsJson,
  elevationProfileJson: ElevationProfileJson,
  tilesManifest: TilesManifest,
): RouteModel {
  const rawCoords = routeGeoJson.features[0].geometry.coordinates;
  const { project, unproject } = buildProjection(rawCoords);

  let cumulative = 0;
  const routePoints: RoutePoint[] = rawCoords.map((c, i) => {
    if (i > 0) {
      cumulative += haversineMeters(
        rawCoords[i - 1][0],
        rawCoords[i - 1][1],
        c[0],
        c[1],
      );
    }
    const { x, y } = project(c[0], c[1]);
    return { lon: c[0], lat: c[1], ele: c[2], dist: cumulative, x, y, t: 0 };
  });

  const totalLengthM = cumulative;
  routePoints.forEach((p) => {
    p.t = p.dist / totalLengthM;
  });

  const stations: Station[] = waypointsJson.stations.map((s) => {
    const { x, y } = project(s.lon, s.lat);
    return {
      id: s.id,
      name: s.name,
      nameCy: s.name_cy,
      openedNote: s.opened,
      closedNote: s.closed_to_passengers,
      statusNote: s.status_2026,
      source: s.source,
      distanceKm: s.distance_km_from_blaenau,
      elevationM: s.elevation_m,
      t: (s.distance_km_from_blaenau * 1000) / totalLengthM,
      x,
      y,
    };
  });

  const worldBounds = routePoints.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      maxX: Math.max(acc.maxX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxY: Math.max(acc.maxY, p.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );

  const worldCenter = {
    x: (worldBounds.minX + worldBounds.maxX) / 2,
    y: (worldBounds.minY + worldBounds.maxY) / 2,
  };

  const fullViewHeight = Math.max(
    (worldBounds.maxY - worldBounds.minY) * 1.5,
    ((worldBounds.maxX - worldBounds.minX) * 1.25) / CAMERA_ASPECT,
  );

  const pointAtT = pointAtTFactory(routePoints);

  const pathUpToT = (t: number): string => {
    const clamped = Math.min(1, Math.max(0, t));
    if (clamped <= 0) return `M${routePoints[0].x},${routePoints[0].y}`;
    const parts: string[] = [`M${routePoints[0].x},${routePoints[0].y}`];
    for (const p of routePoints) {
      if (p.t > clamped) break;
      parts.push(`L${p.x.toFixed(2)},${p.y.toFixed(2)}`);
    }
    const leading = pointAtT(clamped);
    parts.push(`L${leading.x.toFixed(2)},${leading.y.toFixed(2)}`);
    return parts.join(" ");
  };

  return {
    routePoints,
    stations,
    totalLengthM,
    worldBounds,
    worldCenter,
    fullViewHeight,
    closeViewHeight: CLOSE_VIEW_HEIGHT,
    elevationProfile: elevationProfileJson.profile,
    elevationRange: {
      min: elevationProfileJson.min_elevation_m,
      max: elevationProfileJson.max_elevation_m,
    },
    pointAtT,
    pathUpToT,
    project,
    unproject,
    mapTiles: tilesManifest,
  };
}
