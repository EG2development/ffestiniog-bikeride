import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { POC } from "../src/three-core/poc";

// Source scans for the spec's S criteria and the ADRs' rules (docs/pseudocode-3d.md §4.2).

const ROOT = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");
const exists = (rel: string) => existsSync(resolve(ROOT, rel));

function files(relDir: string): string[] {
  const dir = resolve(ROOT, relDir);
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(relative(ROOT, full)));
    else if (/\.(ts|tsx)$/.test(name)) out.push(relative(ROOT, full));
  }
  return out;
}

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const code = (rel: string) => stripComments(read(rel));

const CORE = "src/three-core";
const VIEWS = "src/three";
const SCENES = "src/scenes3d";
const PROVIDER = "src/data/Scene3DDataProvider.tsx";
const PROVIDERS = [PROVIDER, "src/data/MapDrapeProvider.tsx"];
/** The one file that may take the render over with useFrame (docs/adr/0055-post-processing-takeover.md). */
const FRAME_TAKEOVER = "src/three/photo/PostFX.tsx";
const threeSources = () => [...files(CORE), ...files(VIEWS), ...files(SCENES)];

const pkg = () => JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  allowScripts?: Record<string, boolean>;
};

describe("3D source layout (ADRs 2–4)", () => {
  it("has 3D views, a 3D scene and the 3D data provider", () => {
    expect(files(VIEWS).length, "src/three/ views").toBeGreaterThan(0);
    expect(files(SCENES).length, "src/scenes3d/ compositions").toBeGreaterThan(0);
    expect(exists(PROVIDER), PROVIDER).toBe(true);
  });

  it("registers the POC composition in src/Root.tsx", () => {
    expect(read("src/Root.tsx")).toContain(`id="${POC.compositionId}"`);
  });

  it("ADR 24: src/Root.tsx loads 3D modules lazily, keeping them out of the 2D video's bundle", () => {
    const root = code("src/Root.tsx");
    expect(root).not.toMatch(/from\s+["'](\.\/(scenes3d|three|three-core)\/[^"']*|three|@react-three\/[^"']+|@remotion\/three)["']/);
    expect(root).toMatch(/lazyComponent=\{\(\) => import\("\.\/scenes3d\/PocMaentwrog"\)\}/);
  });

  it("ADR 3: src/three-core imports nothing from React, three.js or Remotion", () => {
    for (const f of files(CORE)) {
      expect(code(f), f).not.toMatch(/from\s+["'](react|react-dom|three|@react-three\/[^"']+|remotion|@remotion\/[^"']+)["']/);
    }
  });

  it("ADR 4: views inside the canvas don't read React context", () => {
    const views = files(VIEWS);
    expect(views.length).toBeGreaterThan(0);
    for (const f of views) expect(code(f), f).not.toMatch(/useContext|useRouteData|useScene3DData/);
  });

  it("every <ThreeCanvas> comes from @remotion/three", () => {
    const users = files(SCENES).filter((f) => /ThreeCanvas/.test(code(f)));
    expect(users.length, "scenes using ThreeCanvas").toBeGreaterThan(0);
    for (const f of users) expect(code(f), f).toMatch(/import\s*{[^}]*ThreeCanvas[^}]*}\s*from\s*["']@remotion\/three["']/);
  });
});

describe("rendering rules", () => {
  it("RN1: no clocks, timers, useFrame or unseeded randomness in 3D code", () => {
    const srcs = [...threeSources(), ...PROVIDERS];
    expect(files(VIEWS).length + files(SCENES).length, "3D views and scenes to scan").toBeGreaterThan(0);
    for (const f of srcs) {
      expect(code(f), f).not.toMatch(/requestAnimationFrame|setInterval|setTimeout|Date\.now|performance\.now|new Date\(|Math\.random/);
      // ADR 55: the post-processing pass is the one render-priority subscriber; under frameloop "never" it runs once per advance()
      if (f !== FRAME_TAKEOVER) expect(code(f), f).not.toMatch(/\buseFrame\b/);
    }
    const post = code(FRAME_TAKEOVER);
    expect(post.match(/\buseFrame\(/g)?.length, "one useFrame, with a positive priority").toBe(1);
    expect(post).toMatch(/\}, 1\);/);
  });

  it("RN4: 3D still/render scripts pass --gl=angle; remotion.config.ts sets no GL renderer", () => {
    const { scripts } = pkg();
    expect(scripts["still:poc"], "still:poc script").toBeDefined();
    expect(scripts["render:poc"], "render:poc script").toBeDefined();
    for (const [name, cmd] of Object.entries(scripts)) {
      if (/Poc3D|Reel3D|Section-/.test(cmd)) expect(cmd, name).toMatch(/--gl=angle/);
    }
    expect(code("remotion.config.ts")).not.toMatch(/setChromiumOpenGlRenderer/);
  });

  it("ADR 53: 3D video renders encode on the GPU at 10 Mbit/s; the 2D video and the config keep software encoding", () => {
    const { scripts } = pkg();
    for (const [name, cmd] of Object.entries(scripts)) {
      if (/remotion render .*(Poc3D|Reel3D|Section-)/.test(cmd)) expect(cmd, name).toMatch(/--hardware-acceleration=if-possible --video-bitrate=10M/);
      if (/CyclingVision/.test(cmd)) expect(cmd, name).not.toMatch(/hardware-acceleration/);
    }
    expect(code("remotion.config.ts")).not.toMatch(/setHardwareAcceleration|setVideoBitrate/);
    const checks = read("scripts/render-checks.mjs");
    expect(checks, "the checks' 3D renders").toMatch(/const GPU_ENCODE = \["--hardware-acceleration=if-possible", "--video-bitrate=10M"\]/);
    expect(checks.match(/"render", "src\/index\.ts", (POC|REEL), file, "--gl=angle", \.\.\.GPU_ENCODE/g)?.length, "POC and reel renders").toBe(2);
    expect(checks, "the 2D render stays on software encoding").toMatch(/remotion\(\["render", "src\/index\.ts", "CyclingVision", file\]\)/);
  });

  it("CI installs with --ignore-scripts, as package.json's allowScripts does locally (t12)", () => {
    // npm 11.8.0, bundled with CI's Node 24.13.1, ignores allowScripts and ran esbuild's install script; newer npm skips it
    expect(pkg().allowScripts, "the local policy").toBeDefined();
    expect(read(".github/workflows/ci.yml")).toMatch(/run: npm ci --ignore-scripts\b/);
  });

  it("RN5a: every 3D file that loads data or assets gates the render, directly or through the load gate (ADR 43)", () => {
    expect(exists(PROVIDER), PROVIDER).toBe(true);
    for (const f of [...files(VIEWS), ...files(SCENES), ...PROVIDERS]) {
      const src = code(f);
      if (/\bfetch\(|Loader\b|\.load\(/.test(src)) {
        if (!/\buseLoadGate\(/.test(src)) {
          expect(src, f).toMatch(/delayRender/);
          expect(src, f).toMatch(/continueRender/);
        }
      }
    }
  });

  it("RN5d: data providers report a failed load instead of hanging, and check the HTTP status (review R1; ADR 43)", () => {
    for (const f of [...PROVIDERS, "src/data/RouteDataProvider.tsx"]) {
      const src = code(f);
      expect(src, f).toMatch(/\buseLoadGate\(/); // the gate cancels the render on the current request's failure
      expect(src, f).toMatch(/\.ok\b/);
      expect(src, f).toMatch(/new AssetLoadError\(/);
    }
    expect(code("src/data/loadGate.ts")).toMatch(/cancel: cancelRender/);
  });

  it("H2a/L2/G3: the overlays are logged from the page, not from a hard-coded list (review R2; ADR 36)", () => {
    const src = code("src/three/Overlays.tsx");
    expect(src).toMatch(/querySelectorAll\("\[data-overlay\]"\)/);
    expect(src).toMatch(/data-overlay=\{id\}/);
    for (const f of files(SCENES)) expect(code(f), f).not.toMatch(/overlays\.push\(/);
    const captions = code("src/data/reel-captions.ts");
    for (const id of ["disclaimer", "attribution", "proposed-label", "closing", "section-title"]) expect(captions, id).toContain(`id: "${id}"`);
  });

  it("RL3: the reel and every section are registered lazily, and the reel composition exists (ADR 28)", () => {
    expect(exists("src/scenes3d/Reel3D.tsx"), "src/scenes3d/Reel3D.tsx").toBe(true);
    expect(exists("src/data/reel-timeline.ts"), "src/data/reel-timeline.ts").toBe(true);
    const root = code("src/Root.tsx");
    expect(root).toContain('id="Reel3D"');
    expect(root).toMatch(/lazyComponent=\{\(\) => import\("\.\/scenes3d\/Reel3D"\)\}/);
    expect(root).not.toMatch(/from\s+["']\.\/(scenes3d|three|three-core|data\/reel)[^"']*["']/);
  });

  it("RL30: the fetch scripts reach only the allowlisted hosts", () => {
    // the lidar COGs, the OSM API, (ADR 54) Poly Haven's CC0 download host, polyhaven.com cited as the asset page, and
    // (ADR 60) the Sentinel-2 scene: the Earth Search STAC API that names its file and the open-data bucket that holds it;
    // (ADR 63) the OS Downloads API, which redirects to a signed copy of OS OpenMap - Local; DataMapWales's WFS and the
    // NRW lidar archive it lists (read by byte range); (ADR 62) the Blender build's CC0 assets: Poly Haven's API, which
    // names each file, and the MakeHuman system asset pack
    const allowed = ["dmwproductionblob.blob.core.windows.net", "api.openstreetmap.org", "dl.polyhaven.org", "polyhaven.com", "earth-search.aws.element84.com", "sentinel-cogs.s3.us-west-2.amazonaws.com", "api.os.uk", "datamap.gov.wales", "api.polyhaven.com", "files.makehumancommunity.org"];
    for (const f of readdirSync(resolve(ROOT, "scripts"), { recursive: true, encoding: "utf8" }).filter((n) => /\.(py|mjs|ts)$/.test(n))) {
      const src = read(`scripts/${f}`);
      for (const [, host] of src.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
        if (/^(www\.)?remotion\.dev$|^github\.com$|^threejsresources\.com$/.test(host)) continue; // documentation links
        if (host === "www.openstreetmap.org" && !/urlopen\([^)]*www\.openstreetmap/.test(src)) continue; // cited in register provenance, never fetched (ADR 49)
        if (host === "www.ordnancesurvey.co.uk" && !/urlopen\([^)]*ordnancesurvey/.test(src)) continue; // the product page, cited, never fetched (ADR 63)
        if (host === "static.makehumancommunity.org" && !/fetch\([^)]*static\.makehuman/.test(src)) continue; // the licence page, cited in the register

        expect(allowed, `${f}: ${host}`).toContain(host);
      }
    }
  });

  it("RL31: no OSM tag value is rendered as on-screen text (ADR 38)", () => {
    for (const f of [...files(SCENES), ...files(VIEWS)]) expect(code(f), f).not.toMatch(/\{[^}]*\btags\.[A-Za-z_]+[^}]*\}/);
  });

  it("t10 R8/R9: Section3D names an unknown section at its boundary; SkyDome disposes its material", () => {
    expect(code("src/scenes3d/Section3D.tsx")).toMatch(/unknown section/);
    expect(code("src/three/SkyDome.tsx")).toMatch(/material\.dispose\(\)/);
  });

  it("RN5c: data providers release their hold only after their children have mounted", () => {
    // Releasing it straight after setState left a moment with no hold before <ThreeCanvas>
    // registered its own, and a tab's first frame was captured with a blank canvas (t8).
    for (const f of [...PROVIDERS, "src/data/RouteDataProvider.tsx"]) {
      const src = code(f);
      expect(src, f).toMatch(/\buseLoadGate\(/);
      expect(src, `${f}: providers release only through the gate`).not.toMatch(/continueRender\(/);
    }
    // the gate releases in an effect after the data's children commit (tests/load-gate.test.ts proves the order)
    // the release runs in an effect after the commit that mounted the data's children, for this input only (t10: key-aware)
    expect(code("src/data/loadGate.ts")).toMatch(/useEffect\(\(\) => \{\s*if \(state\.data !== null && state\.key === key\) gate\.current\?\.mounted\(state\.gen\);\s*\}, \[state, key\]\);/);
  });
});

describe("geography stays in data and in one projection", () => {
  it("RG4: no hard-coded latitude/longitude in 3D source", () => {
    for (const f of threeSources()) {
      expect(code(f), f).not.toMatch(/(?<![\w.])5[23]\.\d{3,}|-[34]\.\d{3,}/);
    }
  });

  it("RG5: 3D scenes use the shared route model and define no projection of their own", () => {
    const scenes = files(SCENES);
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.some((f) => /useRouteData/.test(code(f))), "a scene reads useRouteData()").toBe(true);
    for (const f of threeSources()) expect(code(f), f).not.toMatch(/111320|metersPerDeg/);
  });
});

describe("data and dependency rules", () => {
  it("ADR 21: data:sync exists and every data/*.json|geojson matches its public/data copy", () => {
    expect(pkg().scripts["data:sync"], "data:sync script").toBeDefined();
    for (const name of readdirSync(resolve(ROOT, "data")).filter((n) => /\.(json|geojson)$/.test(n))) {
      expect(exists(`public/data/${name}`), `public/data/${name}`).toBe(true);
      expect(read(`public/data/${name}`) === read(`data/${name}`), `${name} differs from its public copy`).toBe(true);
    }
  });

  it("ADR 22: three.js dependencies are pinned exactly", () => {
    const { dependencies: deps, devDependencies: dev } = pkg();
    expect(deps["three"]).toBe("0.186.1");
    expect(deps["@react-three/fiber"]).toBe("9.8.2");
    expect(deps["@remotion/three"]).toBe("4.0.538");
    expect(dev["@types/three"]).toBe("0.186.0");
    expect(deps["@react-three/drei"]).toBeUndefined();
  });

  it("RG2: tests/route.test.ts is unchanged since the 3D work began", () => {
    const hash = createHash("sha256").update(readFileSync(resolve(ROOT, "tests/route.test.ts"))).digest("hex");
    expect(hash).toBe(read("tests/baselines/route-test.sha256").trim());
  });
});

// Iteration 2 guards (spec CL6, CL14, X2; ADRs 44, 46; risk K14).
describe("iteration 2 static rules", () => {
  it("K14: Reel3D and the Root entries never pass a measurement mask", () => {
    for (const f of ["src/scenes3d/Reel3D.tsx", "src/Root.tsx"]) expect(code(f), f).not.toMatch(/\bmask\b/);
  });

  it("CL14 as amended by ADR 54: textures load only through the photo assets provider, from registered files under public/3d", () => {
    for (const f of threeSources()) expect(code(f), f).not.toMatch(/TextureLoader|useTexture|RGBELoader|EXRLoader|\.hdr\b|useEnvironment/);
    const provider = code("src/data/PhotoAssetsProvider.tsx");
    expect(provider).toMatch(/\buseLoadGate\(/);
    expect(provider).toMatch(/new AssetLoadError\(/);
    // every file the role table names is a registered asset (spec L1) under public/3d
    const roles = read("src/three/photo/assetRoles.ts");
    const registered = new Set((JSON.parse(read("data/assets-3d.json")) as { path: string }[]).map((a) => a.path));
    for (const [, path] of roles.matchAll(/"(3d\/[^"]+)"/g)) {
      expect(path, `${path} is under public/3d`).toMatch(/^3d\//);
      expect(registered.has(`public/${path}`), `${path} registered in data/assets-3d.json`).toBe(true);
      expect(exists(`public/${path}`), `public/${path} exists`).toBe(true);
    }
  });

  it("CL6: Lighting takes its values from one source, LIGHTING in atmosphere.ts", () => {
    const src = code("src/three/Lighting.tsx");
    expect(src).toMatch(/\bLIGHTING\b/);
    expect(src, "no literal light intensities or colours in the view").not.toMatch(/intensity=\{\d|args=\{\["#|color="#/);
  });

  it("X2: tests/baselines is unchanged", () => {
    expect(() => execFileSync("git", ["diff", "--quiet", "--", "tests/baselines"], { cwd: ROOT })).not.toThrow();
    expect(execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "tests/baselines"], { cwd: ROOT, encoding: "utf8" }).trim()).toBe("");
  });
});
