import React from "react";
import { ElevationProfilePoint } from "../data/route";
import { useRouteData } from "../data/RouteDataProvider";
import { feet, miles } from "../data/units";

const W = 560;
const H = 120;
const PAD = 10;

function buildPath(
  profile: ElevationProfilePoint[],
  totalKm: number,
  min: number,
  max: number,
): string {
  const span = Math.max(1, max - min);
  return profile
    .map((p, i) => {
      const x = PAD + (p.distance_km / totalKm) * (W - PAD * 2);
      const y = H - PAD - ((p.elevation_m - min) / span) * (H - PAD * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

type ElevationStripProps = {
  /** progress along the route, 0-1, for the moving marker */
  t: number;
};

export const ElevationStrip: React.FC<ElevationStripProps> = ({ t }) => {
  const { elevationProfile, elevationRange, totalLengthM } = useRouteData();
  const totalKm = totalLengthM / 1000;
  const { min, max } = elevationRange;
  const path = buildPath(elevationProfile, totalKm, min, max);
  const span = Math.max(1, max - min);
  const markerKm = t * totalKm;
  const markerX = PAD + (markerKm / totalKm) * (W - PAD * 2);
  const nearest = elevationProfile.reduce((best, p) =>
    Math.abs(p.distance_km - markerKm) < Math.abs(best.distance_km - markerKm)
      ? p
      : best,
  );
  const markerY = H - PAD - ((nearest.elevation_m - min) / span) * (H - PAD * 2);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 56,
        right: 64,
        background: "rgba(246,241,228,0.88)",
        borderRadius: 10,
        padding: "10px 14px 4px",
      }}
    >
      <svg width={W} height={H}>
        <path d={path} fill="none" stroke="#6e7073" strokeWidth={2} />
        <circle cx={markerX} cy={markerY} r={6} fill="#c97a3d" stroke="#2c2a26" strokeWidth={1} />
      </svg>
      <div
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          color: "#4a473f",
          textAlign: "center",
          paddingBottom: 6,
        }}
      >
        Elevation {feet(min)}–{feet(max)} ft
        {" · "}
        {miles(totalKm * 1000)} miles
      </div>
    </div>
  );
};
