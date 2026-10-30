// Iteration 2: measurement masks (docs/adr/0044-mask-renders-for-measurement.md); buildings (docs/adr/0050-merged-buildings-and-procedural-landmarks.md).
// Photoreal layer: the `look` prop (docs/adr/0054-photoreal-layer.md), the rider's view (ADR 56) and the post pass (ADR 55).
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { MapDrapeProvider, useMapDrape } from "../data/MapDrapeProvider";
import { CAPTIONS, LEGEND, PHOTO_CAPTIONS, PHOTO_LEGEND, photoEarthworksLine, POC_CAPTIONS, sectionLegend, type Caption } from "../data/reel-captions";
import { REEL_SCENES } from "../data/reel-timeline";
import { RouteDataProvider, useRouteData } from "../data/RouteDataProvider";
import { Scene3DDataProvider, useScene3DData } from "../data/Scene3DDataProvider";
import { ATMOSPHERE, SHADOW_PHOTO_CLOSE, sunDirection } from "../three-core/atmosphere";
import { cyclistPose } from "../three-core/cyclistMotion";
import { buildSectionScene, configById, earthworksInRange, followStartFrame, POC, shotSpecAt, type SectionConfig } from "../three-core/sections";
import { BridgeView } from "../three/BridgeView";
import { BuildingsView } from "../three/BuildingsView";
import { CameraRig } from "../three/CameraRig";
import { CyclistView } from "../three/CyclistView";
import { Diagnostics } from "../three/Diagnostics";
import { Lighting } from "../three/Lighting";
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
import { RoadView } from "../three/RoadView";
import { SkyDome } from "../three/SkyDome";
import { TerrainView } from "../three/TerrainView";
import { TrailView } from "../three/TrailView";
import { TreesView } from "../three/TreesView";
import { WalkersView } from "../three/WalkersView";
import { WaterView } from "../three/WaterView";
import type { Mask } from "../three/mask";

// One section of the reel, built from its config by the shared assembly (docs/adr/0027-section-config.md).
// Register ids every section may draw; roads, water and section structures come from their own register entries.
export const FEATURE_IDS = ["terrain-lidar", "landcover-osm", "trail-proposed", "trees", "cyclist", "bridge-159029124"];

/** `concept` is the reel's look; `photo` adds the photoreal layer's views and post pass (ADR 54). */
export type Look = "concept" | "photo";
// `mask` and `hide` are for the render checks only (docs/adr/0044-mask-renders-for-measurement.md): never set by Reel3D or Root
type Props = { section: string; diagnostics?: boolean; captions?: "none" | "base" | "section" | "poc" | "photo"; look?: Look; mask?: Mask; hide?: "water" };

/** The section's or prototype's config, or a named error at the boundary (review R8). */
function configOf(section: string): SectionConfig {
  try {
    return configById(section);
  } catch (e) {
    throw new Error(`unknown section "${section}": ${(e as Error).message}`);
  }
}

/** On its own, a section shows the badge and credits plus its own captions (`captionIds`), shifted from reel frames to its frames. */
function sectionCaptions(cfg: SectionConfig): Caption[] {
  const base = CAPTIONS.filter((c) => c.id === "disclaimer" || c.id === "attribution");
  const scene = REEL_SCENES.find((s) => s.config === cfg.id);
  if (!scene) return base;
  const own = CAPTIONS.filter((c) => cfg.captionIds.includes(c.id)).map((c) => ({ ...c, from: Math.max(0, c.from - scene.from), to: Math.min(cfg.frames, c.to - scene.from) })).filter((c) => c.to > c.from);
  return [...base, ...own];
}

