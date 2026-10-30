#!/usr/bin/env node
// Iteration 2: mask metrics (docs/adr/0044-mask-renders-for-measurement.md); budgets after each track (docs/adr/0052-budgets-remeasured-trees-first.md);
// fresh-process stills and tile counts (spec RD1, RD2, RD6); overlay boxes (CL9, CL10); X1, X2 (docs/pseudocode-reel-v2.md §3.4, §4.3, §6).
// Reel: measurements per section and at the cuts (docs/adr/0039-performance-per-section-and-cuts.md).
// Render checks for the spec's R criteria (docs/pseudocode-3d.md §4.3).
//   node scripts/render-checks.mjs                     run every check; exit 1 on any failure
//   node scripts/render-checks.mjs --capture-baselines record the RG1 baselines (do this only before
//                                                      3D code lands, or with reviewer sign-off)
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { snapshot, environment } from "./snapshot.mjs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = process.env.REMOTION_PORT ?? "3517";
const OUT = join(tmpdir(), "render-checks");
const BASELINES = resolve(ROOT, "tests/baselines/cyclingvision.json");
const RG1_FRAMES = [5, 1200, 2200, 2900];
const POC = "Poc3DMaentwrog";
// 3D video encodes on the GPU (VideoToolbox where present, else software); the 2D video keeps software encoding,
// whose decoded md5 is its baseline (docs/adr/0053-gpu-encoding-for-3d-renders.md)
const GPU_ENCODE = ["--hardware-acceleration=if-possible", "--video-bitrate=10M"];
mkdirSync(OUT, { recursive: true });

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const remotion = (args) =>
  execFileSync("npx", ["remotion", ...args, `--port=${PORT}`, "--overwrite"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const still = (comp, frame, file, extra = []) => {
  const log = remotion(["still", "src/index.ts", comp, file, `--frame=${frame}`, ...extra]);
  return { file, log };
};

if (process.argv.includes("--capture-baselines")) {
  const hashes = {};
  for (const f of RG1_FRAMES) hashes[f] = sha256(still("CyclingVision", f, join(OUT, `cv_${f}.png`)).file);
  writeFileSync(BASELINES, JSON.stringify({ capturedAt: new Date().toISOString(), machine: process.platform + "-" + process.arch, gl: "default", frames: hashes }, null, 2) + "\n");
  console.log(`wrote ${BASELINES}`);
  process.exit(0);
}

const results = [];
const check = async (id, fn) => {
  try {
    const detail = await fn();
    results.push({ id, ok: true, detail: detail ?? "" });
  } catch (e) {
    const stderr = e.stderr ? String(e.stderr) : "";
    const lines = stderr
      .split("\n")
      .map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").trim())
      .filter((l) => l !== "" && !l.startsWith("[chrome]"));
    const cause = lines.find((l) => /Error:/.test(l)) ?? lines.find((l) => /error|could not|not found|exception/i.test(l));
    results.push({ id, ok: false, detail: cause ?? String(e.message ?? e).split("\n")[0] });
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// Logs gathered by the diagnostics stills, checked once at the end (CL9, CL10, RD6).
const rects = [];
const drapeLines = [];
let reelLog = "";
const collectRects = (where, texts) => {
  const m = texts.map((t) => /OVERLAY_RECTS (\[.*\])/.exec(t)).filter(Boolean).pop();
  if (m) for (const r of JSON.parse(m[1])) rects.push({ where, ...r });
};

await check("RG1 CyclingVision unchanged", () => {
  const base = JSON.parse(readFileSync(BASELINES, "utf8")).frames;
  for (const f of RG1_FRAMES) assert(sha256(still("CyclingVision", f, join(OUT, `cv_${f}.png`)).file) === base[f], `frame ${f} differs from baseline`);
  return `${RG1_FRAMES.length} frames match`;
});

await check("RN2 POC deterministic", () => {
  for (const f of [0, 180, 359]) {
    const a = sha256(still(POC, f, join(OUT, `poc_${f}_a.png`), ["--gl=angle"]).file);
    const b = sha256(still(POC, f, join(OUT, `poc_${f}_b.png`), ["--gl=angle"]).file);
    assert(a === b, `frame ${f} differs between two renders`);
  }
  return "frames 0, 180, 359 identical";
});

await check("RN3/RN6 POC format and speed", () => {
  const file = join(OUT, "poc.mp4");
  const t0 = Date.now();
  const log = remotion(["render", "src/index.ts", POC, file, "--gl=angle", ...GPU_ENCODE, "--log=verbose"]);
  const secPerFrame = (Date.now() - t0) / 1000 / 360;
  // Remotion's own timeout message; its routine "handle was cleared ... if you experience a timeout" lines are not failures
  assert(!/was called but not cleared after/i.test(log), "a delayRender timed out");
  const probe = JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,avg_frame_rate,codec_name,nb_read_frames", "-of", "json", file], { encoding: "utf8" }),
  ).streams[0];
  assert(probe.width === 1920 && probe.height === 1080, `size ${probe.width}x${probe.height}`);
  assert(probe.avg_frame_rate === "30/1", `fps ${probe.avg_frame_rate}`);
  assert(probe.codec_name === "h264", `codec ${probe.codec_name}`);
  assert(Number(probe.nb_read_frames) === 360, `frames ${probe.nb_read_frames}`);
  assert(secPerFrame <= 2, `${secPerFrame.toFixed(2)} s per frame`);
  return `1920x1080 30fps h264 360 frames, ${secPerFrame.toFixed(2)} s/frame`;
});

// A tab's first frame was once captured before the canvas had drawn (t8 benchmark), so scan every
// frame of the full render: the canvas centre, clear of the overlays, never goes near black
// (clean renders: luma 50–95; a blank canvas: 16).
await check("RN5b no blank canvas in the full POC render", () => {
  const file = join(OUT, "poc.mp4");
  assert(existsSync(file), "no POC render (previous check failed)");
  const log = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", "crop=800:400:560:340,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"], { encoding: "utf8" });
  const luma = [...log.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  assert(luma.length === 360, `${luma.length} frames scanned`);
  const blank = luma.flatMap((y, i) => (y < 20 ? [i] : []));
  assert(blank.length === 0, `blank canvas at frames ${blank.join(", ")}`);
  return `360 frames, canvas-centre luma ${Math.min(...luma).toFixed(1)}–${Math.max(...luma).toFixed(1)}`;
});

// The CLI doesn't print the page's console output, so the diagnostics stills go through the Node API,
// whose onBrowserLog receives it (https://www.remotion.dev/docs/renderer/render-still#onbrowserlog).
await check("RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible", async () => {
  const serveUrl = await bundle({ entryPoint: resolve(ROOT, "src/index.ts"), rspack: true });
  const inputProps = { diagnostics: true };
  const chromiumOptions = { gl: "angle" };
  const port = Number(PORT);
  const composition = await selectComposition({ serveUrl, id: POC, inputProps, chromiumOptions, port });
  const last = (texts, re) => texts.map((t) => re.exec(t)).filter(Boolean).pop();
  const details = [];
  // overlays that must be visible (opacity ≥ 0.9) at these frames, beyond the disclaimer and attribution on every frame
  // the closing caption must be fully visible for the last 5 s (frames 210–359, spec H3)
  const expectAt = { 45: ["proposed-label", "section-title"], 210: ["closing"], 359: ["closing"] };
  for (const f of [0, 45, 180, 210, 359]) {
    const texts = [];
    await renderStill({
      serveUrl,
      composition,
      inputProps,
      chromiumOptions,
      port,
      frame: f,
      output: join(OUT, `poc_diag_${f}.png`),
      overwrite: true,
      onBrowserLog: (log) => texts.push(log.text),
    });
    const stats = last(texts, /THREE_STATS (\{.*\})/);
    const overlays = last(texts, /OVERLAYS (\[.*\])/);
    collectRects(`${POC}@${f}`, texts);
    assert(stats, `frame ${f}: no THREE_STATS line`);
    assert(overlays, `frame ${f}: no OVERLAYS line`);
    const s = JSON.parse(stats[1]);
    const o = JSON.parse(overlays[1]);
    assert(s.calls <= 300 && s.triangles <= 2_000_000, `frame ${f}: ${s.calls} calls, ${s.triangles} triangles`);
    assert(o.includes("disclaimer") && o.includes("attribution"), `frame ${f}: overlays ${o}`);
    for (const id of expectAt[f] ?? []) assert(o.includes(id), `frame ${f}: "${id}" not visible (overlays ${o})`);
    if (s.ve !== 1) assert(o.includes("ve-label"), `frame ${f}: vertical exaggeration ${s.ve} without a label`);
    details.push(`f${f}: ${s.calls} calls, ${s.triangles} tris`);
  }
  return details.join("; ");
});

// distinct 8-level colour bins in the lower half of a still: a blank or single-material canvas gives 1–3 (RN5b, RL10)
const colourBins = (file) =>
  Number(execFileSync("python3", ["-I", "-c", [
    "import sys", "from PIL import Image",
    "im=Image.open(sys.argv[1]).convert('RGB'); w,h=im.size",
    "px=list(im.crop((0,h//2,w,h)).getdata())",
    "q=set((r//8,g//8,b//8) for r,g,b in px)",
    "print(len(q))",
  ].join("\n"), file], { encoding: "utf8" }).trim());

await check("RN5b terrain drawn at frame 0", () => {
  const file = join(OUT, "poc_diag_0.png");
  assert(existsSync(file), "no frame-0 still (previous check failed)");
  const bins = colourBins(file);
  assert(bins >= 4, `only ${bins} distinct colours in the lower half`);
  return `${bins} distinct colour bins`;
});

// ---- The reel (ADR 39; spec RL1, RL17–RL24, RL26, RL27, RL32) ----
const REEL = "Reel3D";
const REEL_FRAMES = 2700;
// one frame inside each scene (clear of caption fades), and the last frame before each cut
const SCENE_FRAMES = { intro: 100, heritage: 350, overview: 600, blaenau: 900, "vale-north": 1200, "vale-south": 1500, maentwrog: 1750, trawsfynydd: 2050, closing: 2600 };
const BEFORE_CUT = [239, 479, 779, 1079, 1349, 1619, 1919, 2399];
const EXPECT_OVERLAY = { 100: "intro-title", 350: "heritage", 600: "overview-title", 900: "live-station", 1200: "vale-north-title", 1500: "vale-title", 1750: "private-home", 2050: "decommissioning", 2600: "concept-card" };

await check("RL1/RL24 reel format and speed", () => {
  const file = join(OUT, "reel.mp4");
  const t0 = Date.now();
  const log = remotion(["render", "src/index.ts", REEL, file, "--gl=angle", ...GPU_ENCODE, "--log=verbose"]);
  reelLog = log;
  const wall = (Date.now() - t0) / 1000;
  assert(!/was called but not cleared after/i.test(log), "a delayRender timed out");
  const probe = JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,avg_frame_rate,codec_name,nb_read_frames", "-of", "json", file], { encoding: "utf8" }),
  ).streams[0];
  assert(probe.width === 1920 && probe.height === 1080 && probe.avg_frame_rate === "30/1" && probe.codec_name === "h264", `${probe.width}x${probe.height} ${probe.avg_frame_rate} ${probe.codec_name}`);
  assert(Number(probe.nb_read_frames) === REEL_FRAMES, `frames ${probe.nb_read_frames}`);
  assert(wall / REEL_FRAMES <= 2 && wall <= 1800, `${(wall / REEL_FRAMES).toFixed(3)} s per frame, ${wall.toFixed(0)} s in all`);
  return `1920x1080 30fps h264 ${REEL_FRAMES} frames in ${wall.toFixed(0)} s (${(wall / REEL_FRAMES).toFixed(4)} s/frame)`;
});

await check("RL26/RL27 no blank canvas in the full reel", () => {
  const file = join(OUT, "reel.mp4");
  assert(existsSync(file), "no reel render (previous check failed)");
  const log = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", "crop=800:400:560:340,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"], { encoding: "utf8" });
  const luma = [...log.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  assert(luma.length === REEL_FRAMES, `${luma.length} frames scanned`);
  const blank = luma.flatMap((y, i) => (y < 20 ? [i] : []));
  assert(blank.length === 0, `blank canvas at frames ${blank.slice(0, 10).join(", ")}`);
  return `${REEL_FRAMES} frames, canvas-centre luma ${Math.min(...luma).toFixed(1)}–${Math.max(...luma).toFixed(1)}`;
});

await check("RL23 reel deterministic", () => {
  for (const f of [0, 1349, 2699]) {
    const a = sha256(still(REEL, f, join(OUT, `reel_${f}_a.png`), ["--gl=angle"]).file);
    const b = sha256(still(REEL, f, join(OUT, `reel_${f}_b.png`), ["--gl=angle"]).file);
    assert(a === b, `frame ${f} differs between two renders`);
  }
  return "frames 0, 1349, 2699 identical";
});

// Per scene and at the last frame before each cut (ADR 39). Each mounted canvas logs THREE_STATS twice per still
// (its first render and the frame), so the per-frame figure is the sum of the last half of the lines. In the photo look
// (the reel's since ADR 60) a line carries the scene pass's counts beside the whole frame's: the budget is the scene
// pass's, as the spec wrote it for one pass; the whole frame (both ambient-occlusion passes too) is recorded beside it.
let reelServeUrl = null;
await check("RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible", async () => {
  const serveUrl = await bundle({ entryPoint: resolve(ROOT, "src/index.ts"), rspack: true });
  reelServeUrl = serveUrl;
  const inputProps = { diagnostics: true };
  const chromiumOptions = { gl: "angle" };
  const port = Number(PORT);
  const composition = await selectComposition({ serveUrl, id: REEL, inputProps, chromiumOptions, port });
  const details = [];
  let worst = { f: -1, calls: 0, triangles: 0 };
  let wholeWorst = 0;
  for (const f of [...Object.values(SCENE_FRAMES), ...BEFORE_CUT, 0, 1349, 2699]) {
    const texts = [];
    await renderStill({ serveUrl, composition, inputProps, chromiumOptions, port, frame: f, output: join(OUT, `reel_diag_${f}.png`), overwrite: true, onBrowserLog: (log) => texts.push(log.text) });
    const stats = texts.map((t) => /THREE_STATS (\{.*\})/.exec(t)).filter(Boolean).map((m) => JSON.parse(m[1]));
    collectRects(`${REEL}@${f}`, texts);
    drapeLines.push(...texts.filter((t) => t.includes("MAP_DRAPE")));
    assert(stats.length > 0, `frame ${f}: no THREE_STATS line`);
    const lastHalf = stats.slice(-Math.max(1, Math.round(stats.length / 2)));
    const perFrame = lastHalf.reduce((a, s) => ({ calls: a.calls + (s.scenePass ?? s).calls, triangles: a.triangles + (s.scenePass ?? s).triangles }), { calls: 0, triangles: 0 });
    wholeWorst = Math.max(wholeWorst, lastHalf.reduce((a, s) => a + s.triangles, 0));
    assert(perFrame.calls <= 300 && perFrame.triangles <= 2_000_000, `frame ${f}: ${perFrame.calls} calls, ${perFrame.triangles} triangles`);
    if (perFrame.triangles > worst.triangles) worst = { f, ...perFrame };
    const overlays = texts.map((t) => /OVERLAYS (\[.*\])/.exec(t)).filter(Boolean).map((m) => JSON.parse(m[1])).pop() ?? [];
    assert(overlays.includes("disclaimer") && overlays.includes("attribution"), `frame ${f}: overlays ${JSON.stringify(overlays)}`);
    if (EXPECT_OVERLAY[f]) assert(overlays.includes(EXPECT_OVERLAY[f]), `frame ${f}: "${EXPECT_OVERLAY[f]}" not visible (overlays ${JSON.stringify(overlays)})`);
    if (BEFORE_CUT.includes(f)) details.push(`cut@${f + 1}: ${perFrame.calls}/${perFrame.triangles}`);
  }
  const scenes = Object.entries(SCENE_FRAMES).map(([id, f]) => `${id}@${f}`).join(", ");
  return `20 stills, 19 distinct frames, measured (${scenes}; cuts ${BEFORE_CUT.join("/")}); worst frame ${worst.f}: ${worst.calls} calls, ${worst.triangles} tris (scene pass); whole frame at most ${wholeWorst} tris; overlays visible`;
});

await check("RL10 terrain drawn in every scene still", () => {
  const details = [];
  for (const [id, f] of Object.entries(SCENE_FRAMES)) {
    const file = join(OUT, `reel_diag_${f}.png`);
    assert(existsSync(file), `no still for ${id} (previous check failed)`);
    const bins = colourBins(file);
    assert(bins >= 4, `${id}: only ${bins} distinct colours in the lower half`);
    details.push(`${id} ${bins}`);
  }
  return `colour bins in the lower half: ${details.join(", ")}`;
});

await check("RL32 one preview still per scene in out/previews", () => {
  const dir = resolve(ROOT, "out/previews");
  mkdirSync(dir, { recursive: true });
  for (const [id, f] of Object.entries(SCENE_FRAMES)) still(REEL, f, join(dir, `${id}.png`), ["--gl=angle"]);
  return `${Object.keys(SCENE_FRAMES).length} stills in out/previews/`;
});

// ---- Iteration 2 (docs/pseudocode-reel-v2.md §3.4, §4.3, §6) ----
await check("CL9/CL10 every overlay inside the title-safe area, at most 3 lines", () => {
  assert(rects.length > 0, "no OVERLAY_RECTS lines (diagnostics stills failed?)");
  // a line count that is not a number (an overlay without a numeric line-height) fails rather than passing silently (t10)
  const bad = rects.filter((r) => r.x < 96 || r.y < 54 || (r.right ?? r.x + r.w) > 1824 || (r.bottom ?? r.y + r.h) > 1026 || !(r.lines <= 3));
  assert(bad.length === 0, bad.slice(0, 3).map((r) => `${r.where} ${r.id} (${r.x},${r.y},${r.w}x${r.h}, ${r.lines} lines)`).join("; "));
  return `${rects.length} boxes at ${new Set(rects.map((r) => r.where)).size} frames, max ${Math.max(...rects.map((r) => r.lines))} lines`;
});

await check("RD6 no missing map tiles in the reel", async () => {
  const all = [...drapeLines, ...reelLog.split("\n").filter((l) => l.includes("MAP_DRAPE"))];
  // the photo reel draws no map tiles (ADR 60): the drape is the concept look's, so check it on a concept aerial still
  if (all.length === 0 && reelServeUrl) {
    const inputProps = { section: "overview", captions: "section", diagnostics: true, look: "concept" };
    const chromiumOptions = { gl: "angle" };
    const port = Number(PORT);
    const composition = await selectComposition({ serveUrl: reelServeUrl, id: "Section-overview", inputProps, chromiumOptions, port });
    await renderStill({ serveUrl: reelServeUrl, composition, inputProps, chromiumOptions, port, frame: 150, output: join(OUT, "rd6_concept_overview.png"), overwrite: true, onBrowserLog: (log) => log.text.includes("MAP_DRAPE") && all.push(log.text) });
  }
  assert(all.length > 0, "no MAP_DRAPE line seen: the drape log is not reaching the checks");
  const missing = all.map((l) => Number(/MAP_DRAPE missing (\d+)/.exec(l)?.[1] ?? NaN)).filter((n) => !(n === 0));
  assert(missing.length === 0, `missing tiles: ${missing.join(", ")}`);
  return `${all.length} MAP_DRAPE lines, all 0 missing`;
});

// distinct colour bins (as RL10) and the canvas centre's luma, for a fresh-process still
const centreLuma = (file) =>
  Number(execFileSync("python3", ["-I", "-c", "import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert('L').crop((560,340,1360,740))\nprint(sum(im.getdata())/(800*400))", file], { encoding: "utf8" }).trim());

await check("RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut", async () => {
  const dir = join(OUT, "rd-bundle");
  execFileSync("npx", ["remotion", "bundle", "src/index.ts", `--out-dir=${dir}`, "--log=error"], { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
  const comps = await getCompositions(dir, { port: Number(PORT) });
  const jobs = [];
  for (const c of comps.filter((c) => c.id.startsWith("Section-"))) for (const f of [0, Math.floor(c.durationInFrames / 2), c.durationInFrames - 1]) jobs.push([c.id, f]);
  for (const c of BEFORE_CUT) jobs.push([REEL, c], [REEL, c + 1]); // the reel's last frame of each scene and the first of the next (t10)
  const bad = [];
  for (const [id, f] of jobs) {
    const file = join(OUT, `rd_${id}_${f}.png`);
    execFileSync("npx", ["remotion", "still", dir, id, file, `--frame=${f}`, "--gl=angle", `--port=${PORT}`, "--overwrite", "--log=error"], { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
    const [luma, bins] = [centreLuma(file), colourBins(file)];
    if (luma < 20 || bins < 4) bad.push(`${id}@${f} luma ${luma.toFixed(1)} bins ${bins}`);
  }
  assert(bad.length === 0, bad.join("; "));
  return `${jobs.length} fresh stills (${comps.filter((c) => c.id.startsWith("Section-")).length} sections x 3, ${BEFORE_CUT.length} cuts x 2): centre luma >= 20, >= 4 colour bins`;
});

await check("X1 CyclingVision full render decodes to the pre-3D md5", () => {
  const file = join(OUT, "cv.mp4");
  remotion(["render", "src/index.ts", "CyclingVision", file]);
  const md5 = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-map", "0:v", "-f", "md5", "-"], { encoding: "utf8" }).trim().replace("MD5=", "");
  assert(md5 === "adfca9a7f31577885e4ec84c1aca3f53", `decoded md5 ${md5}`);
  return `decoded md5 ${md5}`;
});

await check("X2 visual baselines untouched", () => {
  // against HEAD, so a staged edit counts, and no new untracked file may appear beside them (t10)
  execFileSync("git", ["diff", "--quiet", "HEAD", "--", "tests/baselines"], { cwd: ROOT });
  const extra = execFileSync("git", ["ls-files", "--others", "--", "tests/baselines"], { cwd: ROOT, encoding: "utf8" }).trim();
  assert(extra === "", `untracked files in tests/baselines: ${extra}`);
  return "git diff --quiet HEAD -- tests/baselines; no untracked file there";
});

// The stills and masks (CL1): reused from out/after only when they were made from this very snapshot.
const AFTER = resolve(ROOT, "out/after");
const BEFORE = resolve(ROOT, "out/before-masks");
let metrics = null;
await check("CL1 before and after stills from one environment, after on this snapshot", () => {
  const now = snapshot(ROOT);
  const read = (d) => (existsSync(join(d, "manifest.json")) ? JSON.parse(readFileSync(join(d, "manifest.json"), "utf8")) : null);
  let after = read(AFTER);
  if (!after || JSON.stringify(after.snapshot) !== JSON.stringify(now)) {
    execFileSync("node", ["scripts/stills.mjs", "out/after"], { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
    after = read(AFTER);
  }
  const before = read(BEFORE);
  assert(before, "no out/before-masks/manifest.json");
  const env = environment(ROOT);
  for (const [k, v] of Object.entries(before.environment)) assert(after.environment[k] === v && env[k] === v, `environment differs in ${k}: before ${v}, after ${after.environment[k]}, now ${env[k]}`);
  metrics = JSON.parse(execFileSync("python3", ["-I", "scripts/still_metrics.py", AFTER, BEFORE], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 }));
  return `${after.stills.length} after stills on ${after.snapshot.tree.slice(0, 12)}; before ${before.snapshot.tree.slice(0, 12)}; ${Object.keys(env).length} environment fields equal`;
});

const perStill = (key) => Object.entries(metrics?.stills ?? {}).filter(([, r]) => r[key]).map(([k, r]) => [k, r[key]]);
await check("WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames", () => {
  assert(metrics, "no metrics (CL1 failed)");
  const wa6 = perStill("WA6");
  const wa7 = [...perStill("WA7"), ...perStill("WA7next").map(([k, r]) => [`${k}+1`, r])];
  assert(wa6.length > 0 && perStill("WA7next").length > 0, "no still with the lake in view");
  const bad = [...wa6.filter(([, r]) => !r.ok).map(([k, r]) => `${k} coverage ${r.coverage.toFixed(3)} diff ${r.meanDiff?.toFixed(1)}`), ...wa7.filter(([, r]) => !r.ok).map(([k, r]) => `${k} specks ${r.specks.toFixed(4)}`)];
  assert(bad.length === 0, bad.join("; "));
  return `WA6 ${wa6.map(([k, r]) => `${k} ${(100 * r.coverage).toFixed(1)} %`).join(", ")}; WA7 specks <= ${(100 * Math.max(...wa7.map(([, r]) => r.specks))).toFixed(2)} % at ${wa7.length} frames`;
});

await check("CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped", () => {
  assert(metrics, "no metrics (CL1 failed)");
  const cl2 = perStill("CL2");
  const cl3 = perStill("CL3");
  assert(cl2.length > 0 && cl3.length > 0, "nothing measured");
  const bad = [...cl2.filter(([, r]) => !r.ok).map(([k, r]) => `${k} shade x${r.ratio.toFixed(2)}`), ...cl3.filter(([, r]) => !r.ok).map(([k, r]) => `${k} luma ${(100 * r.change).toFixed(1)} % clipped ${(100 * r.clipped).toFixed(2)} %`)];
  assert(bad.length === 0, bad.join("; "));
  return `CL2 x${Math.min(...cl2.map(([, r]) => r.ratio)).toFixed(2)}-x${Math.max(...cl2.map(([, r]) => r.ratio)).toFixed(2)} (${cl2.length} stills); CL3 max change ${(100 * Math.max(...cl3.map(([, r]) => r.change))).toFixed(1)} % (${cl3.length} stills)`;
});

await check("CL4 trail distinct from nearby roads and terrain (dE76 >= 20)", () => {
  assert(metrics, "no metrics (CL1 failed)");
  const cl4 = perStill("CL4");
  assert(cl4.length > 0, "no ground still measured");
  const bad = cl4.filter(([, r]) => !r.ok).map(([k, r]) => `${k} roads ${r.roads?.toFixed(1)} terrain ${r.terrain?.toFixed(1)}`);
  assert(bad.length === 0, bad.join("; "));
  return `min dE terrain ${Math.min(...cl4.map(([, r]) => r.terrain)).toFixed(1)}, roads ${Math.min(...cl4.filter(([, r]) => r.roads !== null).map(([, r]) => r.roads)).toFixed(1)} (${cl4.length} stills)`;
});

await check("CL6 one look: aerial terrain hue and saturation within 15 % of the ground", () => {
  assert(metrics?.CL6, "not measured");
  const c = metrics.CL6;
  assert(c.ok, `hue ${(100 * c.hueChange).toFixed(1)} %, saturation ${(100 * c.satChange).toFixed(1)} %`);
  return `hue ${c.aerialHue.toFixed(1)} vs ${c.groundHue.toFixed(1)} (${(100 * c.hueChange).toFixed(1)} %), saturation ${c.aerialSat.toFixed(3)} vs ${c.groundSat.toFixed(3)} (${(100 * c.satChange).toFixed(1)} %)`;
});

await check("BL13 landmarks on screen >= 2 s and >= 40 px", () => {
  const landmarks = ["blaenau", "vale-north", "vale-south", "maentwrog", "trawsfynydd"].flatMap((w) => JSON.parse(readFileSync(resolve(ROOT, `public/data/sections/${w}/buildings.json`), "utf8")).filter((b) => b.kind === "landmark"));
  assert(landmarks.length === 0, `${landmarks.length} landmarks listed but the per-landmark mask check is not built yet`);
  return "no landmark is listed in any section, so no shot names one";
});

const lines = results.map((r) => `| ${r.id} | ${r.ok ? "pass" : "FAIL"} | ${r.detail.replace(/\|/g, "/")} |`);
const snap = snapshot(ROOT);
const report = [`\n### Render checks ${new Date().toISOString()} (${process.platform}-${process.arch}; snapshot tree ${snap.tree.slice(0, 12)}${snap.dirty ? ", dirty" : ""}, untracked ${snap.untrackedSha256.slice(0, 12)})\n`, "| Check | Result | Detail |", "|---|---|---|", ...lines, ""].join("\n");
// since the reel moved to the photo look (ADR 60) its records sit with the photo look's; validation-3d.md holds the earlier runs
appendFileSync(resolve(ROOT, "docs/validation-photoreal.md"), report);
console.log(report);
process.exit(results.every((r) => r.ok) ? 0 : 1);
