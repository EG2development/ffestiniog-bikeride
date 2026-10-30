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
