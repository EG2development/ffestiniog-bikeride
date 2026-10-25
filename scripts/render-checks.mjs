#!/usr/bin/env node
// Render checks for the spec's R criteria (docs/pseudocode-3d.md §4.3).
//   node scripts/render-checks.mjs                     run every check; exit 1 on any failure
//   node scripts/render-checks.mjs --capture-baselines record the RG1 baselines (do this only before
//                                                      3D code lands, or with reviewer sign-off)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = process.env.REMOTION_PORT ?? "3517";
const OUT = join(tmpdir(), "render-checks");
const BASELINES = resolve(ROOT, "tests/baselines/cyclingvision.json");
const RG1_FRAMES = [5, 1200, 2200, 2900];
const POC = "Poc3DMaentwrog";
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
  const log = remotion(["render", "src/index.ts", POC, file, "--gl=angle", "--log=verbose"]);
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

await check("RN5b terrain drawn at frame 0", () => {
  const file = join(OUT, "poc_diag_0.png");
  assert(existsSync(file), "no frame-0 still (previous check failed)");
  const out = execFileSync("python3", ["-I", "-c", [
    "import sys", "from PIL import Image",
    "im=Image.open(sys.argv[1]).convert('RGB'); w,h=im.size",
    "px=list(im.crop((0,h//2,w,h)).getdata())",
    "q=set((r//8,g//8,b//8) for r,g,b in px)",
    "print(len(q))",
  ].join("\n"), file], { encoding: "utf8" });
  assert(Number(out.trim()) >= 4, `only ${out.trim()} distinct colours in the lower half`);
  return `${out.trim()} distinct colour bins`;
});

const lines = results.map((r) => `| ${r.id} | ${r.ok ? "pass" : "FAIL"} | ${r.detail.replace(/\|/g, "/")} |`);
const report = [`\n### Render checks ${new Date().toISOString()} (${process.platform}-${process.arch})\n`, "| Check | Result | Detail |", "|---|---|---|", ...lines, ""].join("\n");
appendFileSync(resolve(ROOT, "docs/validation-3d.md"), report);
console.log(report);
process.exit(results.every((r) => r.ok) ? 0 : 1);
