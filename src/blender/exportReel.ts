import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMMUNITY_CAPTIONS, COMMUNITY_FPS, COMMUNITY_FRAMES, COMMUNITY_SCENES } from "../data/community-film";
import { reelCaptions, type Caption } from "../data/reel-captions";
import { REEL_FPS, REEL_FRAMES, REEL_LOOK, REEL_SCENES, type ReelScene } from "../data/reel-timeline";
import { configById } from "../three-core/sections";
import { exportSection, type Manifest } from "./exportSection";

// The reel as Blender sees it (docs/blender-build-plan.md, Phase 6): every scene of REEL_SCENES exported as its own
// section package, plus reel.json holding the master timeline and the caption data the Video Sequencer assembles.
// The existing edit is the migration reference, so nothing here changes REEL_SCENES or the captions. The community
// film (src/data/community-film.ts) is exported the same way, to community.json.

export type ReelManifest = ReturnType<typeof buildReelManifest>;
export type FilmId = "reel" | "community";
type Film = { scenes: ReelScene[]; fps: number; frames: number; captions: Caption[]; file: string };
const FILMS: Record<FilmId, Film> = {
  reel: { scenes: REEL_SCENES, fps: REEL_FPS, frames: REEL_FRAMES, captions: reelCaptions(REEL_LOOK), file: "reel.json" },
  community: { scenes: COMMUNITY_SCENES, fps: COMMUNITY_FPS, frames: COMMUNITY_FRAMES, captions: COMMUNITY_CAPTIONS, file: "community.json" },
};

function buildReelManifest(film: Film, scenes: { scene: ReelScene; sectionFrames: number }[]) {
  let at = 0;
  for (const { scene, sectionFrames } of scenes) {
    if (scene.from !== at) throw new Error(`reel scene ${scene.config} starts at ${scene.from}, not at ${at}: the timeline has a gap or an overlap`);
    if (sectionFrames < scene.frames) throw new Error(`reel scene ${scene.config} takes ${scene.frames} frames of a section that has only ${sectionFrames}`);
    at += scene.frames;
  }
  if (at !== film.frames) throw new Error(`the film's scenes add up to ${at} frames, not ${film.frames}`);
  return {
    schema: 1,
    fps: film.fps,
    frames: film.frames,
    look: REEL_LOOK,
    resolution: [1920, 1080] as [number, number],
    // each scene takes exactly the master timeline's frame count from its section package (the Maentwrog section is 360 frames, the reel uses 300)
    scenes: scenes.map(({ scene, sectionFrames }) => ({ id: scene.id, config: scene.config, package: scene.config, from: scene.from, frames: scene.frames, sectionFrames })),
    captions: film.captions,
  };
}

export function exportReel(opts: { root: string; outRoot: string; film?: FilmId }): { reel: ReelManifest; packages: Manifest[] } {
  const film = FILMS[opts.film ?? "reel"];
  const packages: Manifest[] = [];
  const done = new Set<string>();
  for (const s of film.scenes) {
    if (done.has(s.config)) continue;
    done.add(s.config);
    packages.push(exportSection({ root: opts.root, outRoot: opts.outRoot, sectionId: s.config, look: REEL_LOOK }).manifest);
  }
  const reel = buildReelManifest(film, film.scenes.map((scene) => ({ scene, sectionFrames: configById(scene.config).frames })));
  mkdirSync(opts.outRoot, { recursive: true });
  writeFileSync(join(opts.outRoot, film.file), JSON.stringify(reel, null, 2) + "\n");
  return { reel, packages };
}
