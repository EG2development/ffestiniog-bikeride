#!/usr/bin/env node
// Builds out/blender/scenes/maentwrog-blockout.blend from the current scene data (docs/blender-build-plan.md §7, first milestone):
// export the interchange package, then import it headless. `--stills` also renders the three camera-matched stills.
// `--dressed` builds the realistic scene instead (materials, vegetation, sky, people; needs `npm run blender:assets`):
// out/blender/scenes/maentwrog-dressed.blend and stills dressed_00NN.png.
//   npm run blender:blockout [-- --stills] [--dressed]    Blender is found from $BLENDER, then PATH, then C:\blender\blender.exe
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const pkg = "out/blender/exports/maentwrog-photo";
const dressed = process.argv.includes("--dressed");
const blend = dressed ? "out/blender/scenes/maentwrog-dressed.blend" : "out/blender/scenes/maentwrog-blockout.blend";
// source frames 30, 200 and 400 (one per shot, the prototype's evidence frames) are Blender frames 31, 201 and 401
const STILLS = [31, 201, 401];

const run = (cmd, args, label) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" && cmd === "npm" });
  if (r.status !== 0) throw new Error(`${label} failed (${r.status ?? r.error?.message})`);
};
const findBlender = () => {
  const candidates = [process.env.BLENDER, "C:/blender/blender.exe", "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"].filter(Boolean);
  const found = candidates.find((c) => existsSync(c));
  if (found) return found;
  if (spawnSync("blender", ["--version"], { stdio: "ignore" }).status === 0) return "blender";
  throw new Error("Blender not found: set BLENDER to its executable, or put it on PATH");
};

const blender = findBlender();
run("npm", ["run", "blender:export", "--", "maentwrog-photo"], "export");
run(blender, ["--background", "--factory-startup", "--python", "scripts/blender/import_blockout.py", "--", pkg, blend, ...(dressed ? ["32", "--dressed"] : [])], "import");
if (process.argv.includes("--stills")) {
  for (const f of STILLS) run(blender, ["--background", blend, "--render-output", dressed ? "//../stills/dressed_" : "//../stills/blockout_", "--render-format", "PNG", "--render-frame", String(f)], `render frame ${f}`);
}
console.log(`built ${blend}`);
