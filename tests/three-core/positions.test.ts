import { describe, expect, it } from "vitest";
import { validateFeatures } from "../../src/three-core/registers";
import { readJson } from "./fixtures";

// Sourced positions and categories are kept (spec CL7; ADRs 47, 48). The fixture was captured at t6,
// before any code change; new entries (buildings) are allowed, but none of these may move or vanish.
// An entry later evidence shows was wrong may go only as the fixture's `superseded` records, and only when the entry
// that replaces it is in the same file and covers its km range.
type Before = {
  superseded?: Record<string, { by: string; reason: string }>;
  features: Record<string, { file: string; kind: string; category: string; ref: string; fromKm: number | null; toKm: number | null }>;
};

describe("register positions before the iteration (CL7)", () => {
  it("every earlier entry still exists with the same source, category and km range", () => {
    const fixture = readJson<Before>("tests/fixtures/feature-positions-before.json");
    const before = fixture.features;
    const superseded = fixture.superseded ?? {};
    const files = [...new Set(Object.values(before).map((b) => b.file))];
    const now = new Map(files.flatMap((f) => validateFeatures(readJson<unknown>(f))).map((e) => [e.id, e]));
    const changed = Object.entries(before)
      .filter(([id, b]) => {
        if (superseded[id]) return false;
        const e = now.get(id);
        return !e || e.kind !== b.kind || e.category !== b.category || e.source.ref !== b.ref || (e.fromKm ?? null) !== b.fromKm || (e.toKm ?? null) !== b.toKm;
      })
      .map(([id]) => id);
    expect(Object.keys(before).length).toBeGreaterThan(1000);
    expect(changed).toEqual([]);
  });

  it("a superseded entry is gone and its replacement covers its km range in the same file", () => {
    const fixture = readJson<Before>("tests/fixtures/feature-positions-before.json");
    for (const [id, { by }] of Object.entries(fixture.superseded ?? {})) {
      const old = fixture.features[id];
      const now = validateFeatures(readJson<unknown>(old.file));
      expect(now.find((e) => e.id === id), `${id} still registered`).toBeUndefined();
      const replacement = now.find((e) => e.id === by);
      expect(replacement, `${by} in ${old.file}`).toBeDefined();
      expect(replacement!.fromKm!).toBeLessThanOrEqual(old.fromKm!);
      expect(replacement!.toKm!).toBeGreaterThanOrEqual(old.toKm!);
    }
  });
});
