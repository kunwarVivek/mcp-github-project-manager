#!/usr/bin/env node

/**
 * Render the action-coverage matrix produced by the E2E action sweep.
 *
 * The sweep (`src/__tests__/e2e/tools/action-sweep.e2e.ts`) drives every
 * action of every public tool through the real dispatch path and writes a
 * JSON report. This script turns that report into a table and fails the
 * process when an action is unrouted or crashes on a missing argument - the
 * two states that are always product defects.
 *
 * Usage:
 *   node scripts/e2e-action-coverage.js [path-to-report.json]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_REPORT = path.join(
  process.cwd(),
  "src",
  "__tests__",
  "e2e",
  "action-sweep-report.json"
);

const reportPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_REPORT;

if (!existsSync(reportPath)) {
  console.error(
    `❌ No action report at ${reportPath}\n` +
      "   Run the sweep first: pnpm exec vitest run src/__tests__/e2e/tools/action-sweep.e2e.ts"
  );
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const summary = report.summary ?? [];
const outcomes = report.outcomes ?? [];

const pad = (value, width) => String(value).padEnd(width);

console.log("\n📊 MCP action coverage\n");
console.log(
  `${pad("tool", 24)} ${pad("actions", 8)} ${pad("ok", 6)} ${pad("graceful", 9)} ${pad("unrouted", 9)} ${pad("crash*", 8)} ${pad("timeout", 8)}`
);
console.log("-".repeat(78));

let totalActions = 0;
let totalOk = 0;
let totalGraceful = 0;
let totalUnrouted = 0;
let totalCrash = 0;
let totalTimeout = 0;

for (const row of summary) {
  const crashes = (row.crashBeforeRequest ?? 0) + (row.crashAfterRequest ?? 0);
  console.log(
    `${pad(row.tool, 24)} ${pad(row.actions, 8)} ${pad(row.ok, 6)} ${pad(row.gracefulError, 9)} ${pad(row.unrouted, 9)} ${pad(crashes, 8)} ${pad(row.timeout ?? 0, 8)}`
  );
  totalActions += row.actions;
  totalOk += row.ok;
  totalGraceful += row.gracefulError;
  totalUnrouted += row.unrouted;
  totalCrash += crashes;
  totalTimeout += row.timeout ?? 0;
}

console.log("-".repeat(78));
console.log(
  `${pad("TOTAL", 24)} ${pad(totalActions, 8)} ${pad(totalOk, 6)} ${pad(totalGraceful, 9)} ${pad(totalUnrouted, 9)} ${pad(totalCrash, 8)} ${pad(totalTimeout, 8)}`
);

const unrouted = outcomes.filter((o) => o.status === "unrouted");
const crashBefore = outcomes.filter((o) => o.status === "crash-before-request");
const crashAfter = outcomes.filter((o) => o.status === "crash-after-request");
const timeouts = outcomes.filter((o) => o.status === "timeout");

if (unrouted.length > 0) {
  console.log("\n❌ Actions advertised in the schema with no handler:");
  for (const o of unrouted) console.log(`   ${o.tool}/${o.action}`);
}

if (crashBefore.length > 0) {
  console.log("\n❌ Actions that crash on a missing argument (before any request):");
  for (const o of crashBefore) console.log(`   ${o.tool}/${o.action} - ${o.error}`);
}

if (crashAfter.length > 0) {
  console.log("\n⚠️  Actions that crashed while mapping a stubbed response (may be stub shape):");
  for (const o of crashAfter) console.log(`   ${o.tool}/${o.action} - ${o.error}`);
}

if (timeouts.length > 0) {
  console.log("\n⚠️  Actions that did not answer in time:");
  for (const o of timeouts) console.log(`   ${o.tool}/${o.action}`);
}

const failed = unrouted.length > 0 || crashBefore.length > 0;
console.log(
  failed
    ? "\n❌ Action coverage gate FAILED\n"
    : "\n✅ Action coverage gate passed: every advertised action is routed and fails gracefully\n"
);

process.exit(failed ? 1 : 0);
