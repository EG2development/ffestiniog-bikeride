import { describe, expect, it } from "vitest";
import { followStartFrame, SECTIONS, buildSectionScene, type SectionScene } from "../../src/three-core/sections";
import { CROWN_SHAPES } from "../../src/three-core/trees";
import { validateFeatures, type OsmLine } from "../../src/three-core/registers";
import type { TrailProfile } from "../../src/three-core/trail";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { readJson, readProjectFile, realRoute } from "./fixtures";

// Trees never hide the rider in any ground shot that frames them, drone-side or follow (spec CL5 as amended
// at t6; ADR 47; pseudocode-reel-v2 §4.5). Checked on the real sections against the crowns TreesView draws,
// per unit of instance scale (world units): a conifer cone (base r 0.28 at y 0.275, apex at y 1.425) as three
// spheres following its taper, and a broadleaf icosahedron (r 0.42, squashed to 0.85) as one sphere.
type V3 = [number, number, number];
// The crowns as TreesView draws them (CROWN_SHAPES, per unit of instance scale): the conifer as its cone exactly (the
// drawn 7-sided cone sits inside it), the broadleaf as the ellipsoid round its icosahedron. Independent of the spheres
// tree placement uses, so this test can catch them falling short (t10 H1).
function crownHit(a: V3, b: V3, t: { x: number; y: number; z: number; scale: number }, kind: "conifer" | "broadleaf"): boolean {
  // sample only where the segment crosses the tree's bounding sphere (centre 0.85, radius 0.75 per unit scale), densely
  const c: V3 = [t.x, t.y + 0.85 * t.scale, t.z];
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const f: V3 = [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
  const A = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  const B = 2 * (f[0] * d[0] + f[1] * d[1] + f[2] * d[2]);
  const C = f[0] ** 2 + f[1] ** 2 + f[2] ** 2 - (0.75 * t.scale) ** 2;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return false;
  const [u0, u1] = [Math.max(0, (-B - Math.sqrt(disc)) / (2 * A)), Math.min(1, (-B + Math.sqrt(disc)) / (2 * A))];
  const steps = 300; // over at most 1.5 units of path: ≤ 0.005 units (5 cm) apart
  for (let i = 0; i <= steps && u0 <= u1; i++) {
    const u = u0 + ((u1 - u0) * i) / steps;
    const p: V3 = [a[0] + (b[0] - a[0]) * u - t.x, (a[1] + (b[1] - a[1]) * u - t.y) / t.scale, a[2] + (b[2] - a[2]) * u - t.z];
    const d = Math.hypot(p[0], p[2]) / t.scale;
    if (kind === "conifer") {
      const { baseY, apexY, radius } = CROWN_SHAPES.conifer;
      if (p[1] >= baseY && p[1] <= apexY && d <= (radius * (apexY - p[1])) / (apexY - baseY)) return true;
    } else {
      const { centreY, radius, yScale } = CROWN_SHAPES.broadleaf;
      if ((d / radius) ** 2 + ((p[1] - centreY) / (radius * yScale)) ** 2 <= 1) return true;
    }
  }
  return false;
}

/** Does the segment a→b pass within r of c? (a coarse prefilter on the tree's bounding sphere) */
function inputs(id: string) {
  const w = `public/data/sections/${id}`;
  const header = readJson<DemGrid & { file: string; sourceFile: string }>(`${w}/dem.json`);
  const buf = readProjectFile(`${w}/${header.file}`);
  const dem: DemGrid = { ...header, heights: new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), sourceIndex: new Uint8Array(readProjectFile(`${w}/${header.sourceFile}`)) };
  const landMeta = readJson<{ legend: string[]; file: string }>(`${w}/landcover.json`);
  return {
    route: realRoute(),
    dem,
    land: { legend: landMeta.legend, classes: new Uint8Array(readProjectFile(`${w}/${landMeta.file}`)) } as LandCover,
    profile: readJson<TrailProfile>(`${w}/trail-profile.json`),
    osm: readJson<{ features: OsmLine[] }>(`${w}/osm.geojson`).features,
    features: [...validateFeatures(readJson<unknown>("data/features-3d.json")), ...validateFeatures(readJson<unknown>(`data/features-${id}.json`))],
  };
}

/** Does the segment a→b pass within r of c? */
function hits(a: V3, b: V3, c: V3, r: number): boolean {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * d[0] + (c[1] - a[1]) * d[1] + (c[2] - a[2]) * d[2]) / len2));
  const p = [a[0] + t * d[0] - c[0], a[1] + t * d[1] - c[1], a[2] + t * d[2] - c[2]];
  return p[0] * p[0] + p[1] * p[1] + p[2] * p[2] < r * r;
}

describe("trees do not hide the rider (CL5, real sections)", () => {
  for (const id of ["blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"]) {
    it(`${id}: no frame of a ground shot has a tree crown between the camera and the rider`, () => {
      const cfg = SECTIONS[id];
      const scene = buildSectionScene(cfg, inputs(id) as Parameters<typeof buildSectionScene>[1]) as SectionScene;
      const trees = (["conifer", "broadleaf"] as const).flatMap((k) => scene.trees[k].map((t) => ({ t, k, c: [t.x, t.y + 0.85 * t.scale, t.z] as V3, r: 0.75 * t.scale })));
      const blocked = { drone: 0, follow: 0 };
      const start = followStartFrame(cfg);
      for (let f = 0; f < cfg.frames; f++) {
        const cam = scene.shot(f).position as V3;
        const rider = scene.riderAt(f);
        const target: V3 = [rider[0], rider[1] + 0.1, rider[2]]; // the rider's centre, 1 m up
        const [x0, x1] = [Math.min(cam[0], target[0]) - 2, Math.max(cam[0], target[0]) + 2];
        const [z0, z1] = [Math.min(cam[2], target[2]) - 2, Math.max(cam[2], target[2]) + 2];
        if (trees.some((s) => s.c[0] > x0 && s.c[0] < x1 && s.c[2] > z0 && s.c[2] < z1 && hits(cam, target, s.c, s.r) && crownHit(cam, target, s.t, s.k))) blocked[f < start ? "drone" : "follow"]++;
      }
      expect(blocked, `${id}: frames where a crown crosses the camera-to-rider line (drone-side frames 0–${start - 1}, follow ${start}–${cfg.frames - 1})`).toEqual({ drone: 0, follow: 0 });
    }, 120_000);
  }
});
