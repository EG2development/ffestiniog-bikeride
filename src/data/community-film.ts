// The community film (180 s at 30 fps): its scenes in order and its captions, as data (ADR 36). Its scenes are
// src/three-core/community.ts's configs; the Blender build assembles them as it does the reel (npm run blender:reel --
// --film community). Captions are short, in British English, distances in miles (units.ts), and the closing line is the
// brief's. Every proposal is labelled by its scene's legend; the concept badge and the sources run throughout.
import type { Caption } from "./reel-captions";
import type { ReelScene } from "./reel-timeline";
import { miles } from "./units";

export const COMMUNITY_FPS = 30;
export const COMMUNITY_FRAMES = 5400;

const scenes: [string, string, string, number][] = [
  // id, section window, config, frames
  ["opening", "corridor", "community-open", 600],
  ["school", "vale-south", "community-school", 750],
  ["family", "vale-north", "community-family", 390],
  ["walkers", "maentwrog", "community-walkers", 360],
  ["bus", "blaenau", "community-bus", 600],
  ["welcome", "trawsfynydd", "community-welcome", 750],
  ["ride", "blaenau", "community-ride-blaenau", 300],
  ["ride", "vale-north", "community-ride-manod", 300],
  ["ride", "maentwrog", "community-ride-maentwrog", 300],
  ["ride", "trawsfynydd", "community-ride-trawsfynydd", 300],
  ["together", "maentwrog", "community-together", 360],
  ["closing", "corridor", "community-close", 390],
];
let at = 0;
export const COMMUNITY_SCENES: ReelScene[] = scenes.map(([id, section, config, frames]) => {
  const s = { id, section, config, from: at, frames };
  at += frames;
  return s;
});

const SOURCES =
  "Welsh Government / NRW lidar DTM and DSM (OGL) · Map data © OpenStreetMap contributors (ODbL) · Contains OS data © Crown copyright and database right 2026 · Contains modified Copernicus Sentinel data 2025 · DEM- and map-derived, not survey-grade";
const ROUTE_M = 13240;

export const COMMUNITY_CAPTIONS: Caption[] = [
  { id: "disclaimer", text: "Concept visualisation — not an approved route", from: 0, to: 5400, position: "badge" },
  { id: "attribution", text: SOURCES, from: 0, to: 5400, position: "attribution" },
  { id: "places", text: "Blaenau Ffestiniog · Llan Ffestiniog · Trawsfynydd", from: 20, to: 290, position: "top-left" },
  { id: "idea", text: "One former railway, three communities: an idea to explore together", from: 320, to: 590, position: "top-left" },
  { id: "school", text: "A safer, more independent journey to school", from: 640, to: 930, position: "top-left" },
  { id: "school-2", text: "Riding together on a traffic-free path", from: 1060, to: 1340, position: "top-left" },
  { id: "everyday", text: "A route for everyday life: families, dog walkers and commuters", from: 1370, to: 1700, position: "top-left" },
  { id: "pace", text: "Room to walk, run and pass with care", from: 1760, to: 2090, position: "top-left" },
  { id: "bus", text: "Cycle to the station, lock up, and catch the bus or train", from: 2120, to: 2420, position: "top-left" },
  { id: "bus-existing", text: "Existing: station and bus stop · Proposed: cycle lockers and signs", from: 2130, to: 2690, position: "bottom-left" },
  { id: "welcome", text: "A place to rest and take in the view", from: 2720, to: 3020, position: "top-left" },
  { id: "everyone", text: "Welcoming for everyone, whatever your pace", from: 3080, to: 3440, position: "top-left" },
  { id: "ride", text: `${miles(ROUTE_M)} miles from Blaenau Ffestiniog to Trawsfynydd`, from: 3480, to: 3800, position: "top-left" },
  { id: "ride-time", text: `About ${Math.round((+miles(ROUTE_M) / 10) * 60)} minutes at an easy 10 mph`, from: 3880, to: 4180, position: "top-left" },
  { id: "heritage", text: "Railway heritage and future rail options to be explored with everyone", from: 4220, to: 4640, position: "top-left" },
  { id: "together", text: "Schools, families, neighbours and visitors, connected", from: 4690, to: 5000, position: "top-left" },
  { id: "closing", text: "More than a path. A connection for our communities.", from: 5040, to: 5400, position: "bottom-center" },
];
