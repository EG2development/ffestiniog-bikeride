// Water mesh arrays with holes, every triangle facing up (docs/adr/0041-water-polygons-with-holes.md). three.js
// but no React, so tests run it in Node.
import * as THREE from "three";
import type { WaterPolygon } from "../three-core/water";

export function waterArrays(polygons: WaterPolygon[], y: number): { positions: Float32Array; indices: Uint32Array } {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const p of polygons) {
    const contour = p.outer.map((v) => new THREE.Vector2(v.x, v.z));
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    const holes = p.holes.map((h) => {
      const ring = h.map((v) => new THREE.Vector2(v.x, v.z));
      if (!THREE.ShapeUtils.isClockWise(ring)) ring.reverse();
      return ring;
    });
    const tris = THREE.ShapeUtils.triangulateShape(contour, holes); // drops a ring's closing duplicate in place
    const verts = [...contour, ...holes.flat()]; // so the index space is read after it (t10 L1)
    const base = positions.length / 3;
    for (const v of verts) positions.push(v.x, y, v.y);
    for (const [a, b, c] of tris) {
      const u = { x: verts[b].x - verts[a].x, z: verts[b].y - verts[a].y };
      const w = { x: verts[c].x - verts[a].x, z: verts[c].y - verts[a].y };
      const ny = u.z * w.x - u.x * w.z; // y of (u, 0) × (w, 0): positive faces up
      if (ny > 0) indices.push(base + a, base + b, base + c);
      else indices.push(base + a, base + c, base + b);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
