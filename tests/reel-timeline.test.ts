import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { load } from "./three-core/pending";

// The frame budget of the reel equals the spec's table and sums to 2,700 (spec RL2; ADR 28).
type Scene = { id: string; section: string; from: number; frames: number };
type Timeline = { REEL_FPS: number; REEL_FRAMES: number; REEL_SCENES: Scene[] };
const WINDOWS = ["corridor", "blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"];

function specBudget(): { from: number; frames: number }[] {
  const spec = readFileSync(resolve(__dirname, "../docs/spec-3d.md"), "utf8");
  return [...spec.matchAll(/^\| [1-8] \| .*? \| (\d+)–\d+ \((\d+)\) \|/gm)].map((m) => ({ from: Number(m[1]), frames: Number(m[2]) }));
}

describe("reel timeline (RL1, RL2)", () => {
  it("is 2,700 frames at 30 fps", async () => {
    const t = await load<Timeline>("src/data/reel-timeline.ts");
    expect(t.REEL_FPS).toBe(30);
    expect(t.REEL_FRAMES).toBe(2700);
  });

  it("matches the spec's 8-scene budget, contiguous and summing to 2,700", async () => {
    const { REEL_SCENES } = await load<Timeline>("src/data/reel-timeline.ts");
    const budget = specBudget();
    expect(budget).toHaveLength(8);
    // a scene may be split into several sequences (the Vale); group by scene id in order
    const scenes: { from: number; frames: number }[] = [];
    for (const s of REEL_SCENES) {
      const last = scenes[scenes.length - 1];
      if (last && last.from + last.frames === s.from && REEL_SCENES.find((x) => x.from === last.from)?.id === s.id) last.frames += s.frames;
      else scenes.push({ from: s.from, frames: s.frames });
    }
    expect(scenes).toEqual(budget);
    expect(REEL_SCENES.reduce((n, s) => n + s.frames, 0)).toBe(2700);
    for (let i = 1; i < REEL_SCENES.length; i++) expect(REEL_SCENES[i].from).toBe(REEL_SCENES[i - 1].from + REEL_SCENES[i - 1].frames);
    for (const s of REEL_SCENES) expect(WINDOWS, s.section).toContain(s.section.replace(/^(intro|heritage|overview|closing)$/, "corridor"));
  });
});
