// The community film's scenes (docs/community-reel-research.md): the reel's terrain windows, with people choreographed
// by spec (pupils riding to school with an adult, a family, walkers, a commuter, older residents resting, a tricycle,
// and cargo bikes, long-tails and a box tricycle carrying children and shopping: cycles.ts) and
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
  bilingual: true,
  ...c,
  photo: { canopyTrees: true, barriers: true, grassBandM: 50, treeClearOfTrailM: 5, choreograph: true, ...c.photo },
});
const aerial = (c: Pick<SectionConfig, "id" | "title" | "frames" | "startDistM" | "shots">): SectionConfig => ({
  kind: "aerial",
  ve: 1,
  featureIds: ["terrain-lidar", "trail-proposed"],
  captionIds: [],
  bilingual: true,
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
  // the familiar landscape (review 2026-11-05): one slow, low arc about Llan Ffestiniog, the middle community, with the
  // vale and the hills in frame rather than a plan of rooftops
  "community-open": aerial({
    id: "community-open", title: "Three communities", frames: 180, startDistM: 5330,
    shots: [{ kind: "aerial-orbit", centreDistM: 5330, radiusM: 600, heightM: 170, fromDeg: 120, toDeg: 92, frames: 180 }],
  }),
  // then and now, from one camera by Llan Ffestiniog looking back along the line to the village: the mothballed railway
  // as it stands today (its track on the mapped line, grown over), and the same view as a shared path with neighbours
  // on it. The film dissolves the first into the second.
  "community-then": ground({
    id: "community-then", title: "The railway today", kmRange: [4.8, 7.7], window: "vale-south", frames: 240, startDistM: 5190,
    shots: [{ kind: "hold", distM: 5262, heightM: 1.7, sideM: -2.6, target: { distM: 5190, upM: 0.4 }, fovDeg: 42, frames: 240 }],
    photo: { grassAlongM: [5100, 5560], riderHidden: true, railway: true, walkers: [] },
  }),
  "community-now": ground({
    id: "community-now", title: "The same view, as a path", kmRange: [4.8, 7.7], window: "vale-south", frames: 210, startDistM: 5190,
    shots: [{ kind: "hold", distM: 5262, heightM: 1.7, sideM: -2.6, target: { distM: 5190, upM: 0.4 }, fovDeg: 42, frames: 210 }],
    photo: {
      grassAlongM: [5100, 5560],
      riderHidden: true,
      walkers: [
        // two neighbours and their dog walking away from the camera towards the village, a commuter riding in
        w(5250, -1, -0.4, 1.70, 9121, "walk", undefined, { dog: { breed: "collie" }, with: 9122 }),
        w(5250.3, -1, -1.0, 1.64, 9122, "walk", "older", { with: 9121 }),
        w(5222, 1, 0.5, 1.75, 9123, "cycle", "commuter"),
      ],
    },
  }),
  // pupils riding towards Llan Ffestiniog with an adult; the camera rider is not drawn, the follow camera rides with them
  "community-school": ground({
    id: "community-school", title: "The school run", kmRange: [4.8, 7.7], window: "vale-south", frames: 750, startDistM: 5154,
    shots: [
      // down behind the pupils, looking ahead along the path with the vale open on the right
      { kind: "crane", fromBackM: 40, toBackM: 10, fromUpM: 18, toUpM: 3.5, sideM: 0, lookAheadM: 70, frames: 240 },
      // low on the uphill verge as the group comes through: wheels, pedals and faces close by (review 2026-11-05)
      { kind: "hold", distM: 5258, heightM: 0.85, sideM: -2.3, target: { distM: 5246, sideM: 0.2, upM: 0.75 }, fovDeg: 36, frames: 210 },
      { kind: "follow", backM: 7, upM: 2.2, sideM: 1.2, frames: 300 },
    ],
    photo: {
      grassAlongM: [5100, 5560],
      riderHidden: true,
      walkers: [
        // the adult with them rides at the back, a younger brother or sister on the back of a long-tail, in sight of the
        // cameras that follow the group
        w(5156, 1, -0.4, 1.78, 9101, "cycle", "escort", { cycle: "longtail", carries: { children: [1.05] } }),
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
        // and at the back of the family, riding at their pace, a parent with two small children in the box of a cargo bike
        w(2915.5, 1, -0.6, 1.72, 9206, "cycle", "parent", { cycle: "cargo", carries: { children: [0.95, 1.0] }, speedKmh: 5 }),
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
      { kind: "hold", distM: 4, heightM: 2.0, sideM: 0.8, target: { distM: 13, sideM: -2.5, upM: 1.0 }, fovDeg: 50, frames: 435 },
      // from behind the existing stop at the station, 145 m on from the path's end: the bus at the kerb, the shelter and
      // flag, and across the station yard the path the cyclist has just come in on
      // a medium shot of the stop itself, the shelter, the flag and the bus, as the cyclist walks up to it (review
      // 2026-11-05: aimed at the path's end 110 m off, the stop was a corner of a wide, empty frame)
      { kind: "hold", distM: -140, heightM: 1.9, sideM: -3.5, target: { distM: -122, sideM: -9.0, upM: 1.4 }, fovDeg: 30, frames: 165 },
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
      // from the uphill verge level with the bench, looking straight across the path, the residents and the falling
      // ground to the lake, which lies square to the line here (review 2026-11-05: the 28° over-the-shoulder view
      // showed two heads and little else; an oblique view from the verge had the hillside, not the water, behind them)
      { kind: "hold", distM: 11341, heightM: 2.6, sideM: -5.0, target: { distM: 11338, sideM: 25, upM: -1.5 }, fovDeg: 40, frames: 300 },
      // side on, from along the path: the residents, the lake one way and the path the other
      { kind: "hold", distM: 11348, heightM: 1.3, sideM: 4.9, target: { distM: 11340, sideM: 3.4, upM: 0.7 }, fovDeg: 42, frames: 240 },
      // low on the uphill verge further on, looking back along the path as the tricycle rides up and passes close by
      { kind: "hold", distM: 11370, heightM: 1.3, sideM: -2.6, target: { distM: 11354, sideM: 0.3, upM: 0.8 }, fovDeg: 40, frames: 210 },
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
    photo: { grassAlongM: [750, 1300], walkers: [w(880, -1, -0.7, 1.70, 9601, "walk"), w(868, -1, -0.5, 1.62, 9602, "cycle", undefined, { cycle: "cargo", carries: { shopping: true } })] },
  }),
  // past the lane that crosses the line at km 2.31
  "community-ride-manod": ground({
    id: "community-ride-manod", title: "Riding: Manod", kmRange: [1.5, 4.8], window: "vale-north", frames: 300, startDistM: 2600,
    // the rider's view, then wheel height beside the back wheel: the path streaming by, the pedals turning
    shots: [{ kind: "first-person", eyeHeightM: 1.25, lookAheadM: 15, frames: 180 }, { kind: "follow", backM: 3.2, upM: 0.95, sideM: 0.9, frames: 120 }],
    photo: { grassAlongM: [2550, 3100], walkers: [w(2720, -1, -0.7, 1.74, 9701, "run"), w(2680, -1, -0.65, 1.72, 9702, "walk", undefined, { dog: { breed: "collie" } }), w(2668, -1, -0.55, 1.70, 9703, "cycle", "commuter", { cycle: "longtail", carries: { shopping: true } })] },
  }),
  "community-ride-maentwrog": ground({
    id: "community-ride-maentwrog", title: "Riding: under the A470", kmRange: [7.7, 9.7], window: "maentwrog", frames: 300, startDistM: 8450,
    shots: [{ kind: "first-person", eyeHeightM: 1.25, lookAheadM: 15, frames: 300 }],
    photo: { grassAlongM: [8400, 9000], walkers: [w(8640, -1, -0.4, 1.68, 9801, "walk", "parent", { with: 9802 }), w(8640.2, -1, -1.0, 1.25, 9802, "walk", "child", { with: 9801 }), w(8525, -1, -0.55, 1.68, 9803, "cycle", "parent", { cycle: "cargo", carries: { children: [1.0] } })] },
  }),
  // past the building that stands on the mapped line near km 10.93 (docs/community-reel-research.md §7)
  "community-ride-trawsfynydd": ground({
    id: "community-ride-trawsfynydd", title: "Riding: towards Trawsfynydd", kmRange: [9.7, 13.24], window: "trawsfynydd", frames: 300, startDistM: 11380, maxTreesPerKind: 4000,
    shots: [{ kind: "first-person", eyeHeightM: 1.25, lookAheadM: 15, frames: 300 }],
    photo: { grassAlongM: [11330, 11900], walkers: [w(11530, -1, -0.6, 1.66, 9901, "trike")] },
  }),
  // everyone together near Maentwrog Road: pupils, a family, older neighbours and a box tricycle with two children
  "community-together": ground({
    id: "community-together", title: "Together", kmRange: [7.7, 9.7], window: "maentwrog", frames: 360, startDistM: 9150, featureIds: [...SHARED, "bridge-159029124"],
    shots: [{ kind: "hold", distM: 9232, heightM: 2.2, sideM: -4.5, target: { distM: 9195, upM: 1.0 }, fovDeg: 46, frames: 360 }],
    photo: {
      grassAlongM: [9050, 9320],
      riderHidden: true,
      walkers: [
        // pupils ride towards the camera and meet, in turn, a box tricycle, a parent and child and an older couple with
        // their dog, each keeping left
        w(9180, 1, 0.5, 1.48, 10001, "cycle", "pupil"),
        w(9176, 1, -0.35, 1.53, 10002, "cycle", "pupil"),
        w(9172, 1, 0.45, 1.80, 10003, "cycle", "escort"),
        w(9222, -1, -0.85, 1.70, 10006, "pram", "parent", { with: 10007 }),
        w(9222.5, -1, -0.2, 1.22, 10007, "walk", "child", { with: 10006 }),
        w(9236, -1, -1.0, 1.66, 10004, "walk", "older", { with: 10005, dog: { breed: "terrier" } }),
        w(9236.3, -1, -0.4, 1.72, 10005, "walk", "older", { with: 10004 }),
        // a parent with two children in the box of a Christiania-style tricycle, riding on to meet the pupils (towards the
        // camera, the 0.9 m box and the older couple walking two abreast with their dog would not fit the 3 m path)
        w(9214, -1, -0.6, 1.66, 10008, "trike", "parent", { cycle: "christiania", carries: { children: [1.0, 1.1] } }),
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
