import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { CyclistDims, CyclistPose } from "../three-core/cyclistMotion";

// Procedural bike and rider (docs/adr/0014-procedural-cyclist.md). Model space: +x forward, +y up,
// +z to the rider's right; world units (1 = 10 m). Riding height ≈ 1.7 m (spec C1).

type P = [number, number];
const CRANK = 0.0172;
const THIGH = 0.045;
const SHIN = 0.047;
const BB: P = [0, 0.03];
const HIP: P = [-0.012, 0.098];

const UP = new THREE.Vector3(0, 1, 0);

const Segment: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; r: number; geometry: THREE.BufferGeometry; material: THREE.Material }> = ({
  a,
  b,
  r,
  geometry,
  material,
}) => {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return <mesh geometry={geometry} material={material} position={mid} quaternion={q} scale={[r, len, r]} castShadow />;
};

/** Knee for a two-bone leg from hip to foot, bending forward. */
function knee(hip: P, foot: P): P {
  const dx = foot[0] - hip[0];
  const dy = foot[1] - hip[1];
  const d = Math.min(THIGH + SHIN - 1e-6, Math.hypot(dx, dy));
  const toFoot = Math.atan2(dy, dx);
  const atHip = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
  const a = toFoot + atHip; // + bends the knee forward (+x) when the foot is below the hip
  return [hip[0] + THIGH * Math.cos(a), hip[1] + THIGH * Math.sin(a)];
}

const v = (p: P, z = 0) => new THREE.Vector3(p[0], p[1], z);

export const CyclistView: React.FC<{ pose: CyclistPose; dims: CyclistDims }> = ({ pose, dims }) => {
  const parts = useMemo(() => {
    const tube = new THREE.CylinderGeometry(1, 1, 1, 8);
    const ball = new THREE.SphereGeometry(1, 12, 10);
    const tyre = new THREE.TorusGeometry(1, 0.055, 6, 28);
    const mat = (hex: string) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: 0.05 });
    return { tube, ball, tyre, frame: mat("#2f3a44"), rubber: mat("#1c1c1c"), jacket: mat("#c8502c"), legs: mat("#2a2a30"), skin: mat("#d9ae92"), helmet: mat("#f0f0f0") };
  }, []);
  useEffect(
    () => () => {
      for (const x of Object.values(parts)) (x as THREE.BufferGeometry | THREE.Material).dispose();
    },
    [parts],
  );

  const r = dims.wheelDiameterM / 2 / 10;
  const half = dims.wheelbaseM / 2 / 10;
  const rear: P = [-half, r];
  const front: P = [half, r];
  const seat: P = [-0.012, 0.085];
  const head: P = [0.045, 0.088];
  const bar: P = [0.04, 0.098];
  const shoulder: P = [0.025, 0.142];
  const { tube, ball, tyre } = parts;

  const pedal = (phase: number): P => {
    const a = -(pose.crankAngle + phase); // pedalling forward turns the crank clockwise seen from the right
    return [BB[0] + CRANK * Math.cos(a), BB[1] + CRANK * Math.sin(a)];
  };
  const leg = (side: 1 | -1, phase: number) => {
    const foot = pedal(phase);
    const k = knee(HIP, foot);
    const z = side * 0.01;
    return (
      <group key={side}>
        <Segment a={v(HIP, z)} b={v(k, z)} r={0.007} geometry={tube} material={parts.legs} />
        <Segment a={v(k, z)} b={v(foot, z)} r={0.005} geometry={tube} material={parts.legs} />
        <Segment a={v(BB, z)} b={v(foot, z)} r={0.002} geometry={tube} material={parts.frame} />
      </group>
    );
  };
  const wheel = (at: P) => (
    <group position={v(at)} rotation={[0, 0, -pose.wheelAngle]}>
      <mesh geometry={tyre} material={parts.rubber} scale={[r * 0.95, r * 0.95, r * 0.95]} castShadow />
      {[0, 1, 2].map((k) => (
        <mesh key={k} geometry={tube} material={parts.frame} rotation={[0, 0, (k * Math.PI) / 3]} scale={[0.0008, r * 1.8, 0.0008]} />
      ))}
    </group>
  );

  return (
    <group position={pose.position} rotation={[0, pose.yaw, pose.pitch, "YZX"]}>
      {wheel(rear)}
      {wheel(front)}
      <Segment a={v(rear)} b={v(BB)} r={0.0018} geometry={tube} material={parts.frame} />
      <Segment a={v(rear)} b={v(seat)} r={0.0016} geometry={tube} material={parts.frame} />
      <Segment a={v(BB)} b={v(seat)} r={0.002} geometry={tube} material={parts.frame} />
      <Segment a={v(seat)} b={v(head)} r={0.002} geometry={tube} material={parts.frame} />
      <Segment a={v(BB)} b={v(head)} r={0.0024} geometry={tube} material={parts.frame} />
      <Segment a={v(head)} b={v(front)} r={0.0018} geometry={tube} material={parts.frame} />
      <Segment a={v(bar, -0.022)} b={v(bar, 0.022)} r={0.0014} geometry={tube} material={parts.frame} />
      <Segment a={v(HIP)} b={v(shoulder)} r={0.016} geometry={tube} material={parts.jacket} />
      <Segment a={v(shoulder, -0.018)} b={v(bar, -0.02)} r={0.005} geometry={tube} material={parts.jacket} />
      <Segment a={v(shoulder, 0.018)} b={v(bar, 0.02)} r={0.005} geometry={tube} material={parts.jacket} />
      <mesh geometry={ball} material={parts.skin} position={[0.036, 0.155, 0]} scale={[0.0105, 0.0105, 0.0105]} castShadow />
      <mesh geometry={ball} material={parts.helmet} position={[0.034, 0.159, 0]} scale={[0.0125, 0.009, 0.0115]} castShadow />
      {leg(1, 0)}
      {leg(-1, Math.PI)}
    </group>
  );
};
