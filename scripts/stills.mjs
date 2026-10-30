#!/usr/bin/env node
// Before and after stills from one script and one environment (docs/adr/0045-before-after-stills-one-environment.md).
//   node scripts/stills.mjs out/before            normal stills and every mask (spec CL1)
//   node scripts/stills.mjs out/before --no-masks normal stills only
// Writes <dir>/manifest.json with the environment and the snapshot id, so two sets are compared only
// when their manifests match. No git command here changes the worktree (`git stash create` only reads it).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { environment, snapshot } from "./snapshot.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = process.env.REMOTION_PORT ?? "3519";
const dir = resolve(ROOT, process.argv[2] ?? "out/stills");
const withMasks = !process.argv.includes("--no-masks");

// Trawsfynydd and Maentwrog first (drone-side and follow frames), then the middle of every other scene.
export const FRAMES = {
  trawsfynydd: [60, 200, 300, 420],
  maentwrog: [60, 150, 240, 330],
  blaenau: [150],
  "vale-north": [135],
  "vale-south": [135],
  intro: [120],
  heritage: [120],
  overview: [150],
  closing: [150],
};
const GROUND = ["blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"];
// extras for the water checks, all without captions so no caption box lies over the water: the frame itself (`clean`),
// the frame with the water hidden (WA6), and the next lake-shore frame (WA7)
export const NOWATER = (id) => GROUND.includes(id);
export const NEXT_FRAME = { trawsfynydd: [60] };
export const MASKS = (id) => (GROUND.includes(id) ? ["trees", "trees-sun", "trail", "roads", "terrain", "water", "water-expected", "buildings"] : ["terrain", "water", "water-expected"]);

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

// One bundle per run, rendered from a frozen copy: edits made while the stills render cannot leak into them.
const BUNDLE = join(dir, ".bundle");
function bundleOnce() {
  execFileSync("npx", ["remotion", "bundle", "src/index.ts", `--out-dir=${BUNDLE}`, "--log=error"], { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
}

function still(id, frame, file, props) {
  execFileSync("npx", ["remotion", "still", BUNDLE, `Section-${id}`, file, `--frame=${frame}`, "--gl=angle", "--scale=1", `--port=${PORT}`, `--props=${JSON.stringify(props)}`, "--overwrite", "--log=error"], { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
}

mkdirSync(dir, { recursive: true });
const SNAPSHOT = snapshot(ROOT); // taken as the bundle is made, so it names the code the stills show
bundleOnce();
const made = [];
for (const [id, frames] of Object.entries(FRAMES)) {
  for (const f of frames) {
    // the concept look, whose iteration-2 measures (CL2–CL6, WA6, WA7) these stills serve; the photo look has its own records (ADR 60)
    const base = { section: id, captions: "section", diagnostics: false, look: "concept" };
    const normal = join(dir, `${id}_${f}.png`);
    still(id, f, normal, base);
    made.push({ id, frame: f, mask: null, file: normal, sha256: sha256(normal) });
    if (!withMasks) continue;
    for (const m of MASKS(id)) {
      const file = join(dir, `${id}_${f}_${m}.png`);
      still(id, f, file, { ...base, captions: "none", mask: m });
      made.push({ id, frame: f, mask: m, file, sha256: sha256(file) });
    }
    if (NOWATER(id)) {
      for (const [m, props] of [["clean", { ...base, captions: "none" }], ["nowater", { ...base, captions: "none", hide: "water" }]]) {
        const file = join(dir, `${id}_${f}_${m}.png`);
        still(id, f, file, props);
        made.push({ id, frame: f, mask: m, file, sha256: sha256(file) });
      }
    }
    if ((NEXT_FRAME[id] ?? []).includes(f)) {
      for (const [m, file] of [[null, join(dir, `${id}_${f + 1}.png`)], ["water", join(dir, `${id}_${f + 1}_water.png`)]]) {
        still(id, f + 1, file, m ? { ...base, captions: "none", mask: m } : { ...base, captions: "none" });
        made.push({ id, frame: f + 1, mask: m, extra: true, file, sha256: sha256(file) });
      }
    }
  }
}
const manifest = {
  createdAt: new Date().toISOString(),
  environment: environment(ROOT),
  snapshot: SNAPSHOT,
  stills: made.map(({ file, ...rest }) => ({ ...rest, file: file.slice(ROOT.length + 1) })),
};
writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`${made.length} stills in ${dir.slice(ROOT.length + 1)}; snapshot ${manifest.snapshot.tree.slice(0, 12)}${manifest.snapshot.dirty ? " (dirty)" : ""}`);
