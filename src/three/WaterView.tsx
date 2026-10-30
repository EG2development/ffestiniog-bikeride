// Iteration 2: holes, upward faces and polygonOffset instead of a lift (docs/adr/0041-water-polygons-with-holes.md).
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { WaterBody } from "../three-core/water";
import { waterArrays } from "./waterGeometry";
import { maskColour, type Mask } from "./mask";

// A water body as a flat surface at its shore height with a frame-driven ripple pattern and no
// reflection pass (docs/adr/0032-water-from-osm.md). Animation is a function of the frame only (RN1).

function rippleNormalMap(): THREE.DataTexture {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = 4 * (y * n + x);
      const nx = Math.sin((x / n) * 2 * Math.PI * 3) * 0.25 + Math.sin((y / n) * 2 * Math.PI * 5 + x / 9) * 0.15;
      const ny = Math.cos((y / n) * 2 * Math.PI * 4) * 0.25;
      data[i] = 128 + nx * 127;
      data[i + 1] = 128 + ny * 127;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

const Body: React.FC<{ body: WaterBody; normalMap: THREE.DataTexture; mask?: Mask }> = ({ body, normalMap, mask }) => {
  const mc = maskColour(mask, "water");
  const geometry = useMemo(() => {
    // islands stay open and every triangle faces up; the surface sits at the level, drawn over the flattened
    // terrain by polygonOffset rather than lifted (ADR 41)
    const { positions, indices } = waterArrays(body.polygons, body.surfaceY);
    const uvs = new Float32Array((positions.length / 3) * 2);
    for (let i = 0; i < positions.length / 3; i++) uvs.set([positions[3 * i] / 14, positions[3 * i + 2] / 14], 2 * i); // one ripple tile per 140 m: no visible rows
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    return g;
  }, [body]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      {mc ? (
        <meshBasicMaterial color={mc} side={mask === "water-expected" ? THREE.DoubleSide : THREE.FrontSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      ) : (
        <meshStandardMaterial color="#2c5672" roughness={0.78} metalness={0} normalMap={normalMap} normalScale={new THREE.Vector2(0.12, 0.12)} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      )}
    </mesh>
  );
};

export const WaterView: React.FC<{ bodies: WaterBody[]; frame: number; mask?: Mask }> = ({ bodies, frame, mask }) => {
  const normalMap = useMemo(rippleNormalMap, []);
  useEffect(() => () => normalMap.dispose(), [normalMap]);
  const o = (frame * 0.0007) % 1;
  normalMap.offset.set(o, o);
  return (
    <>
      {bodies.map((b) => (
        <Body key={b.id} body={b} normalMap={normalMap} mask={mask} />
      ))}
    </>
  );
};
