import { describe, expect, it } from "vitest";
import { defaultCyclistDims } from "../../src/three-core/cyclistMotion";
import { validateFeatures, validateImageryHeader, type OsmLine, type SectionBuilding } from "../../src/three-core/registers";
import { buildSectionScene, SECTIONS, type SectionConfig, type SectionScene } from "../../src/three-core/sections";
import type { GroundImage } from "../../src/three-core/shading";
import type { TrailProfile } from "../../src/three-core/trail";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { REEL_LOOK, REEL_SCENES } from "../../src/data/reel-timeline";
import { PHOTO_LEGEND, photoEarthworksLine, reelCaptions } from "../../src/data/reel-captions";
import { wgs84ToBng } from "../../src/three-core/bng";
import { readJson, readProjectFile, realRoute } from "./fixtures";

// The reel in the photo look (docs/adr/0060-reel-in-the-photo-look.md): every scene carries the photoreal layer's
// extras, the concept look stays exactly as it was, and each ground scene's people (walkers, runners and people behind
// prams) come from a seeded draw on its own trail that keeps the rider's rules (ADR 61).

const GROUND = ["blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"];
const AERIAL = ["intro", "heritage", "overview", "closing"];
const f32 = (rel: string) => {
  const b = readProjectFile(rel);
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};

/** Every file a section's scene reads, the photo look's optional ones included. */
function inputs(cfg: SectionConfig) {
  const w = `public/data/sections/${cfg.window}`;
  const header = readJson<DemGrid & { file: string; sourceFile: string }>(`${w}/dem.json`);
  const dem: DemGrid = { ...header, heights: f32(`${w}/${header.file}`), sourceIndex: new Uint8Array(readProjectFile(`${w}/${header.sourceFile}`)) };
  const landMeta = readJson<{ legend: string[]; file: string }>(`${w}/landcover.json`);
  const imageryHeader = cfg.photo?.imagery ? validateImageryHeader(readJson<unknown>(`${w}/imagery.json`), `${w}/imagery.json`, dem) : null;
  const imagery: GroundImage | undefined = imageryHeader ? { width: imageryHeader.width, height: imageryHeader.height, scale: imageryHeader.scale, rgb: new Uint8Array(readProjectFile(`${w}/${imageryHeader.file}`)) } : undefined;
  return {
    route: realRoute(),
    dem,
    land: { legend: landMeta.legend, classes: new Uint8Array(readProjectFile(`${w}/${landMeta.file}`)) } as LandCover,
    profile: readJson<TrailProfile>(`${w}/trail-profile.json`),
    osm: readJson<{ features: OsmLine[] }>(`${w}/osm.geojson`).features,
    features: [...validateFeatures(readJson<unknown>("data/features-3d.json")), ...validateFeatures(readJson<unknown>(`data/features-${cfg.window}.json`))],
    waterLevels: Object.fromEntries(Object.entries(readJson<Record<string, { levelM: number }>>("data/water-levels.json")).map(([k, v]) => [k, v.levelM])),
    buildings: readJson<SectionBuilding[]>(`${w}/buildings.json`),
    canopy: f32(`${w}/canopy.f32`),
    barriers: readJson<{ features: OsmLine[] }>(`${w}/barriers.geojson`).features,
    ...(imagery && { imagery }),
  };
}

describe("the reel's look (ADR 60)", () => {
  it("is the photo look, for every scene, and its attribution credits the satellite image instead of the map tiles", () => {
    expect(REEL_LOOK).toBe("photo");
    expect(new Set(REEL_SCENES.map((s) => s.config))).toEqual(new Set([...GROUND, ...AERIAL]));
    const credit = reelCaptions("photo").find((c) => c.id === "attribution")!.text;
    for (const word of ["lidar", "OpenStreetMap", "Contains modified Copernicus Sentinel data 2025", "not survey-grade"]) expect(credit).toContain(word);
    expect(credit).not.toContain("OpenTopoMap");
    expect(reelCaptions("concept").find((c) => c.id === "attribution")!.text).toContain("OpenTopoMap");
  });

  it("keeps the photo legend to three lines (spec CL10): the bridge, an earthwork and one line for the people and the verges", () => {
    const lines = [PHOTO_LEGEND.bridge, photoEarthworksLine(8.6, 9.01), PHOTO_LEGEND.ground];
    expect(Object.keys(PHOTO_LEGEND).length + 1).toBeLessThanOrEqual(3);
    // the legend box does not wrap: each line stays short enough to sit right of the 820 px caption column
    for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(70);
    expect(PHOTO_LEGEND.ground).toMatch(/illustrative/);
    expect(PHOTO_LEGEND.ground).toMatch(/levelled and cleared/);
  });

  it("gives every ground scene the prototype's extras and every aerial scene the lidar canopy, its walls and the satellite image", () => {
    for (const id of GROUND) {
      const p = SECTIONS[id].photo!;
      expect(p, id).toMatchObject({ canopyTrees: true, barriers: true, grassBandM: 50, treeClearOfTrailM: 5 });
      expect(p.walkers, id).toBeUndefined();
      expect(p.people!.count, id).toBeGreaterThanOrEqual(4);
      // the grass covers the stretch both shots see: the drone's track and the rider's ride
      const s = SECTIONS[id].shots[0];
      expect(p.grassAlongM![0], id).toBeLessThanOrEqual(s.kind === "drone-side" ? s.fromDistM : 0);
      expect(p.grassAlongM![1], id).toBeGreaterThan(SECTIONS[id].startDistM + 100);
    }
    for (const id of AERIAL) expect(SECTIONS[id].photo, id).toMatchObject({ canopyTrees: true, barriers: true, canopyCover: true, imagery: true, treesPerNode: 3, treeZoneM: 1500 });
  });
});

