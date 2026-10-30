# 63. Buildings up to date: every building near the line, checked against the latest OS release and the lidar

Date: 2026-10-30

Scope: `scripts/fetch_os_buildings.py` (new), `scripts/building-candidates.ts`, `scripts/build_buildings.py`,
`src/three-core/visibility.ts` (`visibleFootprints`), `src/three-core/sections.ts` (buildings in the photo look's
aerial scenes), `src/three-core/registers.ts` (source type `os`), `src/data/reel-captions.ts` (the OS notice),
`data/os-buildings-<w>.geojson`, `data/building-currency-<w>.json`, every window's `buildings.json`, heights,
candidates and register building entries

## Status

Proposed

## Context

On 2026-10-30 the owner asked for "up to date building structures on the route". Until then (ADRs 49–51) a window drew
only the OSM footprints its sampled shots saw from their centres at mid-height, the corridor's aerial scenes drew no
buildings at all, and nothing checked whether a footprint still stood: the only dates were OSM edit dates, many from
2014–2016. Three gaps followed. Buildings beside the line that no sampled pose happened to see were missing (a
footprint's roof corners could show over a rise while its centre did not). The aerial scenes showed the towns only as
a map drape, which the photo look does not draw (ADR 60). And OSM is incomplete here: barns, farm buildings and
houses outside the towns are often unmapped.

Research on 30 October found the open, current source for the gap: OS OpenMap - Local, released each April and
October under the Open Government Licence v3.0, with building outlines generalised from OS MasterMap, downloadable
without a key from the OS Downloads API (the SH tile, 38 MB, files dated 2026-10-26). It has no per-building date or
attributes beyond an ID and a feature code, and it merges terraces into one outline. The Welsh lidar (flights 2020–23)
measures whether a structure stood on each footprint at the flight.

## Decision

- **Every footprint near the line.** A window's candidates are the footprints its shots see plus every footprint on
  the terrain within 300 m of the line, seen or not. Visibility tests the centre at mid-height and up to eight outline
  corners at roof height.
- **Buildings in the aerial scenes.** A scene draws buildings when it is a ground scene or draws the photo look. The
  corridor window takes the poses of all four aerial sections; the concept look's aerials still show their towns on
  the map drape only.
- **OS as the currency check.** `scripts/fetch_os_buildings.py` reads the OS OpenMap - Local SH tile (Building layer,
  a minimal shapefile reader, no GIS dependency), clips it to the window, converts the window's OSM footprints to
  British National Grid with the project's Helmert transform, and removes their local offset (the median offset of
  centroids matched within 15 m; 0.8–1.5 m in these windows). An OSM footprint is *confirmed* when an OS outline
  overlaps it (a centroid or vertex of either inside the other), and *absent* otherwise.
- **OS fills OSM's gaps.** OS outlines of 25 m² or more that overlap no OSM footprint are kept, moved into the OSM frame,
  and go through the same candidate, height and register passes, with ids `os/<OS id>` (register ids
  `building-<w>-os-<OS id>`), source type `os`, category `approximate` (the outline is generalised), observed at the
  release date, licence OGL v3 with the notice "Contains OS data © Crown copyright and database right 2026". The notice
  is on screen in both attributions.
- **Two dated checks set the confidence.** Each building records `lidar` (`present`, `absent` below 2 m, or
  `unmeasured`) and `osMap` (`confirmed`, `absent`, `source`, or `unchecked`). An OSM footprint OS confirms is observed
  at the OS release. A building the lidar lacks but OS has was built since the flight (medium confidence). One that
  neither shows is low confidence, listed by the build and noted in the register "may no longer stand, or be newer
  than both (check)"; it stays drawn until a dated source says otherwise.
- **A road wins over an OS outline.** An OS outline that a registered road runs through (a vertex inside, or a segment
  crossing an edge) is left out and listed in the currency file: the road is current and the outline generalised, or it
  spans an arch OSM does not map. Outlines on the trackbed stay drawn and are listed (spec BL7), as findings for the
  trail.
