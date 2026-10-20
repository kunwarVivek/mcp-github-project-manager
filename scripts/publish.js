#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (question) =>
  new Promise((resolve) => {
    rl.question(question, resolve);
  });

/**
 * The repository is installable with npm or pnpm — both lockfiles are
 * maintained and this script must use whichever package manager the caller
 * invoked, so that `version` updates the matching lockfile and `publish`
 * ships the right tree.
 */
const isPnpm = /pnpm/i.test(process.env.npm_config_user_agent ?? "");
const pm = isPnpm ? "pnpm" : "npm";
const pmRun = isPnpm ? "pnpm run" : "npm run";

async function runPublish() {
  try {
    // Check for uncommitted changes
    try {
      execSync("git diff-index --quiet HEAD --");
    } catch (error) {
      process.stderr.write(
        "❌ You have uncommitted changes. Please commit or stash them before publishing."
      );
      process.exit(1);
    }

    // Run tests
    console.log("🧪 Running tests...");
    execSync(`${pm} test`, { stdio: "inherit" });

    // Read current package version
    const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));
    const currentVersion = packageJson.version;
    console.log(`📦 Current version: ${currentVersion}`);

    // Ask for new version
    const versionTypes = ["patch", "minor", "major"];
    const versionType = await prompt(`Select version type (patch/minor/major): `);

    if (!versionTypes.includes(versionType)) {
      process.stderr.write("❌ Invalid version type. Must be patch, minor, or major");
      process.exit(1);
    }

    // Update version
    console.log(`🔖 Updating to a new ${versionType} version...`);
    execSync(`${pm} version ${versionType} --no-git-tag-version`, { stdio: "inherit" });

    // Read new version
    const updatedPackageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));
    const newVersion = updatedPackageJson.version;

    // Build package
    console.log("🔨 Building package...");
    execSync(`${pmRun} build`, { stdio: "inherit" });

    // Confirm publishing
    const confirm = await prompt(`Are you sure you want to publish version ${newVersion}? (y/n): `);
    if (confirm.toLowerCase() !== "y") {
      console.log("🛑 Publishing cancelled.");
      process.exit(0);
    }

    // Create Git tag and push. Publishing is deliberately NOT done here:
    // the tag push triggers .github/workflows/release.yml, which builds,
    // tests, publishes to npm and creates the GitHub release. Publishing
    // here as well would make the workflow publish the same version twice
    // (npm rejects re-publishing an existing version).
    console.log("📌 Creating git tag and pushing...");
    execSync(`git add package.json ${isPnpm ? "pnpm-lock.yaml" : "package-lock.json"}`);
    execSync(`git commit -m "release: v${newVersion}"`);
    execSync(`git tag v${newVersion}`);
    execSync("git push");
    execSync("git push --tags");

    console.log(`\n✅ v${newVersion} tagged and pushed.`);
    console.log("   The 'Release' GitHub Actions workflow now builds, tests, publishes to npm");
    console.log("   and creates the GitHub release. Watch it here:");
    console.log(
      `   https://github.com/kunwarVivek/mcp-github-project-manager/actions/workflows/release.yml`
    );
    console.log(
      `   Release page: https://github.com/kunwarVivek/mcp-github-project-manager/releases/tag/v${newVersion}`
    );

    console.log(`\n✅ Successfully published version ${newVersion}!`);
    console.log(`   npm: https://www.npmjs.com/package/mcp-github-project-manager`);
    console.log(
      `   GitHub: https://github.com/kunwarVivek/mcp-github-project-manager/releases/tag/v${newVersion}`
    );
  } catch (error) {
    process.stderr.write("❌ Error during publishing:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

runPublish();
