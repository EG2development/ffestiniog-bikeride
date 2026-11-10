// The community film's social cuts: a 15 s teaser, 30 s highlights and a 60 s story for Instagram and Facebook Reels and
// YouTube Shorts (9:16), a 45 s feed post (4:5) and a 60 s landscape cut for YouTube (16:9). Each cut is its own edit of
// plates rendered fresh from the film's Blender scenes at the cut's own aspect ratio (scripts/blender/render_social.py),
// never a crop or a speed-up of the 3-minute master, which stays as it is. Remotion lays the captions, the concept badge,
// the end card and the music over the plates (src/social/SocialCut.tsx; npm run social:render).
// Platform specifications checked 2026-11-04: YouTube's recommended upload encoding (H.264 High, 4:2:0, BT.709, AAC-LC
// 48 kHz, Fast Start; 8 Mbps the floor for 1080p30), YouTube Shorts (vertical or square, up to 3 minutes), Meta's ads
// guide (Facebook feed 4:5 at 1440 x 1800, H.264, fixed frame rate, stereo AAC at 128 kbps or more) and the 9:16 Reels
// canvas at 1080 x 1920 with its interface overlays at the top, the bottom and the right edge.
import { MINUTES, ROUTE_M, SOURCES, SOURCES_CY } from "./community-film";
import { miles } from "./units";

export const SOCIAL_FPS = 30;

export type FormatId = "vertical" | "feed" | "landscape";
/** Where text may go: pixels kept clear of each edge, for the platforms' own buttons, names and captions. */
export type Safe = { top: number; bottom: number; left: number; right: number };
export type Format = {
  w: number;
  h: number;
  /** the share of the master's horizontal field of view a plate keeps by default (a native render, not a crop) */
  share: number;
  safe: Safe;
};

export const FORMATS: Record<FormatId, Format> = {
  // Reels and Shorts cover about the top 13 % with the account bar, the bottom 30 % with the caption, audio and
  // progress bar, and a strip down the right with the like, comment and share buttons
  vertical: { w: 1080, h: 1920, share: 0.5, safe: { top: 250, bottom: 580, left: 64, right: 150 } },
  // the feed shows the whole 4:5 frame, with the post's own text below it: a plain 5 % margin
  feed: { w: 1440, h: 1800, share: 0.62, safe: { top: 90, bottom: 90, left: 90, right: 90 } },
  // YouTube's player: the 5 % title-safe area, as the film's own
  landscape: { w: 1920, h: 1080, share: 1, safe: { top: 54, bottom: 96, left: 96, right: 96 } },
};

/** How a plate is reframed for a format: the share of the master's view it keeps, a pan (degrees, positive turns
 * left) and a lens shift (a fraction of the frame's longer side; positive y lifts the frame towards the sky). */
export type Framing = { share?: number; pan?: number; shiftX?: number; shiftY?: number };

/** A run of one community scene's frames, rendered clean (no captions) for each format that uses it. */
export type Plate = { id: string; config: string; from: number; frames: number; subject: string; framing?: Partial<Record<FormatId, Framing>> };

