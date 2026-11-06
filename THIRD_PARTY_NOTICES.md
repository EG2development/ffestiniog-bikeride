# Third-party data, assets and notices

This repository redistributes processed copies of open data and open assets, and fetches others at build time. Each
is listed here with its source, its licence and the attribution it requires. The full provenance of every figure,
with dates and request details, is in `data/source-register.md`; the 3D asset register with file hashes is
`data/assets-3d.json`. The project's own licence (`LICENSE`) does not cover these: each stays under its own terms.

## Datasets redistributed in this repository

| Dataset | Files | Source | Licence | Required attribution |
|---|---|---|---|---|
| OpenStreetMap: railway alignment, roads, land cover, water, barriers, buildings, bus stops, power lines, watercourses | `data/railway-route.geojson`, `data/railway-route.gpx`, `data/bus-stops.json`, `data/features-*.json`, `data/building-*.json`, `public/data/osm-poc.geojson`, `public/data/sections/*/osm.geojson`, `public/data/sections/*/barriers.geojson`, `public/data/sections/*/buildings.json`, `public/data/sections/*/landcover.*` | OpenStreetMap, `api.openstreetmap.org` | [Open Database Licence (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). These files are derivative databases and are offered under the ODbL. | "© OpenStreetMap contributors" with a link to https://www.openstreetmap.org/copyright |
| OpenTopoMap raster tiles (zoom 12 and 15, 172 tiles) used as the 2D video's basemap | `public/maps/tiles/**`, `public/data/tiles-manifest.json` | OpenTopoMap, `tile.opentopomap.org` | [CC BY-SA](https://opentopomap.org/about) (as OpenTopoMap publishes its tiles); map data © OpenStreetMap contributors (ODbL), elevation SRTM | "© OpenStreetMap contributors (ODbL) · © OpenTopoMap (CC-BY-SA) · SRTM". Renders that include these tiles (the 2D `CyclingVision` video and the concept-look stills) carry this credit on screen and are share-alike. |
| Welsh Government / Natural Resources Wales lidar DTM and DSM (2020–2023 programme, 1 m; 2007 and 2009 archive) | `public/data/dem-poc.f32`, `public/data/sections/*/dem.f32`, `public/data/sections/*/canopy.f32`, `data/lidar-*.json`, `data/building-heights-*.json`, `data/water-levels.json` | DataMapWales cloud-optimised GeoTIFFs | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) | "Contains public sector information licensed under the Open Government Licence v3.0" |
| DataMapWales records: lidar tile catalogues, Cadw listed buildings, RCAHMW National Monuments Record of Wales sites | `data/dmw-layers.json`, entries copied into `data/features-*.json` | DataMapWales WFS, `datamap.gov.wales` | Open Government Licence v3.0 | "Designated Historic Asset GIS Data, The Welsh Historic Environment Service (Cadw), 2026-10-30, licensed under the Open Government Licence"; "This site data is from the National Monuments Record of Wales (NMRW), produced by RCAHMW. © Crown Database Right: RCAHMW, licensed under the Open Government Licence 3.0"; "Contains Natural Resources Wales information © Natural Resources Wales and Database Right" |
| Ordnance Survey OS OpenMap – Local, building outlines (SH tile, release of 2026-10-26) | `data/os-buildings-*.geojson`, `data/building-currency-*.json`, copies under `public/data/` | OS Downloads API | [Open Government Licence v3.0](https://www.ordnancesurvey.co.uk/products/os-open-map-local) | "Contains OS data © Crown copyright and database right 2026" |
| Copernicus Sentinel-2 L2A true-colour image, scene S2C_30UVD_20250712_0_L2A | `public/data/sections/corridor/imagery.u8`, `imagery.json` | AWS `sentinel-cogs` open-data bucket via Earth Search | [Legal notice on the use of Copernicus Sentinel data](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice) | "Contains modified Copernicus Sentinel data 2025" |
| Copernicus DEM GLO-90 elevations via the Open-Meteo Elevation API | `data/elevation-profile.json`, z values in `data/railway-route.geojson`, embedded in `public/maps/route-preview.html` | Open-Meteo | [CC BY 4.0](https://open-meteo.com/en/terms) (Open-Meteo); Copernicus DEM terms for the underlying model | "Elevation: Copernicus DEM GLO-90 via Open-Meteo (CC BY 4.0)" |
| Station coordinates and line history | `data/waypoints.json`, `docs/research.md` | Wikipedia article infoboxes and text | Facts and coordinates are not copyrightable; any quoted text is [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | "Wikipedia contributors, CC BY-SA 4.0" where text is quoted |
| Photograph references (links, photographers, licences and thumbnail URLs only; no images are copied) | `data/photo-references.json` | Wikimedia Commons and Geograph APIs | Per photograph, recorded in the file (mostly CC BY-SA 2.0) | Credit the photographer and keep the licence if any image is ever reproduced |
| Landmark notes (paraphrased, nothing reproduced) | `data/landmarks.json` | Coflein (RCAHMW), Gwynedd Council planning pages, gov.uk | Coflein text is under the Non-Commercial Government Licence; gov.uk under OGL v3. Used as evidence only. | None for paraphrase; do not reproduce Coflein text in a commercial context |

## Assets fetched at build time (not in the repository)

| Asset | Fetched to | Source | Licence |
|---|---|---|---|
| Poly Haven 2K textures, three models and the sky `kloofendal_48d_partly_cloudy_puresky` | `out/blender/vendor/polyhaven/` by `npm run blender:assets` (`scripts/blender/fetch-assets.mjs`) | [Poly Haven](https://polyhaven.com) | [CC0 1.0](https://polyhaven.com/license) |
| MakeHuman system assets (skins, hair, eyebrows, clothes, shoes) for the cast | `out/blender/vendor/mpfb/` by the same script | [MakeHuman community](https://www.makehumancommunity.org) | CC0 1.0 (the `makehuman_system_assets_cc0` pack) |
| MPFB add-on 2.0.18 (the MakeHuman plug-in for Blender) | Installed in Blender by the user | [extensions.blender.org](https://extensions.blender.org/add-ons/mpfb/) | GPL-3.0-or-later (not redistributed here) |
| Inter font, used for captions and signs | Blender's own `datafiles/fonts/Inter.woff2` | [Inter](https://rsms.me/inter/) | SIL Open Font Licence 1.1 |
| Leaflet 1.9.4 for `public/maps/route-preview.html` | Loaded from unpkg in the browser; live tiles from `tile.openstreetmap.org` | [Leaflet](https://leafletjs.com) | BSD-2-Clause; tiles ODbL with "© OpenStreetMap contributors" shown on the page |

## Assets tracked in this repository

| Asset | Files | Source | Licence |
|---|---|---|---|
| Eight Poly Haven texture sets (1K diffuse and normal maps) | `public/3d/textures/**` (sha256 in `data/assets-3d.json`) | Poly Haven | CC0 1.0 |
| The procedural cyclist, the terrain, trail, bridge, tree, wall, people and sky code | `src/`, `scripts/blender/` | This project | The repository licence (`LICENSE`) |
| Music, birdsong and tyre ambience | Generated into `out/` by `scripts/film/make_audio.py` and `scripts/social/make_audio.py` | Synthesised by the scripts; no samples | The repository licence |
| Renders and evidence stills | `docs/images/*.jpg`, `docs/evidence/photo/*.jpg` | This project | The repository licence for the Blender film frames in `docs/images/`; the concept-look stills in `docs/evidence/photo/` include OpenTopoMap tiles and are CC BY-SA |

## Dependencies

npm packages are not vendored; their licences are in `node_modules/*/LICENSE` after `npm ci`. Note that
[Remotion](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) is source-available: free for individuals,
non-profits and companies of up to three people, and licensed per seat above that. three.js, React and the other
dependencies are MIT.

## Not in this repository on purpose

Captures of the Gwynedd Council map viewer on an Ordnance Survey MasterMap base (Crown copyright, under the council's
own OS licence) were used as evidence only and are kept outside version control (`docs/new-images/` is ignored). They
must not be committed or published.
