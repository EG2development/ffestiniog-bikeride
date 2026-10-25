import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildRouteModel, type RouteModel } from "../../src/data/route";
import type { Trail, TrailProfile, TrailSample } from "../../src/three-core/trail";
import type { CyclistPose } from "../../src/three-core/cyclistMotion";
import type { MeshArrays, Vec3 } from "../../src/three-core/types";

// Hand-built inputs, independent of the code under test, so each test fails
// only because of the module it targets.

export const ROOT = resolve(__dirname, "../..");

export function readProjectFile(rel: string): Buffer {
  const path = resolve(ROOT, rel);
  if (!existsSync(path)) {
    throw new Error(`missing pipeline output ${rel}: run python3 scripts/build_poc_data.py, then npm run data:sync`);
  }
  return readFileSync(path);
}

export const readJson = <T>(rel: string): T => JSON.parse(readProjectFile(rel).toString("utf8")) as T;

const EMPTY_TILES = { tileSize: 256, layers: [] };

/** The real route model, built from the committed GeoJSON. */
export function realRoute(): RouteModel {
  return buildRouteModel(
    readJson("data/railway-route.geojson"),
    readJson("data/waypoints.json"),
    readJson("data/elevation-profile.json"),
    EMPTY_TILES,
  );
}

/** A ~1 km gentle S-curve near Maentwrog Road. */
export function syntheticRoute(): RouteModel {
  const coords: [number, number, number][] = [];
  for (let i = 0; i <= 50; i++) {
    const u = i / 50;
    coords.push([-3.9445 + 0.004 * Math.sin(u * Math.PI), 52.94 - 0.009 * u, 180 + 10 * u]);
  }
  return buildRouteModel(
    { features: [{ geometry: { coordinates: coords } }] },
    { stations: [] },
    { profile: [], min_elevation_m: 180, max_elevation_m: 190 },
    EMPTY_TILES,
  );
}

export const profileHeight = (d: number) => 180 + 0.01 * d + 6 * Math.sin(d / 120);

/** Gradient between about −4 % and +6 %, sampled every 5 m. */
export function syntheticProfile(lengthM: number): TrailProfile {
  const distanceM: number[] = [];
  const elevationM: number[] = [];
  for (let d = 0; d <= lengthM; d += 5) {
    distanceM.push(d);
    elevationM.push(profileHeight(d));
  }
  return { distanceM, elevationM, smoothingM: 25, bridges: [] };
}

export const lerpProfile = (p: TrailProfile, d: number): number => {
  const ds = p.distanceM;
  if (d <= ds[0]) return p.elevationM[0];
  if (d >= ds[ds.length - 1]) return p.elevationM[ds.length - 1];
  let i = 0;
  while (ds[i + 1] < d) i++;
  const f = (d - ds[i]) / (ds[i + 1] - ds[i]);
  return p.elevationM[i] + (p.elevationM[i + 1] - p.elevationM[i]) * f;
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** An analytic trail along +x with a gentle curve in z; world units (1 = 10 m). */
export function analyticTrail(lengthM: number, profile: TrailProfile): Trail {
  const h = (d: number) => lerpProfile(profile, d);
  const pos = (d: number): Vec3 => [d / 10, h(d) / 10 + 0.005, 3 * Math.sin(d / 200)];
  const sampleAt = (dIn: number): TrailSample => {
    const d = Math.min(lengthM, Math.max(0, dIn));
    const [x, y, z] = pos(d);
    return {
      x,
      y,
      z,
      distM: d,
      tangent: norm(sub(pos(d + 0.5), pos(d - 0.5))),
      gradient: (h(d + 1) - h(d - 1)) / 2,
    };
  };
  const samples: TrailSample[] = [];
  for (let d = 0; d <= lengthM; d += 2) samples.push(sampleAt(d));
  return {
    samples,
    sampleAt,
    ribbon: { positions: new Float32Array(0), indices: new Uint32Array(0) },
    maxGradient: Math.max(...samples.map((s) => Math.abs(s.gradient))),
  };
}

export const leftOf = (s: TrailSample): Vec3 => {
  const l = Math.hypot(s.tangent[0], s.tangent[2]);
  return [s.tangent[2] / l, 0, -s.tangent[0] / l];
};

/** A rider moving at 5 m/s from d0, built by hand (not by cyclistMotion). */
export function analyticRider(trail: Trail, d0: number, fps: number) {
  const distAt = (f: number) => d0 + (5 * f) / fps;
  const riderAt = (f: number): Vec3 => {
    const s = trail.sampleAt(distAt(f));
    return [s.x, s.y, s.z];
  };
  const poseAt = (f: number): CyclistPose => {
    const s = trail.sampleAt(distAt(f));
    return {
      position: [s.x, s.y, s.z],
      yaw: Math.atan2(-s.tangent[2], s.tangent[0]),
      pitch: Math.atan(s.gradient),
      wheelAngle: 0,
      crankAngle: 0,
    };
  };
  return { distAt, riderAt, poseAt };
}

/** Rolling hills, in world units: up to ±20 m around 18 units (180 m). */
export const hillyHeightAt = (x: number, z: number): number => 18 + 2 * Math.sin(x / 15) * Math.cos(z / 15);

export type WorldGrid = {
  mesh: MeshArrays;
  x0: number;
  z0: number;
  step: number;
  cols: number;
  rows: number;
};

/**
 * A regular world-space grid (4 m spacing) around an analytic trail. Terrain sits 0.3 m above the trail
 * profile, with a 5 m hump at d = 300 m (a cut) and a 4 m hollow at d = 600 m (a fill).
 */
export function worldGridAround(lengthM: number): WorldGrid {
  const step = 0.4;
  const x0 = -2;
  const z0 = -6;
  const cols = Math.round((lengthM / 10 + 4) / step) + 1;
  const rows = Math.round(12 / step) + 1;
  const positions = new Float32Array(cols * rows * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * step;
      const z = z0 + r * step;
      const d = Math.min(lengthM, Math.max(0, x * 10));
      const bump = 5 * Math.exp(-((d - 300) ** 2) / (2 * 20 ** 2)) - 4 * Math.exp(-((d - 600) ** 2) / (2 * 20 ** 2));
      const i = (r * cols + c) * 3;
      positions[i] = x;
      positions[i + 1] = (profileHeight(d) + 0.3 + bump) / 10;
      positions[i + 2] = z;
    }
  }
  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      indices.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
    }
  }
  return { mesh: { positions, indices: new Uint32Array(indices) }, x0, z0, step, cols, rows };
}

/** Height of a regular grid mesh at (x, z), interpolated on the triangle that contains the point. */
export function meshHeightAt(g: WorldGrid, mesh: MeshArrays, x: number, z: number): number {
  const fc = (x - g.x0) / g.step;
  const fr = (z - g.z0) / g.step;
  const c = Math.floor(fc);
  const r = Math.floor(fr);
  const u = fc - c;
  const v = fr - r;
  const y = (rr: number, cc: number) => mesh.positions[(rr * g.cols + cc) * 3 + 1];
  // cell split as in worldGridAround: (a, a+1, a+cols) and (a+1, a+cols+1, a+cols)
  if (u + v <= 1) return y(r, c) + u * (y(r, c + 1) - y(r, c)) + v * (y(r + 1, c) - y(r, c));
  return y(r + 1, c + 1) + (1 - u) * (y(r + 1, c) - y(r + 1, c + 1)) + (1 - v) * (y(r, c + 1) - y(r + 1, c + 1));
}
