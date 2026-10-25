import React, { useMemo } from "react";
import type { MeshArrays } from "../three-core/types";
import { useMeshGeometry } from "./geometry";

// The land-cover palette is written as sRGB; three.js treats vertex colours as linear.
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export const TerrainView: React.FC<{ mesh: MeshArrays }> = ({ mesh }) => {
  const linear = useMemo(() => (mesh.colors ? { ...mesh, colors: mesh.colors.map(toLinear) } : mesh), [mesh]);
  const geometry = useMeshGeometry(linear);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  );
};
