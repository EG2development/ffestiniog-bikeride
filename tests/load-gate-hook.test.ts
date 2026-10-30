import { describe, expect, it, vi } from "vitest";

// useLoadGate as React runs it: the render body, then the effects (spec RD3; t10 review). A minimal hook runtime keeps
// state, refs and effects across renders of one component, so the hook's own logic is tested without a DOM.
type Hook = { v?: unknown; current?: unknown; deps?: unknown[]; cleanup?: (() => void) | undefined; fn?: () => (() => void) | void };
const rt = { hooks: [] as Hook[], idx: 0, queue: [] as (() => void)[] };
vi.mock("react", () => ({
  useState: (init: unknown) => {
    const i = rt.idx++;
    if (!(i in rt.hooks)) rt.hooks[i] = { v: typeof init === "function" ? (init as () => unknown)() : init };
    const h = rt.hooks[i];
    return [h.v, (nv: unknown) => (h.v = typeof nv === "function" ? (nv as (p: unknown) => unknown)(h.v) : nv)];
  },
  useRef: (init: unknown) => {
    const i = rt.idx++;
    if (!(i in rt.hooks)) rt.hooks[i] = { current: init };
    return rt.hooks[i];
  },
  useEffect: (fn: () => (() => void) | void, deps: unknown[]) => {
    const i = rt.idx++;
    const prev = rt.hooks[i];
    const changed = !prev || deps.some((d, k) => !Object.is(d, prev.deps?.[k]));
    rt.hooks[i] = { deps, cleanup: prev?.cleanup, fn };
    if (changed)
      rt.queue.push(() => {
        rt.hooks[i].cleanup?.();
        rt.hooks[i].cleanup = fn() || undefined;
      });
  },
}));
const log: string[] = [];
let next = 1;
vi.mock("remotion", () => ({
  delayRender: (l: string) => {
    const h = next++;
    log.push(`delay ${h} ${l}`);
    return h;
  },
  continueRender: (h: number) => log.push(`release ${h}`),
  cancelRender: (e: Error) => log.push(`cancel ${e.message}`),
}));
const flush = () => new Promise((r) => setTimeout(r, 0));

async function harness() {
  const { useLoadGate } = await import("../src/data/loadGate");
  rt.hooks = [];
  log.length = 0;
  return (key: string) => {
    rt.idx = 0;
    const out = useLoadGate((k: string) => `load ${k}`, key, async () => `data-${key}`);
    const q = rt.queue;
    rt.queue = [];
    return { out, commit: () => q.forEach((f) => f()) };
  };
}

describe("useLoadGate in a component (RD3; t10 review)", () => {
  it("the render with a new key never returns the old key's data, and it is already held", async () => {
    const render = await harness();
    let r = render("A");
    r.commit();
    await flush();
    r = render("A");
    expect(r.out).toBe("data-A");
    r.commit();
    r = render("B");
    expect(r.out, "old data with the new input (RD3)").toBeNull();
    expect(log[log.length - 1], "the new input is held from its first render").toMatch(/^delay \d+ load B$/);
  });

  it("survives its effects being cleaned up and run again (React StrictMode or Activity)", async () => {
    const render = await harness();
    const r = render("A");
    r.commit();
    for (const h of rt.hooks) h?.cleanup?.(); // unmount every effect…
    for (const h of rt.hooks) if (h?.fn) h.cleanup = h.fn() || undefined; // …and mount them again
    await flush();
    const again = render("A");
    again.commit();
    expect(again.out, "the data still arrives").toBe("data-A");
    const delays = log.filter((l) => l.startsWith("delay")).length;
    const releases = log.filter((l) => l.startsWith("release")).length;
    expect(releases, `every hold is released (${log.join("; ")})`).toBe(delays);
  });
});
