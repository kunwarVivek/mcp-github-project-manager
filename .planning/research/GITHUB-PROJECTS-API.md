# Research Report: GitHub Projects v2 API Comprehensive Reference
Generated: 2026-01-30

## Summary

GitHub Projects v2 provides a comprehensive project management system accessible primarily via GraphQL API, with REST API support added in September 2025. The API supports full CRUD operations on projects, items, fields, views, and includes built-in automations, webhooks, and insights/charts capabilities. Key recent additions include REST API endpoints, sub-issues with cross-organization support, issue types, and project status updates.

## Questions Answered

### Q1: All GitHub Projects v2 API endpoints and capabilities
**Answer:** Projects v2 uses GraphQL as its primary API, with REST API support added in September 2025. Full CRUD operations available for projects, items, fields, and views.
**Source:** https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
**Confidence:** High

### Q2: Recently added features (2024-2026)
**Answer:** REST API (Sept 2025), sub-issues with cross-org support, issue types REST API, project status updates, advanced search API, improved onboarding workflows
**Source:** https://github.blog/changelog/2025-09-11-a-rest-api-for-github-projects-sub-issues-improvements-and-more/
**Confidence:** High

### Q3: Custom field types supported
**Answer:** Text, Number, Date, Single Select (up to 50 options), Iteration (with breaks), Labels, Milestones, Assignees, Repository
**Source:** https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields
**Confidence:** High

### Q4: View layouts available
**Answer:** Three layouts: Table (spreadsheet), Board (kanban), Roadmap (timeline/Gantt)
**Source:** https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/changing-the-layout-of-a-view
**Confidence:** High

### Q5: Automations available
**Answer:** Built-in workflows for status changes, auto-archive, auto-add items. GitHub Actions integration for advanced automation.
**Source:** https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations
**Confidence:** High

### Q6: Insights/Analytics
**Answer:** Built-in charts (burn-up, historical), 2 saved charts on Free plan, unlimited on Team/Enterprise. Third-party tools (Screenful) for advanced analytics.
**Source:** https://docs.github.com/en/issues/planning-and-tracking-with-projects/viewing-insights-from-your-project/about-insights-for-projects
**Confidence:** High

---

## Detailed Findings

## 1. GraphQL API - Mutations (Complete List)

### Project Management Mutations

| Mutation | Description | Input Parameters |
|----------|-------------|------------------|
| `createProjectV2` | Create a new project | `ownerId`, `title`, `repositoryId` (optional) |
| `updateProjectV2` | Update project settings | `projectId`, `title`, `shortDescription`, `readme`, `public` |
| `deleteProjectV2` | Delete a project | `projectId` |
| `copyProjectV2` | Copy/clone a project | `projectId`, `ownerId`, `title`, `includeDraftIssues` |
| `closeProjectV2` | Close a project | `projectId` |
| `reopenProjectV2` | Reopen a closed project | `projectId` |

### Item Management Mutations

| Mutation | Description | Input Parameters |
|----------|-------------|------------------|
| `addProjectV2ItemById` | Add existing issue/PR to project | `projectId`, `contentId` |
| `addProjectV2DraftIssue` | Create draft issue in project | `projectId`, `title`, `body`, `assigneeIds` |
| `deleteProjectV2Item` | Remove item from project | `projectId`, `itemId` |
| `archiveProjectV2Item` | Archive an item | `projectId`, `itemId` |
| `unarchiveProjectV2Item` | Unarchive an item | `projectId`, `itemId` |
| `updateProjectV2ItemPosition` | Reorder item in project | `projectId`, `itemId`, `afterId` |
| `convertProjectV2DraftIssueItemToIssue` | Convert draft to real issue | `projectId`, `itemId`, `repositoryId` |

### Field Value Mutations

| Mutation | Description | Supported Field Types |
|----------|-------------|----------------------|
| `updateProjectV2ItemFieldValue` | Set field value | text, number, date, single_select, iteration |
| `clearProjectV2ItemFieldValue` | Clear field value | text, number, date, assignees, labels, single-select, iteration, milestone |

