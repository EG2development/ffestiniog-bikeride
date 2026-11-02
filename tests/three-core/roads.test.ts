import { describe, expect, it } from "vitest";
import { loadSection } from "../../src/blender/loadSection";
import { buildRoadMarkings, buildRoadMesh, gradeToRoads, layRoads, roadWidthM, seatRoads, type RoadLine } from "../../src/three-core/roads";
import { buildRoadStructures } from "../../src/three-core/roadStructures";
import { centrelineIndex } from "../../src/three-core/trail";
import { buildSectionScene, configById } from "../../src/three-core/sections";
import { ROOT } from "./fixtures";

// A road running off the edge of the terrain: the height lookup has no answer there.
const project = (lon: number, lat: number) => ({ x: lon * 1000, y: lat * 1000 });
const heightAt = (x: number) => (x > 5 ? -Infinity : 18);
const lay = (roads: RoadLine[], h: (x: number, z: number) => number, keep?: (x: number, z: number) => boolean) => layRoads(roads, project, h, { ve: 1, ...(keep && { keep }) });
const verts = (m: { positions: Float32Array }) => Array.from({ length: m.positions.length / 3 }, (_, i) => ({ x: m.positions[3 * i], y: m.positions[3 * i + 1], z: m.positions[3 * i + 2] }));

describe("buildRoadMesh", () => {
  it("drops the parts of a road outside the terrain, leaving only finite vertices", () => {
    const mesh = buildRoadMesh(lay([{ coords: [[0, 0], [0.01, 0]], highway: "unclassified" }], heightAt));
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < mesh.positions.length; i += 3) expect(mesh.positions[i]).toBeLessThanOrEqual(5.001);
    for (const i of mesh.indices) expect(i).toBeLessThan(mesh.positions.length / 3);
  });

  it("drops a road entirely outside the terrain", () => {
    const mesh = buildRoadMesh(lay([{ coords: [[0.01, 0], [0.02, 0]], highway: "track" }], heightAt));
    expect(mesh.positions.length).toBe(0);
    expect(mesh.indices.length).toBe(0);
  });

  it("joins ways of one class that meet end to end, so a bend at a bridge's end leaves no wedge open", () => {
    const flat = () => 18;
    const bend = buildRoadMesh(lay([{ coords: [[0, 0], [0.004, 0], [0.004, 0.004]], highway: "trunk" }], flat));
    // OSM's split: a bridge way, then the road on, the second given reversed
    const split = buildRoadMesh(lay([{ coords: [[0, 0], [0.004, 0]], highway: "trunk", bridge: true }, { coords: [[0.004, 0.004], [0.004, 0]], highway: "trunk" }], flat));
    expect(split.positions.length).toBe(bend.positions.length);
    expect(split.indices.length).toBe(bend.indices.length);
    // but not across a junction of three ways, nor between classes (each 40 m way: 20 steps of 2 m, 21 cross-sections)
    const junction = buildRoadMesh(lay([{ coords: [[0, 0], [0.004, 0]], highway: "trunk" }, { coords: [[0.004, 0], [0.004, 0.004]], highway: "trunk" }, { coords: [[0.004, 0], [0.008, 0]], highway: "trunk" }], flat));
    const classes = buildRoadMesh(lay([{ coords: [[0, 0], [0.004, 0]], highway: "trunk" }, { coords: [[0.004, 0], [0.004, 0.004]], highway: "service" }], flat));
    expect(junction.positions.length / 3).toBe(3 * (21 + 21 + 21));
    expect(classes.positions.length).toBe(bend.positions.length + 9);
  });

  it("rounds a corner through its OSM node, turning a little at each step instead of all at once", () => {
    const corner = lay([{ coords: [[0, 0], [0.004, 0], [0.004, 0.004]], highway: "trunk" }], () => 18).runs[0].stations;
    // the node is kept: the curve passes through it
    expect(Math.min(...corner.map((s) => Math.hypot(s.x - 4, s.z)))).toBeLessThan(1e-6);
    let worst = 0;
    for (let i = 1; i + 1 < corner.length; i++) {
      const a = Math.atan2(corner[i].z - corner[i - 1].z, corner[i].x - corner[i - 1].x);
      const b = Math.atan2(corner[i + 1].z - corner[i].z, corner[i + 1].x - corner[i].x);
      worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))));
    }
    expect((worst * 180) / Math.PI).toBeLessThan(30);
  });

  it("smooths the DTM's grid noise out of the long profile, and lays the carriageway level across with a crown", () => {
    // a 0.5 m spike every 4 m under a level road on a side slope
    const noisy = (x: number, z: number) => 18 + (Math.round(x * 10) % 4 === 0 ? 0.05 : 0) + z * 0.2;
    const road = lay([{ coords: [[0, 0], [0.01, 0]], highway: "trunk" }], noisy);
    const ys = road.runs[0].stations.map((s) => s.y);
    const inner = ys.slice(10, -10);
    expect((Math.max(...inner) - Math.min(...inner)) * 10).toBeLessThan(0.1);
    const m = verts(buildRoadMesh(road));
    // left and right edges at one level, the crown 9 cm (1 in 40 of 3.65 m) above them
    for (let i = 0; i + 2 < m.length; i += 3) {
      expect(m[i].y).toBeCloseTo(m[i + 2].y, 6);
      expect((m[i + 1].y - m[i].y) * 10).toBeCloseTo(0.025 * 3.65, 3);
    }
  });

  it("carries a bridge way's deck straight over the dip the DTM drops it into", () => {
    // a 10 m deep river gully between x = 4 and 6 (world units of 10 m), the bridge way from 3 to 7
    const gully = (x: number) => (x > 4 && x < 6 ? 17 : 18);
    const way = { coords: [[0.003, 0], [0.007, 0]] as [number, number][], highway: "trunk" };
    const ys = (r: RoadLine[]) => verts(buildRoadMesh(lay(r, gully))).map((v) => v.y);
    // unbridged, the road follows the dip (its profile smoothed over a few metres)
    expect(Math.min(...ys([way]))).toBeLessThan(17.2);
    expect(Math.min(...ys([{ ...way, bridge: true }]))).toBeGreaterThanOrEqual(17.99);
  });
});

