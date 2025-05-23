# Changelog

All notable changes to the MCP GitHub Project Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial setup for npm package publication
- Enhanced documentation for public use
- Publication scripts and workflows

### Changed
- Updated package.json for npm publication
  - Added proper author information
  - Fixed repository, homepage, and bugs URLs
  - Added files field to control package contents
  - Set specific version for @modelcontextprotocol/sdk dependency
  - Added publishConfig for public access
  - Added funding information

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