describe("the concept look ignores the photo extras (ADR 60)", () => {
  for (const id of [...GROUND, ...AERIAL]) {
    it(`${id}: the same trees, roads, water and bridges as the config without them, and no grass, boundaries or walkers`, () => {
      const cfg = SECTIONS[id];
      const all = inputs(cfg);
      const concept = buildSectionScene(cfg, all, "concept");
      const before = buildSectionScene({ ...cfg, photo: undefined }, all, "concept");
      expect(concept.trees).toEqual(before.trees);
      expect(concept.roads).toEqual(before.roads);
      expect(concept.water.map((w) => w.id)).toEqual(before.water.map((w) => w.id));
      expect(concept.bridges.length).toBe(before.bridges.length);
      expect(concept.terrain.colors).toEqual(before.terrain.colors);
      expect(concept.grass).toEqual([]);
      expect(concept.walkers).toEqual([]);
      expect(concept.barriers.wall.positions.length + concept.barriers.hedge.positions.length + concept.barriers.fence.positions.length).toBe(0);
      expect(concept.groundImage).toBeUndefined();
    }, 60_000);
  }
});

describe("the photo look's people on each real trail: walkers, runners and prams at random (C9, ADRs 60, 61)", () => {
  const counts: Record<string, number> = { run: 0, pram: 0, walk: 0 };
  const aside = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
  for (const id of GROUND) {
    it(`${id}: the same draw every time, a runner and a pram among them, each in the section, seen, and clear of the rider, the camera and the others`, () => {
      const cfg = SECTIONS[id];
      const all = inputs(cfg);
      const scene = buildSectionScene(cfg, all, "photo") as SectionScene;
      expect(buildSectionScene(cfg, all, "photo").walkers.map((t) => t.spec)).toEqual(scene.walkers.map((t) => t.spec));
      const people = scene.walkers;
      const want = cfg.photo!.people!.count;
      expect(people.length, `${id}: ${people.length} of ${want} placed`).toBeGreaterThanOrEqual(want - 1);
      expect(people.length).toBeLessThanOrEqual(want);
      const act = (t: (typeof people)[number]) => t.spec.activity ?? "walk";
      expect(people.some((t) => act(t) === "run"), `${id} has a runner`).toBe(true);
      expect(people.some((t) => act(t) === "pram"), `${id} has a pram`).toBe(true);
      for (const t of people) counts[act(t)]++;
      const lateral = defaultCyclistDims().lateralOffsetM;
      // along the path a person takes ±0.3 m (a runner ±0.4) and a pram 1.3 m ahead of its pusher; the rider ±1 m
      const spanOf = (t: (typeof people)[number], d: number): [number, number] => {
        const [back, ahead] = act(t) === "pram" ? [0.3, 1.3] : act(t) === "run" ? [0.4, 0.4] : [0.3, 0.3];
        return t.spec.direction === 1 ? [d - back, d + ahead] : [d - ahead, d + back];
      };
      const meet = (a: [number, number], b: [number, number]) => a[0] <= b[1] && b[0] <= a[1];
      const half = (t: (typeof people)[number]) => (act(t) === "pram" ? 0.33 : 0.28);
      const partners = (a: (typeof people)[number], b: (typeof people)[number]) =>
        act(a) === "walk" && act(b) === "walk" && a.spec.direction === b.spec.direction && Math.abs(a.spec.startDistM - b.spec.startDistM) <= 0.31 && Math.abs(Math.abs(a.spec.sideM - b.spec.sideM) - 0.55) < 0.011;
      for (const t of people) {
        expect(Math.abs(t.spec.sideM)).toBeLessThanOrEqual(1);
        let seen = false;
        for (let f = 0; f < cfg.frames; f++) {
          const d = t.table[f];
          const sp = spanOf(t, d);
          expect(sp[0]).toBeGreaterThanOrEqual(cfg.kmRange[0] * 1000);
          expect(sp[1]).toBeLessThanOrEqual(cfg.kmRange[1] * 1000);
          // passing the rider: the bars and an elbow (0.35 m) and the person's half-width with 0.27 m between them
          if (meet(sp, [scene.table[f] - 1, scene.table[f] + 1])) expect(Math.abs(lateral - t.spec.sideM), `${id} ${act(t)} ${t.spec.seed} beside the rider at frame ${f}`).toBeGreaterThanOrEqual(0.35 + half(t) + 0.27 - 1e-9);
          for (const o of people) {
            if (o === t || partners(o, t)) continue;
            if (meet(sp, spanOf(o, o.table[f]))) expect(Math.abs(o.spec.sideM - t.spec.sideM), `${id} ${t.spec.seed} and ${o.spec.seed} at frame ${f}`).toBeGreaterThanOrEqual(half(t) + half(o) + 0.05 - 1e-9);
          }
          const cam = scene.shot(f);
          const p = t.poseAt(f).position;
          expect(Math.hypot(cam.position[0] - p[0], cam.position[1] - p[1] - 0.1, cam.position[2] - p[2]) * 10, `${id} ${t.spec.seed} by the camera at frame ${f}`).toBeGreaterThanOrEqual(2.9);
          // on screen within 40 m at some frame: in front of the camera, inside its 45° view, near enough to read
          const fx = cam.target[0] - cam.position[0];
          const fz = cam.target[2] - cam.position[2];
          const dx = p[0] - cam.position[0];
          const dz = p[2] - cam.position[2];
          const depth = (dx * fx + dz * fz) / Math.hypot(fx, fz);
          if (depth > 0 && aside(dx, dz, 0, 0) * 10 <= 41 && Math.abs(dx * -fz + dz * fx) / Math.hypot(fx, fz) <= Math.tan(Math.PI / 8) * (16 / 9) * depth) seen = true;
        }
        expect(seen, `${id} ${act(t)} ${t.spec.seed} is on screen at some frame`).toBe(true);
      }
    }, 60_000);
  }
  it("across the reel: at least three runners and three prams, and walkers too", () => {
    expect(counts.run).toBeGreaterThanOrEqual(3);
    expect(counts.pram).toBeGreaterThanOrEqual(3);
    expect(counts.walk).toBeGreaterThanOrEqual(1);
  });
});

