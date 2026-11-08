// Shared by the Blender launchers (blender/build-blockout.mjs, blender/build-reel.mjs, social/render-plates.mjs).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

/** Blender's executable: $BLENDER, then the usual Windows locations, then PATH. */
export function findBlender() {
  const found = [process.env.BLENDER, "C:/blender/blender.exe", "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"].filter(Boolean).find((c) => existsSync(c));
  if (found) return found;
  if (spawnSync("blender", ["--version"], { stdio: "ignore" }).status === 0) return "blender";
  throw new Error("Blender not found: set BLENDER to its executable, or put it on PATH");
}

/** A step runner for `root`: inherits stdio and throws with the label when the command fails. */
export const runner = (root) => (cmd, args, label) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" && cmd === "npm" });
  if (r.status !== 0) throw new Error(`${label} failed (${r.status ?? r.error?.message})`);
};
