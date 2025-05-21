# Release Process

This document outlines the process for creating new releases of the MCP GitHub Project Manager.

## Release Process

### 1. Preparation

Before releasing, ensure:
- All tests pass: `npm test`
- Documentation is up-to-date
- Changes are properly documented in CHANGELOG.md
- All code changes have been reviewed and merged

### 2. Update Version

Use the automated release script:

```bash
npm run release
```

This script will:
1. Run tests to verify everything works
2. Prompt for the version type (patch, minor, major)
3. Update the version in package.json
4. Build the project
5. Publish to npm
6. Create a git tag and push to the repository

### 3. Manual Release Steps

If you prefer to release manually:

```bash
# Update version
npm version patch  # or minor or major

# Build
npm run build

# Publish to npm
npm publish

# Push changes and tags
git push && git push --tags
```

## Version Guidelines

- **Patch (0.0.x)**: Bug fixes and minor changes that don't affect compatibility
- **Minor (0.x.0)**: New features added in a backwards-compatible manner
- **Major (x.0.0)**: Breaking changes that aren't backwards-compatible

## Post-Release

After releasing:
1. Update the GitHub release with release notes
2. Announce the release in relevant channels
3. Update documentation site if applicable
4. Monitor for any issues with the new release

## Hotfixes

For urgent fixes:
1. Create a hotfix branch from the release tag
2. Apply the fix and test thoroughly
3. Update version with a patch increase
4. Publish and tag as above
5. Merge the hotfix back to main/development branches
