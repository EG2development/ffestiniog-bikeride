import { describe, expect, it } from "vitest";
import { BARRIER_SIZES, barrierKind, barrierLines, buildBarrierMeshes } from "../../src/three-core/barriers";
import type { OsmLine } from "../../src/three-core/registers";
import { analyticTrail, syntheticProfile, syntheticRoute } from "./fixtures";

// Field boundaries from OSM barrier ways (docs/adr/0058-walls-and-hedges-from-osm.md).

const route = syntheticRoute();
const p0 = route.routePoints[0];
const line = (id: string, tags: Record<string, string>, pts: [number, number][]): OsmLine => ({ properties: { id, tags }, geometry: { type: "LineString", coordinates: pts } });
// a 100 m wall running east from the route's start, across flat ground at 180 m
const east = (m: number): [number, number] => [p0.lon + m / (111320 * Math.cos((p0.lat * Math.PI) / 180)), p0.lat];
const flat = () => 18;

describe("barrierKind and barrierLines", () => {
  it("classes OSM tags into walls, hedges and fences and keeps a plausible tagged height only", () => {
    expect(barrierKind({ barrier: "wall" })).toBe("wall");
    expect(barrierKind({ barrier: "city_wall" })).toBe("wall");
    expect(barrierKind({ barrier: "retaining_wall" })).toBe("wall");
    expect(barrierKind({ barrier: "hedge" })).toBe("hedge");
    expect(barrierKind({ natural: "tree_row" })).toBe("hedge");
    expect(barrierKind({ barrier: "fence" })).toBe("fence");
    expect(barrierKind({ barrier: "gate" })).toBeNull();
    expect(barrierKind({ highway: "track" })).toBeNull();
    const lines = barrierLines([
      line("way/1", { barrier: "wall", height: "1.5" }, [east(0), east(10)]),
      line("way/2", { barrier: "wall", height: "15" }, [east(0), east(10)]),
      line("way/3", { barrier: "wall", height: "tall" }, [east(0), east(10)]),
      line("way/4", { barrier: "gate" }, [east(0), east(10)]),
      { ...line("way/5", { barrier: "wall" }, [east(0), east(10)]), geometry: { type: "Polygon", coordinates: [[east(0), east(10), east(5)]] } },
    ]);
    expect(lines.map((l) => [l.id, l.kind, l.heightM])).toEqual([["way/1", "wall", 1.5], ["way/2", "wall", undefined], ["way/3", "wall", undefined]]);
  });
});

describe("buildBarrierMeshes", () => {
  it("lofts a wall of its kind's section along the ground, embedded 0.3 m, with finite geometry and UVs per vertex", () => {
    const lines = barrierLines([line("way/1", { barrier: "wall" }, [east(0), east(100)])]);
    const { wall, hedge, fence } = buildBarrierMeshes(lines, route.project, flat, { ve: 1 });
    expect(hedge.positions.length).toBe(0);
    expect(fence.positions.length).toBe(0);
    expect(wall.positions.length).toBeGreaterThan(0);
    expect(wall.positions.every(Number.isFinite)).toBe(true);
    expect(wall.uvs!.length).toBe((wall.positions.length / 3) * 2);
    const count = wall.positions.length / 3;
    expect(wall.indices.every((i) => i < count)).toBe(true);
    const ys = Array.from({ length: count }, (_, i) => wall.positions[3 * i + 1]);
    expect(Math.min(...ys) * 10).toBeCloseTo(180 - 0.3, 3); // float32 positions
    expect(Math.max(...ys) * 10).toBeCloseTo(180 + BARRIER_SIZES.wall.heightM, 3);
    // the box is 0.6 m wide: every vertex lies within 0.3 m of the line, measured across it (the line is not axis-aligned)
    const [a, b] = [route.project(...east(0)), route.project(...east(100))];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    const across = Array.from({ length: count }, (_, i) => ((wall.positions[3 * i] - a.x) * (b.y - a.y) - (wall.positions[3 * i + 2] - a.y) * (b.x - a.x)) / l);
    expect((Math.max(...across) - Math.min(...across)) * 10).toBeCloseTo(BARRIER_SIZES.wall.widthM, 3);
  });

  it("uses the tagged height, draws hedges and fences in their own meshes, and follows a slope", () => {
    const lines = barrierLines([line("way/1", { barrier: "hedge", height: "2.5" }, [east(0), east(40)]), line("way/2", { barrier: "fence" }, [east(50), east(100)])]);
    const flatOut = buildBarrierMeshes(lines, route.project, flat, { ve: 1 });
    expect(flatOut.wall.positions.length).toBe(0);
    const tops = (m: { positions: Float32Array }, ground: (x: number, z: number) => number) => Array.from({ length: m.positions.length / 3 }, (_, i) => (m.positions[3 * i + 1] - ground(m.positions[3 * i], m.positions[3 * i + 2])) * 10);
    expect(Math.max(...tops(flatOut.hedge, flat))).toBeCloseTo(2.5, 3);
    expect(flatOut.fence.positions.length).toBeGreaterThan(0);
    expect(Math.max(...tops(flatOut.fence, flat))).toBeLessThanOrEqual(BARRIER_SIZES.fence.heightM + 1e-3);
    expect(flatOut.fence.indices.length / 3, "posts every 3 m over 50 m plus two rails").toBeGreaterThan(16 * 8);
    // on a slope every vertex stays within a face's lateral reach of its station's ground: between 0.3 m below and the height above
    const slope = (x: number) => 18 + x * 0.1;
    const { hedge, fence } = buildBarrierMeshes(lines, route.project, slope, { ve: 1 });
    for (const t of tops(hedge, slope)) {
      expect(t).toBeGreaterThanOrEqual(-0.3 - 0.1);
      expect(t).toBeLessThanOrEqual(2.5 + 0.1);
    }
    expect(fence.positions.every(Number.isFinite)).toBe(true);
  });

  it("leaves a gap where a boundary crosses the proposed trail, and drops stations off the terrain", () => {
    // the analytic trail runs along +x from the origin; a wall crossing it at d = 500 m runs along z
    const trail = analyticTrail(1000, syntheticProfile(1000));
    const { lon, lat } = route.unproject(50, -5);
    const { lon: lon1, lat: lat1 } = route.unproject(50, 5);
    const lines = barrierLines([line("way/1", { barrier: "wall" }, [[lon, lat], [lon1, lat1]])]);
    const open = buildBarrierMeshes(lines, route.project, () => 18, { ve: 1, trail, gapM: 3 });
    const closed = buildBarrierMeshes(lines, route.project, () => 18, { ve: 1 });
    const zs = (m: { positions: Float32Array }) => Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions[3 * i + 2]);
    expect(zs(closed.wall).some((z) => Math.abs(z) < 0.2)).toBe(true);
    expect(zs(open.wall).some((z) => Math.abs(z - trail.sampleAt(500).z) < 0.25), "no wall vertex within 2.5 m of the centreline").toBe(false);
    expect(open.wall.positions.length).toBeGreaterThan(0);
    const partly = buildBarrierMeshes(lines, route.project, (x, z) => (z > 0 ? 18 : -Infinity), { ve: 1 });
    expect(partly.wall.positions.every(Number.isFinite)).toBe(true);
    expect(zs(partly.wall).every((z) => z > -0.05)).toBe(true);
  });
});
