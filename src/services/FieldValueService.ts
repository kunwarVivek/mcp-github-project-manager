import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { ResourceNotFoundError } from "../domain/resource-types";
import { ResourceType } from "../domain/resource-types";
import { ValidationError } from "../domain/errors";
import { safeCall } from './utils/safeCall';

/** Strategy for building a field-type-specific mutation and variables. */
interface FieldTypeStrategy {
  buildMutation(): string;
  buildVariables(base: { projectId: string; itemId: string; fieldId: string }, rawValue: unknown): Record<string, unknown>;
}

const ITEM_FRAGMENT = `projectV2Item { id }`;

function makeStrategy(dataType: string, options?: Array<{ id: string; name: string }>): FieldTypeStrategy {
  switch (dataType) {
    case 'TEXT':
      return {
        buildMutation: () =>
          `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { text: $value } }) { ${ITEM_FRAGMENT} }
          }`,
        buildVariables: (base, raw) => ({ ...base, value: String(raw) }),
      };
    case 'NUMBER':
      return {
        buildMutation: () =>
          `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { number: $value } }) { ${ITEM_FRAGMENT} }
          }`,
        buildVariables: (base, raw) => ({ ...base, value: Number(raw) }),
      };
    case 'DATE':
      return {
        buildMutation: () =>
          `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Date!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { date: $value } }) { ${ITEM_FRAGMENT} }
          }`,
        buildVariables: (base, raw) => ({ ...base, value: String(raw) }),
      };
    case 'SINGLE_SELECT':
      return {
        buildMutation: () =>
          `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $value } }) { ${ITEM_FRAGMENT} }
          }`,
        buildVariables: (base, raw) => {
          let optionId = String(raw);
          if (options) {
            const match = options.find(o => o.name === raw || o.id === raw);
            if (match) optionId = match.id;
          }
          return { ...base, value: optionId };
        },
      };
    case 'ITERATION':
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
    default:
      throw new ValidationError(`Unsupported field type: ${dataType}`);
  }
}

/**
 * Service for managing GitHub Projects v2 custom field values.
 *
 * Handles:
 * - Setting field values (text, number, date, single select, iteration)
 * - Getting field values for project items
 * - Clearing field values
 *
 * Uses GraphQL mutations to interact with the GitHub Projects v2 API.
 * Supports field types: TEXT, NUMBER, DATE, SINGLE_SELECT, ITERATION.
 *
 * Can be instantiated directly with a GitHubRepositoryFactory or via dependency injection.
 */
export class FieldValueService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  async setFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
    value: unknown;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      const fieldQuery = `
        query($projectId: ID!, $fieldId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              field(id: $fieldId) {
                ... on ProjectV2Field { id name dataType }
                ... on ProjectV2IterationField { id name dataType }
                ... on ProjectV2SingleSelectField { id name dataType options { id name } }
              }
            }
          }
        }
      `;

      interface FieldQueryResponse {
        node: {
          field: {
            id: string;
            name: string;
            dataType: string;
            options?: Array<{ id: string; name: string }>;
          };
        };
      }

      const fieldResponse = await this.factory.graphql<FieldQueryResponse>(fieldQuery, {
        projectId: data.projectId,
        fieldId: data.fieldId
      });

      if (!fieldResponse.node?.field) {
        throw new ResourceNotFoundError(ResourceType.FIELD, data.fieldId);
      }

      const field = fieldResponse.node.field;
      const strategy = makeStrategy(field.dataType, field.options);
      const mutation = strategy.buildMutation();
      const variables = strategy.buildVariables(
        { projectId: data.projectId, itemId: data.itemId, fieldId: data.fieldId },
        data.value
      );

      await this.factory.graphql(mutation, variables);
      return { success: true, message: `Field ${field.name} updated successfully` };
    });
  }

  async getFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
  }): Promise<{ fieldId: string; fieldName: string; value: unknown; type: string }> {
    return safeCall(async () => {
      const query = `
        query($itemId: ID!) {
          node(id: $itemId) {
            ... on ProjectV2Item {
              fieldValues(first: 50) {
                nodes {
                  ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2Field { id name } } }
                  ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2Field { id name } } }
                  ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2Field { id name } } }
                  ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2SingleSelectField { id name } } }
                  ... on ProjectV2ItemFieldIterationValue { title iterationId field { ... on ProjectV2IterationField { id name } } }
                }
              }
            }
          }
        }
      `;

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
              title?: string;
              iterationId?: string;
            }>;
          };
        };
      }

      const response = await this.factory.graphql<FieldValueResponse>(query, { itemId: data.itemId });

      if (!response.node?.fieldValues?.nodes) {
        throw new ResourceNotFoundError(ResourceType.FIELD, data.itemId);
      }

      const fieldValue = response.node.fieldValues.nodes.find(fv => fv.field?.id === data.fieldId);
      if (!fieldValue) {
        return { fieldId: data.fieldId, fieldName: 'unknown', value: null, type: 'unknown' };
      }

      let value: unknown = null;
      let type = 'unknown';

      if ('text' in fieldValue && fieldValue.text !== undefined) {
        value = fieldValue.text;
        type = 'TEXT';
      } else if ('number' in fieldValue && fieldValue.number !== undefined) {
        value = fieldValue.number;
        type = 'NUMBER';
      } else if ('date' in fieldValue && fieldValue.date !== undefined) {
        value = fieldValue.date;
        type = 'DATE';
      } else if ('optionId' in fieldValue) {
        value = { optionId: fieldValue.optionId, name: fieldValue.name };
        type = 'SINGLE_SELECT';
      } else if ('iterationId' in fieldValue) {
        value = { iterationId: fieldValue.iterationId, title: fieldValue.title };
        type = 'ITERATION';
      }

      return { fieldId: data.fieldId, fieldName: fieldValue.field?.name || 'unknown', value, type };
    });
  }

  async clearFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      const mutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
          clearProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }) {
            projectV2Item { id }
          }
        }
      `;

      await this.factory.graphql(mutation, {
        projectId: data.projectId,
        itemId: data.itemId,
        fieldId: data.fieldId
      });

      return { success: true, message: `Field ${data.fieldId} cleared successfully` };
    });
  }
}
