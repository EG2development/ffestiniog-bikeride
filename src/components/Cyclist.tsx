import React from "react";
import { useCurrentFrame } from "remotion";
import { useRouteData } from "../data/RouteDataProvider";

type CyclistProps = {
  /** progress along the route, 0-1 */
  t: number;
  /** current scene's viewHeight, used to size the icon readably at any zoom */
  viewHeight: number;
};

export const Cyclist: React.FC<CyclistProps> = ({ t, viewHeight }) => {
  const frame = useCurrentFrame();
  const { pointAtT } = useRouteData();
  const here = pointAtT(t);
  const ahead = pointAtT(Math.min(1, t + 0.0015));
  const angle = Math.atan2(ahead.y - here.y, ahead.x - here.x);
  const scale = viewHeight / 34;
  const bob = Math.sin(frame / 3.3) * scale * 0.05;

  return (
    <g
      transform={`translate(${here.x},${here.y + bob}) rotate(${
        (angle * 180) / Math.PI
      }) scale(${scale})`}
    >
      <circle cx={-1.1} cy={0.9} r={0.95} fill="none" stroke="#2c2a26" strokeWidth={0.22} />
      <circle cx={1.1} cy={0.9} r={0.95} fill="none" stroke="#2c2a26" strokeWidth={0.22} />
      <path
        d="M -1.1,0.9 L 0.1,-0.5 L 1.1,0.9 M 0.1,-0.5 L -0.3,-1.3 L 0.5,-1.3 M 0.1,-0.5 L 0.6,0.9"
        fill="none"
        stroke="#2c2a26"
        strokeWidth={0.24}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={0.45} cy={-1.55} r={0.32} fill="#c97a3d" />
    </g>
  );
};
