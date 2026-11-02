import { describe, expect, it } from "vitest";
import { COMMUNITY_CAPTIONS, COMMUNITY_FPS, COMMUNITY_FRAMES, COMMUNITY_SCENES } from "../src/data/community-film";
import { COMMUNITY } from "../src/three-core/community";
import { proposedLine } from "../src/three-core/props";
import { configById } from "../src/three-core/sections";
import { readJson } from "./three-core/fixtures";

// The community film (src/data/community-film.ts, src/three-core/community.ts): at most three minutes, readable
// captions in miles ending on the brief's line, and every piece of street furniture marked existing or proposed.
const FADE = 15;

describe("the community film's timeline", () => {
  it("runs 180 seconds or less, its scenes back to back, each within its section's frames", () => {
    expect(COMMUNITY_FRAMES / COMMUNITY_FPS).toBeLessThanOrEqual(180);
    let at = 0;
    for (const s of COMMUNITY_SCENES) {
      expect(s.from, s.config).toBe(at);
      expect(configById(s.config).frames, s.config).toBeGreaterThanOrEqual(s.frames);
      at += s.frames;
    }
    expect(at).toBe(COMMUNITY_FRAMES);
  });

  it("shows several identifiable places, not one stretch repeated", () => {
    expect(new Set(COMMUNITY_SCENES.map((s) => s.section)).size).toBeGreaterThanOrEqual(5);
    // and every community config is in the film
    expect(new Set(COMMUNITY_SCENES.map((s) => s.config))).toEqual(new Set(Object.keys(COMMUNITY)));
  });
});

describe("the community film's captions", () => {
  it("sit inside the film and stay on screen long enough to read (15 characters a second, 2.5 s at least)", () => {
    const short = COMMUNITY_CAPTIONS.filter((c) => c.position !== "badge" && c.position !== "attribution")
      .filter((c) => c.to - c.from - FADE * (c.to >= COMMUNITY_FRAMES ? 1 : 2) < Math.max(75, Math.ceil((c.text.length / 15) * 30)))
      .map((c) => c.id);
    expect(short).toEqual([]);
    for (const c of COMMUNITY_CAPTIONS) expect(c.from >= 0 && c.to <= COMMUNITY_FRAMES && c.from < c.to, c.id).toBe(true);
  });

  it("end on the brief's line, the last caption to appear, for at least the last 10 seconds", () => {
    const close = COMMUNITY_CAPTIONS.find((c) => c.id === "closing")!;
    expect(close.text).toBe("More than a path. A connection for our communities.");
    expect(close.to).toBe(COMMUNITY_FRAMES);
    expect(COMMUNITY_FRAMES - close.from).toBeGreaterThanOrEqual(10 * COMMUNITY_FPS);
    expect(Math.max(...COMMUNITY_CAPTIONS.map((c) => c.from))).toBe(close.from);
  });

  it("give journey distances in miles and speeds in mph, and keep the concept notice throughout", () => {
    const text = COMMUNITY_CAPTIONS.map((c) => c.text).join(" ");
    expect(text).toMatch(/8\.2 miles/);
    expect(text).toMatch(/\d+ mph/);
    expect(text).not.toMatch(/\bkm\b|km\/h|kilomet/);
    const badge = COMMUNITY_CAPTIONS.find((c) => c.position === "badge")!;
    expect([badge.from, badge.to]).toEqual([0, COMMUNITY_FRAMES]);
    expect(badge.text).toMatch(/not an approved route/);
  });
});

describe("the community film's street furniture", () => {
  const props = Object.values(COMMUNITY).flatMap((c) => (c.photo?.props ?? []).map((p) => ({ config: c.id, ...p })));
  const stops = readJson<{ stops: { id: string; lon: number; lat: number }[] }>("data/bus-stops.json").stops;

  it("marks every prop existing or proposed, and names a scene's proposals in its legend", () => {
    expect(props.length).toBeGreaterThan(5);
    for (const p of props) expect(["existing", "proposed"], `${p.config} ${p.kind}`).toContain(p.status);
    // lockers, benches, signs and viewpoints are proposals; a bus stop and its shelter are what OSM maps
    for (const p of props) if (["lockers", "bench", "fingerpost", "viewpoint-board"].includes(p.kind)) expect(p.status, `${p.config} ${p.kind}`).toBe("proposed");
    for (const c of Object.values(COMMUNITY)) if (c.photo?.props?.some((p) => p.status === "proposed")) expect(proposedLine(c.photo.props), c.id).toMatch(/^Proposed \(concept only\): /);
  });

  it("puts existing bus stops where OpenStreetMap has them, and their furniture beside them", () => {
    const flags = props.filter((p) => p.kind === "bus-stop-flag");
    expect(flags.length).toBeGreaterThan(0);
    for (const f of flags) {
      expect(f.status).toBe("existing");
      // the flag stands at the mapped node itself
      expect(f.at).toEqual({ stop: f.source });
    }
    for (const p of props) {
      if (!("stop" in p.at)) continue;
      expect(stops.some((s) => s.id === (p.at as { stop: string }).stop), `${p.config} ${p.kind}: its stop is in data/bus-stops.json`).toBe(true);
      expect(Math.hypot(p.at.eastM ?? 0, p.at.northM ?? 0), `${p.config} ${p.kind} within 10 m of its stop`).toBeLessThan(10);
    }
  });
});
