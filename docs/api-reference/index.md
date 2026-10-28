# GitHub Project Manager MCP API Reference

> **Scope note.** The public MCP surface is **20 compound tools covering 169
> actions** — see [TOOLS.md](../TOOLS.md). The pages in this folder document
> individual *operations* (the granularity used inside the service layer), not
> tool names a client can call. Use `discover_tools` at runtime to list the
> tools, their actions, and their parameter schemas.

## Operation Reference

| Operation | Description | Documentation |
|-----------|-------------|---------------|
| `create_roadmap` | Create a project roadmap with milestones and issues | [Documentation](create-roadmap.md) |
| `plan_sprint` | Plan a new sprint with selected issues | [Documentation](plan-sprint.md) |
| `get_milestone_metrics` | Get progress metrics for a specific milestone | [Documentation](get-milestone-metrics.md) |

## Enhanced Features

| Feature | Description | Documentation |
|---------|-------------|---------------|
| Enhanced Field Support | Complete coverage of GitHub Project v2 field types | [Documentation](enhanced-field-support.md) |

## Using the API

All tools follow the Model Context Protocol (MCP) standard for request and
response formats. Every public tool takes an `action` parameter:

```json
{
  "name": "manage_project",
  "arguments": {
    "action": "create",
    "title": "New Project",
    "owner": "repository_owner",
    "visibility": "private"
  }
}
```

### Example Response

A successful call returns MCP content plus metadata:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"project\":{\"id\":\"PVT_...\",\"title\":\"New Project\", ...}}"
    }
  ]
}
```

### Error Handling

Two error shapes are distinct under MCP v2:

| Situation | Shape |
|-----------|-------|
| A tool that runs and fails | `{ "content": [...], "isError": true }` — a successful call with a failed result, visible to the model so it can recover |
| A protocol fault (e.g. unknown tool) | A JSON-RPC error |

Arguments are validated against the declared `inputSchema` **before** the
handler runs, so a malformed call is rejected without touching business logic.

The domain-level error codes used by the service layer are:

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| MCP-001 | Internal Error | 500 |
| MCP-002 | Validation Error | 400 |
| MCP-003 | Resource Not Found | 404 |
| MCP-004 | Invalid Request | 400 |
| MCP-005 | Unauthorized | 401 |
| MCP-006 | Rate Limited | 429 |

## Next Steps

- Check out the [Tool Reference](../TOOLS.md) for the full public surface
- See the [User Guide](../user-guide.md) for general usage instructions
- See the [Examples](../../examples/README.md) directory for code samples
- Review the [Tutorials](../tutorials/getting-started.md) for step-by-step guides