export const PLATES: Plate[] = [
  { id: "maentwrog-pov", config: "community-ride-maentwrog", from: 135, frames: 105, subject: "riding under the Maentwrog road bridge; a parent on a cargo bike with a child comes the other way", framing: { vertical: { share: 0.44 }, feed: { share: 0.56 } } },
  { id: "opening-aerial", config: "community-open", from: 30, frames: 120, subject: "Llan Ffestiniog and the vale from the air" },
  { id: "then", config: "community-then", from: 60, frames: 150, subject: "the mothballed railway today, grown over, by Llan Ffestiniog" },
  { id: "now", config: "community-now", from: 40, frames: 150, subject: "the same view as a shared path: neighbours walking, a cyclist coming through" },
  { id: "school-ride", config: "community-school", from: 540, frames: 150, subject: "pupils riding to school, a parent on a long-tail with a younger child at the back" },
  { id: "family-cargo", config: "community-family", from: 30, frames: 150, subject: "a family walking and riding, two children in a cargo bike's box", framing: { vertical: { pan: -8 }, feed: { pan: -5 } } },
  { id: "family-follow", config: "community-family", from: 240, frames: 90, subject: "following the family's young rider; the Christiania passes on the right", framing: { vertical: { pan: -5 } } },
  { id: "walkers", config: "community-walkers", from: 190, frames: 120, subject: "a runner, walkers and a cyclist passing with care" },
  { id: "bench-view", config: "community-welcome", from: 60, frames: 120, subject: "an older couple on a bench, looking out over the countryside to the lake" },
  { id: "bench-trike", config: "community-welcome", from: 330, frames: 105, subject: "a resident resting on a bench as an adult tricycle passes" },
  { id: "station-lockers", config: "community-bus", from: 100, frames: 120, subject: "locking up at the proposed cycle lockers by Blaenau Ffestiniog station" },
  { id: "bus-stop", config: "community-bus", from: 470, frames: 90, subject: "the existing bus stop and a bus at Blaenau Ffestiniog" },
  { id: "blaenau-pov", config: "community-ride-blaenau", from: 115, frames: 105, subject: "riding into Blaenau; a cargo bike brings the shopping home", framing: { vertical: { share: 0.44 }, feed: { share: 0.56 } } },
  { id: "manod-pov", config: "community-ride-manod", from: 90, frames: 90, subject: "riding past Manod; a long-tail with panniers of shopping", framing: { vertical: { share: 0.44 }, feed: { share: 0.56 } } },
  { id: "traws-pov", config: "community-ride-trawsfynydd", from: 60, frames: 105, subject: "riding the open moorland towards Trawsfynydd" },
  { id: "together", config: "community-together", from: 0, frames: 150, subject: "families, pupils and a Christiania box trike meeting by the benches", framing: { vertical: { share: 0.42, pan: 6 }, feed: { share: 0.56, pan: 4 } } },
  { id: "traws-aerial", config: "community-close", from: 120, frames: 180, subject: "Llyn Trawsfynydd and the corridor from the air", framing: { vertical: { shiftY: -0.1 }, feed: { shiftY: -0.06 } } },
];

/** A caption's two languages, Welsh first. */
export type Line = { cy: string; en: string };

const MILES = miles(ROUTE_M);
/** Every line the cuts show: short, natural Welsh above British English, distances in miles and speeds in mph. */
export const LINES = {
  path: { cy: "Mwy na llwybr", en: "More than a path" },
  railway: { cy: "Un hen reilffordd, tair cymuned", en: "One former railway, three communities" },
  route: { cy: `Blaenau Ffestiniog i Drawsfynydd:\n${MILES} milltir`, en: `Blaenau Ffestiniog to Trawsfynydd:\n${MILES} miles` },
  school: { cy: "Taith fwy diogel i'r ysgol", en: "A safer journey to school" },
  family: { cy: "Teithiau teulu bob dydd", en: "Everyday family journeys" },
  walk: { cy: "Lle i gerdded, rhedeg a beicio", en: "Room to walk, run and ride" },
  rest: { cy: "Lle i orffwys a mwynhau'r olygfa", en: "A place to rest and enjoy the view" },
  everyone: { cy: "Llwybr i bawb", en: "A route for everyone" },
  station: { cy: "Beicio i'r orsaf, dal bws neu drên", en: "Ride to the station, catch a bus or train" },
  shopping: { cy: "Siopa lleol ar feic cargo", en: "Local shopping by cargo bike" },
  time: { cy: `Tua ${MINUTES} munud ar 10 mya hamddenol`, en: `About ${MINUTES} minutes at an easy 10 mph` },
  communities: { cy: "Cysylltu cymunedau", en: "Connecting communities" },
} satisfies Record<string, Line>;
export type LineId = keyof typeof LINES;

/** On screen throughout: this is a concept, not a scheme. */
export const BADGE: Line = { cy: "Darlun cysyniadol · nid llwybr wedi'i gymeradwyo", en: "Concept visualisation · not an approved route" };
/** Small notes under the badge where a shot's subject is proposed street furniture. */
export const NOTES = {
  lockers: { cy: "Arfaethedig: loceri beiciau", en: "Proposed: cycle lockers" },
  benches: { cy: "Arfaethedig: meinciau", en: "Proposed: benches" },
  busStop: { cy: "Yma'n barod: safle bws", en: "Existing: bus stop" },
} satisfies Record<string, Line>;
export type NoteId = keyof typeof NOTES;

/** The end card: the film's closing line, the places, an invitation, and the sources the licences ask to be credited. */
export const END_CARD = {
  title: { cy: "Mwy na llwybr.\nCysylltiad i'n cymunedau.", en: "More than a path.\nA connection for our communities." },
  places: "Blaenau Ffestiniog · Llan Ffestiniog · Trawsfynydd", // no-break spaces: a name never splits across lines
  invite: { cy: "Syniad i'w drafod efo'n gilydd", en: "An idea to explore together" },
  credits: { cy: SOURCES_CY, en: SOURCES },
};

