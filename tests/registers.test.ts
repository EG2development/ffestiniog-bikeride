import { describe, expect, it } from "vitest";
import { dataFileName, expectGridBytes, validateAssets, validateDemHeader, validateFeatures, validateOsmLines, validateTrailProfile } from "../src/three-core/registers";

const feature = (over: Record<string, unknown> = {}) => ({
  id: "trail",
  kind: "trail",
  category: "proposed",
  source: { type: "original", ref: "concept treatment" },
  scenes: ["Poc3DMaentwrog"],
  ...over,
});

describe("validateFeatures (H1, ADR 20)", () => {
  it("accepts a valid register", () => {
    const list = [feature(), feature({ id: "bridge-159029124", kind: "structure", category: "approximate", source: { type: "osm", ref: "way/159029124" } })];
    expect(validateFeatures(list)).toHaveLength(2);
  });

  it("rejects a register that is not an array", () => {
    expect(() => validateFeatures({ features: [] })).toThrow(/array/);
  });

  it("rejects an unknown category and names the path", () => {
    expect(() => validateFeatures([feature({ category: "exact" })])).toThrow(/\[0\]\.category/);
  });

  it("rejects duplicate ids", () => {
    expect(() => validateFeatures([feature(), feature()])).toThrow(/duplicate id "trail"/);
  });

  it("rejects an empty source ref", () => {
    expect(() => validateFeatures([feature({ source: { type: "osm", ref: "" } })])).toThrow(/\[0\]\.source\.ref/);
  });

  it("rejects a feature with no scenes", () => {
    expect(() => validateFeatures([feature({ scenes: [] })])).toThrow(/\[0\]\.scenes/);
  });
});

describe("validateAssets (L1, ADR 20)", () => {
  const asset = { path: "public/3d/tree.glb", kind: "model", source: "https://example.org", licence: "CC0-1.0", attribution: "none required" };

  it("accepts a valid register", () => {
    expect(validateAssets([asset])).toHaveLength(1);
  });

  it("rejects an asset without attribution text", () => {
    expect(() => validateAssets([{ ...asset, attribution: "" }])).toThrow(/\[0\]\.attribution/);
  });
});

describe("data files read at render time (t9 security review)", () => {
  it("accepts a plain file name from a data header", () => {
    expect(dataFileName("dem-poc.f32", "dem-poc.json file")).toBe("dem-poc.f32");
  });

  it("rejects a header file name that is a path or not a name", () => {
    for (const bad of ["../dem.f32", "a/b.f32", "..", "", "x\\y", "dem..f32", 7, null]) {
      expect(() => dataFileName(bad, "dem-poc.json file"), String(bad)).toThrow(/^dem-poc\.json file:/);
    }
  });

  it("accepts a grid file with one value per cell", () => {
    const buf = new ArrayBuffer(2 * 3 * 4);
    expect(expectGridBytes(buf, { cols: 2, rows: 3 }, 4, "dem-poc.f32")).toBe(buf);
  });

  it("rejects a grid file whose size doesn't match its header, or a bad grid size", () => {
    expect(() => expectGridBytes(new ArrayBuffer(10), { cols: 2, rows: 3 }, 4, "dem-poc.f32")).toThrow(/^dem-poc\.f32: expected 24 bytes/);
    expect(() => expectGridBytes(new ArrayBuffer(0), { cols: 0, rows: 3 }, 1, "landcover-poc.u8")).toThrow(/^landcover-poc\.u8: bad grid size/);
    expect(() => expectGridBytes(new ArrayBuffer(6), { cols: 2.5, rows: 3 }, 1, "landcover-poc.u8")).toThrow(/bad grid size/);
  });
});

describe("runtime data validators (review R8)", () => {
  const header = { cols: 3, rows: 2, spacingM: 4, originE: 268000, originN: 342000, nodata: -9999, file: "dem.f32", sourceFile: "src.u8" };
  const profile = { distanceM: [0, 5, 10], elevationM: [180, 180.2, 180.5], smoothingM: 25, bridges: [[5, 8]], overbridges: [] };
  const line = { properties: { id: "way/1", tags: { highway: "track" } }, geometry: { type: "LineString", coordinates: [[-3.9, 52.9], [-3.89, 52.91]] } };

  it("accepts a valid DEM header, trail profile and OSM lines", () => {
    expect(validateDemHeader(header, "dem-poc.json")).toMatchObject({ cols: 3, rows: 2, spacingM: 4 });
    expect(validateTrailProfile(profile, "trail-profile-poc.json").distanceM).toHaveLength(3);
    expect(validateOsmLines({ features: [line] }, "osm-poc.geojson")).toHaveLength(1);
  });

  it("rejects a DEM header with a missing or bad number, naming the field", () => {
    expect(() => validateDemHeader({ ...header, spacingM: undefined }, "dem-poc.json")).toThrow(/^dem-poc\.json\.spacingM:/);
    expect(() => validateDemHeader({ ...header, cols: 2.5 }, "dem-poc.json")).toThrow(/^dem-poc\.json\.cols:/);
    expect(() => validateDemHeader({ ...header, originN: "342000" }, "dem-poc.json")).toThrow(/^dem-poc\.json\.originN:/);
  });

  it("rejects a trail profile with uneven, unsorted or non-numeric arrays, or a bad span", () => {
    const bad = (over: Record<string, unknown>) => () => validateTrailProfile({ ...profile, ...over }, "p");
    expect(bad({ elevationM: [180, 181] })).toThrow(/^p\.elevationM:/);
    expect(bad({ distanceM: [0, 10, 5] })).toThrow(/^p\.distanceM:/);
    expect(bad({ elevationM: [180, null, 181] })).toThrow(/^p\.elevationM:/);
    expect(bad({ bridges: [[8, 5]] })).toThrow(/^p\.bridges\[0\]:/);
  });

  it("rejects OSM features without an id, tags or a geometry", () => {
    expect(() => validateOsmLines({ features: [{ ...line, properties: { tags: {} } }] }, "o")).toThrow(/^o\.features\[0\]\.properties\.id:/);
    expect(() => validateOsmLines({ features: [{ ...line, geometry: { type: "LineString" } }] }, "o")).toThrow(/^o\.features\[0\]\.geometry\.coordinates:/);
    expect(() => validateOsmLines({}, "o")).toThrow(/^o\.features:/);
  });
});
