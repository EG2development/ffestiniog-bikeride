# Source register — Trawsfynydd ↔ Blaenau Ffestiniog cycling concept

All sources accessed 2026-10-25 unless noted. This register exists so the
route data can be corrected or extended without losing track of what each
fact or coordinate came from.

## Geographic / GIS data

| Dataset | Source | Licence | Used for |
|---|---|---|---|
| Trackbed geometry | OpenStreetMap, `api.openstreetmap.org/api/0.6/map`, ways tagged `railway=disused\|abandoned\|dismantled`, `name="Bala and Festiniog Railway"` (36 way IDs, see `railway-route.geojson` properties) | ODbL 1.0 — © OpenStreetMap contributors | `railway-route.geojson`, `railway-route.gpx` |
| Elevation | Open-Meteo Elevation API (Copernicus DEM GLO-90) | Copernicus DEM: free/open, attribution requested | `elevation-profile.json`, z-values in `railway-route.geojson` |
| Station coordinates | Wikipedia article infoboxes (grid references cross-checked), see `waypoints.json.stations[].source` | CC BY-SA 4.0 (text); coordinates themselves are factual/geodetic, not copyrightable | `waypoints.json` |
| Map basemap tiles | OpenTopoMap raster tiles (`{a,b,c}.tile.opentopomap.org/{z}/{x}/{y}.png`), fetched once with an identifying User-Agent and cached locally — not fetched live at render time | CC-BY-SA; map data © OpenStreetMap contributors (ODbL), SRTM elevation | `public/maps/tiles/{12,15}/...`, `public/data/tiles-manifest.json` |

**Known gaps in the GIS layer** (do not silently fill these in — treat as
open items):
- One short OSM way (id `270718795`, near Trawsfynydd Lake Halt) did not
  connect to its neighbours by shared node and was dropped from the stitched
  line. Likely a parallel siding or a minor OSM topology gap, not a real
  break in the trackbed — needs a manual check against aerial imagery.
- The stitched start point sits ~214 m from the Blaenau Ffestiniog station
  coordinate (goods-yard throat vs. passenger platform) — close enough for
  a concept map, not for anything claiming survey accuracy.
