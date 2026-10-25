import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { RouteStage } from "../components/RouteStage";
import { Cyclist } from "../components/Cyclist";
import { Label } from "../components/Caption";
import { useRouteData } from "../data/RouteDataProvider";
import { SCENES } from "../data/timeline";

const T_START = 0;
const T_END = 0.12;

export const Scene4Blaenau: React.FC = () => {
  const frame = useCurrentFrame();
  const { pointAtT, stations, closeViewHeight } = useRouteData();
  const duration = SCENES.blaenau;
  const t = interpolate(frame, [0, duration], [T_START, T_END], {
    easing: Easing.inOut(Easing.ease),
  });
  const cam = pointAtT(t);

  return (
    <RouteStage
      cameraX={cam.x}
      cameraY={cam.y}
      viewHeight={closeViewHeight}
      revealT={Math.max(t, 0.02)}
      visibleStationIds={stations.map((s) => s.id)}
      overlay={
        <Label
          text="Blaenau Ffestiniog — still a live station today, served by the Conwy Valley Line and the heritage Ffestiniog Railway. The proposed trail would start from here."
          durationInFrames={duration}
          position="bottom-left"
        />
      }
    >
      <Cyclist t={t} viewHeight={closeViewHeight} />
    </RouteStage>
  );
};
