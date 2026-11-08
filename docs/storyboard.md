# Storyboard — concept video (target ~100s)

Grounded in the verified data in `data/waypoints.json` and
`data/elevation-profile.json`. Distances/elevations below are the real
computed figures, not placeholders. Timings are a first pass for a
1920×1080, 30fps cut — expect to adjust once scenes are built.

| # | Scene | Time | Camera / animation | On-screen content | Grounded in |
|---|---|---|---|---|---|
| 1 | Introduction | 0:00–0:10 | Aerial establishing push over Eryri/Snowdonia | Title card: "Blaenau Ffestiniog ↔ Trawsfynydd — a cycling concept"; subtitle: "An early-stage idea, not an approved route" | — |
| 2 | Historic railway | 0:10–0:22 | Flat map fade-in, trackbed draws on from Blaenau south | Label: "Bala and Festiniog Railway, closed to passengers 1960, mothballed 1998"; brief heritage-restoration note | `research.md` §1 |
| 3 | Route overview | 0:22–0:34 | Camera pulls back to show full 13.2 km alignment, line traces start→end | Distance marker "13.2 km / 8.2 miles", elevation strip 170–247 m | `elevation-profile.json` |
| 4 | Blaenau Ffestiniog | 0:34–0:46 | Camera descends to ground level at the still-active station, then turns to follow the old alignment south | Label: "Blaenau Ffestiniog — still a live station today" (Conwy Valley Line + Ffestiniog Railway) | `waypoints.json: blaenau_ffestiniog` |
| 5 | Countryside / Vale of Ffestiniog | 0:46–1:04 | Camera-follow along the route past Festiniog (Llan Ffestiniog, 5.3 km) and down into the valley | Animated cyclist on trail; dip to the lowest point of the profile (~170 m) | `elevation-profile.json` min point |
| 6 | Maentwrog Road | 1:04–1:14 | Continue follow past the 2002 A470 bridge; station building shown as a private house, clearly labelled as such | Label: "Maentwrog Road — former station, now a private home" | `waypoints.json: maentwrog_road` |
| 7 | Trawsfynydd Lake Halt → Trawsfynydd | 1:14–1:32 | Climb back out of the valley toward the plateau (185 m → 247 m); lake comes into view | Label on the former nuclear power station site: "decommissioning site — not part of the proposed trail"; destination title "Trawsfynydd" | `waypoints.json: trawsfynydd_lake_halt`, `trawsfynydd` |
| 8 | Future vision | 1:32–1:45 | Aerial pull-back over the whole corridor | Closing card: distance, elevation range, and the concept disclaimer repeated | `research.md` §7 Limitations |

## Captions that must appear somewhere in the cut

- Opening or closing frame: "Concept visualisation only. Not an approved
  cycle route, engineering design or confirmation of landowner agreement."
- Scene 2 or 8: an acknowledgement that heritage-rail restoration has
  repeatedly been proposed for this corridor (even though no group is
  currently active) — see `research.md` §1. Do not present the line as
  simply "abandoned."
- Scene 4: the Blaenau Ffestiniog end is a **live, operating station** —
  don't show it as derelict.

## Known open items before this can be fully storyboarded shot-by-shot

- No bridge/cutting/structure inventory yet, so "notable railway heritage
  features" in scenes 5–7 are generic for now (cutting/embankment shapes
  from the elevation profile, not specific named structures).
- Visual reference catalogue (brief §3): `data/photo-references.json`, 1,170 geolocated
  photographs with their licences, described in `data/source-register.md`.
- Welsh-language captions/place names: the Welsh forms used in
  `waypoints.json.name_cy` are the plain place names, not translated
  signage text — don't invent bilingual trail-sign wording.
