# Enhanced Field Value Support

## Overview

The MCP GitHub Project Manager now supports **100% coverage** of GitHub Project v2 field types for field value operations. This enhancement addresses the critical gap identified in the compliance review and brings complete field type support to the `setFieldValue` and `getFieldValue` methods.

## Supported Field Types

| Field Type | Set Support | Get Support | Value Format | Description |
|------------|-------------|-------------|--------------|-------------|
| TEXT | ✅ | ✅ | `string` | Plain text fields |
| NUMBER | ✅ | ✅ | `number` | Numeric fields |
| DATE | ✅ | ✅ | `string` (ISO format) | Date fields |
| SINGLE_SELECT | ✅ | ✅ | `string` (option name) | Single selection from predefined options |
| ITERATION | ✅ | ✅ | `string` (iteration ID) | Sprint/iteration assignment |
| MILESTONE | ✅ | ✅ | `string` (milestone ID) | Milestone assignment |
| ASSIGNEES | ✅ | ✅ | `string[]` (user IDs) | User assignments |
| LABELS | ✅ | ✅ | `string[]` (label IDs) | Label assignments |

## Field Value Setting Examples

### Basic Field Types

```typescript
// Text field
await projectService.setFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID", 
  fieldId: "FIELD_ID",
  value: "Updated description"
});

// Number field
await projectService.setFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID", 
  value: 42
});

// Date field
await projectService.setFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID",
  value: "2024-12-31"
});
```

### Selection Fields

```typescript
// Single select field
await projectService.setFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID",
  value: "In Progress" // Option name
});
```

### New Enhanced Field Types

```typescript
// Iteration field
await projectService.setFieldValue({
  projectId: "PROJECT_ID", 
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID",
  value: "ITERATION_ID" // GitHub iteration ID
});

// Milestone field
await projectService.setFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID", 
  fieldId: "FIELD_ID",
  value: "MILESTONE_ID" // GitHub milestone ID
});

// Assignees field
await projectService.setFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID", 
  value: ["USER_ID_1", "USER_ID_2"] // Array of GitHub user IDs
});

// Labels field
await projectService.setFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID",
  value: ["LABEL_ID_1", "LABEL_ID_2"] // Array of GitHub label IDs
});
```

## Field Value Reading Examples

### Reading Enhanced Field Types

```typescript
// Reading iteration field
const iterationValue = await projectService.getFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID", 
  fieldId: "FIELD_ID"
});
// Returns: { fieldName: "Sprint", value: { iterationId: "...", title: "Sprint 1" }, fieldType: "ITERATION" }

// Reading milestone field  
const milestoneValue = await projectService.getFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID" 
});
// Returns: { fieldName: "Milestone", value: { milestoneId: "...", title: "v1.0" }, fieldType: "MILESTONE" }

// Reading assignees field
const assigneesValue = await projectService.getFieldValue({
  projectId: "PROJECT_ID", 
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID"
});
// Returns: { fieldName: "Assignees", value: [{ id: "...", login: "user1" }], fieldType: "ASSIGNEES" }

// Reading labels field
const labelsValue = await projectService.getFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID"
});
// Returns: { fieldName: "Labels", value: [{ id: "...", name: "bug" }], fieldType: "LABELS" }
```

## Error Handling

The enhanced implementation includes comprehensive error handling for the new field types:

### Validation Errors

```typescript
// Invalid iteration ID
await projectService.setFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID", 
  fieldId: "FIELD_ID",
  value: null // Will throw ValidationError
});
// Error: "Iteration field 'Sprint' requires a valid iteration ID string"

// Invalid assignees format
await projectService.setFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID", 
  value: [] // Will throw ValidationError  
});
// Error: "Assignees field 'Team' requires at least one user ID"

// Invalid label IDs
await projectService.setFieldValue({
  projectId: "PROJECT_ID",
  itemId: "ITEM_ID",
  fieldId: "FIELD_ID",
  value: ["", "VALID_ID"] // Will throw ValidationError
});
// Error: "Labels field 'Tags' requires valid label ID strings"
```

## GraphQL API Integration

### Field Value Mutations

The implementation uses the proper GitHub GraphQL API mutations:

- **Iteration**: `updateProjectV2ItemFieldValue` with `iterationId` value
- **Milestone**: `updateProjectV2ItemFieldValue` with `milestoneId` value  
- **Assignees**: `updateProjectV2ItemFieldValue` with `userIds` array value
- **Labels**: `updateProjectV2ItemFieldValue` with `labelIds` array value

### Field Value Queries

Enhanced GraphQL fragments support reading all field types:

- **Iteration**: `ProjectV2ItemFieldIterationValue` with `iterationId` and `title`
- **Milestone**: `ProjectV2ItemFieldMilestoneValue` with `milestoneId` and `title`
- **Assignees**: `ProjectV2ItemFieldUserValue` with `users.nodes` array
- **Labels**: `ProjectV2ItemFieldLabelValue` with `labels.nodes` array

## Implementation Benefits

1. **Complete API Coverage**: 100% support for all GitHub Project v2 field types
2. **Type Safety**: Strong TypeScript typing with comprehensive interfaces
3. **Error Handling**: Specific validation for each field type with clear error messages
4. **GraphQL Optimization**: Efficient queries and mutations using proper GitHub API patterns
5. **Backward Compatibility**: Existing field types continue to work without changes

## Migration Notes

- **No Breaking Changes**: Existing code for TEXT, NUMBER, DATE, and SINGLE_SELECT fields continues to work
- **Enhanced Error Messages**: More specific validation errors help with debugging
- **New Return Formats**: Enhanced field types return structured objects with additional metadata

This enhancement brings the MCP GitHub Project Manager to full compliance with the GitHub Project v2 API field value operations.
