/**
 * GraphQL fragments for the `ProjectV2FieldConfiguration` union.
 *
 * The union has exactly FOUR members:
 *
 *   ProjectV2Field            - text, number, date, title, ...
 *   ProjectV2SingleSelectField
 *   ProjectV2MultiSelectField
 *   ProjectV2IterationField
 *
 * A selection that omits one of them does not degrade gracefully: GitHub
 * answers "Could not resolve to a Unions::ProjectV2FieldConfiguration with
 * the name <node id>" and the whole query fails. That is how a project with
 * a multi-select field broke the field listing, and how a single-select
 * field id broke `setup_agent_fields`.
 *
 * Every selection of the union must therefore use these fragments.
 */
export interface ProjectFieldUnionExtras {
  /** Extra fields to select on a single-select field, e.g. `options { id name }`. */
  singleSelect?: string;
  /** Extra fields to select on a multi-select field, e.g. `multiSelectOptions { id name }`. */
  multiSelect?: string;
  /** Extra fields to select on an iteration field, e.g. `configuration { ... }`. */
  iteration?: string;
}

/**
 * The fragment set for the `ProjectV2FieldConfiguration` union.
 *
 * Pass the extra fields a caller needs; the member coverage stays complete
 * either way.
 */
export function projectFieldUnionSelection(extras: ProjectFieldUnionExtras = {}): string {
  const singleSelect = extras.singleSelect ? `\n                ${extras.singleSelect}` : "";
  const multiSelect = extras.multiSelect ? `\n                ${extras.multiSelect}` : "";
  const iteration = extras.iteration ? `\n                ${extras.iteration}` : "";
  return `... on ProjectV2Field { id name dataType }
                ... on ProjectV2SingleSelectField { id name dataType${singleSelect} }
                ... on ProjectV2MultiSelectField { id name dataType${multiSelect} }
                ... on ProjectV2IterationField { id name dataType${iteration} }`;
}

/** The members of the union - a selection must cover all of them. */
export const PROJECT_FIELD_UNION_MEMBERS = [
  "ProjectV2Field",
  "ProjectV2SingleSelectField",
  "ProjectV2MultiSelectField",
  "ProjectV2IterationField",
] as const;
