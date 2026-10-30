// Photoreal layer: post-processing as the one render-priority subscriber (docs/adr/0055-post-processing-takeover.md).
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
import { POST } from "../../three-core/photoLook";
import { mulberry32 } from "../../three-core/rng";

// Under <ThreeCanvas> the frame loop is "never" and ThreeCanvas calls advance() once per Remotion frame. A useFrame
// subscriber with a positive priority takes that one render into its own hands (react-three-fiber's loop skips its own
// gl.render when any subscriber has a priority), so the composer runs exactly once per frame: deterministic, no clock,
// no second loop. This is the only file allowed to call useFrame (static test RN1 as amended by ADR 55).
// Passes: the scene into a half-float multisampled target, ground-truth ambient occlusion, a mild grade, then AgX tone
// mapping and the sRGB output. With diagnostics the renderer's counts for the whole frame (every pass) are logged
// once, as Diagnostics does for the concept look, with the scene pass's own counts (shadow map included, as the concept
// look's are) beside them: the spec's budget (RN6, RL24) was written for that one pass (ADR 60).

/** GTAO whose normal and depth pass skips objects flagged `userData.noAO`: the alpha-cut tree cards, which the override
 * material would render as solid slabs (the pass cannot read a material's alpha test), leaving card-shaped halos; and
 * whose denoise noise comes from a seeded draw. three's own `_generateNoise` builds a `SimplexNoise` on `Math.random`,
 * which made the same frame differ by a level or two between renders (RN2). */
class SceneAwareGTAOPass extends GTAOPass {
  _generateNoise(size = 64): THREE.DataTexture {
    const simplex = new SimplexNoise({ random: mulberry32(20261029) });
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const k = (i * size + j) * 4;
        data[k] = (simplex.noise(i, j) * 0.5 + 0.5) * 255;
        data[k + 1] = (simplex.noise(i + size, j) * 0.5 + 0.5) * 255;
        data[k + 2] = (simplex.noise(i, j + size) * 0.5 + 0.5) * 255;
        data[k + 3] = (simplex.noise(i + size, j + size) * 0.5 + 0.5) * 255;
      }
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }

  _renderOverride(renderer: THREE.WebGLRenderer, overrideMaterial: THREE.Material, renderTarget: THREE.WebGLRenderTarget, clearColor: number, clearAlpha: number): void {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (o.userData.noAO && o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    });
    (GTAOPass.prototype as unknown as { _renderOverride: (r: THREE.WebGLRenderer, m: THREE.Material, t: THREE.WebGLRenderTarget, c: number, a: number) => void })._renderOverride.call(this, renderer, overrideMaterial, renderTarget, clearColor, clearAlpha);
    for (const o of hidden) o.visible = true;
  }
}

/** The scene pass, remembering the renderer's counts once it has drawn (the frame's counters were reset just before). */
class CountingRenderPass extends RenderPass {
  counted = { calls: 0, triangles: 0 };

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean): void {
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    this.counted = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  }
}

const GRADE = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, vignette: { value: POST.vignette }, saturation: { value: POST.saturation } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette; uniform float saturation; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = mix(vec3(l), c.rgb, saturation);
  float d = distance(vUv, vec2(0.5));
  c.rgb *= 1.0 - vignette * smoothstep(0.45, 0.95, d);
  gl_FragColor = c;
}`,
};

export const PostFX: React.FC<{ width: number; height: number; ve: number; diagnostics?: boolean }> = ({ width, height, ve, diagnostics = false }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const composer = useMemo(() => {
    // set while rendering, as CameraRig sets the camera (ADR 17): the very first advance() already uses them
    gl.toneMapping = THREE.AgXToneMapping;
    gl.toneMappingExposure = POST.exposure;
    gl.info.autoReset = false;
    const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, target);
    c.setPixelRatio(1);
    c.setSize(width, height);
    const scenePass = new CountingRenderPass(scene, camera);
    c.addPass(scenePass);
    const ao = new SceneAwareGTAOPass(scene, camera, width, height);
    ao.output = GTAOPass.OUTPUT.Default;
    ao.blendIntensity = POST.aoIntensity;
    ao.updateGtaoMaterial({ radius: POST.aoRadius, distanceExponent: 1, thickness: 1, scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
    c.addPass(ao);
    c.addPass(new ShaderPass(GRADE));
    c.addPass(new OutputPass());
    return { c, scenePass };
  }, [gl, scene, camera, width, height]);
  useEffect(
    () => () => {
      composer.c.dispose();
      gl.toneMapping = THREE.NoToneMapping;
      gl.toneMappingExposure = 1;
      gl.info.autoReset = true;
    },
    [composer, gl],
  );
  useFrame(() => {
    gl.info.reset();
    composer.c.render();
    if (diagnostics) {
      const { calls, triangles } = gl.info.render;
      console.log(`THREE_STATS ${JSON.stringify({ calls, triangles, ve, scenePass: composer.scenePass.counted })}`);
    }
  }, 1);
  return null;
};
