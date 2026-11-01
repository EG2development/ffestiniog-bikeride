# Blender add-ons and Geometry Nodes toolkits for real-world geographic scenes (Blender 5.x)

Scope: tools that could help a headless, Python-driven Blender 5.2.4 LTS pipeline (Windows 11, RTX 2060 6 GB, EEVEE) that rebuilds the former Bala & Festiniog Railway corridor (Blaenau Ffestiniog to Trawsfynydd) from lidar DTM/DSM, OSM and Ordnance Survey data. Research date: 2026-11-01. The project already uses MPFB 2.0.18, Poly Haven CC0 assets, its own COG/lidar reader and its own OSM fetcher, so the question for each tool is what it adds on top of those.

Verification note: "verified" means a release note, issue tracker or listing says so. Anything taken from background knowledge and not re-checked this session is marked **[unverified]**.

## GIS importers: BlenderGIS, Blosm (blender-osm), Cesium for Blender, Google 3D tiles, GeoTIFF/DEM import

### Takeaway
BlenderGIS (GPLv3, free) has had Blender 5 fixes since December 2025 (v2.2.11 to v2.2.15). It is the only free, open add-on here that can handle arbitrary EPSG codes such as 27700 locally, but only if GDAL or pyproj is installed into Blender's Python. Blosm (GPL source; free base version, paid Pro on Gumroad) fixed a Blender 5.1 / Python 3.13 import crash in v2.7.24 (March 2026). Its terrain (about 30 m) and generic OSM buildings are worse than the project's own lidar and OSM pipeline. Google Photorealistic 3D Tiles, whether through Blosm, Tile Importer or the new MIT "CesiumForBlender", come under terms that ban offline/cached use and derived geometry, so they do not fit an openly licensed, provenance-recorded reel.