describe("a road under the line's bridge", () => {
  // a road along x crossing the line at x = 5 (world units of 10 m), where the grid reads the gap under the span 1.5 m
  // high over 16 m either way; the lidar's ground under the span is 178.5 m
  const road = [{ coords: [[0, 0], [0.01, 0]] as [number, number][], highway: "unclassified" }];
  const grid = (x: number) => 18 + (Math.abs(x - 5) < 1.6 ? 0.15 * (1 - Math.abs(x - 5) / 1.6) : 0);
  const under = (ground: number) => (x: number) => (Math.abs(x - 5) < 0.65 ? { lateral: Math.abs(x - 5), ground } : null);
  const ys = (u?: (x: number) => { lateral: number; ground: number } | null) => layRoads(road, project, grid, { ve: 1, ...(u && { under: u }) }).runs[0].stations;

  it("dips to the lidar's ground where it crosses the line, easing back to its own level within 16 m", () => {
    const plain = ys();
    const dipped = ys(under(17.85));
    const at = (st: typeof plain, x: number) => st.reduce((b, s) => (Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b));
    // at the crossing: the span's ground and the 5 cm lift, not the grid's 1.5 m too high
    expect((at(dipped, 5).y - 17.85) * 10).toBeCloseTo(0.05, 1);
    // beyond 16 m either way: as laid without it
    for (const s of dipped) if (Math.abs(s.x - 5) > 1.65) expect(s.y).toBeCloseTo(at(plain, s.x).y, 6);
    // no step: the gradient changes by under 12 % between neighbouring 2 m steps
    for (let i = 2; i < dipped.length; i++) {
      const g = (a: number) => ((dipped[a].y - dipped[a - 1].y) * 10) / (dipped[a].alongM - dipped[a - 1].alongM);
      expect(Math.abs(g(i) - g(i - 1))).toBeLessThan(0.12);
    }
  });

  it("ignores a ground far below the grid's level there (a stream under a viaduct, not the road's)", () => {
    const dipped = ys(under(17));
    const plain = ys();
    dipped.forEach((s, i) => expect(s.y).toBeCloseTo(plain[i].y, 6));
  });
});

