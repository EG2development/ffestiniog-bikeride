import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The docs must match what ships (mission task t13): these checks fail when code and docs drift apart.

const ROOT = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");
const design = () => read("docs/design-3d.md");

/** The design's interface block for the pure core: the ```ts fence under "### Pure core". */
function coreInterfaceBlock(): string {
  const doc = design();
  const start = doc.indexOf("### Pure core");
  const fence = doc.indexOf("```ts", start);
  return doc.slice(fence, doc.indexOf("```\n", fence + 5));
}

function coreExports(): Map<string, string> {
  const names = new Map<string, string>();
  for (const file of readdirSync(resolve(ROOT, "src/three-core")).filter((f) => f.endsWith(".ts"))) {
    for (const [, name] of read(`src/three-core/${file}`).matchAll(/^export (?:declare )?(?:function|const|type) (\w+)/gm)) names.set(name, file);
  }
  return names;
}

describe("docs match the shipped code (t13)", () => {
  it("the design's interface block lists every export of src/three-core, and nothing that isn't exported", () => {
    const block = coreInterfaceBlock();
    const exported = coreExports();
    const missing = [...exported].filter(([name]) => !new RegExp(`\\b${name}\\b`).test(block)).map(([n, f]) => `${f}: ${n}`);
    expect(missing, "exports missing from docs/design-3d.md").toEqual([]);
    const documented = [...block.matchAll(/export (?:function|const|type) (\w+)/g)].map((m) => m[1]);
    expect(documented.filter((name) => !exported.has(name)), "documented but not exported").toEqual([]);
  });

  it("every npm script the docs mention exists in package.json", () => {
    const scripts = new Set(Object.keys((JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts));
    for (const doc of ["README.md", "docs/sop-3d.md", "docs/design-3d.md"]) {
      for (const [, name] of read(doc).matchAll(/npm run ([\w:-]+)/g)) expect(scripts.has(name), `${doc}: npm run ${name}`).toBe(true);
    }
  });

  it("the design's tests table lists exactly the test files that exist", () => {
    const files = (dir: string): string[] =>
      readdirSync(resolve(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".test.ts") ? [join(dir, e.name)] : [],
      );
    const listed = new Set([...design().matchAll(/^\| `(tests\/[^`]+\.test\.ts)`/gm)].map((m) => m[1]));
    expect([...listed].sort()).toEqual(files("tests").sort());
  });
});
