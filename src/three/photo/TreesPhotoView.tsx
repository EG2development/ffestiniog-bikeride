// Photoreal layer: card trees with volume normals (docs/adr/0054-photoreal-layer.md), in the concept trees' envelopes.
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mulberry32 } from "../../three-core/rng";
import { CROWN_SHAPES, type TreeInstance, type TreePlacement } from "../../three-core/trees";

// Each tree is a tapered trunk and a set of alpha-tested cards carrying a drawn sprite: a needled branch for a conifer,
// a leaf cluster for a broadleaf. The cards' normals point out from the crown's centre rather than across the card, so
// the sun lights the crown as a volume and the shade side falls off smoothly; that is what makes a card tree read as a
// tree rather than as a cut-out. Three variants per kind, each an instanced trunk mesh and an instanced card mesh: twelve
// draw calls for every tree in the window. The sprites are drawn once on a 2D canvas from a seeded draw (no clock, no
// unseeded randomness), so every render gets the same texture. The crowns stay inside CROWN_SHAPES, so the placer's
// sight-line and building rules (ADRs 47, 49) still hold for what is drawn.

type Kind = "conifer" | "broadleaf";
const VARIANTS = 3;
/** The cards are alpha-cut sprites: the ambient-occlusion pass skips them (PostFX), or they would occlude as slabs. */
const NO_AO = { noAO: true };
const TRUNK = { conifer: "#4a3a2a", broadleaf: "#5a4a3a" };

type Sprite = "conifer" | "tier" | "broadleaf";

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Canvas-drawn sprites from a seeded draw: a whole conifer silhouette (upright cards), a radial branch star (the
 * horizontal tier discs an aerial view sees) and a broadleaf leaf cluster. Alpha is clear outside what is drawn. */
