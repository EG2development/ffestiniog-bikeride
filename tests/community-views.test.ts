import { describe, expect, it } from "vitest";
import { loadSection } from "../src/blender/loadSection";
import { COMMUNITY } from "../src/three-core/community";
import { placeProps } from "../src/three-core/props";
import { buildSectionScene, type SectionConfig, type SectionScene } from "../src/three-core/sections";
import type { Vec3 } from "../src/three-core/types";
import { readJson, realRoute, ROOT } from "./three-core/fixtures";

// What the community film's ground shots show (src/three-core/community.ts): the viewer looks the way a path user does,
// ahead along the route and out over open ground, never down into a field or up into a bank; benches face the view; the
// station scene shows the existing stop the path leads to.

const route = realRoute();
const stops = new Map(readJson<{ stops: { id: string; lon: number; lat: number }[] }>("data/bus-stops.json").stops.map((s) => [s.id, s]));
const ground = Object.values(COMMUNITY).filter((c) => c.kind === "ground");
const built = new Map<string, SectionScene>();
const sceneOf = (cfg: SectionConfig): SectionScene => {
  if (!built.has(cfg.id)) built.set(cfg.id, buildSectionScene(cfg, loadSection(ROOT, cfg, { canopy: false, barriers: false, imagery: false }).inputs, "photo"));
  return built.get(cfg.id)!;
};
const propsOf = (cfg: SectionConfig, scene: SectionScene) => placeProps(cfg.photo?.props ?? [], scene.trail, route.project, scene.surfaceAt, stops);

/** The camera's basis at a frame: forward, right and up unit vectors (world units, y up). */
function basis(p: Vec3, t: Vec3) {
  const f = [t[0] - p[0], t[1] - p[1], t[2] - p[2]];
  const fl = Math.hypot(...f);
  const fw = f.map((v) => v / fl);
  const rl = Math.hypot(fw[0], fw[2]);
  const rt = [-fw[2] / rl, 0, fw[0] / rl];
  const up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
  return { fw, rt, up };
}

/** Of a 16 x 9 grid of rays across a 16:9 frame, the share that travel `farM` before meeting the terrain: open view. */
function openShare(scene: SectionScene, frame: number, farM = 60): number {
  const { position: p, target, fovDeg } = scene.shot(frame);
  const { fw, rt, up } = basis(p, target);
  const ty = Math.tan((fovDeg * Math.PI) / 360);
  const tx = (ty * 16) / 9;
  let open = 0;
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 9; j++) {
      const [a, b] = [(((i + 0.5) / 16) * 2 - 1) * tx, (((j + 0.5) / 9) * 2 - 1) * ty];
      const d = [0, 1, 2].map((k) => fw[k] + rt[k] * a + up[k] * b);
      const dl = Math.hypot(...d);
      let hit = false;
      for (let m = 0.5; m <= farM && !hit; m += 0.5) {
        const [x, y, z] = [0, 1, 2].map((k) => p[k] + (d[k] / dl) * (m / 10));
        hit = y < scene.heightAt(x, z);
      }
      if (!hit) open++;
    }
  return open / 144;
}

