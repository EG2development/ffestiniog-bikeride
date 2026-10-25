import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Label } from "../components/Caption";
import { RouteDataProvider, useRouteData } from "../data/RouteDataProvider";
import type { RouteModel } from "../data/route";
import { Scene3DDataProvider, useScene3DData } from "../data/Scene3DDataProvider";
import { cyclistPose } from "../three-core/cyclistMotion";
import { buildPocExtras, buildPocScene, POC } from "../three-core/poc";
import type { Vec3 } from "../three-core/types";
import { BridgeView } from "../three/BridgeView";
import { CameraRig } from "../three/CameraRig";
import { CyclistView } from "../three/CyclistView";
import { Diagnostics } from "../three/Diagnostics";
import { Lighting } from "../three/Lighting";
import { RoadView } from "../three/RoadView";
import { TerrainView } from "../three/TerrainView";
import { TrailView } from "../three/TrailView";
import { TreesView } from "../three/TreesView";

// 12 s proof of concept on the Maentwrog Road section (docs/spec-3d.md, docs/design-3d.md).
// Register ids this scene renders; roads are rendered only from their own register entries.
export const FEATURE_IDS = ["terrain-lidar", "landcover-osm", "trail-proposed", "trees", "cyclist", "bridge-159029124"];

const PROPOSED_LABEL_FRAMES = 90;
// The closing caption is fully visible for the last 5 s (spec H3, t14 validation D1).
const CLOSING_FROM = 195;

/** Unit vector towards the sun: azimuth 200° (SSW), elevation 35° (docs/adr/0018-fixed-lighting.md). */
function sunDirection(route: RouteModel): Vec3 {
  const { lon, lat } = route.routePoints[0];
  const o = route.project(lon, lat);
  const n = route.project(lon, lat + 0.01);
  const e = route.project(lon + 0.01, lat);
  const unit = (x: number, z: number): [number, number] => {
    const l = Math.hypot(x, z) || 1;
    return [x / l, z / l];
  };
  const north = unit(n.x - o.x, n.y - o.y);
  const east = unit(e.x - o.x, e.y - o.y);
  const az = (200 * Math.PI) / 180;
  const el = (35 * Math.PI) / 180;
  const hx = Math.sin(az) * east[0] + Math.cos(az) * north[0];
  const hz = Math.sin(az) * east[1] + Math.cos(az) * north[1];
  return [Math.cos(el) * hx, Math.sin(el), Math.cos(el) * hz];
}

const badgeStyle: React.CSSProperties = {
  position: "absolute",
  right: 32,
  fontFamily: "system-ui, sans-serif",
  fontSize: 15,
  color: "#2c2a26",
  background: "rgba(246,241,228,0.9)",
  padding: "6px 12px",
  borderRadius: 20,
};

const Badge: React.FC = () => (
  <div data-overlay="disclaimer" style={{ ...badgeStyle, top: 28 }}>
    Concept visualisation — not an approved route
  </div>
);

/** Shown for the whole clip whenever heights are exaggerated (spec G3). */
const VeNote: React.FC<{ ve: number }> = ({ ve }) => (
  <div data-overlay="ve-label" style={{ ...badgeStyle, top: 68 }}>
    Heights exaggerated ×{ve}
  </div>
);

/** Wraps an overlay so the render checks can find it in the page; adds no box of its own. */
const Overlay: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <div data-overlay={id} style={{ display: "contents" }}>
    {children}
  </div>
);

/** Logs the overlays actually visible after each commit, for the render checks (H2a, H3, L2, G3). */
const OverlayLog: React.FC = () => {
  const frame = useCurrentFrame();
  useLayoutEffect(() => {
    const opacity = (el: Element | null) => {
      let o = 1;
      for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
      return o;
    };
    // a display: contents wrapper has no box of its own, so judge its content (t14 validation D4)
    const visible = Array.from(document.querySelectorAll("[data-overlay]")).filter((el) => {
      const box = getComputedStyle(el).display === "contents" ? el.firstElementChild : el;
      return box !== null && box.getBoundingClientRect().width > 0 && opacity(box) >= 0.9;
    });
    console.log(`OVERLAYS ${JSON.stringify(visible.map((el) => el.getAttribute("data-overlay")))}`);
  }, [frame]);
  return null;
};

