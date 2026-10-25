import React from "react";
import type { MeshArrays } from "../three-core/types";
import { useMeshGeometry } from "./geometry";

export const RoadView: React.FC<{ mesh: MeshArrays }> = ({ mesh }) => {
  const geometry = useMeshGeometry(mesh);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#5a5a56" roughness={0.9} metalness={0} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
  );
};
