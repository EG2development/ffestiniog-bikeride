#!/usr/bin/env node
// Copies data/*.json and data/*.geojson into public/data/, where the running video reads
// them (docs/adr/0021-data-sync.md). data/ is the source of truth.
import { copyFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const names = readdirSync(join(root, "data")).filter((n) => /\.(json|geojson)$/.test(n));
for (const name of names) copyFileSync(join(root, "data", name), join(root, "public/data", name));
console.log(`synced ${names.length} files to public/data: ${names.join(", ")}`);
