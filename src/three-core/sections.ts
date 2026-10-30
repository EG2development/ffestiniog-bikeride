// Iteration 2: camera keep-out for trees (docs/adr/0047-trees-clear-of-camera-corridor.md); budgets re-measured, trees give way first (docs/adr/0052-budgets-remeasured-trees-first.md).
import type { RouteModel } from "../data/route";
import { barrierLines, buildBarrierMeshes, type BarrierMeshes } from "./barriers";
import { wgs84ToBng } from "./bng";
import { buildBridgeMesh } from "./bridge";
import { placeGrass, type GrassClump } from "./grass";
import { sectionBuildings, type BuildingStatus, type SectionBuildings } from "./buildings";
import { aerialOrbit, droneSideTrack, firstPersonShot, followShot, liftClear, pullBack, sequenceShots, withClearance, type HeightAt, type Shot } from "./camera";
import { cyclistPose, defaultCyclistDims, distanceTable, type CyclistDims } from "./cyclistMotion";
import { buildTerrainMesh, heightAtBng } from "./dem";
import type { Feature, OsmLine, SectionBuilding } from "./registers";
import { buildRoadMesh, type RoadLine } from "./roads";
import { IMAGERY_GRADE } from "./photoLook";
import { imageryNodeColours, imageryPixels, shadeTerrain, type GroundImage } from "./shading";
import { buildTrail, flattenCorridor, TRAIL_WIDTH_M, type CutFill, type Trail, type TrailProfile } from "./trail";
import { placeTrees, type TreePlacement } from "./trees";
import type { DemGrid, LandCover, MeshArrays, Vec3 } from "./types";
import { placePeople, type PeopleOptions } from "./people";
import { walkerTracks, type WalkerSpec, type WalkerTrack } from "./walkers";
import { waterBodies, type WaterBody } from "./water";

export type { OsmLine } from "./registers";

// One config per scene and one assembly for every section (docs/adr/0027-section-config.md). The
// Maentwrog config reproduces the proof of concept exactly (docs/adr/0040-migrate-maentwrog-first.md).

export type SectionKind = "ground" | "aerial";
/** `concept` is the reel's first look; `photo` the photoreal layer's (docs/adr/0054-photoreal-layer.md), the reel's own since
 * docs/adr/0060-reel-in-the-photo-look.md. A config's `photo` extras are built only in the photo look. */
export type Look = "concept" | "photo";
export type ShotSpec =
  | { kind: "drone-side"; fromDistM: number; toDistM: number; startHeightM: number; endHeightM: number; sideM: number; frames: number }
  | { kind: "follow"; backM: number; upM: number; sideM: number; frames: number }
  | { kind: "aerial-orbit"; centreDistM: number; radiusM: number; heightM: number; fromDeg: number; toDeg: number; frames: number }
  | { kind: "pull-back"; fromDistM: number; startHeightM: number; endHeightM: number; backM: number; frames: number }
  | { kind: "hold"; distM: number; heightM: number; sideM: number; frames: number }
  | { kind: "first-person"; eyeHeightM: number; lookAheadM: number; frames: number };
