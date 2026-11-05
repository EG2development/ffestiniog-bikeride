// Writes out/social/plan.json: for each format, the plates its social cuts use (src/data/social-cuts.ts), as the scene,
// frame range and framing scripts/blender/render_social.py renders.
//   npm run social:plan
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CUTS, cutFrames, FORMATS, PLATES, platesFor, SOCIAL_FPS, type FormatId } from "../../src/data/social-cuts";

const root = process.cwd(); // npm runs it from the repository root (the bundle itself sits in out/)
const formats = [...new Set(CUTS.map((c) => c.format))] as FormatId[];
const plan = {
  fps: SOCIAL_FPS,
  formats: Object.fromEntries(
    formats.map((f) => [
      f,
      {
        w: FORMATS[f].w,
        h: FORMATS[f].h,
        // local scene frames [from, to): the scene's own frame f is Blender frame f + 1
        plates: platesFor(f).map(({ plate, from, to, framing }) => ({ id: plate.id, config: plate.config, from: plate.from + from, to: plate.from + to, framing })),
      },
    ]),
  ),
  // each cut's length and shots, for its soundtrack (scripts/social/make_audio.py follows the picture's cuts)
  cuts: CUTS.map((c) => ({
    id: c.id,
    format: c.format,
    frames: cutFrames(c),
    endCard: c.endCard,
    // each shot's first PNG is Blender frame `first` of the plate's scene (for the QA's comparison with the plates)
    shots: c.shots.map((s) => ({ plate: s.plate, frames: s.frames, first: PLATES.find((p) => p.id === s.plate)!.from + (s.at ?? 0) + 1 })),
  })),
};
mkdirSync(resolve(root, "out/social"), { recursive: true });
writeFileSync(resolve(root, "out/social/plan.json"), JSON.stringify(plan, null, 1));
for (const f of formats) console.log(`${f}: ${plan.formats[f].plates.length} plates, ${plan.formats[f].plates.reduce((n, p) => n + p.to - p.from, 0)} frames`);
