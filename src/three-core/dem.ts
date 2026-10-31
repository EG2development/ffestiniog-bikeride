import { bngToWgs84 } from "./bng";
import type { DemGrid, LandCover, MeshArrays, Projector } from "./types";

// docs/pseudocode-3d.md §2.2, docs/adr/0006-welsh-lidar-dtm.md, docs/adr/0010-landcover-vertex-colours.md

/** Bilinear height in metres at a British National Grid point; null outside the grid or at nodata. */
export function heightAtBng(grid: DemGrid, e: number, n: number): number | null {
  const fx = (e - grid.originE) / grid.spacingM;
  const fy = (grid.originN - n) / grid.spacingM;
  if (!(fx >= 0 && fy >= 0 && fx <= grid.cols - 1 && fy <= grid.rows - 1)) return null;
  const c = Math.min(Math.floor(fx), grid.cols - 2);
  const r = Math.min(Math.floor(fy), grid.rows - 2);
  const u = fx - c;
  const v = fy - r;
  const at = (rr: number, cc: number) => grid.heights[rr * grid.cols + cc];
  const h00 = at(r, c);
  const h01 = at(r, c + 1);
  const h10 = at(r + 1, c);
  const h11 = at(r + 1, c + 1);
  if ([h00, h01, h10, h11].some((h) => h === grid.nodata)) return null;
  return h00 * (1 - u) * (1 - v) + h01 * u * (1 - v) + h10 * (1 - u) * v + h11 * u * v;
}

/** Height in metres at a BNG point on buildTerrainMesh's own triangles (each cell split along its south-west to
 * north-east diagonal), so a ribbon draped on it neither floats nor sinks where the bilinear surface bulges; null as above. */
export function meshHeightAtBng(grid: DemGrid, e: number, n: number): number | null {
  const fx = (e - grid.originE) / grid.spacingM;
  const fy = (grid.originN - n) / grid.spacingM;
  if (!(fx >= 0 && fy >= 0 && fx <= grid.cols - 1 && fy <= grid.rows - 1)) return null;
  const c = Math.min(Math.floor(fx), grid.cols - 2);
  const r = Math.min(Math.floor(fy), grid.rows - 2);
  const u = fx - c;
  const v = fy - r;
  const at = (rr: number, cc: number) => grid.heights[rr * grid.cols + cc];
  const h00 = at(r, c);
  const h01 = at(r, c + 1);
  const h10 = at(r + 1, c);
  const h11 = at(r + 1, c + 1);
  if ([h00, h01, h10, h11].some((h) => h === grid.nodata)) return null;
  // triangles (r,c) (r+1,c) (r,c+1) and (r,c+1) (r+1,c) (r+1,c+1), as the mesh's indices
  return u + v <= 1 ? h00 + u * (h01 - h00) + v * (h10 - h00) : h11 + (1 - u) * (h10 - h11) + (1 - v) * (h01 - h11);
}

// Natural tones for North Wales land cover, matched by keyword in the legend.
const PALETTE: [RegExp, [number, number, number]][] = [
  [/water|lake|reservoir|river/, [0.36, 0.5, 0.56]],
  [/built|resid|urban|industrial/, [0.6, 0.58, 0.55]],
  [/quarry|rock|scree|slate|bare/, [0.47, 0.48, 0.5]],
  [/wood|forest/, [0.25, 0.36, 0.21]],
  [/heath|scrub|moor|bracken/, [0.49, 0.45, 0.29]],
  [/grass|farm|meadow|pasture/, [0.44, 0.56, 0.31]],
];
// land OSM doesn't classify here; a muted rough-grazing green rather than a guess at a specific cover
const OTHER: [number, number, number] = [0.48, 0.53, 0.37];

export const colourForClass = (name: string): [number, number, number] =>
  PALETTE.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? OTHER;

/** One vertex per DEM node, projected through the shared 2D projection; vertex colours from land cover. */
export function buildTerrainMesh(grid: DemGrid, land: LandCover, project: Projector, ve: number): MeshArrays {
  const { cols, rows } = grid;
  const count = cols * rows;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const legendColours = land.legend.map(colourForClass);
  let minValid = Infinity;
  for (const h of grid.heights) if (h !== grid.nodata && h < minValid) minValid = h;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const { lon, lat } = bngToWgs84(grid.originE + c * grid.spacingM, grid.originN - r * grid.spacingM);
      const p = project(lon, lat);
      const h = grid.heights[i] === grid.nodata ? minValid : grid.heights[i];
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = (h / 10) * ve;
      positions[i * 3 + 2] = p.y;
      const rgb = legendColours[land.classes[i]] ?? OTHER;
      colors[i * 3] = rgb[0];
      colors[i * 3 + 1] = rgb[1];
      colors[i * 3 + 2] = rgb[2];
    }
  }

  // Counter-clockwise seen from above, so the faces point up in three.js.
  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      indices[k++] = a;
      indices[k++] = a + cols;
      indices[k++] = a + 1;
      indices[k++] = a + 1;
      indices[k++] = a + cols;
      indices[k++] = a + cols + 1;
    }
  }
  return { positions, indices, colors };
}
