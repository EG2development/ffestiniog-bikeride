import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { RouteStage } from "../components/RouteStage";
import { Cyclist } from "../components/Cyclist";
import { Label } from "../components/Caption";
import { useRouteData } from "../data/RouteDataProvider";
import { SCENES } from "../data/timeline";

const T_START = 0.12;
const T_END = 0.5;

export const Scene5Countryside: React.FC = () => {
  const frame = useCurrentFrame();
  const { pointAtT, stations, closeViewHeight } = useRouteData();
  const duration = SCENES.countryside;
  const t = interpolate(frame, [0, duration], [T_START, T_END], {
    easing: Easing.inOut(Easing.ease),
  });
  const cam = pointAtT(t);

  return (
    <RouteStage
      cameraX={cam.x}
      cameraY={cam.y}
      viewHeight={closeViewHeight}
      revealT={t}
      visibleStationIds={stations.map((s) => s.id)}
      overlay={
        <Label
          text="Through the Vale of Ffestiniog, past Festiniog (Llan Ffestiniog) station — demolished by 2011, the mothballed trackbed now overgrown."
          durationInFrames={duration}
          position="bottom-left"
        />
      }
    >
      <Cyclist t={t} viewHeight={closeViewHeight} />
    </RouteStage>
  );
};
