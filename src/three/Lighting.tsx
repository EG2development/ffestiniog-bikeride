// Iteration 2: light constants live in atmosphere.ts as LIGHTING (docs/adr/0046-clarity-tuned-as-data.md).
// Reel: sky dome and exponential fog, fog colour = horizon (docs/adr/0030-sky-dome-and-fog.md).
// Photoreal layer: the `variant` picks LIGHTING_PHOTO, whose fill is mostly the sky image (docs/adr/0054-photoreal-layer.md);
// `shadow` tightens the map in the close shots (SHADOW_PHOTO_CLOSE).
import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Vec3 } from "../three-core/types";
import { LIGHTING, LIGHTING_PHOTO, type SectionKind } from "../three-core/atmosphere";
import type { Mask } from "./mask";

/** The shadow map's extent around the focus and its biases; the reel's values when not given (spec RL12). */
export type ShadowSetup = { rangeM: number; normalBias: number; bias: number };
export const REEL_SHADOW: ShadowSetup = { rangeM: 300, normalBias: 0.02, bias: -0.0002 };

// Fixed sun and hemisphere fill; no HDRI (docs/adr/0018-fixed-lighting.md). The sky dome owns the
// background and the fog (ADR 30). The shadow camera follows the focus so the 2048² map covers `rangeM` around it.
export const Lighting: React.FC<{ sunDirection: Vec3; focus: Vec3; kind: SectionKind; variant?: "concept" | "photo"; shadow?: ShadowSetup; mask?: Mask }> = ({ sunDirection, focus, kind, variant = "concept", shadow = REEL_SHADOW, mask }) => {
  const light = (variant === "photo" ? LIGHTING_PHOTO : LIGHTING)[kind];
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(...focus);
  target.updateMatrixWorld();
  const sun: Vec3 = [focus[0] + sunDirection[0] * 120, focus[1] + sunDirection[1] * 120, focus[2] + sunDirection[2] * 120];
  const half = shadow.rangeM / 2 / 10;
  const ref = useRef<THREE.DirectionalLight>(null);
  // the shadow camera's projection is rebuilt when its extent changes (at a cut between shots), not only when it is created
  useLayoutEffect(() => {
    ref.current?.shadow.camera.updateProjectionMatrix();
  }, [half]);
  return (
    <>
      {mask ? null : <hemisphereLight args={[light.hemiSky, light.hemiGround, light.hemiIntensity]} />}
      <primitive object={target} />
      <directionalLight
        ref={ref}
        position={sun}
        target={target}
        intensity={light.sunIntensity}
        color={light.sunColour}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-bias={shadow.bias}
        shadow-normalBias={shadow.normalBias}
      />
    </>
  );
};
