#!/usr/bin/env node
// Builds out/blender/scenes/maentwrog-blockout.blend from the current scene data (docs/blender-build-plan.md §7, first milestone):
// export the interchange package, then import it headless. `--stills` also renders the three camera-matched stills.
// `--dressed` builds the realistic scene instead (materials, vegetation, sky, people; needs `npm run blender:assets`):
// out/blender/scenes/maentwrog-dressed.blend and stills dressed_00NN.png.
//   npm run blender:blockout [-- --stills] [--dressed]    Blender is found from $BLENDER, then PATH, then C:\blender\blender.exe
import { resolve } from "node:path";
import { findBlender, runner } from "./lib.mjs";

const root = resolve(import.meta.dirname, "../..");
const pkg = "out/blender/exports/maentwrog-photo";
const dressed = process.argv.includes("--dressed");
const blend = dressed ? "out/blender/scenes/maentwrog-dressed.blend" : "out/blender/scenes/maentwrog-blockout.blend";
// source frames 30, 200 and 400 (one per shot, the prototype's evidence frames) are Blender frames 31, 201 and 401
const STILLS = [31, 201, 401];

const run = runner(root);

const blender = findBlender();
run("npm", ["run", "blender:export", "--", "maentwrog-photo"], "export");
run(blender, ["--background", "--factory-startup", "--python-exit-code", "1", "--python", "scripts/blender/import_blockout.py", "--", pkg, blend, ...(dressed ? ["32", "--dressed"] : [])], "import");
if (process.argv.includes("--stills")) {
  for (const f of STILLS) run(blender, ["--background", blend, "--render-output", dressed ? "//../stills/dressed_" : "//../stills/blockout_", "--render-format", "PNG", "--render-frame", String(f)], `render frame ${f}`);
}
console.log(`built ${blend}`);
