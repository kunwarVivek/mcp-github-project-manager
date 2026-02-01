# Phase 12: Production Release - Research

**Researched:** 2026-02-01
**Domain:** npm package publication, documentation, changelog management
**Confidence:** HIGH

## Summary

This research covers the production release phase for an MCP server npm package. The project is already well-configured for npm publication with existing package.json, publish script, changelog, and documentation.

The primary focus areas are:
1. **Test stabilization** - 14 E2E tests failing (stdio transport layer issues), 20 tests intentionally skipped
2. **Documentation consolidation** - README exists (990 lines) with comprehensive content; needs trimming for npm
3. **Changelog update** - CHANGELOG.md exists with Keep a Changelog format; needs Unreleased section filled out
4. **npm publish verification** - package.json already well-configured; verify files field and dry-run

**Primary recommendation:** Fix the 14 failing E2E tests (all related to stdio transport layer), update CHANGELOG.md with complete v1.0.1 release notes, and verify npm pack contents before publish.

## Standard Stack

The project already has the production release infrastructure in place:

### Core
| Component | Status | Purpose | Why Standard |
|-----------|--------|---------|--------------|
| package.json | Configured | npm publication | Already has files, bin, publishConfig, repository |
| CHANGELOG.md | Exists | Version history | Uses Keep a Changelog format |
| LICENSE | Exists (MIT) | Open source license | Standard MIT license |
| README.md | Exists | Documentation | Comprehensive but lengthy |
| scripts/publish.js | Exists | Automated release | Interactive version bump and publish |

### Supporting
| Component | Status | Purpose | When to Use |
|-----------|--------|---------|-------------|
| RELEASE.md | Exists | Release process guide | Reference for maintainers |
| docs/TOOLS.md | Exists (1810 lines) | Tool reference | 119 tools documented |
| docs/API.md | Exists (894 lines) | API reference | Service documentation |
| .env.example | Exists | Configuration template | User setup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual CHANGELOG | semantic-release | Already using Keep a Changelog format; works well |
| Custom publish script | np, release-it | Existing script is sufficient, no need to add dependency |

**Current Configuration (verified):**
```json
{
  "name": "mcp-github-project-manager",
  "version": "1.0.1",
  "publishConfig": { "access": "public" },
  "bin": { "mcp-github-project-manager": "./build/index.js" },
  "files": ["build/**/*", "LICENSE", "README.md"],
  "engines": { "node": ">=18.0.0" }
}
```

## Architecture Patterns

### Documentation Structure Pattern

For npm packages with 119 tools, the recommended pattern is layered documentation:

```
/
├── README.md            # Quick start, overview, installation (< 500 lines ideal)
├── CHANGELOG.md         # Version history
├── LICENSE              # MIT license
├── CONTRIBUTING.md      # Contribution guide
├── docs/
│   ├── TOOLS.md         # Comprehensive tool reference
│   ├── API.md           # Internal API reference
│   ├── user-guide.md    # Extended usage guide
│   └── ...              # Other detailed docs
```

**README sections (recommended order):**
1. Title + badges (npm version, license, node version)
2. One-paragraph description
3. Quick Start (5-10 lines)
4. Key Features (bullet points)
5. Installation (npm install command)
6. Configuration (environment variables)
7. Usage Examples (3-5 common cases)
8. MCP Client Integration (Claude, VS Code, Cursor)
9. Documentation links
10. License

### Changelog Entry Pattern

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format:

```markdown
## [1.0.1] - 2026-02-XX

### Added
- Feature descriptions

### Changed
- Modification descriptions

### Fixed
- Bug fix descriptions
```

**Categories (only include sections with entries):**
- Added - new features
- Changed - modifications to existing functionality
- Deprecated - features slated for removal
- Removed - features eliminated
- Fixed - bug resolutions
- Security - vulnerability patches

### Anti-Patterns to Avoid
- **Bloated README:** npm shows README on package page; keep focused on getting started
- **Missing examples:** Users copy-paste; provide working code snippets
- **Commit log as changelog:** Write for humans, not machines; summarize noteworthy changes
- **Unpinned peer dependencies:** Can cause version conflicts; specify version ranges

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version bumping | Manual version edits | npm version or existing publish.js | Handles git tags, validates |
| Package contents | Manual file list | npm pack --dry-run | Accurate preview of published files |
| Changelog format | Custom format | Keep a Changelog | Industry standard, well understood |
| Badge generation | Manual HTML | shields.io URLs | Auto-updating, consistent |

**Key insight:** The project already has a working publish pipeline in `scripts/publish.js`. Use it rather than rebuilding.

## Common Pitfalls

### Pitfall 1: Accidentally Publishing Sensitive Data
**What goes wrong:** API keys, .env files, or credentials end up in published package
**Why it happens:** .npmignore not properly configured or missing
**How to avoid:**
1. Run `npm pack --dry-run` before publishing
2. Review the file list for any sensitive data
3. Verify .env and credentials files are excluded
**Warning signs:** No .npmignore file or relying only on .gitignore

### Pitfall 2: Test Failures Blocking Release
**What goes wrong:** Tests fail in CI but pass locally
**Why it happens:** Environment differences, timing issues, or flaky tests
**How to avoid:**
1. Fix root cause of failing tests before release
2. Document intentionally skipped tests with justification
3. Run full test suite in clean environment
**Warning signs:** Tests that pass sometimes and fail sometimes
**Current status:** 14 failing E2E tests (stdio transport layer), 20 skipped (justified)

