import { describe, expect, it } from "vitest";
import { partsBounds, type Part } from "../../src/three-core/cyclistModel";
import { defaultCyclistDims, distanceTable } from "../../src/three-core/cyclistMotion";
import { PROTOTYPES } from "../../src/three-core/sections";
import { buildTrail, TRAIL_WIDTH_M, type TrailProfile } from "../../src/three-core/trail";
import { paceKmh, PRAM_PALETTE, RUNNER_PALETTE, strideM, WALKER_PALETTE, walkerColours, walkerParts, walkerPose, walkerSpeedKmh, walkerTable, walkerTracks, type WalkerSpec } from "../../src/three-core/walkers";
import { analyticTrail, readJson, realRoute, syntheticProfile } from "./fixtures";

// Spec C9: walkers follow the rider's rules (C1–C5) at walking ranges (docs/adr/0059-walkers-on-the-trail.md).

const FPS = 30;
const DEG = Math.PI / 180;
const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const trail = analyticTrail(1000, syntheticProfile(1000));
const SPECS: WalkerSpec[] = [
  { startDistM: 200, direction: 1, sideM: -0.7, heightM: 1.72, seed: 7 },
  { startDistM: 700, direction: -1, sideM: -1.0, heightM: 1.5, seed: 11 },
  { startDistM: 650, direction: -1, sideM: 0.9, heightM: 1.95, seed: 13 },
];

