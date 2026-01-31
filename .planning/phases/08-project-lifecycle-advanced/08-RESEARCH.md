# Phase 8: Project Lifecycle and Advanced Operations - Research

**Researched:** 2026-01-31
**Domain:** GitHub GraphQL API for project lifecycle management and advanced item operations
**Confidence:** HIGH (mutations verified), MEDIUM (filtering limitations discovered)

## Summary

This phase implements 6 MCP tools for GitHub ProjectV2 lifecycle management and advanced item operations. The GitHub GraphQL API provides native support for closing/reopening projects via `updateProjectV2` (with `closed` field), converting draft issues via `convertProjectV2DraftIssueItemToIssue`, and reordering items via `updateProjectV2ItemPosition`. However, **server-side filtering of project items is not currently supported** by the GitHub API - filtering must be done client-side.

Key findings:
- Project close/reopen uses `updateProjectV2` mutation with `closed: Boolean` field
- Draft issue conversion requires `itemId` (the ProjectV2Item ID) and `repositoryId` (target repo)
- Item reordering uses `updateProjectV2ItemPosition` with `projectId`, `itemId`, and optional `afterId`
- GitHub's `search` connection supports advanced query syntax (`ISSUE_ADVANCED` type) with AND/OR operators
- **Critical limitation:** ProjectV2 items API has no server-side filtering; must query all items and filter client-side

**Primary recommendation:** Follow Phase 7 patterns exactly - create new schemas in `schemas/project-lifecycle-schemas.ts`, new tools in `project-lifecycle-tools.ts`. For search/filter tools, use GitHub's `search` connection for issue queries but implement client-side filtering for project items.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @octokit/graphql | ^8.x | GraphQL API client | Already in use, supports all required mutations |
| zod | ^3.x | Schema validation | Existing validation pattern in codebase |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod-to-json-schema | existing | Convert Zod to JSON Schema | For MCP tool outputSchema |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side item filtering | Wait for GitHub API support | No server-side filtering exists; client-side is only option |
| Custom query parser | GitHub search syntax | Use GitHub's native query syntax for consistency |

**Installation:**
No new packages needed - all required dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── infrastructure/
│   └── tools/
│       ├── schemas/
│       │   └── project-lifecycle-schemas.ts    # NEW: Zod schemas for 6 tools
│       ├── project-lifecycle-tools.ts          # NEW: Tool definitions and executors
│       ├── ToolSchemas.ts                      # Extend with imports/exports
│       └── ToolRegistry.ts                     # Register 6 new tools
tests/
└── infrastructure/
    └── tools/
        └── project-lifecycle-tools.test.ts     # NEW: Unit tests
```

### Pattern 1: Close/Reopen Project (GHAPI-19, GHAPI-20)

**What:** Use `updateProjectV2` mutation with `closed` boolean field
**When to use:** Closing or reopening projects
**Example:**
```typescript
// Source: GitHub GraphQL Mutations Reference
const UPDATE_PROJECT_MUTATION = `
  mutation UpdateProjectV2($input: UpdateProjectV2Input!) {
    updateProjectV2(input: $input) {
      projectV2 {
        id
        title
        closed
        url
      }
    }
  }
`;

// Close project
await factory.graphql(UPDATE_PROJECT_MUTATION, {
  input: {
    projectId: "PVT_kwDO...",
    closed: true  // or false to reopen
  }
});
```

**Note:** The `UpdateProjectV2Input` accepts: `projectId` (required), `closed`, `public`, `readme`, `shortDescription`, `title`.

### Pattern 2: Convert Draft Issue to Real Issue (GHAPI-21)

**What:** Use `convertProjectV2DraftIssueItemToIssue` mutation
**When to use:** Converting a draft issue in a project to a real GitHub issue
**Example:**
```typescript
// Source: GitHub GraphQL Mutations Reference
const CONVERT_DRAFT_MUTATION = `
  mutation ConvertProjectV2DraftIssueItemToIssue($input: ConvertProjectV2DraftIssueItemToIssueInput!) {
    convertProjectV2DraftIssueItemToIssue(input: $input) {
      item {
        id
        content {
          ... on Issue {
            id
            number
            title
            url
          }
        }
      }
    }
  }
`;