describe("seatRoads", () => {
  // a road on ground graded 15 cm under it, and a 45 cm rise across it at x = 5 that grading left (two roads too close
  // for the grid to grade to both)
  const layout = lay([{ coords: [[0, 0], [0.01, 0]], highway: "trunk" }], () => 18);
  const ground = (x: number) => 17.985 + (Math.abs(x - 5) < 0.1 ? 0.045 : 0);
  const seated = seatRoads(layout, ground);
  const before = layout.runs[0].stations;
  const after = seated.runs[0].stations;

  it("raises the road onto ground that rises above it, edges included, and never lowers it", () => {
    after.forEach((s, i) => expect(s.y).toBeGreaterThanOrEqual(before[i].y));
    for (const v of verts(buildRoadMesh(seated))) expect(v.y).toBeGreaterThanOrEqual(ground(v.x) + 0.005 - 1e-6);
    // beyond the ease (6 m held, then 6 m smoothed, either way of the rise), as it was
    after.forEach((s, i) => {
      if (Math.abs(s.x - 5) > 1.4) expect(s.y).toBe(before[i].y);
    });
  });

  it("eases the raise in and out, so it adds no step", () => {
    for (let i = 2; i < after.length; i++) {
      const g = (a: number) => ((after[a].y - after[a - 1].y) * 10) / (after[a].alongM - after[a - 1].alongM);
      expect(Math.abs(g(i) - g(i - 1))).toBeLessThan(0.12);
    }
  });
});

describe("gradeToRoads", () => {
  // a 4 m terrain grid (world units of 10 m) from x = 0 to 10 and z = -3 to 3, a road along z = 0
  const grid = (h: (x: number, z: number) => number) => {
    const p: number[] = [];
    for (let z = -3; z <= 3.0001; z += 0.4) for (let x = 0; x <= 10.0001; x += 0.4) p.push(x, h(x, z), z);
    return Float32Array.from(p);
  };
  const road = [{ coords: [[0, 0], [0.01, 0]] as [number, number][], highway: "trunk" }];
  const ground = (x: number, z: number) => 18 + 0.05 * Math.sin(x * 3) + (Math.abs(z) < 0.3 && x > 4 && x < 6 ? 0.2 : 0);

  it("grades the ground under the road to its bed, the verges level, and cuttings and banks at 1 in 2 beyond", () => {
    const layout = lay(road, ground);
    const before = grid(ground);
    const after = gradeToRoads(before, layout, { spacingM: 4, keep: () => false });
    expect(before).not.toBe(after);
    const s = layout.runs[0].stations;
    const roadY = (x: number) => s.reduce((best, st) => (Math.abs(st.x - x) < Math.abs(best.x - x) ? st : best)).y;
    for (let i = 0; i < after.length; i += 3) {
      const [x, y, z] = [after[i], after[i + 1], after[i + 2]];
      if (x < 1 || x > 9) continue;
      const beyondM = Math.abs(z) * 10 - 3.65;
      // under the carriageway and the verge (as wide as the 4 m grid's diagonal): just under the surface
      const verge = 4 * Math.SQRT2;
      if (beyondM <= verge) {
        expect((roadY(x) - y) * 10).toBeGreaterThan(0.1);
        expect((roadY(x) - y) * 10).toBeLessThan(0.35);
      } else {
        // beyond: within the batters' band from the verge's edge, and ground already inside it is untouched
        expect(Math.abs(roadY(x) - 0.024 - y) * 10).toBeLessThanOrEqual(0.5 * (beyondM - verge) + 0.01);
      }
      if (beyondM > 7.5) expect(y).toBeCloseTo(before[i + 1], 5);
    }
  });

  it("leaves the trail's corridor and a bridge's span alone", () => {
    const hill = (x: number, z: number) => 18 + (x > 4 && x < 6 ? 0.8 : 0) + 0 * z;
    const keep = (x: number) => x > 4.6 && x < 5.4;
    const before = grid(hill);
    const after = gradeToRoads(before, lay(road, hill, keep), { spacingM: 4, keep });
    for (let i = 0; i < after.length; i += 3) if (keep(after[i])) expect(after[i + 1]).toBe(before[i + 1]);
    const bridged = gradeToRoads(before, lay([{ ...road[0], bridge: true }], hill), { spacingM: 4, keep: () => false });
    for (let i = 0; i < after.length; i += 3) if (after[i] > 2 && after[i] < 8 && Math.abs(after[i + 2]) < 0.2) expect(bridged[i + 1]).toBe(before[i + 1]);
  });

  it("on the aerial windows' 16 m grid too, levels every node of a cell the carriageway crosses", () => {
    const coarse: number[] = [];
    for (let z = -6.4; z <= 6.4001; z += 1.6) for (let x = 0; x <= 9.6001; x += 1.6) coarse.push(x, 18 + 0.1 * Math.cos(x + z), z);
    const layout = lay(road, (x, z) => 18 + 0.1 * Math.cos(x + z));
    const after = gradeToRoads(Float32Array.from(coarse), layout, { spacingM: 16, keep: () => false });
    const s = layout.runs[0].stations;
    const roadY = (x: number) => s.reduce((best, st) => (Math.abs(st.x - x) < Math.abs(best.x - x) ? st : best)).y;
    // every node within a grid diagonal of the edge: just under the surface, so no 16 m triangle rises through it
    for (let i = 0; i < after.length; i += 3) {
      if (after[i] > 1 && after[i] < 8.6 && Math.abs(after[i + 2]) * 10 - 3.65 <= 16 * Math.SQRT2) expect((roadY(after[i]) - after[i + 1]) * 10).toBeGreaterThan(0.1);
    }
  });
});

