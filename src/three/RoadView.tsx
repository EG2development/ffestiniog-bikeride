import React from "react";
import type { MeshArrays } from "../three-core/types";
import { useMeshGeometry } from "./geometry";
import { maskColour, type Mask } from "./mask";

export const RoadView: React.FC<{ mesh: MeshArrays; mask?: Mask }> = ({ mesh, mask }) => {
  const mc = maskColour(mask, "roads");
  const geometry = useMeshGeometry(mesh);
  return (
    <mesh geometry={geometry} receiveShadow>
      {mc ? <meshBasicMaterial color={mc} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} /> : <meshStandardMaterial color="#5a5a56" roughness={0.9} metalness={0} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />}
    </mesh>
  );
};
