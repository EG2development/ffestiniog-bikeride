import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { RouteStage } from "../components/RouteStage";
import { TitleCard } from "../components/Caption";
import { useRouteData } from "../data/RouteDataProvider";
import { SCENES } from "../data/timeline";

export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { worldCenter, fullViewHeight } = useRouteData();
  const duration = SCENES.intro;
  const viewHeight = interpolate(
    frame,
    [0, duration],
    [fullViewHeight * 1.6, fullViewHeight],
    { easing: Easing.inOut(Easing.ease), extrapolateRight: "clamp" },
  );

  return (
    <RouteStage
      cameraX={worldCenter.x}
      cameraY={worldCenter.y}
      viewHeight={viewHeight}
      revealT={0}
      overlay={
        <TitleCard
          title="Blaenau Ffestiniog ↔ Trawsfynydd"
          subtitle="A cycling route concept on the former Bala and Festiniog Railway — an early-stage idea, not an approved route"
          durationInFrames={duration}
        />
      }
    />
  );
};
