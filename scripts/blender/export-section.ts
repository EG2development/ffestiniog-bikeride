// Evaluates a section or prototype config into a Blender interchange package under out/blender/exports/<id>/ (docs/blender-build-plan.md §3).
//   npm run blender:export [-- <config id>]   (default: maentwrog-photo)
//   npm run blender:export -- reel            every scene of the reel, plus out/blender/exports/reel.json
import { resolve } from "node:path";
import { exportReel } from "../../src/blender/exportReel";
import { exportSection } from "../../src/blender/exportSection";

const ROOT = resolve(process.cwd());
const outRoot = resolve(ROOT, "out/blender/exports");
const id = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "maentwrog-photo";
const line = (m: { section: { id: string; frames: number }; meshes: unknown[]; counts: { terrainVertices: number; trees: number; grassClumps: number; walkers: number } }) =>
  `${m.section.id}: ${m.meshes.length} meshes, ${m.counts.terrainVertices} terrain vertices, ${m.counts.trees} trees, ${m.counts.grassClumps} grass clumps, ${m.counts.walkers} walkers, ${m.section.frames} frames`;

if (id === "reel") {
  const { reel, packages } = exportReel({ root: ROOT, outRoot });
  for (const m of packages) console.log(line(m));
  console.log(`reel: ${reel.scenes.length} scenes, ${reel.frames} frames -> ${outRoot}`);
} else {
  const { outDir, manifest } = exportSection({ root: ROOT, outRoot, sectionId: id });
  console.log(`${line(manifest)} -> ${outDir}`);
}
