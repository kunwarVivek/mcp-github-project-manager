#!/usr/bin/env node
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question) => new Promise((resolve) => {
  rl.question(question, resolve);
});

async function runPublish() {
  try {
    // Check for uncommitted changes
    try {
      execSync('git diff-index --quiet HEAD --');
    } catch (error) {
      process.stderr.write('❌ You have uncommitted changes. Please commit or stash them before publishing.');
      process.exit(1);
    }

    // Run tests
    console.log('🧪 Running tests...');
    execSync('npm test', { stdio: 'inherit' });

    // Read current package version
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const currentVersion = packageJson.version;
    console.log(`📦 Current version: ${currentVersion}`);
    
    // Ask for new version
    const versionTypes = ['patch', 'minor', 'major'];
    const versionType = await prompt(`Select version type (patch/minor/major): `);
    
    if (!versionTypes.includes(versionType)) {
      process.stderr.write('❌ Invalid version type. Must be patch, minor, or major');
      process.exit(1);
    }
    
    // Update version
    console.log(`🔖 Updating to a new ${versionType} version...`);
    execSync(`npm version ${versionType} --no-git-tag-version`, { stdio: 'inherit' });
    
    // Read new version
    const updatedPackageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const newVersion = updatedPackageJson.version;
    
    // Build package
    console.log('🔨 Building package...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Confirm publishing
    const confirm = await prompt(`Are you sure you want to publish version ${newVersion}? (y/n): `);
    if (confirm.toLowerCase() !== 'y') {
      console.log('🛑 Publishing cancelled.');
      process.exit(0);
    }
    
    // Publish to npm
    console.log('🚀 Publishing to npm...');
    execSync('npm publish', { stdio: 'inherit' });
    
    // Create Git tag and push
    console.log('📌 Creating git tag and pushing...');
    execSync(`git add package.json package-lock.json`);
    execSync(`git commit -m "release: v${newVersion}"`);
    execSync(`git tag v${newVersion}`);
    execSync('git push');
    execSync('git push --tags');

    // Create GitHub Release
    console.log('📋 Creating GitHub release...');
    try {
      const releaseNotes = `## v${newVersion}\n\nSee [CHANGELOG.md](https://github.com/kunwarVivek/mcp-github-project-manager/blob/main/CHANGELOG.md) for details.\n\n📦 **npm:** \`npm install mcp-github-project-manager@${newVersion}\``;
      execSync(`gh release create v${newVersion} --title "v${newVersion}" --notes "${releaseNotes}"`, { stdio: 'inherit' });
      console.log('✅ GitHub release created!');
    } catch (error) {
      console.log('⚠️  GitHub release creation failed (gh CLI may not be installed). Create manually at:');
      console.log(`   https://github.com/kunwarVivek/mcp-github-project-manager/releases/new?tag=v${newVersion}`);
    }

    console.log(`\n✅ Successfully published version ${newVersion}!`);
    console.log(`   npm: https://www.npmjs.com/package/mcp-github-project-manager`);
    console.log(`   GitHub: https://github.com/kunwarVivek/mcp-github-project-manager/releases/tag/v${newVersion}`);
  } catch (error) {
    process.stderr.write('❌ Error during publishing:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

runPublish();