describe("the aerial scenes' ground and trees (ADR 60)", () => {
  const cfg = SECTIONS.intro;
  const all = inputs(cfg);
  const scene = buildSectionScene(cfg, all, "photo");

  it("map the satellite image on the corridor's own grid, node for node, and colour each node from its pixel", () => {
    const img = scene.groundImage!;
    expect(img.cols).toBe(all.dem.cols);
    expect(img.rows).toBe(all.dem.rows);
    expect(img.width).toBe((all.dem.cols - 1) * img.scale + 1);
    expect(img.height).toBe((all.dem.rows - 1) * img.scale + 1);
    expect(scene.terrain.colors!.length).toBe(all.dem.cols * all.dem.rows * 3);
    // the lakes OSM maps are dark in the photograph: water nodes are far darker than the land around them
    const water = all.land.legend.indexOf("water");
    const luma = (k: number) => scene.terrain.colors![3 * k] + scene.terrain.colors![3 * k + 1] + scene.terrain.colors![3 * k + 2];
    let [wSum, wN, lSum, lN] = [0, 0, 0, 0];
    all.land.classes.forEach((c, k) => (c === water ? ((wSum += luma(k)), wN++) : ((lSum += luma(k)), lN++)));
    expect(wN).toBeGreaterThan(1000);
    expect(wSum / wN).toBeLessThan(0.5 * (lSum / lN));
  });

  it("grow trees only where the lidar canopy stands at least 3 m, never on built-up, quarry or water nodes, up to the cap", () => {
    const bare = all.land.legend.map((n) => /built|quarry|rock|water/.test(n));
    const { originE, originN, spacingM, cols } = all.dem;
    let n = 0;
    for (const t of [...scene.trees.conifer, ...scene.trees.broadleaf]) {
      expect(t.scale).toBeGreaterThan(0);
      n++;
    }
    expect(n).toBeGreaterThan(10_000);
    // the photo look's woods take their kinds from OSM, and the two kinds share twice the per-kind cap (trees.ts woodKinds)
    expect(scene.trees.conifer.length + scene.trees.broadleaf.length).toBeLessThanOrEqual(2 * cfg.maxTreesPerKind!);
    // a sample of crowns: each stands beside a node where the canopy is at least 3 m and the cover is not bare
    for (const t of [...scene.trees.conifer, ...scene.trees.broadleaf].filter((_, i) => i % 97 === 0)) {
      const ll = all.route.unproject(t.x, t.z);
      const { e, n: north } = wgs84ToBng(ll.lon, ll.lat);
      const c = Math.round((e - originE) / spacingM);
      const r = Math.round((originN - north) / spacingM);
      const near = [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => (r + dr) * cols + (c + dc)));
      expect(near.some((k) => all.canopy[k] >= 3 && !bare[all.land.classes[k]]), `tree at node ${r},${c}`).toBe(true);
    }
  });
});
