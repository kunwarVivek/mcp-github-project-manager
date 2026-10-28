import { describe, expect, it, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubIssueRepository } from "../../../../../infrastructure/github/repositories/GitHubIssueRepository";
import type { OctokitInstance } from "../../../../../infrastructure/github/types";

/**
 * The native issue capabilities — GitHub's own issue edges, issue types and
 * project membership — and the label emulation that stays available as a
 * fallback for deployments that do not know the native fields.
 */

/** The error GitHub returns when the schema does not know a field. */
function missingFieldError(
  field: string,
  type: string
): Error & { errors: Array<{ message: string }> } {
  const message = `Field '${field}' doesn't exist on type '${type}'`;
  const error = new Error(message) as Error & { errors: Array<{ message: string }> };
  error.errors = [{ message }];
  return error;
}

interface GraphQLCall {
  query: string;
  variables: Record<string, unknown>;
}

type GraphQLHandler = (query: string, variables: Record<string, unknown>) => unknown;

function makeRepository(handler: GraphQLHandler) {
  const calls: GraphQLCall[] = [];
  const octokit = {
    graphql: vi.fn(async (query: string, variables: Record<string, unknown>) => {
      calls.push({ query, variables });
      return handler(query, variables);
    }),
    rest: {
      issues: {
        createLabel: vi.fn(async () => ({
          data: { id: 1, node_id: "LA_new", name: "blocked-by:#3" },
        })),
      },
    },
  } as unknown as OctokitInstance;

  const repository = new GitHubIssueRepository(
    octokit,
    new GitHubConfig("test-owner", "test-repo", "test-token")
  );

  return { repository, calls, octokit };
}

/** The plain issue read the repository issues before every native call. */
const ISSUE_READ = {
  repository: {
    issue: {
      id: "I_7",
      number: 7,
      title: "Blocked issue",
      body: "body",
      state: "OPEN",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      assignees: { nodes: [] },
      labels: { nodes: [] },
      milestone: null,
      issueType: null,
      blockedBy: { nodes: [] },
      blocking: { nodes: [] },
      projectItems: { nodes: [] },
    },
  },
};

/** The plain issue read, for the issue the query asks for. */
function issueRead(variables: Record<string, unknown>) {
  const number = Number(variables.number);
  return {
    repository: {
      issue: { ...ISSUE_READ.repository.issue, id: `I_${number}`, number },
    },
  };
}

