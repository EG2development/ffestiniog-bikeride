#!/usr/bin/env node
// Photoreal layer: the registered CC0 textures, fetched from their official host (docs/adr/0054-photoreal-layer.md).
//   node scripts/fetch-assets.mjs            download what is missing, verify, register in data/assets-3d.json
//   node scripts/fetch-assets.mjs --check    only report what is present, missing or changed (no network)
// Every file lands under public/3d/textures/<id>/ with its sha256 recorded in the register entry, so the download is
// reproducible and the register says exactly which bytes are in the video (spec L1). Only Poly Haven is fetched
// (dl.polyhaven.org, allowlisted in tests/static-3d.test.ts); its licence is CC0 1.0 for every asset
// (https://polyhaven.com/license), so no on-screen credit is required, and the source is still named here.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const REGISTER = resolve(ROOT, "data/assets-3d.json");
const HOST = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k";
const PAGE = "https://polyhaven.com/a";
const TODAY = new Date().toISOString().slice(0, 10);

/** The texture sets by role (src/three/photo/assetRoles.ts reads the paths written below). */
export const TEXTURES = [
  { id: "aerial_grass_rock", role: "grass", note: "upland grass with rock showing through, photogrammetry from above: the Vale's rough pasture" },
  { id: "brown_mud_leaves_01", role: "heath", note: "brown ground with leaf litter: the scrub and bracken edges" },
  { id: "forrest_ground_01", role: "woodFloor", note: "needle and leaf litter: the plantation and woodland floor" },
  { id: "lichen_rock", role: "rock", note: "lichened grey rock: steep ground and outcrops" },
  { id: "gravel_ground_01", role: "gravel", note: "compacted gravel: the proposed trail surface, tinted buff" },
  { id: "mossy_stone_wall", role: "stone", note: "mossy stone wall: drystone field walls and the bridge parapets" },
  { id: "bark_brown_02", role: "bark", note: "weathered bark: fence posts and rails" },
  { id: "asphalt_02", role: "tarmac", note: "worn asphalt: the roads (when a textured road view lands)" },
];
const MAPS = { map: "diff", normalMap: "nor_gl" };

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

async function download(url, file) {
  const r = await fetch(url, { headers: { "User-Agent": "ffestiniog-bikeride-concept-video/1.0 (+https://github.com/EG2development/ffestiniog-bikeride)" } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 50_000) throw new Error(`${url}: only ${buf.length} bytes`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  return buf.length;
}

const check = process.argv.includes("--check");
const register = JSON.parse(readFileSync(REGISTER, "utf8"));
const kept = register.filter((a) => !a.path.startsWith("public/3d/textures/"));
const entries = [];
let changed = false;
for (const t of TEXTURES) {
  for (const [key, suffix] of Object.entries(MAPS)) {
    const name = `${t.id}_${suffix}_1k.jpg`;
    const rel = `public/3d/textures/${t.id}/${name}`;
    const file = resolve(ROOT, rel);
    const url = `${HOST}/${t.id}/${name}`;
    const existing = register.find((a) => a.path === rel);
    if (!existsSync(file)) {
      if (check) {
        console.log(`missing  ${rel}`);
        continue;
      }
      const bytes = await download(url, file);
      console.log(`fetched  ${rel} (${bytes} bytes)`);
      changed = true;
    }
    const hash = sha256(file);
    const recorded = existing && /sha256 ([0-9a-f]{64})/.exec(existing.source)?.[1];
    if (recorded && recorded !== hash) console.log(`CHANGED  ${rel}: sha256 ${hash} differs from the register's ${recorded}`);
    else if (check) console.log(`present  ${rel}`);
    entries.push({
      path: rel,
      kind: "texture",
      source: `Poly Haven texture "${t.id}" (${key === "map" ? "diffuse" : "normal, OpenGL"} 1K JPG), ${PAGE}/${t.id}, fetched ${existing?.source.match(/fetched (\d{4}-\d{2}-\d{2})/)?.[1] ?? TODAY} from ${url}, sha256 ${hash}; role ${t.role}: ${t.note}`,
      licence: "CC0 1.0 (Poly Haven, https://polyhaven.com/license)",
      attribution: "None required (CC0); credited as Poly Haven in the source register",
    });
  }
}
if (!check) {
  writeFileSync(REGISTER, JSON.stringify([...kept, ...entries], null, 2) + "\n");
  console.log(`${entries.length} texture entries in data/assets-3d.json${changed ? "; run npm run data:sync" : " (unchanged files)"}`);
}
