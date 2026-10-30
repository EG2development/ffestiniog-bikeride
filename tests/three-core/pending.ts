import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Loads a module that may not exist yet, so a test fails for the right reason, "not implemented",
// instead of aborting the whole file on an import (mission task t6).
const ROOT = resolve(__dirname, "../..");

export async function load<T>(rel: string): Promise<T> {
  const path = resolve(ROOT, rel);
  if (!existsSync(path)) throw new Error(`${rel} is not implemented yet`);
  return (await import(/* @vite-ignore */ path)) as T;
}

/** Throws unless the module exports every name; the message says which is missing. */
export async function loadExports<T extends Record<string, unknown>>(rel: string, names: (keyof T & string)[]): Promise<T> {
  const mod = await load<T>(rel);
  const missing = names.filter((n) => !(n in mod));
  if (missing.length > 0) throw new Error(`${rel} does not export ${missing.join(", ")} yet`);
  return mod;
}
