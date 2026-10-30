// Candidate buildings are those a shot sees (docs/adr/0049-buildings-from-sourced-data.md; spec BL1).
import type { HeightAt } from "./camera";
import type { Vec3 } from "./types";

type XZ = { x: number; z: number };
type Pose = { position: Vec3; target: Vec3; fovDeg: number };
export type Footprint = { id: string; ring: XZ[]; heightM: number };

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Ids of the footprints whose mid-height centre is inside a pose's frustum and not behind terrain, in any pose. */
export function visibleFootprints(poses: Pose[], footprints: Footprint[], heightAt: HeightAt, opts: { aspect?: number; far?: number; stepUnits?: number } = {}): string[] {
  const aspect = opts.aspect ?? 16 / 9;
  const far = opts.far ?? 2600;
  const step = opts.stepUnits ?? 1; // 10 m
  const seen = new Set<string>();
  const centres = footprints.map((f) => {
    const cx = f.ring.reduce((a, p) => a + p.x, 0) / f.ring.length;
    const cz = f.ring.reduce((a, p) => a + p.z, 0) / f.ring.length;
    return { id: f.id, q: [cx, heightAt(cx, cz) + f.heightM / 20, cz] as Vec3 };
  });
  for (const pose of poses) {
    const fwd = norm(sub(pose.target, pose.position));
    const right = norm(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    const tv = Math.tan((pose.fovDeg * Math.PI) / 360);
    const th = tv * aspect;
    for (const { id, q } of centres) {
      if (seen.has(id)) continue;
      const v = sub(q, pose.position);
      const depth = dot(v, fwd);
      if (depth <= 0.05 || depth > far) continue;
      if (Math.abs(dot(v, right)) / depth > th || Math.abs(dot(v, up)) / depth > tv) continue;
      const len = Math.hypot(v[0], v[1], v[2]);
      const n = Math.max(1, Math.floor(len / step));
      let hidden = false;
      for (let k = 1; k < n; k++) {
        const t = k / n;
        if (t > 0.97) break; // the last stretch is the building's own ground
        const s: Vec3 = [pose.position[0] + v[0] * t, pose.position[1] + v[1] * t, pose.position[2] + v[2] * t];
        if (heightAt(s[0], s[2]) > s[1]) {
          hidden = true;
          break;
        }
      }
      if (!hidden) seen.add(id);
    }
  }
  return [...seen];
}
