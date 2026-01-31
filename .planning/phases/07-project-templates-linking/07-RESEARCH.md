# Phase 7: Project Templates and Linking - Research

**Researched:** 2026-01-31
**Domain:** GitHub GraphQL API for project templates and repository/team linking
**Confidence:** HIGH

## Summary

This phase implements 10 new MCP tools for managing GitHub ProjectV2 templates and linking projects to repositories and teams. The GitHub GraphQL API provides native support for both features through dedicated mutations and query connections. Template operations use the `markProjectV2AsTemplate`, `unmarkProjectV2AsTemplate`, and `copyProjectV2` mutations. Linking operations use `linkProjectV2ToRepository`, `unlinkProjectV2FromRepository`, `linkProjectV2ToTeam`, and `unlinkProjectV2FromTeam` mutations.

Key findings:
- Template operations are organization-only (only org projects can be templates)
- `copyProjectV2` copies views, custom fields, draft issues, workflows (except auto-add), and insights
- ProjectV2 has `repositories` and `teams` connections for querying linked entities
- There is no dedicated `projectTemplates` connection on Organization; must filter by `isTemplate` field
- Linking operations use node IDs (project ID + repository/team ID)

**Primary recommendation:** Follow Phase 6 patterns exactly - create new schemas file (`project-template-linking-schemas.ts`), new tools file (`project-template-linking-tools.ts`), and potentially extend GitHubProjectRepository or use factory.graphql() directly for GraphQL operations.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @octokit/graphql | ^8.x | GraphQL API client | Already in use, supports all required mutations |
| zod | ^3.x | Schema validation | Existing validation pattern in codebase |
| tsyringe | ^4.x | Dependency injection | Used for service wiring in container.ts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod-to-json-schema | existing | Convert Zod to JSON Schema | For MCP tool outputSchema |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New repository class | Extend GitHubProjectRepository | Project repository already handles project CRUD; templates/linking are project operations |
| Separate service layer | Direct executor pattern | Phase 6 uses direct executors in tools file; simpler for straightforward mutations |

**Installation:**
No new packages needed - all required dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── infrastructure/
│   └── tools/
│       ├── schemas/
│       │   └── project-template-linking-schemas.ts   # NEW: Zod schemas for 10 tools
│       ├── project-template-linking-tools.ts         # NEW: Tool definitions and executors
│       ├── ToolSchemas.ts                            # Extend with imports/exports
│       └── ToolRegistry.ts                           # Register 10 new tools
```

### Pattern 1: Organization-Level Operations

**What:** Template operations (mark/unmark) only work on organization-owned projects
**When to use:** All template marking operations
**Example:**
```typescript
// Source: GitHub GraphQL Mutations Reference
const MARK_AS_TEMPLATE_MUTATION = `
  mutation MarkProjectV2AsTemplate($input: MarkProjectV2AsTemplateInput!) {
    markProjectV2AsTemplate(input: $input) {
      projectV2 {
        id
        title
        isTemplate
      }
    }
  }
`;
```

### Pattern 2: Copy Project with Options

**What:** `copyProjectV2` requires owner ID, source project ID, and title; optionally includes draft issues
**When to use:** Creating new project from template
**Example:**
```typescript
// Source: GitHub GraphQL Input Objects Reference
const COPY_PROJECT_MUTATION = `
  mutation CopyProjectV2($input: CopyProjectV2Input!) {
    copyProjectV2(input: $input) {
      projectV2 {
        id
        title
        url
        createdAt
      }
    }
  }
`;

// CopyProjectV2Input fields:
// - ownerId: ID! (organization or user to create project under)
// - projectId: ID! (source project to copy)
// - title: String! (new project title)
// - includeDraftIssues: Boolean (optional, include draft issues)
```

### Pattern 3: Link/Unlink Operations

**What:** Linking requires project ID and target entity ID (repository or team)
**When to use:** All linking/unlinking operations
**Example:**
```typescript
// Source: GitHub GraphQL Mutations Reference
const LINK_TO_REPOSITORY_MUTATION = `
  mutation LinkProjectV2ToRepository($input: LinkProjectV2ToRepositoryInput!) {
    linkProjectV2ToRepository(input: $input) {
      repository {
        id
        name
        nameWithOwner
      }
    }
  }
`;

