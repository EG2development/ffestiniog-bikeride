# Interactive route map

`public/maps/route-preview.html` is a self-contained Leaflet page (OSM tiles
+ the real trackbed GeoJSON and station waypoints inlined) for checking the
alignment on a real map before it gets turned into stylised Remotion scenery.
Open it directly in a browser — no build step or local server needed, since
the route and waypoint data are embedded in the file rather than fetched.

It shows:
- The stitched historic trackbed (orange line), built from 36 OpenStreetMap
  ways tagged `railway=disused|abandoned|dismantled`, `name="Bala and
  Festiniog Railway"`.
- The five verified former stations as markers — click one for its opening/
  closing dates and current (2026) physical status.
- One marked **geometry gap** near Trawsfynydd Lake Halt (a short OSM way
  that didn't connect to its neighbours by shared node) — flagged rather
  than silently bridged.

It intentionally carries a banner reminding the viewer this is a concept,
not an approved route — keep that banner (or an equivalent) on any further
iteration of this file.

## Regenerating it

The page is generated from `data/railway-route.geojson` and
`data/waypoints.json` by inlining them as JSON — it does not re-fetch them
live, so after editing either data file, regenerate the HTML rather than
hand-editing the embedded JSON blocks.

## What this is not

This is a validation view, not deliverable #8 (the rendered concept video).
It also isn't a routable/navigable cycling map — it shows the historic rail
alignment only, with no trail surface, access points, or crossings drawn in
yet (that's the cycling-route concept layer, still to be designed — see
`research.md` §6 on what's verified vs. proposed).
