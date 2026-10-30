// Photoreal layer: the look's numbers in one place, as the clarity constants are (docs/adr/0054-photoreal-layer.md,
// docs/adr/0046-clarity-tuned-as-data.md). Tuned by render; the figures are recorded in docs/validation-3d.md.

/** Post-processing (docs/adr/0055-post-processing-takeover.md): tone mapping exposure, ambient occlusion and the grade. */
/** The buff the gravel texture is tinted with: paler than the concept trail's #d8b06a, still unlike any land cover. */
export const PHOTO_TRAIL_TINT = "#dccbaa";

export const POST = {
  /** AgX tone mapping, which keeps saturated greens from clipping; the exposure sets the frame's mean luma */
  exposure: 0.98,
  /** GTAO radius in world units (1 = 10 m): occlusion from grass, walls and trunks at 2.5 m, not from whole hillsides */
  aoRadius: 0.25,
  aoIntensity: 0.85,
  /** the grade: a mild vignette and a touch less saturation, as an overcast Welsh sky gives */
  vignette: 0.22,
  saturation: 0.94,
} as const;

/** The grass clump the view draws, metres: three bent blades, darker at the base. */
export const GRASS = { bladeWidthM: 0.09, bladeHeightM: 0.26, blades: 3, base: "#3a5221", tip: "#78903e" } as const;

/** A Sentinel-2 true-colour image as ground colour (docs/adr/0060-reel-in-the-photo-look.md): the TCI's 8-bit values are
 * linear in surface reflectance, so value / 255 × gain is a linear albedo; the saturation lifts the colours the
 * satellite's view through the air has flattened, and the tint (linear, per channel) warms its July greens to the ground
 * scenes' palette, so a cut between an aerial and a ground scene keeps one look (spec CL6: hue and saturation within 15 %). */
export const IMAGERY_GRADE = { gain: 1.0, saturation: 1.1, tint: [1.6, 1.0, 0.7] } as const;

/** Barrier colours until a textured material lands: stone, leaf and weathered timber. */
export const BARRIER_COLOURS = { wall: "#8c877a", hedge: "#3c5a2a", fence: "#6a5a48" } as const;
