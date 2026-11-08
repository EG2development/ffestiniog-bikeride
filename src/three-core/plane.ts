// Plan-view helpers the pure core and its tests share: one point-in-ring test for each coordinate shape the modules
// hold their rings in, and the cell-hashed "within reach of a sample" predicate the tree placer and the barriers use.

/** A point in plan: world x and z (1 unit = 10 m). */
export type PlanePoint = { x: number; z: number };

/** Even-odd test of (x, z) against a ring of {x, z} points: a ray to +x, each crossing toggles. The closing vertex may repeat. */
export function inRingXZ(x: number, z: number, ring: readonly PlanePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** The same test for [x, y] tuples: lon/lat rings as GeoJSON holds them, or any planar pair. */
export function inRingXY(x: number, y: number, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * True within `reachUnits` of any of `samples` (every `stride`-th one), hashed by cell so a query checks its 3 × 3
 * neighbourhood only. The callers decide what no samples or an unbounded reach mean.
 */
export function withinReach(samples: readonly PlanePoint[], reachUnits: number, stride = 1): (x: number, z: number) => boolean {
  const cell = Math.max(reachUnits, 1e-6);
  const cells = new Map<string, PlanePoint[]>();
  for (let i = 0; i < samples.length; i += stride) {
    const s = samples[i];
    const key = `${Math.floor(s.x / cell)},${Math.floor(s.z / cell)}`;
    const list = cells.get(key);
    if (list) list.push(s);
    else cells.set(key, [s]);
  }
  return (x, z) => {
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of cells.get(`${cx + i},${cz + j}`) ?? []) if (Math.hypot(s.x - x, s.z - z) <= reachUnits) return true;
    return false;
  };
}
