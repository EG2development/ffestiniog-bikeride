// Iteration 2: measurement masks (docs/adr/0044-mask-renders-for-measurement.md); buildings (docs/adr/0050-merged-buildings-and-procedural-landmarks.md).
// Photoreal layer: the `look` prop (docs/adr/0054-photoreal-layer.md), the rider's view (ADR 56) and the post pass (ADR 55).
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { MapDrapeProvider, useMapDrape } from "../data/MapDrapeProvider";
import { LEGEND, PHOTO_CAPTIONS, PHOTO_LEGEND, photoEarthworksLine, POC_CAPTIONS, reelCaptions, sectionLegend, type Caption } from "../data/reel-captions";
import { REEL_SCENES } from "../data/reel-timeline";
import { RouteDataProvider, useRouteData } from "../data/RouteDataProvider";
import { Scene3DDataProvider, useScene3DData } from "../data/Scene3DDataProvider";
import { ATMOSPHERE, SHADOW_PHOTO_AERIAL, SHADOW_PHOTO_CLOSE, sunDirection } from "../three-core/atmosphere";
import { cyclistPose } from "../three-core/cyclistMotion";
import { buildSectionScene, configById, earthworksInRange, followStartFrame, POC, shotSpecAt, type Look, type SectionConfig } from "../three-core/sections";
import { BridgeView } from "../three/BridgeView";
import { BuildingsView } from "../three/BuildingsView";
import { CameraRig } from "../three/CameraRig";
import { CyclistView } from "../three/CyclistView";
import { Diagnostics } from "../three/Diagnostics";
import { Lighting, REEL_SHADOW } from "../three/Lighting";
import { MapDrapeView, type MapDrape } from "../three/MapDrapeView";
import { CaptionOverlays, Legend, OverlayLog } from "../three/Overlays";
import { PhotoAssetsProvider, usePhotoAssets, type PhotoAssets } from "../data/PhotoAssetsProvider";
import { BarriersView } from "../three/photo/BarriersView";
import { BridgePhotoView } from "../three/photo/BridgePhotoView";
import { GrassView } from "../three/photo/GrassView";
import { PhotoSky } from "../three/photo/PhotoSky";
import { PostFX } from "../three/photo/PostFX";
import { TerrainPhotoView } from "../three/photo/TerrainPhotoView";
import { TrailPhotoView } from "../three/photo/TrailPhotoView";
import { TreesPhotoView } from "../three/photo/TreesPhotoView";
import { TRAIL_WIDTH_M } from "../three-core/trail";
import { treesInShots } from "../three-core/trees";
import { RoadView } from "../three/RoadView";
import { SkyDome } from "../three/SkyDome";
import { TerrainView } from "../three/TerrainView";
import { TrailView } from "../three/TrailView";
import { TreesView } from "../three/TreesView";
import { WalkersView } from "../three/WalkersView";
import { WaterView } from "../three/WaterView";
import type { Mask } from "../three/mask";

// One section of the reel, built from its config by the shared assembly (docs/adr/0027-section-config.md).
// Register ids every section may draw; roads, water, boundaries and section structures come from their own register
// entries, and the photo look's canopy trees, grass and walkers from the window's (ADR 60).
export const FEATURE_IDS = ["terrain-lidar", "landcover-osm", "trail-proposed", "trees", "cyclist", "bridge-159029124", "trees-canopy-blaenau", "grass-blaenau", "walkers-blaenau", "trees-canopy-vale-north", "grass-vale-north", "walkers-vale-north", "trees-canopy-vale-south", "grass-vale-south", "walkers-vale-south", "trees-canopy-maentwrog", "grass-maentwrog", "walkers-maentwrog", "trees-canopy-trawsfynydd", "grass-trawsfynydd", "walkers-trawsfynydd", "trees-canopy-corridor", "imagery-corridor"];

