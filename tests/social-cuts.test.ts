import { describe, expect, it } from "vitest";
import { COMMUNITY_CAPTIONS, COMMUNITY_FRAMES } from "../src/data/community-film";
import { BADGE, captionRuns, CUTS, cutFrames, END_CARD, EXPORT_PRESETS, FORMATS, LINES, NOTES, PLATES, platesFor, POST_TEXT, POST_TITLES, SOCIAL_FPS, type Line } from "../src/data/social-cuts";
import { configById } from "../src/three-core/sections";
import { cues, postText, srt } from "../src/social/subtitles";

// The community film's social cuts (src/data/social-cuts.ts): each its own edit at its platform's size, of plates
// that are whole runs of the film's own camera shots, with Welsh-first captions that read in time, in miles and mph,
// ending on the film's closing line, and an export preset within the platforms' upload specifications.
const seconds = (id: string) => cutFrames(CUTS.find((c) => c.id === id)!) / SOCIAL_FPS;
const every = (): [string, Line][] => [...Object.entries(LINES), ...Object.entries(NOTES), ["badge", BADGE], ["invite", END_CARD.invite], ["title", END_CARD.title], ...Object.entries(POST_TITLES), ["post", POST_TEXT]];

describe("the social cuts' formats and lengths", () => {
  it("are 15, 30 and 60 s vertical, a 30-60 s 4:5 feed post and a 60 s landscape cut, at 30 fps", () => {
    expect([seconds("teaser"), seconds("highlights"), seconds("story"), seconds("youtube")]).toEqual([15, 30, 60, 60]);
    expect(seconds("feed")).toBeGreaterThanOrEqual(30);
    expect(seconds("feed")).toBeLessThanOrEqual(60);
    const fmt = (id: string) => FORMATS[CUTS.find((c) => c.id === id)!.format];
    for (const id of ["teaser", "highlights", "story"]) expect([fmt(id).w, fmt(id).h], id).toEqual([1080, 1920]);
    expect([fmt("feed").w, fmt("feed").h]).toEqual([1440, 1800]); // Meta's 4:5 feed recommendation
    expect([fmt("youtube").w, fmt("youtube").h]).toEqual([1920, 1080]);
    expect(SOCIAL_FPS).toBe(30);
  });

  it("keep the vertical text clear of the Reels and Shorts interface (top 13 %, bottom 30 %, the right-hand buttons)", () => {
    const v = FORMATS.vertical;
    expect(v.safe.top / v.h).toBeGreaterThanOrEqual(0.13);
    expect(v.safe.bottom / v.h).toBeGreaterThanOrEqual(0.3);
    expect(v.safe.right).toBeGreaterThanOrEqual(140);
  });

  it("are each a different edit, not the film sped up: every shot plays at the film's own speed from one plate", () => {
    const edits = new Set(CUTS.filter((c) => c.id !== "youtube").map((c) => JSON.stringify(c.shots)));
    expect(edits.size).toBe(4); // YouTube's landscape cut shares the 60 s story's edit, at its own framing
    for (const c of CUTS) for (let i = 1; i < c.shots.length; i++) expect(c.shots[i].plate, `${c.id} ${i}`).not.toBe(c.shots[i - 1].plate);
  });
});

describe("the plates", () => {
  it("each lie within one of the film's camera shots, so a plate never jumps across a cut", () => {
    for (const p of PLATES) {
      const cfg = configById(p.config);
      let start = 0;
      const shot = cfg.shots.findIndex((s) => {
        const inside = p.from >= start && p.from + p.frames <= start + s.frames;
        start += s.frames;
        return inside;
      });
      expect(shot, `${p.id} in ${p.config}`).toBeGreaterThanOrEqual(0);
      expect(p.from + p.frames, p.id).toBeLessThanOrEqual(cfg.frames);
    }
  });

  it("are used only within their frames, and each format renders the frames its cuts use, natively framed", () => {
    for (const c of CUTS) for (const sh of c.shots) expect((sh.at ?? 0) + sh.frames, `${c.id} ${sh.plate}`).toBeLessThanOrEqual(PLATES.find((p) => p.id === sh.plate)!.frames);
    for (const f of ["vertical", "feed", "landscape"] as const) {
      for (const { plate, from, to, framing } of platesFor(f)) {
        expect(from >= 0 && to <= plate.frames && from < to, `${f} ${plate.id}`).toBe(true);
        expect(framing.share > 0 && framing.share <= 1, `${f} ${plate.id}`).toBe(true);
        expect(Math.abs(framing.pan), `${f} ${plate.id}`).toBeLessThanOrEqual(20);
      }
    }
    // the landscape cut is the film's own framing
    for (const { framing } of platesFor("landscape")) expect(framing).toEqual({ share: 1, pan: 0, shiftX: 0, shiftY: 0 });
  });
});

