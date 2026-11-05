// The social cuts' sidecar files: subtitles in SRT (Welsh, English, and both, Welsh first) timed exactly as the burnt-in
// captions, and the text to post with each upload. The captions are in the picture already, so the video reads with
// the sound off; the SRT files let a platform offer them as selectable tracks too.
import { captionRuns, END_CARD, LINES, POST_TEXT, POST_TITLES, SOCIAL_FPS, cutFrames, type Cut, type Line } from "../data/social-cuts";

export type Lang = "cy" | "en" | "cy-en";

const stamp = (frame: number): string => {
  const ms = Math.round((frame / SOCIAL_FPS) * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const one = (l: Line, lang: Lang) => (lang === "cy" ? l.cy : lang === "en" ? l.en : `${l.cy}\n${l.en}`);

/** The cut's captions as cues: each caption until the end card, then the end card's title and invitation. */
export function cues(cut: Cut): { from: number; to: number; line: Line }[] {
  const end = cutFrames(cut) - cut.endCard;
  const out = captionRuns(cut, "line")
    .filter((r) => r.from < end)
    .map((r) => ({ from: r.from, to: Math.min(r.to, end), line: LINES[r.id as keyof typeof LINES] as Line }));
  out.push({ from: end, to: cutFrames(cut), line: { cy: `${END_CARD.title.cy}\n${END_CARD.invite.cy}`, en: `${END_CARD.title.en}\n${END_CARD.invite.en}` } });
  return out;
}

/** SRT text: single lines joined where a caption breaks for the picture's layout, so each language reads as a sentence. */
export function srt(cut: Cut, lang: Lang): string {
  const flat = (l: Line): Line => ({ cy: l.cy.replace(/:\n/g, ": ").replace(/\n/g, lang === "cy-en" ? " " : "\n"), en: l.en.replace(/:\n/g, ": ").replace(/\n/g, lang === "cy-en" ? " " : "\n") });
  return cues(cut)
    .map((c, i) => `${i + 1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${one(flat(c.line), lang)}\n`)
    .join("\n");
}

/** The text to paste with the upload: title, post text and credits, each Welsh first. */
export function postText(cut: Cut): string {
  const t = POST_TITLES[cut.id];
  return [`${t.cy}\n${t.en}`, `${POST_TEXT.cy}\n\n${POST_TEXT.en}`, `${END_CARD.credits.cy}\n${END_CARD.credits.en}`].join("\n\n") + "\n";
}
