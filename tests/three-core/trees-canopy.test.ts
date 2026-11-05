import { describe, expect, it } from "vitest";
import { wgs84ToBng } from "../../src/three-core/bng";
import { validateCanopyHeader, validateFeatures, validateImageryHeader } from "../../src/three-core/registers";
import { imageryNodeColours, imageryPixels } from "../../src/three-core/shading";
import { FILM_IMAGERY_GRADE, IMAGERY_GRADE } from "../../src/three-core/photoLook";
import type { Trail } from "../../src/three-core/trail";
import { NOMINAL_TREE_HEIGHT_M, placeTrees, treesInShots, type TreeInstance } from "../../src/three-core/trees";
import type { DemGrid, LandCover } from "../../src/three-core/types";
import { syntheticRoute } from "./fixtures";

// Tree heights and field trees from the lidar canopy (docs/adr/0057-canopy-heights-from-lidar.md).

const route = syntheticRoute();
const { e: e0, n: n0 } = wgs84ToBng(route.routePoints[0].lon, route.routePoints[0].lat);
const cols = 40;
const rows = 40;
const dem: DemGrid = { cols, rows, spacingM: 4, originE: e0 - 80, originN: n0 + 80, heights: new Float32Array(cols * rows).fill(150), sourceIndex: new Uint8Array(cols * rows), nodata: -9999 };
// west half woodland, east half grass
const classes = new Uint8Array(cols * rows);
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) classes[r * cols + c] = c < cols / 2 ? 0 : 1;
const land: LandCover = { legend: ["woodland", "grass/farmland"], classes };
const noTrail = { samples: [] } as unknown as Trail;
const nodeOf = (t: { x: number; z: number }) => {
  const { lon, lat } = route.unproject(t.x, t.z);
  const { e, n } = wgs84ToBng(lon, lat);
  return { r: Math.round((n0 + 80 - n) / 4), c: Math.round((e - (e0 - 80)) / 4) };
};

describe("placeTrees with a canopy", () => {
  it("keeps the woodland placements where it is, drops nodes the lidar saw no tree on, and scales the rest to the measured height", () => {
    const without = placeTrees(dem, land, route.project, noTrail, { probability: 1, nearZoneM: Infinity });
    const canopy = new Float32Array(cols * rows).map((_, i) => (classes[i] === 0 ? 18 : 0)); // 18 m over the wood, nothing over the grass
    for (let r = 0; r < rows; r++) for (let c = 0; c < 5; c++) canopy[r * cols + c] = 0.5; // the five western columns were felled
    const withC = placeTrees(dem, land, route.project, noTrail, { probability: 1, nearZoneM: Infinity, canopy });
    const all = (o: ReturnType<typeof placeTrees>) => [...o.conifer, ...o.broadleaf];
    expect(all(without).length).toBeGreaterThan(600);
    expect(all(withC).length).toBeLessThan(all(without).length);
    for (const t of all(withC)) expect(nodeOf(t).c, "no tree on a felled node").toBeGreaterThanOrEqual(5);
    // every kept tree stands where the no-canopy run put one, at the canopy's height
    const key = (t: { x: number; z: number }) => `${t.x.toFixed(6)},${t.z.toFixed(6)}`;
    const before = new Set(all(without).map(key));
    for (const t of withC.conifer) {
      expect(before.has(key(t))).toBe(true);
      expect(t.scale).toBeCloseTo(18 / NOMINAL_TREE_HEIGHT_M.conifer, 6);
    }
    for (const t of withC.broadleaf) expect(t.scale).toBeCloseTo(18 / NOMINAL_TREE_HEIGHT_M.broadleaf, 6);
    expect(all(withC).every((t) => t.tint !== undefined && t.tint >= 0.85 && t.tint <= 1.15 && [0, 1, 2].includes(t.variant!))).toBe(true);
  });

  it("grows a field tree outside OSM woodland where the canopy peaks above the field-tree height, and nowhere else", () => {
    const canopy = new Float32Array(cols * rows).fill(0);
    // one 9 m tree in the grass at node (10, 30) with a 2 m skirt around it, a 4 m bush at (30, 30)
    const at = (r: number, c: number, h: number) => (canopy[r * cols + c] = h);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) at(10 + dr, 30 + dc, 2);
    at(10, 30, 9);
    at(30, 30, 4);
    const out = placeTrees(dem, land, route.project, noTrail, { probability: 0, nearZoneM: Infinity, canopy });
    expect(out.conifer).toEqual([]);
    expect(out.broadleaf.length).toBe(1);
    const t = out.broadleaf[0];
    expect(nodeOf(t)).toEqual({ r: 10, c: 30 });
    expect(t.scale).toBeCloseTo(9 / NOMINAL_TREE_HEIGHT_M.broadleaf, 6);
    // the field tree's draws do not shift the woodland's: with probability 1 the woodland placements match the run without a canopy
    const wood = placeTrees(dem, land, route.project, noTrail, { probability: 1, nearZoneM: Infinity });
    const both = placeTrees(dem, land, route.project, noTrail, { probability: 1, nearZoneM: Infinity, canopy: new Float32Array(cols * rows).fill(12).map((v, i) => (classes[i] === 0 ? v : canopy[i])) });
    expect(both.conifer.map((t) => [t.x, t.z])).toEqual(wood.conifer.map((t) => [t.x, t.z]));
    expect(both.broadleaf.length).toBe(wood.broadleaf.length + 1);
  });

  it("refuses a canopy that is not on the DEM's grid", () => {
    expect(() => placeTrees(dem, land, route.project, noTrail, { canopy: new Float32Array(10) })).toThrow(/canopy has 10 values/);
    const demHeader = { cols, rows, spacingM: 4, originE: dem.originE, originN: dem.originN };
    expect(validateCanopyHeader({ ...demHeader, file: "canopy.f32" }, "canopy.json", demHeader).file).toBe("canopy.f32");
    expect(() => validateCanopyHeader({ ...demHeader, cols: 41, file: "canopy.f32" }, "canopy.json", demHeader)).toThrow(/canopy.json.cols: canopy grid differs/);
    expect(() => validateCanopyHeader({ ...demHeader, file: "../x.f32" }, "canopy.json", demHeader)).toThrow(/plain file name/);
  });

  it("a barrier is a register kind (ADR 58)", () => {
    const [f] = validateFeatures([{ id: "barrier-t-1", kind: "barrier", category: "approximate", source: { type: "osm", ref: "way/1" }, scenes: ["Section-t"] }]);
    expect(f.kind).toBe("barrier");
  });
});

