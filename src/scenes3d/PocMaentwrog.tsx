// Reel: master composition (docs/adr/0028-reel-master-composition.md), captions as data (0036-captions-as-data.md), labels from curated files (0038-labels-from-curated-files.md), migration (0040-migrate-maentwrog-first.md).
import React from "react";
import { Section3D } from "./Section3D";

// The 12 s proof of concept on the Maentwrog Road section (docs/spec-3d.md, docs/design-3d.md): the
// `maentwrog` section through the shared assembly, with its own caption set (src/data/reel-captions.ts).
// Register ids this scene renders; roads are rendered only from their own register entries.
export const FEATURE_IDS = ["terrain-lidar", "landcover-osm", "trail-proposed", "trees", "cyclist", "bridge-159029124"];

export const Poc3DMaentwrog: React.FC<{ diagnostics?: boolean }> = ({ diagnostics = false }) => <Section3D section="maentwrog" diagnostics={diagnostics} captions="poc" />;

export default Poc3DMaentwrog;
