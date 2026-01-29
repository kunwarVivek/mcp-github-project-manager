# Codebase Structure

**Analysis Date:** 2026-01-29

## Directory Layout

```
mcp-github-project-manager/
├── src/                          # Source code
│   ├── index.ts                  # MCP server entry point
│   ├── cli.ts                    # CLI argument parsing
│   ├── env.ts                    # Environment configuration
│   ├── domain/                   # Domain types and schemas
│   ├── services/                 # Business logic services
│   ├── infrastructure/           # External integrations
│   └── __tests__/                # Test files (mirrors src structure)
├── tests/                        # Additional test suites
│   ├── ai-services/              # AI service integration tests
│   └── ai-tools/                 # AI tool tests
├── docs/                         # Documentation
│   ├── api-reference/            # API documentation
│   ├── architecture/             # Architecture docs
│   ├── features/                 # Feature documentation
│   └── tutorials/                # Usage tutorials
├── examples/                     # Example usage
│   ├── basic/                    # Basic usage examples
│   └── integration/              # Integration examples
├── scripts/                      # Build and utility scripts
├── .planning/                    # GSD planning documents
│   └── codebase/                 # Codebase analysis documents
├── build/                        # Compiled output (generated)
└── [config files]                # Various configuration files
```

## Directory Purposes

**`src/`:**
- Purpose: All TypeScript source code
- Contains: Entry points, domain, services, infrastructure, tests
- Key files:
  - `index.ts`: Main MCP server entry point
  - `cli.ts`: Command-line interface
  - `env.ts`: Environment variable handling

**`src/domain/`:**
- Purpose: Type definitions, schemas, and error classes
- Contains: TypeScript types, Zod schemas, enums
- Key files:
  - `types.ts`: Core domain types (Issue, Milestone, Project, Sprint)
  - `resource-types.ts`: Resource system types and enums
  - `resource-schemas.ts`: Zod validation schemas
  - `ai-types.ts`: AI task and PRD types
  - `mcp-types.ts`: MCP protocol types
  - `errors.ts`: Custom error classes
  - `automation-types.ts`: Automation rule types

**`src/services/`:**
- Purpose: Business logic and orchestration
- Contains: Service classes, AI processing, context generation
- Key files:
  - `ProjectManagementService.ts`: Main service (92KB, extensive)
  - `TaskGenerationService.ts`: AI task generation
  - `PRDGenerationService.ts`: PRD parsing and generation
  - `GitHubStateSyncService.ts`: State synchronization
  - `RequirementsTraceabilityService.ts`: Requirements tracking
  - `ai/AIServiceFactory.ts`: AI provider factory
  - `ai/AITaskProcessor.ts`: AI task processing
  - `context/`: Context generation services
  - `validation/`: Validation services

**`src/infrastructure/`:**
- Purpose: External integrations and infrastructure
- Contains: GitHub client, caching, events, MCP protocol, tools
- Subdirectories:
  - `github/`: GitHub API integration
  - `cache/`: Resource caching
  - `events/`: Event system
  - `mcp/`: MCP protocol handling
  - `tools/`: MCP tool definitions
  - `persistence/`: File persistence
  - `resource/`: Resource management
  - `http/`: Webhook server
  - `logger/`: Logging

**`src/infrastructure/github/`:**
- Purpose: GitHub API abstraction
- Contains: Repositories, types, utilities
- Key files:
  - `GitHubRepositoryFactory.ts`: Repository creation
  - `GitHubConfig.ts`: GitHub configuration
  - `GitHubErrorHandler.ts`: Error handling
  - `repositories/`: Repository implementations
  - `util/`: GraphQL helpers, type conversion

**`src/infrastructure/tools/`:**
- Purpose: MCP tool definitions and execution
- Contains: Tool registry, validators, formatters, AI task tools
- Key files:
  - `ToolRegistry.ts`: Central tool registry
  - `ToolSchemas.ts`: Tool definitions and execute functions
  - `ToolValidator.ts`: Argument validation
  - `ToolResultFormatter.ts`: Result formatting
  - `ai-tasks/`: AI-powered tool implementations

**`src/__tests__/`:**
- Purpose: Unit and integration tests
- Contains: Test files mirroring source structure
- Structure:
  - `unit/`: Unit tests
  - `integration/`: Integration tests
  - `e2e/`: End-to-end tests
  - `services/`: Service tests
  - `tools/`: Tool tests
  - `setup.ts`: Test setup
  - `test-utils.ts`: Test utilities

