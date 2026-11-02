// The photo look's OSM dressing of a section (the council map reviews of 2026-11-02): its woods' kinds from their tags
// (woodland.ts), its watercourses on a ground window's own ground (waterways.ts; an aerial window's 16 m ground and its
// imagery carry them) and its power lines (power.ts), with trees and grass kept clear of the water.
import type { HeightAt } from "./camera";
import type { RouteModel } from "../data/route";
import { placePower, type PlacedLine, type PlacedSupport } from "./power";
import type { OsmLine } from "./registers";
import type { RoadLine } from "./roads";
import type { Trail, TrailProfile } from "./trail";
import type { TreePlacement } from "./trees";
import type { DemGrid, LandCover } from "./types";
import type { WaterBody } from "./water";
import { clearOfChannels, sectionChannels, type Channel } from "./waterways";
import { woodKindGrid } from "./woodland";

/** how far beyond a channel's water a trunk or a grass clump stands, at least (m) */
export const CLEAR_OF_WATER_M = { tree: 1.5, grass: 1.2 } as const;

export type Dressing = {
  woodKinds?: Uint8Array;
  channels: Channel[];
  power: { supports: PlacedSupport[]; lines: PlacedLine[] };
  clearTrees: (t: TreePlacement) => TreePlacement;
  clearGrass: <T extends { x: number; z: number }>(list: T[]) => T[];
};

export function photoDressing(
  look: { photo: boolean; ground: boolean; ve: number },
  inputs: { dem: DemGrid; land: LandCover; osm: OsmLine[]; route: RouteModel; profile: TrailProfile },
  scene: { surfaceAt: HeightAt; trail: Trail },
  around: { spans: [number, number][]; roads: RoadLine[]; water: WaterBody[]; footprints: { x: number; z: number }[][] },
): Dressing {
  const channels =
    look.photo && look.ground
      ? sectionChannels(inputs.osm, { project: inputs.route.project, surfaceAt: scene.surfaceAt, trail: scene.trail, spans: [...around.spans, ...(inputs.profile.bridges ?? [])], roads: around.roads, water: around.water, footprints: around.footprints, spacingM: inputs.dem.spacingM, ve: look.ve })
      : [];
  const clear = <T extends { x: number; z: number }>(list: T[], marginM: number) => clearOfChannels(list, channels, marginM);
  return {
    ...(look.photo && { woodKinds: woodKindGrid(inputs.dem, inputs.land, inputs.osm) }),
    channels,
    power: look.photo ? placePower(inputs.osm, inputs.route.project, scene.surfaceAt) : { supports: [], lines: [] },
    clearTrees: (t) => ({ conifer: clear(t.conifer, CLEAR_OF_WATER_M.tree), broadleaf: clear(t.broadleaf, CLEAR_OF_WATER_M.tree) }),
    clearGrass: (list) => clear(list, CLEAR_OF_WATER_M.grass),
  };
}
