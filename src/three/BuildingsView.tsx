// Buildings and landmarks as merged meshes with shared materials (docs/adr/0050-merged-buildings-and-procedural-landmarks.md).
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BuildingGroup } from "../three-core/buildings";
import { maskColour, type Mask } from "./mask";

// One mesh per look: existing buildings (landmarks included) in stone and slate, and approved or demolished ones
// translucent in a colour no existing building uses (spec BL10, BL14). At most 2 draw calls per section.

/** Stone walls and slate roofs, as the valley's buildings are; amber only for approved or demolished ones. */
export const BUILDING_COLOURS = { wall: "#a8a296", roof: "#4e535a", translucent: "#e2a640" } as const;

function useGroupGeometry(g: BuildingGroup): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(g.positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(g.normals, 3));
    const [wall, roof] = [new THREE.Color(BUILDING_COLOURS.wall), new THREE.Color(BUILDING_COLOURS.roof)];
    const colours = new Float32Array(g.positions.length);
    for (let i = 0; i < g.normals.length / 3; i++) {
      const c = g.normals[3 * i + 1] > 0.3 ? roof : wall; // faces that look up are roofs
      colours.set([c.r, c.g, c.b], 3 * i);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
    return geo;
  }, [g]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

const Group: React.FC<{ group: BuildingGroup; mask?: Mask; cls?: "buildings" | "landmarks" }> = ({ group, mask, cls = "buildings" }) => {
  const geometry = useGroupGeometry(group);
  const mc = maskColour(mask, cls);
  if (mc) {
    // under the landmark mask the merged groups sit a little behind, so the landmark's own faces win where they coincide
    const back = mask === "landmarks" && cls === "buildings";
    return (
      <mesh geometry={geometry}>
        <meshBasicMaterial color={mc} polygonOffset={back} polygonOffsetFactor={back ? 1 : 0} polygonOffsetUnits={back ? 1 : 0} />
      </mesh>
    );
  }
  if (group.kind === "translucent") {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial color={BUILDING_COLOURS.translucent} roughness={0.9} metalness={0} transparent opacity={0.45} depthWrite={false} />
      </mesh>
    );
  }
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0} />
    </mesh>
  );
};

export const BuildingsView: React.FC<{ groups: BuildingGroup[]; landmarkGroups?: BuildingGroup[]; mask?: Mask }> = ({ groups, landmarkGroups = [], mask }) => (
  <>
    {groups.map((g) => (
      <Group key={g.kind} group={g} mask={mask} />
    ))}
    {mask === "landmarks"
      ? landmarkGroups.map((g) => (
          <Group key={`landmark-${g.kind}`} group={g} mask={mask} cls="landmarks" />
        ))
      : null}
  </>
);
