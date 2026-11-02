import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type {
  GitHubProjectSearchRepository,
  IssueFieldValueNode,
  ProjectItemFieldValueNode,
  ProjectItemNode,
  SearchPageInfo,
} from "../infrastructure/github/repositories/GitHubProjectSearchRepository";

/** Separator between the names of a field value that holds several of them. */
const MULTI_VALUE_SEPARATOR = ", ";

const DEFAULT_SEARCH_PAGE_SIZE = 20;
const DEFAULT_ITEMS_PAGE_SIZE = 50;

export type ProjectItemType = "Issue" | "PullRequest" | "DraftIssue";

/**
 * Filter criteria for project items; all given criteria must match.
 */
export interface ProjectItemFilter {
  /** Single select value of the "Status" field. */
  status?: string;
  /** Item matches when it has at least one of these labels. */
  labels?: string[];
  /** Assignee login. */
  assignee?: string;
  /** Content type. */
  type?: ProjectItemType;
}

export interface IssueSearchResult {
  id: string;
  number: number;
  title: string;
  state: "OPEN" | "CLOSED";
  url: string;
  labels: string[];
  assignees: string[];
  /** Repository in owner/repo format. */
  repository: string;
}

export interface IssueSearchResults {
  totalCount: number;
  issues: IssueSearchResult[];
  pageInfo: SearchPageInfo;
}

export interface FilteredProjectItem {
  id: string;
  type: ProjectItemType;
  contentId: string | null;
  title: string;
  state: string | null;
  labels: string[];
  /** Field values by field name, each rendered as a flat string. */
  fieldValues: Record<string, string | null>;
}

export interface FilteredProjectItems {
  /** Items in the fetched page, before filtering. */
  totalCount: number;
  filteredCount: number;
  items: FilteredProjectItem[];
  pageInfo: SearchPageInfo;
}

/**
 * Join the names of a multi-valued field into one string.
 *
 * @returns the joined names, or null when there is none.
 */
function joinNames(names: string[]): string | null {
  const parts = names.filter((name) => name.length > 0);
  return parts.length > 0 ? parts.join(MULTI_VALUE_SEPARATOR) : null;
}

/** Render the value of an issue field (e.g. "Parent issue") as a string. */
function issueFieldValueToString(node: IssueFieldValueNode | null | undefined): string | null {
  if (!node) return null;

  switch (node.__typename) {
    case "IssueFieldSingleSelectValue":
      return node.name ?? (node.value != null ? String(node.value) : null);
    case "IssueFieldMultiSelectValue":
      return (
        joinNames(node.options?.map((option) => option.name) ?? []) ??
        (node.value != null ? String(node.value) : null)
      );
    default:
      return node.value != null ? String(node.value) : null;
  }
}

/**
 * Render one field value of a project item as a flat string.
 *
 * | kind                 | rendering                                    |
 * | -------------------- | -------------------------------------------- |
 * | text                 | the text                                     |
 * | number               | the number, e.g. "42"                        |
 * | date                 | the date, e.g. "2024-01-01"                  |
 * | single select        | the name of the selected option              |
 * | multi select         | the names of the selected options            |
 * | iteration            | the title of the iteration                   |
 * | label                | the names of the labels                      |
 * | milestone            | the title of the milestone                   |
 * | repository           | "owner/repo"                                 |
 * | reviewers            | the logins (users) or names (teams)          |
 * | users                | the logins                                   |
 * | linked pull requests | the PR numbers, e.g. "#123"                  |
 * | issue field          | the value of the underlying issue field      |
 *
 * Multi-valued kinds join their names with ", ".
 */
