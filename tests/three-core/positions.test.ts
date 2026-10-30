import { describe, expect, it } from "vitest";
import { validateFeatures } from "../../src/three-core/registers";
import { readJson } from "./fixtures";

// Sourced positions and categories are kept (spec CL7; ADRs 47, 48). The fixture was captured at t6,
// before any code change; new entries (buildings) are allowed, but none of these may move or vanish.
type Before = { features: Record<string, { file: string; kind: string; category: string; ref: string; fromKm: number | null; toKm: number | null }> };

describe("register positions before the iteration (CL7)", () => {
  it("every earlier entry still exists with the same source, category and km range", () => {
    const before = readJson<Before>("tests/fixtures/feature-positions-before.json").features;
    const files = [...new Set(Object.values(before).map((b) => b.file))];
    const now = new Map(files.flatMap((f) => validateFeatures(readJson<unknown>(f))).map((e) => [e.id, e]));
    const changed = Object.entries(before)
      .filter(([id, b]) => {
        const e = now.get(id);
        return !e || e.kind !== b.kind || e.category !== b.category || e.source.ref !== b.ref || (e.fromKm ?? null) !== b.fromKm || (e.toKm ?? null) !== b.toKm;
      })
      .map(([id]) => id);
    expect(Object.keys(before).length).toBeGreaterThan(1000);
    expect(changed).toEqual([]);
  });
});