export type SectionConfig = {
  id: string;
  title: string;
  kind: SectionKind;
  kmRange: [number, number];
  /** the data window under public/data/sections/ */
  window: string;
  frames: number;
  startDistM: number;
  shots: ShotSpec[];
  captionIds: string[];
  featureIds: string[];
  ve: 1;
  /** instanced trees per kind; lower for a window whose terrain alone is large (RN6) */
  maxTreesPerKind?: number;
  /** the photoreal layer's sourced extras (docs/adr/0054-photoreal-layer.md), built in the photo look only, so the concept
   * look's output stays unchanged (ADR 60): trees sized from the lidar canopy (ADR 57), OSM field boundaries (ADR 58),
   * grass clumps along the stretch the camera sees, and the walkers a section choreographs on the trail (ADR 59) */
  photo?: {
    canopyTrees: boolean;
    barriers: boolean;
    /** grass along this stretch of the route (metres), out to `grassBandM` either side; ground sections only */
    grassAlongM?: [number, number];
    grassBandM?: number;
    walkers?: WalkerSpec[];
    /** walkers, runners and people behind prams by a seeded draw, along `grassAlongM` (ADR 61) */
    people?: PeopleOptions;
    /** trunks no closer than this to the centreline, instead of the reel's 10 m (ADR 11): the lidar canopy stands
     * 5 m from the line along much of the route (review 2026-10-30), and the shots' sight lines still keep the rider clear */
    treeClearOfTrailM?: number;
    /** an aerial window's trees (ADR 60): every woodland node within this distance of the line (the reel's ground windows use 300 m) */
    treeZoneM?: number;
    /** trees per woodland node on a coarse grid: the corridor's 16 m nodes hold several crowns (ADR 60) */
    treesPerNode?: number;
    /** trees wherever the lidar canopy stands, mapped as woodland or not (built-up, quarry and water excepted; ADR 60) */
    canopyCover?: boolean;
    /** the ground's colour from the window's Sentinel-2 image instead of its land cover (ADR 60) */
    imagery?: boolean;
  };
};

/** The shot spec that owns a section frame, or the last shot past the end (as sequenceShots plays them). */
export function shotSpecAt(cfg: SectionConfig, frame: number): ShotSpec {
  let start = 0;
  for (let i = 0; i < cfg.shots.length; i++) {
    const s = cfg.shots[i];
    if (frame < start + s.frames || i === cfg.shots.length - 1) return s;
    start += s.frames;
  }
  throw new Error(`section ${cfg.id} has no shots`);
}
export const shotKindAt = (cfg: SectionConfig, frame: number): ShotSpec["kind"] => shotSpecAt(cfg, frame).kind;

/**
 * The km range covered by the registered earthworks that overlap a stretch of the route (metres), or null when none
 * does: a drone shot that flies over a cut or fill names it as approximate in the legend (spec G8; review 2026-10-30).
 */
export function earthworksInRange(features: readonly Feature[], rangeM: [number, number]): [number, number] | null {
  let out: [number, number] | null = null;
  for (const f of features) {
    if (f.kind !== "earthwork" || f.fromKm === undefined || f.toKm === undefined) continue;
    if (f.toKm * 1000 < rangeM[0] || f.fromKm * 1000 > rangeM[1]) continue;
    out = out ? [Math.min(out[0], f.fromKm), Math.max(out[1], f.toKm)] : [f.fromKm, f.toKm];
  }
  return out;
}

const ROUTE_KM: [number, number] = [0, 13.24];
const SHARED = ["terrain-lidar", "landcover-osm", "trail-proposed", "trees", "cyclist"];
// The photo look's extras for the reel (docs/adr/0060-reel-in-the-photo-look.md). A ground scene grows grass along the
// stretch its two shots see and keeps trunks 5 m off the line, as the prototype does; its people (walkers, runners and
// people behind prams) come from a seeded draw on that stretch, each kept only where it clears the rider, the camera and
// the others (ADR 61; tests/three-core/reel-photo.test.ts). An aerial scene draws the lidar canopy across
// the corridor wherever it stands, mapped woodland or not, three crowns to a 16 m node within 1.5 km of the line.
const groundPhoto = (grassAlongM: [number, number], people: PeopleOptions): NonNullable<SectionConfig["photo"]> => ({ canopyTrees: true, barriers: true, grassAlongM, grassBandM: 50, treeClearOfTrailM: 5, people });
const AERIAL_PHOTO: NonNullable<SectionConfig["photo"]> = { canopyTrees: true, barriers: true, treeZoneM: 1500, treesPerNode: 3, canopyCover: true, imagery: true };
const ground = (c: Omit<SectionConfig, "kind" | "ve" | "featureIds"> & { featureIds?: string[] }): SectionConfig => ({ kind: "ground", ve: 1, featureIds: SHARED, ...c });
const aerial = (c: Omit<SectionConfig, "kind" | "ve" | "featureIds" | "kmRange" | "window">): SectionConfig => ({ kind: "aerial", ve: 1, featureIds: ["terrain-lidar", "trail-proposed"], kmRange: ROUTE_KM, window: "corridor", photo: AERIAL_PHOTO, maxTreesPerKind: AERIAL_TREES_PER_KIND, ...c });
/** the aerial scenes' cap on each tree kind in the photo look (the concept look draws none); with trunks left out and
 * the unseen trees culled (ADR 60) the scene pass, shadow map included, stays inside RL24's 2 M triangles */
