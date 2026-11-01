# Python and CLI tools for preparing geospatial data for Blender reconstruction (Blaenau Ffestiniog–Trawsfynydd corridor)

Method note (read first): versions, release dates, licences, Python floors and whether a Windows cp312 wheel exists were **queried live on 2026-11-01** from the PyPI JSON API (`pypi.org/pypi/<pkg>/json`), the GitHub REST API (latest release, last push, SPDX licence, stars) and `npm view`. "win cp312 wheel = no" means pip must build from source or the package is pure-Python (noted as "pure"). A local check was also run against the project machine's Python 3.12.10 user site. Functional descriptions marked **[bk]** come from background knowledge of the projects and were not re-verified this session. The writer should treat [bk] items as lower-confidence.

Already installed and confirmed locally: rasterio 1.5.2 (bundled GDAL **3.12.2**), pyproj 3.8.0 (PROJ 9.8.1), shapely 2.2.0, trimesh 5.2.0, opencv-python-headless 5.0.0.93. torch is **not** installed.

---

## Raster/lidar: which tools are best for DTM sampling, hillshade, terrain mesh decimation, point-cloud classification and canopy height models?

### Takeaway
The installed rasterio (with bundled GDAL 3.12) already covers COG windowed DTM/DSM sampling and resampling. The tools that add the most are: **laspy + lazrs** for LAZ point clouds (pip, Windows wheels); **pydelatin** or **pymartini** for error-bounded terrain TIN meshes (both shipped fresh Windows cp312 wheels in October 2026; they replace the archived tin-terrain); **whitebox-workflows** (MIT/Apache, Windows cp312 wheel) for lidar ground filtering, hillshade, CHM and terrain derivatives; and **xdem** for DSM−DTM differencing and DEM co-registration. PDAL and the GDAL command-line tools have no Windows PyPI wheels, so they need conda-forge or OSGeo4W. Avoid **richdem** (no release since 2018) and **rvt-py** (cannot install on Python 3.12).

