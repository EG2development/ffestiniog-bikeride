import { describe, expect, it } from "vitest";
import { loadExports } from "./pending";

// Candidate buildings are those a shot sees (spec BL1; ADR 49; pseudocode-reel-v2 §5.1).
type XZ = { x: number; z: number };
type Pose = { position: [number, number, number]; target: [number, number, number]; fovDeg: number };
type Mod = { visibleFootprints: (poses: Pose[], footprints: { id: string; ring: XZ[]; heightM: number }[], heightAt: (x: number, z: number) => number, opts?: { aspect?: number; far?: number }) => string[] };

const sq = (cx: number, cz: number, s = 1): XZ[] => [{ x: cx - s, z: cz - s }, { x: cx + s, z: cz - s }, { x: cx + s, z: cz + s }, { x: cx - s, z: cz + s }];

describe("visibleFootprints (BL1)", () => {
  it("lists what is in view and not behind terrain; skips what is behind the camera, out of frame or hidden", async () => {
    const { visibleFootprints } = await loadExports<Mod>("src/three-core/visibility.ts", ["visibleFootprints"]);
    const ridge = (x: number) => (x >= 60 && x <= 65 ? 30 : 0); // a 300 m ridge across the view at x 60–65
    const pose: Pose = { position: [0, 5, 0], target: [100, 5, 0], fovDeg: 45 };
    const fps = [
      { id: "ahead", ring: sq(50, 0), heightM: 10 },
      { id: "behind-camera", ring: sq(-50, 0), heightM: 10 },
      { id: "out-of-frame", ring: sq(50, 200), heightM: 10 },
      { id: "behind-ridge", ring: sq(80, 5), heightM: 10 },
    ];
    expect(visibleFootprints([pose], fps, (x) => ridge(x), { aspect: 16 / 9, far: 1000 }).sort()).toEqual(["ahead"]);
  });

  it("collects across the poses of a shot", async () => {
    const { visibleFootprints } = await loadExports<Mod>("src/three-core/visibility.ts", ["visibleFootprints"]);
    const fps = [{ id: "east", ring: sq(50, 0), heightM: 10 }, { id: "west", ring: sq(-50, 0), heightM: 10 }];
    const east: Pose = { position: [0, 5, 0], target: [100, 5, 0], fovDeg: 45 };
    const west: Pose = { position: [0, 5, 0], target: [-100, 5, 0], fovDeg: 45 };
    expect(visibleFootprints([east, west], fps, () => 0).sort()).toEqual(["east", "west"]);
  });
});
