import React, { useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "../three-core/types";

export const SKY_COLOUR = "#c3d3dc";

// Fixed sun, hemisphere fill and fog; no HDRI (docs/adr/0018-fixed-lighting.md). The shadow camera
// follows the rider so the 2048² map covers about 300 m around them.
export const Lighting: React.FC<{ sunDirection: Vec3; focus: Vec3 }> = ({ sunDirection, focus }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(...focus);
  target.updateMatrixWorld();
  const sun: Vec3 = [focus[0] + sunDirection[0] * 120, focus[1] + sunDirection[1] * 120, focus[2] + sunDirection[2] * 120];
  return (
    <>
      <color attach="background" args={[SKY_COLOUR]} />
      <fog attach="fog" args={[SKY_COLOUR, 120, 900]} />
      <hemisphereLight args={["#dfe8ee", "#5c6a4a", 0.75]} />
      <primitive object={target} />
      <directionalLight
        position={sun}
        target={target}
        intensity={2.2}
        color="#fff4e2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />
    </>
  );
};
