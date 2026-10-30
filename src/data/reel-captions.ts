// Iteration 2: at most 15 characters per second, inside the safe area (docs/adr/0048-overlays-safe-area-and-pacing.md).
// Every caption of the 3D compositions as data, with frame ranges (docs/adr/0036-captions-as-data.md;
// spec RL17–RL22). No caption text lives in a component.

export type CaptionPosition = "top-left" | "bottom-left" | "bottom-center" | "badge" | "attribution";
export type Caption = { id: string; text: string; from: number; to: number; position: CaptionPosition; scene?: string };

const ATTRIBUTION =
  "Welsh Government / NRW lidar DTM and DSM (OGL) · Map data © OpenStreetMap contributors (ODbL) · Map tiles © OpenTopoMap (CC-BY-SA) · DEM- and OSM-derived, not survey-grade";
const DISCLAIMER = "Concept visualisation — not an approved route";

/** The reel (2,700 frames). */
/** Legend lines, curated text (docs/adr/0038-labels-from-curated-files.md): shown by a section only while it draws the
 * style they name (spec CL7, BL14). */
export const LEGEND = {
  hatched: "Hatched: approximate position or form",
  translucent: "Translucent: approved or demolished, not standing",
} as const;
export const legendLines = (on: { hatched: boolean; translucent: boolean }): string[] => [...(on.hatched ? [LEGEND.hatched] : []), ...(on.translucent ? [LEGEND.translucent] : [])];
/** A section's legend: hatched bridges are named in ground scenes only; from the air a deck is a few pixels and its
 * hatching cannot be seen (t10 R-L4). */
export const sectionLegend = (kind: "ground" | "aerial", bridges: number, translucent: boolean): string[] => legendLines({ hatched: kind === "ground" && bridges > 0, translucent });

export const CAPTIONS: Caption[] = [
  { id: "disclaimer", text: DISCLAIMER, from: 0, to: 2700, position: "badge" },
  { id: "attribution", text: ATTRIBUTION, from: 0, to: 2700, position: "attribution" },
  { id: "intro-title", text: "Blaenau Ffestiniog ↔ Trawsfynydd — a cycling concept on the former Bala and Festiniog Railway", from: 15, to: 236, position: "top-left", scene: "intro" },
  { id: "heritage", text: "Mothballed, not dismantled. Heritage rail and rail-with-trail have both been proposed.", from: 255, to: 470, position: "top-left", scene: "heritage" },
  { id: "overview-title", text: "13.2 km of trackbed, 170–247 m above sea level — shown from real lidar terrain", from: 500, to: 700, position: "top-left", scene: "overview" },
  { id: "live-station", text: "Blaenau Ffestiniog: still a live station (Conwy Valley Line, Ffestiniog Railway)", from: 795, to: 990, position: "top-left", scene: "blaenau" },
  { id: "vale-north-title", text: "Vale of Ffestiniog — the trackbed drops towards the valley floor", from: 1100, to: 1260, position: "top-left", scene: "vale" },
  { id: "vale-title", text: "Vale of Ffestiniog: past the old Festiniog station site, demolished by 2011", from: 1365, to: 1545, position: "top-left", scene: "vale" },
  { id: "private-home", text: "Maentwrog Road — former station, now a private home", from: 1650, to: 1800, position: "top-left", scene: "maentwrog" },
  { id: "decommissioning", text: "Trawsfynydd power station: decommissioning site — not part of the proposed trail", from: 1940, to: 2135, position: "top-left", scene: "trawsfynydd" },
  { id: "concept-card", text: "Concept visualisation only. Not an approved cycle route, engineering design or confirmation of landowner agreement.", from: 2455, to: 2700, position: "bottom-center", scene: "closing" },
];

/** The 20 s photoreal proof of concept (600 frames; docs/adr/0054-photoreal-layer.md): the trail is labelled a proposal
 * as it first appears (H2b), the rider's view is named as the rider's, and the closing statement runs out the shot. */
export const PHOTO_CAPTIONS: Caption[] = [
  { id: "disclaimer", text: DISCLAIMER, from: 0, to: 600, position: "badge" },
  { id: "attribution", text: ATTRIBUTION, from: 0, to: 600, position: "attribution" },
  { id: "section-title", text: "Maentwrog Road · km 7.7–9.7 of the mothballed Bala–Festiniog line", from: 0, to: 170, position: "top-left" },
  { id: "proposed-label", text: "Proposed trail (concept): 3 m shared-use path on the old trackbed", from: 0, to: 160, position: "bottom-left" },
  { id: "riders-view", text: "Rider's view at handlebar height; gradients from the lidar profile", from: 180, to: 345, position: "bottom-left" },
  { id: "closing", text: "Concept only. Mothballed line; heritage rail has been proposed. Not an approved route.", from: 410, to: 600, position: "top-left" },
];
/** The photo look's legend (spec CL7; ADR 38 curated text): the OSM bridge's generic form, and that the people and the
 * levelled, cleared verges are the concept's, not the corridor's today (review 2026-10-30). */
export const PHOTO_LEGEND = {
  bridge: "Bridge: OSM position, approximate generic form",
  people: "People: illustrative",
  corridor: "Verges levelled and cleared for the concept",
} as const;
/** The legend line for registered earthworks a drone shot flies over (spec G8): their km (or km range), marked
 * approximate and DEM-derived, as the register's notes say. */
export const photoEarthworksLine = (fromKm: number, toKm: number): string =>
  toKm - fromKm < 0.005 ? `Earthwork at km ${fromKm.toFixed(2)}: approximate, DEM-derived` : `Earthworks at km ${fromKm.toFixed(2)}–${toKm.toFixed(2)}: approximate, DEM-derived`;

/** The 12 s Maentwrog proof of concept on its own (360 frames), with the ranges its render checks expect. */
export const POC_CAPTIONS: Caption[] = [
  { id: "disclaimer", text: DISCLAIMER, from: 0, to: 360, position: "badge" },
  { id: "attribution", text: ATTRIBUTION, from: 0, to: 360, position: "attribution" },
  { id: "section-title", text: "Maentwrog Road · km 7.7–9.7 of the mothballed Bala–Festiniog line", from: 0, to: 170, position: "top-left" },
  { id: "proposed-label", text: "Proposed trail (concept): 3 m shared-use path on the old trackbed", from: 0, to: 160, position: "bottom-left" },
  { id: "closing", text: "Concept only. Mothballed line; heritage rail has been proposed. Not an approved route.", from: 170, to: 360, position: "top-left" },
];