**Important:** Cannot use `updateProjectV2ItemFieldValue` to change Assignees, Labels, Milestone, or Repository - these are properties of issues/PRs, not project items.

### Field Management Mutations

| Mutation | Description | Input Parameters |
|----------|-------------|------------------|
| `createProjectV2Field` | Create custom field | `projectId`, `dataType`, `name`, `singleSelectOptions` |
| `deleteProjectV2Field` | Delete custom field | `fieldId` |
| `updateProjectV2Field` | Update field settings | `fieldId`, `name` (limited support) |

### View Mutations

| Mutation | Description | Input Parameters |
|----------|-------------|------------------|
| `createProjectV2View` | Create new view | `projectId`, `name`, `type` (TABLE/BOARD/ROADMAP), `filter`, `visibleColumnIds` |
| `deleteProjectV2View` | Delete a view | `viewId` |
| `updateProjectV2View` | Update view settings | `viewId`, `name`, `filter`, `sortBy`, `groupBy` |

### Linking Mutations

| Mutation | Description |
|----------|-------------|
| `linkProjectV2ToRepository` | Link project to repository |
| `unlinkProjectV2FromRepository` | Unlink project from repository |
| `linkProjectV2ToTeam` | Link project to team |
| `unlinkProjectV2FromTeam` | Unlink project from team |

### Status & Template Mutations

| Mutation | Description |
|----------|-------------|
| `createProjectV2StatusUpdate` | Create project status update |
| `markProjectV2AsTemplate` | Mark project as template |
| `unmarkProjectV2AsTemplate` | Unmark project as template |

---

## 2. GraphQL API - Queries

### Finding Projects

```graphql
# Get organization project by number
query {
  organization(login: "ORG") {
    projectV2(number: 5) {
      id
      title
      url
      public
      closed
      shortDescription
      readme
    }
  }
}

# Get user project by number
query {
  user(login: "USER") {
    projectV2(number: 5) {
      id
      title
    }
  }
}

# List all org projects
query {
  organization(login: "ORG") {
    projectsV2(first: 20) {
      nodes {
        id
        title
        number
        url
      }
    }
  }
}
```

### Querying Project Items

```graphql
query {
  node(id: "PROJECT_ID") {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue {
              title
              number
              state
            }
            ... on PullRequest {
              title
              number
              state
            }
            ... on DraftIssue {
              title
              body
            }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2Field { name } }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field { ... on ProjectV2Field { name } }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field { ... on ProjectV2Field { name } }
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                iterationId
                startDate
                duration
                field { ... on ProjectV2IterationField { name } }
              }
            }
          }
        }
      }
    }
  }
}
```

### Querying Project Fields

```graphql
query {
  node(id: "PROJECT_ID") {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2Field {
            id
            name
            dataType
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
              color
              description
            }
          }
          ... on ProjectV2IterationField {
            id
            name
            configuration {
              iterations {
                id
                title
                startDate
                duration
              }
              completedIterations {
                id
                title
              }
            }
          }
        }
      }
    }
  }
}
```

### Querying Views

```graphql
query {
  node(id: "PROJECT_ID") {
    ... on ProjectV2 {
      views(first: 20) {
        nodes {
          id
          name
          layout
          filter
          sortBy {
            field { ... on ProjectV2FieldCommon { name } }
            direction
          }
          groupBy {
            field { ... on ProjectV2FieldCommon { name } }
          }
        }
      }
    }
  }
}
```

---

## 3. REST API (Added September 2025)

### Projects Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orgs/{org}/projectsV2` | List organization projects |
| GET | `/users/{username}/projectsV2` | List user projects |
| GET | `/orgs/{org}/projectsV2/{project_number}` | Get specific project |