describe("GitHubIssueRepository — native issue dependencies", () => {
  it("reads the native blocked-by edges", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query ListBlockers")) {
        return {
          node: {
            id: "I_7",
            number: 7,
            labels: { nodes: [] },
            blockedBy: {
              nodes: [{ id: "I_3", number: 3, title: "Blocker", state: "OPEN" }],
            },
          },
        };
      }
      return issueRead(variables);
    });

    const blockers = await repository.listBlockers("7");

    expect(blockers).toEqual([
      {
        issueId: "I_7",
        issueNumber: 7,
        blockingIssueId: "I_3",
        blockingIssueNumber: 3,
        title: "Blocker",
        state: "OPEN",
        source: "native",
      },
    ]);
  });

  it("keeps the label emulation visible next to the native edges", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query ListBlockers")) {
        return {
          node: {
            id: "I_7",
            number: 7,
            labels: { nodes: [{ name: "blocked-by:#5" }] },
            blockedBy: {
              nodes: [{ id: "I_3", number: 3, title: "Blocker", state: "OPEN" }],
            },
          },
        };
      }
      return issueRead(variables);
    });

    const blockers = await repository.listBlockers("7");

    expect(blockers.map((blocker) => [blocker.blockingIssueNumber, blocker.source])).toEqual([
      [3, "native"],
      [5, "label"],
    ]);
  });

  it("falls back to the label emulation when the native edge is missing", async () => {
    const { repository, calls } = makeRepository((query, variables) => {
      if (query.includes("query ListBlockers")) {
        throw missingFieldError("blockedBy", "Issue");
      }
      if (query.includes("query GetIssueLabels")) {
        return { node: { id: "I_7", labels: { nodes: [{ name: "blocked-by:#5" }] } } };
      }
      return issueRead(variables);
    });

    const blockers = await repository.listBlockers("7");

    expect(blockers).toEqual([
      {
        issueId: "I_7",
        issueNumber: 7,
        blockingIssueId: null,
        blockingIssueNumber: 5,
        source: "label",
      },
    ]);
    expect(calls.some((call) => call.query.includes("query GetIssueLabels"))).toBe(true);
  });

  it("reads the issues an issue blocks from the native blocking edges", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query ListBlocking")) {
        return {
          node: {
            id: "I_7",
            number: 7,
            blocking: {
              nodes: [{ id: "I_9", number: 9, title: "Downstream", state: "OPEN" }],
            },
          },
        };
      }
      return issueRead(variables);
    });

    const blocking = await repository.listBlocking("7");

    expect(blocking).toEqual([
      {
        issueId: "I_9",
        issueNumber: 9,
        blockingIssueId: "I_7",
        blockingIssueNumber: 7,
        title: "Downstream",
        state: "OPEN",
        source: "native",
      },
    ]);
  });

  it("adds a blocker with the native mutation", async () => {
    const { repository, calls } = makeRepository((query, variables) => {
      if (query.includes("mutation AddBlockedBy")) {
        return {
          addBlockedBy: {
            issue: { id: "I_7", number: 7 },
            blockingIssue: { id: "I_3", number: 3, title: "Blocker", state: "OPEN" },
          },
        };
      }
      return issueRead(variables);
    });

    const dependency = await repository.addBlocker("7", "3");

    expect(dependency).toEqual({
      issueId: "I_7",
      issueNumber: 7,
      blockingIssueId: "I_3",
      blockingIssueNumber: 3,
      title: "Blocker",
      state: "OPEN",
      source: "native",
    });

    const mutation = calls.find((call) => call.query.includes("mutation AddBlockedBy"));
    expect(mutation?.variables.input).toEqual({
      issueId: "I_7",
      blockingIssueId: "I_3",
    });
  });

  it("removes a blocker with the native mutation", async () => {
    const { repository, calls } = makeRepository((query, variables) => {
      if (query.includes("mutation RemoveBlockedBy")) {
        return {
          removeBlockedBy: {
            issue: { id: "I_7", number: 7 },
            blockingIssue: { id: "I_3", number: 3 },
          },
        };
      }
      return issueRead(variables);
    });

    await repository.removeBlocker("7", "3");

    const mutation = calls.find((call) => call.query.includes("mutation RemoveBlockedBy"));
    expect(mutation?.variables.input).toEqual({
      issueId: "I_7",
      blockingIssueId: "I_3",
    });
  });

  it("falls back to the blocked-by label when the native mutation is missing", async () => {
    const { repository, calls } = makeRepository((query, variables) => {
      if (query.includes("mutation AddBlockedBy")) {
        throw missingFieldError("addBlockedBy", "Mutation");
      }
      if (query.includes("query GetIssueLabels")) {
        return { node: { id: "I_7", labels: { nodes: [] } } };
      }
      if (query.includes("query GetRepositoryLabels")) {
        return { repository: { labels: { nodes: [] } } };
      }
      if (query.includes("mutation UpdateIssueLabels")) {
        return { updateIssue: { issue: { id: "I_7", number: 7 } } };
      }
      return issueRead(variables);
    });

    const dependency = await repository.addBlocker("7", "3");

    expect(dependency).toEqual({
      issueId: "I_7",
      issueNumber: 7,
      blockingIssueId: "I_3",
      blockingIssueNumber: 3,
      source: "label",
    });

    const update = calls.find((call) => call.query.includes("mutation UpdateIssueLabels"));
    expect(update?.variables.input).toEqual({ id: "I_7", labelIds: ["LA_new"] });
  });

  it("surfaces errors that are not about a missing native field", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query ListBlockers")) {
        throw new Error("Bad credentials");
      }
      return issueRead(variables);
    });

    await expect(repository.listBlockers("7")).rejects.toThrow("Bad credentials");
  });
});

