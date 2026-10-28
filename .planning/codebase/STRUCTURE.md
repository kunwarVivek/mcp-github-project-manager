# Codebase Structure

**Analysis Date:** 2026-10-21

**Updated:** 2026-10-21 — directory tree, config files, and the "where to add new code" paths rewritten for the current layout (Vitest 5, Biome 2.5, MCP SDK v2, tsyringe container).

## Directory Layout

```
mcp-github-project-manager/
├── src/                          # Source code
│   ├── index.ts                  # MCP server entry point
│   ├── container.ts              # tsyringe DI container configuration
│   ├── cli.ts                    # CLI argument parsing (commander)
│   ├── env.ts                    # Environment / secret resolution
│   ├── domain/                   # Domain types, zod schemas, errors (no logic)
│   ├── services/                 # Business logic services
│   ├── infrastructure/           # External integrations
│   ├── analysis/                 # Pure analysis helpers
│   ├── cache/                    # Standalone cache helpers
│   ├── __mocks__/                # Manual mock modules
│   └── __tests__/                # Test files (mirrors src structure)
├── tests/                        # Legacy root test tree — still live (48 files)
│   ├── ai-services/
│   ├── ai-tools/
│   ├── cache/
│   ├── infrastructure/
│   └── services/
├── docs/                         # Documentation
│   ├── adr/                      # Architecture decision records
│   ├── api-reference/
│   ├── architecture/
│   ├── features/
│   └── tutorials/
├── examples/                     # Example usage
├── scripts/                      # Build and utility scripts
├── .planning/                    # GSD planning documents
│   ├── codebase/                 # Codebase analysis documents (this directory)
│   └── phases/                   # Historical phase records
├── build/                        # Compiled output (generated)
├── vitest.config.ts              # Test runner config
├── biome.json                    # Lint + format config
├── tsconfig.json / .build.json / .test.json / .typecheck.json
├── pnpm-workspace.yaml           # pnpm 12 allowBuilds allowlist
├── Dockerfile                    # Multi-stage node:24-slim image
└── [config files]                # Various configuration files
```

## Directory Purposes

**`src/`:**
- Purpose: All TypeScript source code
- Contains: Entry points, domain, services, infrastructure, tests
- Key files:
  - `index.ts`: Main MCP server entry point
  - `container.ts`: tsyringe DI container wiring
  - `cli.ts`: Command-line interface
  - `env.ts`: Environment/secret resolution and startup validation

**`src/domain/`:**
- Purpose: Type definitions, schemas, and error classes — **no logic**
- Contains: TypeScript types, Zod 4 schemas, enums, entities, value objects, domain events
- Key files:
  - `types.ts`: Core domain types (Issue, Milestone, Project, Sprint)
  - `resource-types.ts`: Resource system types and enums
  - `resource-schemas.ts`: Zod validation schemas
  - `ai-types.ts`: AI task and PRD types
  - `mcp-types.ts`: MCP protocol types
  - `errors.ts`: Custom error classes
  - `config-schema.ts`: Startup configuration validation
  - `entities/`, `value-objects/`, `events/`, `utils/`: richer domain model

**`src/services/`:**
- Purpose: Business logic and orchestration
- Contains: Service classes, AI processing, context generation
- Key files:
  - `ProjectManagementService.ts`: Facade service (~724 lines) delegating to the extracted services below
  - `IssueService.ts`, `MilestoneService.ts`, `SubIssueService.ts`, `FieldValueService.ts`, `LabelService.ts`, `IterationService.ts`, `PullRequestService.ts`, `RoadmapService.ts`, `SprintPlanningService.ts`
  - `TaskGenerationService.ts`: AI task generation
  - `PRDGenerationService.ts`: PRD parsing and generation
  - `GitHubStateSyncService.ts`: State synchronization
  - `RequirementsTraceabilityService.ts`: Requirements tracking
  - `ai/`: AI provider factory, task processor, prompt templates
  - `agent/`: Agent swarm orchestration services
  - `context/`, `feature/`, `templates/`, `utils/`, `validation/`

**`src/infrastructure/`:**
- Purpose: External integrations and infrastructure
- Contains: GitHub client, caching, events, MCP protocol, tools, resilience, secrets
- Subdirectories:
  - `github/`: GitHub API integration
  - `tools/`: MCP tool definitions, registry, validators, formatters
  - `cache/`: Resource caching + cache persistence
  - `events/`: Event system and webhook handler
  - `mcp/`: MCP resources, prompts, error handling, response formatting
  - `persistence/`: File persistence
  - `resilience/`: Circuit breaker, AI resilience policy
  - `observability/`: Correlation context, tracing logger, security audit log
  - `secrets/`: Secret providers (env, file, `gh` CLI)
  - `agent/`: Agent store, work-product store, project field setup
  - `health/`: Health service
  - `http/`: Webhook server
  - `lifecycle/`, `resource/`, `validation/`, `logger/`

**`src/infrastructure/github/`:**
- Purpose: GitHub API abstraction
- Contains: Repositories, types, utilities
- Key files:
  - `GitHubRepositoryFactory.ts`: Repository creation
  - `GitHubConfig.ts`: GitHub configuration (token is non-enumerable so it cannot be serialized)
  - `GitHubErrorHandler.ts`: Error handling
  - `RateLimitManager.ts`: Rate-limit tracking
  - `repositories/`: Repository implementations
  - `util/`: GraphQL helpers, type conversion

