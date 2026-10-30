import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { CyclingVision } from "./CyclingVision";
import { TOTAL_DURATION_IN_FRAMES, FPS } from "./data/timeline";

// 3D compositions are registered as separate entries, never by changing
// CyclingVision (docs/adr/0002-separate-3d-compositions.md, docs/sop-3d.md).
// They load lazily, so three.js stays out of the 2D video's bundle
// (docs/adr/0024-lazy-3d-compositions.md). The reel and its sections: ADR 28.
const pocMetadata = async () => {
  const { POC } = await import("./three-core/poc");
  return { durationInFrames: POC.frames, fps: POC.fps };
};
const reelMetadata = async () => {
  const { REEL_FRAMES, REEL_FPS } = await import("./data/reel-timeline");
  return { durationInFrames: REEL_FRAMES, fps: REEL_FPS };
};
const sectionMetadata = (id: string) => async () => {
  const { SECTIONS } = await import("./three-core/sections");
  return { durationInFrames: SECTIONS[id].frames, fps: 30 };
};
// the photoreal proof of concept rides a prototype config outside the reel (docs/adr/0054-photoreal-layer.md)
const photoMetadata = async () => {
  const { PROTOTYPES } = await import("./three-core/sections");
  return { durationInFrames: PROTOTYPES["maentwrog-photo"].frames, fps: 30 };
};
const SECTION_IDS = ["intro", "heritage", "overview", "blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd", "closing"];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CyclingVision"
        component={CyclingVision}
        durationInFrames={TOTAL_DURATION_IN_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Poc3DMaentwrog"
        lazyComponent={() => import("./scenes3d/PocMaentwrog")}
        calculateMetadata={pocMetadata}
        width={1920}
        height={1080}
        defaultProps={{ diagnostics: false }}
      />
      <Composition
        id="Reel3D"
        lazyComponent={() => import("./scenes3d/Reel3D")}
        calculateMetadata={reelMetadata}
        width={1920}
        height={1080}
        defaultProps={{ diagnostics: false }}
      />
      <Composition
        id="Poc3DMaentwrogPhoto"
        lazyComponent={() => import("./scenes3d/PocMaentwrogPhoto")}
        calculateMetadata={photoMetadata}
        width={1920}
        height={1080}
        defaultProps={{ diagnostics: false }}
      />
      {SECTION_IDS.map((id) => (
        <Composition
          key={id}
          id={`Section-${id}`}
          lazyComponent={() => import("./scenes3d/Section3D")}
          calculateMetadata={sectionMetadata(id)}
          width={1920}
          height={1080}
          defaultProps={{ section: id, diagnostics: false, captions: "section" as const }}
        />
      ))}
      <MyComposition />
    </>
  );
};
