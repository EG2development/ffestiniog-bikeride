#!/usr/bin/env node
// Encodes the community film from its rendered frames and soundtrack (review 2026-11-05), then probes the result:
//   node scripts/film/encode.mjs [--frames out/blender/frames/community-v9] [--audio out/blender/reel/community-v9.wav]
//                                [--out out/blender/reel/community-1080p-v9.mp4] [--frames-expected 5400]
// The frames are scripts/blender/render_film.py's PNGs (f_0001.png ...), checked complete and non-empty first. The
// encode is the social cuts' delivery preset at 1080p: H.264 High, CRF 16 (x264 slow), 4:2:0, BT.709 tagged, a closed
// GOP of half the frame rate with two B-frames, AAC 320 kbps at 48 kHz, Fast Start.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const root = process.cwd();
const frames = resolve(root, arg("frames", "out/blender/frames/community-v9"));
const audio = resolve(root, arg("audio", "out/blender/reel/community-v9.wav"));
const out = resolve(root, arg("out", "out/blender/reel/community-1080p-v9.mp4"));
const expected = Number(arg("frames-expected", "5400"));
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";

const pngs = readdirSync(frames).filter((f) => /^f_\d{4}\.png$/.test(f)).sort();
const missing = [];
for (let i = 1; i <= expected; i++) {
  const f = `f_${String(i).padStart(4, "0")}.png`;
  if (!pngs.includes(f) || statSync(resolve(frames, f)).size === 0) missing.push(f);
}
if (missing.length) throw new Error(`${missing.length} frames missing or empty, e.g. ${missing[0]}`);
if (!existsSync(audio)) throw new Error(`soundtrack missing: ${audio} (npm run film:audio)`);

const args = [
  "-y", "-v", "error", "-stats",
  "-framerate", "30", "-i", resolve(frames, "f_%04d.png"), "-i", audio,
  // the PNGs are tagged sRGB; convert with the BT.709 matrix and tag the frames themselves, or ffmpeg 9 lets the
  // input's transfer tag override the output options below
  "-vf", "scale=out_color_matrix=bt709:out_range=tv,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709",
  "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-pix_fmt", "yuv420p",
  "-g", "15", "-keyint_min", "15", "-bf", "2", "-maxrate", "40M", "-bufsize", "80M",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
  "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2",
  "-shortest", "-movflags", "+faststart", out,
];
console.log(`encoding ${pngs.length} frames + ${audio} -> ${out}`);
const r = spawnSync(FFMPEG, args, { stdio: "inherit" });
if (r.status !== 0) throw new Error(`ffmpeg failed (${r.status})`);

const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,profile,width,height,r_frame_rate,nb_frames,bit_rate,pix_fmt,color_space,sample_rate,channels:format=duration,size", "-of", "default=nw=1", out], { encoding: "utf8" });
console.log(probe.stdout);
const loud = spawnSync(FFMPEG, ["-v", "info", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
const tail = loud.stderr.split("\n").filter((l) => /I:|LRA:|Peak:/.test(l)).slice(-3).join("\n");
console.log(tail);
// frozen or black stretches would mean a missing or placeholder frame got through
const still = spawnSync(FFMPEG, ["-v", "info", "-i", out, "-vf", "freezedetect=n=0.001:d=1,blackdetect=d=0.5:pix_th=0.05", "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
const freezes = (still.stderr.match(/freeze_start/g) ?? []).length;
const blacks = (still.stderr.match(/black_start/g) ?? []).length;
console.log(`frozen stretches (>= 1 s): ${freezes}; black stretches (>= 0.5 s): ${blacks}`);
