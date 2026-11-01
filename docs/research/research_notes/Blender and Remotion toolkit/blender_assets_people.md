# Blender assets, add-ons and libraries for a realistic Eryri cycling/walking film (vegetation, materials, people, animation, bicycles, sky)

Scope note: researched 2026-11-01 for Blender 5.2.4 LTS / EEVEE / Windows 11 / RTX 2060 6 GB / headless Python builds. Already in use: MPFB 2.0.18 + CC0 MakeHuman system assets, Poly Haven CC0 textures, own procedural gait and bike scripts. About 25 search/fetch calls were made. Several vendor pages (fab.com EULA returned HTTP 403) could not be read directly, so some licence points rest on vendor documentation snippets or secondary reporting. Each such point is flagged. "Verified Blender 5.x" means a vendor or extensions-platform listing states 5.x support. No item was test-installed.

## Vegetation: tree/plant generators and libraries, British native species, LOD for EEVEE

### Takeaway
No free, CC0, Blender-5-verified source of British native species (sessile oak, birch, rowan, Sitka spruce, gorse, bracken, heather, rhododendron) turned up. The realistic options are:
- **Free:** MTree (Modular Tree), which is GPL code on extensions.blender.org with Blender 5.1 support listed, plus Sapling Tree Gen (listed "4.2 and newer", unmaintained). Both generate your own geometry, which you then own outright.
- **Paid:** The Grove 2.3 (Blender 5 compatible, about €89 and up, species-faithful growth) or Botaniq (about $50–130, Blender 5 support not confirmed in the listing found).

Geo-Scatter (paid, $99, verified 2.83–5.2) and its free cut-down Biome-Reader handle scattering. Their geometry-node engine is under a "royalty-free-like" licence, not GPL or CC0.

