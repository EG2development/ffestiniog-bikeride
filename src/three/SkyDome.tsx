import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Atmosphere } from "../three-core/atmosphere";
import type { Vec3 } from "../three-core/types";
import { maskColour, type Mask } from "./mask";

// A gradient sky dome with a sun disc, plus exponential fog whose colour is the horizon colour
// (docs/adr/0030-sky-dome-and-fog.md). The dome follows the camera.

const VERT = `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform vec3 zenith; uniform vec3 horizon; varying vec3 vDir;
void main() { float t = pow(clamp(vDir.y, 0.0, 1.0), 0.6); gl_FragColor = vec4(mix(horizon, zenith, t), 1.0); }`;

export const SkyDome: React.FC<{ atmosphere: Atmosphere; centre: Vec3; sunDirection: Vec3; mask?: Mask }> = ({ atmosphere, centre, sunDirection, mask }) => {
  const horizon = useMemo(() => new THREE.Color(...atmosphere.horizon), [atmosphere]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { zenith: { value: new THREE.Color(...atmosphere.zenith) }, horizon: { value: new THREE.Color(...atmosphere.horizon) } },
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [atmosphere],
  );
  useEffect(() => () => material.dispose(), [material]);
  const sun: Vec3 = [centre[0] + sunDirection[0] * 1150, centre[1] + sunDirection[1] * 1150, centre[2] + sunDirection[2] * 1150];
  if (maskColour(mask, "terrain") !== null) return <color attach="background" args={["#000000"]} />;
  return (
    <>
      <color attach="background" args={[horizon]} />
      <fogExp2 attach="fog" args={[horizon, atmosphere.fogDensity]} />
      <mesh position={centre} material={material} renderOrder={-2} frustumCulled={false}>
        <sphereGeometry args={[1200, 32, 16]} />
      </mesh>
      <mesh position={sun} renderOrder={-1}>
        <sphereGeometry args={[22, 16, 12]} />
        <meshBasicMaterial color="#fff3cf" fog={false} />
      </mesh>
    </>
  );
};
