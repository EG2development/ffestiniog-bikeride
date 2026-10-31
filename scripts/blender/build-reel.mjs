#!/usr/bin/env node
// Builds the Blender version of the reel (docs/blender-build-plan.md, Phase 6): exports every reel scene, builds
// out/blender/master/reel-master.blend (one Scene per reel scene plus a Video Sequencer master with the captions) and,
// with --render, renders the preview to out/blender/reel/reel-blockout-preview.mp4. --dressed builds the realistic version
// (out/blender/master/reel-dressed.blend, rendering to reel-dressed-preview.mp4); it needs `npm run blender:assets` first.
//   npm run blender:reel [-- --render] [--dressed] [--percent 50] [--samples 16]
// Blender is found from $BLENDER, then C:/blender/blender.exe, then PATH.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const percent = arg("percent", "50");
const samples = arg("samples", "16");
const dressed = process.argv.includes("--dressed");
const master = dressed ? "out/blender/master/reel-dressed.blend" : "out/blender/master/reel-master.blend";

const run = (cmd, args, label) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" && cmd === "npm" });
  if (r.status !== 0) throw new Error(`${label} failed (${r.status ?? r.error?.message})`);
};
const findBlender = () => {
  const found = [process.env.BLENDER, "C:/blender/blender.exe", "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"].filter(Boolean).find((c) => existsSync(c));
  if (found) return found;
  if (spawnSync("blender", ["--version"], { stdio: "ignore" }).status === 0) return "blender";
  throw new Error("Blender not found: set BLENDER to its executable, or put it on PATH");
};

const blender = findBlender();
mkdirSync(resolve(root, "out/blender/reel"), { recursive: true });
run("npm", ["run", "blender:export", "--", "reel"], "export");
run(blender, ["--background", "--factory-startup", "--python", "scripts/blender/build_reel.py", "--", "out/blender/exports", master, percent, samples, ...(dressed ? ["--dressed"] : [])], "master build");
if (process.argv.includes("--render")) run(blender, ["--background", master, "-a"], "render");
console.log(`built ${master}`);
