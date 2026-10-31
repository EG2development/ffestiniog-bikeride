import { describe, expect, it } from "vitest";
import { loadSection } from "../../src/blender/loadSection";
import { buildRoadMesh, buildRoadStructures, roadWidthM } from "../../src/three-core/roads";
import { buildSectionScene, configById } from "../../src/three-core/sections";
import { ROOT } from "./fixtures";

// A road running off the edge of the terrain: the height lookup has no answer there.
const project = (lon: number, lat: number) => ({ x: lon * 1000, y: lat * 1000 });
const heightAt = (x: number) => (x > 5 ? -Infinity : 18);

describe("buildRoadMesh", () => {
  it("drops the parts of a road outside the terrain, leaving only finite vertices", () => {
    const mesh = buildRoadMesh([{ coords: [[0, 0], [0.01, 0]], highway: "unclassified" }], project, heightAt);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < mesh.positions.length; i += 3) expect(mesh.positions[i]).toBeLessThanOrEqual(5.001);
    for (const i of mesh.indices) expect(i).toBeLessThan(mesh.positions.length / 3);
  });

  it("drops a road entirely outside the terrain", () => {
    const mesh = buildRoadMesh([{ coords: [[0.01, 0], [0.02, 0]], highway: "track" }], project, heightAt);
    expect(mesh.positions.length).toBe(0);
    expect(mesh.indices.length).toBe(0);
  });

  it("joins ways of one class that meet end to end, so a bend at a bridge's end leaves no wedge open", () => {
    const flat = () => 18;
    const bend = buildRoadMesh([{ coords: [[0, 0], [0.004, 0], [0.004, 0.004]], highway: "trunk" }], project, flat);
    // OSM's split: a bridge way, then the road on, the second given reversed
    const split = buildRoadMesh([{ coords: [[0, 0], [0.004, 0]], highway: "trunk", bridge: true }, { coords: [[0.004, 0.004], [0.004, 0]], highway: "trunk" }], project, flat);
    expect(split.positions.length).toBe(bend.positions.length);
    expect(split.indices.length).toBe(bend.indices.length);
    // but not across a junction of three ways, nor between classes
    const junction = buildRoadMesh([{ coords: [[0, 0], [0.004, 0]], highway: "trunk" }, { coords: [[0.004, 0], [0.004, 0.004]], highway: "trunk" }, { coords: [[0.004, 0], [0.008, 0]], highway: "trunk" }], project, flat);
    const classes = buildRoadMesh([{ coords: [[0, 0], [0.004, 0]], highway: "trunk" }, { coords: [[0.004, 0], [0.004, 0.004]], highway: "service" }], project, flat);
    expect(junction.positions.length / 3).toBe(3 * (11 + 11 + 11));
    expect(classes.positions.length).toBe(bend.positions.length + 9);
  });

  it("carries a bridge way's deck straight over the dip the DTM drops it into", () => {
    // a 10 m deep river gully between x = 4 and 6 (world units of 10 m), the bridge way from 3 to 7
    const gully = (x: number) => (x > 4 && x < 6 ? 17 : 18);
    const way = { coords: [[0.003, 0], [0.007, 0]] as [number, number][], highway: "trunk" };
    const ys = (m: { positions: Float32Array }) => Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions[3 * i + 1]);
    expect(Math.min(...ys(buildRoadMesh([way], project, gully)))).toBeLessThan(17.1);
    expect(Math.min(...ys(buildRoadMesh([{ ...way, bridge: true }], project, gully)))).toBeGreaterThanOrEqual(18);
  });
});