## Key File Locations

**Entry Points:**
- `src/index.ts`: MCP server main entry (shebang, 600+ lines)
- `src/cli.ts`: CLI argument parsing with Commander.js
- `src/env.ts`: Environment configuration loading

**Configuration:**
- `package.json`: Dependencies, scripts, npm config
- `tsconfig.json`: TypeScript configuration
- `tsconfig.build.json`: Build-specific TypeScript config
- `jest.config.cjs`: Jest test configuration
- `.env.example`: Environment variable template

**Core Logic:**
- `src/services/ProjectManagementService.ts`: Central service (92KB)
- `src/infrastructure/tools/ToolSchemas.ts`: All tool definitions
- `src/infrastructure/github/GitHubRepositoryFactory.ts`: GitHub client setup

**Testing:**
- `src/__tests__/setup.ts`: Jest setup file
- `src/__tests__/test-utils.ts`: Shared test utilities
- `jest.e2e.config.mjs`: E2E test configuration
- `jest.e2e.tools.config.js`: Tool E2E configuration

## Naming Conventions

**Files:**
- PascalCase for classes: `ProjectManagementService.ts`, `GitHubIssueRepository.ts`
- kebab-case for config: `resource-types.ts`, `mcp-types.ts`
- `.test.ts` suffix for tests: `GitHubConfig.test.ts`
- `.e2e.ts` suffix for E2E tests: `github-project-manager.e2e.ts`

**Directories:**
- lowercase with hyphens: `ai-tasks/`, `api-reference/`
- camelCase for compound names: none observed (uses kebab-case)

**Classes:**
- PascalCase: `ProjectManagementService`, `GitHubRepositoryFactory`
- Suffix with pattern type: `*Service`, `*Repository`, `*Factory`, `*Handler`

**Types/Interfaces:**
- PascalCase: `Issue`, `Milestone`, `CreateProject`
- Prefix interfaces with `I` (optional): `IGitHubRepository`
- Suffix with descriptive: `*Options`, `*Config`, `*Schema`, `*Args`

**Enums:**
- PascalCase: `ResourceType`, `ResourceStatus`, `RelationshipType`
- SCREAMING_SNAKE_CASE values: `ACTIVE`, `IN_PROGRESS`

**Functions:**
- camelCase: `createRoadmap`, `parseCommandLineArgs`
- Prefix with verb: `get*`, `create*`, `update*`, `delete*`, `execute*`

## Where to Add New Code

**New MCP Tool:**
1. Define schema in `src/infrastructure/tools/ToolSchemas.ts` or new file in `ai-tasks/`
2. Add tool to imports in `src/infrastructure/tools/ToolRegistry.ts`
3. Register in `registerBuiltInTools()` method
4. Add case in `src/index.ts` `executeToolHandler()` switch
5. Tests: `src/__tests__/tools/` or `src/__tests__/e2e/tools/`

**New Service:**
1. Create service class in `src/services/[ServiceName].ts`
2. Follow pattern: constructor, private methods, public API
3. Use dependency injection for AI and repository access
4. Tests: `src/__tests__/services/[ServiceName].test.ts`

**New GitHub Repository:**
1. Create in `src/infrastructure/github/repositories/`
2. Extend `BaseGitHubRepository`
3. Add factory method in `GitHubRepositoryFactory.ts`
4. Tests: `src/__tests__/unit/infrastructure/github/repositories/`

**New Domain Type:**
1. Add interface in appropriate `src/domain/*.ts` file
2. Add Zod schema in `src/domain/resource-schemas.ts` if needed
3. Add to `ResourceType` enum if it's a resource

**New AI Prompt:**
1. Create in `src/services/ai/prompts/`
2. Follow existing pattern: `*Prompts.ts`

**Utilities:**
- GitHub utilities: `src/infrastructure/github/util/`
- Test utilities: `src/__tests__/test-utils.ts`

## Special Directories

**`build/`:**
- Purpose: Compiled JavaScript output
- Generated: Yes (by `npm run build`)
- Committed: No (.gitignore)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (.gitignore)

**`.planning/`:**
- Purpose: GSD planning and analysis documents
- Generated: By GSD commands
- Committed: Configurable (typically yes for team projects)

**`docs/`:**
- Purpose: User-facing documentation
- Generated: Some (API docs via scripts)
- Committed: Yes

**`examples/`:**
- Purpose: Example usage code
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-01-29*
