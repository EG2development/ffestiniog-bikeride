// Single source of truth for scene durations (at 30fps), matching docs/storyboard.md.
export const FPS = 30;

export const SCENES = {
  intro: 300, // 0:00-0:10
  historicReveal: 360, // 0:10-0:22
  routeOverview: 360, // 0:22-0:34
  blaenau: 360, // 0:34-0:46
  countryside: 540, // 0:46-1:04
  maentwrogRoad: 300, // 1:04-1:14
  trawsfynyddApproach: 540, // 1:14-1:32
  futureVision: 390, // 1:32-1:45
} as const;

export const TOTAL_DURATION_IN_FRAMES = Object.values(SCENES).reduce(
  (sum, d) => sum + d,
  0,
);
