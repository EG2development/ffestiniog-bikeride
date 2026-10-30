import { describe, expect, it } from "vitest";
import { load } from "./pending";

// Sky and fog from one set of constants; the fog colour is the horizon colour (spec RL11; ADR 30).
type Rgb = [number, number, number];
type Atmosphere = { zenith: Rgb; horizon: Rgb; fogDensity: number; sunAzimuthDeg: number; sunElevationDeg: number };
type Mod = { ATMOSPHERE: Record<"ground" | "aerial", Atmosphere>; fogColour: (kind: "ground" | "aerial") => Rgb };

describe("atmosphere (RL11)", () => {
  it("defines both section kinds with colours in range and ADR 18's sun", async () => {
    const { ATMOSPHERE } = await load<Mod>("src/three-core/atmosphere.ts");
    for (const kind of ["ground", "aerial"] as const) {
      const a = ATMOSPHERE[kind];
      for (const c of [...a.zenith, ...a.horizon]) expect(c).toBeGreaterThanOrEqual(0), expect(c).toBeLessThanOrEqual(1);
      expect(a.fogDensity).toBeGreaterThan(0);
      expect(a.sunAzimuthDeg).toBe(200);
      expect(a.sunElevationDeg).toBe(35);
    }
    expect(ATMOSPHERE.aerial.fogDensity).toBeLessThan(ATMOSPHERE.ground.fogDensity);
  });

  it("the fog colour equals the horizon colour for every kind", async () => {
    const { ATMOSPHERE, fogColour } = await load<Mod>("src/three-core/atmosphere.ts");
    for (const kind of ["ground", "aerial"] as const) expect(fogColour(kind)).toEqual(ATMOSPHERE[kind].horizon);
  });
});

describe("the aerial drape grade (CL6)", () => {
  it("tints the map's neutral paper at its own luma and leaves coloured features alone", async () => {
    const { gradeDrapePixels } = await import("../../src/three-core/atmosphere");
    const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
    const px = new Uint8ClampedArray([240, 238, 232, 255, /* paper */ 40, 90, 200, 255 /* water blue */]);
    gradeDrapePixels(px, { tint: "#8fb85a", alpha: 1, neutral: 0.2, brightness: 1 });
    expect(px[1], "paper turns green").toBeGreaterThan(px[0]);
    expect(px[1]).toBeGreaterThan(px[2]);
    expect(Math.abs(luma(px[0], px[1], px[2]) - luma(240, 238, 232)) / luma(240, 238, 232), "paper keeps its luma (within clipping)").toBeLessThan(0.08);
    expect([px[4], px[5], px[6]], "water keeps its colour").toEqual([40, 90, 200]);
  });
});
