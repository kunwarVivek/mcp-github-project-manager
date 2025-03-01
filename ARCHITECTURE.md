# Architecture Overview

## Core Principles

This project follows Clean Architecture principles with clear separation of concerns and dependencies flowing inward. The architecture is designed to be maintainable, testable, and scalable.

## Layer Structure
The server follows Clean Architecture principles with clear separation of concerns:

- **Domain Layer**: Core business entities and repository interfaces
- **Infrastructure Layer**: GitHub API integration and repository implementations
- **Service Layer**: Business logic and coordination between repositories
- **MCP Layer**: Tool definitions and request handling

### Project Structure
```
src/
├── domain/           # Domain entities and interfaces
│   └── types.ts
├── infrastructure/   # GitHub API integration
│   ├── github/
│   │   ├── repositories/
│   │   ├── GitHubConfig.ts
│   │   ├── GitHubRepositoryFactory.ts
│   │   ├── graphql-types.ts
│   │   └── rest-types.ts
├── services/        # Business logic layer
│   └── ProjectManagementService.ts
└── index.ts         # MCP server implementation
```

### Domain Layer (`src/domain/`)
- Contains core business logic and entities
- Defines interfaces and types
- Pure TypeScript with no external dependencies
- Central source of truth for business rules

### Infrastructure Layer (`src/infrastructure/`)
- Implements external integrations (GitHub API)
- Handles data persistence and retrieval
- Contains concrete implementations of repository interfaces
- Manages API communication and response mapping

### Service Layer (`src/services/`)
- Orchestrates business operations
- Combines multiple repository operations
- Implements business workflows
- Handles transaction boundaries

## Key Design Patterns

### Repository Pattern
- Abstracts data access logic
- Provides consistent interface for data operations
- Enables easy switching of data sources
- Facilitates testing through mocking

### Type-Safe API Integration
- Strong typing for API requests and responses
- Runtime type validation
- Consistent error handling
- Proper mapping between API and domain types

## Testing Strategy

### Unit Tests
- Tests individual components in isolation
- Mocks external dependencies
- Focuses on business logic
- Fast and reliable

### Integration Tests
- Tests component interactions
- Verifies API integration
- Uses test doubles when appropriate
- Validates data flow

### E2E Tests
- Tests complete workflows
- Uses real GitHub API
- Validates system behavior
- Ensures feature completeness

## Areas for Enhancement

### Dependency Injection
```typescript
// Current approach
class ProjectManagementService {
  constructor(owner: string, repo: string, token: string) {
    // Direct instantiation
    this.repository = new GitHubProjectRepository(...);
  }
}

// Recommended approach
interface ProjectManagementDependencies {
  projectRepository: ProjectRepository;
  issueRepository: IssueRepository;
  // ...other dependencies
}

class ProjectManagementService {
  constructor(dependencies: ProjectManagementDependencies) {
    this.projectRepository = dependencies.projectRepository;
  }
}
```

### Caching Layer
```typescript
interface CacheStrategy {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
}

class CachedProjectRepository implements ProjectRepository {
  constructor(
    private repository: ProjectRepository,
    private cache: CacheStrategy
  ) {}

  async findById(id: string): Promise<Project | null> {
    const cached = await this.cache.get(`project:${id}`);
    if (cached) return cached;

    const project = await this.repository.findById(id);
    if (project) {
      await this.cache.set(`project:${id}`, project);
    }
    return project;
  }
}
```

### Logging Infrastructure
```typescript
interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  error(error: Error, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

class ProjectManagementService {
  constructor(
    private dependencies: ProjectManagementDependencies,
    private logger: Logger
  ) {}

  async createProject(data: CreateProjectInput): Promise<Project> {
    this.logger.info('Creating project', { data });
    try {
      const project = await this.dependencies.projectRepository.create(data);
      this.logger.info('Project created', { projectId: project.id });
      return project;
    } catch (error) {
      this.logger.error(error as Error, { data });
      throw error;
    }
  }
}
```

### Rate Limiting
```typescript
class RateLimitedRepository implements ProjectRepository {
  private tokenBucket: TokenBucket;

  constructor(
    private repository: ProjectRepository,
    private rateLimit: number,
    private timePeriod: number
  ) {
    this.tokenBucket = new TokenBucket(rateLimit, timePeriod);
  }

  async findById(id: string): Promise<Project | null> {
    await this.tokenBucket.consume(1);
    return this.repository.findById(id);
  }
}
```

### API Versioning
```typescript
interface ApiVersion {
  version: string;
  handler: typeof ProjectRepository;
}

class VersionedProjectRepository implements ProjectRepository {
  constructor(private versions: ApiVersion[]) {}

  async findById(id: string, version?: string): Promise<Project | null> {
    const handler = this.getVersionHandler(version);
    return handler.findById(id);
  }

  private getVersionHandler(version?: string): typeof ProjectRepository {
    if (!version) {
      return this.versions[this.versions.length - 1].handler;
    }
    const handler = this.versions.find(v => v.version === version);
    if (!handler) {
      throw new Error(`Unsupported API version: ${version}`);
    }
    return handler.handler;
  }
}
```

## Next Steps

1. Implement dependency injection container
2. Add caching layer for frequently accessed data
3. Implement structured logging
4. Add rate limiting with token bucket algorithm
5. Implement API versioning strategy
6. Add metrics collection
7. Implement circuit breaker for API calls
8. Add request tracing

## Decision Records

Architectural decisions should be documented using ADRs (Architecture Decision Records) in the `docs/adr` directory. Each significant architectural decision should be recorded with:

- Context
- Decision
- Consequences
- Status

This helps maintain institutional knowledge and provides rationale for future maintainers.