### Project Items Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orgs/{org}/projectsV2/{project_number}/items` | List project items |
| POST | `/orgs/{org}/projectsV2/{project_number}/items` | Add item to project |
| PATCH | `/orgs/{org}/projectsV2/{project_number}/items/{item_id}` | Update item field values |
| DELETE | `/orgs/{org}/projectsV2/{project_number}/items/{item_id}` | Remove item from project |

### Project Fields Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orgs/{org}/projectsV2/{project_number}/fields` | List project fields |
| POST | `/orgs/{org}/projectsV2/{project_number}/fields` | Create custom field |

### Sub-Issues Endpoints (REST)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/{owner}/{repo}/issues/{issue_number}/parent` | Get parent issue |
| GET | `/repos/{owner}/{repo}/issues/{issue_number}/sub_issues` | List sub-issues |
| POST | `/repos/{owner}/{repo}/issues/{issue_number}/sub_issues` | Add sub-issue |
| PATCH | `/repos/{owner}/{repo}/issues/{issue_number}/sub_issues/{sub_issue_id}` | Reprioritize sub-issue |

---

## 4. Custom Field Types

| Field Type | GraphQL Type | Capabilities |
|------------|--------------|--------------|
| **Text** | `ProjectV2Field` | Free-form text input |
| **Number** | `ProjectV2Field` | Numeric values |
| **Date** | `ProjectV2Field` | Date picker |
| **Single Select** | `ProjectV2SingleSelectField` | Dropdown with up to 50 options, each with color and description |
| **Iteration** | `ProjectV2IterationField` | Sprint/iteration tracking with configurable duration and breaks |

### Built-in Fields (from Issue/PR)

| Field | GraphQL Type | Notes |
|-------|--------------|-------|
| **Title** | `ProjectV2ItemFieldTextValue` | From issue/PR |
| **Assignees** | `ProjectV2ItemFieldUserValue` | From issue/PR, not updatable via project API |
| **Labels** | `ProjectV2ItemFieldLabelValue` | From issue/PR, not updatable via project API |
| **Milestone** | `ProjectV2ItemFieldMilestoneValue` | From issue/PR, not updatable via project API |
| **Repository** | `ProjectV2ItemFieldRepositoryValue` | From issue/PR |
| **Reviewers** | `ProjectV2ItemFieldReviewerValue` | PR only |
| **Linked PRs** | `ProjectV2ItemFieldPullRequestValue` | Issue only |

### Special Fields (Sub-issues)

| Field | Description |
|-------|-------------|
| **Parent Issue** | Shows parent issue for sub-issues |
| **Sub-issue Progress** | Shows completion progress of sub-issues |

---

## 5. View Layouts

### Table Layout
- Spreadsheet-style view
- Show/hide columns
- Sort by any field
- Group by single-select or iteration fields
- Filter with field-based queries
- Slice panel for quick filtering

### Board Layout (Kanban)
- Column field: Status (default) or any single-select/iteration field
- Drag-and-drop items between columns
- Items automatically update field value when moved
- Swimlanes via grouping

### Roadmap Layout
- Timeline/Gantt-style view
- Uses date fields or iteration fields for positioning
- Configurable timespan (days, weeks, months)
- Drag to adjust dates
- Markers for iterations, dates, milestones
- Zoom levels

---

## 6. Built-in Automations (Workflows)

### Default Workflows (Enabled by Default)

| Trigger | Action |
|---------|--------|
| Issue/PR closed | Set Status to "Done" |
| PR merged | Set Status to "Done" |

### Available Workflow Triggers

| Trigger | Available Actions |
|---------|------------------|
| Item added to project | Set Status field value |
| Item reopened | Set Status field value |
| Item closed | Set Status field value |
| PR merged | Set Status field value |
| PR review requested | Set Status field value |
| PR approved | Set Status field value |
| PR changes requested | Set Status field value |
| Code review changes | Set Status field value |
| Auto-archive | Archive items matching criteria |
| Auto-add | Add issues/PRs matching filter from linked repos |

### Auto-Add Workflow