describe("GitHubIssueRepository — native issue types", () => {
  it("reads the native issue type of an issue", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query GetIssueType")) {
        return {
          node: {
            id: "I_7",
            number: 7,
            labels: { nodes: [] },
            issueType: {
              id: "IT_1",
              name: "Bug",
              color: "RED",
              description: "An unexpected problem",
              isEnabled: true,
            },
          },
        };
      }
      return issueRead(variables);
    });

    const issueType = await repository.getIssueType("7");

    expect(issueType).toEqual({
      id: "IT_1",
      name: "Bug",
      color: "RED",
      description: "An unexpected problem",
      isEnabled: true,
      source: "native",
    });
  });

  it("falls back to the type label when the issue has no native type", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query GetIssueType")) {
        return {
          node: {
            id: "I_7",
            number: 7,
            labels: { nodes: [{ name: "type:bug" }] },
            issueType: null,
          },
        };
      }
      return issueRead(variables);
    });

    const issueType = await repository.getIssueType("7");

    expect(issueType).toEqual({ name: "bug", source: "label" });
  });

  it("falls back to the type label when the native field is missing", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query GetIssueType")) {
        throw missingFieldError("issueType", "Issue");
      }
      if (query.includes("query GetIssueLabels")) {
        return { node: { id: "I_7", labels: { nodes: [{ name: "type:bug" }] } } };
      }
      return issueRead(variables);
    });

    const issueType = await repository.getIssueType("7");

    expect(issueType).toEqual({ name: "bug", source: "label" });
  });

  it("writes the native issue type with the native mutation", async () => {
    const { repository, calls } = makeRepository((query, variables) => {
      if (query.includes("query ListIssueTypes")) {
        return {
          repository: {
            owner: {
              login: "test-owner",
              issueTypes: {
                nodes: [
                  {
                    id: "IT_1",
                    name: "Bug",
                    color: "RED",
                    description: null,
                    isEnabled: true,
                  },
                ],
              },
            },
          },
        };
      }
      if (query.includes("mutation UpdateIssueIssueType")) {
        return {
          updateIssueIssueType: {
            issue: {
              id: "I_7",
              number: 7,
              issueType: {
                id: "IT_1",
                name: "Bug",
                color: "RED",
                description: null,
                isEnabled: true,
              },
            },
          },
        };
      }
      return issueRead(variables);
    });

    const issueType = await repository.setIssueType("7", "Bug");

    expect(issueType).toEqual({
      id: "IT_1",
      name: "Bug",
      color: "RED",
      description: undefined,
      isEnabled: true,
      source: "native",
    });

    const mutation = calls.find((call) => call.query.includes("mutation UpdateIssueIssueType"));
    expect(mutation?.variables.input).toEqual({
      issueId: "I_7",
      issueTypeId: "IT_1",
    });
  });

  it("falls back to the type label when the native mutation is missing", async () => {
    const { repository, calls } = makeRepository((query, variables) => {
      if (query.includes("query ListIssueTypes")) {
        return {
          repository: {
            owner: {
              login: "test-owner",
              issueTypes: {
                nodes: [
                  {
                    id: "IT_1",
                    name: "Bug",
                    color: "RED",
                    description: null,
                    isEnabled: true,
                  },
                ],
              },
            },
          },
        };
      }
      if (query.includes("mutation UpdateIssueIssueType")) {
        throw missingFieldError("updateIssueIssueType", "Mutation");
      }
      if (query.includes("query GetIssueLabels")) {
        return { node: { id: "I_7", labels: { nodes: [] } } };
      }
      if (query.includes("query GetRepositoryLabels")) {
        return { repository: { labels: { nodes: [] } } };
      }
      if (query.includes("mutation UpdateIssueLabels")) {
        return { updateIssue: { issue: { id: "I_7", number: 7 } } };
      }
      return issueRead(variables);
    });

    const issueType = await repository.setIssueType("7", "Bug");

    expect(issueType).toEqual({ name: "Bug", source: "label" });

    const update = calls.find((call) => call.query.includes("mutation UpdateIssueLabels"));
    expect(update?.variables.input).toEqual({ id: "I_7", labelIds: ["LA_new"] });
  });

  it("lists the organization issue type catalogue", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query ListIssueTypes")) {
        return {
          repository: {
            owner: {
              login: "test-owner",
              issueTypes: {
                nodes: [
                  { id: "IT_1", name: "Bug", color: "RED", description: null, isEnabled: true },
                ],
              },
            },
          },
        };
      }
      return issueRead(variables);
    });

    const types = await repository.listIssueTypes();

    expect(types).toEqual([
      {
        id: "IT_1",
        name: "Bug",
        color: "RED",
        description: undefined,
        isEnabled: true,
        source: "native",
      },
    ]);
  });
});

describe("GitHubIssueRepository — reverse project membership", () => {
  it("reads the projects an issue is a member of", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query GetIssueProjectMembership")) {
        return {
          node: {
            id: "I_7",
            number: 7,
            projectItems: {
              nodes: [
                {
                  id: "PVTI_1",
                  project: { id: "PVT_1", number: 12, title: "Roadmap" },
                },
              ],
            },
          },
        };
      }
      return issueRead(variables);
    });

    const membership = await repository.getProjectMembership("7");

    expect(membership).toEqual({
      issueId: "I_7",
      projectIds: ["PVT_1"],
      itemIds: ["PVTI_1"],
      projects: [{ id: "PVT_1", number: 12, title: "Roadmap" }],
    });
  });

  it("answers whether the issue is in a project from live data", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query GetIssueProjectMembership")) {
        return {
          node: {
            id: "I_7",
            number: 7,
            projectItems: {
              nodes: [
                {
                  id: "PVTI_1",
                  project: { id: "PVT_1", number: 12, title: "Roadmap" },
                },
              ],
            },
          },
        };
      }
      return issueRead(variables);
    });

    await expect(repository.isInProject("7", "PVT_1")).resolves.toBe(true);
    await expect(repository.isInProject("7", "PVT_2")).resolves.toBe(false);
  });

  it("reports the project membership on the issue itself", async () => {
    const { repository } = makeRepository((query, variables) => {
      if (query.includes("query($owner: String!, $repo: String!, $number: Int!)")) {
        return {
          repository: {
            issue: {
              ...ISSUE_READ.repository.issue,
              projectItems: {
                nodes: [
                  {
                    id: "PVTI_1",
                    project: { id: "PVT_1", number: 12, title: "Roadmap" },
                  },
                ],
              },
            },
          },
        };
      }
      return issueRead(variables);
    });

    const issue = await repository.findById("7");

    expect(issue?.projectIds).toEqual(["PVT_1"]);
  });
});
