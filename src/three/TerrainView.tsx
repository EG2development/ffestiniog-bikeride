// Reel: relief shading without textures (docs/adr/0031-terrain-shading-without-textures.md).
import React, { useMemo } from "react";
import type { MeshArrays } from "../three-core/types";
import { useMeshGeometry } from "./geometry";
import { maskColour, type Mask } from "./mask";

// The land-cover palette is written as sRGB; three.js treats vertex colours as linear.
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export const TerrainView: React.FC<{ mesh: MeshArrays; mask?: Mask }> = ({ mesh, mask }) => {
  const mc = maskColour(mask, "terrain");
  const linear = useMemo(() => (mesh.colors ? { ...mesh, colors: mesh.colors.map(toLinear) } : mesh), [mesh]);
  const geometry = useMeshGeometry(linear);
  return (
    <mesh geometry={geometry} receiveShadow>
      {mc ? <meshBasicMaterial color={mc} /> : <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />}
    </mesh>
  );
};