describe("the social cuts' story", () => {
  it("open on a first-person ride with a caption from the first frame, and show the community benefits even at 15 s", () => {
    for (const c of CUTS) {
      expect(c.shots[0].plate, c.id).toMatch(/-pov$/);
      expect(captionRuns(c, "line")[0].from, c.id).toBe(0);
    }
    const teaser = CUTS.find((c) => c.id === "teaser")!;
    expect(new Set(teaser.shots.map((s) => s.line).filter(Boolean))).toEqual(new Set(["path", "school", "everyone"]));
    const story = CUTS.find((c) => c.id === "story")!.shots.map((s) => s.plate);
    for (const must of ["school-ride", "family-cargo", "walkers", "bench-view", "station-lockers", "together", "traws-pov"]) expect(story, must).toContain(must);
  });

  it("end on the film's closing line for at least four seconds", () => {
    const close = COMMUNITY_CAPTIONS.find((c) => c.id === "closing")!;
    expect(END_CARD.title.cy.replace("\n", " ")).toBe(close.cy);
    expect(END_CARD.title.en.replace("\n", " ")).toBe(close.text);
    for (const c of CUTS) expect(c.endCard / SOCIAL_FPS, c.id).toBeGreaterThanOrEqual(4);
  });

  it("leave the 3-minute film as it is", () => {
    expect(COMMUNITY_FRAMES).toBe(5400);
  });
});

describe("the social cuts' text", () => {
  it("is every line Welsh first and English second, each its own text, short enough for a phone", () => {
    for (const [id, l] of every()) {
      expect(Object.keys(l), id).toEqual(["cy", "en"]);
      expect(l.cy.trim().length && l.en.trim().length, id).toBeTruthy();
      expect(l.cy, id).not.toBe(l.en);
    }
    for (const [id, l] of Object.entries(LINES)) {
      for (const t of [l.cy, l.en]) {
        expect(t.split("\n").length, id).toBeLessThanOrEqual(2);
        expect(t.length, `${id}: ${t}`).toBeLessThanOrEqual(60); // two lines of the vertical caption box at most
      }
    }
  });

  it("stays on screen long enough to read the longer language (15 characters a second, 2.5 s at least)", () => {
    for (const c of CUTS) {
      const end = cutFrames(c) - c.endCard;
      for (const r of captionRuns(c, "line")) {
        const l = LINES[r.id as keyof typeof LINES];
        const need = Math.max(75, Math.ceil((Math.max(l.cy.length, l.en.length) / 15) * SOCIAL_FPS));
        expect(Math.min(r.to, end) - r.from, `${c.id} ${r.id}`).toBeGreaterThanOrEqual(need);
      }
    }
  });

  it("gives distances in miles and speeds in mph, in both languages", () => {
    expect(LINES.route.cy).toMatch(/\d+\.\d milltir/);
    expect(LINES.route.en).toMatch(/\d+\.\d miles/);
    expect(LINES.time.cy).toMatch(/10 mya/);
    expect(LINES.time.en).toMatch(/10 mph/);
    for (const [id, l] of every()) expect(`${l.cy} ${l.en}`, id).not.toMatch(/\bkm\b|kilomet|km\/h/i);
  });

  it("writes subtitles timed to the captions, the bilingual file Welsh first, and the post text Welsh first", () => {
    for (const c of CUTS) {
      const cs = cues(c);
      for (let i = 1; i < cs.length; i++) expect(cs[i].from, c.id).toBeGreaterThanOrEqual(cs[i - 1].to);
      expect(cs[cs.length - 1].to).toBe(cutFrames(c));
      const both = srt(c, "cy-en").split("\n\n")[0].split("\n");
      expect(both[1]).toBe("00:00:00,000 --> " + both[1].split(" --> ")[1]);
      expect(both[2]).toBe(LINES[c.shots[0].line!].cy.replace(/\n/g, " "));
      expect(both[3]).toBe(LINES[c.shots[0].line!].en.replace(/\n/g, " "));
      const post = postText(c);
      expect(post.indexOf(POST_TITLES[c.id].cy)).toBeLessThan(post.indexOf(POST_TITLES[c.id].en));
      expect(post).toContain("© Crown copyright");
    }
  });
});

describe("the export presets", () => {
  it("encode near-transparently, above YouTube's 8 Mbps floor for 1080p and capped for the platforms' ingest", () => {
    for (const [f, p] of Object.entries(EXPORT_PRESETS)) {
      expect(p.crf, f).toBeLessThanOrEqual(18);
      expect(p.maxBitrateMbps, f).toBeGreaterThanOrEqual(8);
      expect(p.maxBitrateMbps, f).toBeLessThanOrEqual(60);
    }
  });
});
