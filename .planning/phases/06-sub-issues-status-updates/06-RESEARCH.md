# Phase 6: Sub-issues and Status Updates - Research

**Researched:** 2026-01-31
**Domain:** GitHub GraphQL API for sub-issues and project status updates
**Confidence:** HIGH

## Summary

This phase implements 8 new MCP tools for managing GitHub sub-issue hierarchies and project status updates. The GitHub GraphQL API provides native support for both features through dedicated mutations and query fields. Sub-issues use a parent-child relationship model with mutations for adding, removing, and reprioritizing. Project status updates are managed through the ProjectV2StatusUpdate object with CRUD operations.

Key findings:
- Sub-issues require the `GraphQL-Features: sub_issues` header for all API calls
- GitHub enforces max depth of 8 levels (not 3 as initially thought) and max 100 sub-issues per parent
- Project status updates use a 5-value enum: ON_TRACK, AT_RISK, OFF_TRACK, COMPLETE, INACTIVE
- Both features use standard GraphQL pagination patterns with cursor-based navigation

**Primary recommendation:** Extend the existing BaseGitHubRepository with a new method that supports custom headers for sub-issue operations, and create two new services (GitHubSubIssueService and GitHubStatusUpdateService) that wrap the GraphQL mutations/queries.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @octokit/graphql | ^8.x | GraphQL API client | Already in use, supports custom headers |
| zod | ^3.x | Schema validation | Existing validation pattern in codebase |
| tsyringe | ^4.x | Dependency injection | Used for service wiring in container.ts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod-to-json-schema | existing | Convert Zod to JSON Schema | For MCP tool outputSchema |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom GraphQL header handling | octokit/graphql plugins | Extra dependency, plugin pattern adds complexity for simple header addition |
| New services | Extend existing SubIssueService/ProjectStatusService | Current services don't match GitHub's API; cleaner to separate concerns |

**Installation:**
No new packages needed - all required dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── services/
│   ├── SubIssueService.ts           # Rename to IssueHierarchyService (?)
│   └── ProjectStatusService.ts      # Rename to ProjectStatusUpdateService (?)
├── infrastructure/
│   ├── github/
│   │   └── repositories/
│   │       ├── GitHubSubIssueRepository.ts    # NEW: Sub-issue GraphQL operations
│   │       └── GitHubStatusUpdateRepository.ts # NEW: Status update GraphQL operations
│   └── tools/
│       ├── schemas/
│       │   └── sub-issue-schemas.ts           # NEW: Zod schemas for tools
│       └── ToolSchemas.ts                     # Extend with new tool definitions
```

### Pattern 1: GraphQL with Custom Headers

**What:** The sub-issues API requires a preview header `GraphQL-Features: sub_issues`
**When to use:** All sub-issue mutations and queries
**Example:**
```typescript
// Source: GitHub Sub-issues Documentation
protected async graphqlWithFeatures<T>(
  query: string,
  variables: Record<string, unknown> = {},
  features: string[] = []
): Promise<T> {
  return this.withRetry(
    () =>
      this.octokit.graphql<T>(query, {
        ...variables,
        owner: this.owner,
        repo: this.repo,
        headers: features.length > 0 ? {
          'GraphQL-Features': features.join(',')
        } : undefined,
      }),
    'executing GraphQL query with features'
  );
}
```

### Pattern 2: Flat List with Parent Reference

**What:** Return sub-issues as flat list with `parentIssueId` field rather than nested tree
**When to use:** All list operations that involve hierarchies
**Example:**
```typescript
// Response structure for list_sub_issues
interface SubIssueListItem {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  parentIssueId: string;
  depth: number;       // 1 = direct child, 2 = grandchild, etc.
  position: number;    // Order within parent's sub-issues
  url: string;
}
```

### Pattern 3: Tool Definition with Annotations

**What:** Follow existing MCP tool pattern from Phase 2
**When to use:** All 8 new tools
**Example:**
```typescript
// Source: Existing ToolSchemas.ts pattern
export const addSubIssueTool: ToolDefinition<AddSubIssueArgs, SubIssueOutput> = {
  name: "add_sub_issue",
  title: "Add Sub-Issue",
  description: "Adds an existing issue as a sub-issue of a parent issue",
  schema: addSubIssueSchema,
  outputSchema: SubIssueOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [...]
};
```

### Anti-Patterns to Avoid

- **Nested tree structures:** Don't return deeply nested objects; use flat lists with references
- **Ignoring depth limits:** Always validate hierarchy depth before operations
- **Missing preview header:** Sub-issue API calls will fail without `GraphQL-Features: sub_issues`
- **Circular reference checks in app code:** Let GitHub API handle cycle detection

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circular reference detection | Custom graph traversal | GitHub API rejection | API already validates and rejects cycles |
| Depth calculation | Manual tree walking | Query `parent` recursively or store depth | GitHub tracks depth internally |
| Position management | Custom ordering logic | `reprioritizeSubIssue` mutation | API handles reordering atomically |
| Status enum mapping | String matching | Zod enum with exact GitHub values | Type safety and validation |

**Key insight:** GitHub's GraphQL API handles the complex cases (cycles, ordering, depth limits) - trust the API errors and surface them with clear MCP error codes.

## Common Pitfalls

### Pitfall 1: Missing Preview Header

**What goes wrong:** All sub-issue GraphQL calls return errors about unknown fields/mutations
**Why it happens:** Sub-issues are still using preview header requirement
**How to avoid:** Create a dedicated method in BaseGitHubRepository that always includes the header
**Warning signs:** "Field 'subIssues' doesn't exist on type 'Issue'" errors

### Pitfall 2: Confusing Issue ID vs Issue Number

**What goes wrong:** Mutations fail with "not found" errors
**Why it happens:** GraphQL mutations use internal node IDs (e.g., `I_kwDO...`), not issue numbers
**How to avoid:** Always resolve issue numbers to node IDs first using a query
**Warning signs:** 404-style errors when you know the issue exists

### Pitfall 3: Max Depth Exceeded

**What goes wrong:** `addSubIssue` mutation fails when adding to deeply nested issues
**Why it happens:** GitHub enforces max depth of 8 levels
**How to avoid:** Query current depth before adding; return clear error message with depth info
**Warning signs:** API error about maximum nesting depth

### Pitfall 4: Status Enum Mismatch

**What goes wrong:** Status update creation fails with validation error
**Why it happens:** Using wrong enum values (e.g., `on_track` instead of `ON_TRACK`)
**How to avoid:** Use exact GitHub enum values: `ON_TRACK`, `AT_RISK`, `OFF_TRACK`, `COMPLETE`, `INACTIVE`
**Warning signs:** "Invalid value for status" errors

### Pitfall 5: Replace Parent Flag Ignored

**What goes wrong:** Adding sub-issue fails when issue already has a parent
**Why it happens:** Each issue can only have one parent; need `replaceParent: true` to reassign
**How to avoid:** Decide on default behavior (reject vs replace) and document clearly
**Warning signs:** "Issue already has a parent" errors

## Code Examples

Verified patterns from official sources:

### Add Sub-Issue Mutation

```typescript
// Source: GitHub GraphQL Mutations Reference
const ADD_SUB_ISSUE_MUTATION = `
  mutation AddSubIssue($input: AddSubIssueInput!) {
    addSubIssue(input: $input) {
      issue {
        id
        title
      }
      subIssue {
        id
        number
        title
        state
      }
    }
  }
`;

