import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { CAPTIONS } from "../data/reel-captions";
import { REEL_FRAMES, REEL_SCENES } from "../data/reel-timeline";
import { CaptionOverlays, OverlayLog } from "../three/Overlays";
import { Section3D } from "./Section3D";

// The 1:30 reel: the storyboard's scenes as hard cuts between section compositions, in the frame
// budget of src/data/reel-timeline.ts (docs/adr/0028-reel-master-composition.md). Captions come from
// src/data/reel-captions.ts (ADR 36) and are rendered over the whole series in reel frames.
export const FEATURE_IDS = ["terrain-lidar", "landcover-osm", "trail-proposed", "trees", "cyclist", "bridge-159029124"];

export const Reel3D: React.FC<{ diagnostics?: boolean }> = ({ diagnostics = false }) => (
  <AbsoluteFill>
    <Series>
      {REEL_SCENES.map((s) => (
        <Series.Sequence key={`${s.config}-${s.from}`} durationInFrames={s.frames} layout="none">
          <Section3D section={s.config} diagnostics={diagnostics} />
        </Series.Sequence>
      ))}
    </Series>
    <CaptionOverlays captions={CAPTIONS} total={REEL_FRAMES} />
    {diagnostics ? <OverlayLog /> : null}
  </AbsoluteFill>
);

export default Reel3D;
