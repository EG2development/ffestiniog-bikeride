// The worktree snapshot and the render environment, shared by the stills and the render checks (spec CL1, X3).
// No git command here changes the worktree: `git stash create` only reads it.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { arch, platform } from "node:os";
import { resolve } from "node:path";

const TOOL_STATE = /^\.(claude-flow|claude|agents|idea)\//;
const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

/** The tracked files' tree (from a stash commit when dirty, else HEAD's) and a hash over the untracked files. */
export function snapshot(root) {
  const stash = git(root, "stash", "create");
  // tool state the hooks and editors rewrite on every call is not a render input, so it stays out of the hash
  const untracked = git(root, "ls-files", "--others", "--exclude-standard").split("\n").filter((f) => f && !TOOL_STATE.test(f)).sort();
  const h = createHash("sha256");
  // an untracked nested repository is listed as a directory: record its name only
  for (const f of untracked) h.update(f + "\0" + (statSync(resolve(root, f)).isDirectory() ? "dir" : sha256(resolve(root, f))));
  // the tree hash, not the stash commit's: a commit hash carries a timestamp, a tree hash only the content
  return { tree: git(root, "rev-parse", `${stash || "HEAD"}^{tree}`), dirty: Boolean(stash), untracked: untracked.length, untrackedSha256: h.digest("hex") };
}

function chrome(root) {
  const bin = resolve(root, "node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell");
  try {
    return existsSync(bin) ? execFileSync(bin, ["--version"], { encoding: "utf8" }).trim() : "unknown";
  } catch {
    return "unknown";
  }
}

/** What a still depends on beyond the code: two sets are compared only when these match. */
export function environment(root) {
  const remotion = JSON.parse(readFileSync(resolve(root, "node_modules/remotion/package.json"), "utf8")).version;
  return { platform: platform(), arch: arch(), node: process.version, remotion, chrome: chrome(root), gl: "angle", scale: 1 };
}
