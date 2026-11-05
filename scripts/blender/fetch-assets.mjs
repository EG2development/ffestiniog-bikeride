#!/usr/bin/env node
// Fetches the licence-checked third-party assets the dressed Blender scenes use (docs/blender-build-plan.md, phases 3-4;
// shortlist in docs/research-blender.md §4) into out/blender/vendor/, and writes out/blender/vendor/register.json: one
// record per asset with its source, licence, files and SHA-256. Everything here is CC0; nothing is committed.
//   npm run blender:assets
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = resolve(import.meta.dirname, "../..");
const vendor = join(root, "out/blender/vendor");
const PH_LICENCE = "CC0 1.0 (https://polyhaven.com/license)";

// Poly Haven textures: role -> asset id; 2k JPEG colour, OpenGL normal and roughness maps
export const TEXTURES = {
  "terrain-grass": "leafy_grass",
  "terrain-grass-sparse": "sparse_grass",
  "terrain-forest": "forest_ground_04",
  "terrain-rock": "rock_face_03",
  "terrain-aerial": "aerial_grass_rock",
  trail: "gravel_road",
  road: "asphalt_02",
  "stone-wall": "castle_wall_slates",
  "dry-stone": "stacked_stone_wall",
  roof: "roof_slates_02",
  timber: "weathered_planks",
};
// Poly Haven models (1k Blender files and their textures)
export const MODELS = ["grass_medium_01", "fir_tree_01", "tree_small_02"];
export const HDRI = "kloofendal_48d_partly_cloudy_puresky"; // the same sky with a 48° sun: cumulus over blue, and shadows with some modelling (review 2026-11-05; the 38° one read flat and milky)
const MAKEHUMAN = {
  id: "makehuman_system_assets_cc0",
  url: "https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip",
  licence: "CC0 1.0 (http://static.makehumancommunity.org/about/license.html)",
};

const api = async (path) => {
  const r = await fetch(`https://api.polyhaven.com/${path}`);
  if (!r.ok) throw new Error(`Poly Haven ${path}: HTTP ${r.status}`);
  return r.json();
};
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const md5 = (file) => createHash("md5").update(readFileSync(file)).digest("hex");

async function download(url, file, expectMd5) {
  if (existsSync(file)) {
    if (expectMd5 ? md5(file) === expectMd5 : statSync(file).size === Number((await fetch(url, { method: "HEAD" })).headers.get("content-length"))) return file;
  }
  mkdirSync(dirname(file), { recursive: true });
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`${url}: HTTP ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(file));
  if (expectMd5 && md5(file) !== expectMd5) throw new Error(`${url}: checksum mismatch`);
  return file;
}

async function texture(role, id) {
  const files = await api(`files/${id}`);
  const out = {};
  for (const [map, key] of [["diff", "Diffuse"], ["nor_gl", "nor_gl"], ["rough", "Rough"]]) {
    const f = files[key]?.["2k"]?.jpg;
    if (!f) throw new Error(`${id}: no 2k ${key} map`);
    out[map] = await download(f.url, join(vendor, "polyhaven/textures", id, `${id}_${map}_2k.jpg`), f.md5);
  }
  return { role, id, kind: "texture", files: out };
}

async function model(id) {
  const f = (await api(`files/${id}`)).blend["1k"].blend;
  const dir = join(vendor, "polyhaven/models", id);
  const blend = await download(f.url, join(dir, `${id}_1k.blend`), f.md5);
  for (const [rel, inc] of Object.entries(f.include ?? {})) await download(inc.url, join(dir, rel), inc.md5);
  return { id, kind: "model", files: { blend } };
}

async function hdri(id) {
  const f = (await api(`files/${id}`)).hdri["4k"].hdr;
  return { id, kind: "hdri", files: { hdr: await download(f.url, join(vendor, "polyhaven/hdris", `${id}_4k.hdr`), f.md5) } };
}

const records = [];
const rel = (p) => p.replaceAll("\\", "/").slice(vendor.replaceAll("\\", "/").length + 1);
const register = (rec, licence, source) => {
  records.push({ ...rec, licence, source, files: Object.fromEntries(Object.entries(rec.files).map(([k, p]) => [k, { path: rel(p), sha256: sha256(p) }])) });
  console.log(`  ${rec.kind} ${rec.id}`);
};

for (const [role, id] of Object.entries(TEXTURES)) register(await texture(role, id), PH_LICENCE, `https://polyhaven.com/a/${id}`);
for (const id of MODELS) register(await model(id), PH_LICENCE, `https://polyhaven.com/a/${id}`);
register(await hdri(HDRI), PH_LICENCE, `https://polyhaven.com/a/${HDRI}`);
const zip = await download(MAKEHUMAN.url, join(vendor, "mpfb", `${MAKEHUMAN.id}.zip`));
register({ id: MAKEHUMAN.id, kind: "mpfb-pack", files: { zip } }, MAKEHUMAN.licence, MAKEHUMAN.url);

writeFileSync(join(vendor, "register.json"), JSON.stringify({ assets: records }, null, 2) + "\n");
console.log(`registered ${records.length} assets in out/blender/vendor/register.json`);