// Input fields:
// - itemId: ID! (the ProjectV2Item ID of the draft issue)
// - repositoryId: ID! (the target repository to create the issue in)
```

**Important:** The `itemId` is the ProjectV2Item ID (starts with `PVTI_`), not the draft issue content ID. The `repositoryId` must be resolved from owner/repo names.

### Pattern 3: Reorder Items (GHAPI-22)

**What:** Use `updateProjectV2ItemPosition` mutation
**When to use:** Changing the position of an item within a project
**Example:**
```typescript
// Source: GitHub GraphQL Mutations Reference
const UPDATE_ITEM_POSITION_MUTATION = `
  mutation UpdateProjectV2ItemPosition($input: UpdateProjectV2ItemPositionInput!) {
    updateProjectV2ItemPosition(input: $input) {
      items(first: 10) {
        nodes {
          id
        }
      }
    }
  }
`;

// Input fields:
// - projectId: ID! (the project)
// - itemId: ID! (the item to move)
// - afterId: ID (optional - item to place after; omit to move to top)
```

**Note:** If `afterId` is not provided, the item moves to the top (first position). The mutation returns the updated items list from the project.

### Pattern 4: Search Issues with Advanced Query (GHAPI-23)

**What:** Use GitHub's `search` connection with `ISSUE_ADVANCED` type
**When to use:** Searching issues with complex AND/OR queries
**Example:**
```typescript
// Source: GitHub Issues & Projects API Update (March 2025)
const SEARCH_ISSUES_QUERY = `
  query SearchIssues($query: String!, $first: Int!, $after: String) {
    search(query: $query, type: ISSUE_ADVANCED, first: $first, after: $after) {
      issueCount
      nodes {
        ... on Issue {
          id
          number
          title
          state
          labels(first: 10) {
            nodes { name }
          }
          repository {
            nameWithOwner
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Example queries:
// - "is:issue AND repo:owner/repo AND label:bug"
// - "is:issue AND (label:critical OR label:urgent) AND state:open"
// - "is:issue AND assignee:@me AND -label:wontfix"
```

**Syntax changes for ISSUE_ADVANCED:**
- Space between `repo`, `org`, `user` qualifiers = AND (not OR as in standard search)
- Use explicit `AND`/`OR` keywords for clarity
- Parentheses for grouping
- Prefix `-` or `NOT` for exclusion

### Pattern 5: Filter Project Items (GHAPI-24)

**What:** Query all project items and filter client-side
**When to use:** Filtering items within a project by field values
**Example:**
```typescript
// Source: GitHub Community Discussion (confirmed limitation)
// NOTE: GitHub API does NOT support server-side filtering of ProjectV2 items
const LIST_PROJECT_ITEMS_QUERY = `
  query ListProjectItems($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: $first, after: $after) {
          nodes {
            id
            content {
              ... on Issue {
                id
                title
                state
                labels(first: 10) { nodes { name } }
              }
              ... on PullRequest {
                id
                title
                state
              }
              ... on DraftIssue {
                id
                title
              }
            }
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2SingleSelectField { name } }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field { ... on ProjectV2Field { name } }
                }
                ... on ProjectV2ItemFieldDateValue {
                  date
                  field { ... on ProjectV2Field { name } }
                }
              }
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

