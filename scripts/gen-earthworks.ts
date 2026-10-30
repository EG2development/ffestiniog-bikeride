// Adds an "approximate" earthwork entry to data/features-3d.json for every cut or fill
// deeper than 2 m that flattening the trail corridor implies (spec G5b). Uses the same
// TypeScript core the video renders with, so the register can't drift from the scene.
//   npm run data:earthworks   (after python3 scripts/build_poc_data.py)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRouteModel } from "../src/data/route";
import { buildPocScene, buildSectionScene, SECTIONS } from "../src/three-core/sections";
import type { Feature } from "../src/three-core/registers";
import type { TrailProfile } from "../src/three-core/trail";

const ROOT = resolve(process.cwd());
const read = (rel: string) => readFileSync(resolve(ROOT, rel));
const json = <T>(rel: string): T => JSON.parse(read(rel).toString("utf8")) as T;

const route = buildRouteModel(
  json("data/railway-route.geojson"),
  json("data/waypoints.json"),
  json("data/elevation-profile.json"),
  { tileSize: 256, layers: [] },
);
// `--section <window>` writes a window's earthworks into data/features-<window>.json (ADR 29); no flag: the POC's.
const section = process.argv.includes("--section") ? process.argv[process.argv.indexOf("--section") + 1] : null;
const dir = section ? `public/data/sections/${section}` : "public/data";
const name = (base: string) => (section ? `${dir}/${base}.json` : `${dir}/${base}-poc.json`);
const header = json<{ cols: number; rows: number; spacingM: number; originE: number; originN: number; nodata: number; file: string; sourceFile: string }>(name("dem"));
const f32 = read(`${dir}/${header.file}`);
const dem = {
  ...header,
  heights: new Float32Array(f32.buffer.slice(f32.byteOffset, f32.byteOffset + f32.byteLength)),
  sourceIndex: new Uint8Array(read(`${dir}/${header.sourceFile}`)),
};
const landMeta = json<{ legend: string[]; file: string }>(name("landcover"));
const land = { legend: landMeta.legend, classes: new Uint8Array(read(`${dir}/${landMeta.file}`)) };
const profile = json<TrailProfile>(name("trail-profile"));
const registerPath = section ? `data/features-${section}.json` : "data/features-3d.json";
const scenes = section ? [`Section-${section}`, "Reel3D"] : ["Poc3DMaentwrog"];

const cfg = section ? Object.values(SECTIONS).find((c) => c.window === section && c.kind === "ground") : undefined;
if (section && !cfg) throw new Error(`"${section}" is not a ground window with a section config (review R5): ${Object.values(SECTIONS).filter((c) => c.kind === "ground").map((c) => c.window).join(", ")}`);
const { cutFill } = cfg ? buildSectionScene(cfg, { route, dem, land, profile, osm: [], features: [] }) : buildPocScene({ route, dem, land, profile });
const features = json<Feature[]>(registerPath).filter((f) => f.kind !== "earthwork");
for (const r of cutFill) {
  features.push({
    id: `earthwork-${r.kind}-${r.fromKm.toFixed(3)}`,
    kind: "earthwork",
    category: "approximate",
    source: { type: "lidar-dtm", ref: "implied by flattening the 3 m trail corridor onto the lidar terrain" },
    scenes,
    fromKm: r.fromKm,
    toKm: r.toKm,
    note: `${r.kind}, up to ${r.maxDepthM.toFixed(1)} m; DEM-derived, not a surveyed earthwork`,
  });
}
writeFileSync(resolve(ROOT, registerPath), JSON.stringify(features, null, 2) + "\n");
console.log(`${cutFill.length} earthworks: ${cutFill.map((r) => `${r.kind} ${r.fromKm}-${r.toKm} km (${r.maxDepthM.toFixed(1)} m)`).join("; ")}`);
