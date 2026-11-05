import type {
  AnalyticsItem,
  AnalyticsItemSet,
  AnalyticsItemType,
} from "../../../domain/analytics-types";
import { collectConnection, MAX_CONNECTION_PAGES } from "../util/paginate";
import { BaseGitHubRepository } from "./BaseRepository";

const LIST_ANALYTICS_ITEMS_QUERY = `
  query ListAnalyticsItems($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: $first, after: $after) {
          nodes {
            id
            createdAt
            updatedAt
            content {
              __typename
              ... on Issue {
                createdAt
                closedAt
                state
                milestone { title dueOn state }
              }
              ... on PullRequest {
                createdAt
                closedAt
                mergedAt
                state
                milestone { title dueOn state }
              }
              ... on DraftIssue {
                createdAt
              }
            }
            fieldValues(first: 20) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2FieldCommon { name } }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field { ... on ProjectV2FieldCommon { name } }
                }
                ... on ProjectV2ItemFieldIterationValue {
                  iterationId
                  title
                  startDate
                  duration
                }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

const PAGE_SIZE = 100;

/** Number fields treated as the work estimate, in priority order. */
const POINTS_FIELD_NAMES = ["story points", "points", "estimate", "effort", "size"];

interface FieldValueNode {
  __typename?: string;
  name?: string;
  number?: number;
  iterationId?: string;
  title?: string;
  startDate?: string;
  duration?: number;
  field?: { name?: string } | null;
}

interface ItemNode {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  content?: {
    __typename?: string;
    createdAt?: string;
    closedAt?: string | null;
    mergedAt?: string | null;
    state?: string;
    milestone?: { title: string; dueOn?: string | null; state: string } | null;
  } | null;
  fieldValues?: { nodes?: Array<FieldValueNode | null> } | null;
}

interface ItemsResponse {
  node?: {
    items?: {
      nodes: ItemNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
}

const CONTENT_TYPES: Record<string, AnalyticsItemType> = {
  Issue: "ISSUE",
  PullRequest: "PULL_REQUEST",
  DraftIssue: "DRAFT_ISSUE",
};

/** Pick the points value: the highest-priority recognised number field name wins. */
function pickPoints(numbers: Array<{ field: string; value: number }>): number | null {
  for (const name of POINTS_FIELD_NAMES) {
    const hit = numbers.find((n) => n.field.toLowerCase() === name);
    if (hit) return hit.value;
  }
  return null;
}

/** Reduce one raw project item to the shape the analytics computations read. */
export function toAnalyticsItem(node: ItemNode): AnalyticsItem {
  const content = node.content ?? null;
  const fields: Record<string, string> = {};
  const numbers: Array<{ field: string; value: number }> = [];
  let iteration: AnalyticsItem["iteration"] = null;

  for (const value of node.fieldValues?.nodes ?? []) {
    if (!value) continue;
    const fieldName = value.field?.name;
    if (value.__typename === "ProjectV2ItemFieldSingleSelectValue" && fieldName && value.name) {
      fields[fieldName] = value.name;
    } else if (
      value.__typename === "ProjectV2ItemFieldNumberValue" &&
      fieldName &&
      typeof value.number === "number"
    ) {
      numbers.push({ field: fieldName, value: value.number });
    } else if (
      value.__typename === "ProjectV2ItemFieldIterationValue" &&
      value.iterationId &&
      value.startDate &&
      typeof value.duration === "number"
    ) {
      iteration = {
        id: value.iterationId,
        title: value.title ?? value.iterationId,
        startDate: value.startDate,
        duration: value.duration,
      };
    }
  }

  const statusKey = Object.keys(fields).find((k) => k.toLowerCase() === "status");
  const createdAt = content?.createdAt ?? node.createdAt ?? "";

  return {
    id: node.id,
    type: CONTENT_TYPES[content?.__typename ?? ""] ?? "UNKNOWN",
    createdAt,
    updatedAt: node.updatedAt ?? createdAt,
    closedAt: content?.mergedAt ?? content?.closedAt ?? null,
    state: content?.state ?? null,
    status: statusKey ? fields[statusKey] : null,
    points: pickPoints(numbers),
    iteration,
    milestone: content?.milestone
      ? {
          title: content.milestone.title,
          dueOn: content.milestone.dueOn ?? null,
          state: content.milestone.state,
        }
      : null,
    fields,
  };
}

/**
 * Reads every item of a Projects v2 project (status, iteration, estimate and
 * milestone data) through one cursor-paginated query for the analytics service.
 */
export class GitHubProjectAnalyticsRepository extends BaseGitHubRepository {
  /**
   * List the project's items, following pagination up to
   * {@link MAX_CONNECTION_PAGES} pages. `truncated` is true when more items exist.
   */
  async listItems(projectId: string): Promise<AnalyticsItemSet> {
    let found = false;
    let pages = 0;
    let lastHasNext = false;

    const nodes = await collectConnection<ItemNode>(
      async (after) => {
        const response = await this.graphql<ItemsResponse>(LIST_ANALYTICS_ITEMS_QUERY, {
          projectId,
          first: PAGE_SIZE,
          after,
        });
        const items = response.node?.items;
        if (!items) return null;
        found = true;
        pages++;
        lastHasNext = items.pageInfo?.hasNextPage ?? false;
        return items;
      },
      this.logger,
      `analytics items of project ${projectId}`
    );

    if (!found) {
      throw new Error(`Project '${projectId}' not found`);
    }

    return {
      items: nodes.map(toAnalyticsItem),
      truncated: pages >= MAX_CONNECTION_PAGES && lastHasNext,
    };
  }
}