// Filter client-side based on field values or content properties
function filterItems(items: ProjectItem[], filter: FilterCriteria): ProjectItem[] {
  return items.filter(item => matchesFilter(item, filter));
}
```

**Critical Limitation:** GitHub's ProjectV2 API does not support server-side filtering. The tool must:
1. Query all items (paginated)
2. Apply filters in application code
3. Return filtered results

Consider implementing a simple filter syntax similar to GitHub's query language for consistency.

### Anti-Patterns to Avoid

- **Assuming server-side filtering:** ProjectV2 items API has no filter parameter - don't try to pass query strings to the API
- **Using wrong item ID for draft conversion:** Must use ProjectV2Item ID (`PVTI_`), not the draft content ID
- **Forgetting to resolve repository ID:** Draft conversion needs the repository's node ID, not owner/name strings
- **Ignoring pagination for filtering:** When filtering large projects, must paginate through all items before filtering
- **Using ISSUE type instead of ISSUE_ADVANCED:** The new `ISSUE_ADVANCED` type supports Boolean operators; standard `ISSUE` type does not

## Don't Hand-Roll

Problems that have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Issue search with AND/OR | Custom query parser | GitHub's `ISSUE_ADVANCED` search type | Native support, maintained by GitHub |
| Repository ID resolution | Manual ID mapping | Query `repository(owner:, name:)` | Consistent with existing patterns |
| Project item ordering | Custom position tracking | `updateProjectV2ItemPosition` | GitHub manages ordering internally |

**Key insight:** GitHub handles position tracking internally - don't try to maintain separate ordering metadata.

## Common Pitfalls

### Pitfall 1: Draft Conversion ID Confusion

**What goes wrong:** Using the wrong ID type when converting draft issues
**Why it happens:** Draft issues have both a content ID and a ProjectV2Item ID
**How to avoid:** Always use the ProjectV2Item ID (`PVTI_` prefix) from the project items query
**Warning signs:** Error "Node not found" or "Invalid item type"

### Pitfall 2: Expecting Server-Side Filtering

**What goes wrong:** Trying to pass filter parameters to the ProjectV2 items API
**Why it happens:** Other APIs (like search) support filtering, so it's natural to expect it
**How to avoid:** Document the client-side filtering approach; implement efficient pagination
**Warning signs:** No filter parameter in GraphQL schema; API ignoring filter attempts

### Pitfall 3: Search Query Syntax Mismatch

**What goes wrong:** Using standard search syntax with ISSUE_ADVANCED or vice versa
**Why it happens:** Space-as-AND behavior differs between search types
**How to avoid:** Use explicit AND/OR operators; document which search type is used
**Warning signs:** Unexpected search results; more/fewer items than expected

### Pitfall 4: Position Mutation Return Value

**What goes wrong:** Not handling the items list returned by position update
**Why it happens:** The mutation returns updated items, not just the moved item
**How to avoid:** Parse the `items` connection properly; may need to refetch for accurate positions
**Warning signs:** Stale position data; items appearing out of order

### Pitfall 5: Closed Project State

**What goes wrong:** Assuming closed projects are deleted or items inaccessible
**Why it happens:** Misunderstanding GitHub's "closed" concept
**How to avoid:** Closed projects retain all data; they're just hidden from default views
**Warning signs:** Trying to "restore" closed project data; duplicating data before closing

## Code Examples

Verified patterns from official sources:

### Close Project

```typescript
// Source: GitHub GraphQL Mutations Reference
const CLOSE_PROJECT_MUTATION = `
  mutation CloseProject($input: UpdateProjectV2Input!) {
    updateProjectV2(input: $input) {
      projectV2 {
        id
        title
        closed
        url
      }
    }
  }
`;

interface CloseProjectInput {
  projectId: string;
}

