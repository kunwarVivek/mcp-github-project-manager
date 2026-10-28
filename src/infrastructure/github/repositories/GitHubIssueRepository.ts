import {
  blockerLabelName,
  ISSUE_TYPE_LABEL_PREFIX,
  parseBlockerLabelNumbers,
  parseIssueTypeLabel,
} from "../../../domain/entities/IssueEntity";
import { ResourceStatus } from "../../../domain/resource-types";
import type {
  CreateIssue,
  Issue,
  IssueDependency,
  IssueId,
  IssueProjectMembership,
  IssueRepository,
  IssueTypeDefinition,
} from "../../../domain/types";
import { parseResourceStatus, toStatusString } from "../../../domain/utils/StatusParser";
import { isMissingNativeCapability } from "../native-capability";
import { BaseGitHubRepository } from "./BaseRepository";
import {
  GitHubIssueDependencyRepository,
  type IssueEdgeNode,
} from "./GitHubIssueDependencyRepository";
import { GitHubIssueTypeRepository } from "./GitHubIssueTypeRepository";

/**
 * The issue fields every deployment has.
 */
const ISSUE_CORE_FIELDS = `
  id
  number
  title
  body
  state
  createdAt
  updatedAt
  assignees(first: 100) {
    nodes {
      login
    }
  }
  labels(first: 100) {
    nodes {
      name
    }
  }
  milestone {
    id
  }
`;

/**
 * GitHub's native issue capabilities.
 *
 * The schema was verified against the live API (2026-10-21):
 * `Issue.issueType: IssueType`, `Issue.blockedBy: IssueConnection!`,
 * `Issue.blocking: IssueConnection!` and
 * `Issue.projectItems(includeArchived: Boolean, ...): ProjectV2ItemConnection`.
 *
 * Not every deployment knows these fields, so they are only selected when
 * the caller asks for them — a deployment that lacks them falls back to the
 * plain issue fields.
 */
const ISSUE_NATIVE_FIELDS = `
  issueType {
    id
    name
  }
  blockedBy(first: 100) {
    nodes {
      id
      number
      title
      state
    }
  }
  blocking(first: 100) {
    nodes {
      id
      number
      title
      state
    }
  }
  projectItems(includeArchived: true, first: 100) {
    nodes {
      id
      project {
        id
        number
        title
      }
    }
  }
`;

interface GitHubIssue {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  assignees: {
    nodes: Array<{
      login: string;
    }>;
  };
  labels: {
    nodes: Array<{
      name: string;
    }>;
  };
  milestone: {
    id: string;
  } | null;
  /** Native issue capabilities — absent on deployments without them. */
  issueType?: {
    id: string;
    name: string;
  } | null;
  blockedBy?: {
    nodes: IssueEdgeNode[];
  } | null;
  blocking?: {
    nodes: IssueEdgeNode[];
  } | null;
  projectItems?: {
    nodes: Array<{
      id: string;
      project: {
        id: string;
        number: number;
        title: string;
      };
    }>;
  } | null;
}

interface CreateIssueResponse {
  createIssue: {
    issue: GitHubIssue;
  };
}

interface UpdateIssueResponse {
  updateIssue: {
    issue: GitHubIssue;
  };
}

interface GetIssueResponse {
  repository: {
    issue: GitHubIssue | null;
  };
}

interface ListIssuesResponse {
  repository: {
    issues: {
      nodes: GitHubIssue[];
    };
  };
}

/**
 * The projects an issue is a member of.
 *
 * `Issue.projectItems(includeArchived: true)` is GitHub's reverse
 * membership: it answers "which projects is this issue in?".
 */
const GET_PROJECT_MEMBERSHIP_QUERY = `
  query GetIssueProjectMembership($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        id
        number
        projectItems(includeArchived: true, first: 100) {
          nodes {
            id
            project {
              id
              number
              title
            }
          }
        }
      }
    }
  }
`;