function fieldValueToString(node: ProjectItemFieldValueNode): string | null {
  switch (node.__typename) {
    case "ProjectV2ItemFieldTextValue":
      return node.text ?? null;
    case "ProjectV2ItemFieldNumberValue":
      return node.number != null ? String(node.number) : null;
    case "ProjectV2ItemFieldDateValue":
      return node.date ?? null;
    case "ProjectV2ItemFieldSingleSelectValue":
      return node.name ?? null;
    case "ProjectV2ItemFieldMultiSelectValue":
      return joinNames(node.options?.map((option) => option.name) ?? []);
    case "ProjectV2ItemFieldIterationValue":
      return node.title ?? node.iterationId ?? null;
    case "ProjectV2ItemFieldLabelValue":
      return joinNames(node.labels?.nodes.map((label) => label.name) ?? []);
    case "ProjectV2ItemFieldMilestoneValue":
      return node.milestone?.title ?? null;
    case "ProjectV2ItemFieldRepositoryValue":
      return node.repository?.nameWithOwner ?? null;
    case "ProjectV2ItemFieldReviewerValue":
      return joinNames(
        node.reviewers?.nodes.map((reviewer) => reviewer.login ?? reviewer.name ?? "") ?? []
      );
    case "ProjectV2ItemFieldUserValue":
      return joinNames(node.users?.nodes.map((user) => user.login) ?? []);
    case "ProjectV2ItemFieldPullRequestValue":
      return joinNames(
        node.pullRequests?.nodes.map((pullRequest) => `#${pullRequest.number}`) ?? []
      );
    case "ProjectV2ItemIssueFieldValue":
      return issueFieldValueToString(node.issueFieldValue);
    default:
      // A value without a type discriminator (a legacy fixture): fall back to
      // the option name or the text it carries.
      return node.name ?? node.text ?? null;
  }
}

/** Whether an item satisfies every given criterion of the filter. */
function matchesFilter(item: ProjectItemNode, filter: ProjectItemFilter): boolean {
  if (filter.type && item.content?.__typename !== filter.type) {
    return false;
  }

  if (filter.status) {
    const statusField = item.fieldValues.nodes.find((fv) => fv.field?.name === "Status");
    if (!statusField || statusField.name !== filter.status) {
      return false;
    }
  }

  // At least one of the specified labels
  if (filter.labels?.length) {
    const itemLabels = item.content?.labels?.nodes.map((l) => l.name) ?? [];
    if (!filter.labels.some((l) => itemLabels.includes(l))) {
      return false;
    }
  }

  if (filter.assignee) {
    const itemAssignees = item.content?.assignees?.nodes.map((a) => a.login) ?? [];
    if (!itemAssignees.includes(filter.assignee)) {
      return false;
    }
  }

  return true;
}

/**
 * Service for GitHub-side search: advanced issue search and filtering of a
 * project's items.
 *
 * GitHub offers no server-side filtering of project items, so the filter is
 * applied to the fetched page.
 */
export class ProjectSearchService {
  constructor(private readonly factory: GitHubRepositoryFactory) {}

  private get searchRepo(): GitHubProjectSearchRepository {
    return this.factory.createProjectSearchRepository();
  }

  /** Search issues with GitHub's query syntax (AND/OR/grouping supported). */
  async searchIssues(data: {
    query: string;
    first?: number;
    after?: string;
  }): Promise<IssueSearchResults> {
    const page = await this.searchRepo.searchIssues(
      data.query,
      data.first ?? DEFAULT_SEARCH_PAGE_SIZE,
      data.after
    );

    return {
      totalCount: page.totalCount,
      issues: page.issues.map((node) => ({
        id: node.id,
        number: node.number,
        title: node.title,
        state: node.state,
        url: node.url,
        labels: node.labels.nodes.map((l) => l.name),
        assignees: node.assignees.nodes.map((a) => a.login),
        repository: node.repository.nameWithOwner,
      })),
      pageInfo: page.pageInfo,
    };
  }

  /**
   * Fetch a page of a project's items and keep those matching `filter`.
   *
   * @throws Error if the project does not exist
   */
  async filterProjectItems(data: {
    projectId: string;
    filter: ProjectItemFilter;
    first?: number;
    after?: string;
  }): Promise<FilteredProjectItems> {
    const page = await this.searchRepo.listProjectItems(
      data.projectId,
      data.first ?? DEFAULT_ITEMS_PAGE_SIZE,
      data.after
    );

    const matching = page.items.filter((node) => matchesFilter(node, data.filter));

    return {
      totalCount: page.totalCount,
      filteredCount: matching.length,
      items: matching.map((node) => {
        const fieldValues: Record<string, string | null> = {};
        for (const fv of node.fieldValues.nodes) {
          const fieldName = fv.field?.name;
          if (fieldName) {
            fieldValues[fieldName] = fieldValueToString(fv);
          }
        }

        return {
          id: node.id,
          type: node.content?.__typename ?? "DraftIssue",
          contentId: node.content?.id ?? null,
          title: node.content?.title ?? "Untitled",
          state: node.content?.state ?? null,
          labels: node.content?.labels?.nodes.map((l) => l.name) ?? [],
          fieldValues,
        };
      }),
      pageInfo: page.pageInfo,
    };
  }
}