const AERIAL_TREES_PER_KIND = 20000;

export const SECTIONS: Record<string, SectionConfig> = {
  intro: aerial({ id: "intro", title: "Introduction", frames: 240, startDistM: 8660, captionIds: ["intro-title"], shots: [{ kind: "aerial-orbit", centreDistM: 8660, radiusM: 420, heightM: 260, fromDeg: 200, toDeg: 140, frames: 240 }] }),
  heritage: aerial({ id: "heritage", title: "Historic railway", frames: 240, startDistM: 5330, captionIds: ["heritage"], shots: [{ kind: "hold", distM: 5330, heightM: 180, sideM: 150, frames: 240 }] }),
  overview: aerial({ id: "overview", title: "Route overview", frames: 300, startDistM: 6600, captionIds: ["overview-title"], shots: [{ kind: "pull-back", fromDistM: 6600, startHeightM: 300, endHeightM: 600, backM: 300, frames: 300 }] }),
  blaenau: ground({ id: "blaenau", title: "Blaenau Ffestiniog", kmRange: [0, 1.5], window: "blaenau", frames: 300, startDistM: 300, captionIds: ["live-station"], shots: [{ kind: "drone-side", fromDistM: 150, toDistM: 280, startHeightM: 120, endHeightM: 25, sideM: 40, frames: 150 }, { kind: "follow", backM: 8, upM: 3, sideM: 1.5, frames: 150 }],
    photo: groundPhoto([100, 560], { count: 5, seed: 2101 }) }),
  "vale-north": ground({ id: "vale-north", title: "Vale of Ffestiniog, north", kmRange: [1.5, 4.8], window: "vale-north", frames: 270, startDistM: 3000, captionIds: ["vale-north-title"], shots: [{ kind: "drone-side", fromDistM: 2850, toDistM: 2970, startHeightM: 120, endHeightM: 25, sideM: 40, frames: 135 }, { kind: "follow", backM: 8, upM: 3, sideM: 1.5, frames: 135 }],
    photo: groundPhoto([2800, 3250], { count: 4, seed: 3101 }) }),
  "vale-south": ground({ id: "vale-south", title: "Vale of Ffestiniog, south", kmRange: [4.8, 7.7], window: "vale-south", frames: 270, startDistM: 5400, captionIds: ["vale-title"], shots: [{ kind: "drone-side", fromDistM: 5250, toDistM: 5370, startHeightM: 120, endHeightM: 25, sideM: 40, frames: 135 }, { kind: "follow", backM: 8, upM: 3, sideM: 1.5, frames: 135 }],
    photo: groundPhoto([5200, 5650], { count: 4, seed: 4101 }) }),
  maentwrog: ground({ id: "maentwrog", title: "Maentwrog Road", kmRange: [7.7, 9.7], window: "maentwrog", frames: 360, startDistM: 9120, captionIds: ["private-home"], featureIds: [...SHARED, "bridge-159029124"], shots: [{ kind: "drone-side", fromDistM: 8980, toDistM: 9100, startHeightM: 120, endHeightM: 25, sideM: 40, frames: 180 }, { kind: "follow", backM: 8, upM: 3, sideM: 1.5, frames: 180 }],
    photo: groundPhoto([8850, 9320], { count: 5, seed: 5101 }) }),
  trawsfynydd: ground({ id: "trawsfynydd", title: "Trawsfynydd Lake Halt to Trawsfynydd", kmRange: [9.7, 13.24], window: "trawsfynydd", frames: 480, startDistM: 10300, captionIds: ["decommissioning"], maxTreesPerKind: 2500, // the drone flies on the left of the line, low, so Llyn Trawsfynydd (1.8 km to the right) stays in view beyond the rider
    shots: [{ kind: "drone-side", fromDistM: 10120, toDistM: 10260, startHeightM: 60, endHeightM: 20, sideM: -120, frames: 240 }, { kind: "follow", backM: 8, upM: 3, sideM: 1.5, frames: 240 }],
    photo: groundPhoto([10050, 10650], { count: 6, seed: 6101 }) }),
  closing: aerial({ id: "closing", title: "Future vision", frames: 300, startDistM: 11000, captionIds: ["concept-card"], shots: [{ kind: "pull-back", fromDistM: 11000, startHeightM: 150, endHeightM: 600, backM: 400, frames: 300 }] }),
};

