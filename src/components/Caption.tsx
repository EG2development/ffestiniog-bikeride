import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

const FONT = "'Georgia', 'Iowan Old Style', serif";

function useFade(durationInFrames: number, fadeFrames = 15) {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [0, fadeFrames, Math.max(fadeFrames + 1, durationInFrames - fadeFrames), durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

type TitleCardProps = {
  title: string;
  subtitle?: string;
  durationInFrames: number;
};

export const TitleCard: React.FC<TitleCardProps> = ({
  title,
  subtitle,
  durationInFrames,
}) => {
  const opacity = useFade(durationInFrames);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        opacity,
        padding: "0 120px",
      }}
    >
      <div
        style={{
          background: "rgba(246,241,228,0.82)",
          borderRadius: 16,
          padding: "36px 56px",
          maxWidth: 1200,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 64,
            color: "#2c2a26",
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              marginTop: 18,
              fontFamily: "system-ui, sans-serif",
              fontSize: 26,
              color: "#4a473f",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

type LabelProps = {
  text: string;
  durationInFrames: number;
  position?: "top-left" | "bottom-left" | "bottom-center";
};

export const Label: React.FC<LabelProps> = ({
  text,
  durationInFrames,
  position = "bottom-left",
}) => {
  const opacity = useFade(durationInFrames);
  const posStyle: React.CSSProperties =
    position === "top-left"
      ? { top: 64, left: 80 }
      : position === "bottom-center"
        ? { bottom: 64, left: "50%", transform: "translateX(-50%)", textAlign: "center" }
        : { bottom: 64, left: 80 };

  return (
    <div
      style={{
        position: "absolute",
        ...posStyle,
        opacity,
        maxWidth: 760,
        fontFamily: "system-ui, sans-serif",
        fontSize: 28,
        lineHeight: 1.35,
        color: "#f6f1e4",
        background: "rgba(30,32,24,0.55)",
        padding: "14px 20px",
        borderRadius: 8,
      }}
    >
      {text}
    </div>
  );
};

export const DisclaimerBadge: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const opacity = useFade(durationInFrames, 10);
  return (
    <div
      style={{
        position: "absolute",
        top: 28,
        right: 32,
        opacity: opacity * 0.9,
        fontFamily: "system-ui, sans-serif",
        fontSize: 15,
        letterSpacing: 0.4,
        color: "#2c2a26",
        background: "rgba(246,241,228,0.85)",
        padding: "6px 12px",
        borderRadius: 20,
      }}
    >
      Concept visualisation — not an approved route
    </div>
  );
};
