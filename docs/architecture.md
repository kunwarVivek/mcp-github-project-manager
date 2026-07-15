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
| `tools/` | MCP tool definitions (120 tools) |
| `cache/` | In-memory caching with TTL |
| `resilience/` | Circuit breaker, retry policies |
| `events/` | Webhook handling, event store |
| `health/` | Health check endpoints |

### Service Layer (`src/services/`)

Business logic coordination. `ProjectManagementService` is a thin facade that
delegates to focused, independently-testable services:

| Service | Responsibility |
|---------|----------------|
| `ProjectManagementService` | Facade — delegates to the services below |
| `IssueService` | Issue CRUD, comments, Projects v2 draft issues |
| `MilestoneService` | Milestone CRUD and metrics |
| `SprintPlanningService` | Sprint planning and capacity |
| `RoadmapService` | Full-roadmap creation (project + milestones + issues) |
| `RoadmapPlanningService` | AI roadmap/milestone planning |
| `ProjectStatusService` | Project CRUD |
| `ProjectTemplateService` | Template + field/view management |
| `ProjectLinkingService` | Project item / repo / team linking |
| `ProjectAutomationService` | Automation-rule management |
| `SubIssueService` | Hierarchical issue dependencies |
| `PRDGenerationService` | AI-powered PRD generation |
| `TaskGenerationService` | Task breakdown and estimation |
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
| `GOOGLE_API_KEY` | Google AI (optional) |
| `SECRETS_DIR` | Load any secret from a mounted file (Docker/k8s); precedes env vars |
| `WEBHOOK_SECRET` / `WEBHOOK_ALLOW_UNSIGNED` | Webhook HMAC secret; validation fails closed |
| `MAX_CACHE_ENTRIES` | In-memory cache cap before eviction |

Secrets resolve through `src/infrastructure/secrets/SecretProvider` (env + file
providers; Vault/AWS SM are an extension point).

See [CONFIGURATION.md](CONFIGURATION.md) for full details.
