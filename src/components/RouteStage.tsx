import React from "react";
import { AbsoluteFill } from "remotion";
import { MapBasemap } from "./MapBasemap";
import { useRouteData } from "../data/RouteDataProvider";

type RouteStageProps = {
  /** camera centre, in route world-space units (see src/data/route.ts) */
  cameraX: number;
  cameraY: number;
  /** vertical extent of the camera view, in world units — smaller = more zoomed in */
  viewHeight: number;
  /** fraction of the route drawn so far, 0-1 */
  revealT: number;
  /** station ids to show as markers+labels on the map in this shot */
  visibleStationIds?: string[];
  /** extra SVG content in world-space (e.g. the Cyclist marker) */
  children?: React.ReactNode;
  /** extra HTML overlay content in screen-space (e.g. captions) */
  overlay?: React.ReactNode;
};

const ASPECT = 1920 / 1080;

export const RouteStage: React.FC<RouteStageProps> = ({
  cameraX,
  cameraY,
  viewHeight,
  revealT,
  visibleStationIds = [],
  children,
  overlay,
}) => {
  const { pathUpToT, stations } = useRouteData();
  const viewWidth = viewHeight * ASPECT;
  const viewBox = `${cameraX - viewWidth / 2} ${cameraY - viewHeight / 2} ${viewWidth} ${viewHeight}`;

  const routeCasingWidth = Math.max(3.2, viewHeight / 85);
  const routeLineWidth = Math.max(1.4, viewHeight / 170);

  return (
    <AbsoluteFill style={{ background: "#dfe3d4" }}>
      <svg
        viewBox={viewBox}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        <MapBasemap />
        {/* world-space colour grade, pans with the camera for a cohesive tone over the raw map tiles */}
        <rect
          x={cameraX - viewWidth}
          y={cameraY - viewHeight}
          width={viewWidth * 2}
          height={viewHeight * 2}
          fill="#f3ead2"
          opacity={0.16}
        />
        <path
          d={pathUpToT(revealT)}
          fill="none"
          stroke="#fbf6e8"
          strokeOpacity={0.9}
          strokeWidth={routeCasingWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={pathUpToT(revealT)}
          fill="none"
          stroke="#c9602f"
          strokeWidth={routeLineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {stations.filter((s) => visibleStationIds.includes(s.id)).map(
          (s) => (
            <g key={s.id}>
              <circle
                cx={s.x}
                cy={s.y}
                r={Math.max(2.6, viewHeight / 200)}
                fill="#f6f1e4"
                stroke="#2c2a26"
                strokeWidth={Math.max(0.7, viewHeight / 800)}
              />
            </g>
          ),
        )}
        {children}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 0 220px rgba(20,24,16,0.3)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 80,
          fontFamily: "system-ui, sans-serif",
          fontSize: 12,
          color: "rgba(44,42,38,0.55)",
        }}
      >
        Map: © OpenStreetMap contributors (ODbL) · © OpenTopoMap (CC-BY-SA) · SRTM
      </div>
      {overlay}
    </AbsoluteFill>
  );
};