/** `concept` is the reel's first look; `photo` adds the photoreal layer's views, extras and post pass (ADRs 54, 60). */
export type { Look };
// `mask` and `hide` are for the render checks only (docs/adr/0044-mask-renders-for-measurement.md): never set by Reel3D or Root
// `legend: false` leaves the legend out too, for the caption-free frames the water checks measure (spec WA7)
type Props = { section: string; diagnostics?: boolean; captions?: "none" | "base" | "section" | "poc" | "photo"; look?: Look; mask?: Mask; hide?: "water"; legend?: boolean };

/** The section's or prototype's config, or a named error at the boundary (review R8). */
function configOf(section: string): SectionConfig {
  try {
    return configById(section);
  } catch (e) {
    throw new Error(`unknown section "${section}": ${(e as Error).message}`);
  }
}

/** On its own, a section shows the badge and credits plus its own captions (`captionIds`), shifted from reel frames to its frames. */
function sectionCaptions(cfg: SectionConfig, look: Look): Caption[] {
  const CAPTIONS = reelCaptions(look);
  const base = CAPTIONS.filter((c) => c.id === "disclaimer" || c.id === "attribution");
  const scene = REEL_SCENES.find((s) => s.config === cfg.id);
  if (!scene) return base;
  const own = CAPTIONS.filter((c) => cfg.captionIds.includes(c.id)).map((c) => ({ ...c, from: Math.max(0, c.from - scene.from), to: Math.min(cfg.frames, c.to - scene.from) })).filter((c) => c.to > c.from);
  return [...base, ...own];
}

/** The photo look's ground from the air: tiles four times the size, so they don't repeat as a grid, varying the
 * photograph's brightness more strongly than on the ground and fading to it over 1.5 km (the camera is 150–600 m up). */
const AERIAL_TERRAIN = { detailFadeM: 1500, tileScale: 4, detailStrength: 0.75 };