// LinkProjectV2ToRepositoryInput fields:
// - projectId: ID! (project to link)
// - repositoryId: ID! (repository to link)
```

### Pattern 4: Query Linked Entities

**What:** ProjectV2 has `repositories` and `teams` connections for querying linked entities
**When to use:** List linked repositories/teams operations
**Example:**
```typescript
// Source: GitHub Community Discussion #169519
const LIST_LINKED_REPOSITORIES_QUERY = `
  query ListLinkedRepositories($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        repositories(first: $first, after: $after) {
          nodes {
            id
            name
            nameWithOwner
            url
          }
          pageInfo {
            hasNextPage
            endCursor
          }
          totalCount
        }
      }
    }
  }
`;
```

### Pattern 5: List Templates via Filter

**What:** No dedicated templates connection; filter projectsV2 by isTemplate field
**When to use:** List organization templates operation
**Example:**
```typescript
// Source: GitHub GraphQL Objects Reference (inferred from isTemplate field)
const LIST_ORG_TEMPLATES_QUERY = `
  query ListOrganizationTemplates($orgLogin: String!, $first: Int!, $after: String) {
    organization(login: $orgLogin) {
      projectsV2(first: $first, after: $after) {
        nodes {
          id
          title
          shortDescription
          url
          isTemplate
          createdAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  }
`;

// Filter in application code: nodes.filter(p => p.isTemplate)
```

### Anti-Patterns to Avoid

- **User project templates:** Don't try to mark user-owned projects as templates (org-only feature)
- **Linking non-org projects:** Linking to repos/teams may have restrictions on user-owned projects
- **Missing node ID resolution:** Always work with node IDs; may need to resolve org/repo names to IDs first
- **Ignoring pagination:** Linked repos/teams can be numerous; always support pagination

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template discovery | Custom search | Filter projectsV2 by isTemplate | API doesn't expose dedicated endpoint |
| Permission validation | Pre-check logic | GitHub API errors | API validates org-only, permissions |
| Copy completeness | Selective copy | copyProjectV2 mutation | Handles views, fields, workflows atomically |
| Link validation | Pre-check entity exists | API errors | API validates repo/team existence and permissions |

**Key insight:** GitHub's GraphQL API handles validation for permissions, org-only restrictions, and entity existence - surface API errors with clear MCP error codes.

## Common Pitfalls

### Pitfall 1: User Projects Cannot Be Templates

**What goes wrong:** `markProjectV2AsTemplate` fails on user-owned projects
**Why it happens:** GitHub only allows organization projects to be templates
**How to avoid:** Validate project owner is organization before attempting to mark as template, or surface clear error
**Warning signs:** Error message about "only organization projects can be templates"

### Pitfall 2: Copy Permission Requirements

**What goes wrong:** `copyProjectV2` fails with permission errors
**Why it happens:** User must have access to both source project and destination owner
**How to avoid:** Document permission requirements; let API error propagate with clear message
**Warning signs:** "Could not resolve to Project node" or permission-related errors

### Pitfall 3: Missing Organization Node ID

**What goes wrong:** `copyProjectV2` requires owner ID but user provides org login
**Why it happens:** CopyProjectV2Input.ownerId requires node ID, not login string
**How to avoid:** Provide helper to resolve org login to node ID, or accept nodeId directly
**Warning signs:** "Invalid ID" errors when passing organization login

### Pitfall 4: No Dedicated Templates Query

**What goes wrong:** Looking for `projectTemplates` connection that doesn't exist
**Why it happens:** Assuming dedicated API endpoint for templates
**How to avoid:** Query `projectsV2` and filter by `isTemplate` field client-side
**Warning signs:** "Field doesn't exist" errors

### Pitfall 5: Teams Connection May Require Permissions

**What goes wrong:** `teams` connection returns empty or errors
**Why it happens:** Querying team links may require specific org permissions
**How to avoid:** Handle empty results gracefully; document permission requirements
**Warning signs:** Empty results when teams are known to be linked

## Code Examples

Verified patterns from official sources:

### Mark Project as Template

```typescript
// Source: GitHub GraphQL Mutations Reference
const MARK_AS_TEMPLATE_MUTATION = `
  mutation MarkProjectV2AsTemplate($input: MarkProjectV2AsTemplateInput!) {
    markProjectV2AsTemplate(input: $input) {
      projectV2 {
        id
        title
        isTemplate
      }
    }
  }
`;

