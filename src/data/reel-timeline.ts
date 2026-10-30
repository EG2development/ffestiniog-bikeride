// The reel's frame budget: the single source for the master composition and the RL2 test
// (docs/spec-3d.md "Frame budget"; docs/adr/0028-reel-master-composition.md).

export const REEL_FPS = 30;
export const REEL_FRAMES = 2700;

/** One entry per sequence; `id` is the storyboard scene, `section` its data window, `config` its section config. */
export type ReelScene = { id: string; section: string; config: string; from: number; frames: number };

export const REEL_SCENES: ReelScene[] = [
  { id: "intro", section: "corridor", config: "intro", from: 0, frames: 240 },
  { id: "heritage", section: "corridor", config: "heritage", from: 240, frames: 240 },
  { id: "overview", section: "corridor", config: "overview", from: 480, frames: 300 },
  { id: "blaenau", section: "blaenau", config: "blaenau", from: 780, frames: 300 },
  { id: "vale", section: "vale-north", config: "vale-north", from: 1080, frames: 270 },
  { id: "vale", section: "vale-south", config: "vale-south", from: 1350, frames: 270 },
  { id: "maentwrog", section: "maentwrog", config: "maentwrog", from: 1620, frames: 300 },
  { id: "trawsfynydd", section: "trawsfynydd", config: "trawsfynydd", from: 1920, frames: 480 },
  { id: "closing", section: "corridor", config: "closing", from: 2400, frames: 300 },
];
