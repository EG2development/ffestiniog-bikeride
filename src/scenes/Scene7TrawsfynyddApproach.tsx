import React from "react";
import { interpolate, useCurrentFrame, Easing, Sequence } from "remotion";
import { RouteStage } from "../components/RouteStage";
import { Cyclist } from "../components/Cyclist";
import { Label, TitleCard } from "../components/Caption";
import { useRouteData } from "../data/RouteDataProvider";
import { SCENES } from "../data/timeline";

const T_START = 0.68;
const T_END = 1.0;
const DESTINATION_CARD_FRAMES = 90;

export const Scene7TrawsfynyddApproach: React.FC = () => {
  const frame = useCurrentFrame();
  const { pointAtT, stations, closeViewHeight } = useRouteData();
  const duration = SCENES.trawsfynyddApproach;
  const t = interpolate(frame, [0, duration], [T_START, T_END], {
    easing: Easing.inOut(Easing.ease),
  });
  const cam = pointAtT(t);
  const labelDuration = duration - DESTINATION_CARD_FRAMES;

  return (
    <RouteStage
      cameraX={cam.x}
      cameraY={cam.y}
      viewHeight={closeViewHeight}
      revealT={t}
      visibleStationIds={stations.map((s) => s.id)}
      overlay={
        <>
          <Sequence durationInFrames={labelDuration} layout="none">
            <Label
              text="Past Trawsfynydd Lake Halt — closed since 1960 — and the former nuclear power station, now a long-term decommissioning site and not part of the proposed trail."
              durationInFrames={labelDuration}
              position="bottom-left"
            />
          </Sequence>
          <Sequence from={labelDuration} layout="none">
            <TitleCard
              title="Trawsfynydd"
              subtitle="Journey's end for this concept — 13.2 km from Blaenau Ffestiniog"
              durationInFrames={DESTINATION_CARD_FRAMES}
            />
          </Sequence>
        </>
      }
    >
      <Cyclist t={t} viewHeight={closeViewHeight} />
    </RouteStage>
  );
};
