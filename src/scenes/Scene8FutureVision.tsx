import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { RouteStage } from "../components/RouteStage";
import { TitleCard, DisclaimerBadge } from "../components/Caption";
import { ElevationStrip } from "../components/ElevationStrip";
import { useRouteData } from "../data/RouteDataProvider";
import { SCENES } from "../data/timeline";

export const Scene8FutureVision: React.FC = () => {
  const frame = useCurrentFrame();
  const { worldCenter, fullViewHeight, stations } = useRouteData();
  const duration = SCENES.futureVision;
  const viewHeight = interpolate(
    frame,
    [0, duration],
    [fullViewHeight * 0.5, fullViewHeight],
    { easing: Easing.inOut(Easing.ease), extrapolateRight: "clamp" },
  );

  return (
    <RouteStage
      cameraX={worldCenter.x}
      cameraY={worldCenter.y}
      viewHeight={viewHeight}
      revealT={1}
      visibleStationIds={stations.map((s) => s.id)}
      overlay={
        <>
          <DisclaimerBadge durationInFrames={duration} />
          <TitleCard
            title="A concept for the future"
            subtitle="13.2 km of former railway, one possible active-travel link — subject to ownership, heritage-rail history, and full feasibility review"
            durationInFrames={duration}
          />
          <ElevationStrip t={1} />
        </>
      }
    />
  );
};
