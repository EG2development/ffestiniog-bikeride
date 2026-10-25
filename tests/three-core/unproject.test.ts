import { describe, expect, it } from "vitest";
import { realRoute } from "./fixtures";

describe("unproject (RG5, pseudocode §2.1)", () => {
  it("is the exact inverse of project for every real route point", () => {
    const route = realRoute();
    for (const p of route.routePoints) {
      const { lon, lat } = route.unproject(p.x, p.y);
      expect(Math.abs(lon - p.lon)).toBeLessThan(1e-9);
      expect(Math.abs(lat - p.lat)).toBeLessThan(1e-9);
    }
  });
});
