// Adds an "approximate" earthwork entry to data/features-3d.json for every cut or fill
// deeper than 2 m that flattening the trail corridor implies (spec G5b). Uses the same
// TypeScript core the video renders with, so the register can't drift from the scene.
//   npm run data:earthworks   (after python3 scripts/build_poc_data.py)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRouteModel } from "../src/data/route";
import { buildPocScene } from "../src/three-core/poc";
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
const header = json<{ cols: number; rows: number; spacingM: number; originE: number; originN: number; nodata: number }>(
  "public/data/dem-poc.json",
);
const f32 = read("public/data/dem-poc.f32");
const dem = {
  ...header,
  heights: new Float32Array(f32.buffer.slice(f32.byteOffset, f32.byteOffset + f32.byteLength)),
  sourceIndex: new Uint8Array(read("public/data/dem-poc-source.u8")),
};
const land = { legend: json<{ legend: string[] }>("public/data/landcover-poc.json").legend, classes: new Uint8Array(read("public/data/landcover-poc.u8")) };
const profile = json<TrailProfile>("public/data/trail-profile-poc.json");

const { cutFill } = buildPocScene({ route, dem, land, profile });
const features = json<Feature[]>("data/features-3d.json").filter((f) => f.kind !== "earthwork");
for (const r of cutFill) {
  features.push({
    id: `earthwork-${r.kind}-${r.fromKm.toFixed(3)}`,
    kind: "earthwork",
    category: "approximate",
    source: { type: "lidar-dtm", ref: "implied by flattening the 3 m trail corridor onto the lidar terrain" },
    scenes: ["Poc3DMaentwrog"],
    fromKm: r.fromKm,
    toKm: r.toKm,
    note: `${r.kind}, up to ${r.maxDepthM.toFixed(1)} m; DEM-derived, not a surveyed earthwork`,
  });
}
writeFileSync(resolve(ROOT, "data/features-3d.json"), JSON.stringify(features, null, 2) + "\n");
console.log(`${cutFill.length} earthworks: ${cutFill.map((r) => `${r.kind} ${r.fromKm}-${r.toKm} km (${r.maxDepthM.toFixed(1)} m)`).join("; ")}`);
