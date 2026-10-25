/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// No GL renderer here: a global --gl=angle changes the 2D video's pixels, so 3D
// renders pass it per command (docs/adr/0019-gl-angle-per-render.md, docs/sop-3d.md).
