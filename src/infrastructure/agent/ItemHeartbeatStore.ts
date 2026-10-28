import { AGENT_FIELDS } from "../../domain/agent-orchestration-types.js";
import type { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory.js";
import { projectFieldUnionSelection } from "../github/project-field-fragments.js";

/**
 * Hot per-task agent state, stored on the claimed project item.
 *
 * A heartbeat used to be a commit on the `agent-registry` branch. It is now
 * three project fields on the item the agent holds — `agent_heartbeat_at`
 * (ISO text: a DATE field is day-granular), `agent_progress` (number) and
 * `agent_work_branch` (text) — written by the single agent that holds the
 * claim, so there is no writer contention and no commit noise. The registry
 * keeps identity, claim and budget only.
 */

/** The hot state read back from a claimed item. */
export interface ItemHeartbeat {
  /** ISO timestamp of the last heartbeat; absent right after a claim that never beat. */
  timestamp?: string;
  progress?: number;
  workBranch?: string;
}

/** A claimed task whose item should be read: the issue and who may hold its claim. */
export interface ItemClaim {
  issueNumber: number;
  /** The agent and its ancestors: a subagent inherits the claim its root holds. */
  claimantIds: string[];
}

/** The project lacks a field the heartbeat has to write. */
export class MissingAgentFieldError extends Error {
  readonly missing: string[];
  readonly projectId: string;

  constructor(projectId: string, missing: string[]) {
    super(
      `Project ${projectId} is missing the field${missing.length > 1 ? "s" : ""} ${missing.join(", ")}. ` +
        `Run agent_manage with action "setup_fields" and projectId "${projectId}" to provision ` +
        `${missing.length > 1 ? "them" : "it"} (additive: existing fields are untouched), then retry.`
    );
    this.name = "MissingAgentFieldError";
    this.missing = missing;
    this.projectId = projectId;
  }
}

/** The task's board item is not claimed by the heartbeating agent (any more). */
export class ClaimNotHeldError extends Error {
  readonly issueNumber: number;

  constructor(issueNumber: number, claimantIds: string[]) {
    super(
      `Task #${issueNumber} is not claimed by ${claimantIds[0]} on the project board: it was reclaimed or released. ` +
        `Check out a task again before sending more heartbeats.`
    );
    this.name = "ClaimNotHeldError";
    this.issueNumber = issueNumber;
  }
}

interface ItemTarget {
  projectId: string;
  itemId: string;
  /** Field ids by agent field name, as present on the project. */
  fieldIds: Map<string, string>;
  expiresAt: number;
}

interface ItemNode {
  id: string;
  project: { id: string };
  fieldValues: {
    nodes: Array<{ field?: { name: string }; text?: string; number?: number }>;
  };
}

interface IssueItemsNode {
  projectItems: { nodes: ItemNode[] };
}

const ITEM_FIELD_VALUES = `
  fieldValues(first: 30) {
    nodes {
      ... on ProjectV2ItemFieldTextValue { field { ... on ProjectV2Field { name } } text }
      ... on ProjectV2ItemFieldNumberValue { field { ... on ProjectV2Field { name } } number }
    }
  }`;

const ISSUE_ITEMS_SELECTION = `projectItems(first: 20, includeArchived: true) {
    nodes { id project { id } ${ITEM_FIELD_VALUES} }
  }`;

const LIST_FIELDS_QUERY = `
  query($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 50) {
          nodes {
            ${projectFieldUnionSelection()}
          }
        }
      }
    }
  }
`;

/** Issues read per GraphQL request when batching. */
const READ_BATCH_SIZE = 25;

/** How long a resolved item target (project, item, field ids) is trusted. */
const TARGET_TTL_MS = 5 * 60_000;

/**
 * Resolved targets shared by every store in the process. Tool executors build
 * their services per call, so a per-instance cache would never be hit.
 */
const sharedTargets = new Map<string, ItemTarget>();

/** Drop every cached target (tests). */
export function clearItemHeartbeatTargets(): void {
  sharedTargets.clear();
}

function textOf(node: ItemNode, fieldName: string): string | undefined {
  return node.fieldValues.nodes.find((v) => v.field?.name === fieldName)?.text;
}

function numberOf(node: ItemNode, fieldName: string): number | undefined {
  return node.fieldValues.nodes.find((v) => v.field?.name === fieldName)?.number;
}

function assertIssueNumber(issueNumber: number): void {
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new Error(`Invalid issue number for a heartbeat target: ${issueNumber}`);
  }
}