/** What goes with each upload: its title and the post's text, Welsh first, and the same credits as the end card. */
export const POST_TEXT: Line = {
  cy: "Darlun cysyniadol o lwybr cerdded a beicio ar hyd yr hen reilffordd rhwng Blaenau Ffestiniog a Thrawsfynydd. Dydi'r llwybr ddim wedi'i gymeradwyo: syniad i'w drafod efo'n gilydd ydi o.",
  en: "A concept visualisation of a walking and cycling route along the former railway between Blaenau Ffestiniog and Trawsfynydd. It is not an approved route: it is an idea to explore together.",
};
export const POST_TITLES: Record<CutId, Line> = {
  teaser: { cy: "Mwy na llwybr: Blaenau Ffestiniog i Drawsfynydd", en: "More than a path: Blaenau Ffestiniog to Trawsfynydd" },
  highlights: { cy: "Llwybr i bawb rhwng ein cymunedau", en: "A route for everyone between our communities" },
  story: { cy: "Hen reilffordd, llwybr newydd? Syniad i'w drafod", en: "A former railway, a new path? An idea to explore" },
  feed: { cy: "Cysylltu cymunedau: syniad ar gyfer yr hen reilffordd", en: "Connecting communities: an idea for the former railway" },
  youtube: { cy: "Blaenau Ffestiniog i Drawsfynydd: darlun o lwybr cerdded a beicio", en: "Blaenau Ffestiniog to Trawsfynydd: a walking and cycling route visualised" },
};

/** One shot of a cut: `frames` of a plate from `at` frames into it, with the caption it carries (a caption runs on
 * across the next shots that carry the same one) and an optional note. */
export type Shot = { plate: string; frames: number; at?: number; line?: LineId; note?: NoteId };
export type CutId = "teaser" | "highlights" | "story" | "feed" | "youtube";
export type Cut = { id: CutId; title: string; format: FormatId; shots: Shot[]; endCard: number; platforms: string[] };

const s = (plate: string, frames: number, line?: LineId, extra: Partial<Shot> = {}): Shot => ({ plate, frames, ...(line && { line }), ...extra });

/** The 60 s story, which YouTube's landscape cut shares: hook, the railway today and the same view as a path (the
 * film's then-and-now, review 2026-11-05), the places, the benefits, the ride, the close. */
const STORY: Shot[] = [
  s("maentwrog-pov", 105, "path"),
  s("then", 90, "railway", { at: 60 }),
  s("now", 90, "railway", { at: 60 }),
  s("opening-aerial", 75, "railway"),
  s("school-ride", 150, "school"),
  s("family-cargo", 135, "family"),
  s("family-follow", 75, "family"),
  s("walkers", 105, "walk"),
  s("bench-view", 105, "rest", { note: "benches" }),
  s("bench-trike", 105, "everyone", { note: "benches" }),
  s("station-lockers", 105, "station", { note: "lockers" }),
  s("bus-stop", 75, "station", { note: "busStop" }),
  s("blaenau-pov", 90, "shopping"),
  s("manod-pov", 90, "route"),
  s("traws-pov", 90, "time"),
  s("together", 135, "communities"),
  s("traws-aerial", 180),
];