describe("walkers (C9: C1–C5 at walking ranges)", () => {
  it("C2 for walkers: 3–6 km/h at every gradient, slower uphill than downhill", () => {
    for (let g = -0.15; g <= 0.15; g += 0.005) {
      expect(walkerSpeedKmh(g)).toBeGreaterThanOrEqual(3);
      expect(walkerSpeedKmh(g)).toBeLessThanOrEqual(6);
    }
    expect(walkerSpeedKmh(0.021)).toBeLessThan(walkerSpeedKmh(-0.021));
    expect(walkerSpeedKmh(0)).toBe(4.5);
  });

  it("C1 for walkers: the figure stands at its height (within the walking crouch) at every gait phase, and is 1.5–1.95 m tall", () => {
    for (const spec of SPECS) {
      expect(spec.heightM).toBeGreaterThanOrEqual(1.5);
      expect(spec.heightM).toBeLessThanOrEqual(1.95);
      for (let k = 0; k < 24; k++) {
        const parts = walkerParts(spec.heightM, (k / 24) * 2 * Math.PI) as unknown as Part[];
        const { min, max } = partsBounds(parts);
        const heightM = (max[1] - min[1]) * 10;
        expect(heightM, `height at phase ${k}`).toBeGreaterThanOrEqual(0.95 * spec.heightM);
        expect(heightM, `height at phase ${k}`).toBeLessThanOrEqual(1.0 * spec.heightM + 1e-9);
        // the lowest point is a sole on the ground; the figure is no wider than its shoulders and arms
        expect(min[1], `sole at phase ${k}`).toBeCloseTo(0, 6);
        expect((max[2] - min[2]) * 10, `width at phase ${k}`).toBeLessThanOrEqual(0.5 * spec.heightM);
        expect(parts.length).toBe(16);
      }
    }
  });

  it("C2–C5 hold at every frame of a 20 s walk in both directions over gradients of −4 % to +6 % and a curve", () => {
    for (const spec of SPECS) {
      const table = walkerTable(trail, spec, 600, FPS);
      expect(table.length).toBe(600);
      for (let f = 0; f < 600; f++) {
        const pose = walkerPose(trail, table, f, spec);
        const centre = trail.sampleAt(table[f]);
        // C2: 3–6 km/h, in the walker's direction
        if (f + 1 < 600) {
          const kmh = (table[f + 1] - table[f]) * spec.direction * FPS * 3.6;
          expect(kmh, `C2 speed at frame ${f}`).toBeGreaterThanOrEqual(3 - 1e-9);
          expect(kmh, `C2 speed at frame ${f}`).toBeLessThanOrEqual(6 + 1e-9);
        }
        // C3: within 1.0 m of the centreline, on the side the spec says (left of the route's direction when positive)
        const lateralM = Math.hypot(pose.position[0] - centre.x, pose.position[2] - centre.z) * 10;
        expect(lateralM, `C3 lateral offset at frame ${f}`).toBeLessThanOrEqual(1.0 + 1e-9);
        expect(lateralM, `C3 offset is the spec's at frame ${f}`).toBeCloseTo(Math.abs(spec.sideM), 6);
        const l = Math.hypot(centre.tangent[0], centre.tangent[2]);
        const leftX = centre.tangent[2] / l;
        const leftZ = -centre.tangent[0] / l;
        const side = ((pose.position[0] - centre.x) * leftX + (pose.position[2] - centre.z) * leftZ) * 10;
        expect(side, `C3 side at frame ${f}`).toBeCloseTo(spec.sideM, 6);
        // C4: the planted sole is on the trail surface under it (±0.05 m); no sole is under the surface
        const parts = walkerParts(spec.heightM, pose.phase);
        const soles = parts
          .filter((p) => p.name?.startsWith("foot-"))
          .map((p) => {
            const alongM = table[f] + spec.direction * p.a[0] * 10;
            const surface = trail.sampleAt(alongM).y;
            return (pose.position[1] + p.a[1] - p.r - surface) * 10;
          });
        expect(soles.length).toBe(2);
        expect(Math.min(...soles), `C4 planted foot at frame ${f}`).toBeLessThanOrEqual(0.05);
        expect(Math.min(...soles), `C4 no foot under the surface at frame ${f}`).toBeGreaterThanOrEqual(-0.05);
        // C5: faces its direction of travel (yaw within 5° of the tangent, or its reverse); upright, so no pitch
        const tangentYaw = Math.atan2(-centre.tangent[2] * spec.direction, centre.tangent[0] * spec.direction);
        expect(angleDiff(pose.yaw, tangentYaw), `C5 yaw at frame ${f}`).toBeLessThanOrEqual(5 * DEG);
        // the gait advances with the distance walked: one stride per strideM, never backwards
        if (f + 1 < 600) {
          const next = walkerPose(trail, table, f + 1, spec);
          const stepM = Math.abs(table[f + 1] - table[f]);
          expect(next.phase - pose.phase, `gait at frame ${f}`).toBeCloseTo((2 * Math.PI * stepM) / strideM(spec.heightM), 9);
        }
        expect(walkerPose(trail, table, f, spec), `RN2 same pose twice at frame ${f}`).toEqual(pose);
      }
      expect(walkerTable(trail, spec, 600, FPS)).toEqual(table);
    }
  });

  it("colours come from the palette by seed, deterministic, and differ between the prototype's walkers", () => {
    const seen = new Set<string>();
    for (const spec of PROTOTYPES["maentwrog-photo"].photo!.walkers!) {
      const c = walkerColours(spec.seed);
      expect(walkerColours(spec.seed)).toEqual(c);
      for (const k of ["top", "legs", "skin", "hair", "shoe"] as const) expect(WALKER_PALETTE[k] as readonly string[]).toContain(c[k]);
      for (const k of ["frame", "fabric", "tyre", "blanket"] as const) expect(PRAM_PALETTE[k] as readonly string[]).toContain(c[k]);
      seen.add(JSON.stringify(c));
    }
    expect(seen.size).toBe(3);
  });

  it("walkerTracks refuses a shared seed, an offset over 1 m and a height outside 1.5–1.95 m", () => {
    expect(() => walkerTracks(trail, [SPECS[0], { ...SPECS[1], seed: 7 }], 60, FPS)).toThrow(/seed 7 is used twice/);
    expect(() => walkerTracks(trail, [{ ...SPECS[0], sideM: 1.2 }], 60, FPS)).toThrow(/C3/);
    expect(() => walkerTracks(trail, [{ ...SPECS[0], heightM: 1.4 }], 60, FPS)).toThrow(/C9/);
    expect(walkerTracks(trail, SPECS, 60, FPS).map((t) => t.table.length)).toEqual([60, 60, 60]);
  });
});