- **A lidar search for what no map has, as a review list.** The owner asked for buildings to be found on a lidar map
  (archiuk.com's viewer). That viewer's terms forbid reuse without written permission, and its terrain layer appears to
  be bare earth. So `scripts/find_lidar_structures.py` reads the same Welsh lidar from its source at 1 m within 300 m
  of the line and finds raised, smooth, box-like blobs (roofs, not crowns) that no OSM or OS outline explains. They are
  written to `data/lidar-structures.json` with grid references for checking and are not drawn: the flights are older
  than the OS release, and caravans, stacks or lorries look like small buildings.
- **DataMapWales dates and records the checks.** The owner pointed to DataMapWales, the Welsh Government's portal
  (all layers used are OGL v3). `scripts/fetch_dmw.py` reads its WFS along the line: the 2020–23 lidar tile catalogue
  (every route tile was flown in January or March 2022, so a lidar check carries its day), the NRW lidar archive
  (1 m surveys of February 2007 and March 2009), Cadw's listed buildings and the NMRW sites. A listed building or NMRW
  site on a footprint becomes a dated record in its register entry. With `--history` it measures the archive DSM on
  every footprint the 2022 lidar did not see. A building that stood in 2007 or 2009 and is in neither the 2022 lidar
  nor the OS release is marked demolished (medium confidence) and recorded, not drawn. One that no lidar has ever seen
  stays a low-confidence check.
- **OS outlines are matched against all of OSM.** A window's OSM extract keeps a building way its box cuts only as a
  line, so an OS outline is also matched against every other window's footprints and against the cut lines; otherwise
  it would duplicate a building OSM has (the northern reactor building did).
- **Curated structures and planning stay curated.** Status changes that the maps do not show (a height reduction under
  way, a demolition, a planning approval) enter `data/landmarks.json` or the source register with their own dated
  sources (ADR 51), and a curated `statusNote` replaces the automatic note. A footprint curated as demolished is left
  out of the OS comparison, so an OS outline on its ground (what replaced it) is drawn. A planning approval without a
  footprint is recorded, not drawn.
- **What has gone is recorded, not drawn.** A building whose status is demolished (curated, or from the lidar
  history) is written with its full register entry and footprint to `data/buildings-removed-<w>.json` and left out of
  the scene; the candidate pass reads that list. The reel shows what stands, and a ghost of a building gone for years
  would cost a legend line in scenes already at three (spec CL10). Translucent drawing (spec BL14) stays for approved
  schemes.

## Consequences

- The windows draw 2,458 building records (1,224 distinct buildings; the corridor overlaps the ground windows), up from
  156: maentwrog 8 → 43, blaenau 55 → 623, vale-north 30 → 419, vale-south 5 → 189, trawsfynydd 58 → 159, corridor
  0 → 1,025. Of the records, 1,166 are OS outlines OSM lacks and 1,243 are OSM footprints OS confirms. 2,406 are
  observed in 2026 and 2,379 are high confidence; five are low (in neither the 2022 lidar nor OS, never seen by the
  2007/2009 lidar either). 45 carry a Cadw listing and 269 an NMRW record. Two are recorded as demolished and not
  drawn: the Wynne Road health centre (curated) and OSM way 428787293 near km 13.2 (3.7 m in the 2009 lidar, gone by
  March 2022). They still merge into at most three draw groups (BL10).
- OS releases twice a year: re-running the three steps (OS check, candidates, heights) is part of the data SOP.
- OS outlines are generalised: a terrace is one block, small sheds are smoothed or dropped, so an OSM footprint "not in
  OS" is usually a small building, not a demolished one. Only the lidar and OS together mark a building as doubtful.
- The OS tile is 38 MB and cached under `out/cache/os/`; it is not committed.

## Verification

- Self-tests: `fetch_os_buildings.py`, `fetch_dmw.py`, `find_lidar_structures.py` and `build_buildings.py --self-test`
  all pass (matching, cut ways, roads through outlines, curated and archive-lidar currency, records near outlines,
  roof against canopy blobs).
- `npm test`: 43 files, 327 tests pass (2 expected failures). New or amended: BL7 lists the two OS buildings on the
  trackbed near km 11.6 and the Blaenau carriage-arch terrace; BL15 checks OS's notice on OS footprints and on screen;
  BL16 accepts source `os`; a demolished building is recorded with evidence and never drawn; RL30 allows `api.os.uk`
  and `datamap.gov.wales`. `npm run lint` is clean.
- Render checks 2026-10-30T18:35:57Z (`docs/validation-photoreal.md`): 25 of 26 pass, including RL24 (worst scene pass
  41 calls, 1.71 M triangles), CL10 (at most 3 lines), WA6/WA7 (the water checks' clean frames now leave the legend out,
  as spec WA7's "caption-free frames" asks) and RG1/X1/X2. CL3 fails at intro_120 (10.4 %) because the credit box grew
  a line with the OS notice; without the credit band the change is 7.9 %.

## Relations

Amends [49. Buildings from sourced data](0049-buildings-from-sourced-data.md), [50. Merged buildings and procedural landmarks](0050-merged-buildings-and-procedural-landmarks.md) and [51. Register status and provenance](0051-register-status-and-provenance.md); related to [60. The reel in the photo look](0060-reel-in-the-photo-look.md).