// Prototype configs outside the reel (docs/adr/0054-photoreal-layer.md): rendered by their own compositions, never by
// Reel3D, so the reel's budget, captions and tests are untouched. The photoreal proof of concept rides the Maentwrog
// window: an aerial establishing shot, the rider's own view approaching the OSM bridge, then a follow shot across it.
// Its walkers (ADR 59) are choreographed against the rider's table (about 15 km/h up the 2 % climb from km 9.085): one
// walking the rider's way on the right, overtaken in the rider's view at about frame 245, and a pair coming the other
// way on the rider's right (their left), met at about frame 300; all three are behind the follow camera when it cuts in.
export const PROTOTYPES: Record<string, SectionConfig> = {
  "maentwrog-photo": ground({
    id: "maentwrog-photo",
    title: "Maentwrog Road (photoreal prototype)",
    kmRange: [7.7, 9.7],
    window: "maentwrog",
    frames: 600,
    startDistM: 9085,
    captionIds: [],
    // the same list as the composition's FEATURE_IDS (review 2026-10-30): the canopy trees and the grass, not the reel's woodland draw
    featureIds: ["terrain-lidar", "landcover-osm", "trail-proposed", "trees-canopy-maentwrog", "grass-maentwrog", "cyclist", "walkers-maentwrog", "bridge-159029124"],
    photo: {
      canopyTrees: true,
      barriers: true,
      grassAlongM: [8850, 9320],
      grassBandM: 50,
      treeClearOfTrailM: 5,
      walkers: [
        { startDistM: 9110, direction: 1, sideM: -0.7, heightM: 1.72, seed: 7 },
        { startDistM: 9142, direction: -1, sideM: -0.45, heightM: 1.78, seed: 11 },
        { startDistM: 9141.2, direction: -1, sideM: -1.0, heightM: 1.62, seed: 13 },
      ],
    },
    shots: [
      { kind: "drone-side", fromDistM: 8960, toDistM: 9060, startHeightM: 110, endHeightM: 35, sideM: 60, frames: 120 },
      { kind: "first-person", eyeHeightM: 1.2, lookAheadM: 15, frames: 240 },
      { kind: "follow", backM: 8, upM: 3, sideM: 1.5, frames: 240 },
    ],
  }),
};

/** A section or prototype config by id, or a named error at the boundary. */
export function configById(id: string): SectionConfig {
  const cfg = SECTIONS[id] ?? PROTOTYPES[id];
  if (!cfg) throw new Error(`unknown section "${id}"; known sections: ${[...Object.keys(SECTIONS), ...Object.keys(PROTOTYPES)].join(", ")}`);
  return cfg;
}

// The proof of concept's numbers, kept for its composition, tests and render checks (docs/design-3d.md D13, D14).
export const POC = {
  compositionId: "Poc3DMaentwrog",
  fps: 30,
  frames: 360,
  section: { startKm: 7.7, endKm: 9.7 },
  startDistM: 9120,
  /** OSM way 159029124 */
  bridgeM: [9150, 9169] as [number, number],
  shotSplitFrame: 180,
  ve: 1,
} as const;

export type PocInputs = { route: RouteModel; dem: DemGrid; land: LandCover; profile: TrailProfile };

export type PocScene = {
  trail: Trail;
  terrain: MeshArrays;
  cutFill: CutFill[];
  dims: CyclistDims;
  table: Float64Array;
  riderAt: (frame: number) => Vec3;
  /** the rider's distance along the route at a frame (the table, clamped) */
  distAt: (frame: number) => number;
  /** the rendered ground: the terrain after corridor flattening (camera clearance) */
  heightAt: HeightAt;
  /** the bare DTM, which keeps road decks over the line */
  bareHeightAt: HeightAt;
  shot: Shot;
};