**`src/infrastructure/tools/`:**
- Purpose: MCP tool definitions and execution
- Contains: Tool registry, validators, formatters, AI task tools
- Key files:
  - `ToolRegistry.ts`: Central tool registry; generates each tool's JSON Schema via `z.toJSONSchema({io:'input'})`
  - `ToolSchemas.ts`: Tool definitions
  - `ToolValidator.ts`: Argument validation
  - `ToolResultFormatter.ts`: Result formatting
  - `tool-factory.ts`: `requireToken()` / `createGitHubFactory()` — the credential-aware GitHub client factory
  - `ai-tasks/`, `compound/`, `schemas/`, `annotations/`: tool families

**`src/__tests__/`:**
- Purpose: Unit, integration, and E2E tests
- Contains: Test files mirroring source structure
- Structure:
  - `unit/`: Unit tests
  - `integration/`: Integration tests
  - `e2e/`: End-to-end tests (incl. `e2e/setup.ts`, the global setup file)
  - `services/`, `tools/`, `infrastructure/`: Service/tool/infrastructure tests
  - `setup.ts`: Shared fixture module (imported by tests, not wired into `setupFiles`)
  - `test-utils.ts`: Test utilities

**`tests/` (legacy root tree):**
- Purpose: Older test suites that predate `src/__tests__/`
- Contains: `ai-services/`, `ai-tools/`, `cache/`, `infrastructure/`, `services/`
- **Still live**: `vitest.config.ts` includes `tests/**/*.test.ts` and `tests/**/*.spec.ts`, and these 48 files run in every `pnpm test`. They are not duplicates of `src/__tests__/` and are not candidates for removal.

## Key File Locations

**Entry Points:**
- `src/index.ts`: MCP server main entry (shebang, 1250+ lines)
- `src/container.ts`: tsyringe DI container configuration
- `src/cli.ts`: CLI argument parsing with Commander.js
- `src/env.ts`: Environment/secret resolution and startup validation

**Configuration:**
- `package.json`: Dependencies, scripts (package-manager agnostic)
- `tsconfig.json`: Base TypeScript configuration
- `tsconfig.build.json`: Build-specific TypeScript config
- `tsconfig.test.json`: Test typecheck config
- `tsconfig.typecheck.json`: Typecheck config (`src/` + `examples/`)
- `vitest.config.ts`: Test runner configuration
- `biome.json`: Lint + format configuration
- `pnpm-workspace.yaml`: pnpm 12 `allowBuilds` allowlist
- `.node-version`: Node version pin (24)
- `.env.example`: Environment variable template

**Core Logic:**
- `src/services/ProjectManagementService.ts`: Facade service
- `src/infrastructure/tools/ToolRegistry.ts`: All tool definitions + JSON Schema generation
- `src/infrastructure/github/GitHubRepositoryFactory.ts`: GitHub client setup

**Testing:**
- `vitest.config.ts`: Single test configuration for all suites
- `src/__tests__/e2e/setup.ts`: Global setup file (env seeding, nock, E2E-only fake timers)
- `src/__tests__/setup.ts`: Shared fixture module
- `src/__tests__/test-utils.ts`: Shared test utilities

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
1. Define the tool (name, description, zod input/output schema, executor) in `src/infrastructure/tools/` — e.g. a new `*-tools.ts` module, or `ai-tasks/` for AI-backed tools
2. Register it in `ToolRegistry.registerBuiltInTools()` (`src/infrastructure/tools/ToolRegistry.ts`)
3. No per-tool switch in the entry point: the server registers every registry tool with `server.registerTool(...)` and all of them share one `dispatchTool`
4. Tests: `src/__tests__/tools/` or `src/__tests__/e2e/tools/`

**New Service:**
1. Create the service class in `src/services/[ServiceName].ts`
2. Follow pattern: constructor, private methods, public API
3. Register it in `src/container.ts` if it should be resolvable from the DI container
4. Tests: `src/__tests__/unit/services/[ServiceName].test.ts`

**New GitHub Repository:**
1. Create in `src/infrastructure/github/repositories/`
2. Extend `BaseGitHubRepository`
3. Add a factory method in `GitHubRepositoryFactory.ts`
4. Tests: `src/__tests__/unit/infrastructure/github/repositories/`

**New Domain Type:**
1. Add the interface in the appropriate `src/domain/*.ts` file
2. Add a Zod 4 schema in `src/domain/resource-schemas.ts` if needed
3. Add to `ResourceType` enum if it's a resource
4. Domain code stays logic-free — behavior belongs in `src/services/`

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
- Purpose: installed dependencies (npm or pnpm)
- Generated: Yes (by `npm install` / `pnpm install`)
- Committed: No (.gitignore)

**`.planning/`:**
- Purpose: GSD planning and analysis documents
- Generated: By GSD commands
- Committed: Yes
- Note: `.planning/codebase/` describes the **current** codebase; `.planning/phases/` holds **historical** records of past phases and is intentionally left as-is

**`docs/`:**
- Purpose: User-facing documentation, including ADRs
- Generated: Some (API docs via scripts)
- Committed: Yes

**`examples/`:**
- Purpose: Example usage code
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-10-21*