describe("buildRoadMarkings", () => {
  it("paints a dashed centre line and two edge lines on a main road, and nothing on a lane under 5.5 m", () => {
    const flat = () => 18;
    const trunk = verts(buildRoadMarkings(lay([{ coords: [[0, 0], [0.01, 0]], highway: "trunk" }], flat)));
    // edge lines 25 cm in from each edge, the centre line on the crown, all just over the surface
    const lines = new Set(trunk.map((v) => Math.round(v.z * 1000)));
    expect([...lines].sort((a, b) => a - b)).toEqual([-345, -335, -5, 5, 335, 345]);
    // 1.5 cm over the carriageway, which falls 1 in 40 from its crown (18 m and the 5 cm lift)
    for (const v of trunk) expect((v.y - (18.005 - 0.025 * Math.abs(v.z))) * 10).toBeCloseTo(0.015, 4);
    // dashes: 4 m marks with 8 m gaps along 100 m
    const dashes = trunk.filter((v) => Math.abs(v.z) < 0.01);
    const xs = [...new Set(dashes.map((v) => v.x.toFixed(3)))].map(Number);
    const marked = xs.filter((x) => xs.some((o) => Math.abs(o - x - 0.4) < 1e-3)).length;
    expect(marked).toBe(Math.round(100 / 12));
    expect(buildRoadMarkings(lay([{ coords: [[0, 0], [0.01, 0]], highway: "unclassified" }], flat)).positions.length).toBe(0);
  });
});

describe("buildRoadStructures", () => {
  // a road crossing a 10 m wide, 5 m deep cut at x = 5 (the trail's), on the DTM's deck level
  const deck = () => 18;
  const cut = (x: number) => (Math.abs(x - 5) < 1 ? 17.5 : 18);
  const road = [{ coords: [[0, 0], [0.01, 0]] as [number, number][], highway: "trunk" }];
  const ground = { groundAt: cut, openAt: (x: number) => Math.abs(x - 5) < 0.4, ve: 1 };

  it("builds nothing under a road that lies on the ground", () => {
    const m = buildRoadStructures(lay(road, deck), { ...ground, groundAt: deck });
    expect(m.indices.length).toBe(0);
  });

  it("walls a road down to the ground beside the cut, and leaves the trail's opening clear under a deck", () => {
    const m = buildRoadStructures(lay(road, deck), ground);
    expect(m.indices.length).toBeGreaterThan(0);
    expect(m.positions.every(Number.isFinite)).toBe(true);
    for (const i of m.indices) expect(i).toBeLessThan(m.positions.length / 3);
    const v = verts(m);
    // the walls beside the opening reach into the cut's floor
    expect(v.some((p) => Math.abs(p.x - 5) > 0.4 && Math.abs(p.x - 5) < 1 && p.y <= 17.5)).toBe(true);
    // over the trail, nothing comes lower than the deck's underside, about 0.9 m below the road
    const over = v.filter((p) => Math.abs(p.x - 5) < 0.3);
    expect(over.length).toBeGreaterThan(0);
    for (const p of over) expect(p.y).toBeGreaterThan(18 - 0.1);
    // and the structure stays inside the cut, with a station of ground either side
    for (const p of v) expect(Math.abs(p.x - 5)).toBeLessThan(1.5);
  });
});