// The reel in the photo look (docs/adr/0060-reel-in-the-photo-look.md): a coarse grid's trees, and the satellite image.
describe("placeTrees on a coarse grid, and the ground image", () => {
  const all = (o: ReturnType<typeof placeTrees>) => [...o.conifer, ...o.broadleaf];

  it("treesPerNode 1 is the default placement, and 3 draws three trees a node, each inside its node's cell", () => {
    const base = { probability: 1, nearZoneM: Infinity };
    expect(placeTrees(dem, land, route.project, noTrail, { ...base, treesPerNode: 1 })).toEqual(placeTrees(dem, land, route.project, noTrail, base));
    const one = all(placeTrees(dem, land, route.project, noTrail, base));
    const three = all(placeTrees(dem, land, route.project, noTrail, { ...base, treesPerNode: 3 }));
    // three draws a node, each jittered on its own (a few fall off the grid's edge)
    expect(three.length).toBeGreaterThan(2.9 * one.length);
    expect(three.length).toBeLessThanOrEqual(3 * one.length + 30);
    for (const t of three) {
      const { lon, lat } = route.unproject(t.x, t.z);
      const { e, n } = wgs84ToBng(lon, lat);
      const fc = (e - (e0 - 80)) / 4;
      const fr = (n0 + 80 - n) / 4;
      expect(Math.abs(fc - Math.round(fc))).toBeLessThanOrEqual(0.5 + 1e-6);
      expect(Math.abs(fr - Math.round(fr))).toBeLessThanOrEqual(0.5 + 1e-6);
    }
  });

  it("canopyCover grows trees wherever the canopy stands, woodland or not, but never on a bare class, and only broadleaves outside woodland", () => {
    // a third class, built-up, in the south-east quarter; the canopy is about 8 m everywhere, rising eastwards, so it
    // peaks only along the east edge (where a field tree may stand)
    const mixed = Uint8Array.from(classes, (k, i) => (k === 1 && Math.floor(i / cols) >= rows / 2 ? 2 : k));
    const land3: LandCover = { legend: ["woodland", "grass/farmland", "built-up"], classes: mixed };
    const canopy = new Float32Array(cols * rows).map((_, i) => 8 + 0.01 * (i % cols));
    const off = placeTrees(dem, land3, route.project, noTrail, { probability: 1, nearZoneM: Infinity, canopy });
    const on = placeTrees(dem, land3, route.project, noTrail, { probability: 1, nearZoneM: Infinity, canopy, canopyCover: true });
    const cls = (t: { x: number; z: number }) => mixed[nodeOf(t).r * cols + nodeOf(t).c];
    expect(all(off).filter((t) => cls(t) === 1).length).toBeLessThanOrEqual(rows / 2); // field trees only, at the canopy's east-edge peaks
    expect(all(on).filter((t) => cls(t) === 1).length).toBeGreaterThan(150);
    expect(all(on).filter((t) => cls(t) === 2)).toEqual([]);
    expect(on.conifer.filter((t) => cls(t) !== 0)).toEqual([]);
  });

  it("grades the image (gain, saturation about the luma, tint) and colours each node from the pixel on it", () => {
    const image = { width: 3, height: 3, scale: 2, rgb: Uint8Array.from([...Array(9)].flatMap((_, i) => [10 * i, 128, 255 - 10 * i])) };
    const flat = imageryPixels(image, { gain: 1, saturation: 1, tint: [1, 1, 1] });
    const enc = (v: number) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
    expect([...flat.slice(4, 8)]).toEqual([enc(10 / 255), enc(128 / 255), enc(245 / 255), 255]);
    // saturation 0 is the luma on every channel; a tint scales one channel
    const grey = imageryPixels(image, { gain: 1, saturation: 0, tint: [1, 1, 1] });
    expect(grey[0]).toBe(grey[1]);
    expect(grey[1]).toBe(grey[2]);
    const warm = imageryPixels(image, { gain: 1, saturation: 1, tint: [1, 1, 0.5] });
    expect(warm[2]).toBeLessThan(flat[2]);
    // a 2 x 2 node grid at scale 2 reads pixels (0, 0), (0, 2), (2, 0) and (2, 2)
    const nodes = imageryNodeColours(image, flat, 2, 2);
    expect(nodes.length).toBe(12);
    expect(nodes[3] * 255).toBeCloseTo(flat[4 * 2], 3);
    expect(nodes[9] * 255).toBeCloseTo(flat[4 * 8], 3);
  });

  it("the film's grade warms vegetation as the reel's does and leaves grey slate grey (FILM_IMAGERY_GRADE)", () => {
    // a grass pixel, a slate-grey pixel and a warm brown (bracken) pixel
    const image = { width: 3, height: 1, scale: 1, rgb: Uint8Array.from([40, 90, 30, 70, 72, 76, 90, 70, 45]) };
    const reel = imageryPixels(image, IMAGERY_GRADE);
    const film = imageryPixels(image, FILM_IMAGERY_GRADE);
    expect([...film.slice(0, 3)]).toEqual([...reel.slice(0, 3)]);
    const untinted = imageryPixels(image, { ...IMAGERY_GRADE, tint: [1, 1, 1] });
    expect([...film.slice(4, 7)]).toEqual([...untinted.slice(4, 7)]); // slate keeps its own grey
    expect(reel[4] - reel[6]).toBeGreaterThan(30); // where the flat tint turned it pink-beige
    expect(film[8]).toBeLessThan(reel[8]); // brown ground half warmed
    expect(film[8]).toBeGreaterThan(untinted[8]);
  });

  it("refuses an image that is not on the DEM's grid at a whole scale", () => {
    const demHeader = { cols, rows, spacingM: 4, originE: dem.originE, originN: dem.originN };
    const ok = { ...demHeader, file: "imagery.u8", scale: 2, width: 79, height: 79 };
    expect(validateImageryHeader(ok, "imagery.json", demHeader).width).toBe(79);
    expect(() => validateImageryHeader({ ...ok, originE: 0 }, "imagery.json", demHeader)).toThrow(/imagery grid differs/);
    expect(() => validateImageryHeader({ ...ok, scale: 1.5 }, "imagery.json", demHeader)).toThrow(/whole number/);
    expect(() => validateImageryHeader({ ...ok, width: 80 }, "imagery.json", demHeader)).toThrow(/is not the 40 × 40 grid/);
  });

  it("treesInShots keeps a tree some shadow map reaches as a caster, one only a view holds without its shadow, and drops the rest", () => {
    const tree = (x: number, z: number): TreeInstance => ({ x, y: 0, z, scale: 1, yaw: 0 });
    // one camera at the origin looking down +x, 45°; the focus sits 5 units ahead, and a shadow map reaches 10 units
    const pose = { position: [0, 0.2, 0] as [number, number, number], target: [10, 0.2, 0] as [number, number, number], fovDeg: 45 };
    const near = tree(8, 2); // by the focus
    const ahead = tree(100, 3); // far ahead, in view
    const behind = tree(-60, 0); // behind the camera, far from the focus
    const aside = tree(20, 80); // well outside the 45° view, far from the focus
    const out = treesInShots({ conifer: [near, ahead], broadleaf: [behind, aside] }, [pose], [[5, 0, 0]], { shadowReach: 10 });
    expect(out.casting).toEqual({ conifer: [near], broadleaf: [] });
    expect(out.shadowless).toEqual({ conifer: [ahead], broadleaf: [] });
    // a crown's edge in view keeps it: a tree just outside the frustum line by less than its crown radius
    const edge = tree(40, 40 * Math.tan(Math.PI / 8) * (16 / 9) + 0.4);
    expect(treesInShots({ conifer: [edge], broadleaf: [] }, [pose], [[5, 0, 0]], { shadowReach: 10 }).shadowless.conifer.length).toBe(1);
  });

  it("imagery is a register kind, from a Copernicus source (ADR 60)", () => {
    const [f] = validateFeatures([{ id: "imagery-t", kind: "imagery", category: "approximate", source: { type: "copernicus", ref: "scene" }, scenes: ["Section-t"] }]);
    expect(f.kind).toBe("imagery");
  });
});
