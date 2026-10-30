import type { Trail } from "./trail";
import type { MeshArrays } from "./types";

// A generic deck with parapets along the trail between two distances. Only the position comes
// from OSM; the form is generic and registered as approximate (docs/adr/0012-sourced-structures-only.md).

export function buildBridgeMesh(
  trail: Trail,
  span: [number, number],
  opts = { deckWidthM: 4.5, deckDepthM: 0.6, parapetHeightM: 1.0, parapetThicknessM: 0.3 },
): MeshArrays {
  const positions: number[] = [];
  const indices: number[] = [];
  const stations: number[] = [];
  for (let d = span[0]; d < span[1]; d += 1) stations.push(d);
  stations.push(span[1]);

  // Each cross-section is a closed loop of points (offset across the deck, height); successive loops are joined.
  const w = opts.deckWidthM / 2;
  const t = opts.parapetThicknessM;
  const h = opts.parapetHeightM;
  const depth = opts.deckDepthM;
  const profile: [number, number][] = [
    [-w, -depth],
    [w, -depth],
    [w, h],
    [w - t, h],
    [w - t, 0],
    [-(w - t), 0],
    [-(w - t), h],
    [-w, h],
  ];

  // texture coordinates for a stone material (the photoreal layer): u along the deck in metres, v round the profile
  const uvs: number[] = [];
  const around: number[] = [0];
  for (let k = 1; k < profile.length; k++) around.push(around[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
  stations.forEach((d) => {
    const s = trail.sampleAt(d);
    const l = Math.hypot(s.tangent[0], s.tangent[2]) || 1;
    const lx = s.tangent[2] / l;
    const lz = -s.tangent[0] / l;
    const top = s.y - 0.003;
    profile.forEach(([across, up], k) => {
      positions.push(s.x + (lx * across) / 10, top + up / 10, s.z + (lz * across) / 10);
      uvs.push(d - span[0], around[k]);
    });
  });
  const n = profile.length;
  for (let i = 0; i + 1 < stations.length; i++) {
    for (let k = 0; k < n; k++) {
      const a = i * n + k;
      const b = i * n + ((k + 1) % n);
      const c = a + n;
      const e = b + n;
      indices.push(a, c, b, b, c, e);
    }
  }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices), uvs: Float32Array.from(uvs) };
}