### Cited Findings
**MTree / Modular Tree (free)**
- MTree is published on extensions.blender.org as a "maintained fork of Mtree by MaximeHerpin". The extension page shows a recent release with official Blender 5.1 support for all platforms, while the GitHub README still lists a minimum of Blender 4.3 — [extensions.blender.org: modular-tree](https://extensions.blender.org/add-ons/modular-tree/); [awesome.ecosyste.ms: goodpie/modular_tree](https://awesome.ecosyste.ms/projects/github.com%2Fgoodpie%2Fmodular_tree)
- MTree workflow: an MTree node tree (Tree Mesher → Trunk → Branches nodes), automatic leaf placement on thin branches via geometry nodes, and a Pivot Painter export for UE5. This is its own node system, not a plain Geometry Nodes modifier — [extensions.blender.org: modular-tree](https://extensions.blender.org/add-ons/modular-tree/)

**Sapling Tree Gen (free)**
- Official extension version 0.3.6, "Blender 4.2 and newer", published 14 May 2024. A third-party write-up calls it "not been updated in years" — [extensions.blender.org: sapling-tree-gen](https://extensions.blender.org/add-ons/sapling-tree-gen); [cgdive: sapling tree gen](https://cgdivetest.super.site/tools/sapling-tree-gen-pre-installed-addon)
- Reviews disagree. One says it works "like a charm" in 4.5; another says its animation does not work in 4.4/4.5. No report specifically for 5.x was found — [extensions.blender.org: sapling reviews](https://extensions.blender.org/add-ons/sapling-tree-gen/reviews/)
- There is a community fork, "improved-sapling-tree-generator" — [GitHub abpy/improved-sapling-tree-generator](https://www.github.com/abpy/improved-sapling-tree-generator)

**The Grove (paid)**
- The Grove 2.2 supports Blender 4.2+ and Houdini 19.5. The 2.3 release (March 2026) is compatible with the Blender 5 series — [CG Channel: The Grove 2.2](https://www.cgchannel.com/2025/04/f12-releases-the-grove-2-2-for-blender-and-houdini/); [Digital Production: The Grove 2.3](https://digitalproduction.com/2026/03/02/the-grove-2-3/)
- Prices found (from 2.1-era coverage, may be dated): Starter €89, Indie €149 (both include the Blender add-on), Studio €720 (needed for Houdini). Twig packs were historically sold separately at about €9.60 each (2017 figure) — [renderu: Grove 2.1](https://renderu.com/en/news/post/25403); [BlenderNation: Grove 5](https://www.blendernation.com/2017/11/29/grove-5-gets-wind-animation/)

**Botaniq (paid)**
- Blender Market tiers: $1.99 starter (4% of the library), $49.99 lite (42%), $129.99 full; studio licences $249.99 (2–5 seats) and $389.99 (6–10 seats). The listing seen showed Blender 3.3–4.2 support only, and no Blender 5 statement was found — [Blender Market: botaniq-trees](https://blendermarket.com/products/botaniq-trees)
- botaniq 7.1 (August 2025) added 200+ assets and a filter for plant species by location — [CG Channel: botaniq 7](https://www.cgchannel.com/tag/botaniq-7)

**SpeedTree (paid subscription)**
- Indie is $19/month or $199/year for revenue under $100k and includes "All Games and Cinema Exports". Cinema export formats include OBJ, FBX, ABC and USD. The free Learning Edition "doesn't allow exports of any kind". A SpeedTree store account and internet access are required to use the product — [Unity: SpeedTree](https://unity.com/kr/products/speedtree); [CG Channel: SpeedTree 9](https://www.cgchannel.com/2022/01/idv-ships-speedtree-9-0/); [SpeedTree store FAQ](https://store.speedtree.com/?p=810750); [SpeedTree store](https://store.speedtree.com/?p=804951)

**Geo-Scatter / Biome-Reader (scattering)**
- Geo-Scatter 5.6 on Superhive lists Blender 2.83–5.2. Individual licence $99, Studio $1,299 — [Superhive: Geo-Scatter](https://superhivemarket.com/products/scatter)
- Biome-Reader is a free, cut-down edition that installs, reads and scatters biomes, downloadable from geoscatter.com. The developer says not to install both plugins at once — [CG Channel: Biome-Reader](https://www.cgchannel.com/?p=144602); [Geo-Scatter changelog](https://sites.google.com/view/scatter5docs/Changelogs)
- Licence: the scripts are GPL, but "our geometry-node engine is released under a license similar to royalty-free" (terms at geoscatter.com/legal). No separate Biome-Reader licence statement or Blender 5 confirmation was found — [Geo-Scatter changelog](https://sites.google.com/view/scatter5docs/Changelogs)

**Poly Haven models (free)**
- All Poly Haven assets are CC0. Tree models exist, for example "tree_small_02" by Rico Cilliers — [Poly Haven licence](https://polyhaven.com/license); [Poly Haven: tree_small_02](https://polyhaven.com/a/tree_small_02)

### Inferences
- **Recommended free stack:** use MTree to generate sessile oak, birch, rowan and Sitka-spruce-like trees as owned GPL-tool output, then bake 2–3 LOD meshes plus a camera-facing card for distant trees. Scatter them with plain Geometry Nodes "Instance on Points". Instances share one mesh in VRAM, which matters on a 6 GB card. Generated meshes are your own output (tool licence ≠ output licence), so they can be registered as project-original.
- **If budget allows:** The Grove 2.3 is the most botanically faithful generator, and its growth model suits gnarled Atlantic oakwood. Botaniq is the fastest library route, but Blender 5 support must be confirmed before buying. Botaniq and Geo-Scatter biomes are royalty-free-paid content, so they can appear in a public video, but the raw assets cannot be redistributed in a public repo.
- **Ground cover:** gorse, bracken, heather and rhododendron are best built as small hand-made or scanned instance sets (frond/card meshes with alpha). No CC0 British-specific library was found.
- **Headless use:** MTree and Sapling are operator/node driven, and scripting them in `blender -b` is plausible but unverified here. Geo-Scatter, Botaniq and The Grove are UI-centric add-ons, so their headless use was not confirmed.

### Gaps
- Tree-It, Grassblade, Scatter5-vs-Geo-Scatter naming history, "TreeGen" and other "Free Trees" packs: not researched within the call budget.
- No source was found that confirms availability of UK-native species (sessile oak, rowan, Sitka spruce, gorse, bracken, heather) in any library. Botaniq's species list was not retrieved.
- The Grove's current 2.3 prices and twig catalogue, and Botaniq's Blender 5 status, were not confirmed.
- No EEVEE-specific benchmarks of vegetation polycount or VRAM on 6 GB cards were found.

## Materials and textures (CC0 libraries, Fab/Megascans licence changes, BlenderKit, slate/drystone/asphalt)

### Takeaway
Poly Haven and ambientCG are both CC0 and are the safest primary sources. ambientCG explicitly permits redistribution of the files. BlenderKit's free tier is usable commercially, but each asset carries either CC0 or BlenderKit "Royalty Free", and Royalty Free forbids reselling or redistributing the assets themselves, so check per asset. Megascans stopped being free on 31 Dec 2024. They are now paid Fab content under the Fab Standard Licence (Personal tier under $100k revenue), apart from about 1,500 free assets and items claimed during the promotion. Fab assets can carry a seller "NoAI" tag. The ready-made slate-specific materials found were all paid (CGTrader, Superhive).

### Cited Findings
- **Poly Haven:** "all assets are licensed as CC0". The website itself is covered by a standard Terms of Service to prevent misuse — [Poly Haven licence](https://polyhaven.com/license)
- **ambientCG:** assets are CC0 and "may be used for commercial purposes, even if that means redistributing them as files". Rough library size is about 1,500 assets (forum-reported, dated). Sources disagree on whether it offers 3D models — [licenseorg: ambientCG](https://licenseorg.com/guide/3d-assets/ambientcg); [Godot forums](https://godotforums.org/d/19004-lets-build-a-free-alternative-of-megascans-photoscanned-library)
- **BlenderKit:** the Royalty Free licence "doesn't allow to re-sell 3D models even if modified"; CC0 assets are public domain. The FAQ says everything can be used commercially and non-commercially, and the only RF limit is selling the assets themselves — [BlenderKit licences](https://www.blenderkit.com/docs/licenses/); [BlenderKit Licensing FAQ](https://www.blenderkit.com/docs/licenses/licensing-faq/)
- **BlenderKit free tier:** 48,000+ free assets (September 2025). A January 2026 article says free-tier assets can be used commercially "provided the creator's licence allows it" — [CG Channel 2025](https://www.cgchannel.com/2025/09/get-over-48000-free-3d-models-materials-and-hdris-from-blenderkit/); [Digital Production 2026](https://digitalproduction.com/2026/01/13/over-1000-free-sculpting-brushes-land-in-blenderkit/)
- **BlenderKit add-on:** open source on GitHub — [GitHub BlenderKit](https://github.com/BlenderKit/blenderkit)
- **Megascans on Fab:** no longer free after 31 Dec 2024. Items claimed during the promotion stay available. From 1 Jan 2025 a selection of 1,500+ Megascans is free on Fab, and the rest is paid. In March 2025 Epic granted Fab Standard licences to users who had claimed all Megascans on Quixel/Bridge — [UE forum: free Megascans ends](https://forums.unrealengine.com/t/reminder-free-megascans-ends-soon/2203090); [UE forum: Quixel to Fab FAQ](https://forums.unrealengine.com/t/quixel-to-fab-transition-faqs/2033839); [UE forum: Megascans update March 2025](https://forums.unrealengine.com/t/megascans-update-march-2025/2419561)
- **Fab tiers:** the Personal tier is for buyers with no more than $100,000 gross revenue in the past 12 months. The "NoAI" meta tag "indicates that an asset must not be used for generative AI data collection" and is only available for Standard-licence assets — [Epic docs: licenses and pricing in Fab](https://dev.epicgames.com/documentation/en-us/fab/licenses-and-pricing-in-fab)
- **Slate materials:** the slate-specific PBR materials found were paid listings, for example "Slate Rubble 8K PBR" (Superhive/CGTrader), "cracked slate rock PBR" and Stonelake3D "Slate Stones Tile 01" — [Superhive: Slate Rubble 8K](https://superhivemarket.com/products/slate-rubble-8k-pbr-texture); [CGTrader: cracked slate](https://www.cgtrader.com/3d-models/textures/natural-textures/cracked-slate-rock-pbr); [CGTrader: Stonelake3D](https://cgtrader.com/3d-models/textures/architectural-textures/slate-stones-tile-01-stonelake3d)

### Inferences
- **Order of preference for the project register:** Poly Haven → ambientCG (both CC0, redistributable) → BlenderKit assets marked CC0 → BlenderKit RF (fine in the film, but do not commit raw files to a public repo) → Fab/Megascans (paid or claimed, Standard licence, no redistribution; respect any NoAI tag).
- **Slate walls, slate tips and Welsh slate roofs:** a procedural or hybrid build (geometry-node stacked slate slabs with CC0 rock/slate albedo from ambientCG/Poly Haven) probably beats buying slate packs, keeps everything CC0, and avoids 8K textures that would strain 6 GB VRAM. Use 2K maps on EEVEE.
- **Fab EULA AI clause:** AI-training restrictions in the base EULA could not be read directly (HTTP 403). The project should store each Fab asset's licence text at purchase.

### Gaps
- The fab.com EULA could not be fetched (403), so Fab's full Standard Licence wording on redistribution, film use and AI was not quoted from source.
- CGBookcase, ShareTextures and Texture Haven licences: not verified here. Texture Haven is understood to have merged into Poly Haven, but no source was retrieved for that.
- No dedicated CC0 drystone-wall or Welsh-slate procedural kit was found. Procedural material kits (paid) were not surveyed.

## People and animation (MPFB 2, rigs, mocap sources and licences, AI video mocap, crowds, cloth)

### Takeaway
For a public community video registered with licences, the clean motion sources are:
- **CMU mocap:** widely described as free for any use; minor licence-wording conflicts exist.
- **Quaternius / Mesh2Motion:** CC0 human animations.
- **Your own captures:** single-camera AI mocap (Rokoko Vision free tier, DeepMotion free tier, FreeMoCap open source).

Mixamo can be used in a video but forbids redistributing the raw files and using them for ML training. Bandai Namco's dataset is NonCommercial (CC BY-NC 4.0 per the official repo, and some mirrors say NC-ND), which is risky for anything monetised. ActorCore free clips are allowed in commercial videos. For crowds, light Geometry Nodes tools exist: People Going Places (free), Agents (€18+, beta) and Horde (paid). CrowdMaster's status was not confirmed.

### Cited Findings
**CMU motion capture**
- About 2,605 sequences in BVH/AMC/C3D, listed as "Free for all uses (no restrictions)" by a dataset aggregator — [roboticscenter.ai: CMU mocap](https://www.roboticscenter.ai/datasets/cmu-mocap/)
- The cgspeed BVH conversions (Bruce Hahne) are described as free for any project and "not under Creative Commons or a similar limited-use license". The data is uncleaned, has joint-flipping problems and is 120 fps — [cgspeed Google group](https://groups.google.com/g/bvhacker/c/r906SGjjcTA)
- **Conflict:** a Hugging Face derivative is tagged CC-BY-4.0, which contradicts the "no CC" statement — [HF: ckinpdx/CMUMDB](https://huggingface.co/datasets/ckinpdx/CMUMDB)

**Bandai Namco Research Motion Dataset**
- The official README lists both datasets as CC BY-NC 4.0 and the Blender visualisation script as MIT. Dataset 1 has 36,673 frames; Dataset 2 has about 384,931 frames — [GitHub README](https://github.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset/blob/master/README.md)
- **Conflict:** a 2022 Automaton article and the 3dart.it mirror say CC BY-NC-ND 4.0 — [Automaton](https://automaton-media.com/en/news/20220430-12213/); [3dart.it](https://3dart.it/en/bvh-free-mocap-moves-from-bandai-namco)

**Mixamo (Adobe)**
- An Adobe-staff FAQ (September 2022) allows the auto-rigger, characters and animations in paid or unpaid creative projects. You may not distribute the raw character or animation files (asset packs, stock sites, non-team members), and "the only research application Mixamo content can't be used in is training machine-learning models" — [Adobe community FAQ](https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/td-p/13234775)

**ActorCore (Reallusion)**
- Free assets can be used in commercial videos "without any restrictions". Games and interactive apps need a free Mass Distribution Licence. Files are FBX with a Blender preset — [CG Channel 2021/22](https://www.cgchannel.com/?p=121885); [Reallusion forum](https://forum.reallusion.com/PrintTopic493214.aspx)

**Mesh2Motion / Quaternius**
- Mesh2Motion is a free, open-source web rigging and animation app ("open-source Mixamo alternative"). Its animations are reported as CC0, and the human animations come from Quaternius (CC0). It exports GLB, and the Blender source rigs are on GitHub — [GameFromScratch](https://gamefromscratch.com/mesh2motion-open-source-mixamo-alternative/); [80.lv: Mesh2Motion update](https://80.lv/articles/update-to-animation-app-mesh2motion-introduces-explore-page-better-control-rigs/); [Blendswap: Quaternius animations](https://www.blendswap.com/blend/26302)

**AI mocap from video**
- **FreeMoCap:** open-source markerless capture with webcams (at least two). Licence AGPL per PyPI, with commercial licensing also offered; a 2021 article said GPL for code and AGPL for the Blender plugin. It has a Blender add-on output — [PyPI: freemocap](https://pypi.org/project/freemocap); [CG Channel 2021](https://www.cgchannel.com/2021/07/the-freemocap-project-markerless-mocap-for-under-100)
- **Rokoko Vision:** the free Starter plan includes single-camera AI mocap with FBX export. Limits are reported inconsistently: about 15 s per recording (third party) versus 30 s/month of processing (Rokoko Vision page). Dual-camera is paid (about $240/year), and Blender live streaming needs the Plus plan — [Rokoko pricing](https://www.rokoko.com/pricing); [Rokoko Vision page](https://www.rokoko.com/ja/products/vision); [CG Channel 2023](https://www.cgchannel.com/2023/09/check-out-free-browser-based-ai-mocap-tool-rokoko-vision/)
- **DeepMotion:** the free tier is reported as about 60 s or 60 credits per month, 20 s per clip, personal and non-commercial use, with FBX/BVH export. These figures come from third-party listings and should be checked — [fitgap: DeepMotion](https://us.fitgap.com/products/deepmotion)
- **Move One (Move AI):** an iOS app plus a Blender add-on (Blender 2.80+, FBX only) that downloads animations by code. Pricing was not found — [Move AI docs](https://docs.move.ai/knowledge/blender-how-to-export-with-the-move-one-blender-plugin); [GitHub move-ai/BlenderAddon](https://github.com/move-ai/BlenderAddon)

**Crowds**
- **People Going Places:** a free Geometry Nodes crowd add-on (Blender 4.2) with no person-to-person collisions. Its low-poly character pack costs €2. A reviewer found it thinly documented and walkers clumping — [CG Channel 2024](https://www.cgchannel.com/2024/09/people-going-places-is-a-lightweight-free-blender-crowds-add-on); [cgdive review](https://cgdivetest.super.site/tools/people-going-places)
- **Agents (globglob):** €18+, beta, Blender 4.3+, pathfinding and collision avoidance, speed-based Idle/Walk/Run/Sprint switching — [Gumroad: Agents](https://globglob.gumroad.com/l/agents_crowd_simulation)
- **Horde:** paid, with Walk/Run/Static crowds via Geometry Nodes or boids — [Blender Market: Horde](https://blendermarket.com/products/horde-add-on-crowd-creation-tools)

### Inferences
- **Walkers in a public video:**
  - Keep MPFB 2 characters with the "game engine" or default skeleton and retarget CC0 or own-captured BVH onto them.
  - CMU BVH (resample from 120 to 25/30 fps, clean flips) and Quaternius/Mesh2Motion clips are the registrable choices.
  - Own Rokoko Vision captures of walking, pram-pushing and cycling are the most "recognisable" source.
- **Licence flags:**
  - Mixamo is OK in the film but must not be committed to a public repo and must not be used for AI training.
  - Bandai Namco is NonCommercial and possibly ND, so avoid it if the video is ever monetised or the clips are edited.
  - DeepMotion's free tier is reportedly non-commercial.
  - FreeMoCap's AGPL applies to the software, not to your captured motion (inference, not confirmed).
- **Crowds:** for distant walkers on a 6 GB GPU, Geometry Nodes instancing of a few baked, animated low-poly MPFB variants (cached as Alembic or as instanced collections with time offsets) is cheaper than full rigs. People Going Places or Agents may serve as reference implementations.
- **Rigify and Auto-Rig Pro:** Rigify ships with Blender. Auto-Rig Pro is a paid retargeting tool. Neither was verified for 5.2 in this pass.

### Gaps
- Auto-Rig Pro price/version, Rigify 5.x changes, CrowdMaster status, cloth workflows for clothing (simulation vs MPFB proxy clothes), and MPFB 2 improvements after 2.0.18 were not researched within budget.
- The CMU licence was not quoted from mocap.cs.cmu.edu itself.
- Mixamo's current Adobe ToS was not fetched; the 2022 FAQ may be outdated.
- No authoritative free-tier terms were fetched from DeepMotion or Move AI.

## Bicycles and riders (models, rigs, pedalling/steering, cyclist animation)

### Takeaway
No free, CC0 bicycle pedalling/steering add-on verified for Blender 5 was found. The best-documented options are:
- **Model:** BlendSwap #13264, a CC0 high-poly bicycle with no rig.
- **Rig add-on:** RideWheelRig, a two-wheeler rig with optional cranks and pedals. Its manual says it is free for personal and commercial use, but another listing marks it paid.
- **Ready rig:** ToloTolo's Gumroad bike rig, €2.89+ with a separate free v1.0 listed, credit requested.

The project's own procedural bike script plus IK pedal targets probably remains the cleanest CC0 route.

### Cited Findings
- **BlendSwap #13264:** a CC0 high-poly model of the uploader's own bicycle, with no credit required — [BlendSwap 13264](https://www.blendswap.com/blend/13264)
- **RideWheelRig:** rig for two-wheeled vehicles with optional pedal crank and pedals. Its manual says it is free for personal and commercial use; another listing marks it as paid — [Superhive: RideWheelRig docs](https://superhivemarket.com/products/ridewheelrig/docs); [cgdive: RideWheelRig](https://cgdivetest.super.site/tools/ridewheelrig-addon)
- **ToloTolo Bike Rig:** Gumroad, €2.89+, credit requested. The same store lists a "FREE BIKE RIG - Blender - v1.0" — [Gumroad: tolotolofbx Bike](https://tolotolofbx.gumroad.com/l/Bike); [Gumroad: tolotolofbx](https://tolotolofbx.gumroad.com)
- **Rigacar:** free, but for cars, not bicycles — [GitHub EviTRea/rigacar](https://github.com/EviTRea/rigacar)
- **CGTrader free bikes:** several are "Royalty Free", not CC0 — [CGTrader: free blender bike](https://www.cgtrader.com/free-3d-models/vehicle/bicycle/free-blender-bike)

### Inferences
- **Rider animation:** combine the project's own bike script (crank angle from distance travelled, wheel spin from speed, steering from path curvature) with IK pedal and handlebar targets on the MPFB rider. This avoids third-party licence entanglement.
- **Reference motion:** a short own capture (Rokoko Vision) of upper-body sway while pedalling could add realism.
- **Mesh budget:** BlendSwap 13264 (CC0) can replace or texture-reference the bike mesh. Decimate the spokes or use alpha-mapped spoke discs, because high-poly spokes multiplied by many instances is costly on 6 GB.

### Gaps
- Blender 5.x compatibility of RideWheelRig and the ToloTolo rig was not verified.
- No CC0 cyclist mocap dataset was found.
- Poly Haven, BlenderKit and Sketchfab CC0/CC-BY bicycles were not surveyed individually.

## Sky, atmosphere, weather (Nishita/multiple-scattering sky, Physical Atmosphere, HDRIs, fog, rain/wet road)

### Takeaway
Blender 5.0's Sky Texture gained a "Multiple Scattering" model, with Nishita kept as "Single Scattering". A release-notes recap says it works in both Cycles and EEVEE, though this was not confirmed on the official EEVEE notes page. That makes it a free physical sky for EEVEE. The paid upgrade is Physical Atmosphere² (successor to Physical Starlight and Atmosphere), which is Blender 5.2+, in beta as of July 2026 and $118 perpetual (70% upgrade discount for existing PSA owners). Poly Haven CC0 HDRIs remain the default for overcast Welsh lighting.

### Cited Findings
- **Blender 5.0 Sky Texture:** "now supports multiple scattering"; the old Nishita model is "still available as 'Single Scattering'"; "Beautiful out of the box, in both Cycles and EEVEE" (secondary recap). The official EEVEE notes excerpt did not mention it — [ubunlog: Blender 5.0](https://en.ubunlog.com/blender-5-0-novedades-renderizado-hdr/); [gigazine: Blender 5.0](https://gigazine.net/gsc_news/en/20251119-blender-5-0); [Blender 5.0 EEVEE release notes](https://developer.blender.org/docs/release_notes/5.0/eevee/)
- **Physical Atmosphere²:** compatible with Blender 5.2+, beta, $118 perpetual, 70% upgrade discount for PSA users (29 July 2026) — [CG Channel 2026](https://www.cgchannel.com/?p=177691)
- **Original Physical Starlight and Atmosphere:** about $70–72. Superhive listings disagree on support (2.81–5.2 versus 2.81–4.5) — [Superhive: PSA](https://superhivemarket.com/products/physical-starlight-and-atmosphere); [Gumroad: PSA](https://martinsh.gumroad.com/l/PSaA)
- **Poly Haven HDRIs:** CC0 like all Poly Haven assets — [Poly Haven licence](https://polyhaven.com/license)

### Inferences
- **Recommended baseline:** the free 5.x Multiple Scattering sky, plus EEVEE volumetric world/box fog for valley mist, plus a Poly Haven overcast HDRI blended for ambient light. Physical Atmosphere² would add aerial perspective and clouds but is beta and paid.
- **Rain/wet road:** a procedural roughness/wetness mask (darken albedo, lower roughness, add puddle normal flattening) on the asphalt material is achievable with built-in nodes. No dedicated CC0 kit was verified.

### Gaps
- EEVEE support for the 5.x Sky Texture was not confirmed on the official release-notes page.
- EEVEE volumetric cloud performance on a 6 GB RTX 2060, and dedicated rain/wet-road shader packs, were not researched.
