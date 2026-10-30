// Iteration 2: approximate structures are hatched (docs/design-reel-v2.md D44; spec CL7).
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { MeshArrays } from "../three-core/types";
import { useMeshGeometry } from "./geometry";
import { maskColour, type Mask } from "./mask";

// Generic stone deck and parapets; only the position is from OSM (docs/adr/0012-sourced-structures-only.md). The form is
// approximate, so the stone carries diagonal hatching, a 4 m period in world space, and the legend names it.
const PERIOD = 0.4; // world units

function hatchTexture(): THREE.DataTexture {
  const n = 16;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) data.set((x + y) % n < 5 ? [0x5c, 0x57, 0x50, 255] : [0x9a, 0x93, 0x88, 255], 4 * (y * n + x));
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export const BridgeView: React.FC<{ mesh: MeshArrays; mask?: Mask }> = ({ mesh, mask }) => {
  const mc = maskColour(mask, "bridges");
  const geometry = useMeshGeometry(mesh);
  useMemo(() => {
    const p = geometry.attributes.position.array as Float32Array;
    const uv = new Float32Array((p.length / 3) * 2);
    for (let i = 0; i < p.length / 3; i++) uv.set([(p[3 * i] + p[3 * i + 1]) / PERIOD, (p[3 * i + 2] + p[3 * i + 1]) / PERIOD], 2 * i);
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }, [geometry]);
  const hatch = useMemo(hatchTexture, []);
  useEffect(() => () => hatch.dispose(), [hatch]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      {mc ? <meshBasicMaterial color={mc} side={THREE.DoubleSide} /> : <meshStandardMaterial map={hatch} roughness={0.95} metalness={0} side={THREE.DoubleSide} />}
    </mesh>
  );
};