/** The ground's photograph for the photo look's terrain (ADR 60): graded sRGB RGBA pixels on the DEM's grid. */
export type SceneImage = { width: number; height: number; scale: number; rgba: Uint8Array; cols: number; rows: number };
export type SectionScene = PocScene & { groundImage?: SceneImage; config: SectionConfig; roads: MeshArrays; bridges: MeshArrays[]; trees: TreePlacement; water: WaterBody[]; buildings: SectionBuildings; barriers: BarrierMeshes; grass: GrassClump[]; walkers: WalkerTrack[] };

/** The ground scene of a section: trail, flattened and shaded terrain, rider table, heights and shots. */
function groundScene(cfg: SectionConfig, inputs: PocInputs): PocScene {
  const { route, dem, land, profile } = inputs;
  const trail = buildTrail(route, profile, { startKm: cfg.kmRange[0], endKm: cfg.kmRange[1] }, { widthM: TRAIL_WIDTH_M, ve: cfg.ve });
  const flattened = flattenCorridor(buildTerrainMesh(dem, land, route.project, cfg.ve), trail, {
    widthM: TRAIL_WIDTH_M,
    shoulderM: 1,
    spacingM: dem.spacingM,
    bridges: profile.bridges ?? [],
    noReport: profile.overbridges ?? [],
    ve: cfg.ve,
  });
  const terrain = shadeTerrain(flattened.mesh, dem);
  const dims = defaultCyclistDims();
  const table = distanceTable(trail, cfg.startDistM, cfg.frames, POC.fps);
  const poseAt = (f: number) => cyclistPose(trail, table, f, POC.fps, dims);
  const riderAt = (f: number) => poseAt(f).position;
  const distAt = (f: number) => table[Math.min(table.length - 1, Math.max(0, f))];
  // Heights in world units. The rendered ground is the flattened mesh, whose vertices are the DEM's
  // nodes row by row, read with the DEM's own bilinear lookup; the bare DTM still has the road decks.
  const groundGrid: DemGrid = { ...dem, heights: Float32Array.from({ length: dem.cols * dem.rows }, (_, k) => terrain.positions[k * 3 + 1]) };
  const lookup = (grid: DemGrid, toWorld: (h: number) => number): HeightAt => (x, z) => {
    const { lon, lat } = route.unproject(x, z);
    const { e, n } = wgs84ToBng(lon, lat);
    const h = heightAtBng(grid, e, n);
    return h === null ? -Infinity : toWorld(h);
  };
  const heightAt = lookup(groundGrid, (h) => h);
  const bareHeightAt = lookup(dem, (h) => (h / 10) * cfg.ve);
  const scene = { trail, terrain, cutFill: flattened.cutFill, dims, table, riderAt, distAt, heightAt, bareHeightAt, shot: (() => ({ position: [0, 0, 0] as Vec3, target: [0, 0, 0] as Vec3, fovDeg: 45 })) as Shot };
  scene.shot = shotsOf(cfg, { ...scene, poseAt });
  return scene;
}

/** Frames before the section's first follow shot (its whole length when it has none): where the camera moves in close to the rider. */
export const followStartFrame = (cfg: SectionConfig): number => {
  let start = 0;
  for (const s of cfg.shots) {
    if (s.kind === "follow") return start;
    start += s.frames;
  }
  return cfg.frames;
};

