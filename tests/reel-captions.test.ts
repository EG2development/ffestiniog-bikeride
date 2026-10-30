import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { load } from "./three-core/pending";

// Captions are data with frame ranges (spec RL17–RL22; ADR 36).
type Caption = { id: string; text: string; from: number; to: number; position: string; scene?: string };
const captions = async () => (await load<{ CAPTIONS: Caption[] }>("src/data/reel-captions.ts")).CAPTIONS;
const one = (list: Caption[], id: string) => {
  const c = list.find((x) => x.id === id);
  expect(c, `caption "${id}"`).toBeDefined();
  return c!;
};
// Overlays fade 15 frames in and out (one that runs to the last frame keeps its fade-out past the end),
// so "fully visible" is the range less the fades (t13 audit).
const FADE = 15;
const fullFrames = (c: Caption) => c.to - c.from - FADE * (c.to >= 2700 ? 1 : 2);
const within = (c: Caption, from: number, to: number, minFrames: number) => {
  expect(c.from, `${c.id} starts in range`).toBeGreaterThanOrEqual(from);
  expect(c.to, `${c.id} ends in range`).toBeLessThanOrEqual(to);
  expect(fullFrames(c), `${c.id} fully visible ≥ ${minFrames} frames`).toBeGreaterThanOrEqual(minFrames);
};

describe("reel captions", () => {
  it("RL17/RL22: the disclaimer and the attribution cover every frame", async () => {
    const list = await captions();
    const d = one(list, "disclaimer");
    expect([d.from, d.to]).toEqual([0, 2700]);
    expect(d.text).toContain("not an approved route");
    const a = one(list, "attribution");
    expect([a.from, a.to]).toEqual([0, 2700]);
    for (const word of ["lidar", "OpenStreetMap", "OpenTopoMap", "not survey-grade"]) expect(a.text).toContain(word);
  });

  it("RL18: the concept card is fully visible for ≥ 5 s at the start or the end", async () => {
    const c = one(await captions(), "concept-card");
    expect(c.text).toBe("Concept visualisation only. Not an approved cycle route, engineering design or confirmation of landowner agreement.");
    const atStart = c.from >= 0 && c.to <= 240;
    const atEnd = c.from >= 2400 && c.to <= 2700;
    expect(atStart || atEnd, "inside scene 1 or scene 8").toBe(true);
    expect(fullFrames(c), "fully visible ≥ 5 s").toBeGreaterThanOrEqual(150);
  });

  it("RL19: the heritage note never calls the line abandoned and lasts ≥ 4 s in scene 2 or 8", async () => {
    const c = one(await captions(), "heritage");
    expect(c.text.toLowerCase()).toMatch(/heritage/);
    expect(c.text.toLowerCase()).toMatch(/proposed/);
    expect(c.text.toLowerCase()).not.toMatch(/abandon/);
    const inScene2 = c.from >= 240 && c.to <= 480;
    const inScene8 = c.from >= 2400 && c.to <= 2700;
    expect(inScene2 || inScene8).toBe(true);
    expect(fullFrames(c), "fully visible ≥ 4 s").toBeGreaterThanOrEqual(120);
  });

  it("RL20/RL21: live station, private home and decommissioning site sit in their scenes", async () => {
    const list = await captions();
    const live = one(list, "live-station");
    expect(live.text).toContain("still a live station");
    within(live, 780, 1080, 120);
    within(one(list, "private-home"), 1620, 1920, 90);
    const site = one(list, "decommissioning");
    expect(site.text).toContain("decommissioning site");
    expect(site.text).toContain("not part of the proposed trail");
    within(site, 1920, 2400, 90);
  });

  it("ADR 36: no caption text is written inside a 3D composition", () => {
    const dir = resolve(__dirname, "../src/scenes3d");
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    for (const file of walk(dir)) {
      const src = readFileSync(file, "utf8");
      for (const phrase of ["Concept visualisation", "mothballed", "Proposed trail", "not survey-grade"]) {
        expect(src.includes(phrase), `${file.replace(dir, "scenes3d")} holds the text "${phrase}" (it belongs in reel-captions.ts)`).toBe(false);
      }
    }
  });
});

