import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { MeshArrays } from "../three-core/types";

/** A BufferGeometry for core mesh arrays, disposed when the arrays change or the view unmounts. */
export function useMeshGeometry(mesh: MeshArrays): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    if (mesh.colors) g.setAttribute("color", new THREE.BufferAttribute(mesh.colors, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}
