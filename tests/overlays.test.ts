import { describe, expect, it } from "vitest";
import { loadExports } from "./three-core/pending";

// Overlay style tokens: safe area, contrast and size (spec CL9 static part, CL11, CL12; ADR 48;
// pseudocode-reel-v2 §4.6). Contrast is the WCAG ratio, with the box composited over both a black and a
// white frame, so it holds whatever the 3D scene behind it is.
type Style = { color: string; background: string; fontSize: number };
type Mod = { SAFE: { x: number; y: number }; CAPTION_STYLE: Style; BADGE_STYLE: Style; ATTRIBUTION_STYLE: Style; LEGEND_STYLE: Style };

const parse = (c: string): [number, number, number, number] => {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a = "1"] = m[1].split(",").map((s) => s.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  const h = c.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
};
const over = (top: number[], under: number[]) => top.slice(0, 3).map((v, i) => v * top[3] + under[i] * (1 - top[3]));
const lum = (rgb: number[]) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** The worst contrast of the text against its box, with the box over a black or a white frame. */
const worst = (s: Style) => Math.min(...[[0, 0, 0], [255, 255, 255]].map((frame) => {
  const box = over(parse(s.background), frame);
  return ratio(over(parse(s.color), box), box);
}));

describe("overlay style tokens", () => {
  it("CL9: the safe area is the 5 % title-safe area of a 1920 × 1080 frame", async () => {
    const { SAFE } = await loadExports<Mod>("src/three/Overlays.tsx", ["SAFE"]);
    expect(SAFE).toEqual({ x: 96, y: 54 });
  });

  it("CL11: caption, badge, attribution and legend text have at least 4.5:1 contrast against their box", async () => {
    const tokens = await loadExports<Mod>("src/three/Overlays.tsx", ["CAPTION_STYLE", "BADGE_STYLE", "ATTRIBUTION_STYLE", "LEGEND_STYLE"]);
    for (const k of ["CAPTION_STYLE", "BADGE_STYLE", "ATTRIBUTION_STYLE", "LEGEND_STYLE"] as const) {
      expect(tokens[k].background, `${k} needs a box behind its text`).toBeTruthy();
      expect(worst(tokens[k]), k).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("CL12: captions are at least 28 px; the badge and the attribution at least 18 px", async () => {
    const t = await loadExports<Mod>("src/three/Overlays.tsx", ["CAPTION_STYLE", "BADGE_STYLE", "ATTRIBUTION_STYLE", "LEGEND_STYLE"]);
    expect(t.CAPTION_STYLE.fontSize).toBeGreaterThanOrEqual(28);
    expect(t.LEGEND_STYLE.fontSize).toBeGreaterThanOrEqual(18);
    expect(t.BADGE_STYLE.fontSize).toBeGreaterThanOrEqual(18);
    expect(t.ATTRIBUTION_STYLE.fontSize).toBeGreaterThanOrEqual(18);
  });
});

describe("the legend (CL7, BL14)", () => {
  type L = { legendLines: (on: { hatched: boolean; translucent: boolean }) => string[]; LEGEND: { hatched: string; translucent: string } };
  it("t10 R-L4: hatching is named in ground scenes only, where it can be seen", async () => {
    const { sectionLegend, LEGEND } = await loadExports<{ sectionLegend: (kind: "ground" | "aerial", bridges: number, translucent: boolean) => string[]; LEGEND: { hatched: string } }>("src/data/reel-captions.ts", ["sectionLegend", "LEGEND"]);
    expect(sectionLegend("aerial", 1, false)).toEqual([]);
    expect(sectionLegend("ground", 1, false)).toEqual([LEGEND.hatched]);
    expect(sectionLegend("ground", 0, false)).toEqual([]);
  });

  it("names exactly the styles a section draws, from curated text", async () => {
    const { legendLines, LEGEND } = await loadExports<L>("src/data/reel-captions.ts", ["legendLines", "LEGEND"]);
    expect(legendLines({ hatched: false, translucent: false })).toEqual([]);
    expect(legendLines({ hatched: true, translucent: false })).toEqual([LEGEND.hatched]);
    expect(legendLines({ hatched: true, translucent: true })).toEqual([LEGEND.hatched, LEGEND.translucent]);
    expect(LEGEND.hatched).toMatch(/approximate/);
    expect(LEGEND.translucent).toMatch(/approved|demolished/);
  });
});