// Usage
const result = await factory.graphql<MarkAsTemplateResponse>(
  MARK_AS_TEMPLATE_MUTATION,
  {
    input: {
      projectId: projectNodeId,  // e.g., "PVT_kwDO..."
    }
  }
);
```

### Unmark Project as Template

```typescript
// Source: GitHub GraphQL Mutations Reference
const UNMARK_AS_TEMPLATE_MUTATION = `
  mutation UnmarkProjectV2AsTemplate($input: UnmarkProjectV2AsTemplateInput!) {
    unmarkProjectV2AsTemplate(input: $input) {
      projectV2 {
        id
        title
        isTemplate
      }
    }
  }
`;
```

### Copy Project from Template

```typescript
// Source: GitHub GraphQL Input Objects Reference
const COPY_PROJECT_MUTATION = `
  mutation CopyProjectV2($input: CopyProjectV2Input!) {
    copyProjectV2(input: $input) {
      projectV2 {
        id
        title
        number
        url
        shortDescription
        createdAt
      }
    }
  }
`;

// Usage
const result = await factory.graphql<CopyProjectResponse>(
  COPY_PROJECT_MUTATION,
  {
    input: {
      ownerId: targetOrgNodeId,      // Organization to create under
      projectId: templateProjectId,   // Source template project
      title: "My New Project",
      includeDraftIssues: true,       // Optional
    }
  }
);
```

### Link Project to Repository

```typescript
// Source: GitHub GraphQL Mutations Reference
const LINK_TO_REPOSITORY_MUTATION = `
  mutation LinkProjectV2ToRepository($input: LinkProjectV2ToRepositoryInput!) {
    linkProjectV2ToRepository(input: $input) {
      repository {
        id
        name
        nameWithOwner
        url
      }
    }
  }
`;

