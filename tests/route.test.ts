import { describe, expect, it } from "vitest";
import { buildRouteModel } from "../src/data/route";

// Synthetic, tiny route — not the real 13.2km corridor — so this test is a
// fast, isolated check of the geo-projection math in src/data/route.ts
// (buildProjection / haversineMeters / pointAtT), independent of the real
// data files. See data/source-register.md for the real pipeline.

const SYNTHETIC_ROUTE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        // three points running due south, ~0.01 deg apart in latitude
        // (~1113m per step at this latitude), elevation rising linearly
        coordinates: [
          [-3.95, 53.0, 100],
          [-3.95, 52.99, 150],
          [-3.95, 52.98, 200],
        ],
      },
    },
  ],
};

const SYNTHETIC_WAYPOINTS = {
  stations: [
    {
      id: "midpoint",
      name: "Midpoint Halt",
      name_cy: "Midpoint Halt",
      lon: -3.95,
      lat: 52.99,
      opened: "test",
      closed_to_passengers: "test",
      status_2026: "test",
      source: "synthetic",
      distance_km_from_blaenau: 1.113,
      elevation_m: 150,
    },
  ],
};

const SYNTHETIC_ELEVATION_PROFILE = {
  profile: [
    { distance_km: 0, elevation_m: 100 },
    { distance_km: 2.226, elevation_m: 200 },
  ],
  min_elevation_m: 100,
  max_elevation_m: 200,
};

const EMPTY_TILES = { tileSize: 256, layers: [] };

function buildTestModel() {
  return buildRouteModel(
    SYNTHETIC_ROUTE as never,
    SYNTHETIC_WAYPOINTS as never,
    SYNTHETIC_ELEVATION_PROFILE as never,
    EMPTY_TILES as never,
  );
}

describe("buildRouteModel geo-projection", () => {
  it("computes a plausible total length from real-world haversine distance", () => {
    const model = buildTestModel();
    // 2 steps of ~1113m (1 degree of latitude ~= 111.32km) = ~2226m
    expect(model.totalLengthM).toBeGreaterThan(2200);
    expect(model.totalLengthM).toBeLessThan(2260);
  });

  it("pointAtT(0) and pointAtT(1) match the route's real start/end coordinates", () => {
    const model = buildTestModel();
    const start = model.pointAtT(0);
    const end = model.pointAtT(1);
    expect(start.lat).toBeCloseTo(53.0, 6);
    expect(end.lat).toBeCloseTo(52.98, 6);
  });

  it("pointAtT is monotonic in distance along the route", () => {
    const model = buildTestModel();
    const a = model.pointAtT(0.25);
    const b = model.pointAtT(0.75);
    expect(b.dist).toBeGreaterThan(a.dist);
  });

  it("project() agrees with the route's own derived world-space points", () => {
    const model = buildTestModel();
    const first = model.routePoints[0];
    const reprojected = model.project(first.lon, first.lat);
    expect(reprojected.x).toBeCloseTo(first.x, 6);
    expect(reprojected.y).toBeCloseTo(first.y, 6);
  });

  it("stations are snapped to a consistent position along the route (t in [0,1])", () => {
    const model = buildTestModel();
    const station = model.stations[0];
    expect(station.t).toBeGreaterThan(0);
    expect(station.t).toBeLessThan(1);
  });

  it("world-space (x,y) distance between endpoints matches the real haversine distance", () => {
    // The synthetic route runs due south with no lateral deviation, so the
    // projected world-space distance (Euclidean, scaled by WORLD_SCALE=10m/unit)
    // must equal the independently-computed haversine length — this is the
    // check that actually exercises buildProjection's meters-per-degree
    // constants, which the other assertions above do not.
    const model = buildTestModel();
    const first = model.routePoints[0];
    const last = model.routePoints[model.routePoints.length - 1];
    const worldSpaceDistM =
      Math.hypot(last.x - first.x, last.y - first.y) * 10; // WORLD_SCALE
    expect(worldSpaceDistM).toBeGreaterThan(model.totalLengthM * 0.99);
    expect(worldSpaceDistM).toBeLessThan(model.totalLengthM * 1.01);
  });
});