interface GetProjectMembershipResponse {
  node: {
    id: string;
    number: number;
    projectItems: {
      nodes: Array<{
        id: string;
        project: {
          id: string;
          number: number;
          title: string;
        };
      }>;
    } | null;
  } | null;
}

/** The labels of an issue. */
const GET_ISSUE_LABELS_QUERY = `
  query GetIssueLabels($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        id
        labels(first: 100) {
          nodes {
            name
          }
        }
      }
    }
  }
`;

interface GetIssueLabelsResponse {
  node: {
    id: string;
    labels: { nodes: Array<{ name: string }> };
  } | null;
}

/** The labels of the repository. */
const GET_REPOSITORY_LABELS_QUERY = `
  query GetRepositoryLabels($owner: String!, $repo: String!, $first: Int!) {
    repository(owner: $owner, name: $repo) {
      labels(first: $first) {
        nodes {
          id
          name
        }
      }
    }
  }
`;

interface GetRepositoryLabelsResponse {
  repository: {
    labels: { nodes: Array<{ id: string; name: string }> };
  } | null;
}

/** Replace the labels of an issue. */
const UPDATE_ISSUE_LABELS_MUTATION = `
  mutation UpdateIssueLabels($input: UpdateIssueInput!) {
    updateIssue(input: $input) {
      issue {
        id
        number
      }
    }
  }
`;

interface UpdateIssueLabelsResponse {
  updateIssue: {
    issue: { id: string; number: number } | null;
  } | null;
}

/** An issue, addressed by its node id and its number. */
interface IssueRef {
  nodeId: string;
  number: number;
}

export class GitHubIssueRepository extends BaseGitHubRepository implements IssueRepository {
  private readonly dependencies = new GitHubIssueDependencyRepository(this.octokit, this.config);
  private readonly issueTypes = new GitHubIssueTypeRepository(this.octokit, this.config);

  private mapGitHubIssueToIssue(githubIssue: GitHubIssue): Issue {
    return {
      id: githubIssue.id,
      number: parseInt(githubIssue.number.toString(), 10),
      title: githubIssue.title,
      description: githubIssue.body || "",
      status: parseResourceStatus(githubIssue.state, "githubIssue"),
      assignees: githubIssue.assignees.nodes.map((node) => node.login),
      labels: githubIssue.labels.nodes.map((node) => node.name),
      milestoneId: githubIssue.milestone?.id,
      createdAt: githubIssue.createdAt,
      updatedAt: githubIssue.updatedAt,
      url: `https://github.com/${this.owner}/${this.repo}/issues/${githubIssue.number}`,
      issueTypeName: githubIssue.issueType?.name,
      issueTypeId: githubIssue.issueType?.id,
      blockedBy: githubIssue.blockedBy?.nodes.map((node) => node.number),
      blocking: githubIssue.blocking?.nodes.map((node) => node.number),
      projectIds: githubIssue.projectItems?.nodes.map((node) => node.project.id),
    };
  }

  async create(data: CreateIssue): Promise<Issue> {
    const mutation = `
      mutation($input: CreateIssueInput!) {
        createIssue(input: $input) {
          issue {
            id
            number
            title
            body
            state
            createdAt
            updatedAt
            assignees(first: 100) {
              nodes {
                login
              }
            }
            labels(first: 100) {
              nodes {
                name
              }
            }
            milestone {
              id
            }
          }
        }
      }
    `;

    // createIssue requires the repository node ID (e.g. 'R_kgDO...'), not the
    // configured repo name — resolve it first. Labels are passed as names
    // (e.g. 'bug', 'priority:medium'); the mutation requires label node IDs,
    // so resolve each name to its ID and skip labels that don't exist.
    const repositoryId = await this.resolveRepositoryNodeId(this.owner, this.repo);
    const labelIds = await this.resolveLabelNodeIds(data.labels);

    const response = await this.graphql<CreateIssueResponse>(mutation, {
      input: {
        repositoryId,
        title: data.title,
        body: data.description,
        assigneeIds: data.assignees,
        labelIds,
        milestoneId: data.milestoneId,
      },
    });

    return this.mapGitHubIssueToIssue(response.createIssue.issue);
  }

