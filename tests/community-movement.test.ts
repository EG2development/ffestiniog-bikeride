import { describe, expect, it } from "vitest";
import { loadSection } from "../src/blender/loadSection";
import { choreograph, closeCalls, DOG, type Choreo } from "../src/three-core/choreography";
import { COMMUNITY } from "../src/three-core/community";
import { defaultCyclistDims, distanceTable } from "../src/three-core/cyclistMotion";
import { buildSectionScene, type SectionConfig } from "../src/three-core/sections";
import { buildTrail, TRAIL_WIDTH_M, type TrailProfile } from "../src/three-core/trail";
import type { WalkerSpec } from "../src/three-core/walkers";
import { readJson, realRoute, ROOT } from "./three-core/fixtures";

// The community film's people on a shared path (src/three-core/choreography.ts): nobody passes through anybody,
// everyone keeps to the path, moves across it at human speeds and passes oncoming people keeping left, dogs stay at
// heel on short leads, and nothing solid stands in the way of anyone (src/three-core/roadCrossings.ts).

const FPS = 30;
const route = realRoute();
const scenes = Object.values(COMMUNITY).filter((c): c is SectionConfig & { photo: { walkers: WalkerSpec[] } } => c.kind === "ground" && !!c.photo?.walkers?.length);
const run = (cfg: (typeof scenes)[number]) => {
  const trail = buildTrail(route, readJson<TrailProfile>(`public/data/sections/${cfg.window}/trail-profile.json`), { startKm: cfg.kmRange[0], endKm: cfg.kmRange[1] }, { widthM: TRAIL_WIDTH_M, ve: 1 });
  const rider = cfg.photo.riderHidden ? undefined : { table: distanceTable(trail, cfg.startDistM, cfg.frames, FPS), lateralM: defaultCyclistDims().lateralOffsetM };
  return { specs: cfg.photo.walkers, rider, choreo: choreograph(trail, cfg.photo.walkers, cfg.frames, FPS, { rider }) };
};
const runs = new Map(scenes.map((cfg) => [cfg.id, run(cfg)]));
const wheels = (k: string) => k === "cycle" || k === "trike" || k === "rider";

describe("the community film's people on a shared path", () => {
  it("are choreographed together in every scene with people", () => {
    expect(scenes.length).toBeGreaterThanOrEqual(10);
    for (const cfg of scenes) expect(cfg.photo.choreograph, cfg.id).toBe(true);
  });

  it("bring the cyclist who locks up to a stop by the lockers early enough in the shot to be seen doing it", () => {
    // the Blender build (scripts/blender/lockup.py) needs about eight seconds from the stop: off the bicycle, wheel it
    // in, shut and lock the door, walk on; the old ride in stopped after the cut
    const cfg = scenes.find((c) => c.photo.walkers.some((w) => w.locksUp))!;
    const i = cfg.photo.walkers.findIndex((w) => w.locksUp);
    const spec = cfg.photo.walkers[i];
    const dist = runs.get(cfg.id)!.choreo[i].dist;
    const stop = dist.findIndex((d) => Math.abs(d - dist[dist.length - 1]) < 0.06);
    const lockers = cfg.photo.props!.find((p) => p.kind === "lockers")!;
    expect(spec.activity).toBe("cycle");
    expect(Math.abs(spec.stopAtM! - ("distM" in lockers.at ? lockers.at.distM : NaN))).toBeLessThan(2);
    expect(cfg.shots[0].frames - stop).toBeGreaterThanOrEqual(8 * FPS);
  });

  it("never pass through one another, their dogs or the rider: clear across the path whenever level along it", () => {
    // outlines: a body and whatever it pushes or rides (choreography.ts); a companion may walk shoulder to shoulder
    const minM = (a: string, b: string, companions: boolean) => (companions ? 0 : a === "dog" || b === "dog" ? 0.05 : wheels(a) !== wheels(b) ? 0.2 : 0.1);
    for (const cfg of scenes) {
      const { specs, rider, choreo } = runs.get(cfg.id)!;
      expect(closeCalls(specs, choreo, { rider, minM }), cfg.id).toEqual([]);
    }
  });

  it("keep to the path (a step onto the verge to let a bicycle by), and cross it at walking or riding speeds", () => {
    for (const cfg of scenes) {
      const { specs, choreo } = runs.get(cfg.id)!;
      specs.forEach((spec, i) => {
        if (spec.activity === "sit") return;
        const { side } = choreo[i];
        const most = Math.max(...Array.from(side, Math.abs));
        expect(most, `${cfg.id} ${spec.seed}`).toBeLessThanOrEqual(wheels(spec.activity ?? "walk") ? 1.2 : 1.36);
        for (let f = 2; f < side.length; f++) {
          const u = (side[f] - side[f - 1]) * FPS;
          expect(Math.abs(u), `${cfg.id} ${spec.seed} frame ${f}`).toBeLessThanOrEqual(0.81);
          // and no jerk: the sideways speed changes by no more than 1.2 m/s each second
          expect(Math.abs(u - (side[f - 1] - side[f - 2]) * FPS) * FPS, `${cfg.id} ${spec.seed} frame ${f}`).toBeLessThanOrEqual(1.21);
        }
      });
    }
  });

  it("pass oncoming people keeping left, each with the other on their right", () => {
    const wrong: string[] = [];
    let passes = 0;
    for (const cfg of scenes) {
      const { specs, choreo } = runs.get(cfg.id)!;
      for (let i = 0; i < specs.length; i++)
        for (let j = i + 1; j < specs.length; j++) {
          const [a, b] = [specs[i], specs[j]];
          if (a.direction === b.direction || a.activity === "sit" || b.activity === "sit") continue;
          // the frame they draw level
          const gap = (f: number) => (choreo[i].dist[f] - choreo[j].dist[f]) * a.direction;
          for (let f = 1; f < choreo[i].dist.length; f++) {
            if (gap(f - 1) < 0 && gap(f) >= 0) {
              passes++;
              // left of travel is +direction in route terms: a is to the left of b, so b passes on a's right
              if ((choreo[i].side[f] - choreo[j].side[f]) * a.direction <= 0) wrong.push(`${cfg.id}: ${a.seed} and ${b.seed} at frame ${f}`);
            }
          }
        }
    }
    expect(passes).toBeGreaterThan(5);
    expect(wrong).toEqual([]);
  });

  it("walk companions side by side, and keep each dog at heel on a short lead", () => {
    const dogs = scenes.filter((c) => c.photo.walkers.some((w) => w.dog));
    expect(dogs.length, "dog walkers in several scenes").toBeGreaterThanOrEqual(4);
    for (const cfg of scenes) {
      const { specs, choreo } = runs.get(cfg.id)!;
      const at = (c: Choreo, f: number) => [c.dist[f], c.side[f]];
      specs.forEach((spec, i) => {
        const c = choreo[i];
        if (spec.dog) {
          expect(c.dog, `${cfg.id} ${spec.seed}`).toBeDefined();
          for (let f = 0; f < c.dist.length; f++) {
            const [d, s] = at(c, f);
            const lead = Math.hypot(c.dog!.dist[f] - d, c.dog!.side[f] - s);
            expect(lead, `${cfg.id} ${spec.seed} frame ${f}`).toBeLessThanOrEqual(Math.hypot(DOG.aheadM + DOG.wanderAheadM, DOG.sideM + DOG.wanderSideM) + 0.01);
          }
        }
        if (spec.with !== undefined) {
          const j = specs.findIndex((s) => s.seed === spec.with);
          // together as they set out (side by side, or one behind the other), never drifting more than a metre and a quarter apart
          const apart = (f: number) => Math.hypot(c.dist[f] - choreo[j].dist[f], c.side[f] - choreo[j].side[f]);
          for (let f = 0; f < c.dist.length; f++) expect(apart(f), `${cfg.id} ${spec.seed} frame ${f}`).toBeLessThan(apart(0) + 1.25);
        }
      });
    }
  });
});