function sprite(kind: Sprite): THREE.CanvasTexture {
  const w = 256;
  const h = kind === "conifer" ? 512 : 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(kind === "conifer" ? 41 : kind === "tier" ? 47 : 43);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  const green = (k: number) => `rgb(${28 + Math.floor(k * 22)}, ${58 + Math.floor(k * 46)}, ${26 + Math.floor(k * 20)})`;
  if (kind === "conifer") {
    // layered branches down a cone, each a dark filled fan with lighter needle strokes along its underside
    ctx.strokeStyle = "#3a2c20";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(128, 8);
    ctx.lineTo(128, 508);
    ctx.stroke();
    const tiers = 15;
    for (let i = 0; i < tiers; i++) {
      const y = 14 + i * 33;
      const hw = 8 + (i / (tiers - 1)) * 118;
      const drop = 22 + i * 1.2;
      ctx.fillStyle = green(0.15 + rand() * 0.25);
      ctx.beginPath();
      ctx.moveTo(128, y);
      ctx.lineTo(128 - hw, y + drop);
      ctx.lineTo(128, y + drop * 0.45);
      ctx.lineTo(128 + hw, y + drop);
      ctx.closePath();
      ctx.fill();
      for (let k = 0; k < 70; k++) {
        const side = rand() < 0.5 ? -1 : 1;
        const t = rand();
        const x = 128 + side * hw * t;
        const yy = y + drop * (0.3 + 0.7 * t) + (rand() - 0.5) * 6;
        ctx.strokeStyle = green(0.45 + rand() * 0.55);
        ctx.lineWidth = 1.6 + rand() * 1.6;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + side * (3 + rand() * 7), yy + 6 + rand() * 12);
        ctx.stroke();
      }
    }
  } else if (kind === "tier") {
    // a star of branches seen from above, needles fringing each
    for (let b = 0; b < 9; b++) {
      const a = (b * Math.PI * 2) / 9 + rand() * 0.3;
      const len = 96 + rand() * 24;
      ctx.strokeStyle = "#3a2c20";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(128 + Math.cos(a) * len, 128 + Math.sin(a) * len);
      ctx.stroke();
      for (let k = 0; k < 90; k++) {
        const t = rand();
        const x = 128 + Math.cos(a) * len * t;
        const y = 128 + Math.sin(a) * len * t;
        const na = a + (rand() < 0.5 ? -1 : 1) * (0.9 + rand() * 0.6);
        const nl = 8 + (1 - t) * 14 + rand() * 6;
        ctx.strokeStyle = green(0.2 + rand() * 0.7);
        ctx.lineWidth = 2 + rand() * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(na) * nl, y + Math.sin(na) * nl);
        ctx.stroke();
      }
    }
  } else {
    // overlapping leaf blobs, dense in the middle and thinning to the edge, three greens
    for (let i = 0; i < 320; i++) {
      const r = Math.pow(rand(), 0.7) * 118;
      const a = rand() * Math.PI * 2;
      const x = 128 + Math.cos(a) * r;
      const y = 128 + Math.sin(a) * r * 1.05;
      const s = 9 + rand() * 13;
      const shade = rand();
      ctx.fillStyle = shade < 0.35 ? "#3b5a2a" : shade < 0.75 ? "#4f7634" : "#678c3e";
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * (0.6 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTexture(canvas);
}

/** A quad of width w and height h centred at c, facing direction `face` (unit, horizontal), tilted by `tilt` about its
 * base; its normals point from `centre` outward, so the crown lights as a volume. Returns positions, normals, uvs. */
function card(c: THREE.Vector3, face: THREE.Vector3, w: number, h: number, tilt: number, centre: THREE.Vector3, out: { p: number[]; n: number[]; uv: number[]; i: number[] }, radial: boolean) {
  const up = new THREE.Vector3(0, 1, 0);
  const right = radial ? face.clone() : new THREE.Vector3().crossVectors(up, face).normalize();
  const vertical = radial ? new THREE.Vector3().crossVectors(face, up).normalize().multiplyScalar(0).add(up) : up.clone();
  // a radial card runs outward from the trunk (u along `face`) and droops by `tilt`; a facing card stands upright
  const corners: THREE.Vector3[] = [];
  if (radial) {
    const droop = new THREE.Vector3(0, -Math.sin(tilt), 0);
    const along = face.clone().multiplyScalar(Math.cos(tilt));
    const side = new THREE.Vector3().crossVectors(up, face).normalize();
    corners.push(c.clone().addScaledVector(side, -h / 2), c.clone().addScaledVector(side, h / 2), c.clone().addScaledVector(side, h / 2).addScaledVector(along, w).addScaledVector(droop, w), c.clone().addScaledVector(side, -h / 2).addScaledVector(along, w).addScaledVector(droop, w));
  } else {
    corners.push(c.clone().addScaledVector(right, -w / 2).addScaledVector(vertical, -h / 2), c.clone().addScaledVector(right, w / 2).addScaledVector(vertical, -h / 2), c.clone().addScaledVector(right, w / 2).addScaledVector(vertical, h / 2), c.clone().addScaledVector(right, -w / 2).addScaledVector(vertical, h / 2));
  }
  const base = out.p.length / 3;
  const uvs = radial ? [0, 0, 0, 1, 1, 1, 1, 0] : [0, 0, 1, 0, 1, 1, 0, 1];
  corners.forEach((v, k) => {
    out.p.push(v.x, v.y, v.z);
    const n = v.clone().sub(centre);
    n.y += 0.15; // a little up, so the top of the crown takes the sky
    n.normalize();
    out.n.push(n.x, n.y, n.z);
    out.uv.push(uvs[2 * k], uvs[2 * k + 1]);
  });
  out.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/** A horizontal quad (a tier disc) of half-width r at height y, normals up. */
function disc(y: number, r: number, turn: number, out: { p: number[]; n: number[]; uv: number[]; i: number[] }) {
  const base = out.p.length / 3;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const corners = [
    [-r, -r],
    [r, -r],
    [r, r],
    [-r, r],
  ];
  corners.forEach(([x, z], k) => {
    out.p.push(x * c - z * s, y, x * s + z * c);
    out.n.push(0, 1, 0);
    out.uv.push([0, 1, 1, 0][k], [0, 0, 1, 1][k]);
  });
  out.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
}

/** Trunk, upright cards and tier discs for one variant of a kind, per unit of instance scale (world units: 1 = 10 m). */
function treeGeometry(kind: Kind, variant: number): { trunk: THREE.BufferGeometry; cards: THREE.BufferGeometry; discs: THREE.BufferGeometry | null } {
  const rand = mulberry32(1000 + variant * 17 + (kind === "conifer" ? 0 : 5));
  const out = { p: [] as number[], n: [] as number[], uv: [] as number[], i: [] as number[] };
  const tiers = { p: [] as number[], n: [] as number[], uv: [] as number[], i: [] as number[] };
  let trunk: THREE.BufferGeometry;
  if (kind === "conifer") {
    const { baseY, apexY, radius } = CROWN_SHAPES.conifer;
    trunk = new THREE.CylinderGeometry(0.006, 0.024, baseY + 0.3, 6).translate(0, (baseY + 0.3) / 2, 0);
    const centre = new THREE.Vector3(0, (baseY + apexY) / 2, 0);
    // three crossed full-height silhouette cards, turned a little per variant
    const a0 = (variant * Math.PI) / 9;
    for (let k = 0; k < 3; k++) {
      const a = a0 + (k * Math.PI) / 3;
      card(new THREE.Vector3(0, (baseY + apexY) / 2 - 0.02, 0), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), radius * 2.05, apexY - baseY + 0.08, 0, centre, out, false);
    }
    // five tier discs for the view from above, each the cone's radius at its height
    for (let t = 0; t < 5; t++) {
      const y = baseY + 0.08 + ((apexY - 0.3 - baseY) * t) / 4;
      const r = (radius * (apexY - y)) / (apexY - baseY);
      disc(y, Math.max(0.05, r * 1.05), rand() * Math.PI, tiers);
    }
  } else {
    const { centreY, radius, yScale } = CROWN_SHAPES.broadleaf;
    const centre = new THREE.Vector3(0, centreY, 0);
    trunk = new THREE.CylinderGeometry(0.012, 0.026, centreY, 6).translate(0, centreY / 2, 0);
    const n = 10 + variant * 2;
    for (let k = 0; k < n; k++) {
      // a point in the crown ellipsoid, biased outward, with a card facing away from the centre
      const u = rand() * Math.PI * 2;
      const v = Math.acos(2 * rand() - 1);
      const rr = 0.35 + 0.35 * rand();
      const d = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v) * yScale, Math.sin(v) * Math.sin(u));
      const c = centre.clone().addScaledVector(d, radius * rr * 0.9);
      const face = new THREE.Vector3(d.x, 0, d.z).normalize();
      if (face.lengthSq() < 1e-6) face.set(1, 0, 0);
      card(c, face, radius * (0.9 + rand() * 0.5), radius * (0.8 + rand() * 0.4), 0, centre, out, false);
    }
    // three upright cards through the middle for density when seen from any side
    for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) card(centre.clone(), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), radius * 1.9, radius * yScale * 1.9, 0, centre, out, false);
  }
  const toGeometry = (o: typeof out) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(o.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(o.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(o.uv, 2));
    g.setIndex(o.i);
    return g;
  };
  return { trunk, cards: toGeometry(out), discs: tiers.p.length > 0 ? toGeometry(tiers) : null };
}

