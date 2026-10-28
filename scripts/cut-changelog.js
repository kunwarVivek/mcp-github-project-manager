#!/usr/bin/env node
/**
 * Move the body of `## [Unreleased]` in CHANGELOG.md into a new
 * `## [<version>] - <date>` section and reset [Unreleased] to the placeholder.
 *
 * The Release workflow publishes the version section verbatim as the GitHub
 * release notes and refuses to publish without it, so this is the one place
 * that creates it — used by `npm run release` and by bump-version.yml.
 *
 *   node scripts/cut-changelog.js <version> [YYYY-MM-DD]
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const UNRELEASED_PLACEHOLDER = "No unreleased changes.";
const UNRELEASED = /^## \[Unreleased\]\n\n([\s\S]*?)(?=^## \[)/m;

/** The [Unreleased] body, or "" when it is empty or only the placeholder. */
export function unreleasedBody(changelog) {
  const match = changelog.match(UNRELEASED);
  if (!match) throw new Error("CHANGELOG.md has no '## [Unreleased]' section");
  const body = match[1].trim();
  return body === UNRELEASED_PLACEHOLDER ? "" : body;
}

export function cutChangelog(changelog, version, date) {
  if (changelog.includes(`## [${version}]`)) {
    throw new Error(`CHANGELOG.md already has a '## [${version}]' section`);
  }
  const body = unreleasedBody(changelog);
  if (body === "") {
    throw new Error("CHANGELOG.md [Unreleased] is empty: nothing to release");
  }
  return changelog.replace(
    UNRELEASED,
    `## [Unreleased]\n\n${UNRELEASED_PLACEHOLDER}\n\n## [${version}] - ${date}\n\n${body}\n\n`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, date = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
  if (!version) {
    process.stderr.write("usage: node scripts/cut-changelog.js <version> [YYYY-MM-DD]\n");
    process.exit(2);
  }
  try {
    const file = "CHANGELOG.md";
    fs.writeFileSync(file, cutChangelog(fs.readFileSync(file, "utf8"), version, date));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
