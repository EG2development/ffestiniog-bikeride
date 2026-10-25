import { useThree } from "@react-three/fiber";
import type React from "react";
import type * as THREE from "three";
import type { CameraPose } from "../three-core/camera";

// Sets the default camera from a pose during render; <ThreeCanvas> then advances once for the
// frame. No useFrame (docs/adr/0017-camera-set-during-render.md).
export const CameraRig: React.FC<{ pose: CameraPose; near: number; far: number }> = ({ pose, near, far }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...pose.position);
  camera.fov = pose.fovDeg;
  camera.near = near;
  camera.far = far;
  camera.lookAt(...pose.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return null;
};