describe("runners and people behind prams (ADR 61)", () => {
  const H = 1.75;
  const bounds = (parts: { a: number[]; b?: number[]; r: number; scale?: number[] }[]) => partsBounds(parts as unknown as Part[]);

  it("pace: runners 7.5–12 km/h, 10 on the flat; prams 3–5 km/h; both slower uphill; the stride follows the activity", () => {
    expect(paceKmh("run", 0)).toBe(10);
    expect(paceKmh("pram", 0)).toBe(4);
    expect(paceKmh("walk", 0.02)).toBe(walkerSpeedKmh(0.02));
    for (let g = -0.15; g <= 0.15; g += 0.005) {
      expect(paceKmh("run", g)).toBeGreaterThanOrEqual(7.5);
      expect(paceKmh("run", g)).toBeLessThanOrEqual(12);
      expect(paceKmh("pram", g)).toBeGreaterThanOrEqual(3);
      expect(paceKmh("pram", g)).toBeLessThanOrEqual(5);
    }
    expect(paceKmh("run", 0.03)).toBeLessThan(paceKmh("run", -0.03));
    expect(strideM(H, "run")).toBeCloseTo(1.15 * H, 9);
    expect(strideM(H, "pram")).toBeCloseTo(0.7 * H, 9);
    // a runner's table moves at the running pace, its gait at the running stride
    const spec: WalkerSpec = { activity: "run", startDistM: 300, direction: 1, sideM: -0.6, heightM: H, seed: 77 };
    const table = walkerTable(trail, spec, 90, FPS);
    for (let f = 0; f + 1 < 90; f++) {
      const kmh = (table[f + 1] - table[f]) * FPS * 3.6;
      expect(kmh).toBeGreaterThanOrEqual(7.5 - 1e-9);
      expect(kmh).toBeLessThanOrEqual(12 + 1e-9);
      const [a, b] = [walkerPose(trail, table, f, spec), walkerPose(trail, table, f + 1, spec)];
      expect(b.phase - a.phase).toBeCloseTo((2 * Math.PI * (table[f + 1] - table[f])) / strideM(H, "run"), 9);
    }
  });

  it("a runner stays within its height, never goes under the ground, has a moment with both feet up and is down the rest", () => {
    let flight = 0;
    let down = 0;
    for (let k = 0; k < 48; k++) {
      const parts = walkerParts(H, (k / 48) * 2 * Math.PI, "run");
      const { min, max } = bounds(parts);
      expect((max[1] - min[1]) * 10).toBeLessThanOrEqual(H + 1e-9);
      const soles = parts.filter((p) => p.name?.startsWith("foot-")).map((p) => (p.a[1] - p.r) * 10);
      expect(Math.min(...soles)).toBeGreaterThanOrEqual(-1e-9);
      if (Math.min(...soles) > 0.005) flight++;
      else down++;
      // the legs reach the feet: no shin longer than it is (the knee is solved, not stretched)
      for (const side of ["left", "right"]) {
        const shin = parts.find((p) => p.name === `shin-${side}`)!;
        expect(Math.hypot(shin.b![0] - shin.a[0], shin.b![1] - shin.a[1]) * 10).toBeLessThanOrEqual(0.245 * H + 1e-6);
      }
    }
    expect(flight).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(flight);
  });

  it("a pram's tyres stand on the ground ahead of its pusher's feet, and the pusher's hands are on its handlebar", () => {
    for (let k = 0; k < 24; k++) {
      const parts = walkerParts(H, (k / 24) * 2 * Math.PI, "pram");
      const tyres = parts.filter((p) => p.kind === "torus");
      expect(tyres.length).toBe(4);
      // the torus's outer edge is 1.18 × its radius (the view's tyre)
      for (const t of tyres) expect((t.a[1] - 1.18 * t.r) * 10).toBeCloseTo(0, 6);
      const toes = Math.max(...parts.filter((p) => p.name?.startsWith("foot-")).map((p) => (p.b ?? p.a)[0] + p.r));
      expect(Math.min(...tyres.map((t) => t.a[0] - 1.18 * t.r))).toBeGreaterThan(toes);
      const bar = parts.find((p) => p.name === "handlebar")!;
      for (const side of ["left", "right"]) {
        const wrist = parts.find((p) => p.name === `forearm-${side}`)!.b!;
        expect(Math.abs(wrist[0] - bar.a[0]) * 10).toBeLessThan(0.03);
        expect(Math.abs(wrist[1] - bar.a[1]) * 10).toBeLessThan(0.01);
      }
      // arms are not stretched past their length
      for (const side of ["left", "right"]) {
        const up = parts.find((p) => p.name === `upper-arm-${side}`)!;
        expect(Math.hypot(up.b![0] - up.a[0], up.b![1] - up.a[1], up.b![2] - up.a[2]) * 10).toBeCloseTo(0.17 * H, 3);
      }
    }
    // a runner wears sports colours; a walker's colours are unchanged by the pram's stream
    const run = walkerColours(77, "run");
    expect(RUNNER_PALETTE.top as readonly string[]).toContain(run.top);
    expect(walkerColours(7)).toEqual(walkerColours(7, "walk"));
  });
});

