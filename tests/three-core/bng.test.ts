import { describe, expect, it } from "vitest";
import { bngToWgs84, tmForward, tmInverse, wgs84ToBng } from "../../src/three-core/bng";
import { readJson } from "./fixtures";

const dms = (d: number, m: number, s: number) => d + m / 60 + s / 3600;

describe("British National Grid (ADR 8)", () => {
  // Ordnance Survey, "A guide to coordinate systems in Great Britain", worked example C.1
  it("matches the OS Transverse Mercator worked example to 1 mm", () => {
    const { e, n } = tmForward(dms(52, 39, 27.2531), dms(1, 43, 4.5177));
    expect(Math.abs(e - 651409.903)).toBeLessThan(0.001);
    expect(Math.abs(n - 313177.27)).toBeLessThan(0.001);
  });

  it("inverts the worked example back to its latitude and longitude", () => {
    const { lat, lon } = tmInverse(651409.903, 313177.27);
    expect(Math.abs(lat - dms(52, 39, 27.2531))).toBeLessThan(1e-8);
    expect(Math.abs(lon - dms(1, 43, 4.5177))).toBeLessThan(1e-8);
  });

  it("round-trips WGS84 -> BNG -> WGS84 within 1 cm across the corridor", () => {
    for (let i = 0; i <= 10; i++) {
      const lon = -3.95 + 0.004 * i;
      const lat = 52.9 + 0.01 * i;
      const { e, n } = wgs84ToBng(lon, lat);
      const back = bngToWgs84(e, n);
      const dyM = (back.lat - lat) * 111320;
      const dxM = (back.lon - lon) * 111320 * Math.cos((lat * Math.PI) / 180);
      expect(Math.hypot(dxM, dyM)).toBeLessThan(0.01);
    }
  });

  // Independent cross-check of axis order, signs and datum against the stations' published grid
  // references (6-figure references name a 100 m square in 100 km square SH, origin 200000, 300000).
  it("puts every station inside 150 m of its published SH grid reference", () => {
    const { stations } = readJson<{ stations: { id: string; lon: number; lat: number; grid_ref: string }[] }>(
      "data/waypoints.json",
    );
    for (const s of stations) {
      const m = /^SH(\d{3})\s?(\d{3})$/.exec(s.grid_ref);
      expect(m, `grid ref of ${s.id}`).not.toBeNull();
      const expectedE = 200000 + Number(m![1]) * 100 + 50;
      const expectedN = 300000 + Number(m![2]) * 100 + 50;
      const { e, n } = wgs84ToBng(s.lon, s.lat);
      expect(Math.hypot(e - expectedE, n - expectedN), s.id).toBeLessThan(150);
    }
  });
});
