// Photoreal layer: the terrain with surface detail by land cover and slope (docs/adr/0054-photoreal-layer.md).
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { LandCover, MeshArrays } from "../../three-core/types";
import type { PhotoTextures } from "./assetRoles";

// A MeshStandardMaterial whose colour and normal come from four planar-mapped texture sets, blended per fragment: grass,
// heath, woodland floor and rock, weighted by the land cover at the vertices (one-hot weights the rasteriser interpolates,
// so a boundary is a soft edge) and by the slope (steep ground turns to rock). Two tile scales break the repetition;
// the land cover's shaded vertex colour (ADR 31) still tints the result, and beyond about 600 m the detail fades back to
// that colour, where fog and distance would hide it anyway. Lighting, shadows, fog and the environment stay three's.
// The land cover is an input, as it is for the vertex colours (ADR 10): nothing here invents ground that the data lacks.

const WEIGHT_OF: [RegExp, number][] = [
  [/quarry|rock|scree|slate|bare/, 3],
  [/wood|forest/, 2],
  [/heath|scrub|moor|bracken/, 1],
];
/** One-hot splat weights per DEM node from the legend: grass is the rest (farmland, "other", built-up, water). */
export function splatWeights(land: LandCover): Float32Array {
  const perClass = land.legend.map((name) => WEIGHT_OF.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? 0);
  const out = new Float32Array(land.classes.length * 4);
  for (let i = 0; i < land.classes.length; i++) out[4 * i + perClass[land.classes[i]]] = 1;
  return out;
}

const DECLS = `
uniform sampler2D tGrass, tGrassN, tHeath, tHeathN, tWood, tWoodN, tRock, tRockN;
uniform vec4 uTiles;        // texels per world unit for grass, heath, wood, rock (world unit = 10 m)
uniform float uDetailFade;  // world units beyond which the detail fades out
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec4 vSplat;
vec3 splatSample(sampler2D t, vec2 p, float tile) {
  // two scales, the coarse one rotated, so the tiling does not read as a grid
  vec2 a = p * tile;
  vec2 b = (mat2(0.8, -0.6, 0.6, 0.8) * p) * tile * 0.17;
  return mix(texture2D(t, a).rgb, texture2D(t, b).rgb, 0.4);
}
`;

const COLOUR = `
vec2 p = vWPos.xz;
float slope = 1.0 - clamp(normalize(vWNormal).y, 0.0, 1.0);
float rockBySlope = smoothstep(0.42, 0.62, slope); // from about 25° to 38°
vec4 w = vSplat;
w.w = max(w.w, rockBySlope);
w /= max(1e-4, w.x + w.y + w.z + w.w);
vec3 albedo = splatSample(tGrass, p, uTiles.x) * w.x + splatSample(tHeath, p, uTiles.y) * w.y + splatSample(tWood, p, uTiles.z) * w.z + splatSample(tRock, p, uTiles.w) * w.w;
// the land cover's shaded colour (linear) tints the detail: its hue at full strength, its luma at half strength,
// so grass greens the photograph, woodland floor darkens it and heath turns it olive, while the texture keeps its detail
float luma = max(1e-3, dot(vColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
vec3 tint = (vColor.rgb / luma) * clamp(sqrt(luma / 0.2), 0.6, 1.2);
albedo *= mix(vec3(1.0), tint, 0.6);
float dist = length(vWPos - cameraPosition);
float fade = smoothstep(uDetailFade * 0.6, uDetailFade, dist);
diffuseColor.rgb = mix(albedo, vColor.rgb * 1.1, fade);
`;

const NORMAL = `
vec3 nG = splatSample(tGrassN, p, uTiles.x) * w.x + splatSample(tHeathN, p, uTiles.y) * w.y + splatSample(tWoodN, p, uTiles.z) * w.z + splatSample(tRockN, p, uTiles.w) * w.w;
vec3 nTS = nG * 2.0 - 1.0;
vec3 gN = normalize(vWNormal);
// the maps are projected on the ground plane: x and z perturb the world normal, more on steep rock, less at distance
vec3 pert = normalize(gN + vec3(nTS.x, 0.0, nTS.y) * (0.9 + 0.6 * rockBySlope) * (1.0 - fade));
normal = normalize((viewMatrix * vec4(pert, 0.0)).xyz);
`;

export const TerrainPhotoView: React.FC<{ mesh: MeshArrays; land: LandCover; textures: PhotoTextures; detailFadeM?: number }> = ({ mesh, land, textures, detailFadeM = 600 }) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    if (mesh.colors) g.setAttribute("color", new THREE.BufferAttribute(mesh.colors.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)), 3));
    g.setAttribute("splat", new THREE.BufferAttribute(splatWeights(land), 4));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [mesh, land]);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    const t = textures;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        tGrass: { value: t.grass.map },
        tGrassN: { value: t.grass.normalMap },
        tHeath: { value: t.heath.map },
        tHeathN: { value: t.heath.normalMap },
        tWood: { value: t.woodFloor.map },
        tWoodN: { value: t.woodFloor.normalMap },
        tRock: { value: t.rock.map },
        tRockN: { value: t.rock.normalMap },
        uTiles: { value: new THREE.Vector4(10 / t.grass.tileM, 10 / t.heath.tileM, 10 / t.woodFloor.tileM, 10 / t.rock.tileM) },
        uDetailFade: { value: detailFadeM / 10 },
      });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 splat;\nvarying vec3 vWPos;\nvarying vec3 vWNormal;\nvarying vec4 vSplat;")
        .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);\nvSplat = splat;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\n" + DECLS)
        .replace("#include <map_fragment>", COLOUR)
        .replace("#include <color_fragment>", "") // the vertex colour is applied as a tint above, not as a multiplier
        .replace("#include <normal_fragment_maps>", NORMAL);
    };
    m.customProgramCacheKey = () => "terrain-splat-v1";
    return m;
  }, [textures, detailFadeM]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} receiveShadow />;
};
