// Photoreal layer: which registered file plays which part (docs/adr/0054-photoreal-layer.md).
import * as THREE from "three";
import { mulberry32 } from "../../three-core/rng";

// Every path here must be a file under public/3d/ with an entry in data/assets-3d.json (spec L1; a static test checks
// the two agree). A role without a file gets a procedural stand-in made here, so the look renders before any download
// and the asset set can grow one registered file at a time.

export type TextureRole = "grass" | "heath" | "woodFloor" | "rock" | "gravel" | "stone" | "tarmac" | "hedge" | "bark";
export type RoleFiles = { map: string; normalMap?: string; roughnessMap?: string; /** metres one tile covers */ tileM: number };

/** Registered files per role, fetched by `node scripts/fetch-assets.mjs` (Poly Haven, CC0 1.0) and listed in
 * data/assets-3d.json with their sha256; `tileM` is the ground each 1K tile covers, judged from the photographs. */
const ph = (id: string, tileM: number): RoleFiles => ({ map: `3d/textures/${id}/${id}_diff_1k.jpg`, normalMap: `3d/textures/${id}/${id}_nor_gl_1k.jpg`, tileM });
export const TEXTURE_ROLES: Partial<Record<TextureRole, RoleFiles>> = {
  grass: ph("aerial_grass_rock", 5),
  heath: ph("brown_mud_leaves_01", 2.5),
  woodFloor: ph("forrest_ground_01", 3),
  rock: ph("lichen_rock", 3),
  gravel: ph("gravel_ground_01", 1.5),
  stone: ph("mossy_stone_wall", 1.2),
  bark: ph("bark_brown_02", 1),
  tarmac: ph("asphalt_02", 3),
};

/** An equirectangular sky image for the environment and background, with the azimuth its sun sits at, or null for the
 * procedural sky dome. */
export const SKY_IMAGE: { file: string; sunAzimuthDeg: number; sunElevationDeg: number } | null = null;

export type RoleTextures = { map: THREE.Texture; normalMap: THREE.Texture; tileM: number };
export type PhotoTextures = Record<TextureRole, RoleTextures>;

/** The stand-in palette: base colour, a second colour the noise mixes towards, and the bump strength. */
const STAND_IN: Record<TextureRole, { a: string; b: string; bump: number; tileM: number }> = {
  grass: { a: "#5a7a36", b: "#8a9c46", bump: 0.6, tileM: 2 },
  heath: { a: "#7a7a48", b: "#9a8a58", bump: 0.8, tileM: 2.5 },
  woodFloor: { a: "#6a6440", b: "#8c7e52", bump: 0.9, tileM: 2 },
  rock: { a: "#6c6e70", b: "#8e9094", bump: 1.4, tileM: 3 },
  gravel: { a: "#cfc6b4", b: "#e6ded0", bump: 0.7, tileM: 0.8 },
  stone: { a: "#7d7a72", b: "#9c978c", bump: 1.2, tileM: 2 },
  tarmac: { a: "#4e4e4c", b: "#5c5c5a", bump: 0.4, tileM: 2 },
  hedge: { a: "#2f4a22", b: "#4e6a30", bump: 1.2, tileM: 1.5 },
  bark: { a: "#4a3a2a", b: "#6a5a48", bump: 1.0, tileM: 1 },
};

/** Tileable value noise with a few octaves, 0–1, from a seeded draw: the same image every run. */
function noiseGrid(n: number, seed: number): Float32Array {
  const rand = mulberry32(seed);
  const octaves = [4, 8, 16, 32];
  const lattices = octaves.map((k) => Float32Array.from({ length: k * k }, () => rand()));
  const out = new Float32Array(n * n);
  let max = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v = 0;
      let amp = 1;
      let total = 0;
      octaves.forEach((k, o) => {
        const L = lattices[o];
        const fx = (x / n) * k;
        const fy = (y / n) * k;
        const x0 = Math.floor(fx) % k;
        const y0 = Math.floor(fy) % k;
        const x1 = (x0 + 1) % k;
        const y1 = (y0 + 1) % k;
        const u = fx - Math.floor(fx);
        const w = fy - Math.floor(fy);
        const su = u * u * (3 - 2 * u);
        const sw = w * w * (3 - 2 * w);
        const top = L[y0 * k + x0] * (1 - su) + L[y0 * k + x1] * su;
        const bottom = L[y1 * k + x0] * (1 - su) + L[y1 * k + x1] * su;
        v += (top * (1 - sw) + bottom * sw) * amp;
        total += amp;
        amp *= 0.5;
      });
      out[y * n + x] = v / total;
      max = Math.max(max, out[y * n + x]);
    }
  }
  return out;
}

/** A colour map and a normal map made from one noise field, both tileable, 256²: enough detail to break a flat surface. */
export function standInTextures(role: TextureRole, seed = 7): RoleTextures {
  const n = 256;
  const { a, b, bump, tileM } = STAND_IN[role];
  const h = noiseGrid(n, seed + role.length * 131);
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  const colour = new Uint8Array(n * n * 4);
  const normal = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const t = Math.min(1, Math.max(0, (h[i] - 0.3) / 0.4));
      colour.set([Math.round(255 * (ca.r + (cb.r - ca.r) * t)), Math.round(255 * (ca.g + (cb.g - ca.g) * t)), Math.round(255 * (ca.b + (cb.b - ca.b) * t)), 255], 4 * i);
      const dx = (h[y * n + ((x + 1) % n)] - h[y * n + ((x - 1 + n) % n)]) * bump * 8;
      const dy = (h[((y + 1) % n) * n + x] - h[((y - 1 + n) % n) * n + x]) * bump * 8;
      const l = Math.hypot(dx, dy, 1);
      normal.set([Math.round(128 + (-dx / l) * 127), Math.round(128 + (-dy / l) * 127), Math.round(128 + (1 / l) * 127), 255], 4 * i);
    }
  }
  const make = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return { map: make(colour, true), normalMap: make(normal, false), tileM };
}

export const TEXTURE_ROLE_NAMES = Object.keys(STAND_IN) as TextureRole[];
