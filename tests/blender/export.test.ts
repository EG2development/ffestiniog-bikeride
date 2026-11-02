import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { blenderFrame, dirToBlender, fromBlender, METRES_PER_UNIT, positionsToBlender, toBlender, yawToBlender, type Origin } from "../../src/blender/coords";
import { exportSection, type Manifest } from "../../src/blender/exportSection";
import { sectionPaths } from "../../src/blender/loadSection";
import { cyclistPose, poseAxes } from "../../src/three-core/cyclistMotion";
import type { Vec3 } from "../../src/three-core/types";
import { walkerPose } from "../../src/three-core/walkers";
import { ROOT } from "../three-core/fixtures";

// The Blender transfer (docs/blender-build-plan.md §3, Phase 2): the coordinate contract, and a package exported from the
// real Maentwrog prototype that must describe the source to 0.05 m (conversion fidelity, not survey accuracy).

const O: Origin = { x0: 274.62, z0: 150.13 };
const TOLERANCE_M = 0.05;
const near = (a: Vec3, b: Vec3, tol: number) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= tol;

describe("coordinate contract", () => {
  it("maps X→X, −Z→Y and Y→Z at 10 m per unit about the origin", () => {
    const b = (p: Vec3) => toBlender(p, O).map((v) => v + 0); // + 0 folds −0 into 0
    expect(b([O.x0 + 1, 2, O.z0])).toEqual([10, 0, 20]);
    expect(b([O.x0, 0, O.z0 + 3])).toEqual([0, -30, 0]);
    expect(b([O.x0, 0, O.z0])).toEqual([0, 0, 0]);
  });

  it("round-trips through the recorded inverse", () => {
    for (const p of [[274.6, 18.2, 150.1], [260.5, 21.75, 163.2], [300, 0.1, 120]] as Vec3[]) expect(near(fromBlender(toBlender(p, O), O), p, 1e-9)).toBe(true);
  });

  it("is a rotation and a uniform scale: handedness and triangle winding are kept", () => {
    const a: Vec3 = [1, 0, 0], b: Vec3 = [0, 1, 0], c: Vec3 = [0, 0, 1];
    const cross = (u: Vec3, v: Vec3): Vec3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const [A, B, C] = [a, b, c].map(dirToBlender);
    // right-handed in, right-handed out: x × y = z holds for the mapped axes
    expect(near(cross(A, B), C, 1e-12)).toBe(true);
    // and a whole mesh scales by exactly 10 about the origin
    const out = positionsToBlender([O.x0 + 1, 0, O.z0, O.x0, 1, O.z0, O.x0, 0, O.z0 - 1], O);
    expect(Array.from(out, (v) => v + 0)).toEqual([10, 0, 0, 0, 0, 10, 0, 10, 0]);
  });

  it("carries a Three.js yaw over as a rotation about Blender +Z", () => {
    for (const yaw of [0, 0.7, -2.1, 3]) {
      const three: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)]; // the model's +x turned by the yaw about +y
      const blender = dirToBlender(three);
      expect(near(blender, [Math.cos(yawToBlender(yaw)), Math.sin(yawToBlender(yaw)), 0], 1e-12)).toBe(true);
    }
  });

  it("maps source frame f to Blender frame f + 1", () => {
    expect([0, 119, 120, 359, 360, 599].map(blenderFrame)).toEqual([1, 120, 121, 360, 361, 600]);
  });

  it("uses the same data files as the React provider", async () => {
    const provider = readFileSync(resolve(ROOT, "src/data/Scene3DDataProvider.tsx"), "utf8");
    const line = provider.split("\n").find((l) => l.includes("const dir = `data/sections/${section}`"));
    expect(line, "dataPaths() still builds the section directory this way").toBeDefined();
    const p = sectionPaths("maentwrog");
    // each path as the provider's template spells it
    for (const [key, file] of Object.entries({ dem: "dem.json", land: "landcover.json", profile: "trail-profile.json", osm: "osm.geojson", buildings: "buildings.json", canopy: "canopy.json", barriers: "barriers.geojson" })) {
      expect(provider, key).toContain(`\`\${dir}/${file}\``);
      expect((p as unknown as Record<string, string>)[key]).toBe(`data/sections/maentwrog/${file}`);
    }
    expect(p.features).toEqual(["data/features-3d.json", "data/features-maentwrog.json"]);
    expect(p.waterLevels).toBe("data/water-levels.json");
  });
});

