// One load gate for the data providers (docs/adr/0043-load-gate-for-providers.md). Pure: the render hold functions
// are injected, so it is tested without React. One hold per input generation; a stale or unmounted request never sets
// data or cancels the render; the hold is released only after the children have mounted (spec RN5c).
import { useEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

/** A failed asset, named by the section and the path (spec RD5). */
export class AssetLoadError extends Error {
  constructor(
    readonly section: string,
    readonly path: string,
    reason: string,
  ) {
    super(`section ${section}: ${path}: ${reason}`);
    this.name = "AssetLoadError";
  }
}

type Deps = { label: (key: string) => string; delay: (label: string) => number; release: (handle: number) => void; cancel: (err: Error) => void };
type Current = { gen: number; key: string; handle: number; controller: AbortController; released: boolean; hasData: boolean };

export function createLoadGate<T>({ label, delay, release, cancel }: Deps) {
  let gen = 0;
  let cur: Current | null = null;
  let pending: { key: string; handle: number } | null = null; // a hold taken while rendering, before start() runs
  let disposed = false;
  const releaseOnce = (c: Current) => {
    if (!c.released) {
      c.released = true;
      release(c.handle);
    }
  };
  return {
    /** Takes the hold for `key` now. Call it while rendering: an effect runs after React has committed a frame without
     * data, which a parallel render can capture (RL26). Idempotent per key; a newer key's hold replaces an older pending one. */
    hold(key: string): void {
      if (disposed || (cur && cur.key === key) || (pending && pending.key === key)) return;
      const old = pending;
      pending = { key, handle: delay(label(key)) };
      if (old) release(old.handle);
    },
    /** Starts loading `key`; a new key takes its hold before the old one is released, so no frame is unheld. */
    start(key: string, load: (signal: AbortSignal) => Promise<T>, onData: (d: T | null) => void): number {
      if (cur && cur.key === key) return cur.gen;
      const g = ++gen;
      const handle = pending && pending.key === key ? pending.handle : delay(label(key));
      if (pending && pending.key !== key) release(pending.handle);
      pending = null;
      const prev = cur;
      const controller = new AbortController();
      cur = { gen: g, key, handle, controller, released: false, hasData: false };
      if (prev) {
        prev.controller.abort();
        releaseOnce(prev);
      }
      onData(null); // the old data never shows with the new input (spec RD3)
      load(controller.signal).then(
        (d) => {
          if (disposed || !cur || cur.gen !== g) return;
          cur.hasData = true;
          onData(d);
        },
        (err: Error) => {
          if (disposed || !cur || cur.gen !== g || err?.name === "AbortError") return; // spec RD4
          cancel(err);
        },
      );
      return g;
    },
    /** Called once the children of generation `g` have mounted: releases its hold, once. */
    mounted(g: number) {
      if (cur && cur.gen === g && cur.hasData) releaseOnce(cur);
    },
    dispose() {
      disposed = true;
      if (pending) release(pending.handle);
      pending = null;
      if (cur) {
        cur.controller.abort();
        releaseOnce(cur);
      }
    },
  };
}

/** The gate as a hook: loads when `key` changes, releases the hold after the data's children commit. */
export function useLoadGate<T>(label: (key: string) => string, key: string, load: (signal: AbortSignal) => Promise<T>): T | null {
  // the data remembers its key: on the render where the input changes, the old input's data is never returned (RD3; t10)
  const [state, setState] = useState<{ key: string; gen: number; data: T | null }>({ key, gen: 0, data: null });
  const gate = useRef<ReturnType<typeof createLoadGate<T>> | null>(null);
  const make = () => createLoadGate<T>({ label, delay: delayRender, release: continueRender, cancel: cancelRender });
  if (!gate.current) gate.current = make();
  gate.current.hold(key); // in the render body, so the first frame of a new input is already held
  const loadRef = useRef(load);
  loadRef.current = load;
  const genRef = useRef(0);
  useEffect(() => {
    if (!gate.current) gate.current = make(); // effects run again after a cleanup (StrictMode, Activity): a fresh gate reloads
    genRef.current = gate.current.start(key, (s) => loadRef.current(s), (d) => setState({ key, gen: genRef.current, data: d }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one load per key; label and load are read through refs
  }, [key]);
  useEffect(() => {
    if (state.data !== null && state.key === key) gate.current?.mounted(state.gen);
  }, [state, key]);
  useEffect(
    () => () => {
      gate.current?.dispose();
      gate.current = null;
    },
    [],
  );
  return state.key === key ? state.data : null;
}
