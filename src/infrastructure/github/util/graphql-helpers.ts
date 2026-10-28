import type { FieldType } from "../../../domain/types";
import type { GraphQLFieldType } from "../graphql-types";

/**
 * The field types GitHub's `ProjectV2CustomFieldType` can create.
 *
 * Kept in one place so the public tool schemas, the domain union and the
 * GraphQL mapping cannot drift apart.
 */
export const CREATABLE_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "single_select",
  "multi_select",
  "iteration",
] as const;

export type CreatableFieldType = (typeof CREATABLE_FIELD_TYPES)[number];

/**
 * Maps a domain field type to the GraphQL field type used to CREATE it.
 *
 * `createProjectV2Field` takes a `ProjectV2CustomFieldType`, which knows only
 * DATE, ITERATION, MULTI_SELECT, NUMBER, SINGLE_SELECT and TEXT. The other
 * project fields (assignees, labels, milestone, repository, tracked by,
 * tracks) are BUILT-IN fields that GitHub adds itself and that cannot be
 * created through the API — sending one is a schema error ("Expected type
 * ProjectV2CustomFieldType, found MILESTONE"), so it is rejected here with a
 * message that says what can be created instead.
 */
export function mapToGraphQLFieldType(fieldType: FieldType): GraphQLFieldType {
  switch (fieldType) {
    case "text":
      return "TEXT";
    case "number":
      return "NUMBER";
    case "date":
      return "DATE";
    case "single_select":
      return "SINGLE_SELECT";
    case "multi_select":
      return "MULTI_SELECT";
    case "iteration":
      return "ITERATION";
    default: {
      // A value that reached this point bypassed the public schema (a stored
      // or hand-built argument). It is refused with the list of types that
      // CAN be created instead of being silently turned into a text field.
      const unsupported = fieldType as string;
      throw new Error(
        `GitHub Projects cannot create a "${unsupported}" field — it is a built-in project field. ` +
          `Create a ${CREATABLE_FIELD_TYPES.join(", ")} field instead.`
      );
    }
  }
}

/**
 * Maps a GraphQL field data type to a domain field type.
 *
 * Only the six creatable types have a domain counterpart: the built-in
 * project fields (Assignees, Labels, Milestone, Repository, Tracked by, …)
 * are not fields this API can create or edit, and reporting one as if it
 * were would be a lie. They are refused with a message that says so.
 */
export function mapFromGraphQLFieldType(fieldType: string): FieldType {
  switch (fieldType) {
    case "TEXT":
      return "text";
    case "NUMBER":
      return "number";
    case "DATE":
      return "date";
    case "SINGLE_SELECT":
      return "single_select";
    case "MULTI_SELECT":
      return "multi_select";
    case "ITERATION":
      return "iteration";
    default:
      throw new Error(
        `"${fieldType}" is a built-in GitHub project field that the API cannot create or edit — ` +
          `custom field types are ${CREATABLE_FIELD_TYPES.join(", ")}.`
      );
  }
}

/** The single-select option colors GitHub's GraphQL API accepts. */
export const SINGLE_SELECT_OPTION_COLORS = [
  "GRAY",
  "BLUE",
  "GREEN",
  "YELLOW",
  "ORANGE",
  "RED",
  "PURPLE",
  "PINK",
] as const;

export type SingleSelectOptionColor = (typeof SINGLE_SELECT_OPTION_COLORS)[number];

/**
 * Map a free-form color to one GitHub accepts.
 *
 * `ProjectV2SingleSelectFieldOptionColor` is a closed enum — an unknown value
 * is a schema error, so a color GitHub does not know falls back to GRAY
 * instead of failing the whole call.
 */
export function toGraphQLOptionColor(color: string | null | undefined): SingleSelectOptionColor {
  const upper = (color ?? "").trim().toUpperCase();
  return (SINGLE_SELECT_OPTION_COLORS as readonly string[]).includes(upper)
    ? (upper as SingleSelectOptionColor)
    : "GRAY";
}

/**
 * A GraphQL `Date` is `YYYY-MM-DD`; an ISO timestamp is rejected by the API.
 */