/** The section's camera from its shot specs; each shot sees local frames, follow shots read the rider at the global frame. */
export function shotsOf(cfg: SectionConfig, scene: Pick<PocScene, "trail" | "riderAt" | "heightAt"> & { poseAt: (f: number) => ReturnType<typeof cyclistPose>; distAt?: (f: number) => number }): Shot {
  const far = (): Vec3 => [1e6, 1e6, 1e6];
  const list: { shot: Shot; frames: number }[] = [];
  let start = 0;
  for (const spec of cfg.shots) {
    let shot: Shot;
    switch (spec.kind) {
      case "first-person": {
        const offset = start;
        const distAt = scene.distAt;
        if (!distAt) throw new Error(`section ${cfg.id}: a first-person shot needs the rider's distance table (distAt)`);
        shot = firstPersonShot({ trail: scene.trail, poseAt: (g) => scene.poseAt(g + offset), distAt: (g) => distAt(g + offset), eyeHeightM: spec.eyeHeightM, lookAheadM: spec.lookAheadM });
        break;
      }
      case "drone-side":
        shot = droneSideTrack({ trail: scene.trail, riderAt: scene.riderAt, heightAt: scene.heightAt, ...spec });
        break;
      case "follow": {
        const offset = start;
        shot = followShot({ poseAt: (g) => scene.poseAt(g + offset), backM: spec.backM, upM: spec.upM, sideM: spec.sideM });
        break;
      }
      case "aerial-orbit": {
        const s = scene.trail.sampleAt(spec.centreDistM);
        shot = aerialOrbit({ centre: [s.x, s.y, s.z], radiusM: spec.radiusM, heightM: spec.heightM, fromDeg: spec.fromDeg, toDeg: spec.toDeg, frames: spec.frames });
        break;
      }
      case "pull-back": {
        const s = scene.trail.sampleAt(spec.fromDistM);
        // back away along the trail (against the direction of travel), so the alignment stays in view and the path follows the valley
        const t = s.tangent;
        const l = Math.hypot(t[0], t[2]) || 1;
        shot = pullBack({ from: [s.x, s.y, s.z], target: [s.x, s.y, s.z], startHeightM: spec.startHeightM, endHeightM: spec.endHeightM, backM: spec.backM, frames: spec.frames, back: [-t[0] / l, -t[2] / l] });
        break;
      }
      case "hold": {
        const s = scene.trail.sampleAt(spec.distM);
        const ahead = scene.trail.sampleAt(spec.distM + 200);
        const t = s.tangent;
        const position: Vec3 = [s.x - t[2] * (spec.sideM / 10), s.y + spec.heightM / 10, s.z + t[0] * (spec.sideM / 10)];
        shot = () => ({ position, target: [ahead.x, ahead.y, ahead.z], fovDeg: 45 });
        break;
      }
    }
    // the rider rule reads the rider at the section frame, as the shot's own frames are local (review R4)
    const offset = start;
    const riderAtSectionFrame = (g: number) => scene.riderAt(g + offset);
    // a first-person camera is the rider: 1 m over the rendered ground and no rider distance (CA3 as amended, ADR 56)
    const safe =
      spec.kind === "first-person"
        ? withClearance(shot, scene.heightAt, far, 1, 0)
        : cfg.kind === "ground"
          ? withClearance(shot, scene.heightAt, riderAtSectionFrame, 2, 1.5)
          : withClearance(liftClear(shot, scene.heightAt, spec.frames, 20), scene.heightAt, far, 20, 0);
    list.push({ shot: safe, frames: spec.frames });
    start += spec.frames;
  }
  return sequenceShots(list);
}

/** Roads, bridges, trees and water for a section. Only register entries are drawn (spec H1, G6, G7). */
/** Every frame's line of sight from the camera to the rider's centre (1 m up), for the trees to keep clear of (spec CL5). */
function sightLines(cfg: SectionConfig, scene: PocScene): { a: Vec3; b: Vec3 }[] {
  const out: { a: Vec3; b: Vec3 }[] = [];
  for (let f = 0; f < cfg.frames; f++) {
    const r = scene.riderAt(f);
    out.push({ a: scene.shot(f).position, b: [r[0], r[1] + 0.1, r[2]] });
  }
  return out;
}

type ExtraInputs = PocInputs & { osm: OsmLine[]; features: Feature[]; bridgeIds?: string[]; waterLevels?: Record<string, number>; buildings?: SectionBuilding[]; canopy?: Float32Array; barriers?: OsmLine[]; imagery?: GroundImage };

