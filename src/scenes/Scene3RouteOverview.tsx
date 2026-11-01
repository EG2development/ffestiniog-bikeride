import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { RouteStage } from "../components/RouteStage";
import { Label } from "../components/Caption";
import { ElevationStrip } from "../components/ElevationStrip";
import { useRouteData } from "../data/RouteDataProvider";
import { SCENES } from "../data/timeline";
import { miles } from "../data/units";

export const Scene3RouteOverview: React.FC = () => {
  const frame = useCurrentFrame();
  const { worldCenter, fullViewHeight, stations, totalLengthM } =
    useRouteData();
  const duration = SCENES.routeOverview;
  const t = interpolate(frame, [0, duration], [0, 1], {
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <RouteStage
      cameraX={worldCenter.x}
      cameraY={worldCenter.y}
      viewHeight={fullViewHeight}
      revealT={1}
      visibleStationIds={stations.map((s) => s.id)}
      overlay={
        <>
          <Label
            text={`${miles(totalLengthM)} miles, Blaenau Ffestiniog to Trawsfynydd`}
            durationInFrames={duration}
            position="top-left"
          />
          <ElevationStrip t={t} />
        </>
      }
    />
  );
};
