import { choreograph } from "./choreography";
import { placePeople } from "./people";
import type { PocScene, SectionConfig } from "./sections";
import { walkerTracks, type WalkerSpec, type WalkerTrack } from "./walkers";

/** A section's walkers: where its config places them (ADR 59) and by its seeded draw (ADR 61), their tables over the
 * section's frames; moving together, aware of each other and the rider, where the config asks (choreography.ts). */
export function sectionWalkers(cfg: SectionConfig, scene: PocScene, fps: number): WalkerTrack[] {
  const specs = [...(cfg.photo?.walkers ?? []), ...peopleOf(cfg, scene, fps)];
  const rider = cfg.photo?.riderHidden ? undefined : { table: scene.table, lateralM: scene.dims.lateralOffsetM };
  const choreo = cfg.photo?.choreograph ? choreograph(scene.trail, specs, cfg.frames, fps, { rider }) : undefined;
  return walkerTracks(scene.trail, specs, cfg.frames, fps, choreo);
}

/** The section's people by its seeded draw, on the stretch its shots see (ADR 61). */
function peopleOf(cfg: SectionConfig, scene: PocScene, fps: number): WalkerSpec[] {
  const people = cfg.photo?.people;
  if (!people) return [];
  const alongM = cfg.photo?.grassAlongM ?? [cfg.startDistM - 100, cfg.startDistM + 300];
  return placePeople({ trail: scene.trail, frames: cfg.frames, fps, kmRange: cfg.kmRange, alongM, rider: { table: scene.table, lateralM: scene.dims.lateralOffsetM }, shot: scene.shot }, people);
}
