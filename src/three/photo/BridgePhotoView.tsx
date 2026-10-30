// Photoreal layer: the OSM bridge in stone (docs/adr/0054-photoreal-layer.md). Its form is still generic (ADR 12):
// the legend names it as "OSM position, generic form" in place of the concept look's hatching (spec CL7).
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { MeshArrays } from "../../three-core/types";
import type { RoleTextures } from "./assetRoles";

export const BridgePhotoView: React.FC<{ mesh: MeshArrays; stone: RoleTextures }> = ({ mesh, stone }) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    // the core's coordinates run along the deck and round the profile in metres (bridge.ts), so the courses follow the
    // parapets whichever way the deck points; one tile per tileM
    const src = mesh.uvs ?? new Float32Array((mesh.positions.length / 3) * 2);
    const uv = Float32Array.from(src, (v) => v / stone.tileM);
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [mesh, stone.tileM]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial map={stone.map} normalMap={stone.normalMap} roughness={1} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
};
