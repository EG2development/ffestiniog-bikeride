import React from "react";
import type { MeshArrays } from "../three-core/types";
import { useMeshGeometry } from "./geometry";
import { maskColour, type Mask } from "./mask";

// Proposed surface: a warm resin-bound buff, deliberately unlike any land-cover colour (spec H2c).
const TRAIL_COLOUR = "#d8b06a";

export const TrailView: React.FC<{ ribbon: MeshArrays; mask?: Mask }> = ({ ribbon, mask }) => {
  const mc = maskColour(mask, "trail");
  const geometry = useMeshGeometry(ribbon);
  return (
    <mesh geometry={geometry} receiveShadow>
      {mc ? <meshBasicMaterial color={mc} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} /> : <meshStandardMaterial color={TRAIL_COLOUR} roughness={0.8} metalness={0} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />}
    </mesh>
  );
};