### Cited Findings
**BlenderGIS (domlysz)**
- Licence is GNU GPL v3 — [BlenderGIS LICENSE](https://raw.githubusercontent.com/domlysz/BlenderGIS/master/LICENSE)
- Features: imports Shapefile vectors, raster images, GeoTIFF DEMs and OSM XML; web basemaps in the 3D view; OSM (buildings, roads) via Overpass; SRTM/"get elevation" (OpenTopography now needs a free API key); scene georeferencing management; Delaunay terrain meshes; dropping objects onto terrain; terrain analysis with shader nodes; cameras from geotagged photos; georeferenced raster rendering. Minimum Blender stated as 2.83 — [BlenderGIS README](https://github.com/domlysz/BlenderGIS)
- Release history (the page shows day/month only, no year): v2.2.11 (06 Dec) "Bugfix for Blender 5"; v2.2.12 (06 Dec) fixes the MapTiler coords API migration; v2.2.13 (11 Dec) better info about needing a MapTiler API key for CRS search, keeps Blender 4.x compatibility; v2.2.15 (20 Dec) "bugfixes", marked Latest. Earlier, v2.2.5 moved the cache to the home app-data folder, made the Overpass/DEM server URLs editable, and renamed "get srtm" to "get elevation" — [BlenderGIS releases](https://github.com/domlysz/BlenderGIS/releases)
- Known Blender 5.0 break: the cache-folder preference threw an IDProperties TypeError because Blender 5.0 removed IDProperties support from AddonPreferences. A community patch was posted (issue #1004 / discussion #1005), and the official v2.2.11 "Bugfix for Blender 5" followed — [Issue #1004](https://github.com/domlysz/BlenderGIS/issues/1004); [Discussion #1005](https://github.com/domlysz/BlenderGIS/discussions/1005)
- Open report: Basemap not loading on Blender 5.0.1. No resolution was visible in search results — [Issue #1033](https://github.com/domlysz/BlenderGIS/issues/1033)
- blendergis.com advertises "v2.2.15 ... for Blender 5.0" but says it is not affiliated with domlysz. Treat it as unofficial and download from GitHub instead — [blendergis.com download](https://blendergis.com/download/)
- **Coordinate systems / EPSG:27700:** the reprojection engine accepts `AUTO`, `GDAL`, `PYPROJ`, `BUILTIN` or `EPSGIO`. Under AUTO it tries GDAL/osr first, then pyproj, then the built-in engine (only if the pair qualifies), then epsg.io (online, EPSG codes only). The built-in engine handles only WGS84 <-> Web Mercator (3857) and WGS84 <-> UTM; any other pair raises `ReprojError('Too limited built in reprojection capabilities')` — [BlenderGIS core/proj/reproj.py](https://raw.githubusercontent.com/domlysz/BlenderGIS/master/core/proj/reproj.py)
- CRS *search* in v2.2.13 depends on a MapTiler API key — [BlenderGIS releases](https://github.com/domlysz/BlenderGIS/releases)

**Blosm / blender-osm (vvoovv / prochitecture)**
- Source is GPL, and Pro customers also receive it under the GPL. The base version is free (optional payment): untextured OSM buildings using height and floor count, roof shapes, terrain at about 30 m, GPX tracks, water and forest polygons, roads as curves with width. Pro (paid, Gumroad) adds texture baking for 3D Tiles, tileable building textures with UVs, lit-window materials, forests and single trees, custom textures, and satellite imagery or web maps on terrain. The repo description also advertises "Google 3D cities" — [Blosm repo](https://github.com/vvoovv/blosm); [Premium Version wiki](https://github.com/vvoovv/blosm/wiki/Premium-Version)
- Blender 5.1 break and fix: issue #707 (opened 25 Mar 2026) reports `ModuleNotFoundError: No module named 'typing.io'` from `pml/antlr4/Lexer.py` on Windows Blender 5.1. The maintainer says Blender 5.1 moved to Python 3.13 (`typing.io` was deprecated in 3.12) and the fix shipped the same day in Blosm 2.7.24 (Gumroad). Closed as completed — [Blosm issue #707](https://github.com/vvoovv/blosm/issues/707)
- The GitHub releases page lists only v2.4.21, "the last release ... that worked for Blender 2.79". Current builds ship via Gumroad, not GitHub releases — [Blosm releases](https://github.com/vvoovv/blosm/releases)
- The repo README does not document Python, command-line or headless use — [Blosm repo](https://github.com/vvoovv/blosm)
- A third-party Tile Importer add-on credits Blosm as its base and says Blosm "has serious limitations when it comes to importing areas larger than 1km x 1km". It needs a Google billing account (1000 free 3D Tiles imports/month) — [Tile Importer (BlenderKit)](https://www.blenderkit.com/addons/b62311af-f1bc-43d8-845a-cdd313f32dbe/)

**Cesium**
- The official Cesium ion Blender add-on *exports/uploads* Blender models to Cesium ion for tiling, using the Khronos glTF exporter. It is not a 3D Tiles importer — [Cesium ion Blender add-on](https://github.com/cesiumgs/cesium-ion-blender-addon); [Cesium: integrating with Blender](https://cesium.com/learn/ion/integrations-learn/integrations-blender/)
- "Cesium for Blender" by CognitoBit (community, MIT, announced 10 Aug 2026 as work in progress, "not a polished release") streams Cesium World Terrain (ion or a self-hosted `layer.json`), ion TMS / Bing imagery draped on terrain, and 3D Tiles (OSM Buildings, Google Photorealistic; b3dm/glb/cmpt) with screen-space-error LOD. Known limitation: wide views over dense 3D Tiles get heavy because of many small meshes and main-thread glTF imports. Supported Blender versions, Windows support and headless use are not stated — [Cesium community post](https://community.cesium.com/t/cesium-for-blender-streaming-world-terrain-imagery-3d-tiles-incl-google-photorealistic-into-blender-open-source-wip/46938); repo https://github.com/CognitoBit/CesiumForBlender

**Google Photorealistic 3D Tiles terms**
- Map Tiles API policies: you "must not pre-fetch, index, store, or cache any Content except under the limited conditions stated in the terms" and must honour tile Cache-Control headers. "Offline uses" is listed among prohibited non-visualization uses. Tiles are for map visualization only; geodata extraction and object detection are not permitted. Your own 3D objects may be overlaid only if they are not traced or derived from the tiles "by hand or machine". Renders must aggregate glTF `asset.copyright` attributions and show the unmodified Google Maps logo. Promotional videos must be under 30 seconds and marked "for promotional purposes only" — [Google Map Tiles API Policies](https://developers.google.com/maps/documentation/tile/policies)
- Renderers must support displaying copyright attribution — [Photorealistic 3D Tiles docs](https://developers.google.com/maps/documentation/tile/3d-tiles)

### Inferences
- **BlenderGIS** is the only candidate here that is open-licensed, maintained for Blender 5 and EPSG-aware. For this project its main value would be (a) checking that lidar/OSM placement agrees with an independent CRS implementation, and (b) the "camera from geotagged photo" feature for photo matching. The project already reads COG/lidar and fetches OSM itself, so BlenderGIS's DEM/OSM importers duplicate existing work. For EPSG:27700 to work offline and deterministically, pyproj (or GDAL) must be importable in Blender's bundled Python. Without it, AUTO falls back to the online epsg.io service, which is not reproducible. Pinning `proj_engine = 'PYPROJ'` and recording the PROJ version (and OSTN15 grid availability) would be needed for provenance.
- Note: BNG <-> WGS84 accuracy depends on whether PROJ has the OSTN15 transformation grid. With a plain Helmert transform the error is several metres. The source code does not show which transform is used; this is an inference about PROJ behaviour, not something verified in BlenderGIS.
- **Blosm** adds little: its 30 m terrain is far coarser than 1 m lidar, its free buildings are untextured extrusions, and its Blender 5.1 fix lives only in the Gumroad build (2.7.24), so pinning is harder. The Pro version is a paid product (source still GPL).
- **Google 3D Tiles (Blosm Pro, Tile Importer, CesiumForBlender)**: ruled out by the project's openly-licensed-provenance rule and by Google's no-offline / no-caching / no-derivation terms. A reel rendered offline in Blender and kept as video is close to an "offline use" plus caching. CesiumForBlender with *self-hosted* terrain (`layer.json`) could in principle stream the project's own lidar-derived quantized-mesh, but it is WIP with unknown 5.2/headless status.
- **Headless:** all these add-ons register normal `bpy.ops` operators, so in principle they can run under `blender -b --python`. Basemap/viewport-drawing features in BlenderGIS (modal map view) need a UI and will not work headless. Operator idnames such as `bpy.ops.importgis.georaster` / `bpy.ops.importgis.shapefile` / `bpy.ops.blosm.import_data` are **[unverified]**; check them with `dir(bpy.ops.importgis)` after enabling.

### Gaps
- No primary source confirmed that BlenderGIS v2.2.15 has been tested on 5.1/5.2 (Python 3.13). Issue #1033 (Basemap on 5.0.1) had no visible resolution.
- BlenderGIS release years are not shown on the releases page. "December" is inferred as December 2025 from the Blender 5.0 release timing (Nov 2025) and the issue #1004 context.
- Could not verify whether BlenderGIS's GeoTIFF DEM importer reads Cloud-Optimized GeoTIFF tiling/overviews, or which Python libraries (imageio/numpy/GDAL) it needs on Windows Blender 5.2.
- No Blosm 5.2 confirmation; no evidence of documented headless use.
- No dedicated, maintained "GeoTIFF/COG importer" extension for Blender 5.x was found on extensions.blender.org in this session (not exhaustively searched).

## Procedural road, railway, bridge, wall, fence and building generators

### Takeaway
None of the procedural building/road kits found is clearly open-licensed, verified on Blender 5.2 and scriptable. BagaPie (on extensions.blender.org, Blender 5.0+, 11.0.12) is the best-maintained scatter/wall/fence/array toolkit. Building Tools (ranjian0) stops at Blender 4.0 support. Buildify (2022, Blender 3.2) has no Blender 5 evidence. Archimesh needs a Blender 5 patch that has not yet been merged into the official listing. Free road and rail Geometry Nodes files exist, but under "royalty-free" or unstated licences rather than GPL/CC0. For this project, writing in-house curve-to-mesh rail, road and wall node groups in Python is likely safer for provenance.

### Cited Findings
- **BagaPie**: listed on extensions.blender.org. Newest release 11.0.12 is listed for Blender 5.0 and newer (one earlier entry, 11.0.11, is oddly tagged "5.2 LTS and newer"); the version history includes a fix for a pie-menu issue on Blender 5.1 — [BagaPie listing](https://extensions.blender.org/add-ons/bagapie/); [BagaPie versions](https://extensions.blender.org/add-ons/bagapie/versions/)
- **Archimesh**: the official extension listing still says Blender 4.2 LTS and newer, and users have asked for Blender 5 support. A pull request on projects.blender.org adds Blender 5 support with a prerelease build, but it does not appear to be merged. A community GitHub fork claims fixes for Blender 5.0 window/room problems — [Archimesh listing](https://extensions.blender.org/add-ons/archimesh/); [PR #5 Support for Blender 5](https://projects.blender.org/extensions/archimesh/pulls/5); [voxel-wiz fork](https://github.com/voxel-wiz/Archimesh_Blender_Addon)
- **Building Tools (ranjian0)**: latest GitHub release v1.0.13 (hotfix #227), page roughly 1,000 days old; README says v1.0.12 is "Blender 4.0 Compatible"; the wiki still describes legacy zip install, not the extensions platform. No Blender 5 evidence — [Building Tools releases](https://github.com/ranjian0/building_tools/releases); [Building Tools repo](https://github.com/ranjian0/building_tools)
- **Buildify (Pavel Oliva)**: free Geometry Nodes library (2022). Draw footprint curves and it builds modular wall/flat-roof kits; compatible with Blender 3.2 at launch; designed to work with blender-osm footprints — [CG Channel](https://www.cgchannel.com/2022/07/download-free-blender-3d-building-generator-buildify/); [80.lv](https://80.lv/articles/grab-a-free-geometry-nodes-library-for-procedural-buildings-in-blender/)
- **SkyscrapX** says it is "heavily inspired by Buildify" (footprint plus wall/corner assets) and claims to avoid Geometry Nodes performance issues. No Blender version stated — [SkyscrapX itch.io](https://baogames.itch.io/skyscrapx)
- **Road generators**:
  - "Roads generator" on Blender Artists (Oct 2025): free GN plus shaders, multiple lanes, medians and shoulders. One version needs Blender 5.0+, and the author downgraded to 4.5 by replacing Repeat Zones with math. Licence not stated in the snippet — [Blender Artists thread](https://blenderartists.org/t/roads-generator/1614365)
  - Procedural Road Generator GN (Superhive): free, listed Blender 3.6–5.0, "royalty-free" licence — [Superhive listing](https://superhivemarket.com/products/procedural-road-generator-geometry-nodes)
  - "Road Generator with cracks and damage" (May 2025, Gumroad): comments say the download was disabled — [BlenderNation](https://www.blendernation.com/2025/05/04/free-download-road-generator-with-cracks-and-damage/)
- **Rail generators**:
  - Free Rail Road Generator Template (curve to rails, sleepers, ballast, banking); no version or licence shown — [Blender Everything](https://blendereverything.com/download.php?id=37&category=Free+Resources)
  - Train Tracks (BlenderKit, curve-based, plank spacing, rust); royalty-free, not GPL — [BlenderKit](https://www.blenderkit.com/asset-gallery-detail/aacc8a2b-275d-4ae3-9693-473313ed4f81/)
  - Train Track Generator GN (Sketchfab, ~2.7 years old) — [Sketchfab](https://sketchfab.com/3d-models/train-track-generatorgeometry-nodes-blender-d487949c34ab47bd9f0909d18870f690)

### Inferences
- For a former standard-gauge trackbed (largely a disused formation today), a full track generator is less useful than a ballast/formation-profile sweep: Curve to Mesh with a profile curve, plus instancing sleepers on points via Resample Curve / Instance on Points. That takes about a dozen built-in nodes and can be built from Python. It avoids third-party licence ambiguity, so in-house is the recommended route.
- BagaPie's value would be scatter, walls, fences and arrays. But it is driven mainly through UI pie menus, so headless scripting means calling its operators or appending its node groups. Its licence was not checked this session (extensions.blender.org requires GPL-compatible code, which would make it GPL-compatible) **[unverified]**.
- Dry-stone walls along field boundaries (OSM `barrier=wall`) are a high-value Welsh landscape element. No dedicated free, open dry-stone-wall GN kit for Blender 5 was found.
- "Royalty-free" marketplace licences (Superhive, BlenderKit) are not open licences. They need case-by-case provenance records and may restrict redistributing the .blend.

### Gaps
- Sanctus Library (procedural materials) was not researched this session. From background knowledge it is a paid Superhive product with a free "lite" subset **[unverified]**.
- Licence texts for Buildify, the Blender Artists road generator and the Blender Everything rail template were not retrieved.
- No maintained, open "roof generator from footprint" for Blender 5 was found. Blosm base generates OSM roof shapes but is not a standalone library.
- No bridge/viaduct generator was found; the route's Cwm Prysor viaduct would need custom modelling.

## Built-in Geometry Nodes features in Blender 5.0 / 5.1 / 5.2 relevant to terrain, roads, buildings

### Takeaway
Blender 5.0 added Bundles, Closures, and a full volume-grid/SDF node set (Mesh/Points to SDF, SDF Boolean, Grid to Mesh, SDF filters). 5.1 extended grids (dilate/erode, mean/median, clip) and bundle paths. 5.2 LTS added Geometry Bundles, a List data type, Mesh Bevel, Merge/Cluster nodes, Transfer Attributes, Collection Children, GN modifiers on Empties, and Python-settable node-tool inputs. Together these make in-house road, rail and terrain node groups much easier to build and drive from scripts.

### Cited Findings
- **5.0**:
  - Bundles (Combine/Separate/Join Bundle, Bundle socket) and Closures (Closure Zone, Evaluate Closure)
  - Volume grids: grid socket; Store/Get Named Grid; Mesh to SDF Grid, Points to SDF Grid, Mesh to Density Grid, Field to Grid; Voxelize, Prune, Grid to Mesh; Grid Gradient/Laplacian/Curl/Divergence, Sample Grid; Advect Grid; SDF Grid Boolean; SDF Mean Curvature/Median/Mean/Offset/Fillet
  - Other: UV Tangent node; String to Value; new Essentials node-group assets (unnamed on the page); Random Value output changed (seeds give different values than 4.x)
  - [Blender 5.0 GN release notes](https://developer.blender.org/docs/release_notes/5.0/geometry_nodes/)
- **5.1**:
  - Grids: Cube Grid Topology, Grid Dilate & Erode, Grid Mean/Median, Clip Grid, Grid to Points
  - Bundles: Get/Store Bundle Item and nested "bundle paths"
  - Other: String to Curves sockets plus Font socket; Fill Curve Fill Rule; UV Unwrap SLIM; Matrix SVD
  - Node tools now register their own operators with customisable idnames; node tools from earlier versions must be re-saved in 5.1
  - [Blender 5.1 GN release notes](https://developer.blender.org/docs/release_notes/5.1/geometry_nodes/)
- **5.2 LTS**:
  - Set/Get Geometry Bundle (attach data, including fields and closures, to geometry across modifiers/objects)
  - Lists data type (Field to List, Get List Item, Filter/Sort List, List Length)
  - String fields and string nodes (Split/Trim String)
  - Mesh Bevel node; Merge Points / Cluster by Distance / Cluster by Connected
  - Capture Attribute with selection; Rename Attribute, Get Attribute Names, Transfer Attributes; Get Geometry Component; Instance Reference
  - Collection Children node; GN modifiers on Empties and collection instances
  - 3D-to-Screen / Screen-to-3D / Project with Depth nodes; PCA nodes; recursive closures (depth limit in preferences)
  - Node-tool inputs remembered between calls and settable from Python
  - [Blender 5.2 LTS GN release notes](https://developer.blender.org/docs/release_notes/5.2/geometry_nodes/)

### Inferences
- **Terrain/DSM:** Points to SDF Grid / Mesh to SDF Grid plus SDF Fillet/Offset can soften cut-and-fill where an inserted road or trackbed formation meets the lidar DTM. For example, Boolean a formation SDF into a terrain SDF, then Grid to Mesh. On a 6 GB RTX 2060, keep voxel sizes coarse (≥0.5 m) and limit the volume to tiles along the corridor.
- **Roads/rail:** Lists and Geometry Bundles (5.2) let one node group carry per-segment OSM attributes (highway class, width, layer, surface) as data rather than many objects. The Split String / string fields can parse OSM tag strings imported as attributes.
- **Buildings:** Mesh Bevel (5.2) plus Extrude Mesh on footprints gives eaves/parapets without add-ons. Transfer Attributes can carry footprint attributes (height, roof type) onto generated meshes.
- **Headless:** 5.2 makes node-tool inputs settable from Python, and modifier inputs have always been settable via `modifier["Socket_N"]`. So all of this is scriptable.
- **Reproducibility:** the 5.0 change to Random Value means scatter seeds tuned on 4.x will not reproduce on 5.x. Re-baseline any snapshot tests.

### Gaps
- The 5.0–5.2 GN release-note pages fetched do not mention the "Import CSV / OBJ / PLY / STL / VDB" geometry nodes. From background knowledge these arrived in 4.4/4.5 (CSV/OBJ/PLY/STL/VDB import nodes) **[unverified this session]**. The manual's node reference should be checked before relying on them (useful: an "Import CSV" node could read OSM/OS point features directly into GN).
- The new 5.0 Essentials node-group assets were not enumerated in the notes. Check whether any scatter/curve helpers ship built in.
- Nothing in 5.0–5.2 adds a dedicated terrain/heightmap or GIS node. Heightmaps still go via a displaced grid, image sampling, or the project's own mesh import.

## Camera matching for photo matching: fSpy, Perspective Plotter, BLAM, others

### Takeaway
Perspective Plotter (paid, Superhive) is listed as an extension-compatible add-on for Blender 3.0–5.2, but it is interactive (viewport line drawing). The official fSpy importer (stuffmatic) stopped at v1.0.3 (Blender 2.8 era). A community "next generation" extension fork (RubisetCie) targets LTS releases only, with no confirmed 5.2 build. For a headless pipeline, the most robust approach is to read the fSpy `.fspy` project file directly in Python (or use the project's own photo_match solver) rather than rely on either add-on.

### Cited Findings
- fSpy is a standalone open-source camera-matching app; its official Blender importer sets camera parameters and optionally the background image — [fspy.io](https://fspy.io/)
- Official fSpy-Blender importer: latest v1.0.3, changelog mentions 2.8 compatibility and 2.79 crash fixes, no Blender 5 mention — [stuffmatic/fSpy-Blender releases](https://github.com/stuffmatic/fSpy-Blender/releases)
- RubisetCie/blender-fspy ("next generation"): built with `blender --command extension build`, installed via "Install from Disk"; "only supports Blender LTS version", updated when the next LTS releases; the author will not upload it to the official extensions gallery. No release or version visible on the fetched page — [RubisetCie/blender-fspy](https://github.com/RubisetCie/blender-fspy)
- Perspective Plotter (Mark Kingsnorth): set focal length and camera position/rotation in real time by drawing 1-, 2- or 3-point perspective lines in the viewport; measuring guide for scale; horizon flattening; multiple cameras. Superhive lists "Blender Extension Compatible: Yes" and Blender 3.0–5.2. Paid — [Superhive listing](https://superhivemarket.com/products/perspective-plotter); [docs](https://perspective-plotter.readthedocs.io/en/latest/index.html)
- BlenderGIS can set up cameras from geotagged photos (EXIF GPS) — [BlenderGIS README](https://github.com/domlysz/BlenderGIS)

### Inferences
- For historic railway photographs (no EXIF), the useful inputs are vanishing lines plus surveyed control points (lidar/OS features). fSpy gives an interactive solve whose `.fspy` file (binary header plus JSON) can be parsed headlessly into `camera.data.lens`, `sensor_width` and `matrix_world`. Perspective Plotter is interactive-only and paid, so it can solve a frame by hand but not automate a pipeline.
- A control-point PnP solve (OpenCV `solvePnP` on lidar-known 3D points) would be more accurate for landscape photos where straight parallel lines are scarce. The repo's untracked `scripts/blender/photo_match.py` suggests this is already in progress.
- BLAM (the old Blender camera-calibration add-on) was not re-checked. From background knowledge it has been unmaintained since the 2.7x/2.8x era **[unverified]**.

### Gaps
- No primary source confirms either fSpy importer working on Blender 5.1/5.2 (Python 3.13 changes broke other add-ons, e.g. Blosm #707).
- Perspective Plotter's 5.2 claim comes only from the vendor listing; there are no independent test reports.
- No "built-in Camera Calibration" add-on ships with Blender 5.x as far as was found. The only camera solver built in is the Movie Clip Editor's motion-tracking camera solver (needs a clip, not a single still) **[unverified for single-image use]**.

## Coordinate system handling (EPSG:27700 British National Grid) inside Blender add-ons

### Takeaway
BlenderGIS is the only add-on found with explicit, pluggable CRS handling. It can do 27700 only through GDAL, pyproj or online epsg.io, because its built-in engine knows only WGS84, Web Mercator and UTM. Blosm and the Google/Cesium tools work in WGS84/ECEF-derived local frames. The project's own approach (do the BNG maths outside Blender, then import into a local metric origin) remains the most controllable.

### Cited Findings
- BlenderGIS engine order is GDAL, then pyproj, then built-in (WGS84<->3857/UTM only), then epsg.io (EPSG codes only, online); identical CRS skips reprojection — [reproj.py](https://raw.githubusercontent.com/domlysz/BlenderGIS/master/core/proj/reproj.py)
- BlenderGIS CRS search needs a MapTiler API key (v2.2.13) — [BlenderGIS releases](https://github.com/domlysz/BlenderGIS/releases)
- BlenderGIS stores scene georeferencing ("Manage georeferencing information of a scene") — [BlenderGIS README](https://github.com/domlysz/BlenderGIS)

### Inferences
- If BlenderGIS is used, install pyproj into Blender 5.2's Python (`python.exe -m pip install pyproj --target <addon modules dir>`) and pin `proj_engine='PYPROJ'`. Otherwise a missing library silently falls back to an online service.
- BNG coordinates (easting ~270000, northing ~340000 for this corridor) exceed float32 precision when used directly. Any add-on that places objects at raw BNG coordinates would cause vertex jitter. A scene origin offset (as BlenderGIS's georef does, and as the project already does) is required.
- OSTN15 grid availability in PROJ decides whether BNG<->WGS84 is accurate to sub-metre or only to a few metres. This matters for aligning OSM (WGS84) with OS/lidar (BNG).

### Gaps
- The exact BlenderGIS scene custom-property names for the CRS/origin were not verified; the georeferencing wiki page did not load.
- No Blender add-on was found that ships the OSTN15 grid or documents BNG-specific accuracy.
