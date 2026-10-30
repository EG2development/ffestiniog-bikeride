import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadExports } from "./three-core/pending";

// One load gate for the data providers (spec RD3–RD5; ADR 43; pseudocode-reel-v2 §3.1, §3.2).
// The gate is pure: delayRender, continueRender and cancelRender are injected, so it is tested without React.
type Gate<T> = { hold: (key: string) => void; start: (key: string, load: (signal: AbortSignal) => Promise<T>, onData: (d: T | null) => void) => number; mounted: (gen: number) => void; dispose: () => void };
type Mod = {
  createLoadGate: <T>(deps: { label: (key: string) => string; delay: (label: string) => number; release: (handle: number) => void; cancel: (err: Error) => void }) => Gate<T>;
  AssetLoadError: new (section: string, path: string, reason: string) => Error & { section: string; path: string };
};

function harness() {
  const log: string[] = [];
  let next = 1;
  const deps = {
    label: (k: string) => `load ${k}`,
    delay: (l: string) => {
      const h = next++;
      log.push(`delay ${h} ${l}`);
      return h;
    },
    release: (h: number) => log.push(`release ${h}`),
    cancel: (e: Error) => log.push(`cancel ${e.message}`),
  };
  return { log, deps };
}
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createLoadGate", () => {
  it("RD3: holds the frame until the data has mounted, then releases once", async () => {
    const { createLoadGate } = await loadExports<Mod>("src/data/loadGate.ts", ["createLoadGate"]);
    const { log, deps } = harness();
    const gate = createLoadGate<string>(deps);
    const d = deferred<string>();
    const seen: (string | null)[] = [];
    const gen = gate.start("trawsfynydd", () => d.promise, (x) => seen.push(x));
    d.resolve("data");
    await flush();
    expect(log).toEqual(["delay 1 load trawsfynydd"]);
    gate.mounted(gen);
    gate.mounted(gen);
    expect(log).toEqual(["delay 1 load trawsfynydd", "release 1"]);
    expect(seen[seen.length - 1]).toBe("data");
  });

  it("RD3: an input change takes the new hold before it releases the old one, and clears the stale data", async () => {
    const { createLoadGate } = await loadExports<Mod>("src/data/loadGate.ts", ["createLoadGate"]);
    const { log, deps } = harness();
    const gate = createLoadGate<string>(deps);
    const a = deferred<string>();
    const b = deferred<string>();
    const seen: (string | null)[] = [];
    gate.start("blaenau", () => a.promise, (x) => seen.push(x));
    const g2 = gate.start("trawsfynydd", () => b.promise, (x) => seen.push(x));
    expect(log.indexOf("delay 2 load trawsfynydd")).toBeLessThan(log.indexOf("release 1"));
    expect(seen[seen.length - 1]).toBeNull();
    a.resolve("old");
    b.resolve("new");
    await flush();
    expect(seen).not.toContain("old");
    gate.mounted(g2);
    expect(log[log.length - 1]).toBe("release 2");
  });

  it("RD4: a request that settles after a newer one began neither sets data nor cancels the render", async () => {
    const { createLoadGate } = await loadExports<Mod>("src/data/loadGate.ts", ["createLoadGate"]);
    const { log, deps } = harness();
    const gate = createLoadGate<string>(deps);
    const a = deferred<string>();
    const seen: (string | null)[] = [];
    gate.start("blaenau", () => a.promise, (x) => seen.push(x));
    gate.start("trawsfynydd", () => new Promise(() => {}), (x) => seen.push(x));
    a.reject(new Error("blaenau failed late"));
    await flush();
    expect(log.some((l) => l.startsWith("cancel"))).toBe(false);
  });

  it("RD4: a failure after unmount does not cancel, and unmounting releases the hold", async () => {
    const { createLoadGate } = await loadExports<Mod>("src/data/loadGate.ts", ["createLoadGate"]);
    const { log, deps } = harness();
    const gate = createLoadGate<string>(deps);
    const a = deferred<string>();
    gate.start("maentwrog", () => a.promise, () => {});
    gate.dispose();
    a.reject(new Error("after unmount"));
    await flush();
    expect(log).toContain("release 1");
    expect(log.some((l) => l.startsWith("cancel"))).toBe(false);
  });

  it("RD4: an aborted request is ignored", async () => {
    const { createLoadGate } = await loadExports<Mod>("src/data/loadGate.ts", ["createLoadGate"]);
    const { log, deps } = harness();
    const gate = createLoadGate<string>(deps);
    let signal!: AbortSignal;
    gate.start("vale-north", (s) => ((signal = s), new Promise((_, rej) => s.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))), () => {});
    gate.start("vale-south", () => new Promise(() => {}), () => {});
    await flush();
    expect(signal.aborted).toBe(true);
    expect(log.some((l) => l.startsWith("cancel"))).toBe(false);
  });

  it("RD5: the current request's failure cancels the render with the section and the asset path", async () => {
    const { createLoadGate, AssetLoadError } = await loadExports<Mod>("src/data/loadGate.ts", ["createLoadGate", "AssetLoadError"]);
    const { log, deps } = harness();
    const gate = createLoadGate<string>(deps);
    gate.start("trawsfynydd", () => Promise.reject(new AssetLoadError("trawsfynydd", "data/sections/trawsfynydd/dem.json", "HTTP 404")), () => {});
    await flush();
    expect(log[log.length - 1]).toBe("cancel section trawsfynydd: data/sections/trawsfynydd/dem.json: HTTP 404");
  });
});