export const CUTS: Cut[] = [
  {
    id: "teaser",
    title: "Quick teaser (15 s, 9:16)",
    format: "vertical",
    platforms: ["Instagram Reels", "Facebook Reels", "YouTube Shorts"],
    endCard: 120,
    shots: [s("maentwrog-pov", 90, "path", { at: 15 }), s("school-ride", 90, "school", { at: 30 }), s("family-cargo", 75, "everyone", { at: 30 }), s("bench-trike", 75, "everyone", { at: 15 }), s("traws-aerial", 120, undefined, { at: 60 })],
  },
  {
    id: "highlights",
    title: "Community highlights (30 s, 9:16)",
    format: "vertical",
    platforms: ["Instagram Reels", "Facebook Reels", "YouTube Shorts"],
    endCard: 135,
    shots: [
      s("maentwrog-pov", 90, "path", { at: 15 }),
      s("then", 50, "railway", { at: 60 }),
      s("now", 55, "railway", { at: 60 }),
      s("school-ride", 105, "school", { at: 15 }),
      s("family-cargo", 105, "family", { at: 20 }),
      s("walkers", 75, "walk", { at: 15 }),
      s("bench-trike", 90, "everyone", { at: 10, note: "benches" }),
      s("station-lockers", 90, "station", { at: 15, note: "lockers" }),
      s("together", 105, "communities", { at: 20 }),
      s("traws-aerial", 135, undefined, { at: 30 }),
    ],
  },
  { id: "story", title: "Extended story (60 s, 9:16)", format: "vertical", platforms: ["Instagram Reels", "Facebook Reels", "YouTube Shorts"], endCard: 180, shots: STORY },
  {
    id: "feed",
    title: "Feed post (45 s, 4:5)",
    format: "feed",
    platforms: ["Instagram feed", "Facebook feed"],
    endCard: 165,
    shots: [
      s("maentwrog-pov", 105, "path"),
      s("then", 60, "railway", { at: 60 }),
      s("now", 60, "railway", { at: 60 }),
      s("school-ride", 135, "school", { at: 15 }),
      s("family-cargo", 120, "family", { at: 15 }),
      s("walkers", 105, "walk", { at: 15 }),
      s("bench-view", 105, "rest", { at: 15, note: "benches" }),
      s("bench-trike", 90, "everyone", { at: 15, note: "benches" }),
      s("station-lockers", 105, "station", { at: 15, note: "lockers" }),
      s("blaenau-pov", 90, "shopping", { at: 15 }),
      s("traws-pov", 90, "route", { at: 15 }),
      s("together", 120, "communities", { at: 15 }),
      s("traws-aerial", 165, undefined, { at: 15 }),
    ],
  },
  { id: "youtube", title: "YouTube landscape (60 s, 16:9)", format: "landscape", platforms: ["YouTube"], endCard: 180, shots: STORY },
];

export const cutFrames = (cut: Cut): number => cut.shots.reduce((n, sh) => n + sh.frames, 0);
export const plateById = (id: string): Plate => {
  const p = PLATES.find((x) => x.id === id);
  if (!p) throw new Error(`no plate ${id}`);
  return p;
};

/** A cut's captions as timed runs: consecutive shots with the same line share one caption, as do their notes. */
export function captionRuns(cut: Cut, key: "line" | "note"): { id: string; from: number; to: number }[] {
  const runs: { id: string; from: number; to: number }[] = [];
  let at = 0;
  for (const sh of cut.shots) {
    const id = sh[key];
    const last = runs[runs.length - 1];
    if (id && last && last.id === id && last.to === at) last.to = at + sh.frames;
    else if (id) runs.push({ id, from: at, to: at + sh.frames });
    at += sh.frames;
  }
  return runs;
}

/** The frames of each plate a format needs, from every cut in that format: what render_social.py renders. */
export function platesFor(format: FormatId): { plate: Plate; from: number; to: number; framing: Required<Framing> }[] {
  const need = new Map<string, [number, number]>();
  for (const cut of CUTS.filter((c) => c.format === format)) {
    for (const sh of cut.shots) {
      const lo = sh.at ?? 0;
      const [a, b] = need.get(sh.plate) ?? [Infinity, -Infinity];
      need.set(sh.plate, [Math.min(a, lo), Math.max(b, lo + sh.frames)]);
    }
  }
  return PLATES.filter((p) => need.has(p.id)).map((p) => {
    const [lo, hi] = need.get(p.id)!;
    const f = p.framing?.[format] ?? {};
    return { plate: p, from: lo, to: hi, framing: { share: f.share ?? FORMATS[format].share, pan: f.pan ?? 0, shiftX: f.shiftX ?? 0, shiftY: f.shiftY ?? 0 } };
  });
}

/** Remotion's export settings per format: H.264 High in MP4 with Fast Start, 4:2:0, BT.709, a constant 30 fps, rendered
 * from lossless PNG frames, and AAC-LC at 320 kbps, 48 kHz. Every platform re-encodes what it is sent, so the upload is
 * well above their floors (YouTube's 8 Mbps for 1080p30): the CRF holds detail in foliage and fine moorland grass. */
export const EXPORT_PRESETS: Record<FormatId, { crf: number; maxBitrateMbps: number }> = {
  vertical: { crf: 16, maxBitrateMbps: 40 },
  feed: { crf: 16, maxBitrateMbps: 45 },
  landscape: { crf: 16, maxBitrateMbps: 40 },
};