const NO_BARRIERS = (): BarrierMeshes => {
  const empty = () => ({ positions: new Float32Array(0), indices: new Uint32Array(0), uvs: new Float32Array(0) });
  return { wall: empty(), hedge: empty(), fence: empty() };
};

function extras(cfg: SectionConfig, inputs: ExtraInputs, scene: PocScene, look: Look) {
  // the photoreal layer's sourced extras, only in the photo look and where the config asks (ADRs 54, 60)
  const photo = look === "photo" ? cfg.photo : undefined;
  // an aerial scene in the concept look shows roads and water on its map drape (ADR 33); the photo look draws them
  const drawsCover = cfg.kind === "ground" || photo !== undefined;
  const roadRefs = new Set(inputs.features.filter((f) => f.kind === "road").map((f) => f.source.ref));
  const roads: RoadLine[] = inputs.osm
    .filter((f) => drawsCover && roadRefs.has(f.properties.id) && f.geometry.type === "LineString")
    .map((f) => ({ coords: f.geometry.coordinates as [number, number][], highway: f.properties.tags.highway }));
  // every railway bridge the registers hold is drawn (their spans are left unflattened by the corridor); the POC's tests pass explicit ids (review R1)
  // only bridges inside this section's km range: the merged registers also hold other windows' structures, and a span
  // outside the trail would be built at its clamped end as a stray deck
  const inRange = (f: Feature) => f.fromKm !== undefined && f.toKm !== undefined && f.toKm >= cfg.kmRange[0] && f.fromKm <= cfg.kmRange[1];
  const bridges = inputs.features
    .filter((f) => f.kind === "structure" && f.id.startsWith("bridge-") && (inputs.bridgeIds ? inputs.bridgeIds.includes(f.id) : true) && inRange(f))
    .map((f) => buildBridgeMesh(scene.trail, [f.fromKm! * 1000, f.toKm! * 1000]));
  // Roads sit on whichever is higher: the bare DTM keeps the decks over the line, the rendered ground the corridor's fill.
  const roadBase: HeightAt = (x, z) => Math.max(scene.bareHeightAt(x, z), scene.heightAt(x, z));
  // only buildings the register lists, with its status (spec BL3, BL16); they stand on the rendered ground (BL5)
  const buildings = sectionBuildings(inputs.buildings ?? [], buildingStatus(inputs.features), inputs.route.project, scene.heightAt, cfg.ve);
  const footprints = buildings.records.map((r) => r.ring);
  const lines = photo?.barriers && inputs.barriers ? barrierLines(inputs.barriers) : [];
  // no tree stands in a wall or hedge: each boundary is a keep-out corridor for the placer
  const keepOut = lines.flatMap((l) => {
    const pts = l.coords.map(([lon, lat]) => inputs.route.project(lon, lat));
    return pts.slice(1).map((b, k) => ({ a: { x: pts[k].x, z: pts[k].y }, b: { x: b.x, z: b.y }, rM: 1.5 }));
  });
  const canopy = photo?.canopyTrees ? inputs.canopy : undefined;
  return {
    roads: buildRoadMesh(roads, inputs.route.project, roadBase),
    bridges,
    // an aerial shot has no rider to keep in view, so its trees need no sight lines
    trees:
      drawsCover
        ? placeTrees(inputs.dem, inputs.land, inputs.route.project, scene.trail, {
            roads,
            ve: cfg.ve,
            sightLines: cfg.kind === "ground" ? sightLines(cfg, scene) : [],
            footprints,
            ...(cfg.maxTreesPerKind !== undefined && { maxTrees: cfg.maxTreesPerKind }),
            ...(canopy && { canopy }),
            ...(keepOut.length > 0 && { keepOut }),
            ...(photo?.treeClearOfTrailM !== undefined && { clearOfTrailM: photo.treeClearOfTrailM }),
            ...(photo?.treeZoneM !== undefined && { nearZoneM: photo.treeZoneM }),
            ...(photo?.treesPerNode !== undefined && { treesPerNode: photo.treesPerNode }),
            ...(photo?.canopyCover && { canopyCover: true }),
          })
        : { conifer: [], broadleaf: [] },
    water: drawsCover ? waterBodies(inputs.osm, inputs.route.project, scene.heightAt, 10_000, inputs.waterLevels ?? {}, cfg.ve) : [],
    buildings,
    barriers: lines.length > 0 ? buildBarrierMeshes(lines, inputs.route.project, scene.heightAt, { ve: cfg.ve, trail: scene.trail, gapM: 3 }) : NO_BARRIERS(),
    // open ground gets grass; the woodland floor a sparser, darker growth (bracken and bramble read as the same clumps);
    // every clump stands on the rendered (flattened) ground, like the roads and trees (RL15)
    grass:
      photo?.grassAlongM && photo.grassBandM !== undefined && cfg.kind === "ground"
        ? [
            ...placeGrass(inputs.dem, inputs.land, inputs.route.project, scene.trail, { alongM: photo.grassAlongM, bandM: photo.grassBandM, ve: cfg.ve, groundAt: scene.heightAt }),
            ...placeGrass(inputs.dem, inputs.land, inputs.route.project, scene.trail, { seed: 20261030, alongM: photo.grassAlongM, bandM: photo.grassBandM, ve: cfg.ve, classes: /wood|forest/, per100m2: 25, tintScale: 0.72, groundAt: scene.heightAt }),
          ]
        : [],
    // walkers where the config places them (ADR 59) and people by its seeded draw (ADR 61); their tables run the
    // section's frames at the rider's fps
    walkers: photo && cfg.kind === "ground" ? walkerTracks(scene.trail, [...(photo.walkers ?? []), ...peopleOf(cfg, scene)], cfg.frames, POC.fps) : [],
  };
}

