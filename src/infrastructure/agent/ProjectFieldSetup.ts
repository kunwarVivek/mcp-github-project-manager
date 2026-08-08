import { GitHubRepositoryFactory } from '../github/GitHubRepositoryFactory.js';
import { AGENT_FIELDS, AGENT_STATUS_OPTIONS } from '../../domain/agent-orchestration-types.js';
import type { CustomField, FieldType } from '../../domain/types.js';

/** GraphQL response shape for listing project fields. */
interface ListFieldsResponse {
  node: {
    fields: {
      nodes: Array<{
        __typename?: string;
        id?: string;
        name?: string;
        dataType?: string;
      }>;
    };
  } | null;
}

/** Describes a field to ensure on the project. */
interface FieldSpec {
  name: string;
  type: FieldType;
  options?: Array<{ name: string; color?: string; description?: string }>;
}

/**
 * Auto-creates the GitHub Project custom fields needed for agent orchestration.
 *
 * Idempotent: existing fields are left untouched; only missing ones are created.
 */
export class ProjectFieldSetup {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  /** Ensure all agent orchestration fields exist on the given project. */
  async ensureFields(projectId: string): Promise<{ created: string[]; existing: string[] }> {
    const specs: FieldSpec[] = [
      { name: AGENT_FIELDS.CLAIMED_BY, type: 'text' },
      { name: AGENT_FIELDS.CLAIMED_AT, type: 'text' },
      {
        name: AGENT_FIELDS.STATUS,
        type: 'single_select',
        options: AGENT_STATUS_OPTIONS.map(o => ({
          name: o.name,
          color: o.color,
          description: o.description,
        })),
      },
      { name: AGENT_FIELDS.WORK_BRANCH, type: 'text' },
      { name: AGENT_FIELDS.PR_NUMBER, type: 'number' },
    ];

    const existingFields = await this.listProjectFields(projectId);
    const existingNames = new Set(existingFields.map(f => f.name));

    const created: string[] = [];
    const existing: string[] = [];
    const projectRepo = this.factory.createProjectRepository();

    for (const spec of specs) {
      if (existingNames.has(spec.name)) {
        existing.push(spec.name);
        continue;
      }

      const fieldData: Omit<CustomField, 'id'> = {
        name: spec.name,
        type: spec.type,
        options: spec.options?.map(o => ({ id: '', ...o })),
      };

      await projectRepo.createField(projectId, fieldData);
      created.push(spec.name);
    }

    return { created, existing };
  }

  /**
   * List all custom fields on a project via GraphQL.
   *
   * The repository's `findById` currently returns `fields: []`,
   * so we query the fields connection directly.
   *
   * Gracefully handles corrupt or deleted fields by filtering out nodes
   * that have no valid id/name (e.g. stale union members from deleted fields).
   */
  private async listProjectFields(
    projectId: string,
  ): Promise<Array<{ id: string; name: string; dataType: string }>> {
    // ProjectV2.fields is a union (ProjectV2FieldConfiguration) — select
    // __typename plus the fields shared by every member, then map dataType
    // from the concrete types below.
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 100) {
              nodes {
                __typename
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2IterationField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2DateField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2NumberField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2TrackerField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2LabelsField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2MilestoneField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2RepositoryField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2PullRequestField {
                  id
                  name
                  dataType
                }
              }
            }
          }
        }
      }
    `;

    let response: ListFieldsResponse;
    try {
      response = await this.factory.graphql<ListFieldsResponse>(query, {
        projectId,
      });
    } catch {
      // If the fields query fails (e.g., corrupt field IDs), return empty
      // so ensureFields can still proceed with creating missing fields.
      return [];
    }

    return (response.node?.fields.nodes ?? [])
      .filter((node) => node.id && node.name) // Skip corrupt fields with no id/name
      .map((node) => ({
        id: node.id ?? '',
        name: node.name ?? '',
        dataType: node.dataType ?? (node.__typename === 'ProjectV2SingleSelectField' ? 'SINGLE_SELECT' : 'TEXT'),
      }));
  }
}