describe("the Maentwrog prototype package", () => {
  const out = mkdtempSync(join(tmpdir(), "blender-export-"));
  afterAll(() => rmSync(out, { recursive: true, force: true }));
  const first = exportSection({ root: ROOT, outRoot: join(out, "a"), sectionId: "maentwrog-photo" });
  const m: Manifest = first.manifest;
  const f32 = (file: string) => {
    const b = readFileSync(join(first.outDir, file));
    return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  };

  it("holds the prototype's 600 frames at 30 fps and its three shots, cut on the frames the plan lists", () => {
    expect(m.section).toMatchObject({ frames: 600, fps: 30, look: "photo", startDistM: 9085 });
    expect(m.camera.shots.map((s) => [s.kind, s.firstBlenderFrame, s.lastBlenderFrame])).toEqual([
      ["drone-side", 1, 120],
      ["first-person", 121, 360],
      ["follow", 361, 600],
    ]);
    expect(m.camera.verticalFovDegrees).toBe(true);
  });

  it("carries every layer of the blockout and its sidecars match the manifest's lengths", () => {
    const names = m.meshes.map((x) => x.name);
    for (const n of ["terrain", "trail", "roads", "bridge-0", "buildings-existing", "barrier-wall", "barrier-fence"]) expect(names, n).toContain(n);
    expect(m.counts.walkers).toBe(3);
    expect(m.counts.trees).toBeGreaterThan(0);
    for (const ref of m.meshes.flatMap((x) => [x.positions, x.indices, ...(x.colors ? [x.colors] : []), ...(x.uvs ? [x.uvs] : [])])) {
      expect(statSync(join(first.outDir, ref.file)).size, ref.file).toBe(ref.length * 4);
    }
    const terrain = m.meshes.find((x) => x.name === "terrain")!;
    expect(terrain.vertices).toBe(m.counts.terrainVertices);
  });

  it("records the origin, the mapping and the inputs it was made from", () => {
    expect(m.coordinates).toMatchObject({ metresPerUnit: METRES_PER_UNIT, frameOffset: 1, verticalExaggeration: 1 });
    expect(m.provenance.sources.length).toBeGreaterThan(10);
    for (const s of m.provenance.sources) expect(s.sha256, s.path).toMatch(/^[0-9a-f]{64}$/);
    expect(m.provenance.code.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(m.provenance.limitations.join(" ")).toContain("not an approved route");
  });

  it("carries ADR 18's sun as a unit vector 35° above the horizon, in Blender axes", () => {
    const [x, y, z] = m.lighting.sunDirection;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
    expect((Math.asin(z) * 180) / Math.PI).toBeCloseTo(35, 6);
    expect(m.lighting).toMatchObject({ sunAzimuthDeg: 200, sunElevationDeg: 35 });
  });

  it("lists each existing building's footprint and heights, matching the merged mesh's extent", () => {
    expect(m.buildings.length).toBeGreaterThan(0);
    expect(m.buildings.length).toBeLessThanOrEqual(m.counts.buildings);
    const mesh = f32("buildings-existing.positions.f32");
    let [lo, hi] = [Infinity, -Infinity];
    for (let i = 2; i < mesh.length; i += 3) [lo, hi] = [Math.min(lo, mesh[i]), Math.max(hi, mesh[i])];
    for (const b of m.buildings) {
      expect(b.ring.length, b.id).toBeGreaterThanOrEqual(3);
      expect(b.topZ, b.id).toBeGreaterThan(b.baseZ);
      expect(b.minEavesZ, b.id).toBeGreaterThan(b.baseZ);
      expect(b.baseZ, b.id).toBeGreaterThanOrEqual(lo - TOLERANCE_M);
      expect(Math.max(b.topZ, b.minEavesZ), b.id).toBeLessThanOrEqual(hi + TOLERANCE_M);
    }
  });

  it(`puts the trail, rider and cameras within ${TOLERANCE_M} m of the source after the mapping`, async () => {
    const { buildSectionScene, configById } = await import("../../src/three-core/sections");
    const { loadSection } = await import("../../src/blender/loadSection");
    const cfg = configById("maentwrog-photo");
    const scene = buildSectionScene(cfg, loadSection(ROOT, cfg, { canopy: true, barriers: true }).inputs, "photo");
    const o = m.coordinates.origin;

    // twelve control points along the trail: the exported ribbon must contain each centreline point's edge vertices
    const ribbon = f32("trail.positions.f32");
    let worst = 0;
    for (let k = 0; k < 12; k++) {
      const s = scene.trail.samples[Math.round((k * (scene.trail.samples.length - 1)) / 11)];
      const expected = toBlender([s.x, s.y, s.z], o);
      let best = Infinity;
      for (let i = 0; i + 2 < ribbon.length; i += 3) best = Math.min(best, Math.hypot(ribbon[i] - expected[0], ribbon[i + 1] - expected[1], ribbon[i + 2] - expected[2]));
      worst = Math.max(worst, best);
    }
    // ribbon vertices sit half a trail width (1.5 m) either side of the centre
    expect(worst).toBeLessThanOrEqual(1.5 + TOLERANCE_M);
    expect(worst).toBeGreaterThanOrEqual(1.5 - TOLERANCE_M);

    // every frame's camera and rider, against the source functions
    const camera = f32("camera.f32");
    const rider = f32("rider.f32");
    let camErr = 0, riderErr = 0, axesErr = 0;
    for (let f = 0; f < 600; f++) {
      const c = scene.shot(f);
      const p = toBlender(c.position, o);
      camErr = Math.max(camErr, Math.hypot(camera[f * 7] - p[0], camera[f * 7 + 1] - p[1], camera[f * 7 + 2] - p[2]));
      expect(camera[f * 7 + 6]).toBeCloseTo(c.fovDeg, 4);
      const pose = cyclistPose(scene.trail, scene.table, f, 30, scene.dims);
      const r = toBlender(pose.position, o);
      riderErr = Math.max(riderErr, Math.hypot(rider[f * 11] - r[0], rider[f * 11 + 1] - r[1], rider[f * 11 + 2] - r[2]));
      const { forward, up } = poseAxes(pose);
      const [bf, bu] = [dirToBlender(forward), dirToBlender(up)];
      axesErr = Math.max(axesErr, Math.hypot(rider[f * 11 + 3] - bf[0], rider[f * 11 + 4] - bf[1], rider[f * 11 + 5] - bf[2]), Math.hypot(rider[f * 11 + 6] - bu[0], rider[f * 11 + 7] - bu[1], rider[f * 11 + 8] - bu[2]));
    }
    expect(camErr).toBeLessThanOrEqual(TOLERANCE_M);
    expect(riderErr).toBeLessThanOrEqual(TOLERANCE_M);
    expect(axesErr).toBeLessThanOrEqual(1e-5);

    // a walker's samples, and the rider's own travel (the mapping is metric: path length in metres is preserved)
    const w = scene.walkers[0];
    const walker = f32("walker-0.f32");
    for (const f of [0, 150, 300, 599]) {
      const p = toBlender(walkerPose(scene.trail, w.table, f, w.spec).position, o);
      expect(near([walker[f * 5], walker[f * 5 + 1], walker[f * 5 + 2]], p, TOLERANCE_M)).toBe(true);
    }
    const dist = (a: number, b: number) => Math.hypot(rider[b * 11] - rider[a * 11], rider[b * 11 + 1] - rider[a * 11 + 1], rider[b * 11 + 2] - rider[a * 11 + 2]);
    // the chord between the first and last frame is within a few per cent of the distance the table travels
    const travelled = scene.table[599] - scene.table[0];
    expect(dist(0, 599)).toBeLessThanOrEqual(travelled + TOLERANCE_M);
    expect(dist(0, 599)).toBeGreaterThan(0.9 * travelled);
  }, 120_000);

  it("carries the window's watercourses at their widths, their surface below the terrain, and its power supports", () => {
    expect(m.waterways.length).toBeGreaterThan(5);
    expect(m.counts.waterways).toBe(m.waterways.length);
    // the terrain's own triangles under each channel point (Blender XY, Z up)
    const pos = f32("terrain.positions.f32");
    const idx = (() => {
      const b = readFileSync(join(first.outDir, "terrain.indices.u32"));
      return new Uint32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    })();
    const cells = new Map<string, number[]>();
    for (let t = 0; t < idx.length; t += 3) {
      const key = `${Math.floor(pos[3 * idx[t]] / 8)},${Math.floor(pos[3 * idx[t] + 1] / 8)}`;
      (cells.get(key) ?? cells.set(key, []).get(key)!).push(t);
    }
    const groundAt = (x: number, y: number): number | null => {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const t of cells.get(`${Math.floor(x / 8) + dx},${Math.floor(y / 8) + dy}`) ?? []) {
            const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map((i) => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]]);
            const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
            const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
            const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
            if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) return u * a[2] + v * b[2] + (1 - u - v) * c[2];
          }
        }
      }
      return null;
    };
    let checked = 0;
    for (const w of m.waterways) {
      expect(["river", "stream", "canal", "drain", "ditch"]).toContain(w.kind);
      expect(w.widthM, w.id).toBe({ river: 5, stream: 1.8, canal: 6, drain: 0.8, ditch: 0.8 }[w.kind]);
      expect(w.widthSource).toBe("default");
      for (const run of w.runs) {
        expect(run.length).toBeGreaterThanOrEqual(2);
        for (const [x, y, z] of run) {
          const g = groundAt(x, y);
          if (g === null) continue;
          expect(z, `${w.id} at ${x.toFixed(1)}, ${y.toFixed(1)}`).toBeLessThanOrEqual(g + 0.002); // mm rounding
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect(m.power.status).toBe("existing");
    expect(m.power.supports.length).toBe(m.counts.powerSupports);
    expect(m.power.supports.length).toBeGreaterThan(50);
    for (const s of m.power.supports) {
      expect(["tower", "pole"]).toContain(s.kind);
      expect(s.heightM, s.id).toBeGreaterThanOrEqual(8);
      expect(s.heightM, s.id).toBeLessThanOrEqual(46);
      expect(s.position.every(Number.isFinite)).toBe(true);
    }
    for (const l of m.power.lines) for (const i of l.supports) expect(m.power.supports[i], `${l.id} support ${i}`).toBeDefined();
    // the reservoir carries its flag for the dressed shore
    for (const w of m.water) expect(w.areaM2).toBeGreaterThan(0);
  });

  it("is repeatable: a second export writes identical files", () => {
    const second = exportSection({ root: ROOT, outRoot: join(out, "b"), sectionId: "maentwrog-photo" });
    const hashes = (r: typeof first) => JSON.stringify(readFileSync(join(r.outDir, "manifest.json"), "utf8").match(/"sha256": "[0-9a-f]{64}"/g));
    expect(hashes(second)).toBe(hashes(first));
  }, 120_000);
});
