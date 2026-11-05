#!/usr/bin/env node
// Checks the social cuts' exports (out/social/exports) as they will be uploaded, and writes out/social/qa/report.md
// and report.json with contact sheets and preview frames per cut:
// - the stream: resolution, frame rate, frame count, codec and profile, 4:2:0, BT.709 tags, bitrate, size, Fast Start;
// - the sound: AAC at 48 kHz in stereo, integrated loudness and true peak (EBU R128), as long as the picture, and in
//   sync with its soundtrack (the lag at the peak of their cross-correlation);
// - the picture: no frozen or black stretches, and each shot's middle frame against its source plate (SSIM and PSNR
//   over a band below the captions and above the notes, where only the picture is), so the encode is shown not to soften it.
//   npm run social:qa
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const exportsDir = resolve(root, "out/social/exports");
const qaDir = resolve(root, "out/social/qa");
const plan = JSON.parse(readFileSync(resolve(root, "out/social/plan.json"), "utf8"));
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")}: ${r.stderr?.slice(-400)}`);
  return r;
};

/** The order of the MP4's top-level boxes: Fast Start puts moov before mdat. */
function topBoxes(file) {
  const fd = openSync(file, "r");
  const size = statSync(file).size;
  const boxes = [];
  const head = Buffer.alloc(16);
  for (let at = 0; at < size && boxes.length < 32; ) {
    readSync(fd, head, 0, 16, at);
    let len = head.readUInt32BE(0);
    const type = head.toString("latin1", 4, 8);
    if (len === 1) len = Number(head.readBigUInt64BE(8));
    if (len === 0) len = size - at;
    boxes.push(type);
    at += len;
  }
  closeSync(fd);
  return boxes;
}

/** The export's sound against its soundtrack: the lag (ms, positive when the export is late) at the peak of their
 * cross-correlation over the first 10 s at 8 kHz mono, within ±50 ms, and the correlation there (1 when identical). */
