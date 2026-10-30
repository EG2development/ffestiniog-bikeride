// Walkers on the trail (docs/adr/0059-walkers-on-the-trail.md): figures the pure core emits as parts, like the rider.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { walkerColours, walkerParts, type WalkerTrack } from "../three-core/walkers";
import type { Mask } from "./mask";

// Walker space: +x forward, +y up, +z to the walker's right; world units (1 = 10 m). Each walker is two instanced
// meshes: unit cylinders for the limbs and unit spheres for the joints, head and hair, with the instance matrices and
// colours rebuilt from the parts each frame as plain attributes (declarative, so they are in place when the canvas
// advances). Two draw calls per walker per pass. Under a measurement mask the figures are black: they are nothing the
// masks measure, and must not be counted as the rider.

const UP = new THREE.Vector3(0, 1, 0);
const NO_ROTATION = new THREE.Quaternion();
type Shared = { tube: THREE.CylinderGeometry; ball: THREE.SphereGeometry; material: THREE.Material };

/** Instance matrices and colours for the parts: one tube per capsule, a ball at each capsule end and per sphere. */
function instances(heightM: number, phase: number, colours: Record<string, string>) {
  const parts = walkerParts(heightM, phase);
  const tubes: number[] = [];
  const tubeColours: number[] = [];
  const balls: number[] = [];
  const ballColours: number[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const push = (into: number[], colourInto: number[]) => {
    into.push(...m.elements);
    colourInto.push(c.r, c.g, c.b);
  };
  for (const p of parts) {
    c.set(colours[p.material]);
    const a = new THREE.Vector3(...p.a);
    if (p.kind === "capsule" && p.b) {
      const b = new THREE.Vector3(...p.b);
      const dir = b.clone().sub(a);
      const len = dir.length();
      if (len > 1e-9) q.setFromUnitVectors(UP, dir.divideScalar(len));
      else q.identity();
      m.compose(a.clone().add(b).multiplyScalar(0.5), q, s.set(p.r, len, p.r));
      push(tubes, tubeColours);
      for (const end of [a, b]) {
        m.compose(end, NO_ROTATION, s.set(p.r, p.r, p.r));
        push(balls, ballColours);
      }
    } else {
      const sc = p.scale ?? [1, 1, 1];
      m.compose(a, NO_ROTATION, s.set(p.r * sc[0], p.r * sc[1], p.r * sc[2]));
      push(balls, ballColours);
    }
  }
  return { tubes: new Float32Array(tubes), tubeColours: new Float32Array(tubeColours), balls: new Float32Array(balls), ballColours: new Float32Array(ballColours) };
}

const Walker: React.FC<{ track: WalkerTrack; frame: number; shared: Shared; masked: boolean }> = ({ track, frame, shared, masked }) => {
  const { heightM, seed } = track.spec;
  const colours = useMemo(() => walkerColours(seed), [seed]);
  const pose = track.poseAt(frame);
  const inst = useMemo(() => instances(heightM, pose.phase, colours), [heightM, pose.phase, colours]);
  const nTubes = inst.tubes.length / 16;
  const nBalls = inst.balls.length / 16;
  return (
    <group position={pose.position} rotation={[0, pose.yaw, 0]}>
      <instancedMesh key={`t${nTubes}`} args={[shared.tube, shared.material, nTubes]} frustumCulled={false} castShadow>
        <instancedBufferAttribute attach="instanceMatrix" args={[inst.tubes, 16]} />
        {masked ? null : <instancedBufferAttribute attach="instanceColor" args={[inst.tubeColours, 3]} />}
      </instancedMesh>
      <instancedMesh key={`b${nBalls}`} args={[shared.ball, shared.material, nBalls]} frustumCulled={false} castShadow>
        <instancedBufferAttribute attach="instanceMatrix" args={[inst.balls, 16]} />
        {masked ? null : <instancedBufferAttribute attach="instanceColor" args={[inst.ballColours, 3]} />}
      </instancedMesh>
    </group>
  );
};

export const WalkersView: React.FC<{ tracks: WalkerTrack[]; frame: number; mask?: Mask }> = ({ tracks, frame, mask }) => {
  const masked = mask !== undefined;
  const shared = useMemo<Shared>(
    () => ({
      tube: new THREE.CylinderGeometry(1, 1, 1, 10, 1, true),
      ball: new THREE.SphereGeometry(1, 12, 10),
      material: masked ? new THREE.MeshBasicMaterial({ color: "#000000" }) : new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0 }),
    }),
    [masked],
  );
  useEffect(
    () => () => {
      shared.tube.dispose();
      shared.ball.dispose();
      shared.material.dispose();
    },
    [shared],
  );
  if (tracks.length === 0) return null;
  return (
    <>
      {tracks.map((track) => (
        <Walker key={track.spec.seed} track={track} frame={frame} shared={shared} masked={masked} />
      ))}
    </>
  );
};
