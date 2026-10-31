import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { RouteModel } from "../data/route";
import { ATMOSPHERE, LIGHTING_PHOTO, sunDirection } from "../three-core/atmosphere";
import { buildingShell } from "../three-core/buildings";
import { cyclistPose, poseAxes, type CyclistPose } from "../three-core/cyclistMotion";
import { LEGEND, PHOTO_LEGEND, photoEarthworksLine } from "../data/reel-captions";
import type { Feature } from "../three-core/registers";
import { buildSectionScene, configById, earthworksInRange, shotSpecAt, type Look, type SectionScene } from "../three-core/sections";
import type { MeshArrays, Vec3 } from "../three-core/types";
import { blenderFrame, dirToBlender, METRES_PER_UNIT, positionsToBlender, toBlender, yawToBlender, type Origin } from "./coords";
import { loadSection, type SourceFile } from "./loadSection";

// The offline scene exporter (docs/blender-build-plan.md §3): the existing pure scene assembly, evaluated into data. A
// package is a manifest.json plus little-endian binary sidecars; every position is already in Blender metres (Z-up), so the
// Blender importer needs no coordinate logic. Functions (scene.shot, riderAt, ...) are sampled per frame, never serialised.

export const SCHEMA_VERSION = 1;
const FPS = 30;

if (new Uint8Array(new Uint32Array([1]).buffer)[0] !== 1) throw new Error("the exporter writes little-endian sidecars and needs a little-endian host");

type Typed = Float32Array | Uint32Array;
type ArrayRef = { file: string; type: "float32" | "uint32"; length: number };
export type MeshRef = {
  name: string;
  collection: string;
  /** what the mesh is, for the blockout's plain materials */
  role: string;
  vertices: number;
  triangles: number;
  positions: ArrayRef;
  indices: ArrayRef;
  colors?: ArrayRef;
  uvs?: ArrayRef;
};