- No bridge, tunnel, cutting or embankment inventory has been compiled yet.
  Candidate next source: Coflein (RCAHMW, https://coflein.gov.uk) and
  Ordnance Survey historical 1:25,000 mapping (National Library of Scotland
  map viewer). Coflein was queried for buildings and landmarks at reel v2 t7
  (see "Water and buildings" below), not yet for structures on the line.
- Elevation is DEM-sampled, not surveyed. Raw per-node differencing produced
  an implausible 388 m/358 m cumulative ascent/descent for a 13 km, ~30 m-net
  railway alignment — almost certainly DEM interpolation noise. The
  `elevation-profile.json` file resamples to 250 m steps (190 m/160 m
  smoothed ascent/descent) as a closer approximation, but this is still not
  a substitute for a surveyed gradient profile.

## Historical / status research (text sources, WebSearch + WebFetch, 2026-10-25)

| Topic | Source | Notes |
|---|---|---|
| Line history, opening/closing dates, station list | [Bala and Festiniog Railway — Wikipedia](https://en.wikipedia.org/wiki/Bala_and_Festiniog_Railway) | CC BY-SA 4.0 |
| Blaenau Ffestiniog station (current status) | [Wikipedia](https://en.wikipedia.org/wiki/Blaenau_Ffestiniog_railway_station) | Still a live station (Conwy Valley Line + Ffestiniog Railway) |
| Festiniog (Llan Ffestiniog) station | [Wikipedia](https://en.wikipedia.org/wiki/Festiniog_railway_station) | Site demolished by 2011 |
| Maentwrog Road station | [Wikipedia](https://en.wikipedia.org/wiki/Maentwrog_Road_railway_station) | Private residence |
| Trawsfynydd Lake Halt | [Wikipedia](https://en.wikipedia.org/wiki/Trawsfynydd_Lake_Halt_railway_station) | Built for anglers/walkers 1934; power-station-era history |
| Trawsfynydd station | [Wikipedia](https://en.wikipedia.org/wiki/Trawsfynydd_railway_station) | Private residence |
| Trawsfynydd nuclear power station & rail link | [Wikipedia](https://en.wikipedia.org/wiki/Trawsfynydd_nuclear_power_station) | NDA/Nuclear Restoration Services decommissioning context |
| Heritage restoration attempts (2016 Trawsfynydd Railway Company; 2019 Blaenau Ffestiniog & Trawsfynydd Railway Society; Bala & Ffestiniog Railway Heritage Trust) | Wikipedia (Bala and Festiniog Railway), [balaffest.org.uk](https://balaffest.org.uk/), [GOV.UK Companies House](https://find-and-update.company-information.service.gov.uk/company/11668316), [Daily Post](https://www.dailypost.co.uk/news/blaenau-ffestiniog-steam-railway-line-11912243), [Rail Forums thread](https://www.railforums.co.uk/threads/trawsfynydd-and-blaenau-ffestiniog-community-railway-company.183308/) | Trust wound down 2023 "for lack of support" per Wikipedia; Companies House shows dissolution 27 Jan 2026 |
| Nearby National Cycle Network (NCN 82, Trawsfynydd–Gellilydan) | [walkwheelcycletrust.org.uk](https://www.walkwheelcycletrust.org.uk/find-a-route-on-the-national-cycle-network/trawsfynydd-to-gellilydan) (Sustrans route page, now under the Walk Wheel Cycle Trust domain) | Confirms this route runs the opposite way around the lake, not along our corridor |
| Gwynedd Council Active Travel Network Map consultation | WebSearch snippets of democracy.gwynedd.llyw.cymru / gwynedd.llyw.cymru pages | **Not independently verified by direct page fetch — confirm before citing publicly.** Reported window: 3 Sept–26 Nov 2026 |

## Visual references (not yet gathered)

Deliverable #3 of the brief (landscape/visual reference catalogue for
Snowdonia/Eryri, Blaenau Ffestiniog slate landscape, Trawsfynydd lake, former
station buildings) has not been started. Do this before building scene
visuals so the stylised environment stays recognisable rather than generic
mountain scenery.

## Map basemap tile pipeline

Two zoom tiers are fetched once (not streamed live during render) and stored
under `public/maps/tiles/`, indexed by `public/data/tiles-manifest.json`:

- **wide** (zoom 12, 25 tiles): a large-coverage, low-res layer so wide/
  aerial shots never show gaps around the rotated map image.
- **detail** (zoom 15, 147 tiles): high-res coverage over just the route
  corridor, drawn on top for the close/medium shots.

`src/components/MapBasemap.tsx` renders both, positioning every tile with a
2D affine transform derived from its real lon/lat corners run through the
same `project()` used for the route and stations — this is what keeps the
map aligned with the route line without a separate reprojection step. To
refresh or re-extent the tiles, re-run the fetch pipeline (bbox + zoom
constants are documented in this file's git history / the fetch script) and
re-copy `tiles-manifest.json` into `public/data/`.

OpenTopoMap's tile usage policy expects a descriptive User-Agent and modest,
cached (not per-frame-repeated) use — both are satisfied here since tiles are
fetched once to disk and the composition reads local files thereafter.

## Attribution to carry into any published output

- "Route alignment: OpenStreetMap contributors, ODbL 1.0."
- "Elevation: Copernicus DEM GLO-90 via Open-Meteo."
- "Map: © OpenStreetMap contributors (ODbL) · © OpenTopoMap (CC-BY-SA) · SRTM"
  — already rendered on-screen in every scene via `RouteStage.tsx`; keep this
  visible in any re-edit, it's a licence condition, not a nicety.
- Historical facts: Wikipedia contributors, CC BY-SA 4.0 — if any text is
  quoted near-verbatim rather than paraphrased, name the article.

## 3D proof-of-concept data (Maentwrog Road, km 7.7–9.7), built 2026-10-25

Built by `python3 scripts/build_poc_data.py`, then `npm run data:earthworks` and `npm run data:sync`
(see `docs/sop-3d.md`). Outputs are in `public/data/` (`dem-poc.*`, `landcover-poc.*`,
`trail-profile-poc.json`, `osm-poc.geojson`) and `data/features-3d.json`, `data/assets-3d.json`.

| Dataset | Source | Licence | Notes |
|---|---|---|---|
| Terrain mesh | Welsh Government / NRW lidar DTM, 1 m, 32-bit COG (`wales_dtm_32bit_cog.tif`), read at its 4 m overview by HTTP range requests | Open Government Licence per the DataMapWales download page; one catalogue lists "Not Specified", so **confirm before release** | 471 × 729 nodes, 109.7–303.4 m; 0 nodata cells, so the Copernicus GLO-30 fallback was not needed (the pipeline stops if nodata appears; the fallback itself is not implemented) |
| Trail profile | Same DTM at 1 m, sampled along the OSM centreline, 25 m moving average | as above | Noise (std dev of raw minus smoothed) 0.16 m. Rail-over bridge spans and road-over-rail deck spans are interpolated (ADR 23) |
| Land cover, roads, bridges | OpenStreetMap via `api.openstreetmap.org/api/0.6/map` | ODbL | 79 roads kept (including the A470, tagged `highway=trunk`); land-cover classes per DEM node by point-in-polygon |
| Datum | WGS84 ↔ British National Grid by the OS Helmert transform | — | About ±5 m horizontally (ADR 8) |

**Gaps found while building (open):**
- **km 9.00–9.02:** the DTM shows a dip of about 1 m in the trackbed and a 3.5 m hollow beside it, where an OSM track (way 159029132, no bridge tag) crosses at grade. It may be an unmapped culvert, underbridge or level crossing. The trail follows the DTM here (11.9 % over 5 m, the steepest step in the section), and the hollow is registered as an approximate earthwork. Check against imagery or Coflein.
- **Vale south km 5.785–5.970, 6.025–6.040, 6.290–6.325 and 7.335–7.375; Trawsfynydd km 10.345–10.455, 10.535–10.645, 11.495–11.525, 11.715–11.735, 11.895–11.915, 11.995–12.185, 12.740–12.780, 12.885–12.895 and 13.025–13.045 (found at t13 of the reel; the last three added after the t14 validation):** the 1 m lidar profile along the OSM centreline climbs and drops at 5–19 % over 5 m steps (steepest 18.7 % at km 5.90 and 13.6 % at km 10.36) for stretches of 50–300 m, far beyond any railway gradient. Cause unverified: the trackbed removed or re-graded, or the OSM centreline off the trackbed. The rider in the Trawsfynydd section (km 10.30–10.37) rides through the first of these. Not yet labelled on screen; spec RL8 is open for these two windows.
- **Overbridge spans** are estimated from the OSM road width and crossing angle, not measured.
- **Lidar licence** still to confirm (see above).

## Water and buildings (reel v2, mission `msn_33e838999675db739df3c922`, built 2026-10-25/26)

| Dataset | Source | Licence | Used for |
|---|---|---|---|
| Lake levels | The lidar DTM above at its 4 m level, sampled every 5 m along each OSM water outline of 1 ha or more (`scripts/build_section_data.py`) | OGL (to confirm, as the DTM) for heights; ODbL for the outlines | `data/water-levels.json`: one level per body (relation 3084421 197.26 m, way 4684879 306.44 m, way 4685059 405.93 m); the windows' lake fill and the water surface |
| Building footprints | The windows' OSM data; tags and dates re-fetched for the candidates from `api.openstreetmap.org/api/0.6/ways` and `/relations` | ODbL | 156 footprints drawn of the windows' 1,360; tags limited to `building`, `building:levels`, `height` and `roof:shape` (no names, addresses or contacts); ways deleted in OSM are skipped |
| Building heights | Welsh Government / NRW lidar **DSM**, 1 m, 32-bit COG (`https://dmwproductionblob.blob.core.windows.net/cogs/lidar/wales_dsm_32bit_cog.tif`), with the DTM above, both at the 2 m level | OGL (to confirm, as the DTM) | 90th percentile of DSM − DTM inside each footprint, kept when 2–60 m; else levels × 3 m (1–30 levels) or 6 m, marked approximate. 152 of 156 heights are from the lidar |
| Building files | `scripts/building-candidates.ts`, `scripts/build_buildings.py` | as their sources | `public/data/sections/<w>/buildings.json`; `data/building-candidates-<w>.json` (the footprints the shots see, with the height each was tested at); `data/building-heights-<w>.json` (every height measured); the building entries in `data/features-<w>.json`, each with URLs, evidence, observed and retrieved dates, licence, confidence and status |
| Curated landmark | `data/landmarks.json`: Capel Utica, OSM way 373577738 (ODbL); Coflein NPRN 8551 (https://coflein.gov.uk/en/site/8551/, Non-commercial Government Licence); Geograph photos 443457 and 449941 (CC BY-SA 2.0) | Evidence only: nothing from Coflein or Geograph is reproduced | Status (existing, observed 2015-10-03, medium confidence) and roof form; screened with `aidefence_scan` and `aidefence_has_pii`. Not drawn as a landmark model (28–31 px in shot) |

## Photoreal layer (ADRs 54–58, built 2026-10-29; the Maentwrog window only so far)

| Dataset | Source | Licence | Used for |
|---|---|---|---|
| Canopy height grid | The lidar **DSM** minus the lidar DTM above, both at the 4 m level on the window's own DEM grid (`scripts/build_canopy.py`) | OGL (to confirm, as the DTM); the DSM's survey date is not published with the COG | `public/data/sections/maentwrog/canopy.{json,f32}`: tree heights and the absence of trees inside OSM woodland, and field trees at canopy peaks ≥ 6 m outside it (register entry `trees-canopy-maentwrog`). Maentwrog: 71,368 of 343,359 cells ≥ 2 m (20.8 %), median 9.4 m, 95th percentile 17.9 m |
| Field boundaries | OSM ways `barrier=wall\|city_wall\|retaining_wall\|hedge\|fence` and `natural=tree_row` in the window's bbox (`scripts/fetch_barriers.py`), tags cut to `barrier`, `wall`, `height`, `natural`, `leaf_type` | ODbL | `public/data/sections/maentwrog/barriers.geojson` and one `barrier` register entry per way in `data/features-maentwrog.json`: 33 walls (4 tagged `dry_stone`), 4 `city_wall`, 6 fences, no hedge or tree row mapped, no `height` tag on any |
| Canopy and boundaries, every reel window (ADR 60) | As the two rows above, for blaenau, vale-north, vale-south and trawsfynydd at 4 m and the corridor at its 16 m overview level | OGL (to confirm) and ODbL | Canopy: blaenau 19.5 % ≥ 2 m, median 6.6 m; vale-north 15.5 % ≥ 2 m, median 8.62 m; vale-south 21.5 % ≥ 2 m, median 10.59 m; trawsfynydd 11.4 % ≥ 2 m, median 8.54 m; corridor 17.4 % ≥ 2 m, median 9.36 m. Boundaries: blaenau 151 (124 wall, 16 fence, 9 hedge, 2 retaining_wall); vale-north 108 (93 wall, 12 fence, 3 hedge); vale-south 30 (25 wall, 4 fence, 1 hedge); trawsfynydd 134 (109 wall, 18 fence, 6 city_wall, 1 hedge); corridor 478 (404 wall, 55 fence, 11 hedge, 6 city_wall, 2 retaining_wall); register entries in `data/features-<window>.json` |
| Aerial ground colour (ADR 60) | Sentinel-2 L2A true-colour image (TCI, 10 m) of scene S2C_30UVD_20250712_0_L2A (12 July 2025, 0.06 % cloud), found through the Earth Search STAC API and range-read from the AWS open-data bucket `sentinel-cogs` (`scripts/build_imagery.py`), sampled on the corridor's grid at 8 m through the OS Helmert transform and UTM zone 30N | Sentinel Data Legal Notice: free, full and open use, including adaptation and distribution, with the notice "Contains modified Copernicus Sentinel data 2025" (on screen in the photo reel's attribution) | `public/data/sections/corridor/imagery.{json,u8}` (451 × 1383 pixels), register entry `imagery-corridor`; graded towards the ground scenes' palette, so its colours are the satellite's adjusted, not measured reflectance |
| Corridor land cover, roads and water (ADR 60) | OSM in the corridor window's bbox, fetched in 6 × 6 tiles by `scripts/build_section_data.py` as for the ground windows | ODbL | 939 roads, 38 water bodies, land cover by node; the line's bridges stay registered by the ground windows. The rebuild filled 434 lake cells of the corridor DEM at their shore level |
| Textures, sky | 16 Poly Haven files (eight roles, 1K diffuse and normal maps; CC0 1.0, verified on polyhaven.com/license) under `public/3d/textures/`, each with a sha256 and licence entry in `data/assets-3d.json` and named by role in `src/three/photo/assetRoles.ts`; a role without a file renders its procedural stand-in. They are photographs of similar surfaces, not of this valley. The sky is a procedural dome (no HDRI) | 2026-10-29 | — |

**Lidar licence and dates (risk K2 and design risk K16, closed 2026-10-30):** the DataMapWales LiDAR viewer
(https://datamap.gov.wales/maps/lidar-viewer/) states "Open Government Licence for Public Sector Information (OGL)"
(OGL v3) and lists the DTM and DSM COGs used here as the published products; the tile catalogue WFS
(`geonode:welsh_government_lidar_tile_catalogue_2020_2023`) dates the corridor tiles SH6742–SH7042 to flights on
2022-01-11 (delivery 20, 1 m, Bluesky International for NRW). Attribution: "Contains public sector information licensed
under the Open Government Licence v3.0". Every "OGL (to confirm)" above is therefore confirmed; the per-layer metadata
pages still show "Not specified", which is a catalogue gap, not a licence condition.

**Gradient standard (for the open RL8 stretches):** the same guidance, §9.7.2 and Table 9.7: desirable maximum 5 %,
absolute maximum 8 %, and a 4 % grade for at most 50 m, 3 % for 80 m, 2 % for 150 m.

**Trail width source (spec TR1, closed 2026-10-29):** the Welsh Government *Active Travel Act Guidance* (2021;
https://www.gov.wales/active-travel-act-guidance), §11.16.5 and Table 11.5 give a recommended minimum width of 3.0 m
for shared use routes carrying up to 300 pedestrians and 300 cyclists per hour (4.5 m above 300 cyclists per hour);
its design-element sheet for a retained shared use path gives a desirable minimum of 3.0 m and an absolute minimum of
2.5 m. The trail's 3.0 m (`TRAIL_WIDTH_M`) is therefore the guidance's minimum, not a design.

**Gaps (open):**
- Wall and fence heights are typical values, not surveyed (no OSM `height` tag in the window); the four `city_wall`
  ways are drawn as walls and may be retaining walls.
- Where a mapped boundary crosses the trackbed it is drawn open for 3 m either side of the centreline: a proposal (a
  gate or stile), not a mapped gap.
- Tree species, crown form and the ground textures are generic; only positions, heights and the land-cover class are
  from data.

**Findings (open):**
- **A building on the trackbed, near km 10.93.** OSM way 289033748 (a building mapped 2014-06-21, 4.9 m in the lidar DSM, about 34 × 32 m) stands on a 54 m stretch that OSM tags `railway=dismantled` (way 1344840040, edited 2024-12-22, between the `abandoned` ways 31966910 and 1344840045). The proposed trail on the alignment would have to pass round it. Kept and listed (spec BL7); not yet checked on the ground or in imagery.
- **The Trawsfynydd reactor halls** (probably ways 289033763 and 289033764, about 54 m today per World Nuclear News, 2025-10-07 and 2026-05-29; reduction to about 25 m planned, not started) are outside every Trawsfynydd ground frame, so they are not drawn.

