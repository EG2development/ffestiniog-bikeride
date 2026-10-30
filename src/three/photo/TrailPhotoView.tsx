// Photoreal layer: the proposed trail as a textured surface (docs/adr/0054-photoreal-layer.md).
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { PHOTO_TRAIL_TINT } from "../../three-core/photoLook";
import type { MeshArrays } from "../../three-core/types";
import type { RoleTextures } from "./assetRoles";

// The ribbon's UVs run across and along it (trail.ts); the gravel tiles along it at its own metre scale, under a pale
// buff tint, so the trail keeps a colour unlike any land cover (spec H2c) without the concept look's saturation.

export const TrailPhotoView: React.FC<{ ribbon: MeshArrays; gravel: RoleTextures; widthM: number }> = ({ ribbon, gravel, widthM }) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(ribbon.positions, 3));
    // the ribbon's v is in units of 3 m along the trail and u spans the width: rescale both to the texture's tile
    const uv = Float32Array.from(ribbon.uvs ?? new Float32Array((ribbon.positions.length / 3) * 2));
    for (let i = 0; i < uv.length; i += 2) {
      uv[i] = (uv[i] * widthM) / gravel.tileM;
      uv[i + 1] = (uv[i + 1] * 3) / gravel.tileM;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(ribbon.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [ribbon, gravel.tileM, widthM]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={PHOTO_TRAIL_TINT} map={gravel.map} normalMap={gravel.normalMap} normalScale={new THREE.Vector2(0.7, 0.7)} roughness={0.95} metalness={0} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
};
