"""The OSM kinds a window's osm.geojson carries beside its roads, structures and land cover (scripts/fetch_osm_extras.py):
watercourse lines, power lines with their towers and poles, and the condition of ruined or abandoned buildings.

Shared by build_section_data.py (so a rebuild keeps them) and fetch_osm_extras.py (which adds them to a window without
changing any other feature, spec CL7). Only the tags a later step reads leave the pipeline (data minimisation, ADR 38).
"""
WATERWAYS = {"river", "stream", "canal", "drain", "ditch"}
POWER_LINES = {"line", "minor_line"}
POWER_SUPPORTS = {"tower", "pole"}
WATERWAY_TAGS = ("waterway", "name", "width", "tunnel", "culvert", "intermittent", "layer")
POWER_TAGS = ("power", "voltage", "cables", "structure", "height", "material")
# register ids the extras own, so a window rebuild keeps them (build_section_data.keep_owned)
OWNED_PREFIXES = ("waterway-", "power-")


def extra_kind(feature):
    """"waterway", "power-line", "power-support" or None. A closed watercourse or line (to_features makes any closed way
    without a highway an area) is still a line here; extras_of flattens it."""
    tags, g = feature["properties"].get("tags", {}), feature["geometry"]["type"]
    if tags.get("waterway") in WATERWAYS and g in ("LineString", "Polygon"):
        return "waterway"
    if tags.get("power") in POWER_LINES and g in ("LineString", "Polygon"):
        return "power-line"
    if tags.get("power") in POWER_SUPPORTS and g == "Point":
        return "power-support"
    return None


def extra_tags(feature):
    """The allowlisted tags of an extra feature, or None when it is not one."""
    kind = extra_kind(feature)
    if kind is None:
        return None
    keep = WATERWAY_TAGS if kind == "waterway" else POWER_TAGS
    tags = feature["properties"].get("tags", {})
    return {k: tags[k] for k in keep if k in tags}


def building_value(tags):
    """The `building` value a window keeps: "ruins" for a ruin (building=ruins, ruins=yes, historic=ruins), "abandoned"
    for an abandoned building (building=abandoned, abandoned=yes), else "yes". Idempotent on its own output."""
    b = tags.get("building")
    if b in ("ruins", "ruin") or tags.get("ruins") == "yes" or tags.get("historic") == "ruins":
        return "ruins"
    if b == "abandoned" or tags.get("abandoned") == "yes":
        return "abandoned"
    return "yes"


def extras_of(features):
    """The extra features among `features`, lines as LineStrings, with only their allowlisted tags, in id order within
    each kind (waterways, power lines, power supports), so the same OSM gives the same bytes."""
    out = []
    for f in features:
        kind = extra_kind(f)
        if kind is None:
            continue
        g = f["geometry"]
        geom = {"type": "LineString", "coordinates": g["coordinates"][0]} if g["type"] == "Polygon" else g
        out.append((kind, f["properties"]["id"], {"type": "Feature", "properties": {"id": f["properties"]["id"], "tags": extra_tags(f)}, "geometry": geom}))
    order = {"waterway": 0, "power-line": 1, "power-support": 2}
    key = lambda x: (order[x[0]], x[1].split("/")[0], int(x[1].split("/")[1]))  # noqa: E731
    return [f for _, _, f in sorted(out, key=key)]


def owned_by_extras(entry):
    """True for a register entry fetch_osm_extras.py writes (a watercourse, a power line or support)."""
    return entry.get("id", "").startswith(OWNED_PREFIXES)


def point_features(nodes, node_tags):
    """Tagged nodes as Point features (to_features returns ways and relations only); only power supports are wanted."""
    return [{"type": "Feature", "properties": {"id": f"node/{nid}", "tags": tags}, "geometry": {"type": "Point", "coordinates": list(nodes[nid])}}
            for nid, tags in node_tags.items() if tags.get("power") in POWER_SUPPORTS and nid in nodes]
