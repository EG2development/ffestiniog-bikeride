// Photoreal layer: one instanced mesh of grass clumps near the trail (docs/adr/0054-photoreal-layer.md).
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GrassClump } from "../../three-core/grass";
import { GRASS } from "../../three-core/photoLook";
import { setInstances } from "../instancing";
import type { Mask } from "../mask";

// A clump is three bent blades crossed at 60°, three triangles each, darker at the base and lighter at the tip, drawn
// once per clump by instance matrix with an instance colour for the tint: one draw call for every clump. Grass receives
// shadows but casts none (it would double the shadow pass for a few centimetres of occlusion); the ambient occlusion
// pass gives it its contact shadow. Under a measurement mask it is black, as nothing the masks measure.

function clumpGeometry(): THREE.BufferGeometry {
  const w = GRASS.bladeWidthM / 2 / 10;
  const h = GRASS.bladeHeightM / 10;
  const base = new THREE.Color(GRASS.base);
  const tip = new THREE.Color(GRASS.tip);
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  for (let b = 0; b < GRASS.blades; b++) {
    const a = (b * Math.PI) / GRASS.blades;
    const [cx, sx] = [Math.cos(a), Math.sin(a)];
    // five vertices: two at the foot, two half way (narrower, leaning), one at the tip (leaning more)
    const lean = 0.35 * h;
    const pts: [number, number, number, number][] = [
      [-w, 0, 0, 0],
      [w, 0, 0, 0],
      [-w * 0.6, h * 0.55, lean * 0.4, 0.55],
      [w * 0.6, h * 0.55, lean * 0.4, 0.55],
      [0, h, lean, 1],
    ];
    const start = positions.length / 3;
    for (const [x, y, z, t] of pts) {
      positions.push(x * cx - z * sx, y, x * sx + z * cx);
      const c = base.clone().lerp(tip, t);
      colours.push(c.r, c.g, c.b);
    }
    indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2, start + 2, start + 3, start + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export const GrassView: React.FC<{ clumps: GrassClump[]; mask?: Mask }> = ({ clumps, mask }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(clumpGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    if (ref.current) setInstances(ref.current, clumps, (c) => c.tint);
  }, [clumps]);
  if (clumps.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, clumps.length]} receiveShadow frustumCulled={false}>
      {mask ? <meshBasicMaterial color="#000000" side={THREE.DoubleSide} /> : <meshStandardMaterial vertexColors roughness={0.92} metalness={0} side={THREE.DoubleSide} />}
    </instancedMesh>
  );
};
