import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { TileRange } from "../three-core/tileUv";
import { tileUvs } from "../three-core/tileUv";
import type { MeshArrays } from "../three-core/types";
import { maskColour, type Mask } from "./mask";

// The corridor terrain textured with the cached map tiles (docs/adr/0033-aerial-map-tile-drape.md).
// The composite canvas is built outside the canvas by MapDrapeProvider and passed in as a prop.

export type MapDrape = { canvas: HTMLCanvasElement; range: TileRange; z: number; missing: number };

export const MapDrapeView: React.FC<{ mesh: MeshArrays; drape: MapDrape; unproject: (x: number, z: number) => { lon: number; lat: number }; mask?: Mask }> = ({ mesh, drape, unproject, mask }) => {
  const mc = maskColour(mask, "terrain");
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(drape.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    return t;
  }, [drape]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(tileUvs(mesh.positions, unproject, drape.range, drape.z), 2));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [mesh, drape, unproject]);
  useEffect(
    () => () => {
      geometry.dispose();
      texture.dispose();
    },
    [geometry, texture],
  );
  return (
    <mesh geometry={geometry} receiveShadow>
      {mc ? <meshBasicMaterial color={mc} /> : <meshStandardMaterial map={texture} roughness={1} metalness={0} />}
    </mesh>
  );
};
