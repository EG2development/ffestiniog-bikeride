import type { Vec3 } from "../three-core/types";

// The Three.js → Blender coordinate contract (docs/blender-build-plan.md, "Coordinate and frame contract").
// Three.js is Y-up with 1 unit = 10 m; Blender is Z-up with 1 unit = 1 m:
//   Blender X =  10 × (Three X − x0)
//   Blender Y = −10 × (Three Z − z0)
//   Blender Z =  10 ×  Three Y
// The axes part is a rotation (determinant +1), so handedness and triangle winding survive; the 10× is a uniform scale.

export const METRES_PER_UNIT = 10;

/** The section origin: a horizontal point in Three.js world units that becomes Blender's (0, 0). */
export type Origin = { x0: number; z0: number };

export const toBlender = (p: Vec3, o: Origin): Vec3 => [METRES_PER_UNIT * (p[0] - o.x0), -METRES_PER_UNIT * (p[2] - o.z0), METRES_PER_UNIT * p[1]];

export const fromBlender = (p: Vec3, o: Origin): Vec3 => [p[0] / METRES_PER_UNIT + o.x0, p[2] / METRES_PER_UNIT, -p[1] / METRES_PER_UNIT + o.z0];

/** A direction (unit vector): the same rotation, no scale and no origin. */
export const dirToBlender = (d: Vec3): Vec3 => [d[0], -d[2], d[1]];

/**
 * Rotation about the vertical. A Three.js yaw about +y turns +x to (cos θ, 0, −sin θ), which the mapping sends to
 * (cos θ, sin θ, 0): a Blender rotation about +Z by the same angle, so yaws carry over unchanged.
 */
export const yawToBlender = (yaw: number): number => yaw;

/** Interleaved xyz positions from world units to Blender metres. */
export function positionsToBlender(src: ArrayLike<number>, o: Origin): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i + 2 < src.length; i += 3) {
    out[i] = METRES_PER_UNIT * (src[i] - o.x0);
    out[i + 1] = -METRES_PER_UNIT * (src[i + 2] - o.z0);
    out[i + 2] = METRES_PER_UNIT * src[i + 1];
  }
  return out;
}

/** A Three.js source frame is Blender frame f + 1. */
export const blenderFrame = (sourceFrame: number): number => sourceFrame + 1;