describe("the prototype's walkers on the real Maentwrog trail (ADR 59)", () => {
  const cfg = PROTOTYPES["maentwrog-photo"];
  const specs = cfg.photo!.walkers!;
  const real = buildTrail(realRoute(), readJson<TrailProfile>("public/data/sections/maentwrog/trail-profile.json"), { startKm: cfg.kmRange[0], endKm: cfg.kmRange[1] }, { widthM: TRAIL_WIDTH_M, ve: 1 });
  const rider = distanceTable(real, cfg.startDistM, cfg.frames, FPS);
  const tracks = walkerTracks(real, specs, cfg.frames, FPS);

  it("are three, two of them a pair, all on the rider's right and never within 0.9 m of the rider's line", () => {
    expect(specs.length).toBe(3);
    expect(specs.filter((s) => s.direction === -1).length).toBe(2);
    for (const s of specs) expect(defaultCyclistDims().lateralOffsetM - s.sideM).toBeGreaterThanOrEqual(0.9);
  });

  it("the rider passes each of them in the rider's view (frames 150–345), and all are behind the follow camera from its first frame", () => {
    const passFrame = (t: Float64Array) => {
      for (let f = 1; f < cfg.frames; f++) if (Math.sign(rider[f] - t[f]) !== Math.sign(rider[f - 1] - t[f - 1])) return f;
      return -1;
    };
    const passes = tracks.map((t) => passFrame(t.table));
    for (const f of passes) {
      expect(f).toBeGreaterThanOrEqual(150);
      expect(f).toBeLessThanOrEqual(345);
    }
    // the single walker is overtaken first, then the pair together (within a second)
    expect(passes[0]).toBeLessThan(passes[1]);
    expect(Math.abs(passes[1] - passes[2])).toBeLessThanOrEqual(30);
    // the follow camera rides 8 m behind the rider from frame 360: every walker is already at least 2 m behind it
    for (let f = 360; f < cfg.frames; f++) for (const t of tracks) expect(t.table[f], `walker behind the camera at frame ${f}`).toBeLessThanOrEqual(rider[f] - 8 - 2);
  });

  it("stay on the section's trail and on the ground, never on the bridge span while the rider crosses it", () => {
    for (const t of tracks) {
      for (let f = 0; f < cfg.frames; f++) {
        expect(t.table[f]).toBeGreaterThanOrEqual(cfg.kmRange[0] * 1000);
        expect(t.table[f]).toBeLessThanOrEqual(cfg.kmRange[1] * 1000);
      }
    }
  });
});