```yaml
# Configured in project settings
# Only processes new/updated items (not retroactive)
Filter: is:issue is:open label:bug
Repository: linked repositories
```

---

## 7. Webhooks

### Webhook Events

| Event | Description |
|-------|-------------|
| `projects_v2` | Project created, edited, deleted, closed, reopened |
| `projects_v2_item` | Item added, edited, archived, deleted, converted, reordered |
| `projects_v2_status_update` | Project status update created |

### projects_v2_item Payload Structure

```json
{
  "action": "edited",
  "changes": {
    "field_value": {
      "field_node_id": "PVTF_...",
      "field_name": "Status",
      "field_type": "single_select",
      "from": {
        "id": "...",
        "name": "Todo"
      },
      "to": {
        "id": "...",
        "name": "In Progress"
      }
    }
  },
  "projects_v2_item": {
    "id": 12345,
    "node_id": "PVTI_...",
    "project_node_id": "PVT_...",
    "content_node_id": "I_...",
    "content_type": "Issue",
    "archived_at": null
  },
  "organization": { ... },
  "sender": { ... }
}
```

**Note:** Payload does not include full issue/PR details - requires additional API call using `content_node_id`.

---

## 8. Insights & Charts

### Built-in Charts

| Chart Type | Description | Availability |
|------------|-------------|--------------|
| Burn-up | Progress over time | All plans |
| Historical (custom) | Track field changes over time | Team/Enterprise |
| Current (custom) | Snapshot charts | All plans (2 on Free) |

### Chart Configuration

- X-axis: Time, Iteration, or field
- Y-axis: Count, Sum (number fields)
- Group by: Any single-select field
- Filter: Same syntax as view filters

### Limitations

- Free plan: 2 saved charts for private projects, unlimited for public
- Advanced charts (burndown, velocity) require third-party tools like Screenful

---

## 9. Authentication & Permissions

### OAuth Scopes

| Scope | Access Level |
|-------|--------------|
| `read:project` | Read-only access to projects |
| `project` | Read and write access to projects |

### Project Permission Levels

| Level | Capabilities |
|-------|-------------|
| Read | View project and items |
| Write | Edit items, fields, views |
| Admin | Manage collaborators, delete project |

### GitHub App Permissions

- Organization permissions > Projects: Read/Write
- Note: Fine-grained PATs do not work with GraphQL API (must use classic PAT)

---

## 10. Recent Features (2024-2026)

### September 2025
- **REST API for Projects v2** - Full CRUD via REST
- **Sub-issues cross-org support** - Sub-issues can belong to different organization
- **Sub-issues limit increase** - 100 sub-issues per parent (up from 50)
- **8 levels of nested sub-issues**

### March 2025
- **Issue Types REST API** - Manage issue types programmatically
- **Advanced Search API** - AND/OR keywords, nested searches
- **Timeline events for issue types**

### January 2024
- **Project Status Updates** - High-level project status communication
- **Issues Side Panel** - Quick view while in project

### June 2024
- **GraphQL & Webhook support for status updates**
- **Field value changes in webhook payload** - Previous and current values included

### November 2025
- **Improved onboarding** - "PR linked to issue" workflow sets status to "In Progress"

---

## 11. Project Templates

### Template Features
- Views copied
- Custom fields copied
- Draft issues copied (optional)
- Workflows copied (except auto-add)
- Insights configuration copied

### API for Templates

```graphql
# Mark as template
mutation {
  markProjectV2AsTemplate(input: { projectId: "PROJECT_ID" }) {
    projectV2 { id }
  }
}

# Create from template (via copyProjectV2)
mutation {
  copyProjectV2(input: {
    projectId: "TEMPLATE_PROJECT_ID"
    ownerId: "ORG_ID"
    title: "New Project"
    includeDraftIssues: true
  }) {
    projectV2 { id url }
  }
}
```

---

## 12. Example: Complete Automation Workflow