export class ItemHeartbeatStore {
  private readonly factory: GitHubRepositoryFactory;
  private readonly now: () => number;

  constructor(factory: GitHubRepositoryFactory, options: { now?: () => number } = {}) {
    this.factory = factory;
    this.now = options.now ?? Date.now;
  }

  private cacheKey(issueNumber: number): string {
    const { owner, repo } = this.factory.getConfig();
    return `${owner}/${repo}#${issueNumber}`;
  }

  /** Forget the resolved item of a task whose claim ended, so the next heartbeat re-verifies it. */
  forget(issueNumber: number): void {
    sharedTargets.delete(this.cacheKey(issueNumber));
  }

  /**
   * Write the heartbeat onto the item claimed for `issueNumber`.
   *
   * One GraphQL request when the item is already resolved: every field update
   * rides in the same document. `progress` and `workBranch` are written only
   * when supplied; the timestamp always is.
   *
   * @throws {MissingAgentFieldError} when a field to write is not on the project.
   * @throws {ClaimNotHeldError} when no item of the issue is claimed by a claimant.
   */
  async writeHeartbeat(params: {
    issueNumber: number;
    claimantIds: string[];
    timestamp: string;
    progress?: number;
    workBranch?: string;
  }): Promise<void> {
    assertIssueNumber(params.issueNumber);

    const cached = this.cachedTarget(params.issueNumber);
    if (cached) {
      try {
        await this.applyHeartbeat(cached, params);
        return;
      } catch {
        // The item may have moved, the project changed, or a missing field
        // been provisioned since the target was cached: re-resolve once. A
        // persistent failure surfaces from the fresh attempt below.
        this.forget(params.issueNumber);
      }
    }

    const target = await this.resolveTarget(params.issueNumber, params.claimantIds);
    await this.applyHeartbeat(target, params);
  }

  /**
   * Read the hot state of the items claimed for `claims`, batched.
   *
   * Returns the result keyed by issue number; an issue with no item claimed by
   * one of its claimants has no entry. Cost: one GraphQL request per
   * {@link READ_BATCH_SIZE} issues.
   */
  async readHeartbeats(claims: ItemClaim[]): Promise<Map<number, ItemHeartbeat>> {
    const claimantsByIssue = new Map<number, Set<string>>();
    for (const claim of claims) {
      assertIssueNumber(claim.issueNumber);
      const set = claimantsByIssue.get(claim.issueNumber) ?? new Set<string>();
      for (const id of claim.claimantIds) set.add(id);
      claimantsByIssue.set(claim.issueNumber, set);
    }

    const issues = [...claimantsByIssue.keys()];
    const result = new Map<number, ItemHeartbeat>();
    const { owner, repo } = this.factory.getConfig();

    for (let start = 0; start < issues.length; start += READ_BATCH_SIZE) {
      const batch = issues.slice(start, start + READ_BATCH_SIZE);
      const selections = batch
        .map((n, i) => `i${i}: issue(number: ${n}) { ${ISSUE_ITEMS_SELECTION} }`)
        .join("\n");
      const response = await this.factory.graphql<{
        repository: Record<string, IssueItemsNode | null>;
      }>(
        `query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            ${selections}
          }
        }`,
        { owner, repo }
      );

      batch.forEach((issueNumber, i) => {
        const claimants = claimantsByIssue.get(issueNumber);
        const item = response.repository[`i${i}`]?.projectItems.nodes.find((node) => {
          const claimedBy = textOf(node, AGENT_FIELDS.CLAIMED_BY);
          return claimedBy !== undefined && claimants?.has(claimedBy) === true;
        });
        if (!item) return;
        result.set(issueNumber, {
          timestamp: textOf(item, AGENT_FIELDS.HEARTBEAT_AT) || undefined,
          progress: numberOf(item, AGENT_FIELDS.PROGRESS),
          workBranch: textOf(item, AGENT_FIELDS.WORK_BRANCH) || undefined,
        });
      });
    }

    return result;
  }

