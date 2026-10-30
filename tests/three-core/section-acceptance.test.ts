import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { wgs84ToBng } from "../../src/three-core/bng";
import { heightAtBng } from "../../src/three-core/dem";
import { validateDemHeader } from "../../src/three-core/registers";
import type { DemGrid } from "../../src/three-core/types";
import { readJson, readProjectFile, realRoute, ROOT } from "./fixtures";

// Per-window acceptance on the real data (spec RL5, RL6, RL8). Fails until the pipeline has built each window.
const WINDOWS: Record<string, { km: [number, number]; levelM: number }> = {
  corridor: { km: [0, 13.24], levelM: 16 },
  blaenau: { km: [0, 1.5], levelM: 4 },
  "vale-north": { km: [1.5, 4.8], levelM: 4 },
  "vale-south": { km: [4.8, 7.7], levelM: 4 },
  maentwrog: { km: [7.7, 9.7], levelM: 4 },
  trawsfynydd: { km: [9.7, 13.24], levelM: 4 },
};

function windowGrid(id: string): DemGrid {
  const dir = `public/data/sections/${id}`;
  expect(existsSync(resolve(ROOT, dir, "dem.json")), `${dir}/dem.json (run the section pipeline for "${id}")`).toBe(true);
  const header = validateDemHeader(readJson<unknown>(`${dir}/dem.json`), `${dir}/dem.json`);
  const buf = readProjectFile(`${dir}/${header.file}`);
  return { ...header, heights: new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), sourceIndex: new Uint8Array(readProjectFile(`${dir}/${header.sourceFile}`)) };
}

// RL8: the steepest 5 m step of each window's trail profile. Listed dips (data/source-register.md) are excused.
// vale-south and trawsfynydd do not meet the 4 % limit (t13 audit: 18.7 % at km 5.90 and 13.6 % at km 10.36 over
// sustained stretches); spec RL8/RL9 record them as open, and this test expects them to fail until the profiles
// are explained or corrected (it then fails the other way, which is the signal to drop them from RL8_OPEN).
const LISTED_DIPS: Record<string, [number, number][]> = { maentwrog: [[8985, 9030]] };
const RL8_OPEN = new Set(["vale-south", "trawsfynydd"]);

describe.each(Object.entries(WINDOWS))("window %s", (id, w) => {
  it("RL5/RL6: has a lidar DTM at its level that agrees with the route's elevations over its km range (median ≤ 10 m, max ≤ 30 m)", () => {
    const grid = windowGrid(id);
    expect(grid.spacingM).toBe(w.levelM);
    const raw = readJson<{ source?: string; crs?: string; kmRange?: number[] }>(`public/data/sections/${id}/dem.json`);
    expect(raw.source, "the header names the lidar").toMatch(/lidar/i);
    expect(raw.crs).toBe("EPSG:27700");
    expect(raw.kmRange).toEqual([w.km[0], w.km[1]]);
    const diffs = realRoute()
      .routePoints.filter((p) => p.dist >= w.km[0] * 1000 && p.dist <= w.km[1] * 1000)
      .map((p) => {
        const { e, n } = wgs84ToBng(p.lon, p.lat);
        const h = heightAtBng(grid, e, n);
        expect(h, `height at ${p.dist.toFixed(0)} m`).not.toBeNull();
        return Math.abs(h! - p.ele);
      })
      .sort((a, b) => a - b);
    expect(diffs.length).toBeGreaterThan(5);
    expect(diffs[Math.floor(diffs.length / 2)]).toBeLessThanOrEqual(10); // RL5 as amended at t7: the reference is a 90 m DSM
    expect(diffs[diffs.length - 1]).toBeLessThanOrEqual(30);
    if (id === "corridor") expect((grid.cols - 1) * (grid.rows - 1) * 2, "corridor triangles").toBeLessThanOrEqual(400_000);
  });

  (RL8_OPEN.has(id) ? it.fails : it)("RL8: the trail profile's steepest 5 m step is ≤ 4 % outside the listed dips", () => {
    if (w.levelM === 16) return; // the corridor is aerial; its profile only places the trail line
    const p = readJson<{ distanceM: number[]; elevationM: number[] }>(`public/data/sections/${id}/trail-profile.json`);
    let worst = { g: 0, at: 0 };
    for (let i = 1; i < p.distanceM.length; i++) {
      const [d0, d1] = [p.distanceM[i - 1], p.distanceM[i]];
      if ((LISTED_DIPS[id] ?? []).some(([a, b]) => d0 >= a && d1 <= b)) continue;
      const g = (Math.abs(p.elevationM[i] - p.elevationM[i - 1]) / (d1 - d0)) * 100;
      if (g > worst.g) worst = { g, at: d0 };
    }
    expect(worst.g, `steepest step ${worst.g.toFixed(1)} % at ${worst.at} m`).toBeLessThanOrEqual(4);
  });
});
