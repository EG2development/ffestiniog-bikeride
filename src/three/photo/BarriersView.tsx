// Photoreal layer: walls, hedges and fences from OSM barrier ways (docs/adr/0058-walls-and-hedges-from-osm.md).
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BarrierKind, BarrierMeshes } from "../../three-core/barriers";
import { BARRIER_COLOURS } from "../../three-core/photoLook";
import type { MeshArrays } from "../../three-core/types";
import type { Mask } from "../mask";

// One mesh per kind, three draw calls at most. The core gives each face its own vertices and UVs (u along the line in
// 2 m units, v up the face), so a stone or leaf texture tiles along a wall without stretching; until a registered
// texture lands the kinds carry flat colours. Under a measurement mask every barrier is black.

function useBarrierGeometry(mesh: MeshArrays): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    if (mesh.uvs) g.setAttribute("uv", new THREE.BufferAttribute(mesh.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The share of a hedge's own colour it shows on every side, like the trees' fill. */
const HEDGE_FILL = 0.18;

const Kind: React.FC<{ kind: BarrierKind; mesh: MeshArrays; mask?: Mask; textures?: BarrierTextures }> = ({ kind, mesh, mask, textures }) => {
  const geometry = useBarrierGeometry(mesh);
  if (mesh.positions.length === 0) return null;
  const tex = textures?.[kind];
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      {mask ? (
        <meshBasicMaterial color="#000000" />
      ) : tex ? (
        // a hedge is foliage, lit through by the sky on its shade side, as the card trees are (spec CL2)
        <meshStandardMaterial map={tex.map} normalMap={tex.normalMap ?? null} roughness={1} metalness={0} {...(kind === "hedge" && { emissive: "#ffffff", emissiveMap: tex.map, emissiveIntensity: HEDGE_FILL })} />
      ) : (
        <meshStandardMaterial color={BARRIER_COLOURS[kind]} roughness={1} metalness={0} />
      )}
    </mesh>
  );
};

/** Optional textured materials per kind, loaded outside the canvas and passed in as props (ADR 4). */
export type BarrierTextures = Partial<Record<BarrierKind, { map: THREE.Texture; normalMap?: THREE.Texture }>>;

export const BarriersView: React.FC<{ meshes: BarrierMeshes; mask?: Mask; textures?: BarrierTextures }> = ({ meshes, mask, textures }) => (
  <>
    {(["wall", "hedge", "fence"] as const).map((k) => (
      <Kind key={k} kind={k} mesh={meshes[k]} mask={mask} textures={textures} />
    ))}
  </>
);
