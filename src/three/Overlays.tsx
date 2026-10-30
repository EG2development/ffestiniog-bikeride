// Iteration 2: safe area, style tokens and logged rectangles (docs/adr/0048-overlays-safe-area-and-pacing.md).
import React, { useLayoutEffect } from "react";
import { interpolate, Sequence, useCurrentFrame } from "remotion";
import type { Caption } from "../data/reel-captions";

// HTML overlays for the 3D compositions, rendered from caption data (docs/adr/0036-captions-as-data.md).
// Each carries a data-overlay marker; OverlayLog reports the ones actually visible (H2a, H3, L2, G3) and their boxes.
// The 3D captions have their own box rather than the 2D video's Label, so the 2D output cannot change.

/** The 5 % title-safe area of a 1920 × 1080 frame: every overlay box stays inside it (spec CL9). */
export const SAFE = { x: 96, y: 54 };
const FADE = 15;

type Style = { color: string; background: string; fontSize: number };
/** Tokens the tests read for contrast and size (spec CL11, CL12): text against its own box, so any 3D frame behind is fine. */
export const CAPTION_STYLE: Style = { color: "#f6f1e4", background: "rgba(30,32,24,0.78)", fontSize: 28 };
export const BADGE_STYLE: Style = { color: "#2c2a26", background: "rgba(246,241,228,0.92)", fontSize: 18 };
export const ATTRIBUTION_STYLE: Style = { color: "#f6f1e4", background: "rgba(20,22,18,0.72)", fontSize: 18 };
export const LEGEND_STYLE: Style = { color: "#f6f1e4", background: "rgba(30,32,24,0.78)", fontSize: 18 };
const FONT = "system-ui, sans-serif";
const ATTRIBUTION_HEIGHT = 40; // one line of 18 px text with its padding; captions above it clear it

const Badge: React.FC<{ id: string; text: string; top: number }> = ({ id, text, top }) => (
  <div data-overlay={id} style={{ position: "absolute", top, right: SAFE.x, fontFamily: FONT, fontSize: BADGE_STYLE.fontSize, lineHeight: 1.3, color: BADGE_STYLE.color, background: BADGE_STYLE.background, padding: "6px 14px", borderRadius: 20 }}>
    {text}
  </div>
);

const Attribution: React.FC<{ id: string; text: string }> = ({ id, text }) => (
  <div data-overlay={id} style={{ position: "absolute", bottom: SAFE.y, left: SAFE.x, right: SAFE.x, fontFamily: FONT, fontSize: ATTRIBUTION_STYLE.fontSize, lineHeight: 1.3, color: ATTRIBUTION_STYLE.color, background: ATTRIBUTION_STYLE.background, padding: "8px 12px", borderRadius: 6 }}>
    {text}
  </div>
);

/** One caption box, faded in and out over 15 frames, positioned inside the safe area. */
const CaptionBox: React.FC<{ id: string; text: string; durationInFrames: number; position: Caption["position"] }> = ({ id, text, durationInFrames, position }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE, durationInFrames - FADE, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const above = SAFE.y + ATTRIBUTION_HEIGHT + 16;
  const pos: React.CSSProperties =
    position === "top-left"
      ? { top: SAFE.y, left: SAFE.x }
      : position === "bottom-center"
        ? { bottom: above, left: "50%", transform: "translateX(-50%)", textAlign: "center" }
        : { bottom: above, left: SAFE.x };
  return (
    <div
      data-overlay={id}
      style={{ position: "absolute", ...pos, opacity, maxWidth: 820, fontFamily: FONT, fontSize: CAPTION_STYLE.fontSize, lineHeight: 1.35, color: CAPTION_STYLE.color, background: CAPTION_STYLE.background, padding: "14px 20px", borderRadius: 8, hyphens: "none", overflowWrap: "normal" }}
    >
      {text}
    </div>
  );
};

/** The key to the styles a section draws (hatched, translucent), under the badge on the right (spec CL7, BL14). */
export const Legend: React.FC<{ lines: string[] }> = ({ lines }) =>
  lines.length === 0 ? null : (
    <div data-overlay="legend" style={{ position: "absolute", top: SAFE.y + 44, right: SAFE.x, fontFamily: FONT, fontSize: LEGEND_STYLE.fontSize, lineHeight: 1.35, color: LEGEND_STYLE.color, background: LEGEND_STYLE.background, padding: "6px 14px", borderRadius: 6, textAlign: "right" }}>
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  );

/** Captions whose range covers the current frame. A caption that runs to the end keeps full opacity to the last frame. */
export const CaptionOverlays: React.FC<{ captions: Caption[]; total: number; ve?: number }> = ({ captions, total, ve = 1 }) => (
  <>
    {captions.map((c) => {
      if (c.position === "badge") return <Badge key={c.id} id={c.id} text={c.text} top={SAFE.y} />;
      if (c.position === "attribution") return <Attribution key={c.id} id={c.id} text={c.text} />;
      const frames = c.to - c.from + (c.to >= total ? FADE : 0);
      return (
        <Sequence key={c.id} from={c.from} durationInFrames={frames} layout="none">
          <CaptionBox id={c.id} text={c.text} durationInFrames={frames} position={c.position} />
        </Sequence>
      );
    })}
    {ve !== 1 ? <Badge id="ve-label" text={`Heights exaggerated ×${ve}`} top={SAFE.y + 44} /> : null}
  </>
);

/** Logs the overlays actually visible after each commit, with their boxes and line counts, for the render checks. */
export const OverlayLog: React.FC = () => {
  const frame = useCurrentFrame();
  useLayoutEffect(() => {
    const opacity = (el: Element | null) => {
      let o = 1;
      for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
      return o;
    };
    const visible = Array.from(document.querySelectorAll("[data-overlay]")).filter((el) => el.getBoundingClientRect().width > 0 && opacity(el) >= 0.9);
    console.log(`OVERLAYS ${JSON.stringify(visible.map((el) => el.getAttribute("data-overlay")))}`);
    const rects = visible.map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const inner = r.height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
      // right and bottom from the unrounded box: a box ending exactly at the safe edge must not read 1 px past it
      return { id: el.getAttribute("data-overlay"), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom), lines: Math.round(inner / parseFloat(s.lineHeight)) };
    });
    console.log(`OVERLAY_RECTS ${JSON.stringify(rects)}`);
  }, [frame]);
  return null;
};
