#!/usr/bin/env node

/**
 * Fail when package-lock.json and pnpm-lock.yaml disagree.
 *
 * Both lockfiles are committed on purpose (the repo installs with npm or
 * pnpm). For every direct dependency/devDependency/optionalDependency declared
 * in package.json this checks that:
 *   - the dependency is present in both lockfiles,
 *   - both lockfiles recorded the declared range, and
 *   - both resolved the same version.
 *
 * No network access: both lockfiles are parsed from disk. pnpm-lock.yaml is
 * read with a small line scanner for the `importers: .` block of the project
 * document (a pnpm 12 lockfile may begin with an environment document, so the
 * last `---` document is the project's).
 *
 * Usage: npm run check:lockfiles
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"];

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const npmLock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
const pnpmText = readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");

const unquote = (value) => value.replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1");

/** direct dependencies of the root project from package-lock.json */
function readNpm() {
  const rootEntry = npmLock.packages?.[""] ?? {};
  const result = new Map();
  for (const section of SECTIONS) {
    for (const [name, specifier] of Object.entries(rootEntry[section] ?? {})) {
      const installed = npmLock.packages?.[`node_modules/${name}`];
      result.set(name, { specifier, version: installed?.version });
    }
  }
  return result;
}

/** direct dependencies of the root project from pnpm-lock.yaml */
function readPnpm() {
  const documents = pnpmText.split(/^---\s*$/m);
  const lines = documents[documents.length - 1].split("\n");
  const result = new Map();

  let inImporters = false;
  let inRoot = false;
  let inSection = false;
  let current = null;

  for (const line of lines) {
    if (/^\S/.test(line)) {
      inImporters = line.startsWith("importers:");
      inRoot = false;
      inSection = false;
      continue;
    }
    if (!inImporters) continue;

    const indent = line.length - line.trimStart().length;
    const content = line.trim();
    if (content === "") continue;

    if (indent === 2) {
      inRoot = content === ".:";
      inSection = false;
    } else if (inRoot && indent === 4) {
      inSection = SECTIONS.includes(content.replace(/:$/, ""));
    } else if (inRoot && inSection && indent === 6) {
      current = unquote(content.replace(/:$/, ""));
      result.set(current, {});
    } else if (inRoot && inSection && indent === 8 && current) {
      const [key, ...rest] = content.split(":");
      const value = unquote(rest.join(":").trim());
      if (key === "specifier") result.get(current).specifier = value;
      if (key === "version") result.get(current).version = value.replace(/\(.*$/, "");
    }
  }
  return result;
}

const npm = readNpm();
const pnpm = readPnpm();
const errors = [];

for (const section of SECTIONS) {
  for (const [name, range] of Object.entries(pkg[section] ?? {})) {
    const fromNpm = npm.get(name);
    const fromPnpm = pnpm.get(name);
    if (!fromNpm?.version) errors.push(`${name}: missing from package-lock.json`);
    if (!fromPnpm?.version) errors.push(`${name}: missing from pnpm-lock.yaml`);
    if (!fromNpm?.version || !fromPnpm?.version) continue;

    if (fromNpm.specifier !== range) {
      errors.push(
        `${name}: package-lock.json recorded "${fromNpm.specifier}", package.json has "${range}"`
      );
    }
    if (fromPnpm.specifier !== range) {
      errors.push(
        `${name}: pnpm-lock.yaml recorded "${fromPnpm.specifier}", package.json has "${range}"`
      );
    }
    if (fromNpm.version !== fromPnpm.version) {
      errors.push(
        `${name}: package-lock.json resolves ${fromNpm.version}, pnpm-lock.yaml resolves ${fromPnpm.version}`
      );
    }
  }
}

for (const name of pnpm.keys()) {
  const declared = SECTIONS.some((section) => pkg[section]?.[name] !== undefined);
  if (!declared) errors.push(`${name}: in pnpm-lock.yaml but not declared in package.json`);
}

if (errors.length > 0) {
  console.error("package-lock.json and pnpm-lock.yaml are out of sync:");
  for (const error of errors) console.error(`  - ${error}`);
  console.error("Re-run `npm install` and `pnpm install` after changing dependencies.");
  process.exit(1);
}
console.log(`Lockfiles agree on ${npm.size} direct dependencies.`);