  private cachedTarget(issueNumber: number): ItemTarget | undefined {
    const key = this.cacheKey(issueNumber);
    const target = sharedTargets.get(key);
    if (!target) return undefined;
    if (target.expiresAt <= this.now()) {
      sharedTargets.delete(key);
      return undefined;
    }
    return target;
  }

  private async resolveTarget(issueNumber: number, claimantIds: string[]): Promise<ItemTarget> {
    const { owner, repo } = this.factory.getConfig();
    const response = await this.factory.graphql<{
      repository: { issue: IssueItemsNode | null };
    }>(
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) { ${ISSUE_ITEMS_SELECTION} }
        }
      }`,
      { owner, repo, number: issueNumber }
    );

    const item = response.repository.issue?.projectItems.nodes.find((node) => {
      const claimedBy = textOf(node, AGENT_FIELDS.CLAIMED_BY);
      return claimedBy !== undefined && claimantIds.includes(claimedBy);
    });
    if (!item) throw new ClaimNotHeldError(issueNumber, claimantIds);

    const fields = await this.factory.graphql<{
      node: { fields: { nodes: Array<{ id: string; name: string }> } } | null;
    }>(LIST_FIELDS_QUERY, { projectId: item.project.id });
    const fieldIds = new Map<string, string>();
    for (const field of fields.node?.fields.nodes ?? []) {
      fieldIds.set(field.name, field.id);
    }

    const target: ItemTarget = {
      projectId: item.project.id,
      itemId: item.id,
      fieldIds,
      expiresAt: this.now() + TARGET_TTL_MS,
    };
    sharedTargets.set(this.cacheKey(issueNumber), target);
    return target;
  }

  private async applyHeartbeat(
    target: ItemTarget,
    params: { timestamp: string; progress?: number; workBranch?: string }
  ): Promise<void> {
    const updates: Array<{ field: string; type: "String" | "Float"; value: string | number }> = [
      { field: AGENT_FIELDS.HEARTBEAT_AT, type: "String", value: params.timestamp },
    ];
    if (params.progress !== undefined) {
      updates.push({ field: AGENT_FIELDS.PROGRESS, type: "Float", value: params.progress });
    }
    if (params.workBranch) {
      updates.push({ field: AGENT_FIELDS.WORK_BRANCH, type: "String", value: params.workBranch });
    }

    const missing = updates.filter((u) => !target.fieldIds.has(u.field)).map((u) => u.field);
    if (missing.length > 0) throw new MissingAgentFieldError(target.projectId, missing);

    const declarations = updates.map((u, i) => `$f${i}: ID!, $v${i}: ${u.type}!`).join(", ");
    const mutations = updates
      .map((u, i) => {
        const key = u.type === "Float" ? "number" : "text";
        return `u${i}: updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $f${i}, value: { ${key}: $v${i} } }) { projectV2Item { id } }`;
      })
      .join("\n");

    const variables: Record<string, string | number> = {
      projectId: target.projectId,
      itemId: target.itemId,
    };
    updates.forEach((u, i) => {
      variables[`f${i}`] = target.fieldIds.get(u.field) as string;
      variables[`v${i}`] = u.value;
    });

    await this.factory.graphql(
      `mutation($projectId: ID!, $itemId: ID!, ${declarations}) {\n${mutations}\n}`,
      variables
    );
  }
}
