# Changelog

All notable changes to the MCP GitHub Project Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No unreleased changes.

## [1.0.2] - 2026-02-01

### Added
- AI-powered sprint planning with capacity analysis (AI-09 to AI-12)
- AI-powered roadmap generation with phase sequencing (AI-13 to AI-16)
- AI issue intelligence: enrichment, labels, duplicates, related issues (AI-17 to AI-20)
- PRD confidence scoring and section-level quality metrics (AI-01 to AI-04)
- Task dependency detection and effort estimation (AI-05 to AI-08)
- Sub-issue management tools (GHAPI-01 to GHAPI-05)
- Project status update tools (GHAPI-06 to GHAPI-08)
- Project template and linking tools (GHAPI-09 to GHAPI-18)
- Project lifecycle and advanced operations (GHAPI-19 to GHAPI-24)
- Circuit breaker pattern for AI service resilience (DEBT-21)
- Health check endpoint for service monitoring (DEBT-22)
- Request tracing with correlation IDs (DEBT-23)
- Cache persistence for improved performance (DEBT-24)
- Graceful degradation when AI unavailable (DEBT-25)
- Comprehensive tool documentation (119 tools across 17 categories)
- Configuration guide and troubleshooting documentation
- Publication scripts and workflows for npm

### Changed
- Upgraded MCP SDK from 1.12.0 to 1.25.3 (MCP-01 to MCP-15)
- Decomposed ProjectManagementService into 6 focused services (DEBT-01 to DEBT-07)
- All tools now have behavior annotations and output schemas
- Improved type safety throughout codebase (DEBT-08 to DEBT-13)
- Enhanced error handling with MCP-compliant error codes
- Updated package.json for npm publication
  - Added proper author information
  - Fixed repository, homepage, and bugs URLs
  - Added files field to control package contents
  - Added publishConfig for public access
  - Added funding information

### Fixed
- Test suite stabilization with proper credential guards (DEBT-14 to DEBT-20)
- Type assertion issues replaced with proper type guards
- E2E test reliability improvements (PROD-01 to PROD-03)
- Fixed E2E tool discovery to use MCP SDK properly

## [0.1.0] - 2025-05-21

### Added
- Initial implementation of MCP server for GitHub Projects
- Stdio transport support
- Core tools:
  - create_project
  - get_project
  - create_milestone
  - plan_sprint
  - get_milestone_metrics
  - create_roadmap
- Basic project structure with Clean Architecture
- GitHub API integration via Octokit
- Tools validated with Zod schemas
- Test suite with Jest
- Basic documentation

### Changed
- None (initial release)

### Fixed
- None (initial release)
