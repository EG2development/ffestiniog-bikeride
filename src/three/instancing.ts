// One instance loop for the views that draw many copies of one geometry (trees, grass): a matrix per item from its
// position, its yaw about +y and a uniform scale, an optional grey level per item, then the bounding sphere.
import * as THREE from "three";

export type Placed = { x: number; y: number; z: number; yaw: number; scale: number };

/** Writes every item's matrix into `mesh` and, with `tint`, its grey level as the instance colour. */
export function setInstances<T extends Placed>(mesh: THREE.InstancedMesh, items: readonly T[], tint?: (item: T) => number): void {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const colour = new THREE.Color();
  items.forEach((t, i) => {
    q.setFromAxisAngle(up, t.yaw);
    m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.scale, t.scale, t.scale));
    mesh.setMatrixAt(i, m);
    if (tint) mesh.setColorAt(i, colour.setScalar(tint(t)));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (tint && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}
