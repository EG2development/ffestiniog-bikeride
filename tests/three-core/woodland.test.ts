import { describe, expect, it } from "vitest";
import { loadSection } from "../../src/blender/loadSection";
import { bngToWgs84 } from "../../src/three-core/bng";
import { buildSectionScene, configById } from "../../src/three-core/sections";
import type { Trail } from "../../src/three-core/trail";
import { placeTrees } from "../../src/three-core/trees";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { CONIFER_SHARE, WOOD, woodKindGrid, woodKindOf } from "../../src/three-core/woodland";
import { realRoute, ROOT } from "./fixtures";

// Woodland character (refs-aerial items 1, 2): the woods are mostly broadleaf, conifers in plantation blocks; the mix
// follows the OSM tags in the photo look, and the kinds share one instance budget so mapped woods can close.

describe("wood kinds from OSM tags", () => {
  it("reads leaf_type first, then landuse=forest as a plantation and natural=wood as broadleaf", () => {
    expect(woodKindOf({ natural: "wood" })).toBe("broadleaf");
    expect(woodKindOf({ landuse: "forest" })).toBe("conifer");
    expect(woodKindOf({ landuse: "forest", leaf_type: "broadleaved" })).toBe("broadleaf");
    expect(woodKindOf({ natural: "wood", leaf_type: "needleleaved" })).toBe("conifer");
    expect(woodKindOf({ natural: "wood", leaf_type: "mixed" })).toBe("mixed");
    expect(woodKindOf({ natural: "scrub" })).toBeNull();
    // natural woods are nearly all broadleaf, an untagged wood 85-90 %, a plantation mostly conifer
    expect(1 - CONIFER_SHARE[WOOD.broadleaf]).toBeGreaterThanOrEqual(0.95);
    expect(1 - CONIFER_SHARE[WOOD.unknown]).toBeGreaterThanOrEqual(0.85);
    expect(1 - CONIFER_SHARE[WOOD.unknown]).toBeLessThanOrEqual(0.9);
    expect(CONIFER_SHARE[WOOD.conifer]).toBeGreaterThanOrEqual(0.85);
  });
});

describe("the tree mix by wood kind (synthetic)", () => {
  const route = realRoute();
  const cols = 60;
  const rows = 120;
  const dem: DemGrid = { originE: 270000, originN: 340000, spacingM: 4, cols, rows, heights: new Float32Array(cols * rows).fill(150), sourceIndex: new Uint8Array(cols * rows) } as DemGrid;
  const land: LandCover = { legend: ["woodland"], classes: new Uint8Array(cols * rows) };
  const noTrail = { samples: [] } as unknown as Trail;
  const opts = { nearZoneM: Infinity, maxTrees: 100_000 };
  const share = (kinds?: Uint8Array) => {
    const t = placeTrees(dem, land, route.project, noTrail, { ...opts, ...(kinds && { woodKinds: kinds }) });
    return t.conifer.length / (t.conifer.length + t.broadleaf.length);
  };

  it("draws 55 % conifers without wood kinds (the concept look), and each kind's share with them", () => {
    expect(share()).toBeCloseTo(0.55, 1);
    expect(share(new Uint8Array(cols * rows).fill(WOOD.broadleaf))).toBeLessThan(0.08);
    expect(share(new Uint8Array(cols * rows).fill(WOOD.conifer))).toBeGreaterThan(0.85);
    expect(share(new Uint8Array(cols * rows).fill(WOOD.unknown))).toBeCloseTo(CONIFER_SHARE[WOOD.unknown], 1);
  });

  it("puts the same trees in the same places: only their kind follows the tags", () => {
    const pos = (t: ReturnType<typeof placeTrees>) => [...t.conifer, ...t.broadleaf].map((p) => `${p.x},${p.z}`).sort();
    const a = placeTrees(dem, land, route.project, noTrail, opts);
    const b = placeTrees(dem, land, route.project, noTrail, { ...opts, woodKinds: new Uint8Array(cols * rows).fill(WOOD.broadleaf) });
    expect(pos(b)).toEqual(pos(a));
  });

  it("shares twice the per-kind cap between the kinds, spread over the whole wood", () => {
    const kinds = new Uint8Array(cols * rows).fill(WOOD.broadleaf);
    const t = placeTrees(dem, land, route.project, noTrail, { nearZoneM: Infinity, maxTrees: 500, woodKinds: kinds });
    const n = t.conifer.length + t.broadleaf.length;
    expect(n).toBeLessThanOrEqual(1000);
    expect(n).toBeGreaterThan(800); // the per-kind cap alone would stop the broadleaves at 500
    expect(t.broadleaf.length).toBeGreaterThan(500);
    const northings = [...t.conifer, ...t.broadleaf].map((p) => {
      const ll = route.unproject(p.x, p.z);
      return ll.lat;
    });
    const span = Math.max(...northings) - Math.min(...northings);
    const { lat: top } = bngToWgs84(dem.originE, dem.originN);
    const { lat: bottom } = bngToWgs84(dem.originE, dem.originN - (rows - 1) * dem.spacingM);
    expect(span / (top - bottom)).toBeGreaterThan(0.9);
  });
});

describe("the windows' woods", () => {
  it("reads Coed Caersaeson (km 9.3-10.9) as broadleaf, and keeps the plantation block by the Cynfal crossing conifer", () => {
    // [window, km, kind, its least share of the woodland nodes within 150 m of the line]
    for (const [config, km, kind, least] of [["trawsfynydd", [9.8, 10.8], WOOD.broadleaf, 0.9], ["vale-south", [6.5, 7.0], WOOD.conifer, 0.15]] as const) {
      const cfg = configById(config);
      const { inputs } = loadSection(ROOT, cfg, { canopy: false, barriers: false });
      const kinds = woodKindGrid(inputs.dem, inputs.land, inputs.osm);
      const near = inputs.route.routePoints.filter((p) => p.dist >= km[0] * 1000 && p.dist <= km[1] * 1000);
      const count = [0, 0, 0, 0];
      const wood = inputs.land.legend.indexOf("woodland");
      for (let r = 0; r < inputs.dem.rows; r += 2) {
        for (let c = 0; c < inputs.dem.cols; c += 2) {
          const i = r * inputs.dem.cols + c;
          if (inputs.land.classes[i] !== wood) continue;
          const { lon, lat } = bngToWgs84(inputs.dem.originE + c * inputs.dem.spacingM, inputs.dem.originN - r * inputs.dem.spacingM);
          const p = inputs.route.project(lon, lat);
          if (near.some((q) => Math.hypot(q.x - p.x, q.y - p.y) * 10 < 150)) count[kinds[i]]++;
        }
      }
      expect(count[kind] / count.reduce((a, b) => a + b, 0), `${config} km ${km.join("-")}: ${count.join(", ")}`).toBeGreaterThan(least);
    }
  }, 120_000);

  it("makes the school-run window's trees broadleaf-dominant in the photo look, as the imagery shows", () => {
    const cfg = configById("community-school");
    const { inputs } = loadSection(ROOT, cfg, { canopy: true, barriers: true });
    const { trees } = buildSectionScene(cfg, inputs, "photo");
    const n = trees.conifer.length + trees.broadleaf.length;
    expect(n).toBeGreaterThan(5000);
    expect(trees.conifer.length / n).toBeLessThan(0.2);
  }, 120_000);
});