  async update(id: IssueId, data: Partial<Issue>): Promise<Issue> {
    // GraphQL updateIssue needs the node ID (e.g. "I_kwDO...").
    // Callers may pass a numeric string (issue number) — resolve it first.
    const nodeId = await this.resolveNodeId(id);

    // The native issue fields come back with the updated issue, so the
    // caller sees the same view as after a read.
    const mutation = (withNative: boolean) => `
      mutation($input: UpdateIssueInput!) {
        updateIssue(input: $input) {
          issue {
            ${ISSUE_CORE_FIELDS}
            ${withNative ? ISSUE_NATIVE_FIELDS : ""}
          }
        }
      }
    `;

    // updateIssue accepts labelIds (node IDs); resolve label names first
    const labelIds = await this.resolveLabelNodeIds(data.labels);

    const response = await this.withNativeFallback<UpdateIssueResponse>(mutation, {
      input: {
        id: nodeId,
        title: data.title,
        body: data.description,
        state: toStatusString(data.status || ResourceStatus.ACTIVE, "githubIssue"),
        assigneeIds: data.assignees,
        labelIds,
        milestoneId: data.milestoneId,
      },
    });

    return this.mapGitHubIssueToIssue(response.updateIssue.issue);
  }

  async delete(id: IssueId): Promise<void> {
    await this.update(id, { status: ResourceStatus.DELETED });
  }

  /** Resolve any issue ID format to its GraphQL node ID. */
  private async resolveNodeId(id: IssueId): Promise<string> {
    const parsed = parseInt(id, 10);
    if (isNaN(parsed) || String(parsed) !== id) return id; // already a node ID
    // Numeric — look up the issue to get the node ID
    const issue = await this.findByNumber(parsed);
    if (!issue) throw new Error(`Issue not found: ${id}`);
    return issue.id;
  }

  async findById(id: IssueId): Promise<Issue | null> {
    const issueNumber = parseInt(id, 10);

    // If id is a numeric string (e.g. "42"), query by issue number.
    // If id is a node ID (e.g. "I_kwDOTxNJaM8..."), query by node ID.
    if (!isNaN(issueNumber) && String(issueNumber) === id) {
      return this.findByNumber(issueNumber);
    }
    return this.findByNodeId(id);
  }

  private async findByNumber(number: number): Promise<Issue | null> {
    const response = await this.withNativeFallback<GetIssueResponse>(
      (withNative) => `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            ${ISSUE_CORE_FIELDS}
            ${withNative ? ISSUE_NATIVE_FIELDS : ""}
          }
        }
      }
    `,
      {
        owner: this.owner,
        repo: this.repo,
        number,
      }
    );

    const issue = response.repository.issue;
    if (!issue) return null;

    return this.mapGitHubIssueToIssue(issue);
  }

  private async findByNodeId(nodeId: string): Promise<Issue | null> {
    const response = await this.withNativeFallback<{ node: GitHubIssue | null }>(
      (withNative) => `
      query($id: ID!) {
        node(id: $id) {
          ... on Issue {
            ${ISSUE_CORE_FIELDS}
            ${withNative ? ISSUE_NATIVE_FIELDS : ""}
          }
        }
      }
    `,
      { id: nodeId }
    );
    if (!response.node) return null;

    return this.mapGitHubIssueToIssue(response.node);
  }

  /**
   * Run an issue query, retrying without the native issue fields when the
   * deployment does not know them.
   *
   * GitHub answers a query for an unknown field with a validation error, so
   * the plain issue fields are the safe fallback.
   */
  private async withNativeFallback<T>(
    buildQuery: (withNative: boolean) => string,
    variables: Record<string, unknown>
  ): Promise<T> {
    try {
      return await this.graphql<T>(buildQuery(true), variables);
    } catch (error) {
      if (!isMissingNativeCapability(error)) throw error;
      this.logger.warn(
        "This deployment does not expose GitHub's native issue fields - reading the plain issue fields"
      );
      return this.graphql<T>(buildQuery(false), variables);
    }
  }

