// Measurement masks (docs/adr/0044-mask-renders-for-measurement.md): under a mask every material is unlit black
// except the masked class, in white, so the render checks can count one class's pixels. The reel never sets one.
/** `landmarks`: the landmarks alone in white, every other building black (spec BL13). */
export type Mask = "water" | "water-expected" | "trees" | "trees-sun" | "trail" | "roads" | "terrain" | "buildings" | "landmarks" | "cyclist";
export type MaskClass = "water" | "trees" | "trail" | "roads" | "terrain" | "buildings" | "landmarks" | "cyclist" | "bridges";

/** The flat colour a class takes under the mask, or null when no mask is set (normal rendering). */
export function maskColour(mask: Mask | undefined, cls: MaskClass): "#ffffff" | "#000000" | null {
  if (!mask) return null;
  const target = mask === "water-expected" ? "water" : mask === "trees-sun" ? "trees" : mask;
  return cls === target ? "#ffffff" : "#000000";
}