// Usage
const result = await this.graphqlWithFeatures<AddSubIssueResponse>(
  ADD_SUB_ISSUE_MUTATION,
  {
    input: {
      issueId: parentIssueNodeId,  // Node ID, not issue number
      subIssueId: childIssueNodeId,
      replaceParent: false,  // Fail if child already has parent
    }
  },
  ['sub_issues']
);
```

### Query Sub-Issues with Pagination

```typescript
// Source: GitHub GraphQL Reference - Issue object
const LIST_SUB_ISSUES_QUERY = `
  query ListSubIssues($issueId: ID!, $first: Int!, $after: String) {
    node(id: $issueId) {
      ... on Issue {
        subIssues(first: $first, after: $after) {
          nodes {
            id
            number
            title
            state
            url
          }
          pageInfo {
            hasNextPage
            endCursor
          }
          totalCount
        }
        subIssuesSummary {
          total
          completed
          percentCompleted
        }
      }
    }
  }
`;
```

### Get Parent Issue

```typescript
// Source: GitHub GraphQL Reference - Issue object
const GET_PARENT_QUERY = `
  query GetParentIssue($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        parent {
          id
          number
          title
          state
          url
        }
      }
    }
  }
`;
```

### Reprioritize Sub-Issue

```typescript
// Source: GitHub GraphQL Mutations Reference
const REPRIORITIZE_MUTATION = `
  mutation ReprioritizeSubIssue($input: ReprioritizeSubIssueInput!) {
    reprioritizeSubIssue(input: $input) {
      subIssue {
        id
        title
      }
    }
  }
`;

// Move subIssue to position after another sub-issue
const result = await this.graphqlWithFeatures<ReprioritizeResponse>(
  REPRIORITIZE_MUTATION,
  {
    input: {
      issueId: parentIssueNodeId,
      subIssueId: targetSubIssueNodeId,
      afterId: precedingSubIssueNodeId, // null = move to beginning
    }
  },
  ['sub_issues']
);
```

### Create Project Status Update

```typescript
// Source: GitHub Changelog 2024-06-27
const CREATE_STATUS_UPDATE_MUTATION = `
  mutation CreateProjectV2StatusUpdate($input: CreateProjectV2StatusUpdateInput!) {
    createProjectV2StatusUpdate(input: $input) {
      statusUpdate {
        id
        body
        bodyHTML
        startDate
        targetDate
        status
        createdAt
        creator {
          login
        }
      }
    }
  }
`;