### Pitfall 3: Missing or Outdated Documentation
**What goes wrong:** Users can't install or configure correctly
**Why it happens:** Documentation written during development, not updated
**How to avoid:**
1. Follow README template for essential sections
2. Test installation from npm perspective
3. Verify all CLI arguments documented
**Warning signs:** Installation instructions reference non-existent paths

### Pitfall 4: npm Token/Authentication Issues
**What goes wrong:** Publish fails with 403 or authentication errors
**Why it happens:** Classic tokens deprecated (December 2025), expired tokens
**How to avoid:**
1. Use npm login with 2FA
2. Verify npm whoami returns correct user
3. Check publishConfig.access is "public" for unscoped packages
**Warning signs:** Token older than 90 days (new limit as of Dec 2025)

### Pitfall 5: Version Already Published
**What goes wrong:** npm publish fails because version exists
**Why it happens:** Forgot to bump version or republishing same version
**How to avoid:**
1. Always check npm info mcp-github-project-manager before publish
2. Use npm version to bump (already in publish.js)
3. Never unpublish and republish same version
**Warning signs:** "You cannot publish over the previously published versions"

### Pitfall 6: Scoped Package Access
**What goes wrong:** Scoped packages default to restricted (private)
**Why it happens:** npm defaults to restricted for @scope/package
**How to avoid:**
1. Use --access public flag for public scoped packages
2. Already configured: "publishConfig": { "access": "public" }
**Warning signs:** Package not visible on npm after publish

## Code Examples

### Pre-publish Verification
```bash
# Source: npm official docs
# Verify package contents before publishing
npm pack --dry-run

# Verify you're logged in as correct user
npm whoami

# Check if version already exists
npm info mcp-github-project-manager versions

# Run full test suite
npm test
```

### README Badge Pattern
```markdown
<!-- Source: shields.io standard format -->
[![npm version](https://img.shields.io/npm/v/mcp-github-project-manager.svg)](https://www.npmjs.com/package/mcp-github-project-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/mcp-github-project-manager.svg)](https://nodejs.org/)
```

### Quick Start Pattern for MCP Servers
```bash
# Source: @modelcontextprotocol/sdk README pattern
# Install globally
npm install -g mcp-github-project-manager

# Set environment
export GITHUB_TOKEN="your_token"
export GITHUB_OWNER="your_username"
export GITHUB_REPO="your_repo"

# Run
mcp-github-project-manager
```

### MCP Client Configuration Pattern
```json
// Source: MCP server-filesystem npm package pattern
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_token",
        "GITHUB_OWNER": "your_username",
        "GITHUB_REPO": "your_repo"
      }
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm classic tokens | Granular tokens with 2FA | Dec 2025 | Must use new token format |
| Any .gitignore | Cumulative ignore rules | npm 7+ | .npmignore replaces .gitignore entirely |
| CommonJS default | ESM with type: "module" | Node 18+ | Already using ESM |
| Manual changelog | Keep a Changelog + semver | Standard | Already using this format |

**Current (December 2025):**
- npm tokens now have maximum 90-day validity
- 2FA required by default for new granular tokens
- OIDC trusted publishing recommended for CI/CD
- ESM is the standard for new packages

## Open Questions

1. **Test Failures**
   - What we know: 14 E2E tests fail on stdio transport layer, 20 are skipped with justification
   - What's unclear: Whether failures block release or are environment-specific
   - Recommendation: Fix or document as known issues before publish

2. **README Length**
   - What we know: Current README is 990 lines, comprehensive
   - What's unclear: Whether to trim for npm or keep comprehensive
   - Recommendation: Keep as-is; npm handles long READMEs well with collapsible sections

3. **Version Bump**
   - What we know: Currently at 1.0.1, CHANGELOG shows Unreleased section
   - What's unclear: Whether to stay at 1.0.1 or bump
   - Recommendation: If no changes since 1.0.1, stay; otherwise bump to 1.0.2

## Sources

### Primary (HIGH confidence)
- package.json, CHANGELOG.md, scripts/publish.js - direct file inspection
- [npm docs: package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) - official reference
- [npm docs: npm-publish](https://docs.npmjs.com/cli/v8/commands/npm-publish/) - official reference
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) - changelog format standard

### Secondary (MEDIUM confidence)
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - MCP package example
- [Best practices for npm packages](https://mikbry.com/blog/javascript/npm/best-practices-npm-package) - community patterns
- [npm docs: About README files](https://docs.npmjs.com/about-package-readme-files/) - README guidelines

### Tertiary (LOW confidence)
- WebSearch findings on npm pitfalls (verified against official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - direct inspection of existing files
- Architecture: HIGH - follows established npm patterns
- Pitfalls: HIGH - verified against npm official docs and recent changes

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain)

## Appendix: Current Test Status

```
Test Suites: 3 failed, 4 skipped, 67 passed, 70 of 74 total
Tests:       14 failed, 20 skipped, 1460 passed, 1494 total
```

**Failing tests (all related to stdio transport):**
- Stdio Transport Layer Tests - stdout/stderr separation
- E2E Test Infrastructure Validation - MCP server startup
- MCP Protocol Compliance E2E Tests - transport compliance

**Skipped tests (20):** Intentionally skipped with justification per project context.

## Appendix: npm pack Contents Preview

Key files included in published package:
- build/**/* (compiled TypeScript)
- LICENSE
- README.md

Total: ~400 files in build directory (domain types, infrastructure, services, tools)

Package size: Review with `npm pack --dry-run` before publish.
