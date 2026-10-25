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
  map viewer). Not yet queried.
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
- **Overbridge spans** are estimated from the OSM road width and crossing angle, not measured.
- **Lidar licence** still to confirm (see above).
