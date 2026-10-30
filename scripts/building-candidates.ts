// Lists the OSM (and OS-only) building footprints each section's shots actually see (spec BL1; docs/adr/0049-buildings-from-sourced-data.md),
// with the same TypeScript core the video renders with. Only these are built or researched. A window several sections
// share (the corridor: the four aerial scenes, which draw buildings in the photo look, ADR 63) takes every section's poses.
//   npm run data:candidates -- --section <window>   → data/building-candidates-<window>.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRouteModel } from "../src/data/route";
import { buildSectionScene, SECTIONS } from "../src/three-core/sections";
import type { OsmLine } from "../src/three-core/registers";
import type { TrailProfile } from "../src/three-core/trail";
import { visibleFootprints } from "../src/three-core/visibility";

const ROOT = resolve(process.cwd());
const read = (rel: string) => readFileSync(resolve(ROOT, rel));
const json = <T>(rel: string): T => JSON.parse(read(rel).toString("utf8")) as T;
const section = process.argv[process.argv.indexOf("--section") + 1];
const cfgs = Object.values(SECTIONS).filter((c) => c.window === section);
if (!section || cfgs.length === 0) throw new Error(`--section <window> required: ${[...new Set(Object.values(SECTIONS).map((c) => c.window))].join(", ")}`);

const route = buildRouteModel(json("data/railway-route.geojson"), json("data/waypoints.json"), json("data/elevation-profile.json"), { tileSize: 256, layers: [] });
const dir = `public/data/sections/${section}`;
const header = json<{ cols: number; rows: number; spacingM: number; originE: number; originN: number; nodata: number; file: string; sourceFile: string }>(`${dir}/dem.json`);
const f32 = read(`${dir}/${header.file}`);
const dem = { ...header, heights: new Float32Array(f32.buffer.slice(f32.byteOffset, f32.byteOffset + f32.byteLength)), sourceIndex: new Uint8Array(read(`${dir}/${header.sourceFile}`)) };
const landMeta = json<{ legend: string[]; file: string }>(`${dir}/landcover.json`);
const land = { legend: landMeta.legend, classes: new Uint8Array(read(`${dir}/${landMeta.file}`)) };
const osm = json<{ features: OsmLine[] }>(`${dir}/osm.geojson`).features;
const scenes = cfgs.map((cfg) => ({ cfg, scene: buildSectionScene(cfg, { route, dem, land, profile: json<TrailProfile>(`${dir}/trail-profile.json`), osm, features: [] }) }));
const scene = scenes[0].scene; // every scene on a window shares its terrain, so any gives the ground

type LonLat = [number, number];
// with the OS outlines OSM lacks (ids os/<OS id>; scripts/fetch_os_buildings.py, ADR 63), tested the same way
const osPath = `data/os-buildings-${section}.geojson`;
const osOnly = existsSync(resolve(ROOT, osPath)) ? json<{ features: OsmLine[] }>(osPath).features : [];
// less the demolished ones build_buildings.py recorded: the reel shows what stands (ADR 63)
const removedPath = `data/buildings-removed-${section}.json`;
const removed = new Set(existsSync(resolve(ROOT, removedPath)) ? json<{ source: { ref: string } }[]>(removedPath).map((r) => r.source.ref) : []);
const buildings = [...osm, ...osOnly].filter((f) => f.properties.tags.building && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") && !removed.has(f.properties.id));
const outerOf = (f: OsmLine): LonLat[] => (f.geometry.type === "Polygon" ? (f.geometry.coordinates as LonLat[][])[0] : (f.geometry.coordinates as LonLat[][][])[0][0]);
// Each footprint is tested at its measured height (written by build_buildings.py), or at an upper bound until it has
// one: a tall building whose base is behind a rise still shows its roof. Two passes give the list at measured heights:
// candidates → build_buildings.py (measures them) → candidates again → build_buildings.py (docs/sop-3d.md).
const UPPER_M = 60; // above the tallest structure in the windows (Trawsfynydd's reactor halls, about 54 m)
const cachePath = `data/building-heights-${section}.json`;
const measured: Record<string, { heightM: number }> = existsSync(resolve(ROOT, cachePath)) ? json(cachePath) : {};
const footprints = buildings.map((f) => ({
  id: f.properties.id,
  ring: outerOf(f).map(([lon, lat]) => {
    const p = route.project(lon, lat);
    return { x: p.x, z: p.y };
  }),
  heightM: measured[f.properties.id]?.heightM ?? UPPER_M,
}));
// a footprint that runs off the terrain window has no ground there, so it is never built (BL5; t10 H2)
const onTerrain = (f: (typeof footprints)[number]) => f.ring.every((p) => Number.isFinite(scene.heightAt(p.x, p.z)));
const offTerrain = footprints.filter((f) => !onTerrain(f)).map((f) => f.id);
const poses = scenes.flatMap(({ cfg, scene: s }) => Array.from({ length: Math.ceil(cfg.frames / 10) }, (_, k) => s.shot(k * 10)));
const seen = new Set(visibleFootprints(poses, footprints.filter(onTerrain), scene.heightAt, { far: 600 }));
// and every footprint near the line, seen or not, so the route's own buildings exist for any shot (ADR 63)
const NEAR_LINE_M = 300;
const samples = scene.trail.samples.filter((_, i) => i % 5 === 0);
const nearLine = (f: (typeof footprints)[number]) => f.ring.some((p) => samples.some((s) => Math.hypot(s.x - p.x, s.z - p.z) * 10 <= NEAR_LINE_M));
const near = new Set(footprints.filter(onTerrain).filter(nearLine).map((f) => f.id));
for (const id of near) seen.add(id);
const area = (r: LonLat[]) => {
  const lat0 = (r[0][1] * Math.PI) / 180;
  const m = r.map(([lon, lat]) => [lon * 111_320 * Math.cos(lat0), lat * 110_540]);
  return Math.abs(m.reduce((a, p, i) => a + p[0] * m[(i + 1) % m.length][1] - m[(i + 1) % m.length][0] * p[1], 0)) / 2;
};
const candidates = buildings
  .filter((f) => seen.has(f.properties.id))
  .map((f) => {
    const r = outerOf(f);
    const lon = r.reduce((a, p) => a + p[0], 0) / r.length;
    const lat = r.reduce((a, p) => a + p[1], 0) / r.length;
    return { id: f.properties.id, lon: Number(lon.toFixed(6)), lat: Number(lat.toFixed(6)), areaM2: Math.round(area(r)), testedAtM: measured[f.properties.id]?.heightM ?? UPPER_M };
  })
  .sort((a, b) => a.id.localeCompare(b.id));
const unmeasured = candidates.filter((c) => !measured[c.id]).length;
writeFileSync(resolve(ROOT, `data/building-candidates-${section}.json`), JSON.stringify({ section, footprints: buildings.length, osOnly: osOnly.length, posesSampled: poses.length, farM: 6000, upperBoundM: UPPER_M, nearLineM: NEAR_LINE_M, nearLine: near.size, unmeasured, candidates }, null, 2) + "\n");
if (offTerrain.length) console.log(`${section}: ${offTerrain.length} footprints run off the terrain window and are left out`);
console.log(`${section}: ${candidates.length} of ${buildings.length} footprints (${near.size} within ${NEAR_LINE_M} m of the line, the rest seen in ${poses.length} sampled poses); ${unmeasured} tested at the ${UPPER_M} m upper bound${unmeasured ? " (run build_buildings.py, then this again)" : ""}`);
