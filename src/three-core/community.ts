// The community film's scenes (docs/community-reel-research.md): the reel's terrain windows, with people choreographed
// by spec (pupils riding to school with an adult, a family, walkers, a commuter, older residents resting, a tricycle) and
// street furniture that is either existing (the bus stop OSM maps at Blaenau Ffestiniog station) or a proposal, and
// says so. Rendered by the Blender build only; the reel and CyclingVision are untouched.
import { miles } from "../data/units";
import type { PropSpec } from "./props";
import type { SectionConfig } from "./sections";
import type { WalkerSpec } from "./walkers";

const SHARED = ["terrain-lidar", "landcover-osm", "trail-proposed", "trees", "cyclist"];
type Photo = NonNullable<SectionConfig["photo"]>;
const ground = (c: Omit<SectionConfig, "kind" | "ve" | "featureIds" | "captionIds" | "photo"> & { featureIds?: string[]; photo: Partial<Photo> & { grassAlongM: [number, number] } }): SectionConfig => ({
  kind: "ground",
  ve: 1,
  featureIds: SHARED,
  captionIds: [],
  ...c,
  photo: { canopyTrees: true, barriers: true, grassBandM: 50, treeClearOfTrailM: 5, choreograph: true, ...c.photo },
});
const aerial = (c: Pick<SectionConfig, "id" | "title" | "frames" | "startDistM" | "shots">): SectionConfig => ({
  kind: "aerial",
  ve: 1,
  featureIds: ["terrain-lidar", "trail-proposed"],
  captionIds: [],
  kmRange: [0, 13.24],
  window: "corridor",
  // the kinds share twice this (trees.ts woodKinds): with the woods broadleaf by their tags, 25000 lets mapped woodland
  // close its canopy from the air (Blender's distant crowns are instanced; the reel's three.js scenes keep 20000)
  maxTreesPerKind: 25000,
  photo: { canopyTrees: true, barriers: true, treeZoneM: 1500, treesPerNode: 3, canopyCover: true, imagery: true },
  ...c,
});

// people: w(start, direction, side, height, seed, activity, role, extra)
const w = (startDistM: number, direction: 1 | -1, sideM: number, heightM: number, seed: number, activity: WalkerSpec["activity"], role?: WalkerSpec["role"], extra: Partial<WalkerSpec> = {}): WalkerSpec => ({
  startDistM, direction, sideM, heightM, seed, activity, ...(role && { role }), ...extra,
});

/** A bilingual fingerpost at `distM` pointing to the three communities, with distances in miles along the line. */
const fingerpost = (distM: number, sideM: number): PropSpec => ({
  kind: "fingerpost",
  status: "proposed",
  at: { distM, sideM },
  headingDeg: 0,
  opts: {
    arms: [
      ["Blaenau Ffestiniog", "Blaenau Ffestiniog", +miles(distM), 180],
      ["Llan Ffestiniog", "Llan Ffestiniog", +miles(Math.abs(5330 - distM)), distM < 5330 ? 0 : 180],
      ["Trawsfynydd", "Trawsfynydd", +miles(13240 - distM), 0],
    ].filter(([, , mi]) => (mi as number) >= 0.2),
  },
});

// The real bus stop at Blaenau Ffestiniog station (OSM node 4572016417 in data/bus-stops.json: shelter and bench
// mapped), the rail and bus interchange TfW names as the town's starting point, 123 m on from the trail's mapped end;
// the lockers at that end are proposed. The stop's road is the station's bus bay (OSM way 372888036, bearing 145°, 7 m
// north-east of the stop): a bus at the kerb faces 325° (UK left-hand running), the shelter stands behind the stop and
// faces the road (48°).
const STATION_STOP = "node/4572016417";

