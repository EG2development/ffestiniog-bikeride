import React, { useMemo } from "react";
import * as THREE from "three";
import type { MeshArrays } from "../three-core/types";
import { useMeshGeometry } from "./geometry";
import { maskColour, type Mask } from "./mask";
import type { RoleTextures } from "./photo/assetRoles";

// In the photo look (docs/adr/0060-reel-in-the-photo-look.md) the carriageway carries the registered tarmac texture,
// mapped on the ground plane at its own metre scale, instead of a flat grey.
export const RoadView: React.FC<{ mesh: MeshArrays; mask?: Mask; tarmac?: RoleTextures }> = ({ mesh, mask, tarmac }) => {
  const mc = maskColour(mask, "roads");
  const geometry = useMeshGeometry(mesh);
  const tileM = tarmac?.tileM;
  useMemo(() => {
    if (tileM === undefined) return;
    const p = mesh.positions;
    const uv = new Float32Array((p.length / 3) * 2);
    for (let i = 0; i < p.length / 3; i++) uv.set([(p[3 * i] * 10) / tileM, (p[3 * i + 2] * 10) / tileM], 2 * i); // world unit = 10 m
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }, [geometry, mesh, tileM]);
  return (
    <mesh geometry={geometry} receiveShadow>
      {mc ? (
        <meshBasicMaterial color={mc} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      ) : tarmac ? (
        <meshStandardMaterial color="#d6d6d2" map={tarmac.map} normalMap={tarmac.normalMap} normalScale={new THREE.Vector2(0.5, 0.5)} roughness={0.92} metalness={0} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      ) : (
        <meshStandardMaterial color="#5a5a56" roughness={0.9} metalness={0} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      )}
    </mesh>
  );
};
