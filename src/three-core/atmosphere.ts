// Iteration 2: LIGHTING, one source for every section, tuned against metrics (docs/adr/0046-clarity-tuned-as-data.md).
import type { RouteModel } from "../data/route";
import type { Vec3 } from "./types";

// Sky, fog and sun from one set of constants (docs/adr/0030-sky-dome-and-fog.md). The fog colour
// is the horizon colour by construction (spec RL11); the sun is ADR 18's.

export type Rgb = [number, number, number];
export type SectionKind = "ground" | "aerial";
export type Atmosphere = { zenith: Rgb; horizon: Rgb; fogDensity: number; sunAzimuthDeg: number; sunElevationDeg: number };

export const ATMOSPHERE: Record<SectionKind, Atmosphere> = {
  // horizon #c3d3dc: the sky colour the proof of concept used
  ground: { zenith: [0.36, 0.55, 0.78], horizon: [0.765, 0.827, 0.863], fogDensity: 0.0009, sunAzimuthDeg: 200, sunElevationDeg: 35 },
  aerial: { zenith: [0.33, 0.52, 0.76], horizon: [0.78, 0.84, 0.87], fogDensity: 0.0003, sunAzimuthDeg: 200, sunElevationDeg: 35 },
};

export const fogColour = (kind: SectionKind): Rgb => ATMOSPHERE[kind].horizon;

/** Light for every section, one source (docs/adr/0046-clarity-tuned-as-data.md): the hemisphere fill (sky above, ground
 * bounce below) lights the sides away from the sun; the sun casts the shadows. Changed only with before/after metrics. */
export type Lighting = { hemiSky: string; hemiGround: string; hemiIntensity: number; sunColour: string; sunIntensity: number };
export const LIGHTING: Record<SectionKind, Lighting> = {
  ground: { hemiSky: "#dfe8ee", hemiGround: "#5c6a4a", hemiIntensity: 0.75, sunColour: "#fff4e2", sunIntensity: 2.2 },
  aerial: { hemiSky: "#dfe8ee", hemiGround: "#5c6a4a", hemiIntensity: 0.75, sunColour: "#fff4e2", sunIntensity: 2.2 },
};
/** The photoreal look's light (docs/adr/0054-photoreal-layer.md): the sky's own image lights the scene (PhotoSky's
 * environment map), so the hemisphere fill drops to a trace and the sun keeps the shadows; AgX tone mapping (ADR 55)
 * takes the exposure. The sun's direction is ADR 18's. */
export const LIGHTING_PHOTO: Record<SectionKind, Lighting> = {
  ground: { hemiSky: "#dfe8ee", hemiGround: "#5c6a4a", hemiIntensity: 0.25, sunColour: "#fff1d6", sunIntensity: 2.6 },
  aerial: { hemiSky: "#dfe8ee", hemiGround: "#5c6a4a", hemiIntensity: 0.25, sunColour: "#fff1d6", sunIntensity: 2.6 },
};
/** How strongly the sky image lights surfaces (scene.environmentIntensity), and the cloud cover the sky draws. */
export const SKY_PHOTO = { environmentIntensity: 0.55, cloudCover: 0.5, cloudScale: 3.4, sunGlow: 0.18 } as const;
/** The shadow map in the photo look's close shots (the rider's view and the follow shot; review 2026-10-30, RL12): the
 * 2048² map covers `rangeM` around the focus instead of the reel's 300 m, so a texel is 8 cm instead of 15, and the
 * normal bias drops from 0.2 m to 6 cm, so a figure's shadow starts at its feet instead of 20 cm away. The drone shot
 * keeps the reel's range and bias, since its ground is hundreds of metres across. World units: 1 = 10 m. */
export const SHADOW_PHOTO_CLOSE = { rangeM: 160, normalBias: 0.006, bias: -0.0002 } as const;

/** The aerial map drape's grade towards the ground palette (spec CL6; docs/pseudocode-reel-v2.md §4.4). Only the map's
 * near-neutral paper and hill shading (HSV saturation below `neutral`) takes the tint, at its own luma and with weight
 * `alpha`, falling to none at `neutral`; water, roads, woods and contours keep their colours. `brightness` scales the
 * tiles first, within CL3's ±10 %. Tuned by render; numbers in docs/validation-3d.md. */
export type DrapeGrade = { tint: string; alpha: number; neutral: number; brightness: number };
export const DRAPE_GRADE: DrapeGrade = { tint: "#66b34d", alpha: 1, neutral: 0.2, brightness: 1 };

/** Grades RGBA pixels in place (canvas ImageData order) as DRAPE_GRADE describes. */
export function gradeDrapePixels(data: Uint8ClampedArray, grade: DrapeGrade): void {
  const t = [1, 3, 5].map((i) => parseInt(grade.tint.slice(i, i + 2), 16));
  const tl = 0.299 * t[0] + 0.587 * t[1] + 0.114 * t[2];
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i] * grade.brightness, data[i + 1] * grade.brightness, data[i + 2] * grade.brightness];
    const mx = Math.max(r, g, b);
    const sat = mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
    const w = grade.alpha * Math.max(0, 1 - sat / grade.neutral);
    const k = (0.299 * r + 0.587 * g + 0.114 * b) / tl; // the tint at this pixel's luma
    data[i] = r + (Math.min(255, t[0] * k) - r) * w;
    data[i + 1] = g + (Math.min(255, t[1] * k) - g) * w;
    data[i + 2] = b + (Math.min(255, t[2] * k) - b) * w;
  }
}

/** Unit vector towards the sun in world space, from the atmosphere's azimuth and elevation and the route's projection. */
export function sunDirection(route: RouteModel, atmosphere: Atmosphere): Vec3 {
  const { lon, lat } = route.routePoints[0];
  const o = route.project(lon, lat);
  const n = route.project(lon, lat + 0.01);
  const e = route.project(lon + 0.01, lat);
  const unit = (x: number, z: number): [number, number] => {
    const l = Math.hypot(x, z) || 1;
    return [x / l, z / l];
  };
  const north = unit(n.x - o.x, n.y - o.y);
  const east = unit(e.x - o.x, e.y - o.y);
  const az = (atmosphere.sunAzimuthDeg * Math.PI) / 180;
  const el = (atmosphere.sunElevationDeg * Math.PI) / 180;
  const hx = Math.sin(az) * east[0] + Math.cos(az) * north[0];
  const hz = Math.sin(az) * east[1] + Math.cos(az) * north[1];
  return [Math.cos(el) * hx, Math.sin(el), Math.cos(el) * hz];
}
