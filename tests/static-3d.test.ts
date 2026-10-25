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
const threeSources = () => [...files(CORE), ...files(VIEWS), ...files(SCENES)];

const pkg = () => JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
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
    const srcs = threeSources();
    expect(files(VIEWS).length + files(SCENES).length, "3D views and scenes to scan").toBeGreaterThan(0);
    for (const f of srcs) {
      expect(code(f), f).not.toMatch(/\buseFrame\b|requestAnimationFrame|setInterval|setTimeout|Date\.now|performance\.now|new Date\(|Math\.random/);
    }
  });

  it("RN4: 3D still/render scripts pass --gl=angle; remotion.config.ts sets no GL renderer", () => {
    const { scripts } = pkg();
    expect(scripts["still:poc"], "still:poc script").toBeDefined();
    expect(scripts["render:poc"], "render:poc script").toBeDefined();
    for (const [name, cmd] of Object.entries(scripts)) {
      if (/Poc3D/.test(cmd)) expect(cmd, name).toMatch(/--gl=angle/);
    }
    expect(code("remotion.config.ts")).not.toMatch(/setChromiumOpenGlRenderer/);
  });

  it("RN5a: every 3D file that loads data or assets gates the render with delayRender/continueRender", () => {
    expect(exists(PROVIDER), PROVIDER).toBe(true);
    for (const f of [...files(VIEWS), ...files(SCENES), PROVIDER]) {
      const src = code(f);
      if (/\bfetch\(|Loader\b|\.load\(/.test(src)) {
        expect(src, f).toMatch(/delayRender/);
        expect(src, f).toMatch(/continueRender/);
      }
    }
  });

  it("RN5d: data providers report a failed load instead of hanging, and check the HTTP status (review R1)", () => {
    for (const f of [PROVIDER, "src/data/RouteDataProvider.tsx"]) {
      const src = code(f);
      expect(src, f).toMatch(/\.catch\(\(err\) => cancelRender\(err\)\)/);
      expect(src, f).toMatch(/\.ok\b/);
    }
  });

  it("H2a/L2/G3: the POC logs the overlays found in the page, not a hard-coded list (review R2)", () => {
    const src = code("src/scenes3d/PocMaentwrog.tsx");
    expect(src).toMatch(/querySelectorAll\("\[data-overlay\]"\)/);
    expect(src).not.toMatch(/overlays\.push\(/);
    for (const id of ["disclaimer", "attribution", "proposed-label", "closing", "ve-label"]) {
      expect(src.includes(`data-overlay="${id}"`) || src.includes(`<Overlay id="${id}"`), id).toBe(true);
    }
  });

  it("RN5c: data providers release their hold only after their children have mounted", () => {
    // Releasing it straight after setState left a moment with no hold before <ThreeCanvas>
    // registered its own, and a tab's first frame was captured with a blank canvas (t8).
    for (const f of [PROVIDER, "src/data/RouteDataProvider.tsx"]) {
      const src = code(f);
      expect(src, f).not.toMatch(/set(Data|Model)\([\s\S]*?\);\s*continueRender\(/);
      expect(src, f).toMatch(/useEffect\(\(\) => \{\s*if \((data|model)\) continueRender\(handle\);\s*\}, \[(data|model), handle\]\);/);
    }
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
