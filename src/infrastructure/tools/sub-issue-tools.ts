/**
 * Sub-issue MCP tools for managing parent-child issue hierarchies.
 *
 * Provides 5 tools (GHAPI-01 to GHAPI-05):
 * - add_sub_issue: Adds an issue as a sub-issue of a parent
 * - list_sub_issues: Lists sub-issues for a parent issue
 * - get_parent_issue: Gets the parent issue for a sub-issue
 * - reprioritize_sub_issue: Changes sub-issue position within parent
 * - remove_sub_issue: Removes a sub-issue relationship
 *
 * All tools use issue numbers (not node IDs) for user convenience.
 * Node ID resolution is handled internally.
 */

import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations.js";
import { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory.js";
import {
  AddSubIssueInputSchema,
  AddSubIssueInput,
  ListSubIssuesInputSchema,
  ListSubIssuesInput,
  GetParentIssueInputSchema,
  GetParentIssueInput,
  ReprioritizeSubIssueInputSchema,
  ReprioritizeSubIssueInput,
  RemoveSubIssueInputSchema,
  RemoveSubIssueInput,
  SubIssueOperationOutputSchema,
  SubIssueOperationOutput,
  SubIssueListOutputSchema,
  SubIssueListOutput,
  ParentIssueOutputSchema,
  ParentIssueOutput,
  RemoveSubIssueOutputSchema,
  RemoveSubIssueOutput,
} from "./schemas/sub-issue-schemas.js";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a repository factory with the given credentials.
 */
function createFactory(owner: string, repo: string): GitHubRepositoryFactory {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  return new GitHubRepositoryFactory(token, owner, repo);
}

/**
 * Resolves an issue number to its GitHub node ID.
 *
 * This is needed because sub-issue mutations require node IDs,
 * but users provide issue numbers for convenience.
 */
async function resolveIssueNodeId(
  factory: GitHubRepositoryFactory,
  issueNumber: number
): Promise<string> {
  const query = `
    query GetIssueNodeId($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
        }
      }
    }
  `;

  interface IssueNodeIdResponse {
    repository: {
      issue: {
        id: string;
      } | null;
    };
  }

  const config = factory.getConfig();
  const response = await factory.graphql<IssueNodeIdResponse>(query, {
    owner: config.owner,
    repo: config.repo,
    number: issueNumber,
  });

  if (!response.repository.issue) {
    throw new Error(
      `Issue #${issueNumber} not found in ${config.owner}/${config.repo}`
    );
  }

  return response.repository.issue.id;
}

/**
 * Converts state from GitHub format (OPEN/CLOSED) to MCP format (open/closed).
 */
function normalizeState(state: "OPEN" | "CLOSED"): "open" | "closed" {
  return state === "OPEN" ? "open" : "closed";
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * add_sub_issue tool (GHAPI-01)
 *
 * Adds an existing issue as a sub-issue of a parent issue.
 */
export const addSubIssueTool: ToolDefinition<AddSubIssueInput, SubIssueOperationOutput> = {
  name: "add_sub_issue",
  title: "Add Sub-Issue",
  description:
    "Adds an existing issue as a sub-issue of a parent issue. Creates a parent-child hierarchy between issues.",
  schema: AddSubIssueInputSchema as unknown as ToolSchema<AddSubIssueInput>,
  outputSchema: SubIssueOperationOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Add sub-issue",
      description: "Add issue #123 as a sub-issue of issue #100",
      args: {
        owner: "octocat",
        repo: "hello-world",
        parentIssueNumber: 100,
        subIssueNumber: 123,
        replaceParent: false,
      },
    },
  ],
};

/**
 * list_sub_issues tool (GHAPI-02)
 *
 * Lists all sub-issues for a parent issue with pagination.
 */
export const listSubIssuesTool: ToolDefinition<ListSubIssuesInput, SubIssueListOutput> = {
  name: "list_sub_issues",
  title: "List Sub-Issues",
  description:
    "Lists all sub-issues for a parent issue. Returns sub-issues with their positions, summary statistics, and pagination info.",
  schema: ListSubIssuesInputSchema as unknown as ToolSchema<ListSubIssuesInput>,
  outputSchema: SubIssueListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List sub-issues",
      description: "Get all sub-issues for issue #100",
      args: {
        owner: "octocat",
        repo: "hello-world",
        issueNumber: 100,
        first: 20,
      },
    },
  ],
};

