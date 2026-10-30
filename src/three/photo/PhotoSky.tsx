// Photoreal layer: a sky with cloud and sun glow that also lights the scene (docs/adr/0054-photoreal-layer.md).
import { useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { SKY_PHOTO, type Atmosphere } from "../../three-core/atmosphere";
import type { Vec3 } from "../../three-core/types";

// The dome keeps ADR 30's gradient and horizon colour, so the fog colour still equals the horizon (spec RL11), and adds a
// fixed cloud layer (value noise on a plane above the viewer, no time term: the same sky every frame and every render)
// and a glow round the sun. The same dome, drawn once into a prefiltered environment map, is the scene's image-based
// light: the sky lights the shade side of every surface in its own colour, which the hemisphere light approximated.
// Given an equirectangular sky image instead, that image is the background and the environment.

const VERT = `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDir; uniform float cover; uniform float cloudScale; uniform float glow;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int k = 0; k < 5; k++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.3, 9.1); a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float t = pow(clamp(d.y, 0.0, 1.0), 0.6);
  vec3 sky = mix(horizon, zenith, t);
  float s = max(dot(d, sunDir), 0.0);
  sky += vec3(1.0, 0.95, 0.85) * (glow * pow(s, 24.0) + 0.6 * glow * pow(s, 220.0));
  if (d.y > 0.02) {
    // clouds on a plane 1.5 km up: projecting the direction onto it gives perspective, flat overhead and dense at the horizon
    vec2 p = d.xz / (d.y + 0.08) * cloudScale;
    float n = fbm(p * 0.55 + vec2(3.1, 7.7));
    float c = smoothstep(1.0 - cover, 1.0 - cover + 0.32, n);
    float lit = 0.55 + 0.45 * smoothstep(0.1, 0.9, fbm(p * 0.55 + vec2(3.1, 7.7) + sunDir.xz * 0.25)); // the sun-facing side is brighter
    vec3 cloud = mix(vec3(0.62, 0.66, 0.72), vec3(1.0, 0.99, 0.97), lit);
    float hz = smoothstep(0.02, 0.22, d.y); // clouds thin into the horizon haze
    sky = mix(sky, cloud, c * 0.92 * hz);
  }
  gl_FragColor = vec4(sky, 1.0);
}`;

function domeMaterial(atmosphere: Atmosphere, sun: Vec3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      zenith: { value: new THREE.Color(...atmosphere.zenith) },
      horizon: { value: new THREE.Color(...atmosphere.horizon) },
      sunDir: { value: new THREE.Vector3(...sun).normalize() },
      cover: { value: SKY_PHOTO.cloudCover },
      cloudScale: { value: SKY_PHOTO.cloudScale },
      glow: { value: SKY_PHOTO.sunGlow },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

export const PhotoSky: React.FC<{ atmosphere: Atmosphere; centre: Vec3; sunDirection: Vec3; image: THREE.Texture | null }> = ({ atmosphere, centre, sunDirection, image }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const horizon = useMemo(() => new THREE.Color(...atmosphere.horizon), [atmosphere]);
  const material = useMemo(() => domeMaterial(atmosphere, sunDirection), [atmosphere, sunDirection]);
  // the environment map: the dome itself (at the origin, once) or the given image, prefiltered
  const environment = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    let target: THREE.WebGLRenderTarget;
    if (image) {
      target = pmrem.fromEquirectangular(image);
    } else {
      const s = new THREE.Scene();
      s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), domeMaterial(atmosphere, sunDirection)));
      target = pmrem.fromScene(s, 0, 1, 200);
    }
    pmrem.dispose();
    return target;
  }, [gl, image, atmosphere, sunDirection]);
  useLayoutEffect(() => {
    scene.environment = environment.texture;
    scene.environmentIntensity = SKY_PHOTO.environmentIntensity;
    return () => {
      scene.environment = null;
      scene.environmentIntensity = 1;
    };
  }, [scene, environment]);
  useEffect(
    () => () => {
      material.dispose();
      environment.dispose();
    },
    [material, environment],
  );
  return (
    <>
      <color attach="background" args={[horizon]} />
      <fogExp2 attach="fog" args={[horizon, atmosphere.fogDensity]} />
      {image ? (
        <mesh position={centre} renderOrder={-2} frustumCulled={false}>
          <sphereGeometry args={[1200, 32, 16]} />
          <meshBasicMaterial map={image} side={THREE.BackSide} depthWrite={false} fog={false} />
        </mesh>
      ) : (
        <mesh position={centre} material={material} renderOrder={-2} frustumCulled={false}>
          <sphereGeometry args={[1200, 48, 24]} />
        </mesh>
      )}
    </>
  );
};