const Scene: React.FC<Props & { drape: MapDrape | null; photoAssets: PhotoAssets | null }> = ({ section, diagnostics = false, captions = "none", look = "concept", mask, hide, legend = true, drape, photoAssets }) => {
  const frame = useCurrentFrame();
  const route = useRouteData();
  const data = useScene3DData();
  const cfg = configOf(section);
  const atmosphere = ATMOSPHERE[cfg.kind];
  // the photo look needs its textures; under a measurement mask the concept views draw the classes in flat colours
  const photo = look === "photo" && photoAssets !== null && !mask;
  const built = useMemo(() => {
    const scene = buildSectionScene(cfg, { route, dem: data.dem, land: data.land, profile: data.profile, osm: data.osm, features: data.features, waterLevels: data.waterLevels, buildings: data.buildings, canopy: data.canopy, barriers: data.barriers, imagery: data.imagery }, look);
    return { scene, sun: sunDirection(route, atmosphere) };
  }, [cfg, route, data, atmosphere, look]);
  const { scene } = built;
  // the photo look draws only the trees some frame sees or some frame's shadow map reaches (ADR 60): the map spans its
  // range around the focus across the light, and a caster up to the window's relief (plus the tallest canopy) above or
  // below the focus lands in it within (half range + relief) / sin(sun elevation) in plan
  const drawTrees = useMemo(() => {
    if (!photo) return null;
    const poses = Array.from({ length: cfg.frames }, (_, f) => scene.shot(f));
    const focus = poses.map((p, f) => (cfg.kind === "ground" ? scene.riderAt(f) : p.target));
    const rangeM = cfg.kind === "ground" ? Math.max(REEL_SHADOW.rangeM, SHADOW_PHOTO_CLOSE.rangeM) : SHADOW_PHOTO_AERIAL.rangeM;
    let [lo, hi] = [Infinity, -Infinity];
    for (const h of data.dem.heights) if (h !== data.dem.nodata) [lo, hi] = [Math.min(lo, h), Math.max(hi, h)];
    const reliefM = hi - lo + 45; // 45 m: the canopy grid's ceiling
    const shadowReach = (rangeM / 2 + reliefM) / Math.sin((atmosphere.sunElevationDeg * Math.PI) / 180) / 10;
    return treesInShots(scene.trees, poses, focus, { shadowReach });
  }, [photo, cfg, scene, data.dem, atmosphere]);
  const pose = cyclistPose(scene.trail, scene.table, frame, POC.fps, scene.dims);
  const cam = scene.shot(frame);
  const focus = cfg.kind === "ground" ? pose.position : cam.target;
  // in the rider's own view the camera is the rider: the model is not drawn and the near plane moves right in (ADR 56)
  const spec = shotSpecAt(cfg, frame);
  const firstPerson = spec.kind === "first-person";
  // a drone shot of the photo look names the registered earthworks between its track and the rider (G8)
  const earthworks = photo && spec.kind === "drone-side" ? earthworksInRange(data.features, [Math.min(spec.fromDistM, spec.toDistM, cfg.startDistM), Math.max(spec.fromDistM, spec.toDistM, scene.distAt(frame))]) : null;
  const list = captions === "photo" ? PHOTO_CAPTIONS : captions === "poc" ? POC_CAPTIONS : captions === "section" ? sectionCaptions(cfg, look) : captions === "base" ? reelCaptions(look).filter((c) => c.id === "disclaimer" || c.id === "attribution") : [];
  // the near plane moves in once the camera does: the section's own follow-shot start, not the POC's (review R3)
  const near = cfg.kind === "aerial" ? 2 : firstPerson ? 0.02 : frame < followStartFrame(cfg) ? 0.5 : 0.05;
  // in the photo look's close shots the shadow map tightens around the rider, so shadows start at feet and wheels (RL12);
  // its aerial scenes widen it, as their trees stand across the whole view (ADR 60)
  const close = photo && cfg.kind === "ground" && (firstPerson || frame >= followStartFrame(cfg));
  const shadow = close ? SHADOW_PHOTO_CLOSE : photo && cfg.kind === "aerial" ? SHADOW_PHOTO_AERIAL : undefined;

  return (
    <AbsoluteFill>
      <ThreeCanvas width={1920} height={1080} shadows={{ type: 1 }} gl={{ antialias: true }}>
        {photo ? <PhotoSky atmosphere={atmosphere} centre={cam.position} sunDirection={built.sun} image={photoAssets!.sky} /> : <SkyDome atmosphere={atmosphere} centre={cam.position} sunDirection={built.sun} mask={mask} />}
        <Lighting sunDirection={built.sun} focus={focus} kind={cfg.kind} variant={photo ? "photo" : "concept"} shadow={shadow} mask={mask} />
        <CameraRig pose={cam} near={near} far={2600} />
        {drape ? <MapDrapeView mesh={scene.terrain} drape={drape} unproject={route.unproject} mask={mask} /> : photo ? <TerrainPhotoView mesh={scene.terrain} land={data.land} textures={photoAssets!.textures} image={scene.groundImage} {...(cfg.kind === "aerial" && AERIAL_TERRAIN)} /> : <TerrainView mesh={scene.terrain} mask={mask} />}
        <RoadView mesh={scene.roads} mask={mask} tarmac={photo ? photoAssets!.textures.tarmac : undefined} />
        {photo ? <TrailPhotoView ribbon={scene.trail.ribbon} gravel={photoAssets!.textures.gravel} widthM={TRAIL_WIDTH_M} /> : <TrailView ribbon={scene.trail.ribbon} mask={mask} />}
        {/* the railway's bridges, then the walls and decks under roads that stand clear of the ground */}
        {[...scene.bridges, ...(scene.roadStructures.indices.length > 0 ? [scene.roadStructures] : [])].map((mesh, i) => (photo ? <BridgePhotoView key={i} mesh={mesh} stone={photoAssets!.textures.stone} /> : <BridgeView key={i} mesh={mesh} mask={mask} />))}
        {hide === "water" ? null : <WaterView bodies={scene.water} frame={frame} mask={mask} photo={photo} />}
        <BuildingsView groups={scene.buildings.groups} landmarkGroups={scene.buildings.landmarkGroups} mask={mask} stone={photo ? photoAssets!.textures.stone : undefined} />
        {look === "photo" ? <BarriersView meshes={scene.barriers} mask={mask} textures={photoAssets ? { wall: photoAssets.textures.stone, hedge: photoAssets.textures.hedge, fence: photoAssets.textures.bark } : undefined} /> : null}
        {look === "photo" ? <GrassView clumps={scene.grass} mask={mask} /> : null}
        {photo ? <TreesPhotoView trees={drawTrees!.casting} shadowless={drawTrees!.shadowless} trunks={cfg.kind === "ground"} /> : <TreesView trees={scene.trees} mask={mask} />}
        {cfg.kind === "ground" && !firstPerson ? <CyclistView pose={pose} dims={scene.dims} mask={mask} /> : null}
        <WalkersView tracks={scene.walkers} frame={frame} mask={mask} />
        {photo ? <PostFX width={1920} height={1080} ve={cfg.ve} diagnostics={diagnostics} /> : null}
        {diagnostics && !photo ? <Diagnostics ve={cfg.ve} /> : null}
      </ThreeCanvas>
      {mask ? null : <CaptionOverlays captions={list} total={cfg.frames} ve={cfg.ve} />}
      {mask || !legend ? null : (
        <Legend
          lines={
            photo
              ? [
                  ...(cfg.kind === "ground" && scene.bridges.length > 0 ? [PHOTO_LEGEND.bridge] : []),
                  ...(earthworks ? [photoEarthworksLine(earthworks[0], earthworks[1])] : []),
                  ...(cfg.kind === "ground" ? [PHOTO_LEGEND.ground] : []),
                  ...(scene.buildings.groups.some((g) => g.kind === "translucent") ? [LEGEND.translucent] : []),
                ]
              : sectionLegend(cfg.kind, scene.bridges.length, scene.buildings.groups.some((g) => g.kind === "translucent"))
          }
        />
      )}
      {diagnostics ? <OverlayLog /> : null}
    </AbsoluteFill>
  );
};

