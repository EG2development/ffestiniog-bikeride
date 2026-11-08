// The community film (180 s at 30 fps): its scenes in order and its captions, as data (ADR 36). Its scenes are
// src/three-core/community.ts's configs; the Blender build assembles them as it does the reel (npm run blender:reel --
// --film community). Every caption is bilingual, Welsh first (review 2026-11-04): short, the English in British English,
// distances in miles (milltir) and speeds in mph (mya), and the closing line is the brief's. Every proposal is labelled by its scene's legend; the concept badge and the sources run throughout.
import type { Caption } from "./reel-captions";
import type { ReelScene } from "./reel-timeline";
import { miles } from "./units";

export const COMMUNITY_FPS = 30;
export const COMMUNITY_FRAMES = 5400;

const scenes: [string, string, string, number, number?][] = [
  // id, section window, config, frames, dissolve (frames cross-faded over the end of the scene before)
  // the opening (review 2026-11-05): the vale from the air, then the mothballed railway as it stands today, dissolving
  // into the same view as a shared path, so the film shows what is there before what could be
  ["opening", "corridor", "community-open", 180],
  ["then", "vale-south", "community-then", 240],
  ["now", "vale-south", "community-now", 210, 30],
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
export const COMMUNITY_SCENES: ReelScene[] = scenes.map(([id, section, config, frames, dissolve]) => {
  const s: ReelScene = { id, section, config, from: at - (dissolve ?? 0), frames, ...(dissolve && { dissolve }) };
  at = s.from + frames;
  return s;
});

// the credits, as their licences set them, and in Welsh above them (the OS notice in Ordnance Survey's Welsh form)
export const SOURCES =
  "Welsh Government / NRW lidar DTM and DSM (OGL) · Map data © OpenStreetMap contributors (ODbL) · Contains OS data © Crown copyright and database right 2026 · Contains modified Copernicus Sentinel data 2025 · DEM- and map-derived, not survey-grade";
export const SOURCES_CY =
  "DTM a DSM lidar Llywodraeth Cymru / CNC (OGL) · Data map © cyfranwyr OpenStreetMap (ODbL) · Yn cynnwys data'r Arolwg Ordnans © Hawlfraint y Goron a hawl cronfa ddata 2026 · Yn cynnwys data Copernicus Sentinel wedi'i addasu 2025 · O'r DEM a mapiau, nid o safon arolwg";
export const ROUTE_M = 13240;
export const MINUTES = Math.round((+miles(ROUTE_M) / 10) * 60);

/** Every caption Welsh first, then English (`cy` above `text`), in natural Welsh and British English, short enough
 * that each language reads in its own line or two. */
export const COMMUNITY_CAPTIONS: Caption[] = [
  { id: "disclaimer", cy: "Darlun cysyniadol — nid llwybr cymeradwy", text: "Concept visualisation — not an approved route", from: 0, to: 5400, position: "badge" },
  { id: "attribution", cy: SOURCES_CY, text: SOURCES, from: 0, to: 5400, position: "attribution" },
  { id: "places", cy: "Blaenau Ffestiniog, Llan Ffestiniog a Thrawsfynydd", text: "Blaenau Ffestiniog, Llan Ffestiniog and Trawsfynydd", from: 20, to: 170, position: "top-left" },
  { id: "today", cy: "Heddiw: rheilffordd segur ers y 1990au", text: "Today: a railway mothballed since the 1990s", from: 200, to: 400, position: "top-left" },
  { id: "idea", cy: "Un hen reilffordd, tair cymuned:\nsyniad i'w archwilio gyda'n gilydd", text: "One former railway, three communities:\nan idea to explore together", from: 425, to: 595, position: "top-left" },
  { id: "school", cy: "Taith fwy diogel a mwy annibynnol i'r ysgol", text: "A safer, more independent journey to school", from: 640, to: 930, position: "top-left" },
  { id: "school-2", cy: "Beicio gyda'n gilydd ar lwybr di-draffig", text: "Riding together on a traffic-free path", from: 1060, to: 1340, position: "top-left" },
  { id: "everyday", cy: "Teithiau bob dydd: teuluoedd, beiciau cargo a chŵn", text: "Everyday trips: families, cargo bikes and dog walks", from: 1370, to: 1700, position: "top-left" },
  { id: "pace", cy: "Lle i gerdded, rhedeg a phasio'n ofalus", text: "Room to walk, run and pass with care", from: 1760, to: 2090, position: "top-left" },
  { id: "bus", cy: "Beicio i'r orsaf, cloi'r beic, dal bws neu drên", text: "Ride to the station, lock up, catch a bus or train", from: 2120, to: 2420, position: "top-left" },
  { id: "bus-existing", cy: "Yn bodoli: gorsaf a safle bws\nArfaethedig: loceri beiciau ac arwyddion", text: "Existing: station and bus stop\nProposed: cycle lockers and signs", from: 2130, to: 2690, position: "bottom-left" },
  { id: "welcome", cy: "Lle i orffwys a mwynhau'r olygfa", text: "A place to rest and take in the view", from: 2720, to: 3020, position: "top-left" },
  { id: "everyone", cy: "Croeso i bawb, beth bynnag fo'ch cyflymder", text: "Welcoming for everyone, whatever your pace", from: 3080, to: 3440, position: "top-left" },
  { id: "ride", cy: `${miles(ROUTE_M)} milltir o Flaenau Ffestiniog i Drawsfynydd`, text: `${miles(ROUTE_M)} miles from Blaenau Ffestiniog to Trawsfynydd`, from: 3480, to: 3800, position: "top-left" },
  { id: "ride-time", cy: `Tua ${MINUTES} munud ar 10 mya hamddenol`, text: `About ${MINUTES} minutes at an easy 10 mph`, from: 3880, to: 4180, position: "top-left" },
  { id: "heritage", cy: "Treftadaeth a dyfodol y rheilffordd:\ni'w harchwilio gyda phawb", text: "Railway heritage and future rail options:\nto explore with everyone", from: 4220, to: 4640, position: "top-left" },
  { id: "together", cy: "Cysylltu ysgolion, teuluoedd, cymdogion ac ymwelwyr", text: "Linking schools, families, neighbours and visitors", from: 4690, to: 5000, position: "top-left" },
  { id: "closing", cy: "Mwy na llwybr. Cysylltiad i'n cymunedau.", text: "More than a path. A connection for our communities.", from: 5040, to: 5400, position: "bottom-center" },
];

/** How the Blender build lays the bilingual text out (build_reel.py): a wider caption box, so each language keeps to
 * a line or two, and smaller credits, which now run to four lines. */
export const COMMUNITY_LAYOUT = { captionW: 900, attributionSize: 16 } as const;
