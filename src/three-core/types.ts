export type Vec3 = [number, number, number];

export type DemGrid = {
  cols: number;
  rows: number;
  spacingM: number;
  /** British National Grid easting/northing of the north-west node */
  originE: number;
  originN: number;
  /** row-major, north to south, metres */
  heights: Float32Array;
  /** 0 = lidar DTM, 1 = Copernicus GLO-30 fallback */
  sourceIndex: Uint8Array;
  nodata: number;
};

export type LandCover = { classes: Uint8Array; legend: string[] };

export type MeshArrays = {
  positions: Float32Array;
  indices: Uint32Array;
  colors?: Float32Array;
  /** texture coordinates, two per vertex, where a view maps a texture (the photoreal layer) */
  uvs?: Float32Array;
};

export type Projector = (lon: number, lat: number) => { x: number; y: number };
