import React from "react";
import { Series } from "remotion";
import { RouteDataProvider } from "./data/RouteDataProvider";
import { SCENES } from "./data/timeline";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2HistoricReveal } from "./scenes/Scene2HistoricReveal";
import { Scene3RouteOverview } from "./scenes/Scene3RouteOverview";
import { Scene4Blaenau } from "./scenes/Scene4Blaenau";
import { Scene5Countryside } from "./scenes/Scene5Countryside";
import { Scene6MaentwrogRoad } from "./scenes/Scene6MaentwrogRoad";
import { Scene7TrawsfynyddApproach } from "./scenes/Scene7TrawsfynyddApproach";
import { Scene8FutureVision } from "./scenes/Scene8FutureVision";

export const CyclingVision: React.FC = () => {
  return (
    <RouteDataProvider>
      <CyclingVisionScenes />
    </RouteDataProvider>
  );
};

const CyclingVisionScenes: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={SCENES.intro}>
        <Scene1Intro />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.historicReveal}>
        <Scene2HistoricReveal />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.routeOverview}>
        <Scene3RouteOverview />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.blaenau}>
        <Scene4Blaenau />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.countryside}>
        <Scene5Countryside />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.maentwrogRoad}>
        <Scene6MaentwrogRoad />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.trawsfynyddApproach}>
        <Scene7TrawsfynyddApproach />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.futureVision}>
        <Scene8FutureVision />
      </Series.Sequence>
    </Series>
  );
};
