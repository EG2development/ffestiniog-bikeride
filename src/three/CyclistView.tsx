// Reel: geometry comes from the dimensions (docs/adr/0034-cyclist-from-dims.md).
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { cyclistParts, type Part, type PartMaterial } from "../three-core/cyclistModel";
import type { CyclistDims, CyclistPose } from "../three-core/cyclistMotion";
import { maskColour, type Mask } from "./mask";

// Procedural bike and rider (docs/adr/0014-procedural-cyclist.md), built from parts the pure core emits.
// Model space: +x forward, +y up, +z to the rider's right; world units (1 = 10 m).

const UP = new THREE.Vector3(0, 1, 0);
const COLOURS: Record<PartMaterial, string> = { frame: "#2f3a44", tyre: "#1c1c1c", rim: "#2f3a44", rider: "#c8502c", helmet: "#f0f0f0", skin: "#d9ae92" };
const LEGS = "#2a2a30";

export const CyclistView: React.FC<{ pose: CyclistPose; dims: CyclistDims; mask?: Mask }> = ({ pose, dims, mask }) => {
  const mc = maskColour(mask, "cyclist");
  const flat = useMemo(() => (mc ? new THREE.MeshBasicMaterial({ color: mc }) : null), [mc]);
  useEffect(() => () => flat?.dispose(), [flat]);
  const shared = useMemo(() => {
    const tube = new THREE.CylinderGeometry(1, 1, 1, 8);
    const ball = new THREE.SphereGeometry(1, 12, 10);
    const tyre = new THREE.TorusGeometry(1, 0.055, 6, 28);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const mat = (hex: string) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: 0.05 });
    const materials = Object.fromEntries(Object.entries(COLOURS).map(([k, hex]) => [k, mat(hex)])) as unknown as Record<PartMaterial, THREE.Material>;
    return { tube, ball, tyre, box, materials, legs: mat(LEGS) };
  }, []);
  useEffect(
    () => () => {
      for (const g of [shared.tube, shared.ball, shared.tyre, shared.box]) g.dispose();
      for (const m of Object.values(shared.materials)) m.dispose();
      shared.legs.dispose();
    },
    [shared],
  );

  const parts = cyclistParts(dims, pose.crankAngle, pose.wheelAngle);
  const render = (p: Part, i: number) => {
    const material = flat ?? (p.name && /^(thigh|shin)-/.test(p.name) ? shared.legs : shared.materials[p.material]);
    const a = new THREE.Vector3(...p.a);
    if (p.kind === "capsule" && p.b) {
      const b = new THREE.Vector3(...p.b);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      return <mesh key={i} geometry={shared.tube} material={material} position={mid} quaternion={q} scale={[p.r, len, p.r]} castShadow />;
    }
    if (p.kind === "torus") return <mesh key={i} geometry={shared.tyre} material={material} position={a} rotation={[0, 0, -pose.wheelAngle]} scale={[p.r * 0.95, p.r * 0.95, p.r * 0.95]} castShadow />;
    const s = p.scale ?? [1, 1, 1];
    return <mesh key={i} geometry={p.kind === "box" ? shared.box : shared.ball} material={material} position={a} scale={[p.r * s[0], p.r * s[1], p.r * s[2]]} castShadow />;
  };

  return (
    <group position={pose.position} rotation={[0, pose.yaw, pose.pitch, "YZX"]}>
      {parts.map(render)}
    </group>
  );
};
