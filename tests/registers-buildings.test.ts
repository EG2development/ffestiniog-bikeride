import { describe, expect, it } from "vitest";
import { validateFeatures } from "../src/three-core/registers";

// Buildings carry status and provenance in the register (spec BL2–BL4, BL16; ADR 51; pseudocode-reel-v2 §5.6).
const building = (over: Record<string, unknown> = {}) => ({
  id: "building-trawsfynydd-123",
  kind: "building",
  category: "approximate",
  source: { type: "osm", ref: "way/123" },
  scenes: ["Reel3D", "Section-trawsfynydd"],
  status: "existing",
  provenance: { urls: ["https://www.openstreetmap.org/way/123"], evidence: ["map"], observedAt: "2025-06-01", retrievedAt: "2026-10-25", licence: "ODbL", confidence: "high" },
  ...over,
});

describe("building entries in the register", () => {
  it("BL2: accepts a building with status and full provenance", () => {
    expect(validateFeatures([building()])[0]).toMatchObject({ kind: "building", status: "existing" });
  });

  it("BL2: rejects a building without provenance, naming the field", () => {
    expect(() => validateFeatures([building({ provenance: undefined })])).toThrow(/provenance/);
  });

  it("BL2: rejects a building whose provenance lacks a field", () => {
    for (const key of ["urls", "observedAt", "retrievedAt", "licence", "confidence"]) {
      const p = { ...building().provenance } as Record<string, unknown>;
      delete p[key];
      expect(() => validateFeatures([building({ provenance: p })]), key).toThrow(new RegExp(`provenance.*${key}|${key}`));
    }
  });

  it("BL2: rejects an unknown status", () => {
    expect(() => validateFeatures([building({ status: "planned" })])).toThrow(/status/);
  });

  it("BL3: a planning record alone cannot make a building existing, but can make it approved", () => {
    const planning = { ...building().provenance, evidence: ["planning"] };
    expect(() => validateFeatures([building({ provenance: planning })])).toThrow(/planning/);
    expect(validateFeatures([building({ status: "approved", provenance: planning })])[0]).toMatchObject({ status: "approved" });
  });

  it("BL4: an observation over 3 years older than the retrieval cannot have high confidence", () => {
    const old = { ...building().provenance, observedAt: "2022-01-01" };
    expect(() => validateFeatures([building({ provenance: old })])).toThrow(/confidence/);
    expect(validateFeatures([building({ provenance: { ...old, confidence: "medium" } })])[0]).toMatchObject({ kind: "building" });
  });

  it("BL4 (t9 F6): an impossible date, or an observation after the retrieval, is rejected", () => {
    const bad = { ...building().provenance, observedAt: "2015-13-40" };
    expect(() => validateFeatures([building({ provenance: bad })])).toThrow(/observedAt/);
    const future = { ...building().provenance, observedAt: "2027-01-01" };
    expect(() => validateFeatures([building({ provenance: future })])).toThrow(/observedAt/);
  });

  it("BL4 (t10 L4): 'over 3 years' is by the calendar, the same at every date", () => {
    for (const [observedAt, retrievedAt] of [["2021-03-01", "2024-03-01"], ["2021-01-01", "2024-01-01"], ["2020-02-29", "2023-02-28"]]) {
      const p = { ...building().provenance, observedAt, retrievedAt };
      expect(validateFeatures([building({ provenance: p })])[0].kind, `${observedAt} → ${retrievedAt} is exactly 3 years: high is allowed`).toBe("building");
    }
    const over = { ...building().provenance, observedAt: "2021-03-01", retrievedAt: "2024-03-02" };
    expect(() => validateFeatures([building({ provenance: over })])).toThrow(/confidence/);
  });

  it("BL16: a building needs a real source type", () => {
    expect(() => validateFeatures([building({ source: { type: "original", ref: "invented" } })])).toThrow(/source/);
  });
});
