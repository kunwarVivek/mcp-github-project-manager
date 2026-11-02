import { ValidationError } from "../../../domain/errors";
import { ResourceNotFoundError, ResourceType } from "../../../domain/resource-types";
import { BaseGitHubRepository } from "./BaseRepository";

/** Strategy for building a field-type-specific mutation and variables. */
interface FieldTypeStrategy {
  buildMutation(): string;
  buildVariables(
    base: { projectId: string; itemId: string; fieldId: string },
    rawValue: unknown
  ): Record<string, unknown>;
}

const ITEM_FRAGMENT = `projectV2Item { id }`;

function makeFieldTypeStrategy(
  dataType: string,
  options?: Array<{ id: string; name: string }>
): FieldTypeStrategy {
  switch (dataType) {
    case "TEXT":
      return {
        buildMutation: () =>
          `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { text: $value } }) { ${ITEM_FRAGMENT} }
          }`,
        buildVariables: (base, raw) => ({ ...base, value: String(raw) }),
      };
    case "NUMBER":
      return {
        buildMutation: () =>
          `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { number: $value } }) { ${ITEM_FRAGMENT} }
          }`,
        buildVariables: (base, raw) => ({ ...base, value: Number(raw) }),
      };
    case "DATE":
      return {
        buildMutation: () =>
          `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Date!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { date: $value } }) { ${ITEM_FRAGMENT} }
          }`,
        buildVariables: (base, raw) => ({ ...base, value: String(raw) }),
      };
    case "SINGLE_SELECT":
      return {
        buildMutation: () =>
          `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $value } }) { ${ITEM_FRAGMENT} }
          }`,
        buildVariables: (base, raw) => {
          let optionId = String(raw);
          if (options) {
            const match = options.find((o) => o.name === raw || o.id === raw);
            if (match) optionId = match.id;
          }
          return { ...base, value: optionId };
        },
      };
    case "ITERATION":
      return {
        buildMutation: () =>
          `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { iterationId: $value } }) { ${ITEM_FRAGMENT} }
          }`,
        buildVariables: (base, raw) => {
          const iterationValue = raw as { iterationId?: string };
          return { ...base, value: iterationValue.iterationId || String(raw) };
        },
      };
    case "MULTI_SELECT":
      return {
        buildMutation: () =>
          `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: [String!]!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { multiSelectOptionIds: $value } }) { ${ITEM_FRAGMENT} }
          }`,
        buildVariables: (base, raw) => {
          // The value is a list of option ids; a caller may name the options
          // instead, so a name is resolved to its id.
          const requested = (Array.isArray(raw) ? raw : [raw]).map((entry) => String(entry));
          const ids = requested.map((entry) => {
            const match = options?.find((option) => option.name === entry || option.id === entry);
            return match?.id ?? entry;
          });
          return { ...base, value: ids };
        },
      };
    default:
      throw new ValidationError(`Unsupported field type: ${dataType}`);
  }
}

// ProjectV2.field() only accepts `name`, so the field is looked up by its node ID.
// Every member of the `ProjectV2FieldConfiguration` union needs a
// fragment: a node that matches none of them comes back empty.
const FIELD_QUERY = `
  query($fieldId: ID!) {
    node(id: $fieldId) {
      ... on ProjectV2Field { id name dataType }
      ... on ProjectV2IterationField { id name dataType }
      ... on ProjectV2SingleSelectField { id name dataType options { id name } }
      ... on ProjectV2MultiSelectField { id name dataType multiSelectOptions { id name } }
    }
  }
`;

const ITEM_FIELD_VALUES_QUERY = `
  query($itemId: ID!) {
    node(id: $itemId) {
      ... on ProjectV2Item {
        fieldValues(first: 50) {
          nodes {
            ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2Field { id name } } }
            ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2Field { id name } } }
            ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2Field { id name } } }
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2SingleSelectField { id name } } }
            ... on ProjectV2ItemFieldMultiSelectValue { options { id name } field { ... on ProjectV2MultiSelectField { id name } } }
            ... on ProjectV2ItemFieldIterationValue { title iterationId field { ... on ProjectV2IterationField { id name } } }
          }
        }
      }
    }
  }
`;

