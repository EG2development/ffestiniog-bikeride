// One social cut (src/data/social-cuts.ts): its plates cut back to back, frame for frame as Blender rendered them (no
// scaling: each plate is rendered at the composition's own size), with Welsh-first captions, the concept badge, notes
// on proposed and existing street furniture, the end card and the soundtrack. Text keeps to the format's safe area,
// clear of the platforms' own buttons and captions.
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BADGE, captionRuns, CUTS, END_CARD, FORMATS, LINES, NOTES, plateById, type Cut, type CutId, type Format, type FormatId, type Line } from "../data/social-cuts";

const FONT = "'Segoe UI', system-ui, sans-serif";
const FADE = 8;
const INK = { cy: "#FFF8EA", en: "#E6EDEF", box: "rgba(18, 22, 20, 0.62)", accent: "#8FBF6A", badge: "rgba(246, 241, 228, 0.92)", badgeInk: "#2C2A26" };
/** Type sizes per format: the Welsh a little larger and bolder, both readable at a phone's size. */
const TYPE: Record<FormatId, { cy: number; en: number; badge: number; note: number; title: number; credit: number }> = {
  vertical: { cy: 56, en: 44, badge: 24, note: 24, title: 70, credit: 20 },
  feed: { cy: 62, en: 50, badge: 26, note: 26, title: 76, credit: 22 },
  landscape: { cy: 50, en: 40, badge: 22, note: 22, title: 64, credit: 18 },
};

const pad4 = (n: number) => String(n).padStart(4, "0");

/** A plate's frame: render_social.py names the PNGs by the scene's Blender frame (the scene's frame + 1). */
const PlateFrame: React.FC<{ format: FormatId; plate: string; at: number }> = ({ format, plate, at }) => {
  const frame = useCurrentFrame();
  const p = plateById(plate);
  return <Img src={staticFile(`plates/${format}/${plate}/${pad4(p.from + at + frame + 1)}.png`)} style={{ width: "100%", height: "100%", display: "block" }} />;
};

const fadeOf = (frame: number, len: number, last: boolean) =>
  interpolate(frame, [0, FADE, len - FADE, len], [0, 1, 1, last ? 1 : 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const TwoLanguages: React.FC<{ line: Line; t: (typeof TYPE)[FormatId]; size?: "title" }> = ({ line, t, size }) => {
  const cy = size === "title" ? t.title : t.cy;
  const en = size === "title" ? Math.round(t.title * 0.8) : t.en;
  const lines = (s: string) => s.split("\n").map((l, i) => <div key={i}>{l}</div>);
  return (
    <>
      <div lang="cy" style={{ fontSize: cy, fontWeight: 700, color: INK.cy, lineHeight: 1.12, textWrap: "balance" }}>{lines(line.cy)}</div>
      <div lang="en-GB" style={{ fontSize: en, fontWeight: 400, color: INK.en, lineHeight: 1.18, marginTop: Math.round(cy * 0.22), textWrap: "balance" }}>{lines(line.en)}</div>
    </>
  );
};

const Caption: React.FC<{ line: Line; len: number; last: boolean; f: Format; t: (typeof TYPE)[FormatId]; top: number }> = ({ line, len, last, f, t, top }) => {
  const frame = useCurrentFrame();
  const o = fadeOf(frame, len, last);
  const rise = interpolate(frame, [0, FADE * 2], [14, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: top + rise, left: f.safe.left, maxWidth: f.w - f.safe.left - f.safe.right, opacity: o, fontFamily: FONT, background: INK.box, borderLeft: `6px solid ${INK.accent}`, borderRadius: 10, padding: "18px 26px 20px", textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}>
      <TwoLanguages line={line} t={t} />
    </div>
  );
};

const Badge: React.FC<{ f: Format; t: (typeof TYPE)[FormatId] }> = ({ f, t }) => (
  <div style={{ position: "absolute", top: f.safe.top, left: f.safe.left, fontFamily: FONT, fontSize: t.badge, lineHeight: 1.25, color: INK.badgeInk, background: INK.badge, borderRadius: 8, padding: "7px 14px" }}>
    <div lang="cy" style={{ fontWeight: 600 }}>{BADGE.cy}</div>
    <div lang="en-GB">{BADGE.en}</div>
  </div>
);

const Note: React.FC<{ line: Line; len: number; f: Format; t: (typeof TYPE)[FormatId]; top: number }> = ({ line, len, f, t, top }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top, left: f.safe.left, opacity: fadeOf(frame, len, false), fontFamily: FONT, fontSize: t.note, lineHeight: 1.25, color: INK.en, background: INK.box, borderRadius: 8, padding: "6px 14px" }}>
      <div lang="cy" style={{ fontWeight: 600, color: INK.cy }}>{line.cy}</div>
      <div lang="en-GB">{line.en}</div>
    </div>
  );
};

