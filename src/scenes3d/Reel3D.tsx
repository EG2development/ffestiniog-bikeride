import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { reelCaptions } from "../data/reel-captions";
import { REEL_FRAMES, REEL_LOOK, REEL_SCENES } from "../data/reel-timeline";
import type { Look } from "../three-core/sections";
import { CaptionOverlays, OverlayLog } from "../three/Overlays";
import { Section3D } from "./Section3D";

// The 1:30 reel: the storyboard's scenes as hard cuts between section compositions, in the frame
// budget of src/data/reel-timeline.ts (docs/adr/0028-reel-master-composition.md). Captions come from
// src/data/reel-captions.ts (ADR 36) and are rendered over the whole series in reel frames. Every scene is drawn
// in one look, the photo look unless a render asks for the concept one (docs/adr/0060-reel-in-the-photo-look.md).
export const FEATURE_IDS = ["terrain-lidar", "landcover-osm", "trail-proposed", "trees", "cyclist", "bridge-159029124", "trees-canopy-blaenau", "grass-blaenau", "walkers-blaenau", "trees-canopy-vale-north", "grass-vale-north", "walkers-vale-north", "trees-canopy-vale-south", "grass-vale-south", "walkers-vale-south", "trees-canopy-maentwrog", "grass-maentwrog", "walkers-maentwrog", "trees-canopy-trawsfynydd", "grass-trawsfynydd", "walkers-trawsfynydd", "trees-canopy-corridor", "imagery-corridor"];

export const Reel3D: React.FC<{ diagnostics?: boolean; look?: Look }> = ({ diagnostics = false, look = REEL_LOOK }) => (
  <AbsoluteFill>
    <Series>
      {REEL_SCENES.map((s) => (
        <Series.Sequence key={`${s.config}-${s.from}`} durationInFrames={s.frames} layout="none">
          <Section3D section={s.config} diagnostics={diagnostics} look={look} />
        </Series.Sequence>
      ))}
    </Series>
    <CaptionOverlays captions={reelCaptions(look)} total={REEL_FRAMES} />
    {diagnostics ? <OverlayLog /> : null}
  </AbsoluteFill>
);

export default Reel3D;