const CLEAR_FIELD_VALUE_MUTATION = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
    clearProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }) {
      projectV2Item { id }
    }
  }
`;

interface FieldQueryResponse {
  node: {
    id?: string;
    name: string;
    dataType: string;
    options?: Array<{ id: string; name: string }>;
    multiSelectOptions?: Array<{ id: string; name: string }>;
  } | null;
}

interface FieldValueResponse {
  node: {
    fieldValues: {
      nodes: Array<{
        field: { id: string; name: string };
        text?: string;
        number?: number;
        date?: string;
        name?: string;
        optionId?: string;
        options?: Array<{ id: string; name: string }>;
        title?: string;
        iterationId?: string;
      }>;
    };
  };
}

export interface ProjectItemFieldValue {
  fieldId: string;
  fieldName: string;
  value: unknown;
  type: string;
}

/** GraphQL access to Projects v2 custom field values of a project item. */
export class GitHubFieldValueRepository extends BaseGitHubRepository {
  /** Sets a field value on a project item; returns the name of the field that was written. */
  async setValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
    value: unknown;
  }): Promise<string> {
    const fieldResponse = await this.graphql<FieldQueryResponse>(FIELD_QUERY, {
      fieldId: data.fieldId,
    });

    // A node ID that is not a project field matches no fragment and comes back as {}.
    if (!fieldResponse.node?.id) {
      throw new ResourceNotFoundError(ResourceType.FIELD, data.fieldId);
    }

    const field = fieldResponse.node;
    const strategy = makeFieldTypeStrategy(
      field.dataType,
      field.dataType === "MULTI_SELECT" ? field.multiSelectOptions : field.options
    );
    const variables = strategy.buildVariables(
      { projectId: data.projectId, itemId: data.itemId, fieldId: data.fieldId },
      data.value
    );

    await this.graphql(strategy.buildMutation(), variables);
    return field.name;
  }

  async getValue(data: { itemId: string; fieldId: string }): Promise<ProjectItemFieldValue> {
    const response = await this.graphql<FieldValueResponse>(ITEM_FIELD_VALUES_QUERY, {
      itemId: data.itemId,
    });

    if (!response.node?.fieldValues?.nodes) {
      throw new ResourceNotFoundError(ResourceType.FIELD, data.itemId);
    }

    const fieldValue = response.node.fieldValues.nodes.find((fv) => fv.field?.id === data.fieldId);
    if (!fieldValue) {
      return { fieldId: data.fieldId, fieldName: "unknown", value: null, type: "unknown" };
    }

    let value: unknown = null;
    let type = "unknown";

    if ("text" in fieldValue && fieldValue.text !== undefined) {
      value = fieldValue.text;
      type = "TEXT";
    } else if ("number" in fieldValue && fieldValue.number !== undefined) {
      value = fieldValue.number;
      type = "NUMBER";
    } else if ("date" in fieldValue && fieldValue.date !== undefined) {
      value = fieldValue.date;
      type = "DATE";
    } else if ("optionId" in fieldValue) {
      value = { optionId: fieldValue.optionId, name: fieldValue.name };
      type = "SINGLE_SELECT";
    } else if ("options" in fieldValue && fieldValue.options) {
      value = { options: fieldValue.options };
      type = "MULTI_SELECT";
    } else if ("iterationId" in fieldValue) {
      value = { iterationId: fieldValue.iterationId, title: fieldValue.title };
      type = "ITERATION";
    }

    return { fieldId: data.fieldId, fieldName: fieldValue.field?.name || "unknown", value, type };
  }

  async clearValue(data: { projectId: string; itemId: string; fieldId: string }): Promise<void> {
    await this.graphql(CLEAR_FIELD_VALUE_MUTATION, {
      projectId: data.projectId,
      itemId: data.itemId,
      fieldId: data.fieldId,
    });
  }
}
