import type { CyclistDims } from "./cyclistMotion";
import type { Vec3 } from "./types";

// The bike and rider as parts, built from the dimensions (docs/adr/0034-cyclist-from-dims.md).
// Bike space: +x forward, +y up, +z to the rider's right; world units (1 = 10 m).

export type PartMaterial = "frame" | "tyre" | "rim" | "rider" | "helmet" | "skin";
export type Part = { kind: "capsule" | "sphere" | "torus" | "box"; a: Vec3; b?: Vec3; r: number; material: PartMaterial; name?: string; scale?: Vec3 };

const CRANK = 0.0172;
const THIGH = 0.045;
const SHIN = 0.047;
const BB: Vec3 = [0, 0.03, 0];
const HIP: Vec3 = [-0.012, 0.098, 0];

/** Knee for a two-bone leg from hip to foot, bending forward (the leg lengths are the model's, not the foot's reach). */
function knee(hip: Vec3, foot: Vec3): Vec3 {
  const dx = foot[0] - hip[0];
  const dy = foot[1] - hip[1];
  const d = Math.min(THIGH + SHIN - 1e-6, Math.hypot(dx, dy));
  const toFoot = Math.atan2(dy, dx);
  const atHip = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
  const a = toFoot + atHip;
  return [hip[0] + THIGH * Math.cos(a), hip[1] + THIGH * Math.sin(a), foot[2]];
}

const at = (p: Vec3, z: number): Vec3 => [p[0], p[1], z];
const seg = (name: string, a: Vec3, b: Vec3, r: number, material: PartMaterial): Part => ({ kind: "capsule", a, b, r, material, name });

export function cyclistParts(dims: CyclistDims, crankAngle: number, wheelAngle: number): Part[] {
  const r = dims.wheelDiameterM / 2 / 10;
  const half = dims.wheelbaseM / 2 / 10;
  const rear: Vec3 = [-half, r, 0];
  const front: Vec3 = [half, r, 0];
  const seat: Vec3 = [-0.012, 0.085, 0];
  const head: Vec3 = [0.045, 0.088, 0];
  const bar: Vec3 = [0.04, 0.098, 0];
  const shoulder: Vec3 = [0.025, 0.142, 0];
  const parts: Part[] = [];

  for (const [name, hub] of [["rear", rear], ["front", front]] as const) {
    parts.push({ kind: "torus", a: hub, r, material: "tyre", name: `tyre-${name}` });
    for (let k = 0; k < 3; k++) {
      const ang = (k * Math.PI) / 3 - wheelAngle;
      const dx = Math.cos(ang) * r * 0.9;
      const dy = Math.sin(ang) * r * 0.9;
      parts.push(seg(`spoke-${name}-${k}`, [hub[0] - dx, hub[1] - dy, 0], [hub[0] + dx, hub[1] + dy, 0], 0.0008, "rim"));
    }
  }
  parts.push(seg("chainstay", rear, BB, 0.0018, "frame"), seg("seatstay", rear, seat, 0.0016, "frame"), seg("seat-tube", BB, seat, 0.002, "frame"));
  parts.push(seg("top-tube", seat, head, 0.002, "frame"), seg("down-tube", BB, head, 0.0024, "frame"), seg("fork", head, front, 0.0018, "frame"));
  parts.push(seg("bar", at(bar, -0.022), at(bar, 0.022), 0.0014, "frame"));
  parts.push(seg("torso", HIP, shoulder, 0.016, "rider"));
  parts.push(seg("arm-left", at(shoulder, -0.018), at(bar, -0.02), 0.005, "rider"), seg("arm-right", at(shoulder, 0.018), at(bar, 0.02), 0.005, "rider"));
  parts.push({ kind: "sphere", a: [0.036, 0.155, 0], r: 0.0105, material: "skin", name: "head" });
  parts.push({ kind: "sphere", a: [0.034, 0.159, 0], r: 0.0125, material: "helmet", name: "helmet", scale: [1, 0.72, 0.92] });
  for (const [side, phase, z] of [["left", 0, 0.01], ["right", Math.PI, -0.01]] as const) {
    const a = -(crankAngle + phase); // pedalling forward turns the crank clockwise seen from the right
    const foot: Vec3 = [BB[0] + CRANK * Math.cos(a), BB[1] + CRANK * Math.sin(a), z];
    const k = knee(at(HIP, z), foot);
    parts.push(seg(`thigh-${side}`, at(HIP, z), k, 0.007, "rider"), seg(`shin-${side}`, k, foot, 0.005, "rider"), seg(`crank-${side}`, at(BB, z), foot, 0.002, "frame"));
  }
  return parts;
}

/** Axis-aligned bounds of the parts in bike space (each part's ends grown by its radius). */
export function partsBounds(parts: Part[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const grow = p.scale ? p.r * Math.max(...p.scale) : p.r;
    for (const q of [p.a, p.b ?? p.a]) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], q[i] - grow);
        max[i] = Math.max(max[i], q[i] + grow);
      }
    }
  }
  return { min, max };
}