describe("nothing solid over the community film's paths", () => {
  // every structure, road and building of each scene, against the room people need over the path: its 3 m surface (a
  // wall may stand at its edge, as one does by Blaenau station), from ankle height to the 2.7 m a rider standing on the pedals needs, along the
  // stretch the scene's people use
  for (const cfg of scenes) {
    it(`leaves the path open in ${cfg.id}`, () => {
      const { inputs } = loadSection(ROOT, cfg, { canopy: false, barriers: false, imagery: false });
      const scene = buildSectionScene(cfg, inputs, "photo");
      const { choreo } = runs.get(cfg.id)!;
      const used = choreo.flatMap((c) => [Math.min(...c.dist), Math.max(...c.dist)]);
      const [lo, hi] = [Math.min(...used) - 5, Math.max(...used) + 5];
      const blocked: string[] = [];
      const cross = crossings([scene.roadStructures, scene.roads, ...scene.bridges, ...scene.buildings.groups]);
      // a vertical line every half metre along and across the path: anything it meets in the people's room
      for (let d = lo; d <= hi; d += 0.5) {
        const s = scene.trail.sampleAt(d);
        const l = Math.hypot(s.tangent[0], s.tangent[2]) || 1;
        for (const lat of [-1.3, -1, -0.5, 0, 0.5, 1, 1.3]) {
          const [x, z] = [s.x + ((s.tangent[2] / l) * lat) / 10, s.z - ((s.tangent[0] / l) * lat) / 10];
          for (const y of cross(x, z)) {
            const up = (y - s.y) * 10;
            if (up > 0.1 && up < 2.7) blocked.push(`${d.toFixed(1)} m, ${lat} m across, ${up.toFixed(2)} m up`);
          }
        }
      }
      expect(blocked.slice(0, 5)).toEqual([]);
    }, 120_000);
  }
});

/** Where a vertical line at (x, z) meets any of the meshes' triangles: their heights there (world units). */
function crossings(meshes: { positions: Float32Array; indices: Uint32Array }[]): (x: number, z: number) => number[] {
  const cell = 0.5;
  const grid = new Map<string, number[][]>();
  for (const m of meshes) {
    const p = m.positions;
    for (let t = 0; t < m.indices.length; t += 3) {
      const tri = [0, 1, 2].flatMap((k) => [p[m.indices[t + k] * 3], p[m.indices[t + k] * 3 + 1], p[m.indices[t + k] * 3 + 2]]);
      const [x0, x1] = [Math.floor(Math.min(tri[0], tri[3], tri[6]) / cell), Math.floor(Math.max(tri[0], tri[3], tri[6]) / cell)];
      const [z0, z1] = [Math.floor(Math.min(tri[2], tri[5], tri[8]) / cell), Math.floor(Math.max(tri[2], tri[5], tri[8]) / cell)];
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) continue; // a terrain-sized sliver, not a structure
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) (grid.get(`${x},${z}`) ?? grid.set(`${x},${z}`, []).get(`${x},${z}`)!).push(tri);
    }
  }
  return (x, z) => {
    const out: number[] = [];
    for (const [ax, ay, az, bx, by, bz, cx, cy, cz] of grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []) {
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-12) continue;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
      const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
      if (l1 < 0 || l2 < 0 || l1 + l2 > 1) continue;
      out.push(l1 * ay + l2 * by + (1 - l1 - l2) * cy);
    }
    return out;
  };
}