type Sprites = Record<Sprite, THREE.Texture>;

const Group: React.FC<{ kind: Kind; variant: number; trees: TreeInstance[]; sprites: Sprites }> = ({ kind, variant, trees, sprites }) => {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const cardsRef = useRef<THREE.InstancedMesh>(null);
  const discsRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => treeGeometry(kind, variant), [kind, variant]);
  useEffect(
    () => () => {
      geometry.trunk.dispose();
      geometry.cards.dispose();
      geometry.discs?.dispose();
    },
    [geometry],
  );
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const colour = new THREE.Color();
    for (const mesh of [trunkRef.current, cardsRef.current, discsRef.current]) {
      if (!mesh) continue;
      trees.forEach((t, i) => {
        q.setFromAxisAngle(up, t.yaw);
        m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.scale, t.scale, t.scale));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, colour.setScalar(t.tint ?? 1));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [trees]);
  if (trees.length === 0) return null;
  return (
    <>
      <instancedMesh ref={trunkRef} args={[geometry.trunk, undefined, trees.length]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial color={TRUNK[kind]} roughness={0.95} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={cardsRef} args={[geometry.cards, undefined, trees.length]} castShadow receiveShadow frustumCulled={false} userData={NO_AO}>
        <meshStandardMaterial map={sprites[kind]} alphaTest={0.5} side={THREE.DoubleSide} roughness={0.9} metalness={0} />
      </instancedMesh>
      {geometry.discs ? (
        <instancedMesh ref={discsRef} args={[geometry.discs, undefined, trees.length]} castShadow receiveShadow frustumCulled={false} userData={NO_AO}>
          <meshStandardMaterial map={sprites.tier} alphaTest={0.5} side={THREE.DoubleSide} roughness={0.9} metalness={0} />
        </instancedMesh>
      ) : null}
    </>
  );
};

export const TreesPhotoView: React.FC<{ trees: TreePlacement }> = ({ trees }) => {
  const sprites = useMemo<Sprites>(() => ({ conifer: sprite("conifer"), tier: sprite("tier"), broadleaf: sprite("broadleaf") }), []);
  useEffect(
    () => () => {
      for (const t of Object.values(sprites)) t.dispose();
    },
    [sprites],
  );
  const groups = useMemo(() => {
    const out: { kind: Kind; variant: number; trees: TreeInstance[] }[] = [];
    for (const kind of ["conifer", "broadleaf"] as const) for (let v = 0; v < VARIANTS; v++) out.push({ kind, variant: v, trees: trees[kind].filter((t) => (t.variant ?? 0) % VARIANTS === v) });
    return out;
  }, [trees]);
  return (
    <>
      {groups.map((g) => (
        <Group key={`${g.kind}-${g.variant}`} kind={g.kind} variant={g.variant} trees={g.trees} sprites={sprites} />
      ))}
    </>
  );
};