describe("the hold is taken while rendering, before any frame commits (RD1, RD2, RL26)", () => {
  // A full reel render once showed black frames just after cuts (242–246, 480–485, 784): the hold was taken in an
  // effect, after React had committed a frame without data, and a parallel tab captured it.
  it("hold(key) takes the hold at once; start() then reuses it, and a new key holds before the old is released", async () => {
    const { createLoadGate } = await loadExports<Mod>("src/data/loadGate.ts", ["createLoadGate"]);
    const { log, deps } = harness();
    const gate = createLoadGate<string>(deps);
    gate.hold("a");
    gate.hold("a"); // a second render of the same input takes nothing more
    expect(log).toEqual(["delay 1 load a"]);
    const a = deferred<string>();
    const g = gate.start("a", () => a.promise, () => {});
    expect(log, "start reuses the render-time hold").toEqual(["delay 1 load a"]);
    a.resolve("A");
    await flush();
    gate.mounted(g);
    expect(log).toEqual(["delay 1 load a", "release 1"]);
    gate.hold("b");
    expect(log[log.length - 1]).toBe("delay 2 load b");
    gate.start("b", () => new Promise(() => {}), () => {});
    gate.dispose();
    expect(log.filter((l) => l.startsWith("release"))).toEqual(["release 1", "release 2"]);
  });

  it("useLoadGate takes the hold in the render body, not in an effect", () => {
    const src = readFileSync(resolve(__dirname, "../src/data/loadGate.ts"), "utf8");
    const hook = src.slice(src.indexOf("export function useLoadGate"));
    const firstEffect = hook.indexOf("useEffect(");
    expect(hook.indexOf(".hold(key)"), "a hold(key) call in the hook").toBeGreaterThan(-1);
    expect(hook.indexOf(".hold(key)"), "before the first effect").toBeLessThan(firstEffect);
  });
});

describe("loads kept by key (t8: one corridor drape per tab, not one per aerial section)", () => {
  type Memo = { memoOnSuccess: <T>(load: (key: string, signal: AbortSignal) => Promise<T>) => (key: string, signal: AbortSignal) => Promise<T> };
  it("loads a key once after it succeeds; a failure or an abort is not kept, so the next request loads again", async () => {
    const { memoOnSuccess } = await loadExports<Memo>("src/data/memoOnSuccess.ts", ["memoOnSuccess"]);
    const signal = new AbortController().signal;
    let calls = 0;
    const fail = new Set(["bad", "aborted"]);
    const load = memoOnSuccess(async (key: string) => {
      calls++;
      if (fail.has(key)) throw Object.assign(new Error(key), { name: key === "aborted" ? "AbortError" : "Error" });
      return `${key}#${calls}`;
    });
    expect(await load("corridor", signal)).toBe("corridor#1");
    expect(await load("corridor", signal)).toBe("corridor#1");
    expect(calls).toBe(1);
    for (const key of ["bad", "aborted"]) {
      await expect(load(key, signal)).rejects.toThrow(key);
      fail.delete(key);
      expect(await load(key, signal), `${key} is retried`).toMatch(new RegExp(`^${key}#`));
    }
  });

  it("the drape provider keeps its drapes by key", () => {
    const src = readFileSync(resolve(__dirname, "../src/data/MapDrapeProvider.tsx"), "utf8");
    expect(src).toMatch(/memoOnSuccess(<[^>]*>)?\(/);
  });
});

describe("the providers use the gate (RD3–RD5)", () => {
  for (const file of ["src/data/Scene3DDataProvider.tsx", "src/data/MapDrapeProvider.tsx", "src/data/RouteDataProvider.tsx"]) {
    it(`${file} loads through the gate and names the section in its errors`, () => {
      const src = readFileSync(resolve(__dirname, "..", file), "utf8");
      expect(src, file).toMatch(/from "\.\/loadGate"/);
      expect(src, file).toMatch(/AssetLoadError|useLoadGate/);
    });
  }
});

describe("errors name the section, not the data window (RD5; t10 R-L3)", () => {
  it("Section3D passes its section id as the providers' error label", () => {
    const src = readFileSync(resolve(__dirname, "../src/scenes3d/Section3D.tsx"), "utf8");
    expect(src.match(/label=\{(cfg|configOf\(props\.section\))\.id\}/g)?.length, "both providers").toBe(2);
    for (const f of ["src/data/Scene3DDataProvider.tsx", "src/data/MapDrapeProvider.tsx"]) expect(readFileSync(resolve(__dirname, "..", f), "utf8"), f).toMatch(/label \?\? /);
  });
});