// Usage
const result = await this.graphql<CreateStatusUpdateResponse>(
  CREATE_STATUS_UPDATE_MUTATION,
  {
    input: {
      projectId: projectNodeId,
      body: "Weekly status: All milestones on track",
      status: "ON_TRACK",  // Enum values: ON_TRACK, AT_RISK, OFF_TRACK, COMPLETE, INACTIVE
      startDate: "2026-01-01",
      targetDate: "2026-03-31",
    }
  }
);
```

### List Project Status Updates

```typescript
// Source: GitHub GraphQL Reference - ProjectV2 object
const LIST_STATUS_UPDATES_QUERY = `
  query ListProjectStatusUpdates($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        statusUpdates(first: $first, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
          nodes {
            id
            body
            bodyHTML
            startDate
            targetDate
            status
            createdAt
            creator {
              login
            }
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Labels for hierarchy (depends-on:) | Native sub-issues API | 2024 | Use native API, labels are workaround |
| No status updates | ProjectV2StatusUpdate object | June 2024 | Full CRUD via GraphQL |
| REST API for issues | GraphQL for relationships | 2023+ | GraphQL required for sub-issues |
| Max depth unknown | Max depth: 8 levels | 2024 | Clear limits enforced by API |

**Deprecated/outdated:**
- Label-based dependencies in current SubIssueService should be migrated to native API
- Current ProjectStatusService does project CRUD, not status updates (naming confusion)

## Open Questions

Things that couldn't be fully resolved:

1. **Rename existing services?**
   - What we know: SubIssueService uses label-based dependencies; ProjectStatusService does project CRUD
   - What's unclear: Should we rename to avoid confusion or create new services?
   - Recommendation: Create new GitHubSubIssueRepository and GitHubStatusUpdateRepository; keep services as-is and add new methods that use the repositories

2. **Context file says max depth 3, research found 8**
   - What we know: GitHub docs and community discussions say max depth is 8
   - What's unclear: Whether 3 was a project decision or outdated info
   - Recommendation: Use GitHub's actual limit (8) but document the constraint clearly

3. **INACTIVE status not in context decisions**
   - What we know: GitHub enum has 5 values including INACTIVE
   - What's unclear: Context only lists 4 values (on_track, at_risk, off_track, complete)
   - Recommendation: Include all 5 enum values for completeness

4. **Node ID resolution strategy**
   - What we know: GraphQL mutations require node IDs, not issue numbers
   - What's unclear: Best pattern for ID resolution (separate query vs cached lookup)
   - Recommendation: Add helper method to resolve issue number to node ID; consider caching

## Sources

### Primary (HIGH confidence)
- [GitHub GraphQL Mutations Reference](https://docs.github.com/en/graphql/reference/mutations) - addSubIssue, removeSubIssue, reprioritizeSubIssue, createProjectV2StatusUpdate, updateProjectV2StatusUpdate, deleteProjectV2StatusUpdate
- [GitHub GraphQL Input Objects Reference](https://docs.github.com/en/graphql/reference/input-objects) - AddSubIssueInput, CreateProjectV2StatusUpdateInput
- [GitHub GraphQL Enums Reference](https://docs.github.com/en/graphql/reference/enums) - ProjectV2StatusUpdateStatus enum values
- [GitHub Changelog 2024-06-27](https://github.blog/changelog/2024-06-27-github-issues-projects-graphql-and-webhook-support-for-project-status-updates-and-more/) - Status updates GraphQL support announcement

### Secondary (MEDIUM confidence)
- [Sub-issues Public Preview Discussion](https://github.com/orgs/community/discussions/148714) - Max depth 8, max 100 per parent, mutation parameters
- [Jesse Houwing Blog: Create GitHub issue hierarchy](https://jessehouwing.net/create-github-issue-hierarchy-using-the-api/) - GraphQL-Features header requirement, addSubIssue example

### Tertiary (LOW confidence)
- None - all findings verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing dependencies, verified patterns
- Architecture: HIGH - Following established repository/service patterns in codebase
- Pitfalls: HIGH - Common issues documented in GitHub community discussions and verified

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (GitHub APIs are stable; sub-issues may exit preview)

---

## Tool Requirements Matrix

For reference during planning, mapping requirements to implementation:

| Requirement | Tool Name | GraphQL Operation | Annotation Pattern |
|-------------|-----------|-------------------|-------------------|
| GHAPI-01 | add_sub_issue | addSubIssue mutation | updateIdempotent |
| GHAPI-02 | list_sub_issues | subIssues connection query | readOnly |
| GHAPI-03 | get_parent_issue | parent field query | readOnly |
| GHAPI-04 | reprioritize_sub_issue | reprioritizeSubIssue mutation | updateIdempotent |
| GHAPI-05 | remove_sub_issue | removeSubIssue mutation | delete (destructiveHint) |
| GHAPI-06 | create_status_update | createProjectV2StatusUpdate mutation | create |
| GHAPI-07 | list_status_updates | statusUpdates connection query | readOnly |
| GHAPI-08 | get_status_update | node query by ID | readOnly |