describe("section captionIds (t10 review R10)", () => {
  it("every section's captionIds names a caption that overlaps the section's reel range", async () => {
    const list = await captions();
    const { SECTIONS } = await load<{ SECTIONS: Record<string, { id: string; captionIds: string[]; frames: number }> }>("src/three-core/sections.ts");
    const { REEL_SCENES } = await load<{ REEL_SCENES: { config: string; from: number; frames: number }[] }>("src/data/reel-timeline.ts");
    for (const cfg of Object.values(SECTIONS)) {
      const scenes = REEL_SCENES.filter((s) => s.config === cfg.id);
      expect(scenes.length, `${cfg.id} is in the reel`).toBeGreaterThan(0);
      for (const id of cfg.captionIds) {
        const c = list.find((x) => x.id === id);
        expect(c, `${cfg.id}: caption ${id}`).toBeDefined();
        expect(scenes.some((s) => c!.from < s.from + s.frames && c!.to > s.from), `${cfg.id}: ${id} overlaps the scene`).toBe(true);
      }
    }
    const src = readFileSync(resolve(__dirname, "../src/scenes3d/Section3D.tsx"), "utf8");
    expect(src, "Section3D reads captionIds").toContain("captionIds");
  });
});


// Reading pace (spec CL8; ADR 48; pseudocode-reel-v2 §4.6): full-opacity time ≥ max(2.5 s, characters ÷ 15).
describe("captions are on screen long enough to read (CL8)", () => {
  const pace = (list: Caption[], total: number) =>
    list
      .filter((c) => c.position !== "badge" && c.position !== "attribution")
      .map((c) => ({ c, full: c.to - c.from - FADE * (c.to >= total ? 1 : 2), need: Math.max(75, Math.ceil((c.text.length / 15) * 30)) }))
      .filter((x) => x.full < x.need)
      .map((x) => `${x.c.id}: ${(x.full / 30).toFixed(1)} s for ${x.c.text.length} characters (needs ${(x.need / 30).toFixed(1)} s)`);

  it("in the reel", async () => {
    expect(pace(await captions(), 2700)).toEqual([]);
  });

  it("in the proof of concept", async () => {
    const { POC_CAPTIONS } = await load<{ POC_CAPTIONS: Caption[] }>("src/data/reel-captions.ts");
    expect(pace(POC_CAPTIONS, 360)).toEqual([]);
  });

  it("in the photoreal proof of concept, which labels the trail a proposal as it first appears (H2b)", async () => {
    const { PHOTO_CAPTIONS } = await load<{ PHOTO_CAPTIONS: Caption[] }>("src/data/reel-captions.ts");
    expect(pace(PHOTO_CAPTIONS, 600)).toEqual([]);
    const ids = PHOTO_CAPTIONS.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["disclaimer", "attribution", "proposed-label", "closing"]));
    expect(PHOTO_CAPTIONS.find((c) => c.id === "proposed-label")!.from).toBe(0);
    expect(PHOTO_CAPTIONS.find((c) => c.id === "closing")!.to).toBe(600);
    for (const c of PHOTO_CAPTIONS) expect(c.to, c.id).toBeLessThanOrEqual(600);
  });

  it("keeps the required statements however the text is shortened", async () => {
    const byId = Object.fromEntries((await captions()).map((c) => [c.id, c.text]));
    const required: Record<string, string[]> = {
      "live-station": ["still a live station"],
      decommissioning: ["decommissioning site", "not part of the proposed trail"],
      heritage: ["eritage", "proposed", "rail-with-trail"],
      attribution: ["lidar", "OpenStreetMap", "OpenTopoMap", "not survey-grade"],
    };
    for (const [id, phrases] of Object.entries(required)) for (const p of phrases) expect(byId[id], `${id} keeps "${p}"`).toContain(p);
  });
});