// Usage
const result = await factory.graphql<LinkToRepoResponse>(
  LINK_TO_REPOSITORY_MUTATION,
  {
    input: {
      projectId: projectNodeId,
      repositoryId: repoNodeId,
    }
  }
);
```

### Unlink Project from Repository

```typescript
// Source: GitHub GraphQL Mutations Reference
const UNLINK_FROM_REPOSITORY_MUTATION = `
  mutation UnlinkProjectV2FromRepository($input: UnlinkProjectV2FromRepositoryInput!) {
    unlinkProjectV2FromRepository(input: $input) {
      repository {
        id
      }
    }
  }
`;
```

### Link Project to Team

```typescript
// Source: GitHub GraphQL Mutations Reference
const LINK_TO_TEAM_MUTATION = `
  mutation LinkProjectV2ToTeam($input: LinkProjectV2ToTeamInput!) {
    linkProjectV2ToTeam(input: $input) {
      team {
        id
        name
        slug
      }
    }
  }
`;
```

### Unlink Project from Team

```typescript
// Source: GitHub GraphQL Mutations Reference
const UNLINK_FROM_TEAM_MUTATION = `
  mutation UnlinkProjectV2FromTeam($input: UnlinkProjectV2FromTeamInput!) {
    unlinkProjectV2FromTeam(input: $input) {
      team {
        id
      }
    }
  }
`;
```

### List Linked Repositories

```typescript
// Source: GitHub Community Discussion #169519
const LIST_LINKED_REPOSITORIES_QUERY = `
  query ListLinkedRepositories($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        repositories(first: $first, after: $after) {
          nodes {
            id
            name
            nameWithOwner
            url
            description
          }
          pageInfo {
            hasNextPage
            endCursor
          }
          totalCount
        }
      }
    }
  }
`;
```

### List Linked Teams

```typescript
// Source: GitHub Community Discussion #131414
const LIST_LINKED_TEAMS_QUERY = `
  query ListLinkedTeams($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        teams(first: $first, after: $after) {
          nodes {
            id
            name
            slug
            description
          }
          pageInfo {
            hasNextPage
            endCursor
          }
          totalCount
        }
      }
    }
  }
`;
```

### List Organization Templates

```typescript
// Source: GitHub GraphQL Objects Reference (inferred)
const LIST_ORG_TEMPLATES_QUERY = `
  query ListOrganizationProjectTemplates($orgLogin: String!, $first: Int!, $after: String) {
    organization(login: $orgLogin) {
      projectsV2(first: $first, after: $after) {
        nodes {
          id
          title
          number
          shortDescription
          url
          isTemplate
          createdAt
          updatedAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  }
`;

// Filter client-side
const templates = response.organization.projectsV2.nodes.filter(p => p.isTemplate);
```

### Resolve Organization Node ID

```typescript
// Helper to resolve org login to node ID (needed for copyProjectV2)
const RESOLVE_ORG_ID_QUERY = `
  query ResolveOrganizationId($login: String!) {
    organization(login: $login) {
      id
    }
  }
`;
```

### Resolve Repository Node ID

```typescript
// Helper to resolve repo to node ID (needed for linkProjectV2ToRepository)
const RESOLVE_REPO_ID_QUERY = `
  query ResolveRepositoryId($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
    }
  }
`;
```

### Resolve Team Node ID

```typescript
// Helper to resolve team to node ID (needed for linkProjectV2ToTeam)
const RESOLVE_TEAM_ID_QUERY = `
  query ResolveTeamId($orgLogin: String!, $teamSlug: String!) {
    organization(login: $orgLogin) {
      team(slug: $teamSlug) {
        id
      }
    }
  }
`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual project setup | copyProjectV2 mutation | 2023+ | Automates template copying |
| No template marking | markProjectV2AsTemplate | 2023+ | Enables template workflow |
| REST API linking | GraphQL mutations | 2022+ | Required for ProjectV2 |
| Project boards (classic) | ProjectV2 | 2023+ | Projects classic deprecated |

**Deprecated/outdated:**
- Projects (classic) deprecated with removal date 2025-04-01 UTC
- `linkRepositoryToProject` mutation doesn't support ProjectV2 (use `linkProjectV2ToRepository`)

## Open Questions

Things that couldn't be fully resolved:

1. **Teams connection availability**
   - What we know: Community discussion shows `teams` connection exists on ProjectV2
   - What's unclear: Exact fields available, permission requirements
   - Recommendation: Test with introspection; handle empty results gracefully

2. **isTemplate field filtering**
   - What we know: ProjectV2 has `isTemplate` boolean field
   - What's unclear: Whether API supports server-side filtering by isTemplate
   - Recommendation: Query all projects, filter client-side for templates

3. **Org ID resolution for copyProjectV2**
   - What we know: CopyProjectV2Input.ownerId requires node ID
   - What's unclear: Best UX - require node ID or resolve from login?
   - Recommendation: Accept org login, resolve to ID internally for better UX

4. **Permission model for linking**
   - What we know: Linking requires access to both project and target entity
   - What's unclear: Exact permission levels required (read/write/admin)
   - Recommendation: Let API errors surface; document permission requirements

## Sources