/** The end card: the film's closing line, the places, the invitation, and the credits in small type. */
const EndCard: React.FC<{ f: Format; t: (typeof TYPE)[FormatId]; top: number }> = ({ f, t, top }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const later = interpolate(frame, [20, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const width = f.w - f.safe.left - f.safe.right;
  const small = { fontFamily: FONT, fontSize: t.credit, lineHeight: 1.3, color: INK.en };
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,14,12,0.72) 0%, rgba(10,14,12,0.55) 55%, rgba(10,14,12,0.35) 100%)" }} />
      <div style={{ position: "absolute", top, left: f.safe.left, width, fontFamily: FONT, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
        <TwoLanguages line={END_CARD.title} t={t} size="title" />
        <div style={{ opacity: later, marginTop: Math.round(t.title * 0.5) }}>
          <div style={{ width: 90, height: 5, background: INK.accent, borderRadius: 3, marginBottom: Math.round(t.cy * 0.45) }} />
          <div style={{ fontSize: t.en, fontWeight: 600, color: INK.cy, lineHeight: 1.2, textWrap: "balance" }}>{END_CARD.places}</div>
          <div style={{ marginTop: Math.round(t.en * 0.5) }}>
            <TwoLanguages line={END_CARD.invite} t={{ ...t, cy: t.en, en: Math.round(t.en * 0.85) }} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: f.safe.bottom, left: f.safe.left, width, opacity: later, ...small }}>
        <div lang="cy">{END_CARD.credits.cy}</div>
        <div lang="en-GB" style={{ marginTop: 6 }}>{END_CARD.credits.en}</div>
      </div>
    </AbsoluteFill>
  );
};

export const SocialCutView: React.FC<{ cut: Cut }> = ({ cut }) => {
  const { durationInFrames } = useVideoConfig();
  const f = FORMATS[cut.format];
  const t = TYPE[cut.format];
  const badgeH = Math.round(t.badge * 1.25 * 2 + 14);
  const captionTop = f.safe.top + badgeH + 22;
  const endFrom = durationInFrames - cut.endCard;
  let at = 0;
  const shots = cut.shots.map((sh, i) => {
    const from = at;
    at += sh.frames;
    return (
      <Sequence key={i} from={from} durationInFrames={sh.frames} name={`${sh.plate}${sh.at ? ` +${sh.at}` : ""}`}>
        <PlateFrame format={cut.format} plate={sh.plate} at={sh.at ?? 0} />
      </Sequence>
    );
  });
  return (
    <AbsoluteFill style={{ background: "#101412" }}>
      {shots}
      {captionRuns(cut, "line").map((r) => (
        <Sequence key={`c-${r.from}`} from={r.from} durationInFrames={Math.min(r.to, endFrom) - r.from} name={`caption ${r.id}`}>
          <Caption line={LINES[r.id as keyof typeof LINES]} len={Math.min(r.to, endFrom) - r.from} last={false} f={f} t={t} top={captionTop} />
        </Sequence>
      ))}
      {captionRuns(cut, "note").map((r) => (
        <Sequence key={`n-${r.from}`} from={r.from} durationInFrames={Math.min(r.to, endFrom) - r.from} name={`note ${r.id}`}>
          <Note line={NOTES[r.id as keyof typeof NOTES]} len={Math.min(r.to, endFrom) - r.from} f={f} t={t} top={f.h - f.safe.bottom - Math.round(t.note * 1.25 * 2 + 12)} />
        </Sequence>
      ))}
      <Sequence from={endFrom} name="end card">
        <EndCard f={f} t={t} top={captionTop} />
      </Sequence>
      <Badge f={f} t={t} />
      <Audio src={staticFile(`audio/${cut.id}.wav`)} />
    </AbsoluteFill>
  );
};

const SocialCut: React.FC<{ cut: CutId }> = ({ cut }) => <SocialCutView cut={CUTS.find((c) => c.id === cut)!} />;
export default SocialCut;
