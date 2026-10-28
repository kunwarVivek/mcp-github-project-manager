import { readFileSync } from "node:fs";

/**
 * The version of this package, read from the package's own package.json.
 *
 * Resolved relative to this module (src/version.ts under tsx, build/version.js
 * when installed), never relative to the working directory: an `npx` user runs
 * the server from their own project, whose package.json is not ours. Both
 * `--version` and the MCP `serverInfo.version` come from here, so they always
 * match the version published to npm and tagged on GitHub.
 */
function readPackageVersion(): string {
  const manifestUrl = new URL("../package.json", import.meta.url);
  const manifest: unknown = JSON.parse(readFileSync(manifestUrl, "utf8"));
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    !("version" in manifest) ||
    typeof manifest.version !== "string"
  ) {
    throw new Error(`${manifestUrl.pathname} has no string "version" field`);
  }
  return manifest.version;
}

export const PACKAGE_VERSION: string = readPackageVersion();
