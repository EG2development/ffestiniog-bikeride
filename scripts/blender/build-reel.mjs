#!/usr/bin/env node
// Builds the Blender version of the reel (docs/blender-build-plan.md, Phase 6): exports every reel scene, builds
// out/blender/master/reel-master.blend (one Scene per reel scene plus a Video Sequencer master with the captions) and,
// with --render, renders the preview to out/blender/reel/reel-blockout-preview.mp4. --dressed builds the realistic version
// (out/blender/master/reel-dressed.blend, rendering to reel-dressed-preview.mp4); it needs `npm run blender:assets` first.
//   npm run blender:reel [-- --render] [--dressed] [--percent 50] [--samples 16] [--film community]
// Blender is found from $BLENDER, then C:/blender/blender.exe, then PATH.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { findBlender, runner } from "./lib.mjs";

const root = resolve(import.meta.dirname, "../..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const percent = arg("percent", "50");
const samples = arg("samples", "16");
const dressed = process.argv.includes("--dressed");
// --film community builds the community film (src/data/community-film.ts) instead of the reel
const film = arg("film", "reel");
if (!["reel", "community"].includes(film)) throw new Error(`unknown film ${film}: reel or community`);
const master = `out/blender/master/${film === "reel" ? "reel" : film}-${dressed ? "dressed" : "master"}.blend`;

const run = runner(root);

const blender = findBlender();
mkdirSync(resolve(root, "out/blender/reel"), { recursive: true });
run("npm", ["run", "blender:export", "--", film], "export");
run(blender, ["--background", "--factory-startup", "--python-exit-code", "1", "--python", "scripts/blender/build_reel.py", "--", "out/blender/exports", master, percent, samples, ...(dressed ? ["--dressed"] : []), "--film", film], "master build");
if (process.argv.includes("--render")) run(blender, ["--background", master, "-a"], "render");
console.log(`built ${master}`);
