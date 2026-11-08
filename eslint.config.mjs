import { config } from "@remotion/eslint-config-flat";

// Remotion's rules for everything, plus Node's globals for the build scripts (plain ES modules that tsc does not see).
const NODE_GLOBALS = { process: "readonly", console: "readonly", Buffer: "readonly", URL: "readonly", fetch: "readonly", crypto: "readonly", performance: "readonly" };

export default [...config, { files: ["scripts/**/*.mjs"], languageOptions: { globals: NODE_GLOBALS } }];
