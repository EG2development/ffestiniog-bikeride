// Renders the social cuts (src/social/SocialCut.tsx) to out/social/exports with each format's export preset
// (EXPORT_PRESETS in src/data/social-cuts.ts), and writes each cut's subtitles (Welsh, English, both) and post text.
//   npm run social:render [-- --cut teaser] [--concurrency 6] [--frames 0-59]
// --frames renders only that range of each cut, as a preview (<name>.preview.mp4), checking only the frames it needs.
// It needs the plates (npm run social:plates) and the soundtracks (npm run social:audio) in out/social/public.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CUTS, cutFrames, EXPORT_PRESETS, FORMATS, plateById, type Cut } from "../../src/data/social-cuts";
import { postText, srt } from "../../src/social/subtitles";

const root = process.cwd();
const pub = resolve(root, "out/social/public");
const outDir = resolve(root, "out/social/exports");
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/** Every PNG and the soundtrack a cut reads, present and not a placeholder left by an interrupted render. */
const range = arg("frames")?.split("-").map(Number) as [number, number] | undefined;
function missing(cut: Cut): string[] {
  const gaps: string[] = [];
  let at = 0;
  for (const sh of cut.shots) {
    const p = plateById(sh.plate);
    for (let f = 0; f < sh.frames; f++, at++) {
      if (range && (at < range[0] || at > range[1])) continue;
      const file = resolve(pub, `plates/${cut.format}/${sh.plate}/${String(p.from + (sh.at ?? 0) + f + 1).padStart(4, "0")}.png`);
      if (!existsSync(file) || statSync(file).size === 0) gaps.push(file);
    }
  }
  if (!existsSync(resolve(pub, `audio/${cut.id}.wav`))) gaps.push(`audio/${cut.id}.wav`);
  return gaps;
}

const exportName = (cut: Cut) => `ffestiniog-${cut.id}-${Math.round(cutFrames(cut) / 30)}s-${FORMATS[cut.format].w}x${FORMATS[cut.format].h}`;

const only = arg("cut");
const cuts = CUTS.filter((c) => !only || c.id === only);
if (!cuts.length) throw new Error(`no cut ${only}`);
for (const cut of cuts) {
  const gaps = missing(cut);
  if (gaps.length) throw new Error(`${cut.id}: ${gaps.length} inputs missing or empty, e.g. ${gaps[0]}`);
}
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve(root, "src/index.ts"), publicDir: pub });
for (const cut of cuts) {
  const id = `Social-${cut.id}`;
  const composition = await selectComposition({ serveUrl, id, inputProps: { cut: cut.id } });
  const preset = EXPORT_PRESETS[cut.format];
  const name = exportName(cut) + (range ? ".preview" : "");
  let shown = -1;
  await renderMedia({
    serveUrl,
    composition,
    inputProps: { cut: cut.id },
    codec: "h264",
    crf: preset.crf,
    x264Preset: "slow",
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    imageFormat: "png", // lossless frames from the browser to the encoder
    gopSize: 15, // YouTube's closed GOP of half the frame rate
    // and its two consecutive B-frames (x264's slow preset uses three): set before the output file, the last argument
    ffmpegOverride: ({ type, args }) => (type === "stitcher" || type === "pre-stitcher" ? [...args.slice(0, -1), "-bf", "2", ...args.slice(-1)] : args),
    encodingMaxRate: `${preset.maxBitrateMbps}M`,
    encodingBufferSize: `${preset.maxBitrateMbps * 2}M`,
    audioCodec: "aac",
    audioBitrate: "320k",
    sampleRate: 48000,
    enforceAudioTrack: true,
    concurrency: Number(arg("concurrency") ?? 6),
    ...(range && { frameRange: range }),
    outputLocation: resolve(outDir, `${name}.mp4`),
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== shown) console.log(`${cut.id}: ${(shown = pct)} %`);
    },
  });
  if (range) continue;
  for (const lang of ["cy", "en", "cy-en"] as const) writeFileSync(resolve(outDir, `${name}.${lang}.srt`), srt(cut, lang), "utf8");
  writeFileSync(resolve(outDir, `${name}.post.txt`), postText(cut), "utf8");
  console.log(`rendered ${name}.mp4`);
}