describe("buildRoadStructures", () => {
  // a road crossing a 10 m wide, 5 m deep cut at x = 5 (the trail's), on the DTM's deck level
  const deck = () => 18;
  const cut = (x: number) => (Math.abs(x - 5) < 1 ? 17.5 : 18);
  const road = [{ coords: [[0, 0], [0.01, 0]] as [number, number][], highway: "trunk" }];
  const ground = { groundAt: cut, openAt: (x: number) => Math.abs(x - 5) < 0.4, ve: 1 };

  it("builds nothing under a road that lies on the ground", () => {
    const m = buildRoadStructures(road, project, deck, { ...ground, groundAt: deck });
    expect(m.indices.length).toBe(0);
  });

  it("walls a road down to the ground beside the cut, and leaves the trail's opening clear under a deck", () => {
    const m = buildRoadStructures(road, project, deck, ground);
    expect(m.indices.length).toBeGreaterThan(0);
    expect(m.positions.every(Number.isFinite)).toBe(true);
    for (const i of m.indices) expect(i).toBeLessThan(m.positions.length / 3);
    const verts = Array.from({ length: m.positions.length / 3 }, (_, i) => ({ x: m.positions[3 * i], y: m.positions[3 * i + 1] }));
    // the walls beside the opening reach into the cut's floor
    expect(verts.some((v) => Math.abs(v.x - 5) > 0.4 && Math.abs(v.x - 5) < 1 && v.y <= 17.5)).toBe(true);
    // over the trail, nothing comes lower than the deck's underside, about 0.9 m below the road
    const over = verts.filter((v) => Math.abs(v.x - 5) < 0.3);
    expect(over.length).toBeGreaterThan(0);
    for (const v of over) expect(v.y).toBeGreaterThan(18 - 0.1);
    // and the structure stays inside the cut, with a station of ground either side
    for (const v of verts) expect(Math.abs(v.x - 5)).toBeLessThan(1.5);
  });
});

describe("roads on the real ground (the Maentwrog Road section)", () => {
  it("keeps the A470's overbridge at the DTM's deck level and stands every raised road on a structure", () => {
    const cfg = configById("maentwrog");
    const { inputs } = loadSection(ROOT, cfg, { canopy: true, barriers: true, imagery: false });
    const scene = buildSectionScene(cfg, inputs, "photo");
    const m = 10 / cfg.ve;

    // the A470 crosses the line on an overbridge north of Maentwrog Road station (OSM way 159029128, rebuilt 2002;
    // the register's overbridge-159029128 spans km 8.560-8.591): the road over the trail there
    const way = inputs.osm.find((f) => f.properties.id === "way/159029128")!;
    expect(way.properties.tags).toMatchObject({ highway: "trunk", bridge: "yes" });
    const under = scene.trail.sampleAt(8575);
    const rp = scene.roads.positions;
    let best = -1;
    for (let i = 3; i < rp.length; i += 9) if (best < 0 || Math.hypot(rp[i] - under.x, rp[i + 2] - under.z) < Math.hypot(rp[best] - under.x, rp[best + 2] - under.z)) best = i;
    const [x, y, z] = [rp[best], rp[best + 1], rp[best + 2]];
    expect(Math.hypot(x - under.x, z - under.z) * 10).toBeLessThan(4);
    // its real level, well above the trail's cut beneath it
    expect(Math.abs(y - scene.bareHeightAt(x, z)) * m).toBeLessThan(1);
    expect((y - scene.surfaceAt(x, z)) * m).toBeGreaterThan(3);

    // every road cross-section more than 1 m above the rendered ground has masonry within its half-width and a metre
    const sp = scene.roadStructures.positions;
    expect(sp.length).toBeGreaterThan(0);
    const near = (px: number, pz: number, r: number) => {
      for (let i = 0; i < sp.length; i += 3) if (Math.hypot(sp[i] - px, sp[i + 2] - pz) <= r) return true;
      return false;
    };
    const floating: string[] = [];
    for (let i = 3; i < rp.length; i += 9) {
      const g = scene.surfaceAt(rp[i], rp[i + 2]);
      if (!Number.isFinite(g) || (rp[i + 1] - g) * m <= 1) continue;
      if (!near(rp[i], rp[i + 2], (roadWidthM("trunk") / 2 + 1) / 10)) floating.push(`(${rp[i].toFixed(1)}, ${rp[i + 2].toFixed(1)}) ${((rp[i + 1] - g) * m).toFixed(1)} m`);
    }
    expect(floating, "road cross-sections above the ground with nothing under them").toEqual([]);
  });
});
