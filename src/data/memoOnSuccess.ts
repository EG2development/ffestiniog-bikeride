// Loads kept by key for a render tab (t8 benchmark): only the 3D drape provider imports this, so the 2D entry chunk
// does not grow. See docs/validation-3d.md "Benchmark against the baseline (reel v2, t8)".

/** A loader whose successful results are kept by key for the life of the page (a render tab): the same input is loaded
 * once. A failure or an abort is not kept, and a load still in flight is not shared, so one caller's abort can never
 * reach another caller (spec RD4). */
export function memoOnSuccess<T>(load: (key: string, signal: AbortSignal) => Promise<T>): (key: string, signal: AbortSignal) => Promise<T> {
  const done = new Map<string, T>();
  return async (key, signal) => {
    if (done.has(key)) return done.get(key)!;
    const value = await load(key, signal);
    done.set(key, value);
    return value;
  };
}