### Primary (HIGH confidence)
- [GitHub GraphQL Mutations Reference](https://docs.github.com/en/graphql/reference/mutations) - copyProjectV2, markProjectV2AsTemplate, unmarkProjectV2AsTemplate, linkProjectV2ToRepository, unlinkProjectV2FromRepository, linkProjectV2ToTeam, unlinkProjectV2FromTeam
- [GitHub GraphQL Input Objects Reference](https://docs.github.com/en/graphql/reference/input-objects) - CopyProjectV2Input, MarkProjectV2AsTemplateInput, LinkProjectV2ToRepositoryInput, LinkProjectV2ToTeamInput
- [Managing Project Templates - GitHub Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-your-project/managing-project-templates-in-your-organization) - Template behavior, what gets copied

### Secondary (MEDIUM confidence)
- [GitHub Community Discussion #169519](https://github.com/orgs/community/discussions/169519) - repositories connection on ProjectV2
- [GitHub Community Discussion #131414](https://github.com/orgs/community/discussions/131414) - teams connection on ProjectV2
- [GitHub Community Discussion #35073](https://github.com/orgs/community/discussions/35073) - linkRepositoryToProject doesn't support ProjectV2

### Tertiary (LOW confidence)
- None - all findings verified with official sources or community confirmations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing dependencies, verified patterns from Phase 6
- Architecture: HIGH - Following established repository/service patterns in codebase
- Pitfalls: MEDIUM - Some based on community discussions, API behavior needs verification
- GraphQL queries: MEDIUM - Some inferred from community discussions, should verify with introspection

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (GitHub APIs are stable; ProjectV2 is established)

---

## Tool Requirements Matrix

For reference during planning, mapping requirements to implementation:

| Requirement | Tool Name | GraphQL Operation | Annotation Pattern |
|-------------|-----------|-------------------|-------------------|
| GHAPI-09 | mark_project_as_template | markProjectV2AsTemplate mutation | updateIdempotent |
| GHAPI-10 | unmark_project_as_template | unmarkProjectV2AsTemplate mutation | updateIdempotent |
| GHAPI-11 | copy_project_from_template | copyProjectV2 mutation | create |
| GHAPI-12 | list_organization_templates | projectsV2 query + isTemplate filter | readOnly |
| GHAPI-13 | link_project_to_repository | linkProjectV2ToRepository mutation | updateIdempotent |
| GHAPI-14 | unlink_project_from_repository | unlinkProjectV2FromRepository mutation | delete |
| GHAPI-15 | link_project_to_team | linkProjectV2ToTeam mutation | updateIdempotent |
| GHAPI-16 | unlink_project_from_team | unlinkProjectV2FromTeam mutation | delete |
| GHAPI-17 | list_linked_repositories | repositories connection query | readOnly |
| GHAPI-18 | list_linked_teams | teams connection query | readOnly |

## Input Schema Guidance

Based on Phase 6 patterns and API requirements:

### Template Operations (require project node ID)
- `mark_project_as_template`: `{ projectId: string }`
- `unmark_project_as_template`: `{ projectId: string }`
- `copy_project_from_template`: `{ projectId: string, targetOwner: string, title: string, includeDraftIssues?: boolean }`
- `list_organization_templates`: `{ org: string, first?: number, after?: string }`

### Linking Operations (require project + entity IDs)
- `link_project_to_repository`: `{ projectId: string, owner: string, repo: string }`
- `unlink_project_from_repository`: `{ projectId: string, owner: string, repo: string }`
- `link_project_to_team`: `{ projectId: string, org: string, teamSlug: string }`
- `unlink_project_from_team`: `{ projectId: string, org: string, teamSlug: string }`

### List Operations (require project node ID)
- `list_linked_repositories`: `{ projectId: string, first?: number, after?: string }`
- `list_linked_teams`: `{ projectId: string, first?: number, after?: string }`

Note: For better UX, accept human-readable identifiers (org login, repo owner/name, team slug) and resolve to node IDs internally.