  async findAll(): Promise<Issue[]> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          issues(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
            nodes {
              id
              number
              title
              body
              state
              createdAt
              updatedAt
              assignees(first: 100) {
                nodes {
                  login
                }
              }
              labels(first: 100) {
                nodes {
                  name
                }
              }
              milestone {
                id
              }
            }
          }
        }
      }
    `;

    const response = await this.graphql<ListIssuesResponse>(query, {
      owner: this.owner,
      repo: this.repo,
    });

    return response.repository.issues.nodes.map((issue) => this.mapGitHubIssueToIssue(issue));
  }

  async findByMilestone(milestoneId: string): Promise<Issue[]> {
    // `IssueFilters` has no `milestoneId` field — GitHub filters either by the
    // milestone's database id (`milestone`) or by its number
    // (`milestoneNumber`). The milestone id in this domain is the node id, so
    // the number is resolved first.
    const milestoneNumber = await this.resolveMilestoneNumber(milestoneId);
    if (milestoneNumber === null) {
      return [];
    }

    const query = `
      query($owner: String!, $repo: String!, $milestoneNumber: String!) {
        repository(owner: $owner, name: $repo) {
          issues(first: 100, filterBy: { milestoneNumber: $milestoneNumber }) {
            nodes {
              id
              number
              title
              body
              state
              createdAt
              updatedAt
              assignees(first: 100) {
                nodes {
                  login
                }
              }
              labels(first: 100) {
                nodes {
                  name
                }
              }
              milestone {
                id
              }
            }
          }
        }
      }
    `;

    const response = await this.graphql<ListIssuesResponse>(query, {
      owner: this.owner,
      repo: this.repo,
      milestoneNumber: String(milestoneNumber),
    });

    return response.repository.issues.nodes.map((issue) => this.mapGitHubIssueToIssue(issue));
  }

  /**
   * The number of a milestone, from its node id.
   *
   * `null` when the milestone does not exist (or is not visible).
   */
  private async resolveMilestoneNumber(milestoneId: string): Promise<number | null> {
    const query = `
      query($id: ID!) {
        node(id: $id) {
          ... on Milestone {
            number
          }
        }
      }
    `;

    const response = await this.graphql<{ node: { number: number } | null }>(query, {
      id: milestoneId,
    });

    return response.node?.number ?? null;
  }

  // =========================================================================
  // Native issue dependencies — GitHub's "blocked by" edges
  // =========================================================================

  /**
   * The issues that block the given issue.
   *
   * GitHub's native `blockedBy` edges are the source of truth. The
   * `blocked-by:#123` label emulation stays visible for edges that were
   * wired up before the native edges existed, and is the only source when
   * the deployment does not expose the native field at all.
   */
  async listBlockers(id: IssueId): Promise<IssueDependency[]> {
    const issue = await this.resolveIssueRef(id);

    try {
      const { edges, labels } = await this.dependencies.listBlockers(issue.nodeId);
      const dependencies: IssueDependency[] = edges.map((edge) => ({
        issueId: issue.nodeId,
        issueNumber: issue.number,
        blockingIssueId: edge.id,
        blockingIssueNumber: edge.number,
        title: edge.title,
        state: edge.state,
        source: "native",
      }));

      for (const number of parseBlockerLabelNumbers(labels)) {
        if (dependencies.some((dependency) => dependency.blockingIssueNumber === number)) continue;
        dependencies.push({
          issueId: issue.nodeId,
          issueNumber: issue.number,
          blockingIssueId: null,
          blockingIssueNumber: number,
          source: "label",
        });
      }

      return dependencies;
    } catch (error) {
      if (!isMissingNativeCapability(error)) throw error;
      this.logger.warn(
        "This deployment does not expose GitHub's native 'blockedBy' edges - falling back to the blocked-by label"
      );
      return this.labelBlockers(issue, await this.readIssueLabels(issue.nodeId));
    }
  }

  /**
   * The issues the given issue blocks.
   *
   * The native `blocking` edges only exist in GitHub's own direction; the
   * label emulation lives on the blocked issue, so the fallback looks for
   * the issues that declare "blocked-by:#<this issue>".
   */
  async listBlocking(id: IssueId): Promise<IssueDependency[]> {
    const issue = await this.resolveIssueRef(id);

    try {
      const edges = await this.dependencies.listBlocking(issue.nodeId);
      return edges.map((edge) => ({
        issueId: edge.id,
        issueNumber: edge.number,
        blockingIssueId: issue.nodeId,
        blockingIssueNumber: issue.number,
        title: edge.title,
        state: edge.state,
        source: "native" as const,
      }));
    } catch (error) {
      if (!isMissingNativeCapability(error)) throw error;
      this.logger.warn(
        "This deployment does not expose GitHub's native 'blocking' edges - falling back to the blocked-by label"
      );

      const issues = await this.findAll();
      return issues
        .filter((candidate) => parseBlockerLabelNumbers(candidate.labels).includes(issue.number))
        .map((candidate) => ({
          issueId: candidate.id,
          issueNumber: candidate.number,
          blockingIssueId: issue.nodeId,
          blockingIssueNumber: issue.number,
          source: "label" as const,
        }));
    }
  }

  /**
   * Makes the given issue blocked by another one.
   *
   * Uses GitHub's native `addBlockedBy` mutation; falls back to the
   * `blocked-by:#123` label when the deployment does not know the mutation.
   */
  async addBlocker(id: IssueId, blockingIssueId: IssueId): Promise<IssueDependency> {
    const issue = await this.resolveIssueRef(id);
    const blocker = await this.resolveIssueRef(blockingIssueId);

    try {
      const edge = await this.dependencies.addBlocker(issue.nodeId, blocker.nodeId);
      return {
        issueId: issue.nodeId,
        issueNumber: issue.number,
        blockingIssueId: edge.id,
        blockingIssueNumber: edge.number,
        title: edge.title,
        state: edge.state,
        source: "native",
      };
    } catch (error) {
      if (!isMissingNativeCapability(error)) throw error;
      this.logger.warn(
        "This deployment does not expose GitHub's native 'addBlockedBy' mutation - falling back to the blocked-by label"
      );

      const labelName = blockerLabelName(blocker.number);
      const labels = await this.readIssueLabels(issue.nodeId);
      if (!labels.includes(labelName)) {
        await this.applyLabels(issue.nodeId, [...labels, labelName]);
      }

      return {
        issueId: issue.nodeId,
        issueNumber: issue.number,
        blockingIssueId: blocker.nodeId,
        blockingIssueNumber: blocker.number,
        source: "label",
      };
    }
  }

  /**
   * Removes a "blocked by" edge.
   *
   * Uses GitHub's native `removeBlockedBy` mutation; falls back to removing
   * the `blocked-by:#123` label when the deployment does not know the
   * mutation.
   */
  async removeBlocker(id: IssueId, blockingIssueId: IssueId): Promise<void> {
    const issue = await this.resolveIssueRef(id);
    const blocker = await this.resolveIssueRef(blockingIssueId);

    try {
      await this.dependencies.removeBlocker(issue.nodeId, blocker.nodeId);
    } catch (error) {
      if (!isMissingNativeCapability(error)) throw error;
      this.logger.warn(
        "This deployment does not expose GitHub's native 'removeBlockedBy' mutation - falling back to the blocked-by label"
      );

      const labelName = blockerLabelName(blocker.number);
      const labels = await this.readIssueLabels(issue.nodeId);
      if (labels.includes(labelName)) {
        await this.applyLabels(
          issue.nodeId,
          labels.filter((label) => label !== labelName)
        );
      }
    }
  }

  // =========================================================================
  // Native issue types
  // =========================================================================

  /**
   * The issue type catalogue of the organization the configured owner belongs
   * to.
   *
   * Empty when the owner is a user account — issue types are an
   * organization-level feature.
   */
  async listIssueTypes(): Promise<IssueTypeDefinition[]> {
    return this.issueTypes.listIssueTypes();
  }

  /**
   * The native issue type of an issue.
   *
   * Falls back to the `type:` label emulation when the issue has no native
   * type, or when the deployment does not expose the native field.
   */
  async getIssueType(id: IssueId): Promise<IssueTypeDefinition | null> {
    const issue = await this.resolveIssueRef(id);

    try {
      const { type, labels } = await this.issueTypes.getIssueType(issue.nodeId);
      if (type) return type;

      const labelType = parseIssueTypeLabel(labels);
      return labelType ? { name: labelType, source: "label" } : null;
    } catch (error) {
      if (!isMissingNativeCapability(error)) throw error;
      this.logger.warn(
        "This deployment does not expose GitHub's native issue types - falling back to the type label"
      );

      const labelType = parseIssueTypeLabel(await this.readIssueLabels(issue.nodeId));
      return labelType ? { name: labelType, source: "label" } : null;
    }
  }

  /**
   * Sets the native issue type of an issue.
   *
   * @param issueType - An issue type node id (`IT_...`) or a type name.
   */
  async setIssueType(id: IssueId, issueType: string): Promise<IssueTypeDefinition | null> {
    const issue = await this.resolveIssueRef(id);

    let resolved: { id: string; name: string };
    try {
      resolved = await this.resolveIssueType(issueType);
    } catch {
      // The type is not in the organization's catalogue. The platform's own
      // `type:<name>` label is the other half of the convention (the agent
      // layer matches capabilities against it), so the label is written
      // instead of failing the call.
      await this.writeTypeLabel(issue.nodeId, issueType);
      return { name: issueType, source: "label" };
    }

    try {
      return await this.issueTypes.setIssueType(issue.nodeId, resolved.id);
    } catch (error) {
      if (!isMissingNativeCapability(error)) throw error;
      this.logger.warn(
        "This deployment does not expose GitHub's native issue types - falling back to the type label"
      );

      await this.writeTypeLabel(issue.nodeId, resolved.name);

      return { name: resolved.name, source: "label" };
    }
  }

  /** Replace the `type:` label of an issue with the given type name. */
  private async writeTypeLabel(issueNodeId: string, typeName: string): Promise<void> {
    const labels = await this.readIssueLabels(issueNodeId);
    const next = labels.filter((label) => !label.startsWith(ISSUE_TYPE_LABEL_PREFIX));
    next.push(`${ISSUE_TYPE_LABEL_PREFIX}${typeName.toLowerCase()}`);
    await this.applyLabels(issueNodeId, next);
  }

  // =========================================================================
  // Reverse membership — which projects is this issue in?
  // =========================================================================

  /**
   * The projects an issue is a member of.
   *
   * Read from GitHub's `Issue.projectItems(includeArchived: true)`, so a
   * caller can tell whether an issue is already tracked on another board.
   */
  async getProjectMembership(id: IssueId): Promise<IssueProjectMembership> {
    const issue = await this.resolveIssueRef(id);

    const response = await this.graphql<GetProjectMembershipResponse>(
      GET_PROJECT_MEMBERSHIP_QUERY,
      { issueId: issue.nodeId }
    );

    if (!response.node) {
      throw new Error(`Issue not found: ${id}`);
    }

    const items = response.node.projectItems?.nodes ?? [];
    return {
      issueId: issue.nodeId,
      projectIds: items.map((item) => item.project.id),
      itemIds: items.map((item) => item.id),
      projects: items.map((item) => ({
        id: item.project.id,
        number: item.project.number,
        title: item.project.title,
      })),
    };
  }

  /**
   * Whether an issue is a member of the given project.
   *
   * Answers the "the issue is not in the requested project" question from
   * live data instead of from a client-side guess.
   */
  async isInProject(id: IssueId, projectId: string): Promise<boolean> {
    const membership = await this.getProjectMembership(id);
    return membership.projectIds.includes(projectId);
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /** Resolve an issue reference to its node id and number. */
  private async resolveIssueRef(id: IssueId): Promise<IssueRef> {
    const parsed = parseInt(id, 10);
    const issue = !isNaN(parsed) && String(parsed) === id ? await this.findByNumber(parsed) : null;

    if (issue) return { nodeId: issue.id, number: issue.number };

    const byNodeId = await this.findByNodeId(id);
    if (!byNodeId) throw new Error(`Issue not found: ${id}`);

    return { nodeId: byNodeId.id, number: byNodeId.number };
  }

  /** The blockers an issue declares through the label emulation. */
  private labelBlockers(issue: IssueRef, labels: string[]): IssueDependency[] {
    return parseBlockerLabelNumbers(labels).map((number) => ({
      issueId: issue.nodeId,
      issueNumber: issue.number,
      blockingIssueId: null,
      blockingIssueNumber: number,
      source: "label" as const,
    }));
  }

  /** The labels of an issue. */
  private async readIssueLabels(issueNodeId: string): Promise<string[]> {
    const response = await this.graphql<GetIssueLabelsResponse>(GET_ISSUE_LABELS_QUERY, {
      issueId: issueNodeId,
    });

    if (!response.node) {
      throw new Error(`Issue with ID ${issueNodeId} not found`);
    }

    return response.node.labels?.nodes?.map((node) => node.name) ?? [];
  }

  /**
   * Replace the labels of an issue.
   *
   * Labels that do not exist in the repository yet are created first —
   * `updateIssue` silently drops unknown labels.
   */
  private async applyLabels(issueNodeId: string, labels: string[]): Promise<void> {
    const labelIds = await this.resolveOrCreateLabelIds(labels);

    await this.graphql<UpdateIssueLabelsResponse>(UPDATE_ISSUE_LABELS_MUTATION, {
      input: {
        id: issueNodeId,
        labelIds,
      },
    });
  }

  /** Resolve label names to ids, creating the labels that do not exist. */
  private async resolveOrCreateLabelIds(names: string[]): Promise<string[]> {
    if (names.length === 0) return [];

    const response = await this.graphql<GetRepositoryLabelsResponse>(GET_REPOSITORY_LABELS_QUERY, {
      owner: this.owner,
      repo: this.repo,
      first: 100,
    });

    const existing = new Map(
      (response.repository?.labels.nodes ?? []).map((label) => [label.name.toLowerCase(), label.id])
    );

    const ids: string[] = [];
    for (const name of names) {
      const known = existing.get(name.toLowerCase());
      if (known) {
        ids.push(known);
        continue;
      }
      ids.push(await this.createLabel(name));
    }

    return ids;
  }

  /** Create a repository label and return its GraphQL node id. */
  private async createLabel(name: string): Promise<string> {
    const created = await this.rest<{ id: number; node_id: string; name: string }>(
      (params) => this.octokit.rest.issues.createLabel(params),
      { name, color: "ededed" }
    );

    return created.node_id;
  }

  /**
   * Resolve an issue type reference (node id or name) to a native issue type.
   */
  private async resolveIssueType(issueType: string): Promise<{ id: string; name: string }> {
    const reference = issueType.trim();
    const catalogue = await this.listIssueTypes();

    const byId = catalogue.find((type) => type.id === reference);
    if (byId?.id) return { id: byId.id, name: byId.name };

    const byName = catalogue.find((type) => type.name.toLowerCase() === reference.toLowerCase());
    if (byName?.id) return { id: byName.id, name: byName.name };

    if (reference.startsWith("IT_")) {
      return { id: reference, name: reference };
    }

    const available = catalogue.map((type) => type.name).join(", ");
    throw new Error(
      `Unknown issue type "${issueType}". Available issue types: ${available || "none"}`
    );
  }
}
