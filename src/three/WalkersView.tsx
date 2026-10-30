// Walkers on the trail (docs/adr/0059-walkers-on-the-trail.md): figures the pure core emits as parts, like the rider.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { walkerColours, walkerParts, type Activity, type WalkerTrack } from "../three-core/walkers";
import type { Mask } from "./mask";

// Walker space: +x forward, +y up, +z to the walker's right; world units (1 = 10 m). Each walker is two instanced
// meshes: unit cylinders for the limbs and unit spheres for the joints, head and hair, with the instance matrices and
// colours rebuilt from the parts each frame as plain attributes (declarative, so they are in place when the canvas
// advances). Two draw calls per walker per pass; a pram adds a box mesh (its body and blanket) and a tyre mesh (ADR 61).
// Under a measurement mask the figures are black: they are nothing the masks measure, and must not be counted as the
// rider.

const UP = new THREE.Vector3(0, 1, 0);
const NO_ROTATION = new THREE.Quaternion();
type Shared = { tube: THREE.CylinderGeometry; ball: THREE.SphereGeometry; box: THREE.BoxGeometry; tyre: THREE.TorusGeometry; material: THREE.Material };

/** Instance matrices and colours for the parts: one tube per capsule, a ball at each capsule end and per sphere, a box
 * per box and a tyre per torus (a pram's). */
function instances(heightM: number, phase: number, activity: Activity, colours: Record<string, string>) {
  const parts = walkerParts(heightM, phase, activity);
  const tubes: number[] = [];
  const tubeColours: number[] = [];
  const balls: number[] = [];
  const ballColours: number[] = [];
  const boxes: number[] = [];
  const boxColours: number[] = [];
  const tyres: number[] = [];
  const tyreColours: number[] = [];
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
    } else if (p.kind === "torus") {
      // the tyre torus lies in the x–y plane: it rolls along +x on an axle across the path
      m.compose(a, NO_ROTATION, s.set(p.r, p.r, p.r));
      push(tyres, tyreColours);
    } else {
      const sc = p.scale ?? [1, 1, 1];
      m.compose(a, NO_ROTATION, s.set(p.r * sc[0], p.r * sc[1], p.r * sc[2]));
      if (p.kind === "box") push(boxes, boxColours);
      else push(balls, ballColours);
    }
  }
  const f = (xs: number[]) => new Float32Array(xs);
  return { tubes: f(tubes), tubeColours: f(tubeColours), balls: f(balls), ballColours: f(ballColours), boxes: f(boxes), boxColours: f(boxColours), tyres: f(tyres), tyreColours: f(tyreColours) };
}

const Walker: React.FC<{ track: WalkerTrack; frame: number; shared: Shared; masked: boolean }> = ({ track, frame, shared, masked }) => {
  const { heightM, seed } = track.spec;
  const activity = track.spec.activity ?? "walk";
  const colours = useMemo(() => walkerColours(seed, activity), [seed, activity]);
  const pose = track.poseAt(frame);
  const inst = useMemo(() => instances(heightM, pose.phase, activity, colours), [heightM, pose.phase, activity, colours]);
  const nTubes = inst.tubes.length / 16;
  const nBalls = inst.balls.length / 16;
  const nBoxes = inst.boxes.length / 16;
  const nTyres = inst.tyres.length / 16;
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
      {nBoxes > 0 ? (
        <instancedMesh key={`x${nBoxes}`} args={[shared.box, shared.material, nBoxes]} frustumCulled={false} castShadow>
          <instancedBufferAttribute attach="instanceMatrix" args={[inst.boxes, 16]} />
          {masked ? null : <instancedBufferAttribute attach="instanceColor" args={[inst.boxColours, 3]} />}
        </instancedMesh>
      ) : null}
      {nTyres > 0 ? (
        <instancedMesh key={`y${nTyres}`} args={[shared.tyre, shared.material, nTyres]} frustumCulled={false} castShadow>
          <instancedBufferAttribute attach="instanceMatrix" args={[inst.tyres, 16]} />
          {masked ? null : <instancedBufferAttribute attach="instanceColor" args={[inst.tyreColours, 3]} />}
        </instancedMesh>
      ) : null}
    </group>
  );
};

export const WalkersView: React.FC<{ tracks: WalkerTrack[]; frame: number; mask?: Mask }> = ({ tracks, frame, mask }) => {
  const masked = mask !== undefined;
  const shared = useMemo<Shared>(
    () => ({
      tube: new THREE.CylinderGeometry(1, 1, 1, 10, 1, true),
      ball: new THREE.SphereGeometry(1, 12, 10),
      box: new THREE.BoxGeometry(1, 1, 1),
      // the pram's tyres: radius 1 to the tube's centre, an outer edge at 1.18 (walkers.ts sizes the wheel by it)
      tyre: new THREE.TorusGeometry(1, 0.18, 8, 24),
      material: masked ? new THREE.MeshBasicMaterial({ color: "#000000" }) : new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0 }),
    }),
    [masked],
  );
  useEffect(
    () => () => {
      for (const g of [shared.tube, shared.ball, shared.box, shared.tyre]) g.dispose();
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