/**
 * get_parent_issue tool (GHAPI-03)
 *
 * Gets the parent issue for a sub-issue, if any.
 */
export const getParentIssueTool: ToolDefinition<GetParentIssueInput, ParentIssueOutput> = {
  name: "get_parent_issue",
  title: "Get Parent Issue",
  description:
    "Gets the parent issue for a sub-issue, if any. Returns null if the issue has no parent.",
  schema: GetParentIssueInputSchema as unknown as ToolSchema<GetParentIssueInput>,
  outputSchema: ParentIssueOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get parent issue",
      description: "Find the parent of issue #123",
      args: {
        owner: "octocat",
        repo: "hello-world",
        issueNumber: 123,
      },
    },
  ],
};

/**
 * reprioritize_sub_issue tool (GHAPI-04)
 *
 * Changes the position of a sub-issue within its parent's sub-issue list.
 */
export const reprioritizeSubIssueTool: ToolDefinition<
  ReprioritizeSubIssueInput,
  SubIssueOperationOutput
> = {
  name: "reprioritize_sub_issue",
  title: "Reprioritize Sub-Issue",
  description:
    "Changes the position of a sub-issue within its parent's sub-issue list. Omit afterIssueNumber to move to the beginning.",
  schema: ReprioritizeSubIssueInputSchema as unknown as ToolSchema<ReprioritizeSubIssueInput>,
  outputSchema: SubIssueOperationOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Move sub-issue to beginning",
      description: "Move issue #123 to the beginning of parent #100's sub-issues",
      args: {
        owner: "octocat",
        repo: "hello-world",
        parentIssueNumber: 100,
        subIssueNumber: 123,
      },
    },
    {
      name: "Move sub-issue after another",
      description: "Move issue #123 after issue #122 in parent #100's sub-issues",
      args: {
        owner: "octocat",
        repo: "hello-world",
        parentIssueNumber: 100,
        subIssueNumber: 123,
        afterIssueNumber: 122,
      },
    },
  ],
};

/**
 * remove_sub_issue tool (GHAPI-05)
 *
 * Removes a sub-issue from its parent (issue remains, just unlinked).
 */
export const removeSubIssueTool: ToolDefinition<RemoveSubIssueInput, RemoveSubIssueOutput> = {
  name: "remove_sub_issue",
  title: "Remove Sub-Issue",
  description:
    "Removes a sub-issue from its parent. The issue itself remains, only the parent-child relationship is removed.",
  schema: RemoveSubIssueInputSchema as unknown as ToolSchema<RemoveSubIssueInput>,
  outputSchema: RemoveSubIssueOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: "Remove sub-issue",
      description: "Remove issue #123 as a sub-issue of issue #100",
      args: {
        owner: "octocat",
        repo: "hello-world",
        parentIssueNumber: 100,
        subIssueNumber: 123,
      },
    },
  ],
};

// ============================================================================
// Tool Executors
// ============================================================================

/**
 * Execute add_sub_issue tool.
 *
 * Resolves issue numbers to node IDs and calls the repository.
 */
export async function executeAddSubIssue(
  args: AddSubIssueInput
): Promise<SubIssueOperationOutput> {
  const factory = createFactory(args.owner, args.repo);
  const repository = factory.createSubIssueRepository();

  // Resolve issue numbers to node IDs
  const [parentNodeId, subIssueNodeId] = await Promise.all([
    resolveIssueNodeId(factory, args.parentIssueNumber),
    resolveIssueNodeId(factory, args.subIssueNumber),
  ]);

  const result = await repository.addSubIssue(
    parentNodeId,
    subIssueNodeId,
    args.replaceParent ?? false
  );

  return {
    parentIssue: {
      id: result.issue.id,
      title: result.issue.title,
    },
    subIssue: {
      id: result.subIssue.id,
      number: result.subIssue.number,
      title: result.subIssue.title,
      state: normalizeState(result.subIssue.state),
      url: result.subIssue.url,
    },
  };
}