### Cited Findings
**GDAL / rasterio / rioxarray / xarray**
- rasterio 1.5.2, released 2026-09-30, BSD-3-Clause, requires Python ≥3.12, ships a Windows cp312 wheel. The installed copy bundles GDAL 3.12.2 (local check). — [PyPI rasterio](https://pypi.org/project/rasterio/)
- GDAL 3.13.3 was released 2026-08-18. Releases are frequent: 3.13.0 on 2026-05-08, 3.13.1 on 06-05, 3.13.2 on 07-22. The PyPI `gdal` package is MIT and **source-only, with no Windows wheel**. — [PyPI gdal](https://pypi.org/project/GDAL/); [GitHub OSGeo/gdal](https://github.com/OSGeo/gdal)
- rioxarray 0.24.0 (2026-10-29, Apache-2.0) **requires Python ≥3.13**. 0.23.0 (2026-07-27) and 0.22.0 require ≥3.12. On Python 3.12 pip will resolve to 0.23.x. — [PyPI rioxarray](https://pypi.org/project/rioxarray/)
- xarray 2026.9.0 (2026-09-29, Apache-2.0, pure, Python ≥3.11). — [PyPI xarray](https://pypi.org/project/xarray/)
- rasterstats 0.21.0 (2026-05-23, BSD-3, pure). exactextract 0.3.0 (2025-12-01, Apache-2.0, Windows cp312 wheel) for exact zonal statistics along corridor polygons. — [PyPI rasterstats](https://pypi.org/project/rasterstats/); [PyPI exactextract](https://pypi.org/project/exactextract/)

**Point clouds: PDAL, laspy, lazrs**
- PDAL core 2.10.2 was released 2026-06-12, and the repo is very active (pushed 2026-10-29). — [GitHub PDAL/PDAL](https://github.com/PDAL/PDAL)
- python-pdal (`pdal` on PyPI) 3.5.5 was released 2026-07-31, Python ≥3.9. **No Windows wheel** is on PyPI because it needs a separately installed PDAL C++ library. — [PyPI pdal](https://pypi.org/project/pdal/)
- laspy 2.7.0 (2026-01-14, BSD-2-Clause, pure Python, ≥3.10). — [PyPI laspy](https://pypi.org/project/laspy/)
- lazrs 0.8.2 (2026-07-27, MIT) has a Windows cp312 wheel, so `pip install "laspy[lazrs]"` reads and writes LAZ on Windows with no compiler. — [PyPI lazrs](https://pypi.org/project/lazrs/)

**Terrain analysis: Whitebox, richdem, pysheds, RVT, xdem**
- WhiteboxTools (Open Core) last released v2.4.0 on 2024-05-22, MIT. The repo was pushed 2026-05-26. — [GitHub jblindsay/whitebox-tools](https://github.com/jblindsay/whitebox-tools)
- The `whitebox` Python wrapper 2.3.6 (2025-02-23, MIT, pure) downloads the WBT binary. — [PyPI whitebox](https://pypi.org/project/whitebox/)
- `whitebox-workflows` 2.0.6 (2026-06-14) is now listed as **"MIT OR Apache-2.0"** and has a Windows cp312 wheel. In June 2026 John Lindsay announced "Whitebox Workflows Next Gen" on OSGeo-Discuss as a complete rewrite with about 750 tools, Python/R front ends and a QGIS plugin, under MIT/Apache 2, still in "soft launch". The older WbW 1.x PyPI pages said WbW "is not free". — [PyPI whitebox-workflows](https://pypi.org/project/whitebox-workflows/); [OSGeo-Discuss post, June 2026](https://lists.osgeo.org/pipermail/discuss/2026-June/040372.html); [PyPI whitebox-workflows 1.1.2](https://pypi.org/project/whitebox-workflows/1.1.2/)
- richdem 0.3.4 was last released **2018-07-13** (GPLv3), with no cp312 wheel. The GitHub repo `richdem/richdem` returned 404 at the queried path. — [PyPI richdem](https://pypi.org/project/richdem/)
- pysheds 0.5 (2025-08-14) is **GPLv3+**. — [PyPI pysheds](https://pypi.org/project/pysheds/)
- rvt-py 2.2.3 (Relief Visualization Toolbox, 2025-07-04) declares `requires_python <3.12,>=3.6`, so it **will not install on Python 3.12**. — [PyPI rvt-py](https://pypi.org/project/rvt-py/)
- xdem 0.2.3 (2026-03-03, Apache-2.0, pure, Python 3.10–3.14). — [PyPI xdem](https://pypi.org/project/xdem/)

**Terrain mesh generation (TIN / decimation)**
- heremaps/tin-terrain is **archived** (MIT, last push 2023-03-08). — [GitHub heremaps/tin-terrain](https://github.com/heremaps/tin-terrain)
- pydelatin 0.4.0 (2026-10-09, MIT) has a Windows cp312 wheel. Its repo is active (pushed 2026-10-30). — [PyPI pydelatin](https://pypi.org/project/pydelatin/); [GitHub kylebarron/pydelatin](https://github.com/kylebarron/pydelatin)
- pymartini 0.6.0 (2026-10-12, MIT, Python ≥3.11) has a Windows cp312 wheel. The upstream JS mapbox/martini (ISC) last released v0.2.0 in 2020. — [PyPI pymartini](https://pypi.org/project/pymartini/); [GitHub mapbox/martini](https://github.com/mapbox/martini)
- [bk] Delatin builds a TIN greedily until a maximum vertical error is met, from any heightmap size. Martini needs a (2^n+1)² grid and produces a right-triangulated irregular network (RTIN). Martini is faster; Delatin gives fewer triangles for the same error.

### Inferences
- For 1 m Welsh DTM/DSM COGs, use rasterio `WarpedVRT` plus windowed reads for corridor sampling. It is already installed, so GDAL CLI tools are optional. Hillshade, slope and CHM are simple NumPy operations on rasterio arrays, or `gdaldem` via OSGeo4W or conda if CLI parity is wanted.
- **CHM = DSM − DTM** can be computed directly from the NRW 1 m DSM and DTM rasters (rasterio plus NumPy) without touching point clouds. xdem adds co-registration (e.g. Nuth & Kääb [bk]) if the DSM and DTM tiles or epochs are misaligned.
- Point-cloud classification: NRW LAZ files are normally already classified (ground and so on) [bk]. laspy plus lazrs is enough to filter by class and build vegetation/building point sets. PDAL (via conda-forge) is only worth adding for SMRF/PMF re-filtering or `filters.hag_*` height-above-ground pipelines. whitebox-workflows offers lidar ground and CHM tools via pip if conda is unwanted.
- **Terrain meshes for Blender:** pydelatin with `max_error` around 0.1–0.5 m on 1 m DTM tiles produces adaptive TINs that are far lighter than Blender grid displacement. Export as vertices and faces, then write with trimesh. This is the strongest single addition for terrain LOD.
- Avoid richdem (stale since 2018) and rvt-py (blocked on 3.12). pysheds is GPL and only needed for hydrology.
- If pip-installing rioxarray on 3.12, pin `rioxarray<0.24` to be explicit.

### Gaps
- I did not verify whether conda-forge `python-pdal` builds exist for Python 3.12 on Windows, although that is the usual route [bk].
- The Whitebox NG MIT/Apache claim rests on the mailing-list post and the PyPI licence field. The repo LICENSE file was not opened.
- The current NRW/Welsh Government lidar LAZ classification scheme was not checked.

---

## Vector/OSM: osmnx, pyrosm, overturemaps-py, geopandas, shapely 2.x, pyproj (EPSG:27700 + OSTN15), momepy; road centreline smoothing

### Takeaway
geopandas 1.2 with pyogrio and shapely 2.2 is the core. Add **osmnx 2.1** (Overpass, small areas) or **pyrosm 0.28 / osmium 4.3** (Geofabrik PBF extracts; both now have Windows cp312 wheels). **overturemaps 1.0.2** fetches Overture buildings and segments, but I found **no evidence of meaningful Overture building-height coverage in Wales**. The most actionable finding is from the local machine: **pyproj currently cannot find the OSTN15 grid and falls back to a ~2 m Helmert transform**. Enable the PROJ network or download `uk_os_OSTN15_NTv2_OSGBtoETRS.tif`.

### Cited Findings
- **Local check (project machine, 2026-11-01):** pyproj 3.8.0 / PROJ 9.8.1 reports `network False`, `best_available False`, with the warning "Best transformation is not available due to missing Grid(short_name=uk_os_OSTN15_NTv2_OSGBtoETRS.tif ... url=https://cdn.proj.org/uk_os_OSTN15_NTv2_OSGBtoETRS.tif, open_license=True)". It uses "OSGB36 to WGS 84 (6)" with stated accuracy **2.0 m**. The OSTN15 operation "OSGB36 to WGS 84 (9)" is listed as unavailable. — local pyproj run; grid file name corroborated by [epsg.io 27700-to-4326](https://epsg.io/27700-to-4326) and [epsg.io 27700-7709](https://epsg.io/27700-7709)
- pyproj 3.8.0 (2026-09-05, MIT, Python ≥3.12, Windows cp312 wheel). — [PyPI pyproj](https://pypi.org/project/pyproj/)
- geopandas 1.2.0 (2026-09-28, BSD-3, Python ≥3.11). — [PyPI geopandas](https://pypi.org/project/geopandas/); [GitHub](https://github.com/geopandas/geopandas)
- pyogrio 0.13.0 (2026-06-26, MIT, Windows cp312 wheel, bundles GDAL [bk]). shapely 2.2.0 (2026-10-07, BSD-3, Windows wheel). — [PyPI pyogrio](https://pypi.org/project/pyogrio/); [PyPI shapely](https://pypi.org/project/shapely/)
- osmnx 2.1.1 (2026-07-21, MIT, pure, Python ≥3.11). — [PyPI osmnx](https://pypi.org/project/osmnx/)
- pyrosm 0.28.0 (2026-10-31, BSD-3-Clause AND MIT) has a **Windows cp312 wheel**. Release cadence is very rapid: 0.25 to 0.28 within one week of October 2026. — [PyPI pyrosm](https://pypi.org/project/pyrosm/)
- osmium (pyosmium) 4.3.2 (2026-10-18, BSD-2, Windows cp312 wheel). quackosm 0.19.0 (2026-09-28, Apache-2.0, DuckDB-based PBF to GeoParquet). duckdb 2.0.0 (2026-10-21, MIT, Windows wheel). — [PyPI osmium](https://pypi.org/project/osmium/); [PyPI quackosm](https://pypi.org/project/quackosm/); [PyPI duckdb](https://pypi.org/project/duckdb/)
- overturemaps (overturemaps-py) 1.0.2 (2026-08-25, MIT, pure). 1.0.0 shipped 2026-05-01. — [PyPI overturemaps](https://pypi.org/project/overturemaps/); [GitHub](https://github.com/OvertureMaps/overturemaps-py)
- Overture building heights were initially US-centric: about 6 million buildings from USGS 3DEP lidar. A later summary cites about 27.9 million buildings with height, at least 10 million from USGS lidar. Overture has added height data from Microsoft and Esri Community Maps contributors. The `height` field is the distance from the lowest to the highest point. — [Overture technical spotlights](https://overturemaps.org/resources/technical-spotlights); [Overture buildings guide](https://docs.overturemaps.org/guides/buildings); [Overture blog: buildings](https://docs.overturemaps.org/blog/tags/buildings/)
- momepy 1.0.0 (2026-07-02, BSD-3, **Python ≥3.12**). — [PyPI momepy](https://pypi.org/project/momepy/)
- neatnet 0.1.6 (2026-03-28, BSD-3, pure, ≥3.11). [bk] It simplifies street networks, collapsing dual carriageways and roundabouts into centrelines, and comes from the momepy/UDL team. — [PyPI neatnet](https://pypi.org/project/neatnet/)
- centerline 1.1.1 (2024-05-26, MIT, pure; Voronoi-based polygon centrelines [bk]). pygeoops 0.6.0 (2025-11-02, BSD-3; centerline and buffer utilities [bk]). simplification 2.0.0 (2026-10-11, BlueOak-1.0.0 permissive licence, Windows wheel; Rust RDP/Visvalingam-Whyatt [bk]). — [PyPI centerline](https://pypi.org/project/centerline/); [PyPI pygeoops](https://pypi.org/project/pygeoops/); [PyPI simplification](https://pypi.org/project/simplification/)

### Inferences
- **Fix the CRS first.** Projecting OSM/WGS84 data to EPSG:27700 without OSTN15 introduces about 2 m error relative to the lidar, which is gridded in OSGB36/BNG. That is enough to misplace roads relative to a 1 m DTM cut. Either:
  - call `pyproj.network.set_network_enabled(True)`, or set `PROJ_NETWORK=ON`, or
  - download the grid once from `https://cdn.proj.org/uk_os_OSTN15_NTv2_OSGBtoETRS.tif` into `pyproj.datadir.get_user_data_dir()` (or run `projsync --file uk_os_OSTN15_NTv2_OSGBtoETRS.tif`).
  
  Then assert `TransformerGroup(...).best_available` in a test. rasterio's bundled GDAL/PROJ has its own data directory and needs the same treatment [bk].
- For a rural Welsh corridor, a Geofabrik Wales PBF read with pyrosm or osmium is more reproducible than live Overpass via osmnx. osmnx stays useful for graph operations (simplification, edge geometry).
- Overture adds little in Wales for heights. Lidar DSM − DTM sampled inside OSM/OS OpenMap Local building footprints (rasterstats or exactextract) gives better building heights than Overture.
- **Road centreline smoothing:** shapely 2.x `simplify` combined with `offset_curve`/`buffer` and densification usually suffices. neatnet helps if OSM dual carriageways or junction clutter break the road mesh. A Chaikin or spline smoothing pass in NumPy before draping onto the DTM is a small custom function; no dedicated library is needed [bk].
- momepy 1.0 and pyproj 3.8 both now require Python ≥3.12, so the project is right at the floor. Any downgrade of Python would break them.

### Gaps
- I found no source quantifying Overture building-height coverage in the UK or Wales. Treat it as unverified, probably sparse.
- OS OpenData-specific Python tooling (OS Data Hub downloader packages) was not researched. Direct GPKG downloads read with pyogrio are the obvious route [bk].

---

## Mesh/3D: trimesh, Open3D, PyVista, pymeshlab, py3dtiles / 3D Tiles tooling, glTF tools (pygltflib, gltf-transform), meshoptimizer for terrain/building meshes and LOD

### Takeaway
trimesh (installed) plus **fast-simplification** (MIT, Windows wheel) covers most decimation needs. **Open3D 0.20.0** (Sept 2026, first release since Jan 2025, Windows cp312 wheel) adds point-cloud normals, Poisson/ball-pivot meshing and ICP for lidar-derived structures. For glTF output optimisation, use the **CLIs** `gltfpack` 1.3.0 and `@gltf-transform/cli` 4.5.1 (both MIT, npm). The meshoptimizer Python binding is still alpha with no Windows wheel. pymeshlab is capable but **GPL-3.0**. 3D Tiles tooling (py3dtiles, 3d-tiles-tools) only matters if a web/Cesium output is wanted; it adds nothing for Blender.

### Cited Findings
- trimesh 5.2.0 (2026-10-24, MIT, pure; 5.0.0 shipped 2026-08-01). — [PyPI trimesh](https://pypi.org/project/trimesh/)
- fast-simplification 0.2.0 (2026-08-12, MIT, Windows cp312 wheel). pyfqmr 0.5.0 (2025-08-23, MIT, Windows cp312 wheel). — [PyPI fast-simplification](https://pypi.org/project/fast-simplification/); [PyPI pyfqmr](https://pypi.org/project/pyfqmr/)
- Open3D 0.20.0 (2026-09-16, MIT, Python ≥3.10, Windows cp312 wheel). The previous release was 0.19.0 on 2025-01-08. — [PyPI open3d](https://pypi.org/project/open3d/); [GitHub isl-org/Open3D](https://github.com/isl-org/Open3D)
- PyVista 0.49.2 (2026-10-28, MIT, pure, monthly cadence). — [PyPI pyvista](https://pypi.org/project/pyvista/)
- pymeshlab 2025.7.post1 (2026-01-30) is **GPL-3.0** and has a Windows cp312 wheel. — [PyPI pymeshlab](https://pypi.org/project/pymeshlab/); [GitHub](https://github.com/cnr-isti-vclab/PyMeshLab)
- meshoptimizer (C++ library) v1.3 was released 2026-09-25, MIT. — [GitHub zeux/meshoptimizer](https://github.com/zeux/meshoptimizer)
- The Python `meshoptimizer` package is 0.2.30a0 (2026-02-27), an **alpha with no Windows cp312 wheel**. — [PyPI meshoptimizer](https://pypi.org/project/meshoptimizer/)
- npm `gltfpack` 1.3.0 (MIT, modified 2026-09-25). npm `@gltf-transform/cli` 4.5.1 (MIT, modified 2026-09-28). — `npm view` on 2026-11-01; [GitHub donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform)
- pygltflib 1.16.5 (2025-07-24, MIT, pure). — [PyPI pygltflib](https://pypi.org/project/pygltflib/)
- py3dtiles 12.1.1 (2026-03-20, Apache-2.0, Python 3.10–3.14). npm `3d-tiles-tools` 0.5.4 (Apache-2.0, modified 2026-07-15). — [PyPI py3dtiles](https://pypi.org/project/py3dtiles/); `npm view 3d-tiles-tools`

### Inferences
- The project already has Node (package.json, Remotion side), so `npx gltfpack -cc -tc` / `npx @gltf-transform/cli optimize` are zero-friction for compressing building and terrain GLBs (meshopt/Draco, KTX2) after Blender export or before import. Note that Blender's glTF importer supports Draco, but meshopt-compressed import support should be checked [bk].
- Terrain LOD: pydelatin at several `max_error` values (e.g. 0.25 / 1 / 4 m) gives LOD chains directly. fast-simplification is for decimating existing meshes such as buildings or Poisson surfaces.
- Open3D adds value only if lidar points are meshed: bridges, walls, slate tips and quarry faces where a 2.5D DTM fails. Otherwise trimesh is enough.
- pymeshlab's GPL is acceptable for a local offline tool that is not distributed, but should not be vendored into shipped code.
- 3D Tiles is out of scope for a Blender render pipeline.

### Gaps
- Blender (4.x/5.x) glTF importer support for `EXT_meshopt_compression` was not verified this session.

---

## Photogrammetry / photo matching: COLMAP, OpenMVG/OpenMVS, Meshroom, Gaussian splatting, single-photo pose (hloc, DUSt3R/MASt3R/VGGT), feasibility with scattered Commons photos and a 6 GB RTX 2060

### Takeaway
Multi-view reconstruction (COLMAP, OpenMVS, Meshroom, Gaussian splats) is **not feasible** from scattered single Commons/Geograph photos. These tools need dozens of overlapping views of the same subject. The practical approach is **single-photo camera registration against the lidar DTM/DSM**: render the terrain or skyline from the photo's geotag and solve yaw, pitch, roll and focal length. This is a well-established research approach (Baboud et al.; Produit et al., ISPRS 2014) and needs only the already-installed NumPy, SciPy and OpenCV. **pycolmap 4.2.1** (BSD-3, Windows cp312 wheel) is useful as a PnP/bundle-adjustment library once 2D–3D correspondences exist. Most learned 3D foundation models carry **non-commercial licences**: DUSt3R/MASt3R are CC BY-NC-SA 4.0 and the original VGGT weights are non-commercial. Even VGGT-class models need about 6 GB of VRAM for a single frame, which is marginal on an RTX 2060.

### Cited Findings
**Classical SfM/MVS**
- COLMAP 4.2.1 (2026-09-29). The repo is very active (pushed 2026-11-01, about 13.1k stars); its GitHub licence shows as NOASSERTION. — [GitHub colmap/colmap](https://github.com/colmap/colmap)
- pycolmap 4.2.1 (2026-09-29, BSD-3-Clause, Python ≥3.10) has a **Windows cp312 wheel**. — [PyPI pycolmap](https://pypi.org/project/pycolmap/)
- OpenMVS v2.4.0 (2026-01-20) is **AGPL-3.0**. — [GitHub cdcseacave/openMVS](https://github.com/cdcseacave/openMVS)
- OpenMVG last released v2.1 on 2023-12-28 (MPL-2.0); the repo was pushed 2026-08-30. — [GitHub openMVG/openMVG](https://github.com/openMVG/openMVG)
- Meshroom v2025.1.0 (2025-08-19); the repo was pushed 2026-10-30. — [GitHub alicevision/Meshroom](https://github.com/alicevision/Meshroom)

**Gaussian splatting**
- gsplat 1.5.3 (2025-07-04, Apache-2.0). There has been no release for about 16 months, but the repo was pushed 2026-09-19. — [GitHub nerfstudio-project/gsplat](https://github.com/nerfstudio-project/gsplat); [PyPI gsplat](https://pypi.org/project/gsplat/)
- The PyPI gsplat package JIT-compiles CUDA on first run. Prebuilt Windows wheels exist for certain Python/torch/CUDA combinations, and there is a Windows build guide (docs/INSTALL_WIN.md). gsplat claims up to 4× less GPU memory than the original implementation. The original 3DGS Windows fork lists 24 GB VRAM as a requirement. — [GitHub nerfstudio-project/gsplat](https://github.com/nerfstudio-project/gsplat); [gaussian-splatting-Windows](https://github.com/RightUpNorth/gaussian-splatting-Windows)
- nerfstudio 1.1.5 (2024-11-11); the repo was last pushed 2025-07-29, so it looks stagnant. — [GitHub nerfstudio](https://github.com/nerfstudio-project/nerfstudio)
- The KIRI Engine Blender 3DGS add-on (`3dgs-render-blender-addon`) v5.1.0 (2026-08-26) is **GPL-2.0**, about 1.25k stars, pushed 2026-09-20. — [GitHub Kiri-Innovation/3dgs-render-blender-addon](https://github.com/Kiri-Innovation/3dgs-render-blender-addon)

**Learned matching, pose and depth models (licences flagged)**
- hloc (Hierarchical-Localization) code is Apache-2.0. Its last release was v1.4 (2023-07-20); the repo was pushed 2025-12-10. It is **not on PyPI**. — [GitHub cvg/Hierarchical-Localization](https://github.com/cvg/Hierarchical-Localization)
- LightGlue code is Apache-2.0 (pushed 2026-10-25) and **not on PyPI**. kornia 0.9.0 (2026-10-23, Apache-2.0) wraps several matchers [bk]. — [GitHub cvg/LightGlue](https://github.com/cvg/LightGlue); [PyPI kornia](https://pypi.org/project/kornia/)
- DUSt3R and MASt3R code and checkpoints are **CC BY-NC-SA 4.0 (non-commercial only)**. Checkpoint users must also accept the training-dataset licences; the mapfree dataset licence is described as "very restrictive". — [GitHub naver/dust3r](https://github.com/naver/dust3r); [GitHub naver/mast3r](https://github.com/naver/mast3r)
- VGGT: the licence was updated on 2025-07-29 so that only the new **VGGT-1B-Commercial** checkpoint permits commercial use, excluding military use. It is gated behind an application form. The original VGGT-1B checkpoint remains non-commercial (CC-BY-NC-4.0 according to third-party pages). VGGT has about 14.6k stars, no tagged releases, and was pushed 2026-05-19. — [HF facebook/VGGT-1B-Commercial](https://huggingface.co/facebook/VGGT-1B-Commercial); [GitHub mirror noting licence change](https://github.com/HardingPan/VGGT); [GitHub facebookresearch/vggt](https://github.com/facebookresearch/vggt)
- VGGT-Omega (CVPR 2026) reports end-to-end peak memory for VGGT-Omega-1B-512 on an A100 at 624×416, including weights: **about 6.0 GB for 1 frame**, 6.7 GB for 10, 7.8 GB for 25 and 9.7 GB for 50 frames. Memory grows roughly linearly with frame count. — [GitHub facebookresearch/vggt-omega](https://github.com/facebookresearch/vggt-omega); [arXiv 2605.15195](https://arxiv.org/pdf/2605.15195)
- facebookresearch/map-anything repo is Apache-2.0 (pushed 2026-08-07). microsoft/MoGe and apple/ml-depth-pro show NOASSERTION (custom licences). Depth-Anything-V2 repo is Apache-2.0. Licences of individual weights were not checked. — [GitHub map-anything](https://github.com/facebookresearch/map-anything); [GitHub MoGe](https://github.com/microsoft/MoGe); [GitHub ml-depth-pro](https://github.com/apple/ml-depth-pro); [GitHub Depth-Anything-V2](https://github.com/DepthAnything/Depth-Anything-V2)

**Single photo against terrain (DEM) registration**
- Baboud et al. (MPI Informatik) estimate camera orientation relative to a terrain model from approximate viewpoint and FOV by matching silhouette edges. — [Baboud et al., photo-to-terrain](https://resources.mpi-inf.mpg.de/photo-to-terrain/photo-to-terrain.pdf)
- Produit et al. (ISPRS Annals 2014) match the photo's horizon silhouette with a DEM horizon to orient web photos, refining with 2D–3D ICP. — [ISPRS Annals II-3-127-2014](https://isprs-annals.copernicus.org/articles/II-3/127/2014/isprsannals-II-3-127-2014.pdf)
- Open challenges in this approach include unknown focal length, occluders (trees, buildings) and the photo-to-render appearance gap. Learned cross-domain descriptors have been proposed to address the gap. — [Springer ECCV 2020 chapter](https://springerlink.bibliotecabuap.elogim.com/doi/10.1007/978-3-030-58526-6_18); [NASA Ames rover horizon matching](https://ntrs.nasa.gov/api/citations/20160011500/downloads/20160011500.pdf)

### Inferences
- **Feasibility verdict for scattered single photos with a 6 GB RTX 2060:**
  - **COLMAP, OpenMVS, Meshroom and 3DGS training: no.** They need overlapping image sets. With 6 GB, splat training would also be constrained.
  - The **KIRI add-on** only renders existing splats in Blender. It is useful only if a splat capture of a landmark is later obtained (e.g. a self-shot phone video).
- **Recommended approach (all open-source, already installed):**
  1. Take the geotag as the initial position and the EXIF focal length if present.
  2. Ray-cast or render a DSM depth/skyline panorama from that point (NumPy plus rasterio, or Blender itself).
  3. Extract the photo skyline with OpenCV (edges or sky segmentation).
  4. Optimise yaw, pitch, roll and f with scipy.optimize against the rendered skyline.
  5. Optionally refine with `pycolmap` absolute-pose / PnP on hand-picked 2D–3D tie points.
  
  This directly gives Blender camera parameters for photo-match comparison.
- Learned matchers (LightGlue/SuperPoint via hloc or kornia) could match photo to Blender render. [bk] SuperPoint weights are commonly noted as non-commercial, so check before relying on them. DISK and ALIKED are alternatives with more permissive terms [bk].
- **Turing (RTX 20-series) GPUs lack native bf16 [bk], and VGGT-class 1B models need ≈6 GB even for one frame.** Running them locally on a 6 GB 2060 is marginal at best. A Hugging Face Space (the HF connector is available) or CPU offload are alternatives. Licence is also restrictive: only VGGT-1B-Commercial (gated) and Apache-licensed map-anything code are commercially safe, and DUSt3R/MASt3R are NC-SA.
- Monocular depth (Depth-Anything-V2 small, which is Apache [bk] where the larger variants are NC [bk]) could provide a coarse depth map per photo to aid skyline/occluder separation. This is an optional nicety.

### Gaps
- No direct measurement found of original VGGT or MASt3R VRAM on a 6 GB card. The VGGT-Omega A100 numbers are the nearest evidence.
- Weight licences for MoGe, Depth Pro, map-anything checkpoints and Depth-Anything-V2 per size were not individually verified.
- Whether a gsplat prebuilt Windows wheel exists for Python 3.12 plus a current torch/CUDA was not confirmed. torch is not installed on the machine.
- The COLMAP and Meshroom repos report NOASSERTION licences via the GitHub API. Their actual licences (COLMAP: new BSD; Meshroom: MPL-2.0 [bk]) were not opened.
- No off-the-shelf maintained Python package for DEM-skyline photo registration was found. It would be custom code built on the cited methods.

---

## Image tools for comparison: OpenCV, scikit-image (SSIM), image alignment

### Takeaway
The installed OpenCV 5.0 covers alignment (ECC `findTransformECC`, ORB/SIFT plus homography). **scikit-image 0.26** (Windows cp312 wheel) adds `structural_similarity` (SSIM) and phase correlation and is worth adding. kornia is optional and needs torch. For Sentinel-2, **pystac-client + odc-stac** (pure Python) fetch cloud-masked composites via STAC.

### Cited Findings
- opencv-python-headless 5.0.0.93 (2026-07-02) is installed. A parallel 4.x line also continues (4.14.0.94 on 2026-07-28). Apache-2.0, Windows wheels. — [PyPI opencv-python-headless](https://pypi.org/project/opencv-python-headless/)
- scikit-image 0.26.0 (2025-12-20, BSD-style, Python ≥3.11, Windows cp312 wheel). 0.27.0rc1 is out (2026-10-27). — [PyPI scikit-image](https://pypi.org/project/scikit-image/)
- kornia 0.9.0 (2026-10-23, Apache-2.0, pure, Python ≥3.11; requires torch [bk]). — [PyPI kornia](https://pypi.org/project/kornia/)
- pyvips 3.2.0 (2026-08-29, MIT) has no Windows wheel itself and needs libvips binaries [bk]. — [PyPI pyvips](https://pypi.org/project/pyvips/)
- Sentinel-2 access tools:
  - pystac-client 0.9.1 (2026-10-20, Apache-2.0). — [PyPI pystac-client](https://pypi.org/project/pystac-client/)
  - odc-stac 0.5.3 (2026-07-30, pure). — [PyPI odc-stac](https://pypi.org/project/odc-stac/)
  - planetary-computer 1.0.0 (2023-07-05, MIT; URL signing for Microsoft Planetary Computer). — [PyPI planetary-computer](https://pypi.org/project/planetary-computer/)
- earthpy 1.0.0 (2026-10-02, BSD) has revived after a 2021–2026 gap but adds little beyond rasterio. — [PyPI earthpy](https://pypi.org/project/earthpy/)

### Inferences
- **Photo-match scoring:** compute SSIM (skimage) on edge or gradient maps rather than raw RGB, because the render-vs-photo appearance gap makes RGB SSIM noisy. Combine with skyline IoU and Chamfer distance on Canny edges (OpenCV `distanceTransform`). ECC alignment in OpenCV handles small residual misregistration before scoring.
- For Sentinel-2 at 10 m, pystac-client plus odc-stac against Element84 Earth Search or Planetary Computer gives a median cloud-free composite in a few lines and writes a COG via rasterio. It is useful for a large-area ground-colour texture beyond the lidar orthophoto [bk].
- pyvips is only worth it for very large mosaics. Pillow and rasterio suffice otherwise.

### Gaps
- Not checked: whether Earth Search / Planetary Computer STAC endpoints and collections changed during 2026.
- Not checked: whether the 4.x vs 5.x OpenCV split has API breaks relevant to ECC or SIFT.