describe("the community film's views", () => {
  for (const cfg of ground) {
    it(`look out, not down into a field or up into a bank, in ${cfg.id}`, () => {
      const scene = sceneOf(cfg);
      const shut: string[] = [];
      for (let f = 0; f < cfg.frames; f += 15) {
        const { position: p, target: t } = scene.shot(f);
        const pitch = (Math.atan2(t[1] - p[1], Math.hypot(t[0] - p[0], t[2] - p[2])) * 180) / Math.PI;
        // a camera pitched down more than 30° looks at the ground at its feet; a quarter of the frame at least sees past 60 m
        if (pitch < -30) shut.push(`frame ${f}: pitched ${pitch.toFixed(0)}°`);
        const open = openShare(scene, f);
        if (open < 0.25) shut.push(`frame ${f}: ${(open * 100).toFixed(0)}% of the view open`);
      }
      expect(shut).toEqual([]);
    }, 120_000);
  }

  it("fly the aerials looking out over the land, never in plan down onto a field", () => {
    const steep: string[] = [];
    for (const cfg of Object.values(COMMUNITY).filter((c) => c.kind === "aerial")) {
      // the camera reads only the trail and the terrain: the concept look builds them without the imagery
      const scene = buildSectionScene(cfg, loadSection(ROOT, cfg, { canopy: false, barriers: false, imagery: false }).inputs, "concept");
      for (let f = 0; f < cfg.frames; f += 15) {
        const { position: p, target: t } = scene.shot(f);
        const pitch = (Math.atan2(t[1] - p[1], Math.hypot(t[0] - p[0], t[2] - p[2])) * 180) / Math.PI;
        // the closing shot once looked 45–55° down onto the fields beside the A470
        if (pitch < -35) steep.push(`${cfg.id} frame ${f}: pitched ${pitch.toFixed(0)}°`);
      }
    }
    expect(steep).toEqual([]);
  }, 300_000);

  it("never show the ground through the path's surface, at level crossings and sags in its profile included", () => {
    const through: string[] = [];
    for (const cfg of ground) {
      const scene = sceneOf(cfg);
      const [lo, hi] = cfg.photo!.grassAlongM!;
      for (let d = lo; d <= hi; d += 0.5) {
        const s = scene.trail.sampleAt(d);
        const l = Math.hypot(s.tangent[0], s.tangent[2]);
        // across the path, short of its last quarter metre either side, where a street alongside (as in Blaenau) meets it
        for (const lat of [-1.25, -1, -0.5, 0, 0.5, 1, 1.25]) {
          const up = (scene.surfaceAt(s.x + ((s.tangent[2] / l) * lat) / 10, s.z - ((s.tangent[0] / l) * lat) / 10) - s.y) * 10;
          if (up > 0.01) through.push(`${cfg.id} ${d} m, ${lat} m across: ${up.toFixed(2)} m`);
        }
      }
    }
    expect(through.slice(0, 5)).toEqual([]);
  }, 300_000);

  it("seat people on benches that face open ground, the way they would sit to take in the view", () => {
    let benches = 0;
    for (const cfg of ground) {
      const scene = sceneOf(cfg);
      for (const b of propsOf(cfg, scene).filter((p) => p.kind === "bench")) {
        benches++;
        const [fx, fz] = [Math.cos(b.yaw), -Math.sin(b.yaw)];
        const eye = b.position[1] + 0.12; // seated eyes 1.2 m up
        let steepest = -90;
        for (let m = 5; m <= 150; m += 2) {
          const h = scene.heightAt(b.position[0] + (fx * m) / 10, b.position[2] + (fz * m) / 10);
          steepest = Math.max(steepest, (Math.atan2((h - eye) * 10, m) * 180) / Math.PI);
        }
        // no rising ground in front of it: the old rest place faced a hillside at 6–7°
        expect(steepest, `${cfg.id} bench`).toBeLessThan(2);
      }
    }
    expect(benches).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it("face the rest place's bench towards Llyn Trawsfynydd, with open water in sight from the seat", () => {
    const cfg = COMMUNITY["community-welcome"];
    const scene = sceneOf(cfg);
    const bench = propsOf(cfg, scene).find((p) => p.kind === "bench")!;
    const rings = scene.water.flatMap((w) => w.polygons.map((p) => ({ ring: p.outer, y: w.surfaceY })));
    expect(rings.length).toBeGreaterThan(0);
    const waterAt = (x: number, z: number) => {
      for (const { ring, y } of rings) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
          if (ring[i].z > z !== ring[j].z > z && x < ((ring[j].x - ring[i].x) * (z - ring[i].z)) / (ring[j].z - ring[i].z) + ring[i].x) inside = !inside;
        if (inside) return y;
      }
      return null;
    };
    const eye = bench.position[1] + 0.12;
    // a bearing sees water when its sightline over the terrain reaches the lake's surface unbroken
    const seesWater = (yaw: number) => {
      const [dx, dz] = [Math.cos(yaw), -Math.sin(yaw)];
      let highest = -Infinity;
      for (let m = 5; m <= 2500; m += 5) {
        const [x, z] = [bench.position[0] + (dx * m) / 10, bench.position[2] + (dz * m) / 10];
        const water = waterAt(x, z);
        const h = water ?? scene.heightAt(x, z);
        if (!Number.isFinite(h)) return false;
        const angle = Math.atan2(h - eye, m / 10);
        if (water !== null && angle >= highest) return true;
        highest = Math.max(highest, angle);
      }
      return false;
    };
    // within 15° either side of the way the seat faces
    const seen = [-15, -10, -5, 0, 5, 10, 15].filter((deg) => seesWater(bench.yaw + (deg * Math.PI) / 180));
    expect(seen.length).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it("show the existing bus stop the path leads to at Blaenau Ffestiniog station", () => {
    const cfg = COMMUNITY["community-bus"];
    const scene = sceneOf(cfg);
    const flag = propsOf(cfg, scene).find((p) => p.kind === "bus-stop-flag" && p.status === "existing")!;
    const framed = (f: number) => {
      const { position: p, target, fovDeg } = scene.shot(f);
      const { fw, rt, up } = basis(p, target);
      const v = [0, 1, 2].map((k) => flag.position[k] + (k === 1 ? 0.15 : 0) - p[k]);
      const depth = v[0] * fw[0] + v[1] * fw[1] + v[2] * fw[2];
      const ty = Math.tan((fovDeg * Math.PI) / 360);
      const [x, y] = [(v[0] * rt[0] + v[2] * rt[2]) / depth, (v[0] * up[0] + v[1] * up[1] + v[2] * up[2]) / depth];
      return depth > 0 && depth * 10 < 40 && Math.abs(x) < (ty * 16) / 9 && Math.abs(y) < ty;
    };
    const frames = Array.from({ length: cfg.frames }, (_, f) => f).filter(framed);
    // for several seconds, and close enough to read
    expect(frames.length).toBeGreaterThan(150);
  }, 120_000);
});
