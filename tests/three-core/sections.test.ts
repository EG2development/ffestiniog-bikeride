import { describe, expect, it } from "vitest";
import { buildPocExtras, buildPocScene, POC, type OsmLine, type PocInputs } from "../../src/three-core/poc";
import { validateFeatures } from "../../src/three-core/registers";
import type { TrailProfile } from "../../src/three-core/trail";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { load } from "./pending";
import { analyticRider, analyticTrail, readJson, readProjectFile, realRoute, syntheticProfile } from "./fixtures";

// Every section is built from one config by one assembly (spec RL4; ADRs 27, 40).
type Shot = { kind: string; frames: number };
type SectionConfig = { id: string; title: string; kind: "ground" | "aerial"; kmRange: [number, number]; window: string; frames: number; startDistM: number; shots: Shot[]; captionIds: string[]; featureIds: string[]; ve: number };
type Sections = {
  SECTIONS: Record<string, SectionConfig>;
  buildSectionScene: (cfg: SectionConfig, inputs: PocInputs & { osm: OsmLine[]; features: ReturnType<typeof validateFeatures> }) => { table: Float64Array; terrain: { positions: Float32Array }; trail: { samples: unknown[] }; shot: (f: number) => { position: number[] }; water: unknown };
};
const WINDOWS = ["corridor", "blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"];

function pocInputs(): PocInputs & { osm: OsmLine[]; features: ReturnType<typeof validateFeatures> } {
  const header = readJson<DemGrid & { file: string }>("public/data/dem-poc.json");
  const buf = readProjectFile("public/data/dem-poc.f32");
  const dem: DemGrid = { ...header, heights: new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), sourceIndex: new Uint8Array(readProjectFile("public/data/dem-poc-source.u8")) };
  const land: LandCover = { legend: readJson<{ legend: string[] }>("public/data/landcover-poc.json").legend, classes: new Uint8Array(readProjectFile("public/data/landcover-poc.u8")) };
  return {
    route: realRoute(),
    dem,
    land,
    profile: readJson<TrailProfile>("public/data/trail-profile-poc.json"),
    osm: readJson<{ features: OsmLine[] }>("public/data/osm-poc.geojson").features,
    features: validateFeatures(readJson<unknown>("data/features-3d.json")),
  };
}

describe("section configs (RL4)", () => {
  it("every config has a known window, a km range on the route and shots that fill its frames", async () => {
    const { SECTIONS } = await load<Sections>("src/three-core/sections.ts");
    const ids = Object.keys(SECTIONS);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    for (const [id, c] of Object.entries(SECTIONS)) {
      expect(c.id).toBe(id);
      expect(WINDOWS, `${id}.window`).toContain(c.window);
      expect(c.kmRange[0]).toBeGreaterThanOrEqual(0);
      expect(c.kmRange[1]).toBeLessThanOrEqual(13.24);
      expect(c.kmRange[0]).toBeLessThan(c.kmRange[1]);
      expect(c.frames).toBeGreaterThan(0);
      expect(c.shots.reduce((n, s) => n + s.frames, 0), `${id} shots sum to frames`).toBe(c.frames);
      expect(c.ve).toBe(1);
      expect(c.featureIds.length, `${id} declares register ids`).toBeGreaterThan(0);
    }
    expect(new Set(Object.values(SECTIONS).map((c) => c.window)).size).toBe(WINDOWS.length);
  });

  it("ADR 40: the Maentwrog config reproduces the POC scene exactly", async () => {
    const { SECTIONS, buildSectionScene } = await load<Sections>("src/three-core/sections.ts");
    const cfg = SECTIONS.maentwrog;
    expect(cfg.kmRange).toEqual([POC.section.startKm, POC.section.endKm]);
    expect(cfg.startDistM).toBe(POC.startDistM);
    expect(cfg.frames).toBe(POC.frames);
    const inputs = pocInputs();
    const poc = buildPocScene(inputs);
    const extras = buildPocExtras({ ...inputs, bridgeIds: cfg.featureIds }, poc);
    const scene = buildSectionScene(cfg, inputs);
    expect(Array.from(scene.table)).toEqual(Array.from(poc.table));
    expect(scene.trail.samples.length).toBe(poc.trail.samples.length);
    expect(scene.terrain.positions.length).toBe(poc.terrain.positions.length);
    for (const f of [0, 90, 180, 359]) expect(scene.shot(f).position).toEqual(poc.shot(f).position);
    expect(extras.bridges.length).toBeGreaterThan(0);
  });
});

describe("sections after the t10 review", () => {
  const WINDOW_INPUTS = (id: string) => {
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
  };

  it("R1: draws every railway bridge the window's register holds", async () => {
    const { SECTIONS, buildSectionScene } = await load<Sections>("src/three-core/sections.ts");
    const inputs = WINDOW_INPUTS("blaenau");
    const registered = inputs.features.filter((f) => f.kind === "structure" && f.id.startsWith("bridge-blaenau-")).length;
    expect(registered).toBeGreaterThan(0);
    expect((buildSectionScene(SECTIONS.blaenau, inputs) as unknown as { bridges: unknown[] }).bridges.length).toBe(registered);
  });

  it("R4: a follow shot's rider clearance reads the rider at the section frame, not the shot's local frame", async () => {
    const { shotsOf } = await load<{ shotsOf: (cfg: unknown, scene: unknown) => (f: number) => { position: number[] } }>("src/three-core/sections.ts");
    const trail = analyticTrail(1000, syntheticProfile(1000));
    const rider = analyticRider(trail, 100, 30);
    const heightAt = () => -1e3; // far below everything: only the rider rule can move the camera
    const cfg = { id: "t", kind: "ground", frames: 20, shots: [{ kind: "drone-side", fromDistM: 80, toDistM: 120, startHeightM: 50, endHeightM: 30, sideM: 40, frames: 10 }, { kind: "follow", backM: 0.5, upM: 0.2, sideM: 0, frames: 10 }] };
    const shot = shotsOf(cfg, { trail, riderAt: rider.riderAt, heightAt, poseAt: rider.poseAt });
    const cam = shot(15).position; // local frame 5 of the follow shot = section frame 15
    const r = rider.riderAt(15);
    expect(Math.hypot(cam[0] - r[0], cam[1] - r[1], cam[2] - r[2]) * 10).toBeGreaterThanOrEqual(1.5 - 1e-6);
  });

  it("R3: followStartFrame is the number of frames before the first follow shot", async () => {
    const { SECTIONS, followStartFrame } = await loadExportsOf<{ SECTIONS: Record<string, SectionConfig>; followStartFrame: (c: SectionConfig) => number }>();
    expect(followStartFrame(SECTIONS.maentwrog)).toBe(180);
    expect(followStartFrame(SECTIONS.blaenau)).toBe(150);
    expect(followStartFrame(SECTIONS["vale-north"])).toBe(135);
    expect(followStartFrame(SECTIONS.intro)).toBe(SECTIONS.intro.frames);
  });
});

async function loadExportsOf<T extends Record<string, unknown>>(): Promise<T> {
  const m = await load<T>("src/three-core/sections.ts");
  if (!("followStartFrame" in m)) throw new Error("src/three-core/sections.ts does not export followStartFrame yet");
  return m;
}

