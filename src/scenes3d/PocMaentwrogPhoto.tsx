// Photoreal proof of concept (docs/adr/0054-photoreal-layer.md): the Maentwrog window through the shared assembly with
// the photo look, three shots (aerial, rider's view, follow) over 20 s, outside the reel.
import React from "react";
import { Section3D } from "./Section3D";

// Register ids this scene renders; roads, barriers and buildings are rendered only from their own register entries.
export const FEATURE_IDS = ["terrain-lidar", "landcover-osm", "trail-proposed", "trees-canopy-maentwrog", "grass-maentwrog", "cyclist", "walkers-maentwrog", "bridge-159029124"];

export const Poc3DMaentwrogPhoto: React.FC<{ diagnostics?: boolean }> = ({ diagnostics = false }) => <Section3D section="maentwrog-photo" diagnostics={diagnostics} captions="photo" look="photo" />;

export default Poc3DMaentwrogPhoto;
