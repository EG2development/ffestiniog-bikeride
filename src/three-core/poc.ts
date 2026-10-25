import type { RouteModel } from "../data/route";
import { wgs84ToBng } from "./bng";
import { buildBridgeMesh } from "./bridge";
import { droneSideTrack, followShot, sequenceShots, withClearance, type HeightAt, type Shot } from "./camera";
import { cyclistPose, defaultCyclistDims, distanceTable, type CyclistDims } from "./cyclistMotion";
import { buildTerrainMesh, heightAtBng } from "./dem";
import type { Feature, OsmLine } from "./registers";
import { buildRoadMesh, type RoadLine } from "./roads";
import { buildTrail, flattenCorridor, TRAIL_WIDTH_M, type CutFill, type Trail, type TrailProfile } from "./trail";
import { placeTrees, type TreePlacement } from "./trees";
import type { DemGrid, LandCover, MeshArrays, Vec3 } from "./types";

// One place for the POC's numbers, shared by the composition and the acceptance
// tests so the tests check what is rendered (docs/design-3d.md D13, D14).
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

export type PocInputs = {
  route: RouteModel;
  dem: DemGrid;
  land: LandCover;
  profile: TrailProfile;
};

export type PocScene = {
  trail: Trail;
  terrain: MeshArrays;
  cutFill: CutFill[];
  dims: CyclistDims;
  table: Float64Array;
  riderAt: (frame: number) => Vec3;
  /** the rendered ground: the terrain after corridor flattening (camera clearance) */
  heightAt: HeightAt;
  /** the bare DTM, which keeps road decks over the line */
  bareHeightAt: HeightAt;
  shot: Shot;
};

export function buildPocScene(inputs: PocInputs): PocScene {
  const { route, dem, land, profile } = inputs;
  const trail = buildTrail(route, profile, POC.section, { widthM: TRAIL_WIDTH_M, ve: POC.ve });
  const flattened = flattenCorridor(buildTerrainMesh(dem, land, route.project, POC.ve), trail, {
    widthM: TRAIL_WIDTH_M,
    shoulderM: 1,
    spacingM: dem.spacingM,
    bridges: profile.bridges ?? [POC.bridgeM],
    noReport: profile.overbridges ?? [],
    ve: POC.ve,
  });

  const dims = defaultCyclistDims();
  const table = distanceTable(trail, POC.startDistM, POC.frames, POC.fps);
  const poseAt = (f: number) => cyclistPose(trail, table, f, POC.fps, dims);
  const riderAt = (f: number) => poseAt(f).position;

  // Heights in world units. The rendered ground is the flattened mesh, whose vertices are the DEM's
  // nodes row by row, read with the DEM's own bilinear lookup; the bare DTM still has the road decks.
  const ground: DemGrid = { ...dem, heights: Float32Array.from({ length: dem.cols * dem.rows }, (_, k) => flattened.mesh.positions[k * 3 + 1]) };
  const lookup = (grid: DemGrid, toWorld: (h: number) => number): HeightAt => (x, z) => {
    const { lon, lat } = route.unproject(x, z);
    const { e, n } = wgs84ToBng(lon, lat);
    const h = heightAtBng(grid, e, n);
    return h === null ? -Infinity : toWorld(h);
  };
  const heightAt = lookup(ground, (h) => h);
  const bareHeightAt = lookup(dem, (h) => (h / 10) * POC.ve);

  const split = POC.shotSplitFrame;
  const drone = droneSideTrack({
    trail,
    riderAt,
    heightAt,
    // ends ~50 m behind the rider: overtaking abeam at 40 m panned faster than CA2's 30°/s
    fromDistM: 8980,
    toDistM: 9100,
    startHeightM: 120,
    endHeightM: 25,
    sideM: 40,
    frames: split,
  });
  const follow = followShot({ poseAt: (g) => poseAt(g + split), backM: 8, upM: 3, sideM: 1.5 });
  const shot = sequenceShots([
    { shot: withClearance(drone, heightAt, riderAt, 2, 1.5), frames: split },
    { shot: withClearance(follow, heightAt, (g) => riderAt(g + split), 2, 1.5), frames: POC.frames - split },
  ]);

  return { trail, terrain: flattened.mesh, cutFill: flattened.cutFill, dims, table, riderAt, heightAt, bareHeightAt, shot };
}

export type { OsmLine } from "./registers";

/**
 * Roads, bridges and trees for the POC. Only features in the register are drawn: roads by their
 * register entries, bridges by the ids the scene declares (spec H1, G6, G7).
 */
export function buildPocExtras(
  inputs: PocInputs & { osm: OsmLine[]; features: Feature[]; bridgeIds: string[] },
  scene: PocScene,
): { roads: MeshArrays; bridges: MeshArrays[]; trees: TreePlacement } {
  const roadRefs = new Set(inputs.features.filter((f) => f.kind === "road").map((f) => f.source.ref));
  const roads: RoadLine[] = inputs.osm
    .filter((f) => roadRefs.has(f.properties.id) && f.geometry.type === "LineString")
    .map((f) => ({ coords: f.geometry.coordinates as [number, number][], highway: f.properties.tags.highway }));
  const bridges = inputs.features
    .filter((f) => f.kind === "structure" && inputs.bridgeIds.includes(f.id) && f.fromKm !== undefined && f.toKm !== undefined)
    .map((f) => buildBridgeMesh(scene.trail, [f.fromKm! * 1000, f.toKm! * 1000]));
  // Roads sit on whichever is higher: the bare DTM keeps the decks over the line, the rendered ground the corridor's fill.
  const roadBase: HeightAt = (x, z) => Math.max(scene.bareHeightAt(x, z), scene.heightAt(x, z));
  return {
    roads: buildRoadMesh(roads, inputs.route.project, roadBase),
    bridges,
    trees: placeTrees(inputs.dem, inputs.land, inputs.route.project, scene.trail, { roads, ve: POC.ve }),
  };
}
