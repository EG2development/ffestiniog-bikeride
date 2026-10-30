// Iteration 2: tree palette from trees.ts (docs/adr/0046-clarity-tuned-as-data.md).
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CROWN_SHAPES, TREE_COLOURS, TREE_FILL, type TreeInstance, type TreePlacement } from "../three-core/trees";
import { maskColour, type Mask } from "./mask";

// Two instanced meshes (conifer, broadleaf): two draw calls for all trees (spec RN6).
// Sizes in world units (1 = 10 m): conifers about 14 m, broadleaf about 11 m.

function coloured(geometry: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const g = geometry.toNonIndexed();
  const c = new THREE.Color(hex);
  const colours = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colours.length; i += 3) colours.set([c.r, c.g, c.b], i);
  g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return g;
}

function treeGeometry(kind: "conifer" | "broadleaf"): THREE.BufferGeometry {
  const trunk = coloured(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 5).translate(0, 0.15, 0), TREE_COLOURS.trunk);
  const { conifer: c, broadleaf: b } = CROWN_SHAPES;
  const crown =
    kind === "conifer"
      ? coloured(new THREE.ConeGeometry(c.radius, c.apexY - c.baseY, 7).translate(0, (c.apexY + c.baseY) / 2, 0), TREE_COLOURS.conifer)
      : coloured(new THREE.IcosahedronGeometry(b.radius, 0).scale(1, b.yScale, 1).translate(0, b.centreY, 0), TREE_COLOURS.broadleaf);
  const merged = mergeGeometries([trunk, crown]);
  merged.computeVertexNormals();
  return merged;
}

const Instances: React.FC<{ kind: "conifer" | "broadleaf"; trees: TreeInstance[]; mask?: Mask }> = ({ kind, trees, mask }) => {
  const mc = maskColour(mask, "trees");
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => treeGeometry(kind), [kind]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    trees.forEach((t, i) => {
      q.setFromAxisAngle(up, t.yaw);
      m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.scale, t.scale, t.scale));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [trees]);
  if (trees.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, trees.length]} castShadow receiveShadow>
      {mask === "trees-sun" ? <meshLambertMaterial color="#ffffff" /> : mc ? <meshBasicMaterial color={mc} /> : <meshStandardMaterial vertexColors roughness={0.9} metalness={0} emissive={TREE_COLOURS[kind]} emissiveIntensity={TREE_FILL} />}
    </instancedMesh>
  );
};

export const TreesView: React.FC<{ trees: TreePlacement; mask?: Mask }> = ({ trees, mask }) => (
  <>
    <Instances kind="conifer" trees={trees.conifer} mask={mask} />
    <Instances kind="broadleaf" trees={trees.broadleaf} mask={mask} />
  </>
);
