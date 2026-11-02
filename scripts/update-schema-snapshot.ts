/**
 * Regenerate the committed compound-tool schema snapshot.
 *
 * Run after intentionally changing a tool's input schema AND bumping its
 * version in src/infrastructure/tools/compound/schema-version.ts.
 *
 * Usage: npm run schema:snapshot
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildSchemaSnapshot } from "../src/infrastructure/tools/compound/schema-snapshot";

const OUTPUT_PATH =
  "./src/__tests__/unit/infrastructure/tools/fixtures/compound-schema-snapshot.json";

const snapshot = buildSchemaSnapshot();
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${Object.keys(snapshot).length} tool schema entries to ${OUTPUT_PATH}`);
