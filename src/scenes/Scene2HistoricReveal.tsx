import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { RouteStage } from "../components/RouteStage";
import { Label, DisclaimerBadge } from "../components/Caption";
import { useRouteData } from "../data/RouteDataProvider";
import { SCENES } from "../data/timeline";

export const Scene2HistoricReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { worldCenter, fullViewHeight, stations } = useRouteData();
  const duration = SCENES.historicReveal;
  const revealT = interpolate(frame, [20, duration - 20], [0, 1], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stationIds = stations.filter((s) => s.t <= revealT + 0.02).map(
    (s) => s.id,
  );

  return (
    <RouteStage
      cameraX={worldCenter.x}
      cameraY={worldCenter.y}
      viewHeight={fullViewHeight}
      revealT={revealT}
      visibleStationIds={stationIds}
      overlay={
        <>
          <DisclaimerBadge durationInFrames={duration} />
          <Label
            text="Bala and Festiniog Railway — closed to passengers in 1960, finally closed and mothballed in 1998. Several attempts to reopen it as a heritage line have followed; none is currently active."
            durationInFrames={duration}
            position="bottom-left"
          />
        </>
      }
    />
  );
};
