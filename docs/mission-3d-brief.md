# Realistic 3D Cycling Route Animation — Three.js + Remotion

Act as a **Senior Three.js Developer, GIS Specialist, 3D Environment Artist and Cinematic Animation Director**.

Enhance the existing Trawsfynydd–Blaenau Ffestiniog railway-to-cycle-trail project using **Three.js and Remotion** to create a realistic, geographically accurate 3D animated video showing cyclists travelling along different sections of the proposed route.

Reuse the project's existing research, historical railway mapping, GIS coordinates, terrain data, visual references and code. **Improve the existing implementation rather than rebuilding it.**

The objective is a cinematic virtual cycling experience that closely resembles the **real North Wales landscape**, while clearly presenting the cycle route as a proposal rather than an existing or approved facility.

## 1. Geographic accuracy — highest priority

Research and validate the available geographical evidence before modelling.

- Follow the actual historic railway alignment, including bends, gradients, embankments and cuttings.
- Generate terrain using real Digital Elevation Model (DEM) data.
- Position roads, bridges, settlements, lakes and railway structures using verified geographic coordinates.
- Reflect the distinctive landscapes around Blaenau Ffestiniog, Llan Ffestiniog, Maentwrog Road and Trawsfynydd.
- Represent slate landscapes, stone walls, vegetation, hillsides and rural scenery appropriately.
- Convert GIS coordinates accurately into a local Three.js coordinate system.
- Clearly identify existing, approximated and proposed features.
- Account for potential heritage railway restoration and rail-with-trail alternatives.

**Do not invent geographic features or prioritise visual effects over accuracy.**

## 2. Realistic Three.js environment

Create a believable 3D landscape using:

- Terrain meshes generated from genuine elevation data.
- A trail mesh following the verified railway centreline.
- Realistic textures, natural lighting, shadows and atmospheric effects.
- Geographically appropriate vegetation and landscape features.
- Existing railway bridges, cuttings and embankments where verified.
- Accurate object scale, terrain gradients and trail dimensions.
- Efficient glTF/GLB models and instancing where appropriate.

Aim for **high-quality architectural visualisation**, avoiding generic game environments or exaggerated fantasy landscapes.

Use licensed or original assets, documenting their sources and attribution requirements.

## 3. Proposed cycling trail

Model a realistic conceptual shared-use route, including:

- Suitable cycling and walking surfaces.
- Believable widths, gradients and curves.
- Connections to nearby villages and existing paths.
- Road crossings, signage and viewpoints where relevant.
- Retained railway heritage features.
- Alternative alignments where physical or ownership constraints exist.

Do not assume the existing railway can be removed or that all sections are publicly accessible.

Distinguish clearly between **verified infrastructure and conceptual improvements**.

## 4. Animated cyclists

Introduce realistic cyclists travelling along the modelled route.

- Use proportionate, preferably rigged bicycle and cyclist models.
- Animate pedalling, wheel rotation, steering and natural body movement.
- Follow the actual trail geometry.
- Adjust speed and orientation to gradients and curves.
- Keep wheels aligned with the trail surface.
- Prevent clipping through terrain or infrastructure.
- Include occasional walkers where appropriate.
- Vary cyclist positioning and camera angles naturally.

Prefer reusable animations and appropriately licensed existing assets instead of unnecessarily complex custom character systems.

## 5. Multiple geographically accurate scenes

Create distinct cinematic sequences from different parts of the route:

| Location | Scene |
|---|---|
| Blaenau Ffestiniog | Aerial approach revealing the historic railway and slate landscape |
| Railway cuttings | Cyclists travelling through accurately modelled cuttings |
| Countryside | Side-follow camera showing hills, woodland and embankments |
| Llan Ffestiniog | Elevated view of village surroundings |
| Bridges and crossings | Close-up of verified railway structures and conceptual trail treatment |
| Maentwrog Road | Scenic cycling transition reflecting local geography |
| Trawsfynydd | Wide views towards the lake and surrounding landscape |
| Full corridor | Animated aerial route overview |

Only depict locations and structures where sufficient evidence exists. Clearly identify conceptual replacements or missing route sections.

## 6. Cinematic camera system

Implement reusable Three.js camera animations:

- Drone-style aerial flyovers.
- Cyclist-following shots.
- First-person cycling perspectives.
- Side-tracking views.
- Ground-level close-ups.
- Wide landscape establishing shots.
- Smooth transitions between route sections.

Use realistic camera movement, appropriate field of view and smooth acceleration. Avoid abrupt transitions, collisions and unnecessary effects.

The viewer should feel they are cycling through the actual landscape.

## 7. Three.js and Remotion integration

Use **Three.js for modelling/rendering** and **Remotion for frame-based animation, scene sequencing and video export**.

React Three Fiber may be used where it simplifies the existing implementation.

Requirements:

- Drive all animation using Remotion's frame number.
- Ensure deterministic rendering and repeatable output.
- Synchronise cyclist movement, camera paths and scene transitions.
- Use reusable terrain, route, cyclist and camera components.
- Separate geographic datasets from rendering logic.
- Preload 3D assets and manage GPU resources.
- Avoid uncontrolled real-time animation loops.
- Preserve existing project functionality.

Verify library compatibility using current official documentation before changing dependencies.

## 8. Performance

Target **1920 × 1080 at 30 fps**, with optional 4K export.

Optimise using:

- Terrain tiling and appropriate mesh resolution.
- Level of detail for distant scenery.
- Instanced vegetation.
- Texture compression and reuse.
- Efficient lighting and shadows.
- Asset preloading and controlled draw calls.

Avoid heavyweight physics, unnecessary frameworks or expensive rendering features without proven benefit.

## 9. Geographic and visual validation

Compare each featured scene against available mapping, elevation data and reference imagery.

Verify:

1. Railway alignment and curvature.
2. Terrain elevation and gradients.
3. Relative positions of roads, bridges and water.
4. Local landscape characteristics.
5. Trail dimensions and cyclist proportions.
6. Cyclist movement and camera accuracy.
7. Visual consistency between scenes.
8. Clear distinction between existing and proposed infrastructure.

Maintain a concise evidence register identifying verified, approximate and conceptual elements.

Do not claim survey-level precision from public elevation or mapping datasets.

## 10. Incremental implementation

**Phase 1 — Validate geographical data**

Inspect existing GIS information, route coordinates, elevation models and visual references. Identify inaccuracies and gaps.

**Phase 2 — Build a 10–15-second proof of concept**

Select one well-documented section and create a complete scene featuring:

- Real geographic terrain.
- Accurate railway alignment.
- Modelled proposed cycle trail.
- One realistic animated cyclist.
- Natural landscape features.
- Smooth cinematic camera movement.

Render and review this scene before expanding the solution.

**Phase 3 — Reusable 3D components**

Develop reusable terrain, trail, cyclist, vegetation and camera systems without overengineering.

**Phase 4 — Additional route sections**

Extend the animation to other verified locations, maintaining consistent scale, lighting and geographical accuracy.

**Phase 5 — Final cinematic video**

Integrate the scenes into Remotion, refine transitions and produce a polished 90–120-second concept video.

## 11. Deliverables

Produce:

1. Updated Three.js and Remotion project.
2. Verified GIS and elevation-based 3D route model.
3. Reusable terrain, trail, cyclist and camera components.
4. A rendered 10–15-second proof of concept.
5. Multiple geographically grounded cycling scenes.
6. A final 90–120-second animated video.
7. Representative scene preview images.
8. Geographic and visual evidence register.
9. Performance and render validation results.
10. Concise instructions for editing, previewing and rendering.

## 12. Acceptance criteria

- The 3D route follows the verified historic railway alignment.
- Terrain comes from real elevation data.
- Distinctive local features are geographically credible.
- Cyclists move naturally along the modelled trail.
- Multiple identifiable route sections are represented.
- Three.js and Remotion work together reliably.
- Rendering is deterministic and reproducible.
- The animation distinguishes factual geography from proposed infrastructure.
- Existing functionality is preserved.
- Models and imagery comply with licensing requirements.
- The project remains simple, reusable and maintainable.
- The proof of concept and final video have been rendered and visually reviewed, where the environment supports rendering.

**Guiding principle:** Create a cinematic, realistic 3D cycling journey along the former Trawsfynydd–Blaenau Ffestiniog railway, grounded in real GIS data, terrain and visual evidence. **Geographic accuracy comes first, visual realism second, and technical simplicity throughout.**