async function executeCloseProject(input: CloseProjectInput): Promise<ClosedProjectOutput> {
  const factory = createFactory();
  const response = await factory.graphql<UpdateProjectV2Response>(CLOSE_PROJECT_MUTATION, {
    input: {
      projectId: input.projectId,
      closed: true
    }
  });
  return {
    id: response.updateProjectV2.projectV2.id,
    title: response.updateProjectV2.projectV2.title,
    closed: response.updateProjectV2.projectV2.closed,
    url: response.updateProjectV2.projectV2.url
  };
}
```

### Reopen Project

```typescript
// Source: GitHub GraphQL Mutations Reference
async function executeReopenProject(input: ReopenProjectInput): Promise<ReopenedProjectOutput> {
  const factory = createFactory();
  const response = await factory.graphql<UpdateProjectV2Response>(CLOSE_PROJECT_MUTATION, {
    input: {
      projectId: input.projectId,
      closed: false  // Reopen by setting closed to false
    }
  });
  return {
    id: response.updateProjectV2.projectV2.id,
    title: response.updateProjectV2.projectV2.title,
    closed: response.updateProjectV2.projectV2.closed,
    url: response.updateProjectV2.projectV2.url
  };
}
```

### Convert Draft Issue

```typescript
// Source: GitHub GraphQL Mutations Reference
const CONVERT_DRAFT_ISSUE_MUTATION = `
  mutation ConvertDraftIssue($input: ConvertProjectV2DraftIssueItemToIssueInput!) {
    convertProjectV2DraftIssueItemToIssue(input: $input) {
      item {
        id
        content {
          ... on Issue {
            id
            number
            title
            url
            repository {
              nameWithOwner
            }
          }
        }
      }
    }
  }
`;

interface ConvertDraftIssueInput {
  itemId: string;      // ProjectV2Item ID (PVTI_...)
  owner: string;       // Target repository owner
  repo: string;        // Target repository name
}

async function executeConvertDraftIssue(input: ConvertDraftIssueInput): Promise<ConvertedIssueOutput> {
  const factory = createFactory(input.owner, input.repo);

  // First resolve repository ID
  const repoId = await resolveRepositoryId(factory, input.owner, input.repo);

  const response = await factory.graphql<ConvertDraftIssueResponse>(CONVERT_DRAFT_ISSUE_MUTATION, {
    input: {
      itemId: input.itemId,
      repositoryId: repoId
    }
  });

  const issue = response.convertProjectV2DraftIssueItemToIssue.item.content;
  return {
    itemId: response.convertProjectV2DraftIssueItemToIssue.item.id,
    issueId: issue.id,
    issueNumber: issue.number,
    title: issue.title,
    url: issue.url,
    repository: issue.repository.nameWithOwner
  };
}
```

### Update Item Position

```typescript
// Source: GitHub GraphQL Mutations Reference
const UPDATE_ITEM_POSITION_MUTATION = `
  mutation UpdateItemPosition($input: UpdateProjectV2ItemPositionInput!) {
    updateProjectV2ItemPosition(input: $input) {
      items(first: 5) {
        nodes {
          id
        }
      }
    }
  }
`;

interface UpdateItemPositionInput {
  projectId: string;
  itemId: string;
  afterId?: string;  // Optional - omit to move to top
}