describe("roads on the real ground (the Maentwrog Road section)", () => {
  const cfg = configById("maentwrog");
  const { inputs } = loadSection(ROOT, cfg, { canopy: true, barriers: true, imagery: false });
  const scene = buildSectionScene(cfg, inputs, "photo");
  const m = 10 / cfg.ve;

  it("keeps the A470's overbridge at the DTM's deck level and stands every raised road on a structure", () => {
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

  it("passes the lane the line bridges at km 9.159 under its deck at the lidar's level, with no wall by the trail", () => {
    // OSM way 357873359 under the railway's bridge way 159029124 (span km 9.150-9.169); the 1 m lidar has the lane
    // 189.9 m under the span, 3.3 m below the trail
    const on = centrelineIndex(scene.trail, 0.4);
    const crossing = scene.roadLayout!.runs.flatMap((r) => r.stations).filter((s) => {
      const f = on(s.x, s.z);
      return f !== null && f.lateral < 0.2 && Math.abs(f.distM - 9159) < 10;
    });
    expect(crossing.length).toBeGreaterThan(0);
    for (const s of crossing) expect((scene.trail.sampleAt(9159).y - s.y) * m).toBeGreaterThan(2.5);
    const sp = scene.roadStructures.positions;
    const trail = scene.trail.sampleAt(9159);
    for (let i = 0; i < sp.length; i += 3) expect(Math.hypot(sp[i] - trail.x, sp[i + 2] - trail.z) * 10).toBeGreaterThan(20);
  });

  it("lays every road on its graded ground: nowhere buried, and walled only at its bridges", () => {
    const rp = scene.roads.positions;
    let buried = 0;
    let deep = 0;
    let checked = 0;
    for (let i = 0; i < rp.length; i += 3) {
      const g = scene.surfaceAt(rp[i], rp[i + 2]);
      if (!Number.isFinite(g)) continue;
      checked++;
      if ((rp[i + 1] - g) * m < 0) buried++;
      if ((rp[i + 1] - g) * m < -0.1) deep++;
    }
    // seated where the grid could not be graded level with it (seatRoads): nowhere more than rounding under
    expect(checked).toBeGreaterThan(1000);
    expect(buried / checked).toBeLessThan(0.001);
    expect(deep).toBe(0);
    // the structures are the two overbridges' decks and abutments, not walls along the roads: under 200 m of them
    const runM = scene.roadStructures.positions.length / 3 / 8 * 2;
    expect(runM).toBeLessThan(200);
  });
});

describe("roads beside the trail (the Trawsfynydd section)", () => {
  const cfg = configById("trawsfynydd");
  const { inputs } = loadSection(ROOT, cfg, { canopy: true, barriers: true, imagery: false });
  const scene = buildSectionScene(cfg, inputs, "photo");
  const m = 10 / cfg.ve;

  // before, the trail's grading held it up to 1.9 m over the lidar there, on a wall. Within a metre: at km 10.43, 14 m
  // from the trail on its embankment 2.5 m higher, one row of the 4 m grid's nodes is the trail's formation's or the
  // road's verge, and the road is seated on it
  it("keeps the A470 on its real level where it runs 11-17 m from the trail (km 10.25-10.8), not raised onto the trail's", () => {
    const near = centrelineIndex(scene.trail, 3);
    const raised: string[] = [];
    let checked = 0;
    for (const run of scene.roadLayout!.runs.filter((r) => r.highway === "trunk"))
      for (const s of run.stations) {
        const f = near(s.x, s.z);
        if (!f || f.distM < 10250 || f.distM > 10800 || f.lateral * 10 > 20) continue;
        checked++;
        const over = (s.y - scene.bareHeightAt(s.x, s.z)) * m;
        if (over > 1) raised.push(`km ${(f.distM / 1000).toFixed(3)}: ${over.toFixed(2)} m over the lidar`);
      }
    expect(checked).toBeGreaterThan(50);
    expect(raised).toEqual([]);
  });
});