const Scene: React.FC<Props & { drape: MapDrape | null; photoAssets: PhotoAssets | null }> = ({ section, diagnostics = false, captions = "none", look = "concept", mask, hide, drape, photoAssets }) => {
  const frame = useCurrentFrame();
  const route = useRouteData();
  const data = useScene3DData();
  const cfg = configOf(section);
  const atmosphere = ATMOSPHERE[cfg.kind];
  // the photo look needs its textures; under a measurement mask the concept views draw the classes in flat colours
  const photo = look === "photo" && photoAssets !== null && !mask;
  const built = useMemo(() => {
    const scene = buildSectionScene(cfg, { route, dem: data.dem, land: data.land, profile: data.profile, osm: data.osm, features: data.features, waterLevels: data.waterLevels, buildings: data.buildings, canopy: data.canopy, barriers: data.barriers });
    return { scene, sun: sunDirection(route, atmosphere) };
  }, [cfg, route, data, atmosphere]);
  const { scene } = built;
  const pose = cyclistPose(scene.trail, scene.table, frame, POC.fps, scene.dims);
  const cam = scene.shot(frame);
  const focus = cfg.kind === "ground" ? pose.position : cam.target;
  // in the rider's own view the camera is the rider: the model is not drawn and the near plane moves right in (ADR 56)
  const spec = shotSpecAt(cfg, frame);
  const firstPerson = spec.kind === "first-person";
  // a drone shot of the photo look names the registered earthworks between its track and the rider (G8)
  const earthworks = photo && spec.kind === "drone-side" ? earthworksInRange(data.features, [Math.min(spec.fromDistM, spec.toDistM, cfg.startDistM), Math.max(spec.fromDistM, spec.toDistM, scene.distAt(frame))]) : null;
  const list = captions === "photo" ? PHOTO_CAPTIONS : captions === "poc" ? POC_CAPTIONS : captions === "section" ? sectionCaptions(cfg) : captions === "base" ? CAPTIONS.filter((c) => c.id === "disclaimer" || c.id === "attribution") : [];
  // the near plane moves in once the camera does: the section's own follow-shot start, not the POC's (review R3)
  const near = cfg.kind === "aerial" ? 2 : firstPerson ? 0.02 : frame < followStartFrame(cfg) ? 0.5 : 0.05;
  // in the photo look's close shots the shadow map tightens around the rider, so shadows start at feet and wheels (RL12)
  const close = photo && cfg.kind === "ground" && (firstPerson || frame >= followStartFrame(cfg));
  const shadow = close ? SHADOW_PHOTO_CLOSE : undefined;

  return (
    <AbsoluteFill>
      <ThreeCanvas width={1920} height={1080} shadows={{ type: 1 }} gl={{ antialias: true }}>
        {photo ? <PhotoSky atmosphere={atmosphere} centre={cam.position} sunDirection={built.sun} image={photoAssets!.sky} /> : <SkyDome atmosphere={atmosphere} centre={cam.position} sunDirection={built.sun} mask={mask} />}
        <Lighting sunDirection={built.sun} focus={focus} kind={cfg.kind} variant={photo ? "photo" : "concept"} shadow={shadow} mask={mask} />
        <CameraRig pose={cam} near={near} far={2600} />
        {drape ? <MapDrapeView mesh={scene.terrain} drape={drape} unproject={route.unproject} mask={mask} /> : photo ? <TerrainPhotoView mesh={scene.terrain} land={data.land} textures={photoAssets!.textures} /> : <TerrainView mesh={scene.terrain} mask={mask} />}
        <RoadView mesh={scene.roads} mask={mask} />
        {photo ? <TrailPhotoView ribbon={scene.trail.ribbon} gravel={photoAssets!.textures.gravel} widthM={TRAIL_WIDTH_M} /> : <TrailView ribbon={scene.trail.ribbon} mask={mask} />}
        {scene.bridges.map((mesh, i) => (photo ? <BridgePhotoView key={i} mesh={mesh} stone={photoAssets!.textures.stone} /> : <BridgeView key={i} mesh={mesh} mask={mask} />))}
        {hide === "water" ? null : <WaterView bodies={scene.water} frame={frame} mask={mask} />}
        <BuildingsView groups={scene.buildings.groups} landmarkGroups={scene.buildings.landmarkGroups} mask={mask} />
        {look === "photo" ? <BarriersView meshes={scene.barriers} mask={mask} textures={photoAssets ? { wall: photoAssets.textures.stone, hedge: photoAssets.textures.hedge, fence: photoAssets.textures.bark } : undefined} /> : null}
        {look === "photo" ? <GrassView clumps={scene.grass} mask={mask} /> : null}
        {photo ? <TreesPhotoView trees={scene.trees} /> : <TreesView trees={scene.trees} mask={mask} />}
        {cfg.kind === "ground" && !firstPerson ? <CyclistView pose={pose} dims={scene.dims} mask={mask} /> : null}
        <WalkersView tracks={scene.walkers} frame={frame} mask={mask} />
        {photo ? <PostFX width={1920} height={1080} ve={cfg.ve} diagnostics={diagnostics} /> : null}
        {diagnostics && !photo ? <Diagnostics ve={cfg.ve} /> : null}
      </ThreeCanvas>
      {mask ? null : <CaptionOverlays captions={list} total={cfg.frames} ve={cfg.ve} />}
      {mask ? null : (
        <Legend
          lines={
            photo
              ? [
                  ...(scene.bridges.length > 0 ? [PHOTO_LEGEND.bridge] : []),
                  ...(earthworks ? [photoEarthworksLine(earthworks[0], earthworks[1])] : []),
                  ...(cfg.kind === "ground" ? [PHOTO_LEGEND.people, PHOTO_LEGEND.corridor] : []),
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
  if (cfg.kind !== "aerial") {
    if (props.look === "photo") {
      return (
        <PhotoAssetsProvider section={cfg.id}>
          <WithPhotoAssets {...props} />
        </PhotoAssetsProvider>
      );
    }
    return <Scene {...props} drape={null} photoAssets={null} />;
  }
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
      <Scene3DDataProvider section={cfg.window} label={cfg.id} wants={cfg.photo ? { canopy: cfg.photo.canopyTrees, barriers: cfg.photo.barriers } : undefined}>
        <Loaded {...props} />
      </Scene3DDataProvider>
    </RouteDataProvider>
  );
};

export default Section3D;