/**
 * Execute list_sub_issues tool.
 *
 * Resolves parent issue number to node ID and lists sub-issues.
 */
export async function executeListSubIssues(
  args: ListSubIssuesInput
): Promise<SubIssueListOutput> {
  const factory = createFactory(args.owner, args.repo);
  const repository = factory.createSubIssueRepository();

  // Resolve issue number to node ID
  const issueNodeId = await resolveIssueNodeId(factory, args.issueNumber);

  const result = await repository.listSubIssues(
    issueNodeId,
    args.first ?? 20,
    args.after
  );

  return {
    subIssues: result.subIssues.map((item) => ({
      id: item.id,
      number: item.number,
      title: item.title,
      state: normalizeState(item.state),
      url: item.url,
      position: item.position ?? 0,
    })),
    summary: {
      total: result.summary.total,
      completed: result.summary.completed,
      percentCompleted: result.summary.percentCompleted,
    },
    pageInfo: {
      hasNextPage: result.pageInfo.hasNextPage,
      endCursor: result.pageInfo.endCursor,
    },
    totalCount: result.totalCount,
  };
}

/**
 * Execute get_parent_issue tool.
 *
 * Resolves issue number to node ID and gets parent.
 */
export async function executeGetParentIssue(
  args: GetParentIssueInput
): Promise<ParentIssueOutput> {
  const factory = createFactory(args.owner, args.repo);
  const repository = factory.createSubIssueRepository();

  // Resolve issue number to node ID
  const issueNodeId = await resolveIssueNodeId(factory, args.issueNumber);

  const result = await repository.getParentIssue(issueNodeId);

  if (!result) {
    return { parent: null };
  }

  return {
    parent: {
      id: result.id,
      number: result.number,
      title: result.title,
      state: normalizeState(result.state),
      url: result.url,
    },
  };
}

/**
 * Execute reprioritize_sub_issue tool.
 *
 * Resolves all issue numbers to node IDs and reprioritizes.
 */
export async function executeReprioritizeSubIssue(
  args: ReprioritizeSubIssueInput
): Promise<SubIssueOperationOutput> {
  const factory = createFactory(args.owner, args.repo);
  const repository = factory.createSubIssueRepository();

  // Resolve issue numbers to node IDs
  const nodeIdPromises: Promise<string>[] = [
    resolveIssueNodeId(factory, args.parentIssueNumber),
    resolveIssueNodeId(factory, args.subIssueNumber),
  ];

  if (args.afterIssueNumber !== undefined) {
    nodeIdPromises.push(resolveIssueNodeId(factory, args.afterIssueNumber));
  }

  const nodeIds = await Promise.all(nodeIdPromises);
  const [parentNodeId, subIssueNodeId] = nodeIds;
  const afterNodeId = nodeIds.length > 2 ? nodeIds[2] : undefined;

  const result = await repository.reprioritizeSubIssue(
    parentNodeId,
    subIssueNodeId,
    afterNodeId
  );

  return {
    parentIssue: {
      id: result.issue.id,
      title: result.issue.title,
    },
    subIssue: {
      id: result.subIssue.id,
      number: result.subIssue.number,
      title: result.subIssue.title,
      state: normalizeState(result.subIssue.state),
      url: result.subIssue.url,
    },
  };
}

/**
 * Execute remove_sub_issue tool.
 *
 * Resolves issue numbers to node IDs and removes the relationship.
 */
export async function executeRemoveSubIssue(
  args: RemoveSubIssueInput
): Promise<RemoveSubIssueOutput> {
  const factory = createFactory(args.owner, args.repo);
  const repository = factory.createSubIssueRepository();

  // Resolve issue numbers to node IDs
  const [parentNodeId, subIssueNodeId] = await Promise.all([
    resolveIssueNodeId(factory, args.parentIssueNumber),
    resolveIssueNodeId(factory, args.subIssueNumber),
  ]);

  await repository.removeSubIssue(parentNodeId, subIssueNodeId);

  return {
    success: true,
    message: `Successfully removed issue #${args.subIssueNumber} as sub-issue of #${args.parentIssueNumber}`,
  };
}
