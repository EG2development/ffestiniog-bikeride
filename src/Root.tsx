import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { CyclingVision } from "./CyclingVision";
import { TOTAL_DURATION_IN_FRAMES, FPS } from "./data/timeline";

// 3D compositions are registered as separate entries, never by changing
// CyclingVision (docs/adr/0002-separate-3d-compositions.md, docs/sop-3d.md).
// They load lazily, so three.js stays out of the 2D video's bundle
// (docs/adr/0024-lazy-3d-compositions.md).
const pocMetadata = async () => {
  const { POC } = await import("./three-core/poc");
  return { durationInFrames: POC.frames, fps: POC.fps };
};

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
      <MyComposition />
    </>
  );
};