async function executeUpdateItemPosition(input: UpdateItemPositionInput): Promise<ItemPositionOutput> {
  const factory = createFactory();
  const response = await factory.graphql<UpdateItemPositionResponse>(UPDATE_ITEM_POSITION_MUTATION, {
    input: {
      projectId: input.projectId,
      itemId: input.itemId,
      ...(input.afterId && { afterId: input.afterId })
    }
  });

  return {
    success: true,
    itemId: input.itemId,
    position: input.afterId ? `after ${input.afterId}` : 'first'
  };
}
```

### Search Issues with Advanced Query

```typescript
// Source: GitHub Issues & Projects API Update (March 2025)
const SEARCH_ISSUES_ADVANCED_QUERY = `
  query SearchIssuesAdvanced($query: String!, $first: Int!, $after: String) {
    search(query: $query, type: ISSUE_ADVANCED, first: $first, after: $after) {
      issueCount
      nodes {
        ... on Issue {
          id
          number
          title
          state
          url
          labels(first: 10) {
            nodes { name }
          }
          assignees(first: 5) {
            nodes { login }
          }
          repository {
            nameWithOwner
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface SearchIssuesInput {
  query: string;   // e.g., "is:issue AND repo:owner/repo AND label:bug"
  first?: number;  // Max 100
  after?: string;  // Pagination cursor
}

async function executeSearchIssues(input: SearchIssuesInput): Promise<SearchIssuesOutput> {
  const factory = createFactory();
  const response = await factory.graphql<SearchIssuesResponse>(SEARCH_ISSUES_ADVANCED_QUERY, {
    query: input.query,
    first: input.first || 20,
    after: input.after
  });

  return {
    totalCount: response.search.issueCount,
    issues: response.search.nodes.map(mapToIssueOutput),
    pageInfo: response.search.pageInfo
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Classic project state API | UpdateProjectV2 with closed field | 2022 (ProjectsV2 launch) | Use updateProjectV2 mutation |
| ISSUE search type | ISSUE_ADVANCED for complex queries | March 2025 | Enables AND/OR operators |
| No draft conversion API | convertProjectV2DraftIssueItemToIssue | 2022 (ProjectsV2 launch) | Draft issues can become real issues |

**Deprecated/outdated:**
- Projects (classic): Deprecated, scheduled for removal 2025-04-01 UTC
- REST API for project state: Use GraphQL for ProjectV2

## Open Questions

Things that require validation during implementation:

1. **Closed field in UpdateProjectV2Input**
   - What we know: The `closed` field exists on ProjectV2 object and can be updated
   - What's unclear: Exact behavior when closing - are items preserved? Can items be modified?
   - Recommendation: Test with real API to confirm behavior

2. **Item position persistence across views**
   - What we know: `updateProjectV2ItemPosition` updates item position
   - What's unclear: Does position apply globally or per-view?
   - Recommendation: Test if position is view-specific or project-wide

3. **ISSUE_ADVANCED availability**
   - What we know: Announced in March 2025 changelog
   - What's unclear: Whether it's available for all users or requires specific enablement
   - Recommendation: Test availability; fall back to standard ISSUE type if needed

## Sources

### Primary (HIGH confidence)
- [GitHub GraphQL Mutations Reference](https://docs.github.com/en/graphql/reference/mutations) - updateProjectV2, convertProjectV2DraftIssueItemToIssue, updateProjectV2ItemPosition mutations
- [GitHub GraphQL Input Objects Reference](https://docs.github.com/en/graphql/reference/input-objects) - ConvertProjectV2DraftIssueItemToIssueInput fields
- [GitHub Issues & Projects API Changelog (March 2025)](https://github.blog/changelog/2025-03-06-github-issues-projects-api-support-for-issues-advanced-search-and-more/) - ISSUE_ADVANCED search type

### Secondary (MEDIUM confidence)
- [GitHub Community Discussion #41776](https://github.com/orgs/community/discussions/41776) - Confirmation that ProjectV2 items API lacks server-side filtering
- [Using the API to manage Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects) - General patterns and examples

### Tertiary (LOW confidence)
- [GitHub Projects CLI Tool Gist](https://gist.github.com/ruvnet/ac1ec98a770d57571afe077b21676a1d) - Community example of updateProjectV2ItemPosition usage

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing libraries, no new dependencies
- Architecture: HIGH - Following Phase 7 patterns exactly
- Close/Reopen: HIGH - UpdateProjectV2 mutation with closed field documented
- Draft Conversion: HIGH - Mutation and input types documented
- Item Position: HIGH - Mutation documented with clear parameters
- Issue Search: MEDIUM - ISSUE_ADVANCED is new; may need fallback
- Item Filtering: MEDIUM - Client-side filtering is a workaround; performance may vary

**Research date:** 2026-01-31
**Valid until:** 2026-02-28 (30 days - stable API with one newer feature)