const WithDrape: React.FC<Props> = (props) => {
  const drape = useMapDrape();
  return <Scene {...props} drape={drape} photoAssets={null} />;
};

const WithPhotoAssets: React.FC<Props> = (props) => {
  const assets = usePhotoAssets();
  return <Scene {...props} drape={null} photoAssets={assets} />;
};

const Loaded: React.FC<Props> = (props) => {
  const data = useScene3DData();
  const cfg = configOf(props.section);
  // the photo look draws every scene, aerials too, from its textures; the concept look drapes the aerials with map tiles (ADR 60)
  if (props.look === "photo") {
    return (
      <PhotoAssetsProvider section={cfg.id}>
        <WithPhotoAssets {...props} />
      </PhotoAssetsProvider>
    );
  }
  if (cfg.kind !== "aerial") return <Scene {...props} drape={null} photoAssets={null} />;
  const fill = `rgb(${ATMOSPHERE.aerial.horizon.map((c) => Math.round(c * 255)).join(",")})`;
  return (
    <MapDrapeProvider section={cfg.window} label={cfg.id} dem={data.dem} zoom={15} fill={fill}>
      <WithDrape {...props} />
    </MapDrapeProvider>
  );
};

export const Section3D: React.FC<Props> = (props) => {
  const cfg = configOf(props.section);
  return (
    <RouteDataProvider>
      <Scene3DDataProvider section={cfg.window} label={cfg.id} wants={cfg.photo && props.look === "photo" ? { canopy: cfg.photo.canopyTrees, barriers: cfg.photo.barriers, imagery: cfg.photo.imagery } : undefined}>
        <Loaded {...props} />
      </Scene3DDataProvider>
    </RouteDataProvider>
  );
};

export default Section3D;
