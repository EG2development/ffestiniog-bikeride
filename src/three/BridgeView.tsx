import React from "react";
import * as THREE from "three";
import type { MeshArrays } from "../three-core/types";
import { useMeshGeometry } from "./geometry";

// Generic stone deck and parapets; only the position is from OSM (docs/adr/0012-sourced-structures-only.md).
export const BridgeView: React.FC<{ mesh: MeshArrays }> = ({ mesh }) => {
  const geometry = useMeshGeometry(mesh);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#8a837a" roughness={0.95} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
};