function audioSync(file, wav) {
  const decode = (src) => {
    const r = spawnSync(FFMPEG, ["-v", "error", "-i", src, "-t", "10", "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], { maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error(`decode ${src}: ${r.stderr?.toString().slice(-200)}`);
    const bytes = new Uint8Array(r.stdout); // a fresh, aligned buffer
    return new Float32Array(bytes.buffer, 0, bytes.length >> 2);
  };
  const a = decode(file), b = decode(wav);
  const max = 400;
  const n = Math.min(a.length, b.length) - max;
  const norm = (x) => Math.sqrt(x.slice(0, n).reduce((s, v) => s + v * v, 0));
  const scale = norm(a) * norm(b);
  let best = { lag: 0, r: -1 };
  for (let lag = -max; lag <= max; lag++) {
    const oa = Math.max(0, lag), ob = Math.max(0, -lag);
    let s = 0;
    for (let i = 0; i < n; i++) s += a[i + oa] * b[i + ob];
    if (s / scale > best.r) best = { lag, r: s / scale };
  }
  return { lagMs: +(best.lag / 8).toFixed(2), correlation: +Math.min(1, best.r).toFixed(3) };
}

function check(file, cut) {
  const probe = JSON.parse(run(FFPROBE, ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", file]).stdout);
  const v = probe.streams.find((s) => s.codec_type === "video");
  const a = probe.streams.find((s) => s.codec_type === "audio");
  const fmt = plan.formats[cut.format];
  const loud = run(FFMPEG, ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
  const freeze = run(FFMPEG, ["-hide_banner", "-i", file, "-vf", "freezedetect=n=0.001:d=1.5", "-an", "-f", "null", "-"]).stderr;
  const black = run(FFMPEG, ["-hide_banner", "-i", file, "-vf", "blackdetect=d=0.3:pix_th=0.08", "-an", "-f", "null", "-"]).stderr;
  const boxes = topBoxes(file);
  const out = resolve(qaDir, cut.id);
  mkdirSync(out, { recursive: true });
  // a contact sheet, a frame a second
  const cols = cut.format === "landscape" ? 6 : 10;
  const tw = cut.format === "landscape" ? 320 : 216;
  const rows = Math.ceil(cut.frames / 30 / cols);
  run(FFMPEG, ["-v", "error", "-y", "-i", file, "-vf", `fps=1,scale=${tw}:-2,tile=${cols}x${rows}`, "-frames:v", "1", resolve(out, "contact-sheet.png")]);
  // each shot's middle frame, full size, and its match with the plate below the captions
  const band = { y: Math.round(fmt.h * 0.5), h: Math.round(fmt.h * 0.14) };
  const shots = [];
  let at = 0;
  for (const [i, sh] of cut.shots.entries()) {
    const mid = at + Math.floor(sh.frames / 2);
    const still = resolve(out, `shot-${String(i + 1).padStart(2, "0")}-${sh.plate}.png`);
    run(FFMPEG, ["-v", "error", "-y", "-i", file, "-vf", `select=eq(n\\,${mid})`, "-fps_mode", "vfr", "-frames:v", "1", still]);
    const plate = resolve(root, `out/social/public/plates/${cut.format}/${sh.plate}/${String(sh.first + Math.floor(sh.frames / 2)).padStart(4, "0")}.png`);
    let ssim = null, psnr = null;
    if (mid < cut.frames - cut.endCard && existsSync(plate)) {
      const crop = `crop=${fmt.w}:${band.h}:0:${band.y}`;
      const r = run(FFMPEG, ["-hide_banner", "-i", still, "-i", plate, "-lavfi", `[0]${crop},format=yuv420p[a];[1]${crop},format=yuv420p[b];[a][b]ssim;[0]${crop},format=yuv420p[c];[1]${crop},format=yuv420p[d];[c][d]psnr`, "-f", "null", "-"]).stderr;
      ssim = Number((r.match(/All:([\d.]+)/) ?? [])[1]);
      psnr = Number((r.match(/average:([\d.inf]+)/) ?? [])[1]);
    }
    shots.push({ plate: sh.plate, frame: mid, ssim, psnr });
    at += sh.frames;
  }
  const [fn, fd] = v.r_frame_rate.split("/").map(Number);
  const result = {
    cut: cut.id,
    file: file.slice(root.length + 1).replace(/\\/g, "/"),
    sizeMB: +(Number(probe.format.size) / 2 ** 20).toFixed(1),
    durationS: +Number(probe.format.duration).toFixed(3),
    video: { w: v.width, h: v.height, fps: fn / fd, frames: Number(v.nb_read_frames), codec: `${v.codec_name} ${v.profile}`, pix: v.pix_fmt, color: `${v.color_space}/${v.color_primaries}/${v.color_transfer}`, mbps: +(Number(v.bit_rate) / 1e6).toFixed(1) },
    audio: a ? { codec: `${a.codec_name} ${a.profile ?? ""}`.trim(), hz: Number(a.sample_rate), channels: a.channels, kbps: Math.round(Number(a.bit_rate) / 1000), durationS: +Number(a.duration).toFixed(3) } : null,
    sync: a ? audioSync(file, resolve(root, `out/social/public/audio/${cut.id}.wav`)) : null,
    // the summary at the end of ebur128's output, not its running values
    loudness: (() => {
      const sum = loud.slice(loud.lastIndexOf("Summary"));
      const n = (re) => Number((sum.match(re) ?? [])[1]);
      return { lufs: n(/I:\s+(-?[\d.]+) LUFS/), truePeak: n(/Peak:\s+(-?[\d.]+) dBFS/), lra: n(/LRA:\s+([\d.]+) LU/) };
    })(),
    fastStart: boxes.indexOf("moov") >= 0 && boxes.indexOf("moov") < boxes.indexOf("mdat"),
    freezes: (freeze.match(/freeze_start/g) ?? []).length,
    blacks: (black.match(/black_start/g) ?? []).length,
    shots,
  };
  const issues = [];
  if (result.video.w !== fmt.w || result.video.h !== fmt.h) issues.push(`size ${result.video.w}x${result.video.h}, not ${fmt.w}x${fmt.h}`);
  if (result.video.fps !== plan.fps || result.video.frames !== cut.frames) issues.push(`${result.video.frames} frames at ${result.video.fps} fps, not ${cut.frames} at ${plan.fps}`);
  if (!/h264 High/.test(result.video.codec) || result.video.pix !== "yuv420p") issues.push(`${result.video.codec} ${result.video.pix}`);
  if (result.video.color !== "bt709/bt709/bt709") issues.push(`colour tags ${result.video.color}`);
  if (!result.audio || result.audio.hz !== 48000 || result.audio.channels !== 2 || !/aac/.test(result.audio.codec)) issues.push(`audio ${JSON.stringify(result.audio)}`);
  if (result.audio && Math.abs(result.audio.durationS - Number(v.duration)) > 0.05) issues.push(`audio ${result.audio.durationS} s against video ${Number(v.duration).toFixed(3)} s`);
  if (result.sync && (Math.abs(result.sync.lagMs) > 5 || result.sync.correlation < 0.9)) issues.push(`sound ${result.sync.lagMs} ms off its soundtrack (correlation ${result.sync.correlation})`);
  if (Math.abs(result.loudness.lufs + 14) > 1 || result.loudness.truePeak > -1) issues.push(`loudness ${result.loudness.lufs} LUFS, peak ${result.loudness.truePeak}`);
  if (!result.fastStart) issues.push(`no Fast Start (${boxes.join(" ")})`);
  if (result.freezes || result.blacks) issues.push(`${result.freezes} freezes, ${result.blacks} black stretches`);
  for (const s of shots) if (s.ssim !== null && s.ssim < 0.97) issues.push(`${s.plate} SSIM ${s.ssim}`);
  result.issues = issues;
  return result;
}

mkdirSync(qaDir, { recursive: true });
const files = readdirSync(exportsDir).filter((f) => f.endsWith(".mp4"));
const results = [];
for (const cut of plan.cuts) {
  const f = files.find((n) => n.startsWith(`ffestiniog-${cut.id}-`));
  if (!f) {
    results.push({ cut: cut.id, issues: ["not rendered"] });
    continue;
  }
  results.push(check(resolve(exportsDir, f), cut));
  console.log(`${cut.id}: ${results.at(-1).issues.length ? results.at(-1).issues.join("; ") : "ok"}`);
}
writeFileSync(resolve(qaDir, "report.json"), JSON.stringify(results, null, 1));
const rows = results.filter((r) => r.video).map((r) => {
  const ss = r.shots.filter((s) => s.ssim !== null);
  const minSsim = Math.min(...ss.map((s) => s.ssim)).toFixed(4);
  const minPsnr = Math.min(...ss.map((s) => s.psnr)).toFixed(1);
  return `| ${r.cut} | ${r.video.w}×${r.video.h} | ${r.video.fps} fps, ${r.video.frames} frames, ${r.durationS} s | ${r.video.codec}, ${r.video.pix}, ${r.video.color} | ${r.video.mbps} Mbps | ${r.audio?.codec} ${r.audio?.hz / 1000} kHz ${r.audio?.channels} ch ${r.audio?.kbps} kbps | ${r.loudness.lufs} LUFS, ${r.loudness.truePeak} dBTP | ${r.sync ? `${r.sync.lagMs} ms, r ${r.sync.correlation}` : "-"} | ${r.sizeMB} MB | ${r.fastStart ? "yes" : "no"} | ${r.freezes}/${r.blacks} | ${minSsim} / ${minPsnr} dB | ${r.issues.length ? r.issues.join("; ") : "ok"} |`;
});
writeFileSync(
  resolve(qaDir, "report.md"),
  ["# Social cuts: quality report", "", "| Cut | Size | Frames | Video | Bitrate | Audio | Loudness | Sync | File | Fast Start | Freezes/blacks | Worst shot vs plate (SSIM / PSNR) | Result |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|", ...rows, ""].join("\n"),
);
console.log(`wrote ${resolve(qaDir, "report.md")}`);
