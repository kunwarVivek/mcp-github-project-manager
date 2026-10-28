#!/usr/bin/env node
/**
 * Release one version to npm AND GitHub, and return only when both are live.
 *
 *   npm run release                 # asks for patch / minor / major / X.Y.Z
 *   npm run release -- minor        # non-interactive bump type
 *   npm run release -- 3.1.0 --yes  # explicit version, no confirmation
 *
 * This script never runs `npm publish` itself. It prepares and pushes the
 * release commit and tag; the tag starts .github/workflows/release.yml, the
 * only publisher, which publishes to npm through Trusted Publishing (OIDC, with
 * provenance) and creates the GitHub release in the same run. The script then
 * waits for that run and verifies both results, so "done" means both exist.
 *
 * Not named `publish` on purpose: `publish` is an npm lifecycle hook that
 * `npm publish` runs automatically, so it would re-run inside the workflow.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline/promises";
import { cutChangelog, unreleasedBody } from "./cut-changelog.js";

const PACKAGE = "mcp-github-project-manager";
const REPO = "kunwarVivek/mcp-github-project-manager";
const RELEASE_BRANCH = "main";
const BUMPS = ["patch", "minor", "major"];
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const NPM_VISIBLE_TIMEOUT_MS = 10 * 60_000;

class ReleaseError extends Error {}

/** Run a command, inheriting the terminal; throws on a non-zero exit. */
function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new ReleaseError(`\`${cmd} ${args.join(" ")}\` failed (exit ${result.status})`);
  }
}

/** Run a command and return its trimmed stdout; throws on a non-zero exit. */
function capture(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new ReleaseError(`\`${cmd} ${args.join(" ")}\` failed: ${detail}`);
  }
  return result.stdout.trim();
}

/** Like capture, but a non-zero exit is an answer (null), not an error. */
function probe(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const step = (message) => console.log(`\n▶ ${message}`);

function nextVersion(current, bump) {
  if (SEMVER.test(bump)) return bump;
  const [major, minor, patch] = current.split("-")[0].split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function preflight() {
  step("Checking the repository and the registry");
  if (capture("git", ["status", "--porcelain"]) !== "") {
    throw new ReleaseError("the working tree is not clean; commit or stash first");
  }
  const branch = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== RELEASE_BRANCH) {
    throw new ReleaseError(`releases are cut from '${RELEASE_BRANCH}', not '${branch}'`);
  }
  run("git", ["fetch", "--quiet", "--tags", "origin", RELEASE_BRANCH]);
  const local = capture("git", ["rev-parse", "HEAD"]);
  const remote = capture("git", ["rev-parse", `origin/${RELEASE_BRANCH}`]);
  if (local !== remote) {
    throw new ReleaseError(`HEAD is not origin/${RELEASE_BRANCH}; pull or push first`);
  }
  capture("gh", ["auth", "status"]);
  if (unreleasedBody(fs.readFileSync("CHANGELOG.md", "utf8")) === "") {
    throw new ReleaseError("CHANGELOG.md [Unreleased] is empty: write the release notes first");
  }
}

function checkVersionIsFree(version) {
  if (probe("git", ["rev-parse", "--verify", "--quiet", `refs/tags/v${version}`]) !== null) {
    throw new ReleaseError(`tag v${version} already exists`);
  }
  if (probe("npm", ["view", `${PACKAGE}@${version}`, "version"])) {
    throw new ReleaseError(`${PACKAGE}@${version} is already on npm`);
  }
}

async function chooseVersion(current, args) {
  let bump = args.find((arg) => !arg.startsWith("-"));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!bump) {
      bump = (await rl.question(`Current ${current}. Bump (patch/minor/major or X.Y.Z): `)).trim();
    }
    if (!BUMPS.includes(bump) && !SEMVER.test(bump)) {
      throw new ReleaseError(`'${bump}' is not patch, minor, major or a semver version`);
    }
    const version = nextVersion(current, bump);
    checkVersionIsFree(version);
    if (!args.includes("--yes")) {
      const answer = await rl.question(`Release v${version} to npm and GitHub? (y/N): `);
      if (answer.trim().toLowerCase() !== "y") throw new ReleaseError("cancelled");
    }
    return version;
  } finally {
    rl.close();
  }
}

/** The Release workflow run started by pushing the tag. */
async function findReleaseRun(tag) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const id = probe("gh", [
      "run",
      "list",
      "--repo",
      REPO,
      "--workflow",
      "release.yml",
      "--branch",
      tag,
      "--limit",
      "1",
      "--json",
      "databaseId",
      "--jq",
      ".[0].databaseId // empty",
    ]);
    if (id) return id;
    await sleep(5_000);
  }
  throw new ReleaseError(`no Release workflow run appeared for ${tag}`);
}

async function waitForNpm(version) {
  const deadline = Date.now() + NPM_VISIBLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (probe("npm", ["view", `${PACKAGE}@${version}`, "version"]) === version) return;
    await sleep(15_000);
  }
  throw new ReleaseError(
    `${PACKAGE}@${version} was published but is not installable after ` +
      `${NPM_VISIBLE_TIMEOUT_MS / 60_000} minutes; check https://www.npmjs.com/package/${PACKAGE}`
  );
}

async function main() {
  const args = process.argv.slice(2);
  preflight();

  const current = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
  const version = await chooseVersion(current, args);
  const tag = `v${version}`;

  step("Running the gates (the Release workflow runs them again)");
  for (const script of ["build", "typecheck", "lint", "test"]) run("npm", ["run", script]);

  step(`Preparing ${tag}`);
  // npm version updates package.json and package-lock.json; pnpm-lock.yaml
  // records no root version, so both lockfiles stay in sync.
  run("npm", ["version", version, "--no-git-tag-version", "--ignore-scripts"]);
  const date = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    "CHANGELOG.md",
    cutChangelog(fs.readFileSync("CHANGELOG.md", "utf8"), version, date)
  );
  run("git", ["add", "package.json", "package-lock.json", "CHANGELOG.md"]);
  run("git", ["commit", "--quiet", "-m", `release: ${tag}`]);
  run("git", ["tag", "-a", tag, "-m", tag]);

  step("Pushing the release commit and the tag");
  run("git", ["push", "--quiet", "origin", RELEASE_BRANCH]);
  run("git", ["push", "--quiet", "origin", tag]);

  step("Waiting for the Release workflow (npm publish + GitHub release)");
  const runId = await findReleaseRun(tag);
  console.log(`  https://github.com/${REPO}/actions/runs/${runId}`);
  const watch = spawnSync("gh", ["run", "watch", runId, "--repo", REPO, "--exit-status"], {
    stdio: "inherit",
  });
  if (watch.status !== 0) {
    throw new ReleaseError(
      `the Release workflow failed. Fix the cause, then re-run it with ` +
        `\`gh run rerun ${runId} --repo ${REPO}\` (an already published npm version is skipped)`
    );
  }

  step("Verifying both releases");
  await waitForNpm(version);
  const release = capture("gh", [
    "release",
    "view",
    tag,
    "--repo",
    REPO,
    "--json",
    "url,isDraft",
    "--jq",
    'if .isDraft then "draft" else .url end',
  ]);
  if (release === "draft") throw new ReleaseError(`the GitHub release ${tag} is still a draft`);

  console.log(`\n✅ ${tag} is live on both:`);
  console.log(`   npm:    https://www.npmjs.com/package/${PACKAGE}/v/${version}`);
  console.log(`   GitHub: ${release}`);
}

main().catch((error) => {
  process.stderr.write(`\n❌ Release stopped: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
