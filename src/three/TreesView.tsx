import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { TreeInstance, TreePlacement } from "../three-core/trees";

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
  const trunk = coloured(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 5).translate(0, 0.15, 0), "#4a3a2a");
  const crown =
    kind === "conifer"
      ? coloured(new THREE.ConeGeometry(0.28, 1.15, 7).translate(0, 0.85, 0), "#2c4a2c")
      : coloured(new THREE.IcosahedronGeometry(0.42, 0).scale(1, 0.85, 1).translate(0, 0.7, 0), "#4a6a34");
  const merged = mergeGeometries([trunk, crown]);
  merged.computeVertexNormals();
  return merged;
}

const Instances: React.FC<{ kind: "conifer" | "broadleaf"; trees: TreeInstance[] }> = ({ kind, trees }) => {
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
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0} />
    </instancedMesh>
  );
};

export const TreesView: React.FC<{ trees: TreePlacement }> = ({ trees }) => (
  <>
    <Instances kind="conifer" trees={trees.conifer} />
    <Instances kind="broadleaf" trees={trees.broadleaf} />
  </>
);