const Attribution: React.FC = () => (
  <div
    data-overlay="attribution"
    style={{
      position: "absolute",
      bottom: 10,
      left: 80,
      fontFamily: "system-ui, sans-serif",
      fontSize: 12,
      color: "rgba(246,241,228,0.9)",
      textShadow: "0 1px 2px rgba(0,0,0,0.6)",
    }}
  >
    Terrain: Welsh Government / NRW lidar DTM (OGL) · Map data © OpenStreetMap contributors (ODbL) · DEM- and
    OSM-derived, not survey-grade
  </div>
);

const PocMaentwrogScene: React.FC<{ diagnostics: boolean }> = ({ diagnostics }) => {
  const frame = useCurrentFrame();
  const route = useRouteData();
  const data = useScene3DData();

  const built = useMemo(() => {
    const inputs = { route, dem: data.dem, land: data.land, profile: data.profile };
    const scene = buildPocScene(inputs);
    const extras = buildPocExtras({ ...inputs, osm: data.osm, features: data.features, bridgeIds: FEATURE_IDS }, scene);
    return { scene, ...extras, sun: sunDirection(route) };
  }, [route, data]);

  const { scene } = built;
  const pose = cyclistPose(scene.trail, scene.table, frame, POC.fps, scene.dims);
  const cam = scene.shot(frame);

  return (
    <AbsoluteFill>
      <ThreeCanvas width={1920} height={1080} shadows gl={{ antialias: true }}>
        <Lighting sunDirection={built.sun} focus={pose.position} />
        <CameraRig pose={cam} near={frame < POC.shotSplitFrame ? 0.5 : 0.05} far={1500} />
        <TerrainView mesh={scene.terrain} />
        <RoadView mesh={built.roads} />
        <TrailView ribbon={scene.trail.ribbon} />
        {built.bridges.map((mesh, i) => (
          <BridgeView key={i} mesh={mesh} />
        ))}
        <TreesView trees={built.trees} />
        <CyclistView pose={pose} dims={scene.dims} />
        {diagnostics ? <Diagnostics ve={POC.ve} /> : null}
      </ThreeCanvas>
      <Badge />
      {POC.ve !== 1 ? <VeNote ve={POC.ve} /> : null}
      <Sequence durationInFrames={150} layout="none">
        <Overlay id="section-title">
          <Label
            text="Maentwrog Road · km 7.7–9.7 of the former Bala and Festiniog Railway (mothballed since 1998)"
            durationInFrames={150}
            position="top-left"
          />
        </Overlay>
      </Sequence>
      <Sequence durationInFrames={PROPOSED_LABEL_FRAMES} layout="none">
        <Overlay id="proposed-label">
          <Label text="Proposed trail (concept): 3 m shared-use path on the old trackbed" durationInFrames={PROPOSED_LABEL_FRAMES} />
        </Overlay>
      </Sequence>
      <Sequence from={CLOSING_FROM} layout="none">
        <Overlay id="closing">
          {/* top-left, clear of the rider; its fade-out falls after the last frame, so it stays fully visible to the end */}
          <Label
            text="Concept only. The line is mothballed and heritage-railway restoration has been proposed; this is not an approved route."
            durationInFrames={POC.frames - CLOSING_FROM + 15}
            position="top-left"
          />
        </Overlay>
      </Sequence>
      <Attribution />
      {diagnostics ? <OverlayLog /> : null}
    </AbsoluteFill>
  );
};

export const Poc3DMaentwrog: React.FC<{ diagnostics?: boolean }> = ({ diagnostics = false }) => (
  <RouteDataProvider>
    <Scene3DDataProvider>
      <PocMaentwrogScene diagnostics={diagnostics} />
    </Scene3DDataProvider>
  </RouteDataProvider>
);

// Loaded by src/Root.tsx's lazyComponent (docs/adr/0024-lazy-3d-compositions.md).
export default Poc3DMaentwrog;
