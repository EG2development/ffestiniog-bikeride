import type { DemGrid, MeshArrays } from "./types";

// Relief shading without textures (docs/adr/0031-terrain-shading-without-textures.md): each node's
// land-cover colour is scaled by a slope factor and a height tint. Positions are untouched.

export function shadeTerrain(mesh: MeshArrays, grid: DemGrid): MeshArrays {
  if (!mesh.colors) return mesh;
  const { cols, rows, spacingM, heights } = grid;
  let hMin = Infinity;
  let hMax = -Infinity;
  for (const h of heights) {
    if (h === grid.nodata) continue;
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
  }
  const range = hMax - hMin;
  const colors = Float32Array.from(mesh.colors);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const h = (rr: number, cc: number) => heights[Math.min(rows - 1, Math.max(0, rr)) * cols + Math.min(cols - 1, Math.max(0, cc))];
      const dx = (h(r, c + 1) - h(r, c - 1)) / (2 * spacingM);
      const dy = (h(r + 1, c) - h(r - 1, c)) / (2 * spacingM);
      const slope = Math.min(1, Math.hypot(dx, dy));
      const hNorm = range > 0 ? (heights[i] - hMin) / range : 0.5;
      const k = (1 - 0.35 * slope) * (0.92 + 0.12 * hNorm);
      for (let j = 0; j < 3; j++) colors[3 * i + j] = Math.min(1, Math.max(0, colors[3 * i + j] * k));
    }
  }
  return { ...mesh, colors };
}

/** A satellite image on a DEM's grid at `scale` pixels per node spacing, pixel (0, 0) on node (0, 0), rows north first. */
export type GroundImage = { width: number; height: number; scale: number; rgb: Uint8Array };

/**
 * A satellite image graded to ground colour (docs/adr/0060-reel-in-the-photo-look.md), as sRGB RGBA bytes for a texture:
 * each 8-bit value is linear in reflectance (Sentinel-2 TCI), scaled by `gain`, its saturation lifted about its luma,
 * tinted per channel (with `vegetationOnly`, in proportion to how green the pixel is), then encoded. No slope shading: the photograph already has its relief.
 */
export function imageryPixels(image: GroundImage, grade: { gain: number; saturation: number; tint: readonly [number, number, number]; vegetationOnly?: boolean }): Uint8Array {
  const { rgb } = image;
  const out = new Uint8Array((rgb.length / 3) * 4);
  const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    const [r, g, b] = [rgb[i], rgb[i + 1], rgb[i + 2]].map((v) => (v / 255) * grade.gain);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // vegetationOnly: the tint in full where green leads red and blue by a fifth of the luma, half on warm brown ground
    // (bracken, heather: red well above blue), none on grey (slate, stone, roads, shingle)
    const lum = Math.max(l, 0.02);
    const green = Math.min(1, Math.max(0, ((g - Math.max(r, b)) / lum - 0.03) / 0.2));
    const warm = Math.min(1, Math.max(0, ((r - b) / lum - 0.12) / 0.3));
    const w = grade.vegetationOnly ? Math.max(green, 0.5 * warm) : 1;
    for (const [j, v] of [r, g, b].entries()) out[o + j] = Math.round(255 * Math.min(1, Math.max(0, encode(Math.max(0, l + (v - l) * grade.saturation) * (1 + (grade.tint[j] - 1) * w)))));
    out[o + 3] = 255;
  }
  return out;
}

/** The graded image's colour at each DEM node (0–1, sRGB), in the terrain's vertex order: the colour far detail fades to. */
export function imageryNodeColours(image: GroundImage, pixels: Uint8Array, cols: number, rows: number): Float32Array {
  const out = new Float32Array(cols * rows * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = 4 * (r * image.scale * image.width + c * image.scale);
      out.set([pixels[p] / 255, pixels[p + 1] / 255, pixels[p + 2] / 255], 3 * (r * cols + c));
    }
  }
  return out;
}