export const COMMUNITY: Record<string, SectionConfig> = {
  "community-open": aerial({
    id: "community-open", title: "Three communities", frames: 600, startDistM: 300,
    shots: [
      { kind: "aerial-orbit", centreDistM: 400, radiusM: 520, heightM: 300, fromDeg: 230, toDeg: 190, frames: 300 },
      { kind: "aerial-orbit", centreDistM: 5330, radiusM: 450, heightM: 240, fromDeg: 120, toDeg: 80, frames: 300 },
    ],
  }),
  // pupils riding towards Llan Ffestiniog with an adult; the camera rider is not drawn, the follow camera rides with them
  "community-school": ground({
    id: "community-school", title: "The school run", kmRange: [4.8, 7.7], window: "vale-south", frames: 750, startDistM: 5154,
    shots: [
      // down behind the pupils, looking ahead along the path with the vale open on the right
      { kind: "crane", fromBackM: 40, toBackM: 10, fromUpM: 18, toUpM: 3.5, sideM: 0, lookAheadM: 70, frames: 240 },
      { kind: "hold", distM: 5262, heightM: 1.5, sideM: 3.2, target: { distM: 5240, upM: 1.1 }, fovDeg: 40, frames: 210 },
      { kind: "follow", backM: 7, upM: 2.2, sideM: 1.2, frames: 300 },
    ],
    photo: {
      grassAlongM: [5100, 5560],
      riderHidden: true,
      walkers: [
        w(5181, 1, -0.4, 1.78, 9101, "cycle", "escort"),
        w(5177, 1, 0.45, 1.46, 9102, "cycle", "pupil"),
        w(5173, 1, -0.45, 1.52, 9103, "cycle", "pupil"),
        w(5169, 1, 0.45, 1.42, 9104, "cycle", "pupil"),
        w(5165, 1, -0.45, 1.55, 9105, "cycle", "pupil"),
        w(5161, 1, 0.4, 1.49, 9106, "cycle", "pupil"),
        w(5330, -1, -0.9, 1.68, 9107, "walk", "older"),
      ],
      props: [fingerpost(5232, -2.6)],
    },
  }),
  // a family walking with a child on a small bicycle and a pram; a commuter (the camera rider) passes with care
  "community-family": ground({
    id: "community-family", title: "Everyday trips", kmRange: [1.5, 4.8], window: "vale-north", frames: 390, startDistM: 2890,
    shots: [
      // on the uphill verge behind the family, looking ahead down the vale (open on the right) as the commuter comes by
      { kind: "hold", distM: 2913, heightM: 1.8, sideM: -2.8, target: { distM: 2990, sideM: 3.5, upM: 0.8 }, fovDeg: 44, frames: 210 },
      { kind: "follow", backM: 8, upM: 2.6, sideM: 1.5, frames: 180 },
    ],
    photo: {
      grassAlongM: [2800, 3250],
      walkers: [
        // single file on the right as the commuter (the camera rider, keeping left) comes up behind them
        w(2929, 1, -0.75, 1.66, 9203, "pram", "parent", { with: 9201 }),
        w(2925, 1, -0.7, 1.80, 9201, "walk", "parent", { with: 9203 }),
        w(2921, 1, -0.65, 1.24, 9202, "cycle", "child", { speedKmh: 5, with: 9201 }),
        w(3010, -1, -0.6, 1.72, 9204, "run"),
        w(2995, -1, -0.7, 1.70, 9205, "walk", undefined, { dog: { breed: "labrador" } }),
      ],
    },
  }),
  "community-walkers": ground({
    id: "community-walkers", title: "Walking and running", kmRange: [7.7, 9.7], window: "maentwrog", frames: 360, startDistM: 8990, featureIds: [...SHARED, "bridge-159029124"],
    shots: [
      // down behind the commuter towards Maentwrog Road, the walkers coming towards them and the vale open on the right
      { kind: "crane", fromBackM: 35, toBackM: 8, fromUpM: 14, toUpM: 3, sideM: 1.5, lookAheadM: 60, frames: 180 },
      { kind: "follow", backM: 8, upM: 3, sideM: 1.5, frames: 180 },
    ],
    photo: {
      grassAlongM: [8850, 9320],
      walkers: [
        w(9040, -1, -0.4, 1.66, 9301, "walk", "older", { with: 9302 }),
        w(9040.3, -1, -1.0, 1.74, 9302, "walk", "older", { with: 9301 }),
        w(9010, 1, 0.8, 1.75, 9303, "run"),
        w(9070, -1, -0.6, 1.62, 9304, "walk", undefined, { dog: { breed: "collie" } }),
      ],
    },
  }),
  // cycle to the station, lock up, catch the bus or train: a cyclist arrives at the proposed lockers, wheels the bicycle
  // into one, locks it and walks on; after the cut they reach the existing stop, where the bus waits
  "community-bus": ground({
    id: "community-bus", title: "Connecting with buses and trains", kmRange: [0, 1.5], window: "blaenau", frames: 600, startDistM: 60,
    shots: [
      // over the stone cutting the path ends in, close enough to the lockers to see the cyclist arrive, wheel the bicycle
      // into one, lock it and walk on, with the bridge and the town beyond: at path level its walls, the bridge and the
      // houses close every view in
      { kind: "hold", distM: 19, heightM: 4.5, sideM: 1.3, target: { distM: 8, sideM: -2.0, upM: 2.2 }, fovDeg: 46, frames: 435 },
      // from behind the existing stop at the station, 145 m on from the path's end: the bus at the kerb, the shelter and
      // flag, and across the station yard the path the cyclist has just come in on
      { kind: "hold", distM: -145, heightM: 4, sideM: -11.7, target: { distM: 0, upM: 2 }, fovDeg: 32, frames: 165 },
    ],
    photo: {
      grassAlongM: [0, 400],
      riderHidden: true,
      walkers: [
        w(22, -1, -0.3, 1.72, 9401, "cycle", "commuter", { stopAtM: 13, locksUp: true }),
        // two people on foot heading out of town, already past the lockers, meeting the cyclist as they come in
        w(16, 1, 0.85, 1.64, 9402, "walk", "commuter"),
        w(20, 1, 0.8, 1.58, 9403, "walk", "older"),
      ],
      props: [
        { kind: "lockers", status: "proposed", at: { distM: 12, sideM: 3.6 }, headingDeg: -90, opts: { units: 4, open_unit: 1, bicycle: false } },
        { kind: "fingerpost", status: "proposed", at: { distM: 26, sideM: -2.4 }, headingDeg: 0, opts: { arms: [["Gorsaf a bysiau", "Station and buses", 0.1, 180], ["Llan Ffestiniog", "Llan Ffestiniog", +miles(5330), 0]] } },
        { kind: "bus-stop-flag", status: "existing", at: { stop: STATION_STOP }, headingDeg: 48, source: STATION_STOP, opts: { name: "Blaenau Ffestiniog, Station" } },
        { kind: "bus-shelter", status: "existing", at: { stop: STATION_STOP, eastM: -1.1, northM: -1.0 }, headingDeg: 48, source: STATION_STOP },
        { kind: "bus", status: "existing", at: { stop: STATION_STOP, eastM: 5.2, northM: 4.7 }, headingDeg: 325 },
      ],
    },
  }),
  // a rest place above Llyn Trawsfynydd: older residents on a bench looking out over the lake, a tricycle rider and a dog
  // walker passing. The lake lies west of the line, right of the route's direction; the hill rises on the left. Where
  // the lake comes closest the A470 runs within 15 m of the path, with houses beside it; at km 11.34 the ground falls
  // away open to the right, the road 90 m off below and no building in view, and the water is in sight 1–1.3 km off
  // on bearings 85–105° right of the route. The bench stands there, on the lake side, facing the water
  "community-welcome": ground({
    id: "community-welcome", title: "A place to rest", kmRange: [9.7, 13.24], window: "trawsfynydd", frames: 750, startDistM: 11270, maxTreesPerKind: 4000,
    shots: [
      // over the residents' shoulders, out across the falling ground to the lake
      { kind: "hold", distM: 11340.2, heightM: 1.9, sideM: 1.6, target: { distM: 11334.8, sideM: 63, upM: -6 }, fovDeg: 42, frames: 300 },
      // side on, from along the path: the residents, the lake one way and the path the other
      { kind: "hold", distM: 11348, heightM: 1.3, sideM: 4.9, target: { distM: 11340, sideM: 3.4, upM: 0.7 }, fovDeg: 42, frames: 240 },
      // behind the tricycle on the uphill verge, looking ahead to the bench and the lake side as the dog walker comes by
      { kind: "hold", distM: 11310, heightM: 1.6, sideM: -2.4, target: { distM: 11352, sideM: 6, upM: 0.6 }, fovDeg: 50, frames: 210 },
    ],
    photo: {
      grassAlongM: [11140, 11590],
      riderHidden: true,
      walkers: [
        w(11340, 1, -3.4, 1.64, 9501, "sit", "older"),
        w(11341, 1, -3.4, 1.70, 9502, "sit", "older"),
        w(11285, 1, 0.5, 1.68, 9503, "trike"),
        w(11390, -1, -0.6, 1.60, 9504, "walk", "older", { dog: { breed: "terrier" } }),
      ],
      props: [
        // facing the water: right of the route's direction and a touch back
        { kind: "bench", status: "proposed", at: { distM: 11340, sideM: -3.4 }, headingDeg: -95, opts: { arms: true } },
        { kind: "viewpoint-board", status: "proposed", at: { distM: 11333, sideM: -4.4 }, headingDeg: 90, opts: { title_cy: "Llyn Trawsfynydd", title_en: "Trawsfynydd Lake" } },
        fingerpost(11316, 2.6),
      ],
    },
  }),
  // the ride: first person through four different stretches, with others on the path
  // beyond the streets that meet the line up to km 0.7 (their walls stand by the trail)
  "community-ride-blaenau": ground({
    id: "community-ride-blaenau", title: "Riding: Blaenau Ffestiniog", kmRange: [0, 1.5], window: "blaenau", frames: 300, startDistM: 800,
    shots: [{ kind: "first-person", eyeHeightM: 1.25, lookAheadM: 15, frames: 300 }],
    photo: { grassAlongM: [750, 1300], walkers: [w(880, -1, -0.7, 1.70, 9601, "walk"), w(960, -1, -0.5, 1.62, 9602, "cycle")] },
  }),
  // past the lane that crosses the line at km 2.31
  "community-ride-manod": ground({
    id: "community-ride-manod", title: "Riding: Manod", kmRange: [1.5, 4.8], window: "vale-north", frames: 300, startDistM: 2600,
    shots: [{ kind: "first-person", eyeHeightM: 1.25, lookAheadM: 15, frames: 300 }],
    photo: { grassAlongM: [2550, 3100], walkers: [w(2720, -1, -0.7, 1.74, 9701, "run"), w(2680, -1, -0.65, 1.72, 9702, "walk", undefined, { dog: { breed: "collie" } })] },
  }),
  "community-ride-maentwrog": ground({
    id: "community-ride-maentwrog", title: "Riding: under the A470", kmRange: [7.7, 9.7], window: "maentwrog", frames: 300, startDistM: 8450,
    shots: [{ kind: "first-person", eyeHeightM: 1.25, lookAheadM: 15, frames: 300 }],
    photo: { grassAlongM: [8400, 9000], walkers: [w(8640, -1, -0.4, 1.68, 9801, "walk", "parent", { with: 9802 }), w(8640.2, -1, -1.0, 1.25, 9802, "walk", "child", { with: 9801 })] },
  }),
  // past the building that stands on the mapped line near km 10.93 (docs/community-reel-research.md §7)
  "community-ride-trawsfynydd": ground({
    id: "community-ride-trawsfynydd", title: "Riding: towards Trawsfynydd", kmRange: [9.7, 13.24], window: "trawsfynydd", frames: 300, startDistM: 11380, maxTreesPerKind: 4000,
    shots: [{ kind: "first-person", eyeHeightM: 1.25, lookAheadM: 15, frames: 300 }],
    photo: { grassAlongM: [11330, 11900], walkers: [w(11530, -1, -0.6, 1.66, 9901, "trike")] },
  }),
  // everyone together near Maentwrog Road: pupils, a family, older neighbours, a commuter and a tricycle
  "community-together": ground({
    id: "community-together", title: "Together", kmRange: [7.7, 9.7], window: "maentwrog", frames: 360, startDistM: 9150, featureIds: [...SHARED, "bridge-159029124"],
    shots: [{ kind: "hold", distM: 9232, heightM: 2.2, sideM: -4.5, target: { distM: 9195, upM: 1.0 }, fovDeg: 46, frames: 360 }],
    photo: {
      grassAlongM: [9050, 9320],
      riderHidden: true,
      walkers: [
        // pupils ride towards the camera and meet, in turn, a parent and child, an older couple with their dog, and a
        // tricycle, each keeping left
        w(9180, 1, 0.5, 1.48, 10001, "cycle", "pupil"),
        w(9176, 1, -0.35, 1.53, 10002, "cycle", "pupil"),
        w(9172, 1, 0.45, 1.80, 10003, "cycle", "escort"),
        w(9222, -1, -0.85, 1.70, 10006, "pram", "parent", { with: 10007 }),
        w(9222.5, -1, -0.2, 1.22, 10007, "walk", "child", { with: 10006 }),
        w(9236, -1, -1.0, 1.66, 10004, "walk", "older", { with: 10005, dog: { breed: "terrier" } }),
        w(9236.3, -1, -0.4, 1.72, 10005, "walk", "older", { with: 10004 }),
        w(9262, -1, -0.6, 1.66, 10008, "trike"),
        // a neighbour resting on a bench on the open side, looking out over the vale
        w(9216, 1, -3.3, 1.62, 10009, "sit", "older"),
      ],
      props: [fingerpost(9205, 2.6), { kind: "bench", status: "proposed", at: { distM: 9216, sideM: -3.3 }, headingDeg: -90, opts: { arms: true } }],
    },
  }),
  // rising over Trawsfynydd and looking back along the line to Llan Ffestiniog and Blaenau under the mountains: the whole
  // connection ahead, not a plan view of one field. Kept below 350 m, where the terrain's far edge stays out of sight.
  "community-close": aerial({
    id: "community-close", title: "A shared vision", frames: 390, startDistM: 11000,
    shots: [{ kind: "pull-back", fromDistM: 11500, startHeightM: 150, endHeightM: 320, backM: 520, lookAheadM: -1800, frames: 390 }],
  }),
};
