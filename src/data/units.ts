// Presentation units: what the viewer reads is imperial (distances in miles, heights in feet, speeds in mph); the data,
// geometry and calculations stay metric for GIS accuracy, and are converted only here, as they are shown.
const M_PER_MILE = 1609.344;
const M_PER_FOOT = 0.3048;

/** Metres as miles, to `digits` decimal places: miles(13240) is "8.2". */
export const miles = (metres: number, digits = 1): string => (metres / M_PER_MILE).toFixed(digits);

/** Metres as whole feet, with a thousands separator: feet(247) is "810". */
export const feet = (metres: number): string => Math.round(metres / M_PER_FOOT).toLocaleString("en-GB");
