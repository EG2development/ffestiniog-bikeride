import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { RouteStage } from "../components/RouteStage";
import { Cyclist } from "../components/Cyclist";
import { Label } from "../components/Caption";
import { useRouteData } from "../data/RouteDataProvider";
import { SCENES } from "../data/timeline";

const T_START = 0.5;
const T_END = 0.68;

export const Scene6MaentwrogRoad: React.FC = () => {
  const frame = useCurrentFrame();
  const { pointAtT, stations, closeViewHeight } = useRouteData();
  const duration = SCENES.maentwrogRoad;
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
          text="Maentwrog Road — the former station is a private home today. The A470 road bridge just north was rebuilt in 2002 in a way that preserved the line beneath it."
          durationInFrames={duration}
          position="bottom-left"
        />
      }
    >
      <Cyclist t={t} viewHeight={closeViewHeight} />
    </RouteStage>
  );
};
