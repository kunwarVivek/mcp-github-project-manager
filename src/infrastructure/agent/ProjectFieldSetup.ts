import { AGENT_FIELDS, AGENT_STATUS_OPTIONS } from "../../domain/agent-orchestration-types.js";
import type { CustomField, FieldType } from "../../domain/types.js";
import type { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory.js";
import { projectFieldUnionSelection } from "../github/project-field-fragments";
import { toGraphQLOptionColor } from "../github/util/graphql-helpers";

/** GraphQL response shape for listing project fields. */
interface ListFieldsResponse {
  node: {
    fields: {
      nodes: Array<{
        __typename?: string;
        id?: string;
        name?: string;
        dataType?: string;
        options?: Array<{
          id?: string;
          name?: string | null;
          description?: string | null;
          color?: string | null;
        } | null> | null;
      }>;
    };
  } | null;
}

/** A single-select option as the inspection reports it. */
interface ListedProjectOption {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
}

interface ListedProjectField {
  id: string;
  name: string;
  dataType: string;
  options?: ListedProjectOption[];
}

/** Describes a field to ensure on the project. */
interface FieldSpec {
  name: string;
  type: FieldType;
  dataType: string;
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

  /**
   * Ensure all agent orchestration fields exist on the given project.
   *
   * Idempotent: existing fields are kept. A field whose type cannot carry the
   * orchestrator's data is a hard error (a human has to rename or recreate
   * it). A single-select field that is missing a status option is healed by
   * adding the missing option — a project created by an older version must
   * keep working, and the orchestrator writes exactly these status values.
   */
  async ensureFields(
    projectId: string
  ): Promise<{ created: string[]; existing: string[]; optionsAdded: string[] }> {
    const specs: FieldSpec[] = [
      { name: AGENT_FIELDS.CLAIMED_BY, type: "text", dataType: "TEXT" },
      { name: AGENT_FIELDS.CLAIMED_AT, type: "text", dataType: "TEXT" },
      {
        name: AGENT_FIELDS.STATUS,
        type: "single_select",
        dataType: "SINGLE_SELECT",
        options: AGENT_STATUS_OPTIONS.map((o) => ({
          name: o.name,
          color: o.color,
          description: o.description,
        })),
      },
      { name: AGENT_FIELDS.WORK_BRANCH, type: "text", dataType: "TEXT" },
      { name: AGENT_FIELDS.PR_NUMBER, type: "number", dataType: "NUMBER" },
    ];

    const existingFields = await this.listProjectFields(projectId);
    const existingByName = new Map(existingFields.map((f) => [f.name, f]));

    const created: string[] = [];
    const existing: string[] = [];
    const optionsAdded: string[] = [];
    const projectRepo = this.factory.createProjectRepository();

    for (const spec of specs) {
      const existingField = existingByName.get(spec.name);
      if (existingField) {
        ProjectFieldSetup.assertCompatibleType(existingField, spec);
        const missing = ProjectFieldSetup.missingOptions(existingField, spec);
        if (missing.length > 0) {
          await this.addSingleSelectOptions(existingField, spec);
          for (const option of missing) {
            optionsAdded.push(`${spec.name}:${option.name}`);
          }
        }
        existing.push(spec.name);
        continue;
      }

      const fieldData: Omit<CustomField, "id"> = {
        name: spec.name,
        type: spec.type,
        options: spec.options?.map((o) => ({ id: "", ...o })),
      };

      await projectRepo.createField(projectId, fieldData);
      created.push(spec.name);
    }

    return { created, existing, optionsAdded };
  }

  /**
   * A field whose type cannot carry the orchestrator's data is unusable and
   * must be fixed by a human — renaming or recreating it is the only way.
   */
  private static assertCompatibleType(field: ListedProjectField, spec: FieldSpec): void {
    if (field.dataType !== spec.dataType) {
      throw new Error(
        `Project field "${spec.name}" exists with incompatible data type "${field.dataType}"; ` +
          `expected "${spec.dataType}".`
      );
    }
  }

  /**
   * Status options the orchestrator needs but the field does not have yet.
   *
   * `options === undefined` means the inspection did not report options for
   * the field (the field is not a single-select, or GitHub did not return
   * them) — there is nothing to reconcile, so nothing is added.
   */
  private static missingOptions(
    field: ListedProjectField,
    spec: FieldSpec
  ): Array<{ name: string; color?: string; description?: string }> {
    if (!spec.options || !field.options) return [];

    const existingNames = new Set(field.options.map((option) => option.name));
    return spec.options.filter((option) => !existingNames.has(option.name));
  }

  /**
   * Add the missing options to an existing single-select field.
   *
   * GitHub has no "add option" mutation: the option set of a single-select
   * field is REPLACED by the list sent with `updateProjectV2Field`, and an
   * option sent without its `id` is a new one while an option sent with its
   * `id` keeps its identity. The full list is therefore sent — the options
   * the field already has (with their ids, descriptions and colors) plus the
   * ones that are missing — so the options that are already there are not
   * changed and the item values pointing at them survive.
   */
  private async addSingleSelectOptions(field: ListedProjectField, spec: FieldSpec): Promise<void> {
    const existing = field.options ?? [];
    const existingNames = new Set(existing.map((option) => option.name));
    const missing = (spec.options ?? []).filter((option) => !existingNames.has(option.name));

    const options = [
      ...existing.map((option) => ({
        id: option.id,
        name: option.name,
        description: option.description ?? "",
        color: toGraphQLOptionColor(option.color),
      })),
      ...missing.map((option) => ({
        name: option.name,
        description: option.description ?? "",
        color: toGraphQLOptionColor(option.color),
      })),
    ];

    await this.factory.graphql(
      `mutation($input: UpdateProjectV2FieldInput!) {
        updateProjectV2Field(input: $input) {
          projectV2Field {
            ... on ProjectV2SingleSelectField {
              id
              name
            }
          }
        }
      }`,
      {
        input: {
          fieldId: field.id,
          singleSelectOptions: options,
        },
      }
    );
  }

  /**
   * List all custom fields on a project via GraphQL.
   *
   * The repository's `findById` currently returns `fields: []`,
   * so we query the fields connection directly.
   *
   * Filters out corrupt or deleted fields that have no valid id/name (e.g.
   * stale union members from deleted fields), but lets GraphQL inspection
   * failures propagate to callers instead of pretending no fields exist.
   */
  private async listProjectFields(projectId: string): Promise<ListedProjectField[]> {
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
                ${projectFieldUnionSelection({
                  singleSelect: "options { id name description color }",
                })}
              }
            }
          }
        }
      }
    `;

    const response = await this.factory.graphql<ListFieldsResponse>(query, {
      projectId,
    });

    const fields = response.node?.fields.nodes;
    if (!fields) {
      throw new Error(`Unable to inspect project fields for project ${projectId}.`);
    }

    return fields
      .filter((node) => node.id && node.name) // Skip corrupt fields with no id/name
      .map((node) => ({
        id: node.id ?? "",
        name: node.name ?? "",
        dataType: node.dataType ?? "UNKNOWN",
        // The option id is what keeps an option's identity when the option
        // set is written back, so it has to be read as well as the name.
        options: node.options
          ?.filter(
            (
              option
            ): option is {
              id: string;
              name: string;
              description?: string | null;
              color?: string | null;
            } => Boolean(option?.id && option?.name)
          )
          .map((option) => ({
            id: option.id,
            name: option.name,
            description: option.description ?? null,
            color: option.color ?? null,
          })),
      }));
  }
}