/** The files of a package, collected while it is built. */
class Sidecars {
  readonly files = new Map<string, Buffer>();
  put(name: string, data: Typed): ArrayRef {
    this.files.set(name, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    return { file: name, type: data instanceof Float32Array ? "float32" : "uint32", length: data.length };
  }
}

const dirOf = (d: Vec3): Vec3 => dirToBlender(d);

function meshRef(side: Sidecars, o: Origin, name: string, collection: string, role: string, m: MeshArrays): MeshRef | null {
  if (m.positions.length === 0 || m.indices.length === 0) return null;
  if (m.indices.length % 3 !== 0) throw new Error(`mesh ${name}: ${m.indices.length} indices is not a whole number of triangles`);
  const vertices = m.positions.length / 3;
  for (let i = 0; i < m.indices.length; i++) if (m.indices[i] >= vertices) throw new Error(`mesh ${name}: index ${m.indices[i]} is past its ${vertices} vertices`);
  return {
    name,
    collection,
    role,
    vertices,
    triangles: m.indices.length / 3,
    positions: side.put(`${name}.positions.f32`, positionsToBlender(m.positions, o)),
    indices: side.put(`${name}.indices.u32`, m.indices),
    ...(m.colors && { colors: side.put(`${name}.colors.f32`, m.colors) }),
    ...(m.uvs && { uvs: side.put(`${name}.uvs.f32`, m.uvs) }),
  };
}

/** Grouped meshes from a building's per-look groups (positions only; Blender computes its own normals). */
const groupMesh = (g: { positions: Float32Array; indices: Uint32Array }): MeshArrays => ({ positions: g.positions, indices: g.indices });

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

/** A digest of the code that evaluates the scene, so a package names the assembly that made it (HEAD alone does not). */
function codeDigest(root: string): { files: number; sha256: string } {
  const dirs = ["src/three-core", "src/blender"];
  const files = [...dirs.flatMap((d) => readdirSync(resolve(root, d)).filter((n) => n.endsWith(".ts")).map((n) => `${d}/${n}`)), "src/data/route.ts"].sort();
  const h = createHash("sha256");
  for (const f of files) h.update(f).update(readFileSync(resolve(root, f)));
  return { files: files.length, sha256: h.digest("hex") };
}

function gitState(root: string): { head: string | null; dirtyFiles: number | null } {
  try {
    const run = (args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return { head: run(["rev-parse", "HEAD"]), dirtyFiles: run(["status", "--porcelain"]).split("\n").filter(Boolean).length };
  } catch {
    return { head: null, dirtyFiles: null };
  }
}

export type ExportResult = { outDir: string; manifest: Manifest };
export type Manifest = ReturnType<typeof buildManifest>;

/** The legend's lines as Section3D draws them in the photo look (the bridge, the earthworks a drone shot flies over, the people and verges, translucent buildings), run-length encoded over the section's frames. */
function legendRuns(scene: SectionScene, features: readonly Feature[], look: Look): { from: number; to: number; lines: string[] }[] {
  if (look !== "photo") return [];
  const cfg = scene.config;
  const runs: { from: number; to: number; lines: string[] }[] = [];
  const translucent = scene.buildings.groups.some((g) => g.kind === "translucent");
  for (let f = 0; f < cfg.frames; f++) {
    const spec = shotSpecAt(cfg, f);
    const earthworks = spec.kind === "drone-side" ? earthworksInRange(features, [Math.min(spec.fromDistM, spec.toDistM, cfg.startDistM), Math.max(spec.fromDistM, spec.toDistM, scene.distAt(f))]) : null;
    const lines = [
      ...(cfg.kind === "ground" && scene.bridges.length > 0 ? [PHOTO_LEGEND.bridge] : []),
      ...(earthworks ? [photoEarthworksLine(earthworks[0], earthworks[1])] : []),
      ...(cfg.kind === "ground" ? [PHOTO_LEGEND.ground] : []),
      ...(translucent ? [LEGEND.translucent] : []),
    ];
    const last = runs[runs.length - 1];
    if (last && last.to === f && JSON.stringify(last.lines) === JSON.stringify(lines)) last.to = f + 1;
    else runs.push({ from: f, to: f + 1, lines });
  }
  return runs.filter((r) => r.lines.length > 0);
}

function buildManifest(side: Sidecars, root: string, sources: SourceFile[], scene: SectionScene, look: Look, features: readonly Feature[], route: RouteModel) {
  const cfg = scene.config;
  const start = scene.trail.sampleAt(cfg.startDistM);
  const origin: Origin = { x0: start.x, z0: start.z };

  const meshes = [
    meshRef(side, origin, "terrain", "Terrain", "terrain", scene.terrain),
    meshRef(side, origin, "trail", "ProposedTrail", "trail", scene.trail.ribbon),
    meshRef(side, origin, "roads", "ExistingFeatures", "road", scene.roads),
    meshRef(side, origin, "bridge-roads", "ExistingFeatures", "bridge", scene.roadStructures),
    ...scene.bridges.map((b, i) => meshRef(side, origin, `bridge-${i}`, "ExistingFeatures", "bridge", b)),
    ...scene.buildings.groups.map((g) => meshRef(side, origin, `buildings-${g.kind}`, "ExistingFeatures", `building-${g.kind}`, groupMesh(g))),
    ...scene.buildings.landmarkGroups.map((g) => meshRef(side, origin, `landmarks-${g.kind}`, "ExistingFeatures", `building-${g.kind}`, groupMesh(g))),
    ...(["wall", "hedge", "fence"] as const).map((k) => meshRef(side, origin, `barrier-${k}`, "ExistingFeatures", `barrier-${k}`, scene.barriers[k])),
  ].filter((m): m is MeshRef => m !== null);

  // the existing buildings' footprints and heights, so a dressed scene can model roofs, eaves and openings on the same walls
  const footprints = scene.buildings.records
    .filter((r) => r.kind !== "landmark" && (r.status === "existing" || r.status === "construction"))
    .map((r) => {
      const s = buildingShell(r, scene.heightAt, cfg.ve);
      return {
        id: r.id,
        roof: r.roof,
        ring: s.ring.map((q) => [METRES_PER_UNIT * (q.x - origin.x0), -METRES_PER_UNIT * (q.z - origin.z0)]),
        baseZ: METRES_PER_UNIT * s.base,
        topZ: METRES_PER_UNIT * s.top,
        minEavesZ: METRES_PER_UNIT * s.minEaves,
      };
    });

  const water = scene.water.map((w) => ({
    id: w.id,
    surfaceZ: METRES_PER_UNIT * w.surfaceY,
    polygons: w.polygons.map((p) => ({
      outer: p.outer.map((q) => [METRES_PER_UNIT * (q.x - origin.x0), -METRES_PER_UNIT * (q.z - origin.z0)]),
      holes: p.holes.map((h) => h.map((q) => [METRES_PER_UNIT * (q.x - origin.x0), -METRES_PER_UNIT * (q.z - origin.z0)])),
    })),
  }));

  // instance points: one record per tree or clump, [x, y, z, scale, yaw, tint, variant]; scale is the source's own, untouched
  const instanceKinds: Record<string, { x: number; y: number; z: number; scale: number; yaw: number; tint?: number; variant?: number }[]> = { conifer: scene.trees.conifer, broadleaf: scene.trees.broadleaf, grass: scene.grass };
  const instances = Object.entries(instanceKinds)
    .filter(([, list]) => list.length > 0)
    .map(([kind, list]) => {
      const data = new Float32Array(list.length * 7);
      list.forEach((t, i) => {
        const p = toBlender([t.x, t.y, t.z], origin);
        data.set([p[0], p[1], p[2], t.scale, yawToBlender(t.yaw), t.tint ?? 0, t.variant ?? 0], i * 7);
      });
      return { kind, collection: "Vegetation", count: list.length, fields: ["x", "y", "z", "scale", "yaw", "tint", "variant"], data: side.put(`instances-${kind}.f32`, data) };
    });

  // per-frame samples, indexed by source frame f (Blender frame f + 1)
  const frames = cfg.frames;
  const camera = new Float32Array(frames * 7);
  for (let f = 0; f < frames; f++) {
    const c = scene.shot(f);
    const p = toBlender(c.position, origin);
    const t = toBlender(c.target, origin);
    camera.set([p[0], p[1], p[2], t[0], t[1], t[2], c.fovDeg], f * 7);
  }
  const rider = new Float32Array(frames * 11);
  for (let f = 0; f < frames; f++) {
    const pose: CyclistPose = cyclistPose(scene.trail, scene.table, f, FPS, scene.dims);
    const { forward, up } = poseAxes(pose);
    rider.set([...toBlender(pose.position, origin), ...dirOf(forward), ...dirOf(up), pose.wheelAngle, pose.crankAngle], f * 11);
  }
  const walkers = scene.walkers.map((w, i) => {
    const data = new Float32Array(frames * 5);
    for (let f = 0; f < frames; f++) {
      const p = w.poseAt(f);
      data.set([...toBlender(p.position, origin), yawToBlender(p.yaw), p.phase], f * 5);
    }
    return { index: i, activity: w.spec.activity ?? "walk", heightM: w.spec.heightM, seed: w.spec.seed, direction: w.spec.direction, sideM: w.spec.sideM, fields: ["x", "y", "z", "yaw", "phase"], data: side.put(`walker-${i}.f32`, data) };
  });

  let startFrame = 0;
  const shots = cfg.shots.map((s, i) => {
    const out = { index: i, kind: s.kind, firstFrame: startFrame, frames: s.frames, firstBlenderFrame: blenderFrame(startFrame), lastBlenderFrame: blenderFrame(startFrame + s.frames - 1) };
    startFrame += s.frames;
    return out;
  });
  if (startFrame !== frames) throw new Error(`section ${cfg.id}: its shots run ${startFrame} frames but the section has ${frames}`);

  return {
    schema: SCHEMA_VERSION,
    section: { id: cfg.id, title: cfg.title, kind: cfg.kind, window: cfg.window, kmRange: cfg.kmRange, look, fps: FPS, frames, startDistM: cfg.startDistM },
    // Blender = rotation + 10× scale of Three.js about this horizontal origin (Three.js world units); see src/blender/coords.ts
    coordinates: {
      origin,
      metresPerUnit: METRES_PER_UNIT,
      forward: "bx = 10 (x - x0); by = -10 (z - z0); bz = 10 y",
      inverse: "x = bx / 10 + x0; y = bz / 10; z = -by / 10 + z0",
      frameOffset: 1,
      verticalExaggeration: cfg.ve,
      note: "local axes follow the route projection, not geographic east/north",
    },
    camera: { verticalFovDegrees: true, fields: ["px", "py", "pz", "tx", "ty", "tz", "fovDeg"], data: side.put("camera.f32", camera), shots },
    rider: {
      dims: scene.dims,
      fields: ["px", "py", "pz", "fx", "fy", "fz", "ux", "uy", "uz", "wheelAngle", "crankAngle"],
      data: side.put("rider.f32", rider),
      note: "the camera rider's full body is hidden in first-person shots, as in the prototype",
    },
    walkers,
    /** ADR 18's sun as the three.js scene lights it: a unit vector towards the sun, in Blender axes */
    lighting: {
      sunDirection: dirOf(sunDirection(route, ATMOSPHERE[cfg.kind])),
      sunAzimuthDeg: ATMOSPHERE[cfg.kind].sunAzimuthDeg,
      sunElevationDeg: ATMOSPHERE[cfg.kind].sunElevationDeg,
      sunColour: LIGHTING_PHOTO[cfg.kind].sunColour,
    },
    /** the legend lines per run of section frames [from, to), as the three.js scene draws them */
    legend: legendRuns(scene, features, look),
    meshes,
    /** non-landmark existing buildings: ring in Blender XY metres, heights in Blender Z metres (the merged mesh's walls) */
    buildings: footprints,
    water,
    instances,
    counts: {
      terrainVertices: scene.terrain.positions.length / 3,
      trailSamples: scene.trail.samples.length,
      buildings: scene.buildings.records.length,
      water: water.length,
      trees: scene.trees.conifer.length + scene.trees.broadleaf.length,
      grassClumps: scene.grass.length,
      walkers: walkers.length,
    },
    provenance: {
      git: gitState(root),
      code: codeDigest(root),
      sources,
      limitations: [
        "A concept visualisation, not an approved route; the 3 m trail ribbon is a concept, not proof of suitability.",
        "The ground meshes are 4 m samples of 1 m lidar; the corridor window is 16 m.",
        "Tree species, bridge form and heights are generic or default unless the registers say otherwise.",
      ],
    },
  };
}

/** Evaluate a section or prototype config into a package under `<outRoot>/<id>/`. */
export function exportSection(opts: { root: string; outRoot: string; sectionId: string; look?: Look }): ExportResult {
  const look = opts.look ?? "photo";
  const cfg = configById(opts.sectionId);
  const photo = look === "photo" ? cfg.photo : undefined;
  const { inputs, sources } = loadSection(opts.root, cfg, { canopy: !!photo?.canopyTrees, barriers: !!photo?.barriers, imagery: !!photo?.imagery });
  const scene = buildSectionScene(cfg, inputs, look);
  const side = new Sidecars();
  const manifest = buildManifest(side, opts.root, sources, scene, look, inputs.features, inputs.route);

  const outDir = join(opts.outRoot, cfg.id);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const [name, buf] of side.files) writeFileSync(join(outDir, name), buf);
  const text = JSON.stringify({ ...manifest, files: [...side.files].map(([name, buf]) => ({ file: name, bytes: buf.length, sha256: sha256(buf) })) }, null, 2) + "\n";
  writeFileSync(join(outDir, "manifest.json"), text);
  return { outDir, manifest };
}
