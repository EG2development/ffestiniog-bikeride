# Blender build plan: Blaenau Ffestiniog – Llan Ffestiniog – Trawsfynydd community reel

Created: 2026-10-29. Updated: 2026-10-30 (research for the build). Status: implemented
(2026-10-31 to 2026-11-06; the as-built record is [design-blender.md](design-blender.md) §5 and [film-enhancement-2026-11.md](film-enhancement-2026-11.md)). The verified research is [research-blender.md](research-blender.md),
the build specification (interchange package, coordinate mapping, Blender 5.2 import recipes, render preset, checks) is
[design-blender.md](design-blender.md), and the decision is [ADR 62](adr/0062-blender-pipeline.md). Section 9 is the
readiness checklist.

Build a native Blender version of the existing route film, reusing the project's geographic data and animation logic. Start with the 20-second Maentwrog prototype, then expand to the 90-second reel. The intended improvement is a more convincing North Wales landscape, vegetation, people and lighting while preserving the railway alignment and the distinction between existing, approximate and proposed features. Show an inclusive shared-use route with children, teenagers, adults and older people of diverse genders and ethnic backgrounds walking and cycling.

## 1. Deliverables and working assumptions

- An editable Maentwrog `.blend` scene containing terrain, trail, structures, vegetation, rigged cyclists and pedestrians, lighting and three animated camera shots.
- A 20-second prototype at 1920 × 1080, 30 fps, matching `Poc3DMaentwrogPhoto` for comparison.
- Reusable Blender assets and repeatable export/import scripts for all six terrain windows.
- A reusable, diverse character library and a shot-by-shot casting plan covering age groups, men and women, boys and girls, ethnic backgrounds, body types and different mobility needs. Include walking and cycling across the age groups where appropriate.
- Clearly visible dog walkers, reusable rigged dog models and animated leads, included in the main reel and its shared-use interaction checks.
- A 90-second, nine-section Blender film, with an editable Video Sequencer master, captions, attribution and resumable frame renders. Optional 4K follows the 1080p version.
- A community animatic, reusable gateway/rest-place/activity assets, bilingual messaging and a feedback end card, incorporating the complete community additions in section 8.
- A short build/render guide, asset licences, source manifest and geographic/visual validation report.

The default is to render the environment **and all people together in Blender**. Assemble the film in Blender's Video Sequencer. The existing Remotion films remain useful comparison references; retaining Remotion for final titles is an optional delivery variant, not a prerequisite for the Blender build. Inclusive pedestrians and cyclists are part of the main scope, including the pilot. Plan narration and subtitles during the community animatic; music is an optional finishing addition.

### Community-project brief

The reel is intended to support community discussion about a walking, wheeling, cycling and recreational connection between **Blaenau Ffestiniog, Llan Ffestiniog and Trawsfynydd**. The source-backed findings, priorities and alternative 90-second storyboard are in [Community reel research](community-reel-research.md), checked 29 October 2026.

