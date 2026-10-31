import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { exportReel } from "../../src/blender/exportReel";
import { PHOTO_LEGEND } from "../../src/data/reel-captions";
import { REEL_FPS, REEL_FRAMES, REEL_LOOK, REEL_SCENES } from "../../src/data/reel-timeline";
import { ROOT } from "../three-core/fixtures";

// The reel as Blender sees it (docs/blender-build-plan.md, Phase 6): every scene exported as a section package and one
// master timeline, equal to the three.js reel's edit frame for frame.

describe("the reel's Blender export", () => {
  const out = mkdtempSync(join(tmpdir(), "blender-reel-"));
  afterAll(() => rmSync(out, { recursive: true, force: true }));
  const { reel, packages } = exportReel({ root: ROOT, outRoot: out });
  const byId = new Map(packages.map((p) => [p.section.id, p]));

  it("is the existing edit: nine scenes, contiguous, 2,700 frames at 30 fps in the photo look", () => {
    expect(reel).toMatchObject({ fps: REEL_FPS, frames: REEL_FRAMES, look: REEL_LOOK });
    expect(reel.frames).toBe(2700);
    expect(reel.scenes.map((s) => [s.config, s.from, s.frames])).toEqual(REEL_SCENES.map((s) => [s.config, s.from, s.frames]));
    let at = 0;
    for (const s of reel.scenes) {
      expect(s.from).toBe(at);
      at += s.frames;
    }
    expect(at).toBe(2700);
  });

  it("takes exactly the master's frame count from each section: Maentwrog's 360 frames give 300", () => {
    const m = reel.scenes.find((s) => s.config === "maentwrog")!;
    expect([m.from, m.frames, m.sectionFrames]).toEqual([1620, 300, 360]);
    for (const s of reel.scenes) {
      expect(s.sectionFrames, s.config).toBeGreaterThanOrEqual(s.frames);
      expect(byId.get(s.package)!.section.frames, s.config).toBe(s.sectionFrames);
    }
  });

  it("exports each corridor scene once per config, and every scene's package is complete", () => {
    expect(packages.length).toBe(new Set(REEL_SCENES.map((s) => s.config)).size);
    for (const p of packages) {
      expect(p.meshes.map((m) => m.name), p.section.id).toEqual(expect.arrayContaining(["terrain", "trail"]));
      expect(p.camera.shots.reduce((n, s) => n + s.frames, 0), p.section.id).toBe(p.section.frames);
      expect(p.provenance.sources.length, p.section.id).toBeGreaterThan(10);
    }
  });

  it("gives the aerial scenes the satellite ground and no people, and the ground scenes their people and legend", () => {
    for (const id of ["intro", "heritage", "overview", "closing"]) {
      const p = byId.get(id)!;
      expect(p.section.kind).toBe("aerial");
      expect(p.counts.walkers).toBe(0);
      expect(p.meshes.find((m) => m.name === "terrain")!.colors, `${id}: imagery colours`).toBeDefined();
      expect(p.legend, `${id}: no legend lines in an aerial scene`).toEqual([]);
    }
    for (const id of ["blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"]) {
      const p = byId.get(id)!;
      expect(p.section.kind).toBe("ground");
      expect(p.counts.walkers, id).toBeGreaterThan(0);
      expect(p.legend.length, id).toBeGreaterThan(0);
      for (const run of p.legend) expect(run.lines, id).toContain(PHOTO_LEGEND.ground);
    }
  });

  it("keeps the concept badge and the photo look's credits for the whole reel", () => {
    const badge = reel.captions.find((c) => c.id === "disclaimer")!;
    expect([badge.text, badge.from, badge.to]).toEqual(["Concept visualisation — not an approved route", 0, 2700]);
    const credit = reel.captions.find((c) => c.id === "attribution")!;
    expect(credit.text).toContain("Contains modified Copernicus Sentinel data 2025");
    expect(credit.text).not.toContain("OpenTopoMap");
    expect(reel.captions.length).toBe(11);
    expect(reel.captions.find((c) => c.id === "concept-card")!.to).toBe(2700);
  });

  it("writes reel.json beside the packages", () => {
    const written = JSON.parse(readFileSync(join(out, "reel.json"), "utf8")) as typeof reel;
    expect(written.scenes.length).toBe(9);
    expect(written.frames).toBe(2700);
  });
}, 180_000);