/** The section's people by its seeded draw, on the stretch its shots see (ADR 61). */
function peopleOf(cfg: SectionConfig, scene: PocScene): WalkerSpec[] {
  const people = cfg.photo?.people;
  if (!people) return [];
  const alongM = cfg.photo?.grassAlongM ?? [cfg.startDistM - 100, cfg.startDistM + 300];
  return placePeople({ trail: scene.trail, frames: cfg.frames, fps: POC.fps, kmRange: cfg.kmRange, alongM, rider: { table: scene.table, lateralM: scene.dims.lateralOffsetM }, shot: scene.shot }, people);
}

const buildingStatus = (features: Feature[]) => new Map<string, BuildingStatus>(features.filter((f) => f.kind === "building" && f.status).map((f) => [f.id, f.status!]));

/** A section's scene in a look: the concept look ignores the config's photo extras (ADR 60). */
export function buildSectionScene(cfg: SectionConfig, inputs: Omit<ExtraInputs, "bridgeIds">, look: Look = "concept"): SectionScene {
  const scene = groundScene(cfg, inputs);
  // the terrain's vertices are the DEM's nodes row by row, so the image's node colours replace the land cover's one for one
  let groundImage: SceneImage | undefined;
  if (look === "photo" && cfg.photo?.imagery) {
    if (!inputs.imagery) throw new Error(`section ${cfg.id}: the photo look wants the window's imagery and none was loaded`);
    const rgba = imageryPixels(inputs.imagery, IMAGERY_GRADE);
    const { cols, rows } = inputs.dem;
    groundImage = { width: inputs.imagery.width, height: inputs.imagery.height, scale: inputs.imagery.scale, rgba, cols, rows };
    scene.terrain = { ...scene.terrain, colors: imageryNodeColours(inputs.imagery, rgba, cols, rows) };
  }
  return { ...scene, ...(groundImage && { groundImage }), config: cfg, ...extras(cfg, inputs, scene, look) };
}

/** The proof of concept's scene: the Maentwrog config through the same assembly. */
export const buildPocScene = (inputs: PocInputs): PocScene => groundScene(SECTIONS.maentwrog, inputs);

export function buildPocExtras(inputs: PocInputs & { osm: OsmLine[]; features: Feature[]; bridgeIds: string[] }, scene: PocScene): { roads: MeshArrays; bridges: MeshArrays[]; trees: TreePlacement } {
  const { roads, bridges, trees } = extras(SECTIONS.maentwrog, inputs, scene, "concept");
  return { roads, bridges, trees };
}
