# Architecture

MCP GitHub Project Manager follows Clean Architecture principles with clear separation of concerns.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Layer                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Tool Defs   │  │ Resources   │  │ Request Handling    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ ProjectMgmt     │  │ AI Services     │  │ Planning    │  │
│  │ Service         │  │ (PRD, Tasks)    │  │ Services    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                 Infrastructure Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ GitHub API  │  │ Caching     │  │ Resilience          │  │
│  │ Repositories│  │ & Events    │  │ (Circuit Breaker)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Domain Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Entities    │  │ Interfaces  │  │ Zod Schemas         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Layer Structure

### Domain Layer (`src/domain/`)

Core business entities and type definitions:

| File | Purpose |
|------|---------|
| `types.ts` | Core project, issue, milestone types |
| `ai-types.ts` | AI task generation and PRD types |
| `resource-schemas.ts` | Zod schemas for validation |
| `errors.ts` | Domain-specific error types |

### Infrastructure Layer (`src/infrastructure/`)

External integrations and technical concerns:

| Directory | Purpose |
|-----------|---------|
| `github/` | GitHub REST/GraphQL API integration |
| `tools/` | MCP tool definitions (116 tools) |
| `cache/` | In-memory caching with TTL |
| `resilience/` | Circuit breaker, retry policies |
| `events/` | Webhook handling, event store |
| `health/` | Health check endpoints |

### Service Layer (`src/services/`)

Business logic coordination (17 services):

| Service | Responsibility |
|---------|----------------|
| `ProjectManagementService` | Central orchestrator for project operations |
| `PRDGenerationService` | AI-powered PRD generation |
| `TaskGenerationService` | Task breakdown and estimation |
| `SprintPlanningService` | Sprint planning and capacity |
| `RoadmapPlanningService` | Milestone and roadmap planning |
| `SubIssueService` | Hierarchical issue management |
| `ProjectTemplateService` | Template management |
| `IssueTriagingService` | AI-powered issue triage |

### MCP Layer (`src/index.ts`)

Model Context Protocol integration:
- Tool registration and execution
- Resource exposure
- Request/response handling
- Error formatting

## Key Patterns

### Dependency Injection

Uses `tsyringe` for IoC:

```typescript
// src/container.ts
container.register("ProjectManagementService", {
  useFactory: (c) => new ProjectManagementService(
    c.resolve("GitHubProjectRepository"),
    c.resolve("GitHubIssueRepository"),
    // ...
  )
});
```

### Repository Pattern

Abstracts data access:

```typescript
// Domain interface
interface IProjectRepository {
  findById(id: string): Promise<Project>;
  save(project: Project): Promise<void>;
}

// Infrastructure implementation
class GitHubProjectRepository implements IProjectRepository {
  // GitHub API calls
}
```

### Circuit Breaker

Resilience for external APIs:

```typescript
// Wraps GitHub API calls
const result = await circuitBreaker.execute(() =>
  this.octokit.projects.get({ project_id })
);
```

## Data Flow

```
MCP Client Request
       │
       ▼
┌─────────────────┐
│  Tool Handler   │  ← Validates input with Zod
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Service      │  ← Business logic
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Repository     │  ← Data access abstraction
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GitHub API     │  ← REST/GraphQL calls
└─────────────────┘
```

## AI Integration

Multi-provider AI support:

```
┌─────────────────────────────────────┐
│         AIServiceFactory            │
├─────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌───────┐ │
│  │Anthropic│ │ OpenAI  │ │Google │ │
│  └─────────┘ └─────────┘ └───────┘ │
└─────────────────────────────────────┘
```

Used for:
- PRD generation and enhancement
- Task complexity analysis
- Issue enrichment and triage
- Label suggestions
- Duplicate detection

## Configuration

Environment-based configuration:

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | GitHub API authentication |
| `GITHUB_OWNER` | Repository owner |
| `GITHUB_REPO` | Repository name |
| `ANTHROPIC_API_KEY` | Claude AI (optional) |
| `OPENAI_API_KEY` | OpenAI (optional) |
| `GOOGLE_AI_API_KEY` | Google AI (optional) |

See [CONFIGURATION.md](CONFIGURATION.md) for full details.
