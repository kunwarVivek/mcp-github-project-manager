# Coding Conventions

**Analysis Date:** 2026-01-29

## Naming Patterns

**Files:**
- PascalCase for classes and services: `ProjectManagementService.ts`, `GitHubProjectRepository.ts`
- kebab-case for config files: `jest.config.cjs`, `tsconfig.build.json`
- PascalCase with suffix for types: `ai-types.ts`, `resource-types.ts`, `mcp-types.ts`
- Test files: `*.test.ts` pattern (not `.spec.ts`)

**Functions:**
- camelCase for all functions and methods: `createRoadmap`, `setFieldValue`, `getRepositoryFactory`
- Async functions do not use `async` prefix: `generatePRD` not `asyncGeneratePRD`
- Private methods prefix with no underscore (use TypeScript `private`): `private mapErrorToMCPError`

**Variables:**
- camelCase for variables: `mockGraphql`, `createdProjectId`
- SCREAMING_SNAKE_CASE for constants: `MCPErrorCode.VALIDATION_ERROR`
- Interface prefixes: None used (prefer `Issue` over `IIssue`)

**Types:**
- PascalCase for types and interfaces: `Project`, `CreateIssue`, `MCPResponse`
- Type aliases use PascalCase: `ProjectId`, `FieldId`, `IssueId`
- Enums use PascalCase with PascalCase members: `ResourceStatus.ACTIVE`, `ResourceType.PROJECT`

**Directories:**
- kebab-case: `ai-tasks/`, `ai-services/`
- lowercase single words: `services/`, `domain/`, `infrastructure/`

## Code Style

**Formatting:**
- Prettier configured via npm scripts: `npm run format`
- Command: `prettier --write "src/**/*.ts"`
- 2-space indentation (TypeScript default)
- Semicolons required
- Single quotes for strings

**Linting:**
- ESLint with TypeScript support: `npm run lint`
- Command: `eslint . --ext .ts`
- Packages: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
- Integrations: `eslint-config-prettier`, `eslint-plugin-prettier`, `eslint-plugin-jest`

**TypeScript:**
- Strict mode enabled (`"strict": true`)
- ES2022 target with ESNext modules
- Experimental decorators enabled (for tsyringe DI)
- Path alias: `@/*` maps to `src/*`

## Import Organization

**Order:**
1. Node.js built-ins (e.g., `import { EventEmitter } from 'events'`)
2. External packages (e.g., `import { z } from 'zod'`)
3. Internal absolute imports with `../` paths
4. Relative imports (`./`)

**Path Style:**
- Relative paths for local imports: `import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory"`
- No barrel files (direct imports to specific files)
- `.js` extension not used in imports (ESM compatibility handled by bundler)

**Path Aliases:**
- `@/*` configured but not consistently used
- Most code uses relative paths: `../../domain/types`

**Example Import Block:**
```typescript
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { ResourceStatus, ResourceType } from "../domain/resource-types";
import { DomainError, ValidationError } from "../domain/errors";
```

## Error Handling

**Patterns:**
- Custom error classes extending `Error` in `src/domain/errors.ts`
- Error hierarchy: `DomainError`, `ValidationError`, `ResourceNotFoundError`, `GitHubAPIError`, `MCPProtocolError`
- Error name set via `this.name = "ErrorName"` or `this.name = this.constructor.name`
- Stack trace capture: `Error.captureStackTrace(this, this.constructor)`

**Error Classes:**
```typescript
// Pattern from src/domain/errors.ts
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
```

**Error Mapping:**
- Domain errors mapped to MCP error codes via `MCPErrorHandler`
- Error codes defined in `MCPErrorCode` enum: `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `UNAUTHORIZED`, `RATE_LIMITED`, `INTERNAL_ERROR`

**Try-Catch Pattern:**
```typescript
try {
  // operation
} catch (error) {
  process.stderr.write(`Error in tool: ${error}\n`);
  // Return formatted error response, not throw
  return ToolResultFormatter.formatSuccess('tool_name', {
    content: [{ type: 'text', text: `Error: ${errorMessage}` }],
    success: false
  });
}
```

## Logging

**Framework:** Custom logger in `src/infrastructure/logger/index.ts`

**Key Points:**
- All logs go to `stderr` (to avoid interfering with MCP protocol on stdout)
- Uses `process.stderr.write()` directly
- Singleton pattern: `Logger.getInstance()`
- Prefix support: `createLogger('MCP')`

**Interface:**
```typescript
interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}
```

**Usage:**
```typescript
import { Logger } from "../infrastructure/logger";

const logger = Logger.getInstance();
logger.info("Starting operation");
logger.error("Operation failed", error);
```

## Comments

**When to Comment:**
- JSDoc for public API methods with `@param` and `@returns`
- Inline comments for complex logic explanations
- TODO/FIXME for known issues (found in codebase)

**JSDoc Pattern:**
```typescript
/**
 * Get the repository factory instance for sync service
 */
getRepositoryFactory(): GitHubRepositoryFactory {
  return this.factory;
}
```

**Inline Comments:**
- Used sparingly for non-obvious code
- Explain "why" not "what"

## Function Design

**Size:** Functions typically 20-50 lines; complex service methods may be longer

**Parameters:**
- Use object destructuring for 3+ parameters
- Zod schemas for validation: `z.object({ ... })`
- Optional parameters with defaults: `z.string().default("value")`

**Return Values:**
- Async functions return `Promise<T>`
- Service methods return domain objects or void
- Tool handlers return `MCPResponse`

**Example:**
```typescript
async createRoadmap(data: {
  project: CreateProject;
  milestones: Array<{
    milestone: CreateMilestone;
    issues: CreateIssue[];
  }>;
}): Promise<{
  project: Project;
  milestones: Array<Milestone & { issues: Issue[] }>;
}> {
  // Validate with Zod
  const validatedData = CreateRoadmapSchema.parse(data);
  // ... implementation
}
```

## Module Design

**Exports:**
- Named exports preferred over default exports
- Re-exports for error types: `export { ResourceNotFoundError };`
- Type exports alongside implementations

**Classes:**
- One class per file (matches filename)
- Singleton pattern for services: `AIServiceFactory.getInstance()`
- Factory pattern for repositories: `GitHubRepositoryFactory`

**Barrel Files:**
- Not used; import directly from source files

## Validation

**Framework:** Zod (`zod` package)

**Pattern:**
```typescript
const createProjectSchema = z.object({
  title: z.string().min(1, "Project title is required"),
  shortDescription: z.string().optional(),
  owner: z.string().min(1, "Project owner is required"),
  visibility: z.enum(["private", "public"]).default("private"),
});

export type CreateProjectArgs = z.infer<typeof createProjectSchema>;
```

**Validation in Services:**
```typescript
const validatedData = CreateRoadmapSchema.parse(data);
```

## Async Patterns

**Promises:**
- Always use `async/await` syntax
- Never use raw `.then()` chains
- Concurrent operations with `Promise.all()`

**Error Handling:**
- Wrap async operations in try-catch
- Return error responses rather than throwing in tool handlers

---

*Convention analysis: 2026-01-29*