All recommendations are consolidated into [section 8](#8-complete-community-additions-and-production-brief) below, including the full community storyboard, facilities, recreation, participation, evidence checks and delivery tasks. The research note retains the supporting sources and qualifications.

Prioritise a named Llan Ffestiniog village connection, everyday local journeys, an inclusive rest/gathering place outside the moving trail, short outings, public-transport links, Welsh cultural identity and quiet nature-based recreation. Add considerate passing/waiting interactions to the cast's animation requirements. Plan gateway/rest-place assets with existing/proposed/unknown status and explicit location/evidence records; a village or station coordinate does not establish a usable entrance.

Use the current edit as the migration comparison. For the community-facing version, create a separate timeline/configuration following the research storyboard; do not silently change the existing `REEL_SCENES`. Develop a rough animatic and local-language/voiceover approach before detailed character and amenity work. Narration remains a production decision, while bilingual readable messaging and a real feedback destination are requirements for the community version.

The new version should invite feedback and further feasibility work, show the railway context and preserve options still to investigate. The council's active-travel consultation closes on 26 November 2026 as currently published; recheck before using a dated end card. Current land/railway agreements, exact gateways, accessibility and maintenance arrangements remain to be established, and rendered amenities must be labelled as proposed.

## 2. What already exists and should be reused

| Existing input | Blender use |
|---|---|
| `data/railway-route.geojson`, `src/data/route.ts` | Railway alignment, chainage and the existing shared projection |
| `public/data/sections/<window>/dem.json`, `dem.f32`, `dem-source.u8` | Terrain geometry and elevation-source provenance |
| Each window's `trail-profile.json` | Trail elevation, smoothed profile, bridge spans and road overbridges |
| Each window's `landcover.json`, `landcover.u8`, `osm.geojson` | Material masks and mapped landscape features |
| `buildings.json`, `data/features-<window>.json`, `data/landmarks.json` | Footprints, heights, status, evidence and limitations |
| `data/water-levels.json`, `src/three-core/water.ts` | Consistent water levels and outlines with islands/holes |
| Every window's `canopy.json`, `canopy.f32`, `barriers.geojson`; the corridor's `imagery.json`/`imagery.u8` | Canopy heights sampled every 4 m (16 m in the corridor), mapped walls, hedges and fences, and the Sentinel-2 ground colour for the aerial scenes (ADR 60) |
| `src/three-core/walkers.ts`, `people.ts` and the configs' `photo.people` | The reel's 24 seeded walkers, runners and pram pushers and the prototype's 3 walkers, with per-frame paths (ADRs 59, 61) |
| `src/three-core/trees.ts`, `shading.ts`, `atmosphere.ts` | Canopy-cover trees for the aerials, the graded ground image, and `sunDirection` (export the vector, not the angles) |
| `Reel3D` in the photo look, `out/previews/`, `docs/evidence/photo/` | The camera-for-camera comparison reference (ADR 60) |
| `src/three-core/sections.ts`, `camera.ts`, `cyclistMotion.ts` | Scene assembly, seeded placements, camera poses and distance-based rider motion |
| `src/data/reel-timeline.ts`, `reel-captions.ts` | Edit timing, captions, concept notices and attribution |
| `public/3d/textures/`, `data/assets-3d.json` | Eight existing CC0 diffuse/normal texture pairs and their provenance |
| `docs/evidence/photo/` | Existing frames for matched-camera comparisons |

Important findings from the current working tree:

- The route configuration covers approximately **13.24 km**. There are five ground windows and one shared `corridor` window for the four aerial sections.
- The stored ground terrain grids are **4 m samples**; the corridor grid is **16 m**. The underlying lidar source is 1 m, but that is not the resolution of the current meshes.
- Every window now has canopy and barrier files, and the corridor has OSM land cover, roads, water and a Sentinel-2
  ground image (ADR 60). The 4 m and 16 m grids are **nearest-neighbour samples** of the 1 m lidar, not averages, so
  the canopy heights undershoot crown tops (a median 0.81 of the cell's 1 m maximum at the Maentwrog bridge); close-up
  trees come from the 1 m data ([design §7](design-blender.md#7-close-up-data-phase-3)).
- The standalone Maentwrog concept section is 360 frames, but the reel takes its first **300 frames**. Exporting every section's configured length would make the master too long.
- Some prose still says no textures have been downloaded; the actual texture files and asset register contain 16 JPGs. Use the files and register as the implementation evidence.
- Blender was not found on `PATH` or in `/Applications` (checked again on 30 October). The machine is an M4 Pro (20-core
  GPU, 48 GB) with **about 5 GB of free disk**, which does not hold the reel's frames (section 7).

## 3. Architecture and interchange

```text
Existing GIS files + pure TypeScript scene assembly
                         |
                  Offline scene exporter
                         |
       Versioned manifest + binary geometry + animation samples
                         |
                 Blender Python importer
                         |
    Editable section scenes + linked materials/vegetation/people
                         |
              EEVEE previews / Cycles finals
                         |
                 Lossless frame sequences
                         |
             Blender Video Sequencer master
```

**Recommended transfer:** call the existing pure `buildSectionScene(cfg, inputs, "photo")` assembly from a Node-side exporter (as `scripts/gen-earthworks.ts` already runs it), then import its output with Blender Python. This preserves the already implemented trail flattening, road/bridge handling, water and seeded placement logic instead of independently rebuilding those calculations in Python. Build in the **photo** look: the default concept look leaves out the canopy trees, boundaries, grass, people and the aerial image. The package format, measured against glTF, Alembic and USD, is specified in [design §2](design-blender.md#2-the-interchange-package): a JSON manifest with raw binary sidecars imports an 810k-vertex terrain in 0.56 s and instances 50k trees in 0.03 s, where glTF makes 50,001 objects.

The exporter needs a filesystem loader using the same boundary validators as `Scene3DDataProvider`; the React provider itself is not a Node entry point. Use synced `public/data/` inputs and verify their relationship to the authoritative `data/` records.

Define a project-owned interchange schema containing mesh positions/indices, UVs, material/class attributes, object and feature IDs, instance transforms, raw footprint/line metadata where needed, camera samples, rider samples, captions and source hashes. Store large arrays in explicitly typed binary sidecars with byte order and lengths recorded in the manifest. Evaluate functions into data before exporting; closures such as `scene.shot` cannot be serialized.

Add an authored population manifest for the additional people: character/rig and animation IDs, body and bicycle dimensions, activity, group membership, start time, route distance, direction, lateral position, speed profile and animation phase. Record casting coverage separately from geographic evidence: these are fictional people illustrating the proposal, not a claim about observed visitors or local population statistics. Keep the existing rider as the camera-comparison reference; additional people need their own motion schedules.

Use Blender's [mesh API](https://docs.blender.org/api/current/bpy.types.Mesh.html) with numpy `foreach_set` (not `from_pydata`, which is slow at millions of elements) to create editable meshes. GLB can be used for individual third-party assets, but is not the primary scene contract: the project's custom shaders, geographic provenance and camera/rider functions need explicit translation. **Blender 5.x breaks most published 4.x scripting**: `action.fcurves` is gone (use action slots and channelbags), Geometry Nodes modifier inputs moved in 5.2, `media_type` precedes `file_format`, the EEVEE identifier is `BLENDER_EEVEE`, and `sequences` is `strips` ([research §2.6](research-blender.md#26-python-api-what-breaks-and-what-is-fast)).

### Coordinate and frame contract

Current Three.js coordinates are Y-up, with **1 unit = 10 m**. Blender will use Z-up, with **1 unit = 1 m**. For a recorded horizontal section origin `(x0, z0)` in current world units:

```text
Blender X =  10 × (Three X − x0)
Blender Y = −10 × (Three Z − z0)
Blender Z =  10 ×  Three Y
```

This is a rotation and scale, preserving handedness (verified: a +90° rotation about X, the same mapping Blender's glTF importer applies). Apply it consistently to terrain, trail, instances, structures, camera positions/targets and light directions. Record the origin and inverse mapping; local axes are inherited from the existing route projection (Blender +X lies about 171° clockwise from true north), not assumed to be geographic east/north, and the route frame is not BNG: export control points carrying both. Keep vertical exaggeration at 1.

Convert orientations using transformed bases or matrices/quaternions; a single yaw about three.js +Y carries over unchanged as a rotation about Blender +Z, but pitch and combined rotations do not. Preserve the camera's **vertical** field of view: set `sensor_fit = 'VERTICAL'` and `angle_y` (the default AUTO renders 45° as 38.5° at 16:9). Converted this way, 200 random poses projected within 0.0014 px of three.js. Scale clipping distances to metres. Recipes: [design §3](design-blender.md#3-coordinates-and-frames).

Map source frame `f` to Blender frame `f + 1`. Use one camera per shot and camera markers at cuts, with linear baked animation within each shot, so interpolation never smooths across a hard cut. Maintain quaternion sign continuity and unwrapped wheel/crank angles. Match geometry and motion first with motion blur disabled; enable it only after subframe evaluation is validated.

## 4. Implementation phases

### Phase 1 — Freeze the reference and prepare Blender

1. Record the current source files, data hashes, baseline frames, timeline and known geographic limitations. Include uncommitted inputs in the manifest; HEAD alone does not identify this working tree.
2. Install and pin **Blender 5.2.3 LTS** (22 Oct 2026; 5.2 is supported through July 2028): the DMG `blender-5.2.3-macos-arm64.dmg` checked against its published sha256, or Homebrew `blender@lts` (the plain `blender` cask moves to 5.3 in November). Record it in the build scripts (as built, `build_reel.py` checks `bpy.app.version`), with `bpy==5.2.3` (Blender as a Python module, arm64 Python 3.13) for headless tests. Select the GPU in the script (`compute_device_type = 'METAL'`, `refresh_devices()`; `--factory-startup` ignores saved preferences) and confirm MetalRT is in use. Test EEVEE with `blender -b` outside a login session. **Free disk first**: about 5 GB is free; plan an external volume for `out/blender/` or section-by-section encoding. [Official release announcement](https://www.blender.org/press/blender-5-2-lts-release/); details in [research §2](research-blender.md#2-platform-blender-on-the-m4-pro).
3. Set Metric units, 30 fps, square pixels and 1920 × 1080. Create shared render presets and the section collection structure: `Terrain`, `ExistingFeatures`, `ProposedTrail`, `Vegetation`, `People` (with `Cyclists` and `Pedestrians`), `Dogs`, `CommunityAmenities`, `ActivityAreas`, `Cameras`, `Lighting`, `Reference`.
4. Save comparison frames from the existing prototype at 0, 119, 120, 200, 359, 360, 400 and 599. These cover both shot boundaries and the rider/bridge views.
5. Build a rough community animatic using existing renders, the section 8 storyboard and placeholder narration. Map every community requirement to a shot, asset or supporting concept view before detailed art work.

**Exit:** versioned input manifest, comparison images, a rough community animatic and an empty template scene that opens and renders locally.

### Phase 2 — Transfer Maentwrog as a plain blockout

1. Export `PROTOTYPES["maentwrog-photo"]` in the photo look, using its current inputs, source IDs and 600-frame motion/camera samples, as the [design's package](design-blender.md#2-the-interchange-package) specifies (manifest, sidecars, hashes, control points).
2. Import terrain, the flattened trail corridor, the 3 m proposed trail, roads, bridge, buildings and barriers with plain materials. Retain both bare-terrain and proposed-corridor references for checking earthworks.
3. Import tree/grass placement points and height/scale attributes. Use simple placeholders initially.
4. Compare at least ten corresponding control points across the section: route bends, bridge endpoints, terrain nodes and building corners. Check scale, orientation and heights.
5. Render a low-cost 600-frame preview to reveal camera, timeline and terrain problems before detailed art work.
6. Block out additional walkers, cyclists and family groups using simple figures sized for their intended ages. Plan passing space and camera visibility before buying, modelling or rigging detailed characters. Keep a population-hidden comparison view for checking the original geography and cameras.

**Exit:** geographically aligned blockout, correct cameras and an uninterrupted 20-second preview. Numerical transfer error target: at most 0.05 m against exported coordinates; this measures conversion fidelity, not real-world survey accuracy.

### Phase 3 — Build reusable landscape materials and assets

| Element | Blender work |
|---|---|
| Terrain | Blend grass, heath, forest-floor and rock materials using the existing land-cover classes and slope. Use metre-scaled textures and broad variation to reduce tiling. Preserve DEM shape. |
| Trail | Use the exported ribbon/UVs, compacted gravel, subtle normal detail and restrained edge vegetation. Preserve width, profile and bridge transitions. |
| Walls and fences | Start from sourced barrier geometry; improve stone/timber materials and visible silhouettes. Heights and unmapped gaps remain labelled as approximate/proposed. |
| Trees | Replace the current illustrated cards with a small licensed library of broadleaf/conifer mesh variants. Preserve sourced placement/height constraints; species remain generic unless evidenced. |
| Grass and scrub | Instance a few clump variants at exported points near the visible route. Keep trail, road, building and camera exclusions. |
| Buildings and bridge | Retain mapped footprint, placement and measured/default heights. Add believable roofs/materials and small bevels; only add identifiable structure details when reference evidence supports them. |
| Water | Preserve the exported outline, islands and shared water level. Add physically plausible reflections and subtle surface normals for the lake sequence. |
| Gateways and rest places | A reusable kit of unobstructed entrances, supported seating, wheelchair spaces, accessible picnic provision, cycle parking and wayfinding, staged at evidenced or explicitly illustrative locations. |
| Recreation and interpretation | Small off-path gathering/nature-learning spaces, slate/railway interpretation, simple repair provision and quiet landscape viewpoints, with source/status and operating assumptions recorded. |

Use [Geometry Nodes instances](https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/instances.html) for vegetation, driven by exported points and attributes. Keep instances shared, use detailed assets near the camera and simpler assets in the distance, and keep quality changes consistent over a shot to avoid popping.

Reuse the existing diffuse/normal pairs first. Set colour textures appropriately and normal maps to Non-Color; feed normals through a Normal Map node. Add roughness or higher-resolution assets only where close-up renders justify them, and register every new file. Blender documents [Non-Color data handling](https://docs.blender.org/manual/en/5.2/render/color_management/color_spaces.html).

The licence-checked shortlist is in [research §4](research-blender.md#4-assets-and-licences): MTree (GPL tool; the meshes are ours) for broadleaves, Poly Haven `fir_tree_01`/`pine_tree_01` (CC0) as conifer stand-ins, Poly Haven and ambientCG grass, moss and slate (CC0). Poly Haven has no oak, birch, rowan, ash, hawthorn, spruce or larch, and no CC0 or CC BY heather, bracken or rush was found: build those in Geometry Nodes or from the project's own photographs. Near the camera, place trees from a **1 m canopy model** (pit-filled, height-dependent local maxima, allometric crowns; [design §7](design-blender.md#7-close-up-data-phase-3)); the 1 m lidar was flown in winter (2020–23), so broadleaf crowns read low.

Do not use procedural displacement to invent cuttings, rock formations or terrain relief. A finer mesh requires finer source sampling if it is meant to represent actual geography.

**Exit:** one aerial still, one rider-eye still and one bridge/follow still with clearly improved surface and vegetation quality, checked against the existing data and available location references.

### Phase 4 — Build the inclusive cast and animate walking and cycling

Representation is a requirement for the film as a whole, with people visible at a meaningful scale and duration. The pilot demonstrates a representative mixed group; the full reel completes the coverage. Use a broad range of ethnic backgrounds, skin tones, facial features and hair textures, with men, women, boys and girls represented across age groups. Vary height, body build, everyday clothing and cycling experience. Design individual characters with suitable references; changing the skin colour of one repeated model is insufficient.

| Age group | Walking and everyday activity | Cycling activity |
|---|---|---|
| Babies, toddlers and young children | Accompanied families, pushchairs and young children walking with adults | Child seats, family cycles or accompanied balance/small bikes as appropriate to the individual child |
| School-age children | Walking with family or friends and exploring the route | Correctly sized children's bicycles, accompanied groups and recreational riding |
| Teenagers | Friends walking together and independent walkers | Leisure riding and small mixed groups |
| Younger adults | Solo walkers, couples, friends and parents/carers | Everyday, recreational and family cycling |
| Middle-aged adults | Solo and social walking, including intergenerational groups | A range of confident and relaxed riders |
| Older and elderly adults | Active walkers, couples and groups; some individuals using walking aids | Older cyclists on suitable conventional, step-through, electric or adapted cycles |

Include wheelchair users and people with different mobility needs, including adapted cycling. Distribute ethnic diversity across activities, age groups and family/friend groups. Do not tie ethnicity or gender to ability, clothing or an activity; do not make every older person frail or every cyclist young and athletic. Choose each person's pace and movement individually. Show varied family structures and mixed-background groups naturally.

**Initial casting budget:** plan approximately 16–24 distinct reusable character profiles across the full film, with 6–8 introduced across the pilot's shots. Usually show only 2–5 people close to the camera at once, adjusted for visible trail width and passing space. These are production targets, not demographic quotas or a claim to show every ethnicity within 90 seconds. Track coverage in a casting sheet with character IDs, age band, intended representation, activity, mobility equipment, scene and visible frames.

1. Source or create licensed, compatible character rigs, walking cycles, bicycles and adapted equipment. Reuse rig families where proportions permit, with individual meshes, hair and clothing. Give children suitable proportions, rigs and bicycle sizes rather than scaling an adult uniformly. Check licences and register models, textures and animation clips.
2. Retain one reference bicycle/rider calibrated to the current defaults: 0.68 m wheel diameter, 1.05 m wheelbase, approximately 1.7 m riding height. Additional people use their own dimensions, riding posture, mobility equipment and contact/root calibration; these defaults are not applied to children or every adult.
3. Start from the exported people (ADR 61: 24 seeded walkers, runners and pram pushers in the reel's ground scenes) and key each root from its exported per-frame path; play clips on NLA strips whose time follows distance (`start + (d − d0) / L_clip × cycle_frames`), so feet do not slide as the pace varies ([design §4](design-blender.md#4-import-recipes-blender-52-api)). Drive each cyclist's root from a distance-based path schedule. Preserve the existing rider's gradient-dependent speed and 0.5 m lateral offset for the comparison pass; author other riders' speeds, offsets, directions and start times separately. Derive wheel rotation from each bicycle's wheel radius and travelled distance. Start the reference rider at the existing 75 rpm cadence; vary others coherently with their pace.
4. Use foot IK to the pedals, hands to the handlebars and a stable saddle/torso pose. Add steering and restrained body lean after basic contact passes. Match the rig and animation to conventional, electric, family and adapted cycles rather than forcing one motion onto every asset.
5. Animate walkers with separate walk cycles, stride lengths, speeds, gait variation and phase offsets. Match root travel to footfall timing, handle slopes and prevent sliding or foot penetration. Add companion spacing, brief looks/gestures and relaxed pauses where the shot allows. Keep pushchair, wheelchair and mobility-aid movement in contact with the surface.
6. Use deterministic schedules for individuals and groups. Account for body, bike and equipment widths when planning bidirectional passing and overtaking on the 3 m trail; slow, stagger or wait at narrow points. Keep children with their accompanying adults and avoid groups blocking the entire path. Bake the motion after checking interactions; complex crowd simulation is unnecessary for the initial cast size.
7. Hide only the camera rider's full body in the rider-eye shot, as the current prototype does; other walkers and cyclists remain visible. A cockpit with bars/hands is optional after the view matches.
8. Check wheel/foot contacts, pedal and limb clearance, passing, equipment, slopes, bridge approaches and bends throughout the sequence. Use shared assets and lighter background characters where possible while retaining distinct foreground people. Benchmark populated scenes as well as the landscape alone.

**Exit:** a licensed reusable cast, a coverage sheet, and a populated pilot showing children, adults and older people from diverse backgrounds walking and cycling naturally, with no visible clipping, sliding or collisions. Full-film coverage includes the remaining age/activity combinations and mobility needs.

#### Cyclist realism requirements

Prioritise believable anatomy, bicycle fit and movement before fine surface detail. The current [procedural rider](../src/three-core/cyclistModel.ts) uses cylinders/spheres and single straight arm segments; keep it as a comparison placeholder while the Blender version gains a properly modelled, deforming human mesh. Preserve the existing geographic route and camera logic.

| ID | Improvement | Blender implementation |
|---|---|---|
| R01 | Human anatomy and proportions | Use a mesh with believable shoulders, hips, hands, head and body volume, with topology and deformation weights suited to bent knees, elbows and hips. Start from a licensed rigged asset or adjustable human generator. Give children appropriate proportions and adults individually varied builds. |
| R02 | Individual bicycle fit | Set frame size, saddle height, handlebar reach and riding posture for each person. Place the pelvis on the saddle, hands around the grips, feet on pedals and elbows in a relaxed bend. Fit child, conventional, step-through, family and adapted cycles individually. |
| R03 | Cycling-specific rig | Use leg IK targets following pedal positions, with controlled ankle orientation; hand targets following the handlebars; stable pelvis/saddle support; and knee/elbow pole controls for consistent bending. Retain useful spine, neck and head controls. Check deformation weights in the riding pose. |
| R04 | Convincing movement | Derive wheel spin from travelled distance and the individual wheel radius. Match crank cadence to the chosen gearing while pedalling; allow coasting with the wheels turning and cranks still. Add individual cadence, slowing, stopping, steering, restrained body lean, shoulder motion and purposeful head turns. Keep repeatable animation and continuous angles. |
| R05 | Clothing, skin and hair | Give clothing thickness, seams and visible folds at knees, hips, elbows and waist. Use separate skin, fabric, hair, eye and helmet-strap materials/geometry. Add skin colour variation, roughness and subtle, scale-appropriate subsurface scattering; use fabric texture/normal detail and suitable sheen. Check clothing/body intersections and exposure across skin tones. |
| R06 | Bicycle detail and materials | Include a convincing saddle, pedals, crank, chain/drivetrain, brake levers, cables, tyres and spokes where visible. Distinguish rubber, painted metal, exposed metal and plastic. Keep mechanical motion consistent in close views and simplify distant assets. |
| R07 | Distinct people and riding styles | Vary faces, proportions, hair, everyday clothing, posture and movement across the agreed age/gender/ethnicity/body/mobility coverage. Use ordinary jackets and recreational bicycles alongside other appropriate equipment. Preserve individual identities through adjoining shots. |
| R08 | Quality at actual viewing distance | Allocate detailed mesh, face/hair and clothing work to foreground riders; use lighter versions in distant/aerial shots. Evaluate silhouettes, contact, deformation and motion at final output size as well as in close inspection. Benchmark a populated shot before expanding the library. |

**Suggested starting tools:** [MakeHuman's MPFB extension](https://extensions.blender.org/add-ons/mpfb/) (2.0.18, Blender 4.2+; its core assets are CC0, packs are licensed pack by pack) for adjustable human meshes, materials, clothing assets and rig options (default, `cmu_mb`, Mixamo, Rigify), and [Blender Rigify](https://docs.blender.org/manual/en/5.2/addons/rigify/index.html) for the human control rig. MPFB's ethnicity is a three-way blend, its CC0 skins are mostly light and its hair has nothing afro-textured and no headwear: plan to author textured hair, headwear and darker skin textures and review them with the community. Motion: 100STYLE walks and runs (CC BY 4.0), the CMU database (free, credit requested; MPFB's `cmu_mb` rig matches it) and, for pedalling timing, the "Dataset of Motion Capture of Cyclists" (CC BY 4.0, road and time-trial bikes, 60–110 rpm, no steering). Avoid CC BY-NC sets (Bandai Namco). No licence-clean pram-pushing clip exists: use a walk with hand IK. Register every model, clothing, texture and clip. A generated rig still needs bicycle-specific fitting, targets, deformation checks and animation work. Blender's [Principled material documentation](https://docs.blender.org/manual/en/5.2/render/shader_nodes/shader/principled.html) covers skin scattering and fabric sheen. Bikes, prams, wheelchairs and dogs: [research §4](research-blender.md#4-assets-and-licences) (no hand-cycle and no realistic CC0 rigged dog was found).

Keep physical units consistent with the metre-scale Blender scene: wheel rotation in radians is travelled distance in metres divided by wheel radius in metres. Sample the actual trail surface at front/rear wheel contact positions to check bicycle height/pitch through bends and gradients. Foot targets must follow the corresponding pedals with appropriate offsets; the two cranks remain opposite. Avoid unwanted limb stretching and abrupt changes in the knee direction.

**First character milestone:** after the geographic blockout, produce one convincing adult rider/bicycle and a **5–10-second animation proof** (150–300 frames at 30 fps). Include pedalling, a bend and coasting, inspected from side, front and following views. Use the intended terrain, lighting and output resolution, and compare against filmed cycling references suitable for the chosen bicycle and posture. Do this before building the full 16–24-person cast.

**Proof acceptance:** hands maintain believable grip, feet remain correctly placed on pedals, wheels stay on the trail, the pelvis is supported, knees/elbows bend consistently, and clothing does not visibly intersect the body or bicycle. Check wheel/crank behaviour while pedalling and coasting, steering through the bend, smooth body movement and the transition between actions. Save the editable character/bicycle scene, rig controls, fitted dimensions, source/licence records, animation and preview frames as the reusable reference. Validate the system on a second person with different proportions before expanding it across the cast.

#### Dog walkers and dog animation

Dog walkers are required in the community reel. Include at least one clearly readable dog-walking moment and one considerate interaction with a passing cyclist; combine these within one scene if it reads naturally. Add a dog walker to the pilot where its shot layout permits without crowding the trail. Cast owners from the existing diverse people library, including solo walkers, older people, couples and families.

1. **Models and rigs:** plan two or three licensed dog assets covering small, medium and large builds, with suitable proportions, joint deformation and coat variation. Register model, texture and animation sources. Use detailed coats only where the camera benefits; keep distant dogs economical to render.
2. **Movement:** prepare walking, appropriate trotting, standing, brief sniffing and head/tail movement. Match gait and stride to the dog's size and travel speed. Keep paws in contact with the actual surface, with believable limb bending and transitions between walking and stopping.
3. **Owner and lead:** animate a held short lead with endpoints attached to the owner's hand and the dog's collar/harness. Coordinate owner pace, arm motion and dog position. Use a controlled animated curve or equivalent repeatable setup so the lead stays connected, varies naturally in slack and does not pass through bodies or wrap around legs.
4. **Shared use:** keep the dog close to its owner and the lead clear of the passing line. Stage cyclists slowing or waiting where needed; show passing only where the actual geometry accommodates it. Allow sniffing/pauses at suitable places without blocking entrances, rest spaces or other users. Keep dogs out of sensitive habitat and livestock interactions in the staged scenes.
5. **Proof and handoff:** render a short owner/dog walking-and-pausing preview, then check the cyclist encounter at final viewing size. Deliver editable dog rigs, lead controls, gait clips and owner/dog group records so the scene can be reused consistently.

**Acceptance:** the dog is clearly identifiable at its intended screen size; paws do not visibly skate or float; the gait suits its build and speed; the lead remains connected and avoids intersections; and the owner, dog and passing users maintain believable clearance. Check stopping/restarting, turns and contact shadows in moving footage.

### Phase 5 — Finish and assess the 20-second prototype

Preserve this exact shot structure from the current prototype:

| Source frames | Blender frames | Shot |
|---|---|---|
| 0–119 | 1–120 | Aerial descent, approximately 110 m to 35 m above the trail |
| 120–359 | 121–360 | Rider-eye view, 1.2 m over the surface, 15 m look-ahead |
| 360–599 | 361–600 | Follow view, 8 m behind, 3 m up, 1.5 m to the side |

Use the existing camera samples, rather than reconstructing these paths from the descriptive distances alone. Stage the pilot's walkers, cyclists and family groups so the rider-eye and follow shots show shared use clearly without crowding the bridge or hiding the landscape. Build soft natural lighting, a consistent sun/sky direction, restrained atmospheric depth and an AgX-managed image. Check exposure and skin materials across the cast's skin tones. Add depth of field or motion blur only where readability benefits.

Use EEVEE for quick iteration and evaluate Cycles for the final. On compatible Apple Silicon, test [Cycles Metal rendering](https://docs.blender.org/manual/en/5.2/render/cycles/gpu_rendering.html), starting from the [design's render preset](design-blender.md#5-render-preset) (fixed samples with a noise threshold, never a time limit; animated seed; the GPU denoiser, which must be switched on explicitly; Persistent Data). Benchmark 10–20 representative final-quality frames across all three shots, including vegetation-heavy frames, after a warm-up render (Cycles compiles optimised kernels in the background). Record median/slow-frame time, memory, denoising stability and output size before choosing the final preset. Existing Three.js draw-call ceilings do not translate into a Blender budget.

Render lossless PNG sequences first; use scene-linear EXR only when the grading workflow requires it. Assemble captions in the Video Sequencer from exported caption data, or render the existing Remotion captions alone as transparent ProRes 4444 and composite them, which keeps the tested caption rules. Ensure AgX is applied once: the assembly scene uses View = Standard, and in Remotion a ProRes section is read with `toneMapped={false}`. Never put thousands of frames in `public/`: Remotion's programmatic bundler copies it into every bundle. Image sequences support interrupted renders (`use_overwrite = False`, `use_placeholder = True`) and later encoding. [Official output workflow](https://docs.blender.org/manual/en/5.2/render/output/introduction.html)

**Exit:** native `.blend`, full 600-frame render, 20-second MP4, matched reference stills, source manifest, pilot casting sheet and a concise visual/performance assessment of the populated scene. Review this result before expanding the art treatment to the corridor.

### Phase 6 — Expand to the existing 90-second film

Build the remaining windows using the same importer, materials and assets; their canopy and boundary data already exist (ADR 60). Reuse one corridor environment for the four aerial sections: in the photo look its export already carries canopy-cover trees (three to a 16 m node within 1.5 km of the line), roads, water, walls and the Sentinel-2 ground image, so the Blender aerials start from the same placements as the three.js reel.

Prioritise Trawsfynydd after Maentwrog to prove the lake treatment, then Blaenau's slate/settlement landscape, Vale north/south, and the wide corridor views. Check that terrain coverage includes everything visible from the cameras; extend/rebuild source windows when necessary rather than filling missing hills with invented shapes. Topographic map tiles remain optional reference/overview material, not photographic aerial scenery.

Retain this exact existing edit from `REEL_SCENES` as the migration reference. The recommended community-facing alternative is separately specified in [the research storyboard](community-reel-research.md#4-proposed-90-second-community-edit):

| Section | Start time | Duration | Frames |
|---|---:|---:|---:|
| Introduction | 0 s | 8 s | 240 |
| Heritage | 8 s | 8 s | 240 |
| Route overview | 16 s | 10 s | 300 |
| Blaenau Ffestiniog | 26 s | 10 s | 300 |
| Vale north | 36 s | 9 s | 270 |
| Vale south | 45 s | 9 s | 270 |
| Maentwrog Road | 54 s | 10 s | 300 |
| Trawsfynydd | 64 s | 16 s | 480 |
| Closing | 80 s | 10 s | 300 |
| **Total** | | **90 s** | **2,700** |

Export the reel's section configurations independently of the 600-frame prototype; they have different camera paths, rider starts and durations. Take exactly the master timeline's frame count for each section.

Assign the full cast across the five ground sections: families with young children, teenage friends, adults, older walkers and cyclists, and people using mobility aids or adapted cycles. Include both walking and cycling within multiple sections, distribute genders and ethnic backgrounds throughout, and use the casting sheet to catch omissions. Give some people clear foreground moments; distant aerial silhouettes alone do not establish representation. Maintain character/group continuity between adjoining shots and keep population density appropriate to the setting.

**Exit:** editable section scenes, shared asset library, 2,700-frame master sequence and complete 90-second MP4 with consistent lighting, captions and concept notices.

## 5. Proposed repository layout

These are future implementation paths, not files created by this planning task:

```text
src/blender/                    Offline TypeScript loader/exporter and schema
scripts/blender/                Blender import, materials, animation, render and assembly scripts
config/blender/                 Pinned version, render presets and asset-role settings
public/3d/blender/              Landscape assets, diverse people, rigs, cycles and licensed animations
tests/blender/                  Coordinate, export and headless Blender integration checks
out/blender/exports/            Generated scene packages and input hashes
out/blender/scenes/             Generated editable section .blend files
out/blender/frames/             Per-section image sequences
out/blender/master/             Video Sequencer project and encoded films
docs/evidence/blender/          Comparison stills, measurements and review
docs/blender-build-plan.md      This plan
docs/design-blender.md          The build specification (package, mapping, import recipes, render preset, checks)
docs/research-blender.md        The research behind it, with sources
```

Keep generated scenes/renders out of routine source commits. Deliver the `.blend` files with packed or correctly linked dependencies and verify the handoff by opening them from a clean delivery directory. Keep modules under the repository's 500-line limit.

## 6. Acceptance checks and known constraints

- **Geography:** compare transformed control points, trail widths, levels, bridge/road relationships and building footprints against the exported source. Preserve source IDs, uncertainty and provenance.
- **Animation:** check the whole pilot and representative bends/grades in every later section. Check shot transitions and first/last frames explicitly. Keep imported transforms reproducible (two imports from one package must give identical arrays); compare rendered images with a documented tolerance (`oiiotool --fail 0.016 --failpercent 1`, as Blender's own render tests), because Cycles is not bit-repeatable even twice on one machine (issue #101726) and the denoiser is not temporally stable. The full list is [design §6](design-blender.md#6-checks).
- **People and representation:** compare the casting sheet with the actual rendered shots. Confirm visible children, teenagers, adults and elderly people; men and women, boys and girls; a broad range of ethnic backgrounds and body types; and different mobility needs. Include walkers and cyclists across age groups where appropriate, with infants/young children accompanied or carried. Assess varied characters rather than repeated recolours, natural interactions and clear screen time.
- **Shared-use movement:** check pedestrian foot contact, bicycle/equipment dimensions, family-group spacing, passing clearance, overtaking and stopping. No person, mobility aid, pushchair or bicycle may intersect another or leave the intended usable surface. Verify the populated scene's render time and memory budget.
- **Cyclist realism:** verify phase 4 requirements R01–R08 and the 5–10-second character proof before expanding the cast. Check anatomy/deformation, individual bicycle fit, hands/feet/saddle contacts, pedalling/coasting, steering, material response and useful foreground detail at the final viewing resolution.
- **Dog walkers:** confirm a readable dog-walking moment and considerate cyclist encounter in the main reel. Check dog scale/gait, paw contact, owner pace, collar/harness and hand attachment, lead slack/intersections, user clearance and continuity between shots.
- **Image quality:** review foliage silhouettes, texture repetition, shadows, cyclist joints, water edges, denoising flicker and camera clearance in moving footage, not only stills.
- **Edit:** exactly 600/2,700 frames at 30 fps, no missing/black frames or accidental cross-cut interpolation; legible captions and attribution inside the existing safe area.
- **Community brief:** account for every requirement C01–C13 in section 8 through a shot, asset or clearly labelled supporting view. Check recognition of all three communities, short outings, practical accessibility, recreation, Welsh identity and the feedback destination. Review the rough animatic with local users before polishing the new assets.
- **Concept integrity:** retain “Concept visualisation — not an approved route”; label the bridge's generic form and proposed trail alterations. The recorded building conflict around km 10.93 must remain visible/documented; no silent demolition or invented bypass. See `data/source-register.md`.
- **Data limitations:** retain the recorded uncertainty about lidar licence wording/survey dates and generic species/structure forms. Recheck metadata before making stronger claims or a public release. Better rendering does not resolve these gaps.
- **Regression:** implementation should run the existing lint/test/build checks and focused Blender transfer/render checks. Broader Remotion render regression is required when shared rendering logic changes; new Blender-only visual metrics need their own baselines.

## 7. Effort, render budget and first milestone

With the expanded people requirement, the revised planning estimate for an experienced developer/3D artist is **2–3 weeks for a polished, populated pilot**, then **1–3 further weeks for the full reel**. This assumes suitable reusable licensed rigs and animations are available; custom child rigs, adapted equipment or substantial character modelling can extend it. New field research and review delays are additional. A plain imported blockout should precede the polished pilot. These are estimates, not measured throughput.

The complete community brief adds an animatic, amenity assets, interactions, bilingual content and participation material. Re-estimate these after the animatic and asset inventory; the figures above are provisional and do not assume every extra facility is already modelled, sited or agreed.

Estimate rendering from the local benchmark rather than the previous Three.js timings:

```text
Pilot render hours ≈ measured seconds/frame × 600 / 3,600
Full reel hours    ≈ measured seconds/frame × 2,700 / 3,600
```

For illustration only, 30 seconds/frame is 5 hours for the pilot and 22.5 hours for the reel; 60 seconds/frame is 10 and 45 hours; 90 seconds/frame is 15 and 67.5 hours. For scale, Blender's Open Data benchmark (5.2.0) scores this M4 Pro's 20-core GPU at 2,904, about a quarter of an RTX 4090 (11,553) and half an M4 Max (5,867). Add startup, encoding and rerender allowance, and estimate disk use from measured bytes/frame: about 2–5 MB per 1080p PNG of path-traced foliage, so the pilot is about 2 GB and the reel 5–14 GB, more than this machine's free space. No paid assets, cloud rendering or new hosting are assumed; paid options (Botaniq trees, Human Generator) are listed in the research with prices for the owner to decide.

**First implementation milestone:** a repeatable command that produces `out/blender/scenes/maentwrog-blockout.blend` from the current scene data, plus three camera-matched stills proving geography, scale and timing. Complete that before investing in detailed vegetation or character art.

## 8. Complete community additions and production brief

All suggestions below are included in the plan. Priority sets production order and screen emphasis; it does not remove an item from the brief. Keep the main reel readable, with supporting concept stills or an extended consultation version for details that cannot be communicated clearly within 90 seconds. Physical features remain proposals subject to appropriate locations, access, design and operating arrangements.

### Requirements and scenes

| ID | Priority | Addition | Required content and treatment |
|---|---|---|---|
| C01 | Essential | Three-community map and gateways | Name Blaenau Ffestiniog, Llan Ffestiniog and Trawsfynydd in the title/map. Distinguish the existing live railway, proposed corridor and possible village connectors. Record each gateway's position, approach, status and source. |
| C02 | Essential | Everyday local journeys | Show a person arriving from town or public transport, someone collecting shopping, a parent on a local trip and friends meeting. Map actual destinations and street connections before depicting continuous access. |
| C03 | Essential | Inclusive use in action | Carry the phase 4 age/gender/ethnicity/body/mobility coverage into meaningful activities. Include older neighbours, children, adapted cycles, wheelchair users and teenage girls using the space independently where appropriate. Give people clear screen time and natural interactions. |
| C04 | Essential | Llan Ffestiniog destination | Give Llan a named scene, proposed village connection and modest off-path rest/gathering place. Include supported seating, adjacent wheelchair space, an accessible picnic option, cycle parking and village directions. Establish the location rather than assuming the old station site is public. |
| C05 | Essential | Short local outings | Show several possible joining/turn-back points and manageable sections. Derive any distance, gradient or journey-time information from checked approaches and profiles. Include grandparents with grandchildren and people enjoying a short outing. |
| C06 | Essential | Practical accessibility and considerate passing | Depict firm, even surfaces, unobstructed entrances, readable signs, comfortable resting and realistic passing. Animate slowing, waiting and single-file movement where necessary. Check shared/separated options against demand, widths and disabled users' needs; retain the 3 m ribbon as a concept, not proof of suitability. |
| C07 | Essential | Nature and heritage | Include a quiet landscape pause, retained vegetation and sourced railway/slate interpretation. Show the existing railway context before the proposed treatment and identify options still to investigate. Distinguish the live Ffestiniog Railway to Porthmadog from this former standard-gauge corridor. |
| C08 | Essential | Welsh voice and participation | Develop Welsh-led narration or local voices, bilingual titles/subtitles, a transcript and local language review. End with a working project short URL/QR and an offline feedback option. Invite ideas, concerns and alternative uses. |
| C09 | Further development | Family nature/play pocket | Show children exploring or learning in a small area beside the route while adults rest. Keep play/gathering clear of through movement, private property and sensitive habitat; use a separate illustrative insert if a site is not established. |
| C10 | Further development | Community-led activities | Plan a small guided walk, outdoor learning/creative session and cycle-confidence group. Depict possible future programming without attributing it to an organisation or using an invented testimonial. |
| C11 | Essential for dog walkers | Dog walking and everyday recreation | Include clearly visible dog walkers on short leads and considerate cyclist interactions as main-scope content. Also plan jogging, sitting, sketching and watching the landscape. Stage activities without blocking movement or disturbing wildlife. |
| C12 | Further development | Village enterprise and facilities | Show people continuing into village shops/cafés and investigate simple cycle parking/repair, hire, toilets and drinking-water provision. Treat new services as proposed; verify any existing facility's location, availability and operator. Do not turn private station homes into public amenities. |
| C13 | Further development | Weather, care and long-term operation | Include a restrained damp-weather view, credible surface/drainage intentions and cared-for edges. Record who would maintain/inspect facilities and how problems could be reported. Show investigation/phasing rather than promising flood-free performance, funding or an opening date. |

### Public-facing 90-second storyboard

This is the proposed community edit; the section 4 table preserves the existing migration reference. Use separate data/configurations for this version.

| Time | Source frames, inclusive | Scene | Required emphasis |
|---|---|---|---|
| 0–8 s | 0–239 | Older neighbours, young friends and a family at human scale | Could this corridor become a place for our communities? |
| 8–18 s | 240–539 | Three-community map and railway context | Blaenau Ffestiniog – Llan Ffestiniog – Trawsfynydd; existing and proposed links are distinct |
| 18–30 s | 540–899 | Blaenau town/public-transport gateway | Everyday access to places people already use |
| 30–44 s | 900–1319 | Llan Ffestiniog connection and rest/gathering place | Join locally, meet friends, take a shorter outing |
| 44–58 s | 1320–1739 | Maentwrog walking, wheeling and cycling | Diverse people, realistic passing, comfortable shared use |
| 58–70 s | 1740–2099 | Trawsfynydd village/landscape and proposed recreation-network connection | Recreation and links to the existing wider network |
| 70–78 s | 2100–2339 | Quiet nature-learning/rest moment and heritage detail | Care for the landscape and remember its story |
| 78–84 s | 2340–2519 | Simple choices/next-steps graphic | Explore access, railway options, nature and long-term care together |
| 84–90 s | 2520–2699 | Community invitation, readable short URL and QR | Where would you join? What matters most? |

The community master was planned at 2,700 frames at 30 fps and grew to 5,400 (three minutes) in the build. Keep the concept badge and appropriate attribution. Use narration for explanation and short captions for the key message. Provide accurate speech subtitles, a transcript, good contrast, sufficient reading time and a sound-off check. Welsh narration with English subtitles is a proposed master; an English-narrated version can serve additional audiences. Use actual consented resident voices when available, and identify scripted placeholders during development. Draft translations require fluent local review.

### Landscape, access and credibility checks

- **Public transport:** use Blaenau's station/town interchange as a potential gateway; check the approach, crossings and gradients. Do not imply that every bus carries bicycles or that station hire/toilets are available without checking.
- **Trawsfynydd connections:** depict a potential link to NCN 82 and existing recreation as proposed until its geometry/access is established. Verify surfaces, gradients and published lake-loop descriptions before animating a circuit. Do not imply continuous accessible, traffic-free shoreline access.
- **Nearby destinations:** Yr Ysgwrn and the slate landscape can inform interpretation and separately checked connections. Ceunant Cynfal is a separate, strenuous walking destination; it must not appear as a level cycling spur. Nearby habitats do not establish corridor-specific ecological conditions.
- **Personal safety and belonging:** include legible entrances/exits, considered sightlines, maintenance and welcoming activity. Review with women and girls and other users; a crowded render, CCTV or lighting alone does not establish safety.
- **Nature and lighting:** retain distinctive vegetation and investigate habitat-sensitive siting. Avoid depicting continuous rural floodlighting. Consider access-point lighting with both users and ecological specialists; no single light colour establishes ecological suitability.
- **Railway options:** preserve scope to investigate rail retention/restoration, conversion and rail-with-trail where feasible. The evidence note dates the explicit TfW ownership statement to 2021 and records the trust's January 2026 dissolution; neither establishes present land availability or the absence of other railway interests.
- **Current structures:** preserve private homes, mapped conflicts and site boundaries. If the Trawsfynydd reactor buildings appear, use a dated reference and decommissioning label rather than inventing a completed future skyline.
- **Claims:** identify existing, proposed and approximate elements. Use local route precedents as inspiration for multiple entrances and flexible outings, without importing their accessibility grading or assuming equivalent feasibility. No invented public endorsement, partners, costs, jobs, carbon savings, visitor numbers, funding awards or completion dates.

The source-backed evidence and dated qualifications for these checks remain in [Community reel research](community-reel-research.md). Public claims and the applicable Welsh design guidance must be rechecked during production rather than treated as permanently current.

### Community feedback and involvement

Prepare these questions for the feedback destination and offline discussion; the end card uses only a short invitation:

1. Where would you join, and where would you want to go?
2. Would you use it for walking, wheeling, cycling, meeting people, recreation or an everyday journey?
3. What would make it comfortable for children, older people and disabled people?
4. Where are difficult entrances, crossings, gradients or potential conflicts?
5. What should be retained or improved for railway heritage, wildlife and neighbours?
6. How should railway retention/restoration and walking/cycling options be investigated?
7. What concerns do you have about privacy, dogs, parking, lighting, flooding or maintenance?
8. Which activities/amenities matter most, and what should the project avoid?

Plan future engagement with Ffestiniog Town Council; Trawsfynydd and Maentwrog community councils; residents and landowners; the relevant railway interests; Gwynedd active-travel/rights-of-way teams; NRW/Eryri where relevant; schools/youth groups; disabled users; older residents; women and girls; ethnic-minority residents; local businesses; people who do not cycle; and people preferring other corridor uses. Potential community contributors include Cwmni Bro Ffestiniog, Y Dref Werdd, Antur Stiniog, Seren and GISDA. Confirm current roles; no involvement or endorsement is implied, and this plan does not send invitations.

Provide a workshop/paper-map route alongside digital feedback. Ask participants whether the animatic makes the three-community connection clear, depicts something they would use, communicates that it is a proposal and explains how to respond. Record concerns and revise the brief. Frame the immediate ask as helping shape the idea and investigate feasibility. The consultation date researched on 29 October 2026 must be rechecked before publication; replace a time-limited council link with the project's continuing feedback route when appropriate.

### Blender implementation and delivery tasks

1. **Phase 1: animatic and coverage.** Add a C01–C13 coverage sheet linking each item to a shot, asset or supporting view. Prepare draft narration/subtitles and the resident-review questions before detailed modelling.
2. **Phase 2: location records and proxies.** Add gateway/connector records with settlement, coordinates, status, sources, approach and unresolved issues. Block out rest/activity areas without modifying sourced geography to make them fit. Keep unverified connectors diagrammatic and dashed.
3. **Phase 3: reusable community kit.** Build supported benches, wheelchair spaces, picnic provision, signs, interpretation, cycle parking and simple repair equipment. Give optional services and nature/play areas configurable footprints and evidence/operating notes. Verify any depicted clearances.
4. **Phase 4: interactions.** Extend the cast library with arriving, meeting, sitting, accompanying children, looking at interpretation, waiting, considerate passing, dog walking, jogging and compatible recreation. Add dog rigs, gait clips and connected lead controls. Match props/equipment to the character and maintain owner/dog and family-group continuity.
5. **Phase 5: pilot.** Demonstrate inclusive use and considerate movement, plus a modest rest-place glimpse at an appropriate or explicitly illustrative location. Use a separate insert when necessary; preserve the Maentwrog camera/geography comparison and do not force all facilities into 20 seconds.
6. **Phase 6: presentation and final edit.** Add the nine-beat community timeline, bilingual messaging, subtitles, transcript and editable feedback end card. Support existing/proposed/option views and matched-camera comparisons; an existing-condition view must preserve the railway and appropriate ground rather than reuse the proposed flattened trail as if already built.
7. **Handoff.** Deliver the editable community scene assets, completed coverage/casting sheets, source/status records, working media/text files and end-card destination. Keep public release as a separately authorised action. Record maintenance, land/access, design and operating questions that the film intentionally leaves for the next stage.

## 9. Readiness checklist

Go/no-go before phase 2. Each line is a check on this machine, not a document.

| # | Item | Done when |
|---|---|---|
| 1 | Disk | at least 20 GB free for the pilot (Blender, caches, exports, frames, encodes), or `out/blender/` on an external volume; the render script refuses to start below its estimate |
| 2 | Blender | 5.2.3 installed from the checksum-verified DMG or `blender@lts`; `blender --version` recorded by the build scripts (`bpy.app.version_string` in their reports) |
| 3 | GPU | a 16-sample Cycles still renders on METAL with MetalRT and the GPU denoiser, from a `--factory-startup` script |
| 4 | Headless tests | `bpy==5.2.3` in an arm64 Python 3.13 environment runs an empty pytest suite under `tests/blender/` |
| 5 | EEVEE | `blender -b` renders an EEVEE frame outside a login session, or previews fall back to Cycles at low samples |
| 6 | Benchmark | 10–20 frames of a plain Maentwrog blockout at the draft preset, after a warm-up: seconds per frame, peak memory, bytes per frame |
| 7 | Assets | the shortlist's licences re-opened and copied into `data/assets-3d.json` entries before download; the unverified ones (Fab EULA, Mixamo, Rokoko, ActorCore) left out until verified |
| 8 | Exporter | `scripts/blender/export-section.ts` writes the Maentwrog package; its hashes and the design §6 transfer and camera checks pass |
| 9 | Owner decisions | paid assets (if any), an external disk, and whether captions are composited from Remotion or rebuilt in the Video Sequencer |

## Planning record

Scope authorised: inspect the project, create this build plan, expand it to include people of all ages, genders and diverse ethnic backgrounds walking and cycling, and research additions for its community-project use. Changes made: this document and the linked community research note. Existing code, data, staged changes and renders are preserved. No software installation, asset purchase, infrastructure operation or render was performed for these planning tasks. Implementation sequencing follows the repository's one-writer rule; multi-file implementation should use its required isolated ownership and coordination workflow.

Update of 30 October 2026: all community suggestions have been consolidated directly into this plan, with stable requirement IDs, the complete revised storyboard, production tasks and feedback questions. This update changes this document only; the research note remains the supporting evidence record.

Cyclist realism update: added requirements R01–R08, MPFB/Rigify/material references, bicycle-fitting and contact-animation guidance, and a 5–10-second character milestone with acceptance checks. This is planning guidance; no character assets or animation have been created by this update.

Dog-walker update: promoted dog walkers to main-scope content and added dog assets/rigs, gait and paw-contact animation, coordinated owners/leads, considerate cyclist interactions and acceptance checks. No models or scene code were changed by this document update.

Research update of 30 October 2026: three parallel research strands (platform, assets and licences, data pipeline), with the plan-steering claims re-checked on their primary pages, produced [research-blender.md](research-blender.md), the build specification [design-blender.md](design-blender.md) and [ADR 62](adr/0062-blender-pipeline.md). This plan was corrected where it predated ADRs 60 and 61 (data for every window, the aerial extras, the seeded people), where Blender 5.x changed its API, and where the manual links pointed at the Slovenian and Serbian manuals; the readiness checklist (section 9) was added. The export format, coordinate mapping and camera conversion were measured with Blender 5.2.3 as a Python module in a scratch environment, since deleted; nothing was installed permanently.

Evidence: the current working-tree inputs named above, ADRs 5, 35 and 54–62, `docs/research-photoreal.md`, `docs/research-blender.md`, and the inspected prototype frames 200/400. Official Blender references were checked on 2026-10-29 and 2026-10-30; implementation must verify exact APIs against the pinned Blender build.
