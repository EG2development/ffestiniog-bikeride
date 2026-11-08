// Web Mercator tile maths for the aerial map drape (docs/adr/0033-aerial-map-tile-drape.md).

export type TileRange = { x0: number; x1: number; y0: number; y1: number };
export type Bbox = { west: number; south: number; east: number; north: number };

/** Fractional tile coordinates of a lon/lat at zoom z. */
function tileCoords(lon: number, lat: number, z: number): { tx: number; ty: number } {
  const n = 2 ** z;
  const phi = (lat * Math.PI) / 180;
  return { tx: ((lon + 180) / 360) * n, ty: ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n };
}

export function tileRange(bbox: Bbox, z: number): TileRange {
  const nw = tileCoords(bbox.west, bbox.north, z);
  const se = tileCoords(bbox.east, bbox.south, z);
  return { x0: Math.floor(nw.tx), x1: Math.floor(se.tx), y0: Math.floor(nw.ty), y1: Math.floor(se.ty) };
}

/** One (u, v) per vertex into a canvas that holds the range's tiles left to right, top to bottom. */
export function tileUvs(positions: Float32Array, unproject: (x: number, z: number) => { lon: number; lat: number }, range: TileRange, z: number): Float32Array {
  const w = range.x1 - range.x0 + 1;
  const h = range.y1 - range.y0 + 1;
  const uv = new Float32Array((positions.length / 3) * 2);
  for (let i = 0; i < positions.length / 3; i++) {
    const { lon, lat } = unproject(positions[3 * i], positions[3 * i + 2]);
    const { tx, ty } = tileCoords(lon, lat, z);
    uv[2 * i] = (tx - range.x0) / w;
    uv[2 * i + 1] = 1 - (ty - range.y0) / h;
  }
  return uv;
}
