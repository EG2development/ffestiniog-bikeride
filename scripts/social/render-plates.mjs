#!/usr/bin/env node
// Renders the social cuts' plates from the community film's dressed master (scripts/blender/render_social.py) into
// out/social/public/plates/<format>/<plate>/, which Remotion reads as its public dir. Resumes where it stopped.
//   npm run social:plates [-- --format vertical] [--plate school-ride] [--preview] [--master <.blend>]
// Blender is found from $BLENDER, then C:/blender/blender.exe, then PATH, as for the film.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const master = arg("master") ?? "out/blender/master/community-dressed-v9-render.blend";
if (!existsSync(resolve(root, master))) throw new Error(`${master} not found: build the community film first (npm run blender:reel -- --dressed --film community)`);
const findBlender = () => {
  const found = [process.env.BLENDER, "C:/blender/blender.exe", "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"].filter(Boolean).find((c) => existsSync(c));
  if (found) return found;
  if (spawnSync("blender", ["--version"], { stdio: "ignore" }).status === 0) return "blender";
  throw new Error("Blender not found: set BLENDER to its executable, or put it on PATH");
};
const run = (cmd, args, label) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" && cmd === "npm" });
  if (r.status !== 0) throw new Error(`${label} failed (${r.status ?? r.error?.message})`);
};

run("npm", ["run", "social:plan"], "plan");
const pass = ["format", "plate"].flatMap((k) => (arg(k) ? [`--${k}`, arg(k)] : []));
run(findBlender(), ["--background", master, "--python-exit-code", "1", "--python", "scripts/blender/render_social.py", "--", resolve(root, "out/social/plan.json"), resolve(root, "out/social/public/plates"), ...pass, ...(process.argv.includes("--preview") ? ["--preview"] : [])], "plates");
