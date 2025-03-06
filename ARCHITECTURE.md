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
│   ├── types.ts
│   ├── errors.ts
│   ├── mcp-types.ts
│   └── resource-types.ts
├── infrastructure/   # GitHub API integration
│   ├── github/
│   │   ├── repositories/
│   │   │   ├── BaseGitHubRepository.ts
│   │   │   ├── GitHubIssueRepository.ts
│   │   │   └── ...
│   │   ├── GitHubConfig.ts
│   │   ├── GitHubErrorHandler.ts
│   │   ├── GitHubRepositoryFactory.ts
│   │   ├── graphql-types.ts
│   │   └── rest-types.ts
│   ├── mcp/
│   │   ├── MCPErrorHandler.ts
│   │   └── MCPResponseFormatter.ts
│   └── cache/
│       └── ResourceCache.ts
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

## Key Features and Patterns

### Error Handling System
```typescript
// Standardized error handling across the application
class GitHubErrorHandler {
  static handleError(error: unknown, context: string): Error {
    // Maps GitHub API errors to domain errors
    if (error instanceof RequestError) {
      return this.mapRequestError(error, context);
    }
    // ... other error handling logic
  }

  static shouldRetry(error: unknown): boolean {
    // Determines if operation should be retried
    if (error instanceof RequestError) {
      return error.status === 429 || error.status >= 500;
    }
    return false;
  }
}
```

### Resource Management
```typescript
// Base repository with shared functionality
abstract class BaseGitHubRepository<T extends Resource> {
  // Retry mechanism with exponential backoff
  private retryAttempts = 3;
  private retryDelay = 1000;

  protected async executeOperation<R>(
    operation: () => Promise<R>,
    context: string
  ): Promise<R> {
    let attempt = 0;
    while (attempt < this.retryAttempts) {
      try {
        return await operation();
      } catch (error) {
        // Retry logic with exponential backoff
      }
    }
  }

  // Generic CRUD operations
  protected async createResource<D>(
    endpoint: string,
    data: D,
    mapFn: (response: any) => T
  ): Promise<T> {
    // ... implementation
  }
}
```

### Response Formatting
```typescript
// Consistent MCP response formatting
class MCPResponseFormatter {
  static format(data: unknown, contentType: MCPContentType = MCPContentType.JSON): MCPResponse {
    return {
      content: [{
        type: this.getTypeFromContentType(contentType),
        text: this.formatContent(data, contentType),
        contentType,
      }],
      metadata: {
        timestamp: new Date().toISOString(),
        status: 200,
      },
    };
  }
}
```

### Type Safety and Validation
```typescript
// Runtime type validation with Zod
const ResourceSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ResourceType),
  version: z.number(),
  status: z.nativeEnum(ResourceStatus),
  // ... other fields
});

// Type guard functions
export const isResource = (value: unknown): value is Resource => {
  return ResourceSchema.safeParse(value).success;
};
```

## Recent Improvements

1. Enhanced Error Handling
- Added consistent error mapping across repositories
- Implemented retry mechanism with exponential backoff
- Added detailed error context and validation
- Proper rate limit handling

2. Resource Management
- Created BaseGitHubRepository for shared functionality
- Added optimistic locking support
- Implemented proper request retries
- Added validation for required fields

3. Response Formatting
- Standardized MCP response structure
- Added support for multiple content types
- Improved error response formatting
- Added pagination support

4. Type Safety
- Added comprehensive type definitions
- Implemented runtime type validation
- Added proper type guards
- Improved null safety

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