export function toGraphQLDate(value: string | Date | null | undefined): string {
  if (value instanceof Date) return value.toISOString().split("T")[0];
  const text = (value ?? "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: "${text}"`);
  }
  return parsed.toISOString().split("T")[0];
}

/** The payload of one entry of a field's `singleSelectOptions`/`multiSelectOptions` list. */
export interface FieldOptionInput {
  id?: string;
  name: string;
  description: string;
  color: SingleSelectOptionColor;
}

/**
 * Build the option payload of a single-select or multi-select field.
 *
 * GitHub has no "add option" mutation: the option set of a select field is
 * REPLACED by the list sent with `updateProjectV2Field` (or with
 * `createProjectV2Field`), and an option sent WITHOUT its `id` is a new
 * option while one sent WITH its `id` keeps its identity. Sending the whole
 * list — the existing options with their ids, plus the ones that are missing
 * — therefore adds what is missing and leaves the identity (and the item
 * values pointing at it) of what is already there untouched.
 */
export function buildFieldOptions(
  existing: Array<{ id?: string; name: string; color?: string; description?: string }>,
  desired: Array<{ id?: string; name: string; color?: string; description?: string }>
): FieldOptionInput[] {
  const byName = new Map(existing.map((option) => [option.name, option]));
  return desired.map((option) => {
    const current = byName.get(option.name);
    const id = current?.id ?? option.id;
    return {
      ...(id ? { id } : {}),
      name: option.name,
      description: option.description ?? current?.description ?? "",
      color: toGraphQLOptionColor(option.color ?? current?.color),
    };
  });
}

// GraphQL response helper types for GitHub API

/**
 * Base response type for all GraphQL responses
 */
export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
    extensions?: unknown;
  }>;
}

/**
 * Response type for creating a ProjectV2Field
 */
export interface CreateProjectV2FieldResponse {
  createProjectV2Field: {
    projectV2Field: {
      id: string;
      name: string;
    };
  };
}

/**
 * Response type for getting a project
 */
export interface GetProjectResponse {
  repository: {
    projectV2: {
      id: string;
      title: string;
      number: number;
      closed: boolean;
      url: string;
      shortDescription: string;
      public: boolean;
      owner: {
        login: string;
      };
      creator: {
        login: string;
      };
      createdAt: string;
      updatedAt: string;
    };
  };
}

/**
 * Response type for listing projects
 */
export interface ListProjectsResponse {
  repository: {
    projectsV2: {
      nodes: Array<{
        id: string;
        title: string;
        number: number;
        closed: boolean;
        url: string;
        shortDescription: string;
        public: boolean;
        owner: {
          login: string;
        };
        creator: {
          login: string;
        };
        createdAt: string;
        updatedAt: string;
      }>;
    };
  };
}

/**
 * Response type for getting a project item
 */
export interface GetProjectItemResponse {
  node: {
    id: string;
    type: string;
    fieldValues: {
      nodes: Array<{
        field: {
          id: string;
          name: string;
        };
        value?: unknown;
      }>;
    };
    content: {
      __typename: string;
      title?: string;
      number?: number;
      body?: string;
      state?: string;
      url?: string;
      createdAt?: string;
      updatedAt?: string;
      author?: {
        login: string;
      };
      repository?: {
        name: string;
        owner: {
          login: string;
        };
      };
    };
  };
}

/**
 * Response type for listing project items
 */
export interface ListProjectItemsResponse {
  repository: {
    projectV2: {
      items: {
        nodes: Array<{
          id: string;
          type: string;
          fieldValues: {
            nodes: Array<{
              field: {
                id: string;
                name: string;
              };
              value?: unknown;
            }>;
          };
          content: {
            __typename: string;
            title?: string;
            number?: number;
            body?: string;
            state?: string;
            url?: string;
            createdAt?: string;
            updatedAt?: string;
            author?: {
              login: string;
            };
            repository?: {
              name: string;
              owner: {
                login: string;
              };
            };
          };
        }>;
      };
    };
  };
}

/**
 * Response type for updating a ProjectV2Field
 */
export interface UpdateProjectV2FieldResponse {
  updateProjectV2Field: {
    projectV2Field: {
      id: string;
      name: string;
      dataType?: string;
    };
  };
}