```yaml
# .github/workflows/project-automation.yml
name: Add PR to Project
on:
  pull_request:
    types: [ready_for_review]

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - name: Add PR to project
        uses: actions/add-to-project@v0.5.0
        with:
          project-url: https://github.com/orgs/myorg/projects/1
          github-token: ${{ secrets.PROJECT_TOKEN }}
          
      - name: Set Status to "In Review"
        env:
          GITHUB_TOKEN: ${{ secrets.PROJECT_TOKEN }}
        run: |
          gh api graphql -f query='
            mutation($project:ID!, $item:ID!, $status_field:ID!, $status_value:String!) {
              updateProjectV2ItemFieldValue(
                input: {
                  projectId: $project
                  itemId: $item
                  fieldId: $status_field
                  value: { singleSelectOptionId: $status_value }
                }
              ) {
                projectV2Item { id }
              }
            }' -f project="PVT_xxx" -f item="PVTI_xxx" -f status_field="PVTSSF_xxx" -f status_value="abc123"
```

---

## Recommendations for MCP Server

### Priority 1: Core Operations
1. `createProject` / `updateProject` / `deleteProject`
2. `addItem` / `removeItem` / `archiveItem`
3. `updateItemFieldValue` / `clearItemFieldValue`
4. `listProjects` / `getProject`
5. `listItems` / `getItem`

### Priority 2: Fields & Views
1. `listFields` / `createField` / `deleteField`
2. `listViews` / `createView` / `updateView`
3. `getFieldOptions` (for single-select)
4. `getIterations` (for iteration fields)

### Priority 3: Advanced
1. Sub-issues management
2. Project status updates
3. Template operations
4. Webhook integration helpers

### API Strategy
- Use GraphQL for all operations (more complete)
- Offer REST API alternatives where available
- Cache field/option IDs to reduce lookups
- Support bulk operations where possible

---

## Sources

1. [GitHub Docs - Using the API to manage Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
2. [GitHub GraphQL Mutations Reference](https://docs.github.com/en/graphql/reference/mutations)
3. [GitHub Changelog - REST API for Projects (Sept 2025)](https://github.blog/changelog/2025-09-11-a-rest-api-for-github-projects-sub-issues-improvements-and-more/)
4. [GitHub Docs - Understanding Fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields)
5. [GitHub Docs - Changing the layout of a view](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/changing-the-layout-of-a-view)
6. [GitHub Docs - Using the built-in automations](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations)
7. [GitHub Docs - About insights for Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/viewing-insights-from-your-project/about-insights-for-projects)
8. [GitHub Docs - Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
9. [GitHub Changelog - API support for issues advanced search (March 2025)](https://github.blog/changelog/2025-03-06-github-issues-projects-api-support-for-issues-advanced-search-and-more/)
10. [GitHub Docs - REST API endpoints for sub-issues](https://docs.github.com/en/rest/issues/sub-issues)
11. [GitHub Docs - About single select fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-single-select-fields)
12. [GitHub Docs - About iteration fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-iteration-fields)
13. [GitHub Changelog - GraphQL and webhook support for project status updates (June 2024)](https://github.blog/changelog/2024-06-27-github-issues-projects-graphql-and-webhook-support-for-project-status-updates-and-more/)
14. [GitHub Docs - Managing project templates in your organization](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-your-project/managing-project-templates-in-your-organization)
15. [GitHub Docs - Automating Projects using Actions](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)

---

## Open Questions

1. **View mutations completeness** - Community discussions suggest `updateProjectV2View` may have limited support for all view properties (groupBy, sortBy, etc.)
2. **Field update mutations** - `updateProjectV2Field` for modifying single-select options is requested but unclear if fully available
3. **Fine-grained PAT support** - GraphQL API currently requires classic PAT, fine-grained tokens do not work
4. **Roadmap view markers API** - Configuring iteration/milestone markers on roadmap may require UI
5. **Insights API** - Charts appear to be UI-only, no GraphQL mutations for creating/updating charts programmatically
